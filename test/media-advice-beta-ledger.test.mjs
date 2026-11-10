import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { betaDb, user, secondUser, group, list, migrationSql } from './media-advice-beta-db.fixture.mjs';

test('Beta defaults off; existing/new users default UA without trusting editable metadata', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  assert.equal((await db.query('select region_code from media_advice_private.user_regions where user_id=$1', [user])).rows[0].region_code, 'UA');
  assert.equal((await db.query('select enabled from media_advice_private.beta_config')).rows[0].enabled, false);
  await assert.rejects(rpc('capability'), /access-denied/);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  assert.deepEqual(await rpc('capability'), { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  await db.query('insert into auth.users values($1,$2)', [secondUser, { region_code: 'GB', mykola_media_advice_diagnostics: true }]);
  assert.equal((await db.query('select region_code from media_advice_private.user_regions where user_id=$1', [secondUser])).rows[0].region_code, 'UA');
  await db.query('insert into public.group_members values($1,$2,$3)', [secondUser, group, 'member']);
  assert.deepEqual(await rpc('capability', { targetUser: secondUser }), { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1", [secondUser]);
  // This is the same no-overwrite backfill operation used by the migration.
  await db.exec('insert into media_advice_private.user_regions(user_id) select id from auth.users on conflict(user_id) do nothing');
  assert.equal((await db.query('select region_code from media_advice_private.user_regions where user_id=$1', [secondUser])).rows[0].region_code, 'GB');
  await assert.rejects(rpc('capability', { targetUser: secondUser }), /access-denied/);
  await assert.rejects(db.query("update media_advice_private.user_regions set region_code='ua' where user_id=$1", [secondUser]), /check constraint/);
});

test('private regions/config/diagnostics cannot self-grant; fresh group/card rights remain required', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(rpc('capability'), /permission denied/);
    for (const table of ['user_regions', 'beta_config', 'permissions']) {
      await assert.rejects(db.query(`select * from media_advice_private.${table}`), /permission denied/);
      await assert.rejects(db.query(`delete from media_advice_private.${table}`), /permission denied/);
    }
    await assert.rejects(db.query('select media_advice_private.set_default_user_region()'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await rpc('capability')).mykola_media_advice, true);
  await assert.rejects(db.query('update media_advice_private.beta_config set enabled=true'), /permission denied/);
  await assert.rejects(db.query("update media_advice_private.user_regions set region_code='UA'"), /permission denied/);
  await db.exec('reset role');
  await assert.rejects(rpc('capability', { targetGroup: user }), /access-denied/);
  await assert.rejects(rpc('capability', { imdb: 'tt9999999' }), /card-context-denied/);
  assert.equal((await rpc('capability', { targetList: null })).mykola_media_advice, true);
  await db.exec("update public.group_members set role='visitor'");
  await assert.rejects(rpc('start'), /access-denied/);
});

test('diagnostics is an independent backend permission; expiry/revocation is fresh at action/finish', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const s = await rpc('start'); assert.equal(s.mykola_media_advice_diagnostics, false);
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)', [user, 'mykola_media_advice_diagnostics']);
  assert.equal((await rpc('capability')).mykola_media_advice_diagnostics, true);
  assert.equal((await rpc('reserve', { session: s.id, stage: 'tmdb-find' })).mykola_media_advice_diagnostics, true);
  await db.exec("update media_advice_private.permissions set expires_at=now()-interval '1 second' where feature_key='mykola_media_advice_diagnostics'");
  assert.equal((await rpc('finish', { session: s.id })).mykola_media_advice_diagnostics, false);
  const next = await rpc('start', { n: 2 });
  await db.exec('update media_advice_private.beta_config set enabled=false');
  await assert.rejects(rpc('finish', { n: 2, session: next.id }), /access-denied/);
  assert.equal((await db.query('select finished from media_advice_private.sessions where id=$1', [next.id])).rows[0].finished, false);
});

