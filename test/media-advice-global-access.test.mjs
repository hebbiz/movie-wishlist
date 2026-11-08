// These are local SQL contract/security checks, not shared-project evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { betaDb, user, group, list, secondUser } from './media-advice-beta-db.fixture.mjs';
import { identityBudgetSql, reserveBudgetSql, predictedBudgetSql, predictedStages } from './media-advice-predicted-budget.fixture.mjs';
import { globalAccessDb, globalAccessSql } from './media-advice-global-access.fixture.mjs';

const sessions = db => db.query('select * from media_advice_private.sessions order by form_session').then(result => result.rows);
const definitions = db => db.query(`select p.oid::regprocedure::text signature, pg_get_functiondef(p.oid) body
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('media_advice_action','media_advice_beta_action','media_advice_cleanup')
  order by signature`).then(result => result.rows);
const snapshot = async db => ({
  sessions: await sessions(db), definitions: await definitions(db),
  movies: (await db.query('select * from public.movies order by id')).rows,
  lists: (await db.query('select * from public.movie_group_lists order by id')).rows,
  memberships: (await db.query('select * from public.group_members order by user_id,group_id')).rows,
  regions: (await db.query('select * from media_advice_private.user_regions order by user_id')).rows,
  flags: (await db.query('select * from media_advice_private.beta_config')).rows,
  permissions: (await db.query('select * from media_advice_private.permissions order by user_id,feature_key')).rows,
});

test('global migration preserves existing cap8/10/12/14 rows, source data and stored decisions while isolating pilot access', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const eight = await rpc('start'); await rpc('reserve', { session: eight.id, stage: 'tmdb-find' });
  await db.exec(await identityBudgetSql());
  const ten = await rpc('start', { n: 2 }); await rpc('reserve', { n: 2, session: ten.id, stage: 'tmdb-person' });
  await db.exec(await reserveBudgetSql());
  const twelve = await rpc('start', { n: 3, stage: 'reserve-exact-v1' });
  await rpc('reserve', { n: 3, session: twelve.id, stage: 'search-3' });
  await db.exec(await predictedBudgetSql());
  const fourteen = await rpc('start', { n: 4, stage: 'predicted-card-v1' });
  await rpc('reserve', { n: 4, session: fourteen.id, stage: 'kinobaza-predicted' });
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)', [user, 'mykola_media_advice_diagnostics']);
  const before = await snapshot(db);
  await db.exec(await globalAccessSql());
  const after = await snapshot(db);
  assert.deepEqual({ ...after, definitions: before.definitions, permissions: before.permissions }, before,
    'existing sessions, source data, membership, regions and Beta flag are unchanged');
  for (const previous of before.permissions) assert.deepEqual(after.permissions.find(row => row.user_id === previous.user_id && row.feature_key === previous.feature_key), previous,
    'existing permission/diagnostic values are never overwritten');
  assert.deepEqual(after.permissions.filter(row => row.feature_key === 'mykola_media_advice'),
    [{ user_id: user, feature_key: 'mykola_media_advice', enabled: true, expires_at: null }], 'only the missing eligible personal flag is assigned');
  for (const definition of before.definitions.filter(row => !row.signature.startsWith('media_advice_action('))) {
    assert.deepEqual(after.definitions.find(row => row.signature === definition.signature), definition,
      'existing Beta ledger and cleanup RPC definitions remain unchanged');
  }
  assert.notDeepEqual(after.definitions.find(row => row.signature.startsWith('media_advice_action(')),
    before.definitions.find(row => row.signature.startsWith('media_advice_action(')), 'pilot RPC receives explicit legacy-allowlist isolation');
  assert.deepEqual(before.sessions.map(row => row.source_cap), [8, 10, 12, 14]);
  const columns = (await db.query(`select column_name,is_nullable,column_default from information_schema.columns
    where table_schema='media_advice_private' and table_name='sessions' order by ordinal_position`)).rows;
  assert.equal(columns.find(row => row.column_name === 'group_id').is_nullable, 'YES');
  assert.equal(columns.find(row => row.column_name === 'source_cap').column_default, '8');
  for (const [n, prior, cap] of [[1,eight,8],[2,ten,10],[3,twelve,12],[4,fourteen,14]]) {
    const receipt = await rpc('finish', { n, session: prior.id });
    assert.equal(receipt.cap, cap);
    assert.equal(receipt.mykola_media_advice_diagnostics, true);
  }
});

