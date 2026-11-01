import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { fixtureSql, migrationSql, rpcSql, rpcArgs, user } from './media-advice-beta-db.fixture.mjs';
import { identityBudgetSql, stages } from './media-advice-identity-budget.fixture.mjs';

test('native PostgreSQL17 identity budget10 and queued authorization remain atomic', { skip: !process.env.M4_NATIVE_PG_MODULE }, async t => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.M4_NATIVE_PG_MODULE).href);
  const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const databaseDir = await mkdtemp(join(tmpdir(), 'mw-m4-identity-budget-pg17-'));
  const engine = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'AUTHORED-LOCAL-ONLY', port,
    persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let admin; const workers = [];
  t.after(async () => {
    await Promise.all(workers.map(c => c.end().catch(() => {}))); await admin?.end().catch(() => {}); await engine.stop();
    // Only this mkdtemp-owned authored cluster; retry delayed Windows child handles.
    await rm(databaseDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  await engine.initialise(); await engine.start(); admin = engine.getPgClient(); await admin.connect();
  const version = (await admin.query('show server_version')).rows[0].server_version;
  assert.match(version, /^17\./); assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
  t.diagnostic(`Native PostgreSQL ${version}; 24 independent loopback connections; authored data only`);
  await admin.query(fixtureSql); for (const sql of await migrationSql()) await admin.query(sql);
  await admin.query('update media_advice_private.beta_config set enabled=true');
  for (let n = 0; n < 24; n++) { const c = engine.getPgClient(); await c.connect(); await c.query('set role service_role'); workers.push(c); }
  assert.equal(new Set((await Promise.all(workers.map(c => c.query('select pg_backend_pid() pid')))).map(r => r.rows[0].pid)).size, 24);
  const rpc = (c, op, args) => c.query(rpcSql, rpcArgs(op, args)).then(r => r.rows[0].result);
  const old = await rpc(workers[0], 'start'); assert.equal(old.cap, 8);
  await admin.query(await identityBudgetSql());
  assert.equal((await rpc(workers[0], 'reserve', { session: old.id, stage: 'tmdb-find' })).cap, 8);
  await assert.rejects(rpc(workers[0], 'reserve', { session: old.id, stage: 'tmdb-person' }), /unsupported-stage/);
  await t.test('parallel starts and profile reservations cannot double spend, all ten stages remain available', async () => {
    const starts = await Promise.allSettled(workers.map(c => rpc(c, 'start', { n: 2 })));
    assert.equal(starts.filter(r => r.status === 'fulfilled').length, 1);
    const session = starts.find(r => r.status === 'fulfilled').value;
    assert.equal(session.cap, 10);
    for (const stage of stages.slice(8)) {
      const reservations = await Promise.allSettled(workers.map(c => rpc(c, 'reserve', { n: 2, session: session.id, stage })));
      assert.equal(reservations.filter(r => r.status === 'fulfilled').length, 1);
    }
    const baseline = await Promise.all(stages.slice(0, 8).map((stage, i) => rpc(workers[i], 'reserve', { n: 2, session: session.id, stage })));
    // Promise.all preserves submission order, not advisory-lock commit order.
    // Every receipt must represent one distinct committed append; verify the
    // final persisted state instead of mistaking the last input for last commit.
    assert.deepEqual(baseline.map(r => r.attempts.length).sort((a,b)=>a-b), [3,4,5,6,7,8,9,10]);
    assert.equal((await admin.query('select cardinality(attempts) n from media_advice_private.sessions where id=$1', [session.id])).rows[0].n, 10);
    await assert.rejects(rpc(workers[0], 'reserve', { n: 2, session: session.id, stage: 'kinobaza-person' }), /attempt-already-spent-or-budget/);
    assert.equal((await rpc(workers[0], 'finish', { n: 2, session: session.id })).attempts.length, 10);
  });
  for (const [index, mode] of ['region', 'switch', 'membership', 'card'].entries()) await t.test(`queued ${mode} revocation denies profile reservation before mutation`, async () => {
    await admin.query("update media_advice_private.beta_config set enabled=true; update media_advice_private.user_regions set region_code='UA'; update public.group_members set role='member'; update public.movies set imdb_id='tt1234567'");
    const n = index + 10, session = (await rpc(workers[0], 'start', { n })).id;
    await workers[0].query('begin'); await workers[0].query('select pg_advisory_xact_lock(hashtextextended($1,4104))', [user]);
    const queued = rpc(workers[1], 'reserve', { n, session, stage: 'kinobaza-person' });
    const rejected = assert.rejects(queued, mode === 'card' ? /card-context-denied/ : /access-denied/);
    let waiting = false;
    for (let i = 0; i < 500; i++) {
      if (Number((await admin.query("select count(*) n from pg_stat_activity where wait_event='advisory'")).rows[0].n) > 0) { waiting = true; break; }
      await new Promise(r => setTimeout(r, 10));
    }
    assert.equal(waiting, true, 'reservation reached advisory lock before revocation');
    await admin.query({ region: "update media_advice_private.user_regions set region_code='GB'", switch: 'update media_advice_private.beta_config set enabled=false',
      membership: "update public.group_members set role='visitor'", card: "update public.movies set imdb_id='tt9999999'" }[mode]);
    await workers[0].query('commit'); await rejected;
    assert.equal((await admin.query('select cardinality(attempts) n from media_advice_private.sessions where id=$1', [session])).rows[0].n, 0);
  });
});
