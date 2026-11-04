// Authored loopback PostgreSQL17 only. No shared Supabase, credentials or sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { fixtureSql, migrationSql, rpcSql, rpcArgs, user } from './media-advice-beta-db.fixture.mjs';
import { identityBudgetSql, reserveBudgetSql, predictedBudgetSql, predictedStages, predictedStartContract } from './media-advice-predicted-budget.fixture.mjs';

test('native PostgreSQL17 cap14 preserves versioned sessions, atomicity, ACL and queued revocation', { skip: !process.env.M4_NATIVE_PG_MODULE }, async t => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.M4_NATIVE_PG_MODULE).href);
  const socket = createServer(); await new Promise(resolveListen => socket.listen(0, '127.0.0.1', resolveListen));
  const port = socket.address().port; await new Promise(resolveClose => socket.close(resolveClose));
  const directoryRoot = resolve(tmpdir()), prefix = 'mw-m4-predicted-budget-pg17-';
  const databaseDir = await mkdtemp(join(directoryRoot, prefix));
  const engine = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'AUTHORED-LOCAL-ONLY', port,
    persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let admin; const workers = [];
  t.after(async () => {
    await Promise.all(workers.map(client => client.end().catch(() => {}))); await admin?.end().catch(() => {}); await engine.stop();
    const target = resolve(databaseDir); assert.equal(dirname(target), directoryRoot); assert.ok(basename(target).startsWith(prefix));
    await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  await engine.initialise(); await engine.start(); admin = engine.getPgClient(); await admin.connect();
  const version = (await admin.query('show server_version')).rows[0].server_version; assert.match(version, /^17\./);
  assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
  t.diagnostic(`Native PostgreSQL ${version}; 16 independent loopback connections; authored fixtures only`);
  await admin.query(fixtureSql); for (const sql of await migrationSql()) await admin.query(sql);
  await admin.query('update media_advice_private.beta_config set enabled=true');
  for (let index = 0; index < 16; index++) { const client = engine.getPgClient(); await client.connect(); await client.query('set role service_role'); workers.push(client); }
  const pids = (await Promise.all(workers.map(client => client.query('select pg_backend_pid() pid')))).map(r => r.rows[0].pid);
  assert.equal(new Set(pids).size, workers.length);
  const rpc = (client, op, args) => client.query(rpcSql, rpcArgs(op, args)).then(r => r.rows[0].result);
  const persisted = id => admin.query('select * from media_advice_private.sessions where id=$1', [id]).then(r => r.rows[0]);
  const old8 = await rpc(workers[0], 'start', { n: 1 }); await rpc(workers[0], 'reserve', { n: 1, session: old8.id, stage: 'tmdb-find' });
  await admin.query(await identityBudgetSql()); const old10 = await rpc(workers[0], 'start', { n: 2 });
  await rpc(workers[0], 'reserve', { n: 2, session: old10.id, stage: 'tmdb-person' });
  await admin.query(await reserveBudgetSql()); const old12 = await rpc(workers[0], 'start', { n: 3, stage: 'reserve-exact-v1' });
  await rpc(workers[0], 'reserve', { n: 3, session: old12.id, stage: 'search-3' });
  await assert.rejects(rpc(workers[0], 'start', { n: 4, stage: predictedStartContract }), /unsupported-start-contract/);
  const originalRows = []; for (const id of [old8.id, old10.id, old12.id]) originalRows.push(await persisted(id));
  const pilotSql = "select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body";
  const pilotBefore = (await admin.query(pilotSql)).rows[0].body;
  await admin.query(await predictedBudgetSql());
  const migratedRows = []; for (const id of [old8.id, old10.id, old12.id]) migratedRows.push(await persisted(id));
  assert.deepEqual(migratedRows, originalRows);
  assert.equal((await admin.query(pilotSql)).rows[0].body, pilotBefore);
  assert.equal((await admin.query('select count(*)::int n from media_advice_private.permissions')).rows[0].n, 0);
  for (const [n, prior] of [[1, old8], [2, old10], [3, old12]]) for (const stage of ['kinobaza-predicted', 'kinobaza-person-predicted']) await assert.rejects(rpc(workers[0], 'reserve', { n, session: prior.id, stage }), /unsupported-stage/);
  for (const [n, stage, cap] of [[4, predictedStartContract, 14], [5, 'reserve-exact-v1', 12], [6, null, 10]]) assert.equal((await rpc(workers[0], 'start', { n, stage })).cap, cap);

  await t.test('same-form starts and new stage reservations have one concurrent winner; fourteen distinct slots stay bounded', async () => {
    const n = 7, starts = await Promise.allSettled(workers.map(client => rpc(client, 'start', { n, stage: predictedStartContract })));
    assert.equal(starts.filter(r => r.status === 'fulfilled').length, 1);
    const session = starts.find(r => r.status === 'fulfilled').value; assert.equal(session.cap, 14);
    for (const r of starts.filter(r => r.status === 'rejected')) assert.match(r.reason.message, /form-attempt-already-used/);
    for (const stage of ['kinobaza-predicted', 'kinobaza-person-predicted']) {
      const reservations = await Promise.allSettled(workers.map(client => rpc(client, 'reserve', { n, session: session.id, stage })));
      assert.equal(reservations.filter(r => r.status === 'fulfilled').length, 1);
      for (const r of reservations.filter(r => r.status === 'rejected')) assert.match(r.reason.message, /attempt-already-spent-or-budget/);
    }
    const remaining = predictedStages.filter(stage => !['kinobaza-predicted', 'kinobaza-person-predicted'].includes(stage));
    const receipts = await Promise.all(remaining.map((stage, i) => rpc(workers[i], 'reserve', { n, session: session.id, stage })));
    assert.deepEqual(receipts.map(r => r.attempts.length).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 3));
    assert.deepEqual(new Set((await persisted(session.id)).attempts), new Set(predictedStages));
    for (const stage of predictedStages) await assert.rejects(rpc(workers[0], 'reserve', { n, session: session.id, stage }), /attempt-already-spent-or-budget/);
    for (const stage of ['search-4', 'kinobaza-4', 'tmdb-person-predicted', 'kinobaza-person-2']) await assert.rejects(rpc(workers[0], 'reserve', { n, session: session.id, stage }), /unsupported-stage/);
    assert.equal((await rpc(workers[0], 'finish', { n, session: session.id })).attempts.length, 14);
  });

  await t.test('RPC/private ACL remain service-only with empty search path', async () => {
    const signature = 'public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)';
    const acl = (await admin.query("select has_function_privilege('anon',$1,'EXECUTE') a, has_function_privilege('authenticated',$1,'EXECUTE') u, has_function_privilege('service_role',$1,'EXECUTE') s", [signature])).rows[0];
    assert.deepEqual(acl, { a: false, u: false, s: true });
    assert.ok((await admin.query('select proconfig from pg_proc where oid=$1::regprocedure', [signature])).rows[0].proconfig.includes('search_path=""'));
    for (const role of ['anon', 'authenticated']) {
      await workers[2].query('reset role'); await workers[2].query(`set role ${role}`);
      try { await assert.rejects(rpc(workers[2], 'start', { n: 8, stage: predictedStartContract }), /permission denied/); await assert.rejects(workers[2].query('select * from media_advice_private.sessions'), /permission denied/); }
      finally { await workers[2].query('reset role'); await workers[2].query('set role service_role'); }
    }
  });

  for (const [i, mode] of ['region', 'switch', 'membership', 'card'].entries()) for (const [j, stage] of ['kinobaza-predicted', 'kinobaza-person-predicted'].entries()) {
    await t.test(`queued ${mode} revocation denies ${stage} without consuming a slot`, async () => {
      await admin.query("update media_advice_private.beta_config set enabled=true; update media_advice_private.user_regions set region_code='UA'; update public.group_members set role='member'; update public.movies set imdb_id='tt1234567'");
      const n = 10 + i * 2 + j, session = await rpc(workers[0], 'start', { n, stage: predictedStartContract });
      await workers[0].query('begin');
      try {
        await workers[0].query('select pg_advisory_xact_lock(hashtextextended($1,4104))', [user]);
        const queued = rpc(workers[1], 'reserve', { n, session: session.id, stage }).then(value => ({ value }), error => ({ error }));
        let waiting = false;
        for (let attempt = 0; attempt < 500; attempt++) {
          const state = await admin.query("select count(*)::int n from pg_stat_activity where pid=$1 and wait_event_type='Lock' and wait_event='advisory'", [pids[1]]);
          if (state.rows[0].n === 1) { waiting = true; break; } await new Promise(resolveWait => setTimeout(resolveWait, 10));
        }
        assert.equal(waiting, true);
        await admin.query({ region: "update media_advice_private.user_regions set region_code='GB'", switch: 'update media_advice_private.beta_config set enabled=false', membership: "update public.group_members set role='visitor'", card: "update public.movies set imdb_id='tt9999999'" }[mode]);
        await workers[0].query('commit'); const outcome = await queued; assert.ok(outcome.error);
        assert.match(outcome.error.message, mode === 'card' ? /card-context-denied/ : /access-denied/);
      } catch (error) { await workers[0].query('rollback'); throw error; }
      assert.deepEqual((await persisted(session.id)).attempts, []);
    });
  }
});
