import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';

// Explicit opt-in portable/local engine; no project/prod connection string.
// The caller supplies a pinned embedded-postgres module, not an app dependency.
test('native PostgreSQL 17 multi-connection ledger and queued authorization', { skip: !process.env.M4_NATIVE_PG_MODULE }, async t => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.M4_NATIVE_PG_MODULE).href);
  const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const databaseDir = await mkdtemp(join(tmpdir(), 'mw-m4-pg17-'));
  const engine = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'AUTHORED-LOCAL-ONLY', port,
    persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let admin, workers = [];
  t.after(async () => { await Promise.all(workers.map(c => c.end().catch(() => {}))); await admin?.end().catch(() => {}); await engine.stop(); });
  await engine.initialise(); await engine.start(); admin = engine.getPgClient(); await admin.connect();
  const version = (await admin.query('show server_version')).rows[0].server_version;
  assert.match(version, /^17\./); t.diagnostic(`Native PostgreSQL ${version}; 24 independent loopback connections; authored schema only`);
  await admin.query(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.groups(id uuid primary key);
    create table public.group_members(user_id uuid,group_id uuid,role text);
    create table public.movies(id uuid primary key,imdb_id text);
    create table public.movie_group_lists(id uuid primary key,movie_id uuid,group_id uuid);`);
  for (const file of ['20261020205122_media_advice_access_ledger.sql', '20261021072002_media_advice_review_fixes.sql'])
    await admin.query(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  const user = '00000000-0000-4000-8000-000000000001', group = '00000000-0000-4000-8000-000000000002', list = '00000000-0000-4000-8000-000000000003';
  const form = n => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
  await admin.query(`insert into auth.users values('${user}');insert into public.groups values('${group}');
    insert into public.group_members values('${user}','${group}','member');
    insert into public.movies values('${list}','tt1234567');insert into public.movie_group_lists values('${list}','${list}','${group}');
    insert into media_advice_private.permissions values('${user}','mykola_media_advice',true,null)`);
  workers = await Promise.all(Array.from({ length: 24 }, async () => { const c = engine.getPgClient(); await c.connect(); await c.query('set role service_role'); return c; }));
  assert.equal(new Set((await Promise.all(workers.map(c => c.query('select pg_backend_pid() pid')))).map(r => r.rows[0].pid)).size, 24);
  const rpc = (c, op, { n = 1, session = null, stage = null } = {}) => c.query('select public.media_advice_action($1,$2,$3,$4,$5,$6,$7,$8) r', [user, group, 'tt1234567', list, form(n), op, session, stage]).then(r => r.rows[0].r);
  const parallel = async (tasks, expected) => { const results = await Promise.allSettled(tasks); assert.equal(results.filter(r => r.status === 'fulfilled').length, expected); return results; };
  await t.test('parallel starts/stages/cap cannot reset or double-spend', async () => {
    const starts = await parallel(workers.map(c => rpc(c, 'start')), 1), session = starts.find(r => r.status === 'fulfilled').value.id;
    await parallel(workers.map(c => rpc(c, 'reserve', { session, stage: 'tmdb-find' })), 1);
    const stages = ['tmdb-details', 'tmdb-providers', 'motn-title', 'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2'];
    await parallel(stages.map((stage, i) => rpc(workers[i], 'reserve', { session, stage })), 7);
    assert.equal((await rpc(workers[0], 'finish', { session })).attempts.length, 8);
    await parallel(workers.slice(0, 4).map(c => rpc(c, 'reserve', { session, stage: 'tmdb-find' })), 0);
    await admin.query('truncate media_advice_private.sessions');
    for (let n = 1; n <= 19; n++) await rpc(workers[0], 'start', { n });
    await parallel(workers.map((c, i) => rpc(c, 'start', { n: i + 100 })), 1);
    assert.equal(Number((await admin.query('select count(*) n from media_advice_private.sessions')).rows[0].n), 20);
  });
  // This reproduces the pre-fix race, not just revocation before RPC entry.
  for (const mode of ['flag', 'membership', 'card']) await t.test(`revoked ${mode} while reservation is queued denies without mutation`, async () => {
    await admin.query(`truncate media_advice_private.sessions;update media_advice_private.permissions set enabled=true;
      update public.group_members set role='member';update public.movies set imdb_id='tt1234567'`);
    const session = (await rpc(workers[0], 'start')).id;
    await workers[0].query('begin'); await workers[0].query('select pg_advisory_xact_lock(hashtextextended($1,4104))', [user]);
    const queued = rpc(workers[1], 'reserve', { session, stage: 'tmdb-find' });
    const rejected = assert.rejects(queued, mode === 'card' ? /card-context-denied/ : /access-denied/);
    const pid = (await workers[2].query('select pg_backend_pid()')).rows[0]; assert.ok(pid);
    let waiting = false;
    for (let i = 0; i < 500; i++) {
      if (Number((await admin.query("select count(*) n from pg_stat_activity where wait_event='advisory'")).rows[0].n) > 0) { waiting = true; break; }
      await new Promise(r => setTimeout(r, 10));
    }
    assert.equal(waiting, true, 'reservation reached advisory lock before revocation');
    await admin.query(mode === 'flag' ? 'update media_advice_private.permissions set enabled=false' : mode === 'membership' ? "update public.group_members set role='visitor'" : "update public.movies set imdb_id='tt9999999'");
    await workers[0].query('commit'); await rejected;
    assert.equal((await admin.query('select cardinality(attempts) n from media_advice_private.sessions')).rows[0].n, 0);
  });
  await t.test('cleanup/privileges leave card rows alone and report health', async () => {
    await admin.query("update media_advice_private.sessions set created_at=now()-interval '25 hours', expires_at=now()-interval '1 hour'");
    assert.equal(Number((await admin.query('select public.media_advice_cleanup() n')).rows[0].n), 1);
    assert.equal(Number((await admin.query('select count(*) n from public.movie_group_lists')).rows[0].n), 1);
    assert.equal(Number((await admin.query('select count(*) n from public.movies')).rows[0].n), 1);
    const monitor = await admin.query(await readFile(new URL('../supabase/operations/media-advice-cleanup.sql', import.meta.url), 'utf8'));
    assert.equal(monitor.rows[0].missed_or_failed_run, false); assert.equal(Number(monitor.rows[0].overdue_sessions), 0);
    await admin.query("update media_advice_private.cleanup_health set last_success_at=now()-interval '27 hours'");
    assert.equal((await admin.query(await readFile(new URL('../supabase/operations/media-advice-cleanup.sql', import.meta.url), 'utf8'))).rows[0].missed_or_failed_run, true);
    await admin.query('set role authenticated'); await assert.rejects(rpc(admin, 'capability'), /permission denied/);
    await assert.rejects(admin.query('select public.media_advice_cleanup()'), /permission denied/); await admin.query('reset role');
  });
});
