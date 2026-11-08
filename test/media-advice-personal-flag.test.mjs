// Authored in-memory DB only; no shared project, real accounts or API calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { user, group, rpcArgs } from './media-advice-beta-db.fixture.mjs';
import { predictedBudgetDb } from './media-advice-predicted-budget.fixture.mjs';
import { globalAccessDb, globalAccessSql, globalArgs, globalRpcSql } from './media-advice-global-access.fixture.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const insertUser = (db, n, metadata = {}) => db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id(n),metadata]);
const featureRows = db => db.query("select * from media_advice_private.permissions where feature_key='mykola_media_advice' order by user_id").then(result => result.rows);
const diagnosticRows = db => db.query("select * from media_advice_private.permissions where feature_key='mykola_media_advice_diagnostics' order by user_id").then(result => result.rows);
const pilotUsers = db => db.query('select user_id from media_advice_private.pilot_access_users order by user_id').then(result => result.rows.map(row => row.user_id));
const managedUsers = db => db.query('select user_id,enabled from media_advice_private.beta_feature_assignments order by user_id').then(result => result.rows);
const globalFor = db => async (op, args) => (await db.query(globalRpcSql, globalArgs(op,args))).rows[0].result;
const pilot = async (db, args = {}) => (await db.query('select public.media_advice_action($1,$2,$3,$4,$5,$6,$7,$8) result', rpcArgs('capability',args))).rows[0].result;
const assign = async (db, target = null) => Number((await db.query('select media_advice_private.assign_beta_feature($1) n',[target])).rows[0].n);
const setPersonal = (db, target, enabled, expiry = null) => db.query(`insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at)
  values($1,'mykola_media_advice',$2,$3)`, [target,enabled,expiry]);

test('personal-flag backfill handles seven mixed existing users without overwriting decisions or opening the pilot', async t => {
  const { db } = await predictedBudgetDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  for (let n = 2; n <= 7; n++) {
    await insertUser(db,n);
    await db.query("insert into public.group_members values($1,$2,'member')",[id(n),group]);
  }
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(7)]);
  for (const [n,enabled,expiry] of [[1,true,'2099-01-01'],[2,true,null],[3,false,null],[4,true,'2001-01-01'],[5,false,'2099-01-01']]) {
    await setPersonal(db,id(n),enabled,expiry);
  }
  for (const [n,enabled,expiry] of [[1,true,'2099-02-01'],[3,true,null],[6,false,null]]) {
    await db.query('insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at) values($1,$2,$3,$4)',[id(n),'mykola_media_advice_diagnostics',enabled,expiry]);
  }
  const beforePersonal = await featureRows(db), beforeDiagnostics = await diagnosticRows(db);
  for (const n of [1,2]) assert.equal((await pilot(db,{targetUser:id(n)})).mykola_media_advice,true);
  for (const n of [3,4,5,6,7]) await assert.rejects(pilot(db,{targetUser:id(n)}),/access-denied/);
  await db.exec(await globalAccessSql());
  const globalRpc = globalFor(db), afterPersonal = await featureRows(db);
  for (const previous of beforePersonal) assert.deepEqual(afterPersonal.find(row => row.user_id === previous.user_id),previous);
  assert.deepEqual(await diagnosticRows(db),beforeDiagnostics,'no diagnostic assignment or expiry is inherited from the advice default');
  assert.equal(afterPersonal.length,6);
  assert.deepEqual(afterPersonal.find(row => row.user_id === id(6)),{user_id:id(6),feature_key:'mykola_media_advice',enabled:true,expires_at:null});
  assert.equal(afterPersonal.some(row => row.user_id === id(7)),false,'foreign users are not automatically assigned');
  assert.deepEqual(await pilotUsers(db),[1,2,3,4,5].map(id),'snapshot preserves old disabled/expired records, not just currently active ones');
  for (const n of [1,2,6]) assert.equal((await globalRpc('capability',{targetUser:id(n)})).mykola_media_advice,true);
  for (const n of [3,4,5,7]) await assert.rejects(globalRpc('capability',{targetUser:id(n)}),/access-denied/);
  assert.equal((await pilot(db)).mykola_media_advice,true,'the existing explicitly diagnostic-enabled pilot remains available');
  for (const n of [2,3,4,5,6,7]) await assert.rejects(pilot(db,{targetUser:id(n)}),/access-denied/,
    'the unredactable legacy route additionally requires diagnostic entitlement; ordinary advice remains separate');
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[user]);
  assert.equal((await pilot(db)).mykola_media_advice,true,'an existing explicit pilot remains independent of automatic region assignment');
  assert.equal((await globalRpc('capability')).mykola_media_advice,true,'an explicit existing personal true is an override, not subject to a runtime UA gate');
  await db.exec('update media_advice_private.beta_config set enabled=false');
  await assert.rejects(globalRpc('capability'),/access-denied/,'global Beta disables the modern route');
  await assert.rejects(pilot(db),/access-denied/,'global Beta also disables the historical pilot route');
  assert.deepEqual(await featureRows(db),afterPersonal,'Beta off and region changes do not rewrite explicit stored flags');
});