test('global capability is independent of movie, form, group, membership and editing role', async t => {
  const { db, globalRpc, rpc } = await globalAccessDb(); t.after(() => db.close());
  await assert.rejects(globalRpc('capability'), /access-denied/);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  for (const role of ['owner','member','visitor']) {
    await db.query('update public.group_members set role=$1', [role]);
    assert.equal((await globalRpc('capability')).mykola_media_advice, true);
  }
  await db.exec('delete from public.group_members; delete from public.movie_group_lists; delete from public.movies; delete from public.groups');
  const before = await snapshot(db);
  const capability = await globalRpc('capability');
  assert.equal(capability.mykola_media_advice, true);
  assert.equal(capability.mykola_media_advice_diagnostics, false);
  assert.deepEqual(await snapshot(db), before, 'global preparation creates no session or source records');
  const started = await globalRpc('start');
  assert.equal(started.cap, 14, 'a UA user without any group can discover a valid film');
  assert.equal((await sessions(db))[0].group_id, null);
  assert.equal((await sessions(db))[0].list_id, null);
  await assert.rejects(rpc('capability'), /access-denied/, 'legacy editing access remains separate');
});

test('global Beta and personal flag authorize; authoritative region changes assign flags but editable claims cannot self-grant', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  await db.query('insert into auth.users values($1,$2)', [secondUser, { region_code: 'UA', mykola_media_advice: true, mykola_media_advice_diagnostics: true }]);
  const capability = await globalRpc('capability', { targetUser: secondUser });
  assert.equal(capability.mykola_media_advice, true, 'the backend trigger assigns the application UA default');
  assert.equal(capability.mykola_media_advice_diagnostics, false, 'editable metadata cannot grant privileged details');
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1", [secondUser]);
  await assert.rejects(globalRpc('capability', { targetUser: secondUser }), /access-denied/);
  await db.query('delete from media_advice_private.user_regions where user_id=$1', [secondUser]);
  await assert.rejects(globalRpc('capability', { targetUser: secondUser }), /access-denied/);
  await db.query("update media_advice_private.permissions set enabled=true where user_id=$1 and feature_key='mykola_media_advice'", [secondUser]);
  assert.equal((await globalRpc('capability', { targetUser: secondUser })).mykola_media_advice,true,
    'manual personal true works even without a backend region: there is no extra runtime region gate');
  await db.query("insert into media_advice_private.user_regions(user_id,region_code) values($1,'GB')",[secondUser]);
  await assert.rejects(globalRpc('capability', { targetUser: secondUser }), /access-denied/,'a new authoritative foreign-region row is a real change and disables that override');
  await db.query("update media_advice_private.permissions set enabled=true where user_id=$1 and feature_key='mykola_media_advice'", [secondUser]);
  const explicitOutside = (await db.query("select * from media_advice_private.permissions where user_id=$1 and feature_key='mykola_media_advice'",[secondUser])).rows;
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[secondUser]);
  assert.equal((await globalRpc('capability', { targetUser: secondUser })).mykola_media_advice,true,'same-region write preserves a manual override');
  assert.deepEqual((await db.query("select * from media_advice_private.permissions where user_id=$1 and feature_key='mykola_media_advice'",[secondUser])).rows,explicitOutside);
  await assert.rejects(globalRpc('capability', { targetUser: '00000000-0000-4000-8000-000000000099' }), /access-denied/);
  await assert.rejects(globalRpc('capability', { targetUser: null }), /invalid-context|access-denied/);
  await db.query("update media_advice_private.permissions set enabled=false where user_id=$1 and feature_key='mykola_media_advice'", [user]);
  await assert.rejects(globalRpc('capability'), /access-denied/, 'an explicit disabled personal flag denies Beta');
  await db.query("update media_advice_private.permissions set enabled=true where user_id=$1 and feature_key='mykola_media_advice'", [user]);
  await db.exec('update media_advice_private.beta_config set enabled=false');
  await assert.rejects(globalRpc('capability'), /access-denied/);
  assert.equal((await sessions(db)).length, 0);
});

