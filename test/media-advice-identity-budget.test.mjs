import test from 'node:test';
import assert from 'node:assert/strict';
import { betaDb, user, group, list, form } from './media-advice-beta-db.fixture.mjs';
import { identityBudgetDb, identityBudgetSql, stages } from './media-advice-identity-budget.fixture.mjs';

test('identity budget migration preserves existing/legacy cap8 and advertises cap10 only on new Beta sessions', async t => {
  const { db, rpc } = await betaDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const old = await rpc('start'); assert.equal(old.cap, 8);
  const before = (await db.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body")).rows[0].body;
  await db.exec(await identityBudgetSql());
  assert.equal((await db.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body")).rows[0].body, before);
  assert.equal((await rpc('reserve', { session: old.id, stage: 'tmdb-find' })).cap, 8);
  for (const stage of stages.slice(8)) await assert.rejects(rpc('reserve', { session: old.id, stage }), /unsupported-stage/);
  for (const stage of stages.slice(1, 8)) await rpc('reserve', { session: old.id, stage });
  assert.equal((await rpc('finish', { session: old.id })).attempts.length, 8);
  const next = await rpc('start', { n: 2 }); assert.equal(next.cap, 10);
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)', [user, 'mykola_media_advice']);
  const legacy = (await db.query('select public.media_advice_action($1,$2,$3,$4,$5,$6) r', [user, group, 'tt1234567', list, form(3), 'start'])).rows[0].r;
  assert.equal(legacy.cap, 8);
  assert.deepEqual((await db.query('select source_cap from media_advice_private.sessions order by form_session')).rows.map(r => r.source_cap), [8, 10, 8]);
});

test('Beta ten-stage budget preserves both searches/cards and spends profiles atomically without user search quotas', async t => {
  const { db, rpc } = await identityBudgetDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const session = await rpc('start');
  for (const stage of stages) {
    const receipt = await rpc('reserve', { session: session.id, stage });
    assert.equal(receipt.cap, 10); assert.equal(receipt.attempts.at(-1), stage);
    await assert.rejects(rpc('reserve', { session: session.id, stage }), /attempt-already-spent-or-budget/);
  }
  await assert.rejects(rpc('reserve', { session: session.id, stage: 'tmdb-person-2' }), /unsupported-stage/);
  assert.equal((await rpc('finish', { session: session.id })).attempts.length, 10);
  await assert.rejects(rpc('reserve', { session: session.id, stage: 'tmdb-person' }), /session-unavailable/);
  for (let n = 2; n <= 26; n++) await rpc('start', { n });
  assert.equal((await db.query('select count(*)::int n from media_advice_private.sessions')).rows[0].n, 26);
  await assert.rejects(rpc('start'), /form-attempt-already-used/);
  await assert.rejects(db.exec('update media_advice_private.sessions set source_cap=11'), /check constraint/);
  await assert.rejects(db.query('update media_advice_private.sessions set source_cap=8 where id=$1', [session.id]), /check constraint/);
});

test('identity budget leaves access, private privileges, TTL, diagnostic assignments and cleanup unchanged', async t => {
  const { db, rpc } = await identityBudgetDb(); t.after(() => db.close());
  assert.equal((await db.query('select enabled from media_advice_private.beta_config')).rows[0].enabled, false);
  assert.equal((await db.query('select count(*)::int n from media_advice_private.permissions')).rows[0].n, 0);
  await assert.rejects(rpc('start'), /access-denied/);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const session = await rpc('start');
  assert.equal(session.mykola_media_advice_diagnostics, false);
  assert.equal((await db.query("select expires_at-created_at=interval '30 minutes' ok from media_advice_private.sessions")).rows[0].ok, true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(rpc('start'), /permission denied/);
    await assert.rejects(db.exec('select source_cap from media_advice_private.sessions'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec("update public.group_members set role='visitor'");
  await assert.rejects(rpc('reserve', { session: session.id, stage: 'tmdb-person' }), /access-denied/);
  assert.equal((await db.query('select cardinality(attempts) n from media_advice_private.sessions')).rows[0].n, 0);
  await db.exec("update media_advice_private.sessions set created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour'");
  assert.equal((await db.query('select public.media_advice_cleanup() n')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from public.movies')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from public.movie_group_lists')).rows[0].n, 1);
});
