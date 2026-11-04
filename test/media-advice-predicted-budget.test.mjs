// Authored in-memory database only; no shared project or real user data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { betaDb, user } from './media-advice-beta-db.fixture.mjs';
import { predictedBudgetDb, predictedBudgetSql, predictedStages, predictedStartContract, identityBudgetSql, reserveBudgetSql } from './media-advice-predicted-budget.fixture.mjs';
const sessions = db => db.query('select * from media_advice_private.sessions order by form_session').then(r => r.rows);
const pilot = db => db.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body").then(r => r.rows[0].body);

test('predicted migration preserves existing active8/10/12, pilot/default8, data/flags/permissions and versioned new contracts', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const old8 = await rpc('start'); await rpc('reserve', { session: old8.id, stage: 'tmdb-find' });
  await db.exec(await identityBudgetSql());
  const old10 = await rpc('start', { n: 2 }); await rpc('reserve', { n: 2, session: old10.id, stage: 'tmdb-person' });
  await db.exec(await reserveBudgetSql());
  const old12 = await rpc('start', { n: 3, stage: 'reserve-exact-v1' }); await rpc('reserve', { n: 3, session: old12.id, stage: 'search-3' });
  await assert.rejects(rpc('start', { n: 4, stage: predictedStartContract }), /unsupported-start-contract/, 'new handler requires migration first, not silent downgrade');
  const before = await sessions(db), definition = await pilot(db);
  const data = await db.query('select * from public.movies;');
  const flags = await db.query('select * from media_advice_private.beta_config');
  const permissions = await db.query('select * from media_advice_private.permissions');
  await db.exec(await predictedBudgetSql());
  assert.deepEqual(await sessions(db), before); assert.equal(await pilot(db), definition);
  assert.deepEqual(await db.query('select * from public.movies'), data);
  assert.deepEqual(await db.query('select * from media_advice_private.beta_config'), flags);
  assert.deepEqual(await db.query('select * from media_advice_private.permissions'), permissions);
  assert.equal((await db.query("select column_default from information_schema.columns where table_schema='media_advice_private' and table_name='sessions' and column_name='source_cap'")).rows[0].column_default, '8');
  for (const [n, prior] of [[1, old8], [2, old10], [3, old12]]) for (const stage of ['kinobaza-predicted', 'kinobaza-person-predicted']) {
    await assert.rejects(rpc('reserve', { n, session: prior.id, stage }), /unsupported-stage/);
  }
  assert.equal((await rpc('reserve', { n: 2, session: old10.id, stage: 'kinobaza-person' })).cap, 10);
  assert.equal((await rpc('reserve', { n: 3, session: old12.id, stage: 'kinobaza-3' })).cap, 12);
  for (const [n, stage, cap] of [[4, predictedStartContract, 14], [5, 'reserve-exact-v1', 12], [6, null, 10]]) assert.equal((await rpc('start', { n, stage })).cap, cap);
  const snapshot = await sessions(db);
  for (const stage of ['', '14', 'predicted-card-v2', 'kinobaza-predicted']) await assert.rejects(rpc('start', { n: 7, stage }), /unsupported-start-contract/);
  assert.deepEqual(await sessions(db), snapshot);
});

test('fourteen slots are unique, bounded, receipt-loss retry remains spent and there is no second TMDb profile stage', async t => {
  const { db, rpc } = await predictedBudgetDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const s = await rpc('start'); assert.equal(s.cap, 14);
  for (const stage of predictedStages) {
    const receipt = await rpc('reserve', { session: s.id, stage }); assert.equal(receipt.cap, 14);
    await assert.rejects(rpc('reserve', { session: s.id, stage }), /attempt-already-spent-or-budget/);
  }
  for (const stage of ['search-4', 'kinobaza-4', 'tmdb-person-predicted', 'tmdb-person-2', 'kinobaza-person-2']) await assert.rejects(rpc('reserve', { session: s.id, stage }), /unsupported-stage/);
  assert.equal((await rpc('finish', { session: s.id })).attempts.length, 14);
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'kinobaza-predicted' }), /session-unavailable/);
  const gap = await rpc('start', { n: 2 }); assert.deepEqual((await rpc('reserve', { n: 2, session: gap.id, stage: 'kinobaza-predicted' })).attempts, ['kinobaza-predicted']);
  for (const cap of [9, 11, 13, 15]) await assert.rejects(db.query('update media_advice_private.sessions set source_cap=$1', [cap]), /check constraint/);
  await assert.rejects(db.query('update media_advice_private.sessions set source_cap=12 where id=$1', [s.id]), /check constraint/);
});

test('cap14 retains private RPC, UA/group/card guards, switch and diagnostics isolation', async t => {
  const { db, rpc } = await predictedBudgetDb(); t.after(() => db.close());
  assert.equal((await db.query('select enabled from media_advice_private.beta_config')).rows[0].enabled, false);
  assert.equal((await db.query('select count(*)::int n from media_advice_private.permissions')).rows[0].n, 0);
  await assert.rejects(rpc('start'), /access-denied/);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const s = await rpc('start'); assert.equal(s.mykola_media_advice_diagnostics, false);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`); await assert.rejects(rpc('start', { n: 2 }), /permission denied/);
    await assert.rejects(db.exec('select * from media_advice_private.sessions'), /permission denied/); await db.exec('reset role');
  }
  const acl = (await db.query("select has_function_privilege('anon','public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)','EXECUTE') a, has_function_privilege('authenticated','public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)','EXECUTE') u, has_function_privilege('service_role','public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)','EXECUTE') s")).rows[0];
  assert.deepEqual(acl, { a: false, u: false, s: true });
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1", [user]);
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'kinobaza-predicted' }), /access-denied/);
  await db.exec("update media_advice_private.user_regions set region_code='UA'; update public.group_members set role='visitor'");
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'kinobaza-person-predicted' }), /access-denied/);
  await db.exec("update public.group_members set role='member'; update public.movies set imdb_id='tt9999999'");
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'kinobaza-predicted' }), /card-context-denied/);
  assert.equal((await sessions(db))[0].attempts.length, 0);
});