test('new-user default UA is established before personal assignment; editable metadata never grants diagnostics', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  await insertUser(db,8,{region_code:'GB',mykola_media_advice:false,mykola_media_advice_diagnostics:true});
  assert.equal((await db.query('select region_code from media_advice_private.user_regions where user_id=$1',[id(8)])).rows[0].region_code,'UA');
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),{user_id:id(8),feature_key:'mykola_media_advice',enabled:true,expires_at:null});
  assert.deepEqual(await db.query('select * from public.group_members where user_id=$1',[id(8)]).then(result => result.rows),[]);
  assert.deepEqual(await globalRpc('capability',{targetUser:id(8)}),{mykola_media_advice:true,mykola_media_advice_diagnostics:false});
  assert.equal((await diagnosticRows(db)).some(row => row.user_id === id(8)),false);
  assert.equal((await pilotUsers(db)).includes(id(8)),false);
  await db.query("insert into public.group_members values($1,$2,'owner')",[id(8),group]);
  await assert.rejects(pilot(db,{targetUser:id(8)}),/access-denied/,'a new auto-assigned owner is not a legacy pilot');
});

test('users created while Beta is off are assigned on later activation, without requiring a movie or login reconciliation', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await insertUser(db,8);
  assert.deepEqual(await featureRows(db),[]);
  assert.equal(await assign(db),0,'disabled Beta does not issue personal flags');
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const assigned = await featureRows(db);
  assert.deepEqual(assigned.map(row => row.user_id),[user,id(8)]);
  assert.equal((await globalRpc('capability',{targetUser:id(8)})).mykola_media_advice,true);
  assert.equal(await assign(db),0,'repeat reconciliation is idempotent');
  await db.exec('update media_advice_private.beta_config set enabled=true');
  assert.deepEqual(await featureRows(db),assigned,'repeating an enabled assignment has no row-level effect');
  assert.deepEqual(await pilotUsers(db),[],'activation never expands the pre-migration pilot snapshot');
});

test('region transitions synchronize only automatically managed flags; global Beta off does not erase them', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await insertUser(db,8);
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(8)]);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  assert.equal((await featureRows(db)).some(row => row.user_id === id(8)),false);
  assert.equal(await assign(db,id(8)),0);
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/);
  await db.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1",[id(8)]);
  const assigned = (await featureRows(db)).find(row => row.user_id === id(8));
  assert.deepEqual(assigned,{user_id:id(8),feature_key:'mykola_media_advice',enabled:true,expires_at:null});
  assert.equal((await globalRpc('capability',{targetUser:id(8)})).mykola_media_advice,true);
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(8)]);
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),{...assigned,enabled:false},'a foreign region disables its managed default rather than adding a hidden runtime region gate');
  await db.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1",[id(8)]);
  assert.equal(await assign(db,id(8)),0);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),assigned);
  await db.exec('update media_advice_private.beta_config set enabled=false');
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),assigned,'Beta-off is effective denial, not destructive flag synchronization');
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(8)]);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),{...assigned,enabled:false},'an already-managed default still follows region while Beta is off');
  await db.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1",[id(8)]);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),assigned);
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/,'the global switch remains authoritative even after managed flag restoration');
});