test('global RPC is service-only and hardened; clients cannot read private tables or change region/flag', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const signature = 'public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text)';
  const acl = (await db.query(`select has_function_privilege('anon',$1,'EXECUTE') a,
    has_function_privilege('authenticated',$1,'EXECUTE') u,
    has_function_privilege('service_role',$1,'EXECUTE') s`, [signature])).rows[0];
  assert.deepEqual(acl, { a: false, u: false, s: true });
  const policies = (await db.query(`select n.nspname,p.proname,p.prosecdef,p.provolatile,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname='media_advice_beta_global_action')
       or (n.nspname='media_advice_private' and p.proname='assert_beta_feature_access') order by n.nspname`)).rows;
  assert.equal(policies.length, 2);
  assert.equal(policies.find(row => row.nspname === 'public').prosecdef, true);
  for (const row of policies) {
    assert.equal(row.provolatile, 'v', 'authorization must use a fresh snapshot, not STABLE caching');
    assert.ok(row.proconfig.some(value => value === 'search_path=""' || value === 'search_path='));
  }
  const body = (await db.query('select pg_get_functiondef($1::regprocedure) body', [signature])).rows[0].body.toLowerCase();
  const featureBody = (await db.query("select pg_get_functiondef('media_advice_private.assert_beta_feature_access(uuid)'::regprocedure) body")).rows[0].body.toLowerCase();
  assert.doesNotMatch(featureBody,/user_regions|group_members|movie_group_lists/,'effective advice access is Beta + active personal flag, never region or editing scope');
  const lockAt = body.indexOf('pg_advisory_xact_lock');
  assert.ok(lockAt > 0);
  assert.match(body.slice(0, lockAt), /assert_beta_feature_access/);
  const afterLock = body.slice(lockAt);
  assert.ok(afterLock.indexOf('assert_beta_feature_access') >= 0 &&
    afterLock.indexOf('assert_beta_feature_access') < afterLock.indexOf('delete from media_advice_private.sessions'),
  'a queued action rechecks feature access before cleanup or any ledger mutation');
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(globalRpc('capability'), /permission denied/);
    await assert.rejects(db.exec('select * from media_advice_private.sessions'), /permission denied/);
    await assert.rejects(db.exec('select * from media_advice_private.permissions'), /permission denied/);
    await assert.rejects(db.query('select media_advice_private.assert_beta_feature_access($1)', [user]), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await globalRpc('capability')).mykola_media_advice, true);
  await assert.rejects(db.exec('update media_advice_private.beta_config set enabled=false'), /permission denied/);
  await assert.rejects(db.exec("update media_advice_private.user_regions set region_code='GB'"), /permission denied/);
  await assert.rejects(db.query('select media_advice_private.assert_beta_feature_access($1)', [user]), /permission denied/);
  await db.exec('reset role');
});

test('global discovery remains one-shot, exact-film/form scoped, cap14 and unique-stage bounded', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true; delete from public.group_members');
  const receipt = await globalRpc('start');
  assert.equal(receipt.cap, 14);
  assert.equal(receipt.mykola_media_advice_diagnostics, false);
  await assert.rejects(globalRpc('start'), /form-attempt-already-used/);
  await assert.rejects(globalRpc('start', { imdb: 'tt9999999' }), /form-attempt-already-used/, 'changing film does not recycle the same form');
  for (const stage of predictedStages) {
    const result = await globalRpc('reserve', { session: receipt.id, stage });
    assert.equal(result.cap, 14);
    await assert.rejects(globalRpc('reserve', { session: receipt.id, stage }), /attempt-already-spent-or-budget/);
  }
  for (const stage of ['search-4','kinobaza-4','tmdb-person-2','kinobaza-person-2']) {
    await assert.rejects(globalRpc('reserve', { session: receipt.id, stage }), /unsupported-stage/);
  }
  assert.equal((await globalRpc('finish', { session: receipt.id })).attempts.length, 14);
  await assert.rejects(globalRpc('finish', { session: receipt.id }), /session-unavailable/);
  const before = await sessions(db);
  for (const options of [{ n: 2, stage: null },{ n: 2, stage: 'predicted-card-v1' },{ n: 2, stage: 'reserve-exact-v1' },{ n: 2, stage: '14' }]) {
    await assert.rejects(globalRpc('start', options), /unsupported-start-contract/);
  }
  for (const imdb of [null,'','invalid','tt1']) await assert.rejects(globalRpc('start', { n: 2, imdb }), /invalid-context/);
  await assert.rejects(globalRpc('start', { n: 2, targetForm: null }), /invalid-context/);
  assert.deepEqual(await sessions(db), before);
});

