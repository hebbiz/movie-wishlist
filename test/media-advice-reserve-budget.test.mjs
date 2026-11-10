// Authored local database only. No shared project, credentials or real users.
import test from 'node:test';
import assert from 'node:assert/strict';
import { betaDb, user, group, list, form } from './media-advice-beta-db.fixture.mjs';
import { reserveBudgetDb, reserveBudgetSql, reserveStages, identityBudgetSql, reserveStartContract } from './media-advice-reserve-budget.fixture.mjs';
const pilotDef = db => db.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body").then(r=>r.rows[0].body);
const sessions = db => db.query('select * from media_advice_private.sessions order by form_session').then(r=>r.rows);

test('migration preserves active cap8/cap10 rows and pilot function; only negotiated new Beta sessions get12',async t=>{
  const {db,rpc}=await betaDb();t.after(()=>db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const old8=await rpc('start');await rpc('reserve',{session:old8.id,stage:'tmdb-find'});
  await db.exec(await identityBudgetSql());
  const old10=await rpc('start',{n:2});await rpc('reserve',{n:2,session:old10.id,stage:'tmdb-person'});
  const newCodeOldDB=await rpc('start',{n:5,stage:reserveStartContract});assert.equal(newCodeOldDB.cap,10);
  const before=await sessions(db),pilot=await pilotDef(db);
  await db.exec(await reserveBudgetSql());
  assert.deepEqual(await sessions(db),before);assert.equal(await pilotDef(db),pilot);
  for(const stage of ['search-3','kinobaza-3'])for(const [n,s]of [[1,old8],[2,old10]])await assert.rejects(rpc('reserve',{n,session:s.id,stage}),/unsupported-stage/);
  assert.equal((await rpc('reserve',{n:2,session:old10.id,stage:'kinobaza-person'})).cap,10);
  assert.equal((await rpc('finish',{n:2,session:old10.id})).cap,10);
  const next=await rpc('start',{n:3,stage:reserveStartContract});assert.equal(next.cap,12);
  const olderHandler=await rpc('start',{n:6});assert.equal(olderHandler.cap,10);
  const beforeInvalid=await sessions(db);
  for(const stage of ['12','', 'search-3'])await assert.rejects(rpc('start',{n:7,stage}),/unsupported-start-contract/);
  assert.deepEqual(await sessions(db),beforeInvalid);
  await assert.rejects(rpc('reserve',{n:6,session:olderHandler.id,stage:'search-3'}),/unsupported-stage/);
  await db.query('insert into media_advice_private.permissions values($1,$2,true,null)',[user,'mykola_media_advice']);
  const legacy=(await db.query('select public.media_advice_action($1,$2,$3,$4,$5,$6) r',[user,group,'tt1234567',list,form(4),'start'])).rows[0].r;
  assert.equal(legacy.cap,8);assert.deepEqual((await sessions(db)).map(r=>r.source_cap),[8,10,12,8,10,10]);
});

test('twelve unique reservations, valid reserve slot gaps and one global profile pair remain bounded',async t=>{
  const {db,rpc}=await reserveBudgetDb();t.after(()=>db.close());await db.exec('update media_advice_private.beta_config set enabled=true');
  const s=await rpc('start');assert.equal(s.cap,12);
  for(const stage of reserveStages){const r=await rpc('reserve',{session:s.id,stage});assert.equal(r.cap,12);await assert.rejects(rpc('reserve',{session:s.id,stage}),/attempt-already-spent-or-budget/);}
  for(const stage of ['search-4','kinobaza-4','tmdb-person-2','kinobaza-person-2',reserveStartContract])await assert.rejects(rpc('reserve',{session:s.id,stage}),/unsupported-stage/);
  assert.equal((await rpc('finish',{session:s.id})).attempts.length,12);
  await assert.rejects(rpc('reserve',{session:s.id,stage:'search-3'}),/session-unavailable/);
  const gap=await rpc('start',{n:2});assert.deepEqual((await rpc('reserve',{n:2,session:gap.id,stage:'kinobaza-3'})).attempts,['kinobaza-3']);
  await assert.rejects(db.exec('update media_advice_private.sessions set source_cap=11'),/check constraint/);
  await assert.rejects(db.query('update media_advice_private.sessions set source_cap=10 where id=$1',[s.id]),/check constraint/);
  for(let n=3;n<=27;n++)await rpc('start',{n});
  assert.equal((await db.query('select count(*)::int n from media_advice_private.sessions')).rows[0].n,27);
  await assert.rejects(rpc('start'),/form-attempt-already-used/);
});

test('cap12 preserves RPC/private ACL, disabled switch, diagnostics assignment and context revocation',async t=>{
  const {db,rpc}=await reserveBudgetDb();t.after(()=>db.close());
  assert.equal((await db.query('select enabled from media_advice_private.beta_config')).rows[0].enabled,false);
  assert.equal((await db.query('select count(*)::int n from media_advice_private.permissions')).rows[0].n,0);
  await assert.rejects(rpc('start'),/access-denied/);
  await db.exec('update media_advice_private.beta_config set enabled=true');const s=await rpc('start');assert.equal(s.mykola_media_advice_diagnostics,false);
  assert.equal((await db.query("select expires_at-created_at=interval '30 minutes' ok from media_advice_private.sessions")).rows[0].ok,true);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(rpc('start'),/permission denied/);await assert.rejects(db.exec('select * from media_advice_private.sessions'),/permission denied/);await db.exec('reset role');}
  const definition=(await db.query("select proconfig from pg_proc where oid='public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure")).rows[0];
  assert.ok(definition.proconfig.some(setting=>setting==='search_path=""'));
  await db.exec("update public.group_members set role='visitor'");await assert.rejects(rpc('reserve',{session:s.id,stage:'search-3'}),/access-denied/);await assert.rejects(rpc('finish',{session:s.id}),/access-denied/);
  assert.equal((await sessions(db))[0].attempts.length,0);
  assert.equal((await db.query('select count(*)::int n from public.movies')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.movie_group_lists')).rows[0].n,1);
});
