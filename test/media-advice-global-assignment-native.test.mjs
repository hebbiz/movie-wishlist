// Explicit opt-in, already installed native PostgreSQL17, authored loopback
// database only. No shared Supabase, application keys or source HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { fixtureSql, migrationSql } from './media-advice-beta-db.fixture.mjs';
import { identityBudgetSql, reserveBudgetSql, predictedBudgetSql } from './media-advice-predicted-budget.fixture.mjs';
import { globalAccessSql } from './media-advice-global-access.fixture.mjs';

test('native PostgreSQL17 feature assignment serializes activation, signup and manual intent before row locks',
  { skip: !process.env.M4_NATIVE_PG_MODULE, timeout: 90000 }, async t => {
    const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.M4_NATIVE_PG_MODULE).href);
    const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    const directoryRoot = resolve(tmpdir()), prefix = 'mw-m4-global-assignment-pg17-';
    const databaseDir = await mkdtemp(join(directoryRoot, prefix));
    const engine = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'AUTHORED-LOCAL-ONLY', port,
      persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
    let admin; const workers = [];
    t.after(async () => {
      await Promise.all(workers.map(client => client.end().catch(() => {}))); await admin?.end().catch(() => {});
      await engine.stop().catch(() => {});
      const target = resolve(databaseDir); assert.equal(dirname(target), directoryRoot); assert.ok(basename(target).startsWith(prefix));
      await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    });
    await engine.initialise(); await engine.start(); admin = engine.getPgClient(); await admin.connect();
    const version = (await admin.query('show server_version')).rows[0].server_version; assert.match(version, /^17\./);
    assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
    await admin.query(fixtureSql); for (const sql of await migrationSql()) await admin.query(sql);
    await admin.query(await identityBudgetSql()); await admin.query(await reserveBudgetSql()); await admin.query(await predictedBudgetSql());
    await admin.query(await globalAccessSql());
    for (let i = 0; i < 2; i++) {
      const client = engine.getPgClient(); await client.connect();
      await client.query("set statement_timeout='8s'; set lock_timeout='7s'"); workers.push(client);
    }
    const [a, b] = workers;
    const pids = await Promise.all(workers.map(client => client.query('select pg_backend_pid() pid').then(result => result.rows[0].pid)));
    assert.equal(new Set(pids).size, 2);
    t.diagnostic(`Native PostgreSQL ${version}; two independent workers plus catalog observer; authored local fixtures only`);
    async function advisoryWait(pid) {
      for (let i = 0; i < 400; i++) {
        const result = await admin.query("select count(*)::integer n from pg_stat_activity where pid=$1 and wait_event_type='Lock' and wait_event='advisory'", [pid]);
        if (result.rows[0].n === 1) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail('worker did not reach the shared advisory wait before row locks');
    }
    const flag = userId => admin.query(`select p.enabled, p.expires_at, a.enabled as managed
      from media_advice_private.permissions p left join media_advice_private.beta_feature_assignments a using(user_id)
      where p.user_id=$1 and p.feature_key='mykola_media_advice'`, [userId]).then(result => result.rows[0]);

    await t.test('activation first: queued new-user region sees the committed enabled switch', async () => {
      const userId = '00000000-0000-4000-8000-000000000081';
      await a.query('begin'); await a.query('update media_advice_private.beta_config set enabled=true');
      const pending = b.query('insert into auth.users(id) values($1)', [userId]).then(() => ({ ok: true }), error => ({ error }));
      await advisoryWait(pids[1]); await a.query('commit');
      const outcome = await pending; assert.equal(outcome.error, undefined);
      assert.deepEqual(await flag(userId), { enabled: true, expires_at: null, managed: true });
    });
    await t.test('signup first: queued activation sees the committed new backend region', async () => {
      const userId = '00000000-0000-4000-8000-000000000082';
      await admin.query('update media_advice_private.beta_config set enabled=false');
      await a.query('begin'); await a.query('insert into auth.users(id) values($1)', [userId]);
      const pending = b.query('update media_advice_private.beta_config set enabled=true').then(() => ({ ok: true }), error => ({ error }));
      await advisoryWait(pids[1]); await a.query('commit');
      const outcome = await pending; assert.equal(outcome.error, undefined);
      assert.deepEqual(await flag(userId), { enabled: true, expires_at: null, managed: true });
    });
    await t.test('manual no-op permission intent locks first and a queued region cannot invert its row locks', async () => {
      const userId = '00000000-0000-4000-8000-000000000081';
      await admin.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1", [userId]);
      assert.deepEqual(await flag(userId), { enabled: false, expires_at: null, managed: false });
      await a.query('begin');
      await a.query("update media_advice_private.permissions set enabled=false where user_id=$1 and feature_key='mykola_media_advice'", [userId]);
      const pending = b.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1", [userId]).then(() => ({ ok: true }), error => ({ error }));
      await advisoryWait(pids[1]);
      await a.query('update media_advice_private.beta_config set enabled=true');
      await a.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1", [userId]);
      await a.query('commit');
      const outcome = await pending; assert.equal(outcome.error, undefined);
      assert.deepEqual(await flag(userId), { enabled: false, expires_at: null, managed: null });
      await admin.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1", [userId]);
      assert.deepEqual(await flag(userId), { enabled: false, expires_at: null, managed: null });
    });
    for (const first of ['delete', 'activation']) await t.test(`${first} first: Auth delete and activation serialize before cascade row locks`, async () => {
      const userId = first === 'delete' ? '00000000-0000-4000-8000-000000000083' : '00000000-0000-4000-8000-000000000084';
      await admin.query('insert into auth.users(id) values($1)', [userId]);
      assert.equal((await flag(userId)).enabled, true);
      await a.query('begin');
      if (first === 'delete') await a.query('delete from auth.users where id=$1', [userId]);
      else await a.query('update media_advice_private.beta_config set enabled=true');
      const pending = (first === 'delete' ? b.query('update media_advice_private.beta_config set enabled=true')
        : b.query('delete from auth.users where id=$1', [userId])).then(() => ({ ok: true }), error => ({ error }));
      await advisoryWait(pids[1]); await a.query('commit');
      const outcome = await pending; assert.equal(outcome.error, undefined);
      const remaining = await admin.query(`select
        (select count(*) from auth.users where id=$1)::integer as auth,
        (select count(*) from media_advice_private.user_regions where user_id=$1)::integer as region,
        (select count(*) from media_advice_private.permissions where user_id=$1)::integer as flags,
        (select count(*) from media_advice_private.beta_feature_assignments where user_id=$1)::integer as assignment,
        (select count(*) from media_advice_private.pilot_access_users where user_id=$1)::integer as pilot`, [userId]);
      assert.deepEqual(remaining.rows[0], { auth: 0, region: 0, flags: 0, assignment: 0, pilot: 0 });
    });
  });