test('Beta removes user search-count quota while preserving one-shot, stages, cap, TTL and content-free retention', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  for (let n = 1; n <= 25; n++) await rpc('start', { n });
  assert.equal((await db.query('select count(*)::int n from media_advice_private.sessions')).rows[0].n, 25);
  await assert.rejects(rpc('start'), /form-attempt-already-used/);
  const s = await rpc('start', { n: 26 });
  for (const stage of ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title', 'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2'])
    await rpc('reserve', { n: 26, session: s.id, stage });
  await assert.rejects(rpc('reserve', { n: 26, session: s.id, stage: 'search-1' }), /attempt-already-spent-or-budget/);
  await assert.rejects(rpc('reserve', { n: 26, session: s.id, stage: 'other' }), /unsupported-stage/);
  assert.equal((await rpc('finish', { n: 26, session: s.id })).attempts.length, 8);
  const expired = await rpc('start', { n: 27 });
  await db.query("update media_advice_private.sessions set expires_at=now()-interval '1 second' where id=$1", [expired.id]);
  await assert.rejects(rpc('reserve', { n: 27, session: expired.id, stage: 'tmdb-find' }), /session-unavailable/);
  assert.equal((await db.query('select max(expires_at-created_at)=interval \'30 minutes\' ok from media_advice_private.sessions')).rows[0].ok, true);
  await db.exec("update media_advice_private.sessions set created_at=now()-interval '25 hours', expires_at=now()-interval '1 hour'");
  assert.equal((await db.query('select public.media_advice_cleanup() n')).rows[0].n, 27);
  assert.equal((await db.query('select count(*)::int n from public.movies')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from public.movie_group_lists')).rows[0].n, 1);
  const cols = (await db.query("select column_name from information_schema.columns where table_schema='media_advice_private' and table_name='sessions'")).rows.map(r => r.column_name);
  assert.ok(!cols.some(c => /body|response|html|chat|secret|token/.test(c)));
});

test('prepared rollback only closes Beta; legacy pilot RPC and explicit regions/assignments survive', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)', [user, 'mykola_media_advice']);
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1", [user]);
  await db.exec(await readFile(new URL('../supabase/operations/media-advice-beta.rollback.sql', import.meta.url), 'utf8'));
  await assert.rejects(rpc('capability'), /access-denied/);
  assert.equal((await db.query('select region_code from media_advice_private.user_regions where user_id=$1', [user])).rows[0].region_code, 'GB');
  assert.equal((await db.query('select count(*)::int n from media_advice_private.permissions')).rows[0].n, 1);
  assert.equal((await db.query('select public.media_advice_action($1,$2,$3,$4,$5,$6) r', [user, group, 'tt1234567', list, '10000000-0000-4000-8000-000000000099', 'capability'])).rows[0].r.mykola_media_advice, true);
});

test('prepared activation requires the exact established pilot assignment; no first-user selection or broad diagnostics', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  // Emulate only psql variable substitution/output consumption with authored
  // UUIDs; this does not claim production activation or CLI/scheduler evidence.
  const operation = (await readFile(new URL('../supabase/operations/media-advice-beta.activate.sql', import.meta.url), 'utf8'))
    .replace(":'verified_test_user_id'", `'${user}'`)
    .replace(' as local_assignment_context \\gset', ';');
  await assert.rejects(db.exec(operation), /verify-existing-pilot-assignment/);
  await db.exec('rollback');
  assert.equal((await db.query('select enabled from media_advice_private.beta_config')).rows[0].enabled, false);
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)', [user, 'mykola_media_advice']);
  await db.exec(operation);
  assert.deepEqual(await rpc('capability'), { mykola_media_advice: true, mykola_media_advice_diagnostics: true });
  await db.query('insert into auth.users(id) values($1)', [secondUser]);
  await db.query('insert into public.group_members values($1,$2,$3)', [secondUser, group, 'member']);
  assert.deepEqual(await rpc('capability', { targetUser: secondUser }), { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
});

test('migration installs trigger before no-overwrite backfill; prepared metadata checks are read-only and executable', async t => {
  const { db } = await betaDb(); t.after(() => db.close());
  const beta = (await migrationSql()).at(-1);
  assert.ok(beta.indexOf('create trigger media_advice_set_default_region') < beta.indexOf('select id from auth.users on conflict(user_id) do nothing'));
  await db.exec(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key, name text);
    insert into supabase_migrations.schema_migrations values('20261020205122','media_advice_access_ledger'),
      ('20261021072002','media_advice_review_fixes'),('20261031135149','media_advice_beta_ua')`);
  for (const operation of ['preflight', 'postcheck']) {
    const sql = await readFile(new URL(`../supabase/operations/media-advice-beta.${operation}.sql`, import.meta.url), 'utf8');
    await db.exec('begin read only');
    const results = await db.exec(sql);
    await db.exec('rollback');
    assert.ok(results.length > 3);
    if (operation === 'postcheck') {
      assert.equal(results.find(r => r.rows[0]?.exactly_one_beta_history !== undefined).rows[0].exactly_one_beta_history, true);
      const privileges = results.find(r => r.rows[0]?.beta_rpc_execute !== undefined).rows;
      for (const role of ['anon', 'authenticated']) {
        const row = privileges.find(r => r.rolname === role);
        assert.equal(row.beta_rpc_execute, false); assert.equal(row.region_write, false); assert.equal(row.config_write, false);
      }
    }
  }
});