test('disabled and expired personal decisions survive bulk/targeted reconciliation; deletion explicitly restores default eligibility', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await insertUser(db,8); await insertUser(db,9); await insertUser(db,10);
  await setPersonal(db,id(8),false,'2099-01-01');
  await setPersonal(db,id(9),true,'2001-01-01');
  await setPersonal(db,id(10),true,'2099-02-01');
  const explicit = await featureRows(db);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  for (const previous of explicit) assert.deepEqual((await featureRows(db)).find(row => row.user_id === previous.user_id),previous);
  for (const n of [8,9]) {
    await assert.rejects(globalRpc('capability',{targetUser:id(n)}),/access-denied/);
    await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(n)]);
    await db.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1",[id(n)]);
    assert.equal(await assign(db,id(n)),0);
  }
  assert.equal((await globalRpc('capability',{targetUser:id(10)})).mykola_media_advice,true);
  assert.equal(await assign(db),0);
  await db.exec('update media_advice_private.beta_config set enabled=false; update media_advice_private.beta_config set enabled=true');
  for (const previous of explicit) assert.deepEqual((await featureRows(db)).find(row => row.user_id === previous.user_id),previous);
  await db.query("delete from media_advice_private.permissions where user_id=$1 and feature_key='mykola_media_advice'",[id(8)]);
  assert.equal(await assign(db,id(8)),1,'DELETE removes an explicit denial; a later eligible reconciliation may recreate the default');
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),{user_id:id(8),feature_key:'mykola_media_advice',enabled:true,expires_at:null});
  assert.equal(await assign(db,id(8)),0);
  assert.deepEqual(await pilotUsers(db),[],'neither manual post-migration flags nor automatic grants create old-pilot access');
});

test('personal false/expiry is fresh at global start/reserve/finish and strict apply, while diagnostics cannot override it', async t => {
  const { db, globalRpc, rpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  await db.query('insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at) values($1,$2,true,null)',[user,'mykola_media_advice_diagnostics']);
  const session = await globalRpc('start');
  const before = (await db.query('select * from media_advice_private.sessions where id=$1',[session.id])).rows[0];
  for (const [enabled,expiry] of [[false,null],[true,'2001-01-01']]) {
    await db.query("update media_advice_private.permissions set enabled=$2,expires_at=$3 where user_id=$1 and feature_key='mykola_media_advice'",[user,enabled,expiry]);
    for (const [op,args] of [['capability',{}],['start',{n:2}],['reserve',{session:session.id,stage:'tmdb-find'}],['finish',{session:session.id}]]) {
      await assert.rejects(globalRpc(op,args),/access-denied/);
    }
    await assert.rejects(rpc('capability'),/access-denied/,'strict editing capability cannot bypass a personal feature revocation');
    assert.deepEqual((await db.query('select * from media_advice_private.sessions where id=$1',[session.id])).rows[0],before);
    assert.equal((await diagnosticRows(db))[0].enabled,true,'a diagnostics grant remains independent but cannot grant ordinary access');
  }
  await db.query("update media_advice_private.permissions set enabled=true,expires_at='2099-01-01' where user_id=$1 and feature_key='mykola_media_advice'",[user]);
  assert.equal((await globalRpc('finish',{session:session.id})).mykola_media_advice_diagnostics,true);
  assert.equal((await rpc('capability')).mykola_media_advice,true);
});

test('automatic assignment and pilot expansion remain private, with separate diagnostics and two pilot authorization positions', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  const policy = (await db.query(`select relrowsecurity from pg_class where oid='media_advice_private.pilot_access_users'::regclass`)).rows[0];
  assert.equal(policy.relrowsecurity,true);
  const rolePrivileges = (await db.query(`select r,has_function_privilege(r,'media_advice_private.assign_beta_feature(uuid)','EXECUTE') assign,
    has_table_privilege(r,'media_advice_private.pilot_access_users','SELECT') read_pilot,
    has_table_privilege(r,'media_advice_private.pilot_access_users','INSERT,UPDATE,DELETE') write_pilot
    from unnest(array['anon','authenticated','service_role']) r order by r`)).rows;
  assert.deepEqual(rolePrivileges,[{r:'anon',assign:false,read_pilot:false,write_pilot:false},
    {r:'authenticated',assign:false,read_pilot:false,write_pilot:false},
    {r:'service_role',assign:false,read_pilot:true,write_pilot:false}]);
  for (const role of ['anon','authenticated','service_role']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select media_advice_private.assign_beta_feature($1)',[user]),/permission denied/);
    await assert.rejects(db.query('insert into media_advice_private.pilot_access_users values($1)',[user]),/permission denied/);
    await db.exec('reset role');
  }
  const body = (await db.query("select pg_get_functiondef('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure) body")).rows[0].body.toLowerCase();
  const lock = body.indexOf('pg_advisory_xact_lock');
  assert.ok(lock > 0);
  const guard = body.includes('assert_pilot_access') ? 'assert_pilot_access' : 'pilot_access_users';
  assert.ok(body.slice(0,lock).includes(guard));
  assert.ok(body.indexOf(guard,lock) > lock && body.indexOf(guard,lock) < body.indexOf('delete from media_advice_private.sessions',lock),
    'the old pilot scope is checked again after waiting and before any mutation');
  const ownershipACL = (await db.query(`select has_table_privilege('anon','media_advice_private.beta_feature_assignments','SELECT,INSERT,UPDATE,DELETE') a,
    has_table_privilege('authenticated','media_advice_private.beta_feature_assignments','SELECT,INSERT,UPDATE,DELETE') u,
    has_table_privilege('service_role','media_advice_private.beta_feature_assignments','INSERT,UPDATE,DELETE') s,
    (select relrowsecurity from pg_class where oid='media_advice_private.beta_feature_assignments'::regclass) rls`)).rows[0];
  assert.deepEqual(ownershipACL,{a:false,u:false,s:false,rls:true},'clients and service credentials cannot forge automatic ownership');
  assert.deepEqual(await globalRpc('capability'),{mykola_media_advice:true,mykola_media_advice_diagnostics:false});
  assert.deepEqual(await diagnosticRows(db),[]);
});