test('global and legacy sessions cannot adopt each other; user, IMDb and form mismatches cannot reserve', async t => {
  const { db, globalRpc, rpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const legacy = await rpc('start', { n: 1 });
  await assert.rejects(globalRpc('reserve', { session: legacy.id, stage: 'tmdb-find' }), /session-unavailable/);
  await assert.rejects(globalRpc('start'), /form-attempt-already-used/, 'one-shot replay protection spans both contracts');
  const global = await globalRpc('start', { n: 2 });
  await assert.rejects(rpc('reserve', { n: 2, session: global.id, stage: 'tmdb-find' }), /session-unavailable/);
  await db.query('insert into auth.users(id) values($1)', [secondUser]);
  const wrongContexts = [{ n: 3 },{ n: 2, imdb: 'tt9999999' },{ n: 2, targetUser: secondUser }];
  for (const args of wrongContexts) {
    await assert.rejects(globalRpc('reserve', { ...args, session: global.id, stage: 'tmdb-find' }), /session-unavailable/);
    await assert.rejects(globalRpc('finish', { ...args, session: global.id }), /session-unavailable/);
  }
  assert.deepEqual((await sessions(db)).map(row => row.attempts), [[],[]]);
  assert.deepEqual((await globalRpc('reserve', { n: 2, session: global.id, stage: 'tmdb-find' })).attempts, ['tmdb-find']);
});

test('global feature revocation and expiry deny fresh reserve/finish without consuming attempts', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const session = await globalRpc('start');
  for (const change of ["update media_advice_private.beta_config set enabled=false", "update media_advice_private.user_regions set region_code='GB'"]) {
    await db.exec(change);
    await assert.rejects(globalRpc('reserve', { session: session.id, stage: 'tmdb-find' }), /access-denied/);
    await assert.rejects(globalRpc('finish', { session: session.id }), /access-denied/);
    const saved = (await sessions(db))[0]; assert.deepEqual(saved.attempts, []); assert.equal(saved.finished, false);
    await db.exec("update media_advice_private.beta_config set enabled=true; update media_advice_private.user_regions set region_code='UA'");
  }
  await db.exec("update public.group_members set role='visitor'");
  assert.deepEqual((await globalRpc('reserve', { session: session.id, stage: 'tmdb-find' })).attempts, ['tmdb-find']);
  await db.query("update media_advice_private.sessions set expires_at=clock_timestamp()-interval '1 second' where id=$1", [session.id]);
  await assert.rejects(globalRpc('reserve', { session: session.id, stage: 'tmdb-details' }), /session-unavailable/);
  await assert.rejects(globalRpc('finish', { session: session.id }), /session-unavailable/);
  assert.deepEqual((await sessions(db))[0].attempts, ['tmdb-find']);
});

test('global diagnostics is an independent expiring backend grant and is rechecked at finish', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true; delete from public.group_members');
  const session = await globalRpc('start');
  assert.equal(session.mykola_media_advice_diagnostics, false);
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)', [user, 'mykola_media_advice_diagnostics']);
  assert.equal((await globalRpc('capability')).mykola_media_advice_diagnostics, true);
  assert.equal((await globalRpc('reserve', { session: session.id, stage: 'tmdb-find' })).mykola_media_advice_diagnostics, true);
  await db.exec("update media_advice_private.permissions set expires_at=clock_timestamp()-interval '1 second' where feature_key='mykola_media_advice_diagnostics'");
  assert.equal((await globalRpc('finish', { session: session.id })).mykola_media_advice_diagnostics, false);
  assert.equal((await globalRpc('capability')).mykola_media_advice, true, 'diagnostics expiry does not revoke ordinary Beta');
});

test('global discovery does not grant apply editing rights or bypass legacy movie/list linkage', async t => {
  const { db, globalRpc, rpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  assert.equal((await globalRpc('capability')).mykola_media_advice, true);
  assert.equal((await rpc('capability')).mykola_media_advice, true, 'ordinary existing editor remains allowed');
  await assert.rejects(rpc('capability', { imdb: 'tt9999999' }), /card-context-denied/);
  await assert.rejects(rpc('capability', { targetList: group }), /card-context-denied/);
  for (const change of ["update public.group_members set role='visitor'", 'delete from public.group_members']) {
    await db.exec(change);
    assert.equal((await globalRpc('capability')).mykola_media_advice, true);
    await assert.rejects(rpc('capability'), /access-denied/);
  }
  assert.equal((await db.query('select count(*)::int n from public.movie_group_lists where id=$1', [list])).rows[0].n, 1);
  assert.equal((await sessions(db)).length, 0);
});
