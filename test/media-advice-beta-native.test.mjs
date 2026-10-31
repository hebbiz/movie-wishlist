import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { fixtureSql, migrationSql, rpcSql, rpcArgs, user } from './media-advice-beta-db.fixture.mjs';

// Explicit opt-in PG17 engine, authored local data, loopback only. No app keys,
// remote connection strings, restored production data, or external source I/O.
test('native PostgreSQL 17 Beta atomic ledger and queued region/switch/group/card revocation',
  { skip: !process.env.M4_NATIVE_PG_MODULE }, async t => {
    const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.M4_NATIVE_PG_MODULE).href);
    const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
    const port = socket.address().port; await new Promise(r => socket.close(r));
    const databaseDir = await mkdtemp(join(tmpdir(), 'mw-m4-beta-pg17-'));
    const engine = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'AUTHORED-LOCAL-ONLY', port,
      persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
    let admin, workers = [];
    t.after(async () => {
      await Promise.all(workers.map(c => c.end().catch(() => {})));
      await admin?.end().catch(() => {}); await engine.stop();
      // The Windows engine emits parent exit before all child file handles
      // close. Clean only this mkdtemp-owned authored cluster with bounded
      // filesystem retries, not a relaxed DB assertion or source retry.
      await rm(databaseDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    });
    await engine.initialise(); await engine.start(); admin = engine.getPgClient(); await admin.connect();
    const version = (await admin.query('show server_version')).rows[0].server_version;
    assert.match(version, /^17\./);
    assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
    t.diagnostic(`Native PostgreSQL ${version}; 24 independent loopback connections; authored Beta schema only`);
    await admin.query(fixtureSql);
    for (const sql of await migrationSql()) await admin.query(sql);
    await admin.query('update media_advice_private.beta_config set enabled=true');
    workers = await Promise.all(Array.from({ length: 24 }, async () => {
      const c = engine.getPgClient(); await c.connect(); await c.query('set role service_role'); return c;
    }));
    assert.equal(new Set((await Promise.all(workers.map(c => c.query('select pg_backend_pid() pid')))).map(r => r.rows[0].pid)).size, 24);
    const rpc = (c, op, args) => c.query(rpcSql, rpcArgs(op, args)).then(r => r.rows[0].result);
    const parallel = async (tasks, expected) => {
      const results = await Promise.allSettled(tasks);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, expected); return results;
    };
    await t.test('24 distinct concurrent sessions are allowed; same form/stage remains one-shot and cap8', async () => {
      await parallel(workers.map((c, i) => rpc(c, 'start', { n: i + 100 })), 24);
      assert.equal(Number((await admin.query('select count(*) n from media_advice_private.sessions')).rows[0].n), 24);
      const starts = await parallel(workers.map(c => rpc(c, 'start')), 1);
      const session = starts.find(r => r.status === 'fulfilled').value.id;
      await parallel(workers.map(c => rpc(c, 'reserve', { session, stage: 'tmdb-find' })), 1);
      const stages = ['tmdb-details', 'tmdb-providers', 'motn-title', 'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2'];
      await parallel(stages.map((stage, i) => rpc(workers[i], 'reserve', { session, stage })), 7);
      assert.equal((await rpc(workers[0], 'finish', { session })).attempts.length, 8);
      await parallel(workers.slice(0, 4).map(c => rpc(c, 'reserve', { session, stage: 'tmdb-find' })), 0);
    });
    // Each case demonstrably reaches the advisory wait before revocation,
    // distinguishing post-lock reauthorization from only checking RPC entry.
    for (const mode of ['region', 'switch', 'membership', 'card']) await t.test(`queued ${mode} revocation denies reservation before ledger mutation`, async () => {
      await admin.query(`truncate media_advice_private.sessions;
        update media_advice_private.beta_config set enabled=true;
        update media_advice_private.user_regions set region_code='UA';
        update public.group_members set role='member'; update public.movies set imdb_id='tt1234567'`);
      const session = (await rpc(workers[0], 'start')).id;
      await workers[0].query('begin');
      await workers[0].query('select pg_advisory_xact_lock(hashtextextended($1,4104))', [user]);
      const queued = rpc(workers[1], 'reserve', { session, stage: 'tmdb-find' });
      const rejected = assert.rejects(queued, mode === 'card' ? /card-context-denied/ : /access-denied/);
      let waiting = false;
      for (let i = 0; i < 500; i++) {
        if (Number((await admin.query("select count(*) n from pg_stat_activity where wait_event='advisory'")).rows[0].n) > 0) { waiting = true; break; }
        await new Promise(r => setTimeout(r, 10));
      }
      assert.equal(waiting, true, 'reservation reached advisory lock before revocation');
      await admin.query({ region: "update media_advice_private.user_regions set region_code='GB'",
        switch: 'update media_advice_private.beta_config set enabled=false',
        membership: "update public.group_members set role='visitor'",
        card: "update public.movies set imdb_id='tt9999999'" }[mode]);
      await workers[0].query('commit'); await rejected;
      assert.equal((await admin.query('select cardinality(attempts) n from media_advice_private.sessions')).rows[0].n, 0);
    });
    await t.test('new Auth user gets UA; permission roles cannot self-grant; global switch denies finish', async () => {
      await admin.query(`update media_advice_private.beta_config set enabled=true;
        update media_advice_private.user_regions set region_code='UA';
        update public.group_members set role='member'; update public.movies set imdb_id='tt1234567';
        insert into auth.users(id, raw_user_meta_data) values('00000000-0000-4000-8000-000000000005', '{"region_code":"GB","mykola_media_advice_diagnostics":true}')`);
      assert.equal((await admin.query("select region_code from media_advice_private.user_regions where user_id='00000000-0000-4000-8000-000000000005'")).rows[0].region_code, 'UA');
      assert.equal((await rpc(workers[0], 'capability')).mykola_media_advice_diagnostics, false);
      await admin.query('set role authenticated');
      await assert.rejects(rpc(admin, 'capability'), /permission denied/);
      await assert.rejects(admin.query('update media_advice_private.beta_config set enabled=true'), /permission denied/);
      await admin.query('reset role');
      const session = (await rpc(workers[0], 'start', { n: 999 })).id;
      await admin.query('update media_advice_private.beta_config set enabled=false');
      await assert.rejects(rpc(workers[0], 'finish', { n: 999, session }), /access-denied/);
      assert.equal((await admin.query('select finished from media_advice_private.sessions where id=$1', [session])).rows[0].finished, false);
    });
  });
