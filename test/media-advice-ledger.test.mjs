import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const user = '00000000-0000-4000-8000-000000000001', group = '00000000-0000-4000-8000-000000000002', list = '00000000-0000-4000-8000-000000000003';
const form = i => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export async function ledgerDb() {
  const db = new PGlite();
  // Minimal authored prerequisite schema, NOT a replay or assertion that old
  // production migrations have been applied. No historic data/seeds/extensions.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.groups(id uuid primary key);
    create table public.group_members(user_id uuid, group_id uuid, role text);
    create table public.movies(id uuid primary key, imdb_id text);
    create table public.movie_group_lists(id uuid primary key, movie_id uuid, group_id uuid);
    insert into auth.users values('${user}'); insert into public.groups values('${group}');
    insert into public.group_members values('${user}','${group}','member');
    insert into public.movies values('${list}','tt1234567'); insert into public.movie_group_lists values('${list}','${list}','${group}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261020205122_media_advice_access_ledger.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261021072002_media_advice_review_fixes.sql', import.meta.url), 'utf8'));
  const rpc = async (op, { session = null, stage = null, n = 1, targetList = list, targetGroup = group, imdb = 'tt1234567' } = {}) =>
    (await db.query('select public.media_advice_action($1,$2,$3,$4,$5,$6,$7,$8) as result', [user, targetGroup, imdb, targetList, form(n), op, session, stage])).rows[0].result;
  return { db, rpc };
}
test('isolated PostgreSQL migration: default off, backend only, fresh group/card access, revocation', async t => {
  const { db, rpc } = await ledgerDb(); t.after(() => db.close());
  await assert.rejects(rpc('capability'), /access-denied/);
  await db.exec(`insert into media_advice_private.permissions values('${user}','mykola_media_advice',true,null)`);
  assert.equal((await rpc('capability')).mykola_media_advice, true);
  await assert.rejects(rpc('capability', { targetGroup: user }), /access-denied/);
  await assert.rejects(rpc('capability', { imdb: 'tt9999999' }), /card-context-denied/);
  assert.equal((await rpc('capability', { targetList: null })).mykola_media_advice, true); // add has no list row
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from media_advice_private.permissions'), /permission denied/);
  await assert.rejects(rpc('capability'), /permission denied/); // No direct RPC self grant/impersonation
  await db.exec('reset role');
  await db.exec("update public.group_members set role='visitor'");
  await assert.rejects(rpc('start'), /access-denied/);
  await db.exec("update public.group_members set role='member'");
  const s = await rpc('start');
  await db.exec('update media_advice_private.permissions set enabled=false');
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'tmdb-find' }), /access-denied/);
});
test('atomic replay/rate/TTL cap and reservations survive error/lost result, no body persistence', async t => {
  const { db, rpc } = await ledgerDb(); t.after(() => db.close());
  await db.exec(`insert into media_advice_private.permissions values('${user}','mykola_media_advice',true,null)`);
  const starts = await Promise.allSettled([rpc('start'), rpc('start')]);
  assert.equal(starts.filter(r => r.status === 'fulfilled').length, 1);
  const s = starts.find(r => r.status === 'fulfilled').value;
  const reservations = await Promise.allSettled([rpc('reserve', { session: s.id, stage: 'tmdb-find' }), rpc('reserve', { session: s.id, stage: 'tmdb-find' })]);
  assert.equal(reservations.filter(r => r.status === 'fulfilled').length, 1);
  for (const stage of ['tmdb-details','tmdb-providers','motn-title','search-1','search-2','kinobaza-1','kinobaza-2']) await rpc('reserve', { session: s.id, stage });
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'other' }), /unsupported-stage/);
  assert.equal((await rpc('finish', { session: s.id })).attempts.length, 8);
  await assert.rejects(rpc('reserve', { session: s.id, stage: 'tmdb-find' }), /session-unavailable/);
  for (let n = 2; n <= 20; n++) await rpc('start', { n });
  await assert.rejects(rpc('start', { n: 21 }), /daily-session-cap/);
  await db.exec('delete from public.movie_group_lists');
  await assert.rejects(rpc('start', { n: 21, targetList: null }), /daily-session-cap/); // deleting a list must not erase rate accounting
  await db.exec("update media_advice_private.sessions set expires_at=now()-interval '1 second'");
  await assert.rejects(rpc('start', { n: 21, targetList: null }), /daily-session-cap/); // expiry doesn't reset rolling rate
  const cols = (await db.query("select column_name from information_schema.columns where table_schema='media_advice_private' and table_name='sessions'")).rows.map(r => r.column_name);
  assert.ok(!cols.some(c => /body|response|html|chat|secret|token/.test(c)));
  await db.exec("update media_advice_private.sessions set created_at=now()-interval '25 hours'");
  await db.query('select public.media_advice_cleanup()');
  assert.equal((await db.query('select count(*)::int n from media_advice_private.sessions')).rows[0].n, 0);
  assert.equal((await db.query('select deleted_sessions::int n from media_advice_private.cleanup_health')).rows[0].n, 20);
});