test('even no-op personal updates detach automatic ownership; explicit true/false/expiry survive later region changes', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  for (const n of [8,9,10]) await insertUser(db,n);
  assert.equal((await managedUsers(db)).some(row => row.user_id === user),true);
  await db.query("update media_advice_private.permissions set enabled=enabled,expires_at=expires_at where user_id=$1 and feature_key='mykola_media_advice'",[user]);
  assert.equal((await managedUsers(db)).some(row => row.user_id === user),false,'same-value manual writes express an explicit decision');
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[user]);
  assert.equal((await globalRpc('capability')).mykola_media_advice,true,'explicit personal true is respected outside automatic UA defaults');
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(8)]);
  assert.deepEqual((await managedUsers(db)).find(row => row.user_id === id(8)),{user_id:id(8),enabled:false});
  await db.query("update media_advice_private.permissions set enabled=enabled where user_id=$1 and feature_key='mykola_media_advice'",[id(8)]);
  assert.equal((await managedUsers(db)).some(row => row.user_id === id(8)),false);
  await db.query("update media_advice_private.user_regions set region_code='UA' where user_id=$1",[id(8)]);
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/,'explicit false remains false after returning to UA');
  await db.query("update media_advice_private.permissions set expires_at='2099-02-01' where user_id=$1 and feature_key='mykola_media_advice'",[id(9)]);
  const explicitExpiry = (await featureRows(db)).find(row => row.user_id === id(9));
  assert.equal((await managedUsers(db)).some(row => row.user_id === id(9)),false);
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(9)]);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(9)),explicitExpiry);
  assert.equal((await globalRpc('capability',{targetUser:id(9)})).mykola_media_advice,true);
  await db.query('insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at) values($1,$2,true,null)',[id(10),'mykola_media_advice_diagnostics']);
  await db.query("update media_advice_private.permissions set enabled=enabled where user_id=$1 and feature_key='mykola_media_advice_diagnostics'",[id(10)]);
  assert.equal((await managedUsers(db)).some(row => row.user_id === id(10)),true,'diagnostic updates do not detach ordinary feature ownership');
  await db.query("update media_advice_private.user_regions set region_code='GB' where user_id=$1",[id(10)]);
  assert.deepEqual((await managedUsers(db)).find(row => row.user_id === id(10)),{user_id:id(10),enabled:false});
  await assert.rejects(globalRpc('capability',{targetUser:id(10)}),/access-denied/);
  assert.equal(await assign(db),0);
});

