// Native concurrency/security probes against an isolated authored loopback
// cluster only. No shared project, real users, source credentials or requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { fixtureSql, migrationSql, rpcSql, rpcArgs, user } from './media-advice-beta-db.fixture.mjs';
import { identityBudgetSql, reserveBudgetSql, reserveStages, reserveStartContract } from './media-advice-reserve-budget.fixture.mjs';

const MARKER = reserveStartContract;
const RPC = 'public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)';

test('native PostgreSQL17 reserve cap12 is versioned, atomic and revocation-safe', { skip: !process.env.M4_NATIVE_PG_MODULE }, async t => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.M4_NATIVE_PG_MODULE).href);
  const socket = createServer(); await new Promise(resolveListen => socket.listen(0, '127.0.0.1', resolveListen));
  const port = socket.address().port; await new Promise(resolveClose => socket.close(resolveClose));
  const directoryRoot = resolve(tmpdir()), prefix = 'mw-m4-reserve-budget-pg17-';
  const databaseDir = await mkdtemp(join(directoryRoot, prefix));
  const engine = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'AUTHORED-LOCAL-ONLY', port,
    persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let admin; const workers = [];
  t.after(async () => {
    await Promise.all(workers.map(client => client.end().catch(() => {})));
    await admin?.end().catch(() => {}); await engine.stop();
    // Validate the exact mkdtemp-owned target before recursive Windows cleanup.
    const target = resolve(databaseDir);
    assert.equal(dirname(target), directoryRoot); assert.ok(basename(target).startsWith(prefix));
    await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  await engine.initialise(); await engine.start(); admin = engine.getPgClient(); await admin.connect();
  const version = (await admin.query('show server_version')).rows[0].server_version;
  assert.match(version, /^17\./); assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
  t.diagnostic(`Native PostgreSQL ${version}; 24 independent loopback connections; authored fixtures only`);
  await admin.query(fixtureSql); for (const sql of await migrationSql()) await admin.query(sql);
  await admin.query('update media_advice_private.beta_config set enabled=true');
  for (let index = 0; index < 24; index++) {
    const client = engine.getPgClient(); await client.connect(); await client.query('set role service_role'); workers.push(client);
  }
  const pids = (await Promise.all(workers.map(client => client.query('select pg_backend_pid() pid')))).map(result => result.rows[0].pid);
  assert.equal(new Set(pids).size, workers.length);
  const rpc = (client, operation, args) => client.query(rpcSql, rpcArgs(operation, args)).then(result => result.rows[0].result);
  const persisted = id => admin.query('select * from media_advice_private.sessions where id=$1', [id]).then(result => result.rows[0]);
  const countAttempts = id => admin.query('select cardinality(attempts) n from media_advice_private.sessions where id=$1', [id]).then(result => result.rows[0].n);

  // Keep both historical budgets active across the new migration, including an
  // already consumed stage. The migration must not rewrite either row.
  const old8 = await rpc(workers[0], 'start', { n: 1 }); assert.equal(old8.cap, 8);
  await rpc(workers[0], 'reserve', { n: 1, session: old8.id, stage: 'tmdb-find' });
  await admin.query(await identityBudgetSql());
  const old10 = await rpc(workers[0], 'start', { n: 2, stage: MARKER });
  assert.equal(old10.cap, 10, 'new-code marker on the old SQL cannot manufacture a cap12 session');
  await rpc(workers[0], 'reserve', { n: 2, session: old10.id, stage: 'tmdb-person' });
  const originalRows = await Promise.all([old8.id, old10.id].map(persisted));
  const pilotDefinition = (await admin.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body")).rows[0].body;
  await admin.query(await reserveBudgetSql());
  assert.deepEqual(await Promise.all([old8.id, old10.id].map(persisted)), originalRows);
  assert.equal((await admin.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body")).rows[0].body, pilotDefinition);
  for (const [n, session] of [[1, old8], [2, old10]]) for (const stage of ['search-3', 'kinobaza-3']) {
    await assert.rejects(rpc(workers[0], 'reserve', { n, session: session.id, stage }), /unsupported-stage/);
  }
  assert.equal((await rpc(workers[0], 'reserve', { n: 2, session: old10.id, stage: 'kinobaza-person' })).cap, 10);
  const oldCaller = await rpc(workers[0], 'start', { n: 3 });
  assert.equal(oldCaller.cap, 10, 'an old caller without the explicit server marker keeps cap10 after migration');
  for (const stage of ['search-3', 'kinobaza-3']) await assert.rejects(rpc(workers[0], 'reserve', { n: 3, session: oldCaller.id, stage }), /unsupported-stage/);
  assert.equal(await countAttempts(oldCaller.id), 0);
  const rowsBeforeInvalid = (await admin.query('select * from media_advice_private.sessions order by form_session')).rows;
  for (const stage of ['', 'reserve-exact-v2', '12']) await assert.rejects(rpc(workers[0], 'start', { n: 5, stage }), /unsupported-start-contract/);
  assert.deepEqual((await admin.query('select * from media_advice_private.sessions order by form_session')).rows, rowsBeforeInvalid);

  await t.test('marked same-form starts and each reserve slot have a single concurrent winner; all twelve stages remain bounded', async () => {
    const n = 4;
    const starts = await Promise.allSettled(workers.map(client => rpc(client, 'start', { n, stage: MARKER })));
    assert.equal(starts.filter(result => result.status === 'fulfilled').length, 1);
    for (const result of starts.filter(result => result.status === 'rejected')) assert.match(result.reason.message, /form-attempt-already-used/);
    const session = starts.find(result => result.status === 'fulfilled').value;
    assert.equal(session.cap, 12); assert.deepEqual(session.attempts, []);
    for (const stage of ['search-3', 'kinobaza-3']) {
      const reservations = await Promise.allSettled(workers.map(client => rpc(client, 'reserve', { n, session: session.id, stage })));
      assert.equal(reservations.filter(result => result.status === 'fulfilled').length, 1);
      for (const result of reservations.filter(result => result.status === 'rejected')) assert.match(result.reason.message, /attempt-already-spent-or-budget/);
    }
    const firstTen = reserveStages.filter(stage => !['search-3', 'kinobaza-3'].includes(stage));
    assert.equal(firstTen.length, 10); assert.ok(firstTen.includes('tmdb-person')); assert.ok(firstTen.includes('kinobaza-person'));
    const receipts = await Promise.all(firstTen.map((stage, index) => rpc(workers[index], 'reserve', { n, session: session.id, stage })));
    assert.deepEqual(receipts.map(receipt => receipt.attempts.length).sort((a, b) => a - b), [3,4,5,6,7,8,9,10,11,12]);
    const row = await persisted(session.id);
    assert.equal(row.source_cap, 12); assert.equal(row.attempts.length, 12);
    assert.deepEqual(new Set(row.attempts), new Set(reserveStages));
    for (const stage of reserveStages) await assert.rejects(rpc(workers[0], 'reserve', { n, session: session.id, stage }), /attempt-already-spent-or-budget/);
    for (const stage of ['search-4', 'kinobaza-4', 'tmdb-person-2', 'kinobaza-person-2']) {
      await assert.rejects(rpc(workers[0], 'reserve', { n, session: session.id, stage }), /unsupported-stage/);
    }
    assert.equal(await countAttempts(session.id), 12);
    assert.equal((await rpc(workers[0], 'finish', { n, session: session.id })).attempts.length, 12);
    await assert.rejects(rpc(workers[0], 'reserve', { n, session: session.id, stage: 'search-3' }), /session-unavailable/);
  });

  await t.test('simultaneous old and marked callers for one form create exactly one session with its winning protocol budget', async () => {
    const n = 6, starts = await Promise.allSettled(workers.map((client, index) => rpc(client, 'start', { n, stage: index % 2 ? MARKER : null })));
    assert.equal(starts.filter(result => result.status === 'fulfilled').length, 1);
    const winner = starts.findIndex(result => result.status === 'fulfilled'), session = starts[winner].value;
    assert.equal(session.cap, winner % 2 ? 12 : 10); assert.deepEqual(session.attempts, []);
    for (const result of starts.filter(result => result.status === 'rejected')) assert.match(result.reason.message, /form-attempt-already-used/);
    assert.equal((await persisted(session.id)).source_cap, session.cap);
    const formRows = await admin.query('select count(*)::int n from media_advice_private.sessions where form_session=$1', [rpcArgs('start', { n })[4]]);
    assert.equal(formRows.rows[0].n, 1);
  });

  await t.test('reserve marker does not grant anon/authenticated RPC or private ledger access', async () => {
    const acl = (await admin.query('select has_function_privilege(\'anon\',$1,\'EXECUTE\') a, has_function_privilege(\'authenticated\',$1,\'EXECUTE\') u, has_function_privilege(\'service_role\',$1,\'EXECUTE\') s', [RPC])).rows[0];
    assert.deepEqual(acl, { a: false, u: false, s: true });
    const config = (await admin.query('select proconfig from pg_proc where oid=$1::regprocedure', [RPC])).rows[0].proconfig;
    assert.ok(config.includes('search_path=""'));
    const client = workers[2];
    for (const role of ['anon', 'authenticated']) {
      await client.query('reset role'); await client.query(`set role ${role}`);
      try {
        await assert.rejects(rpc(client, 'start', { n: 5, stage: MARKER }), /permission denied/);
        await assert.rejects(client.query('select * from media_advice_private.sessions'), /permission denied/);
      } finally { await client.query('reset role'); await client.query('set role service_role'); }
    }
    assert.equal((await admin.query('select count(*)::int n from media_advice_private.sessions')).rows[0].n, 5);
  });

  for (const [index, mode] of ['region', 'switch', 'membership', 'card'].entries()) for (const [offset, stage] of ['search-3', 'kinobaza-3'].entries()) {
    await t.test(`queued ${mode} revocation denies ${stage} before ledger mutation`, async () => {
      await admin.query("update media_advice_private.beta_config set enabled=true; update media_advice_private.user_regions set region_code='UA'; update public.group_members set role='member'; update public.movies set imdb_id='tt1234567'");
      const n = 10 + index * 2 + offset, session = await rpc(workers[0], 'start', { n, stage: MARKER });
      assert.equal(session.cap, 12); assert.equal(await countAttempts(session.id), 0);
      await workers[0].query('begin');
      try {
        await workers[0].query('select pg_advisory_xact_lock(hashtextextended($1,4104))', [user]);
        // Attach both outcomes immediately so an unexpected early failure can
        // be reported without leaving an unhandled rejection during polling.
        const queued = rpc(workers[1], 'reserve', { n, session: session.id, stage }).then(value => ({ value }), error => ({ error }));
        let waiting = false;
        for (let attempt = 0; attempt < 500; attempt++) {
          const state = await admin.query("select count(*)::int n from pg_stat_activity where pid=$1 and wait_event_type='Lock' and wait_event='advisory'", [pids[1]]);
          if (state.rows[0].n === 1) { waiting = true; break; }
          await new Promise(resolveWait => setTimeout(resolveWait, 10));
        }
        assert.equal(waiting, true, 'the exact reserve call reached the advisory lock before revocation');
        await admin.query({ region: "update media_advice_private.user_regions set region_code='GB'", switch: 'update media_advice_private.beta_config set enabled=false',
          membership: "update public.group_members set role='visitor'", card: "update public.movies set imdb_id='tt9999999'" }[mode]);
        await workers[0].query('commit');
        const outcome = await queued; assert.ok(outcome.error, 'revoked queued reservation must reject');
        assert.match(outcome.error.message, mode === 'card' ? /card-context-denied/ : /access-denied/);
      } catch (error) { await workers[0].query('rollback'); throw error; }
      assert.equal(await countAttempts(session.id), 0);
      assert.deepEqual((await persisted(session.id)).attempts, []);
    });
  }
});