test('retention is based on creation, keeps younger/active rows, has content-free success heartbeat', async t => {
  const { db, rpc } = await ledgerDb(); t.after(() => db.close());
  await db.exec(`insert into media_advice_private.permissions values('${user}','mykola_media_advice',true,null)`);
  for (let n = 1; n <= 4; n++) await rpc('start', { n });
  await db.exec(`update media_advice_private.sessions set created_at=now()-interval '25 hours', expires_at=now()-interval '1 hour' where form_session='${form(1)}';
    update media_advice_private.sessions set created_at=now()-interval '23 hours', expires_at=now()-interval '1 hour', finished=true where form_session='${form(2)}';
    update media_advice_private.sessions set created_at=now()-interval '25 hours', expires_at=now()+interval '1 minute' where form_session='${form(3)}';`);
  assert.equal((await db.query('select public.media_advice_cleanup() n')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from media_advice_private.sessions')).rows[0].n, 3);
  assert.equal((await db.query('select count(*)::int n from public.movie_group_lists')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from public.movies')).rows[0].n, 1);
  assert.equal((await db.query('select public.media_advice_cleanup() n')).rows[0].n, 0);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.media_advice_cleanup()'), /permission denied/);
  await assert.rejects(db.query('select * from media_advice_private.cleanup_health'), /permission denied/);
});

test('prepared cleanup schedule is inactive/UTC/no-overwrite; authored cron stub is not scheduler validation', async t => {
  const { db } = await ledgerDb(); t.after(() => db.close());
  // Only verifies configuration transaction/control flow, not real pg_cron.
  await db.exec(`create schema cron;
    create table cron.job(jobid bigint generated always as identity, jobname text, schedule text, command text, active boolean default true);
    create function cron.schedule(n text,s text,c text) returns bigint language sql as $$
      insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid $$;
    create function cron.alter_job(job_id bigint, active boolean) returns void language sql as $$
      update cron.job set active=$2 where jobid=$1 $$;`);
  const config = await readFile(new URL('../supabase/operations/media-advice-cleanup.schedule.sql', import.meta.url), 'utf8');
  await db.exec("set cron.timezone='Europe/Kyiv'");
  await assert.rejects(db.exec(config), /verify-cron-timezone/); await db.exec('rollback');
  await db.exec("set cron.timezone='UTC'"); await db.exec(config);
  const job = (await db.query('select * from cron.job')).rows[0];
  assert.equal(job.active, false); assert.equal(job.schedule, '15 2 * * *'); assert.equal(job.command, 'select public.media_advice_cleanup();');
  await assert.rejects(db.exec(config), /review-existing-cleanup-job/); await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from cron.job')).rows[0].n, 1);
});