test('deleting and restoring authoritative region disables/re-enables managed flags, but preserves explicit overrides and Auth cascades', async t => {
  const { db, globalRpc } = await globalAccessDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  await insertUser(db,8); await insertUser(db,9);
  await db.query("update media_advice_private.permissions set enabled=enabled where user_id=$1 and feature_key='mykola_media_advice'",[id(9)]);
  await db.query('delete from media_advice_private.user_regions where user_id=$1',[id(8)]);
  assert.deepEqual((await featureRows(db)).find(row => row.user_id === id(8)),{user_id:id(8),feature_key:'mykola_media_advice',enabled:false,expires_at:null});
  assert.deepEqual((await managedUsers(db)).find(row => row.user_id === id(8)),{user_id:id(8),enabled:false});
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/);
  await db.query("insert into media_advice_private.user_regions(user_id,region_code) values($1,'UA')",[id(8)]);
  assert.equal((await globalRpc('capability',{targetUser:id(8)})).mykola_media_advice,true);
  await db.query('delete from media_advice_private.user_regions where user_id=$1',[id(9)]);
  assert.equal((await globalRpc('capability',{targetUser:id(9)})).mykola_media_advice,true,'absence of region is not an extra runtime gate for an explicit personal override');
  await db.query('delete from auth.users where id=$1',[id(8)]);
  assert.equal((await featureRows(db)).some(row => row.user_id === id(8)),false);
  assert.equal((await managedUsers(db)).some(row => row.user_id === id(8)),false);
  assert.equal((await pilotUsers(db)).includes(id(8)),false);
  assert.equal((await db.query('select * from media_advice_private.user_regions where user_id=$1',[id(8)])).rows.length,0);
  await assert.rejects(globalRpc('capability',{targetUser:id(8)}),/access-denied/,'cascading cleanup cannot recreate permission or ownership for a deleted Auth user');
});

test('legacy raw diagnostics fail closed when their separate grant is revoked, while modern ordinary advice remains allowed', async t => {
  const { db } = await predictedBudgetDb(); t.after(() => db.close());
  await db.exec('update media_advice_private.beta_config set enabled=true');
  await setPersonal(db,user,true);
  await db.query('insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at) values($1,$2,true,null)',[user,'mykola_media_advice_diagnostics']);
  await db.exec(await globalAccessSql());
  const globalRpc = globalFor(db);
  assert.equal((await pilot(db)).mykola_media_advice,true);
  for (const [enabled,expiry] of [[false,null],[true,'2001-01-01']]) {
    await db.query("update media_advice_private.permissions set enabled=$2,expires_at=$3 where user_id=$1 and feature_key='mykola_media_advice_diagnostics'",[user,enabled,expiry]);
    await assert.rejects(pilot(db),/access-denied/,'old unredactable handlers cannot bypass a diagnostic revocation');
    assert.deepEqual(await globalRpc('capability'),{mykola_media_advice:true,mykola_media_advice_diagnostics:false});
  }
  await db.query("update media_advice_private.permissions set enabled=true,expires_at=null where user_id=$1 and feature_key='mykola_media_advice_diagnostics'",[user]);
  assert.equal((await pilot(db)).mykola_media_advice,true);
  await db.exec('update media_advice_private.beta_config set enabled=false');
  await assert.rejects(pilot(db),/access-denied/);
  await assert.rejects(globalRpc('capability'),/access-denied/);
  await db.exec('update media_advice_private.beta_config set enabled=true');
  assert.equal((await pilot(db)).mykola_media_advice,true);
});
