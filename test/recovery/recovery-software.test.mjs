// Authored public-software fixtures only: no QEMU, PG cluster, archive or keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PREPARE_TIMEOUT_MS,assertGuestCommandPassed,assertVmExitPassed,vmResultRecord,assertEmptyPrivilegeEvidence,refuseRepeatedPrepare,createPublicSoftwareShare} from '../../supabase/operations/recovery-vm.mjs';

async function fixture(action){
 const root=path.join(tmpdir(),'mw-recovery-software-'+randomUUID());await mkdir(root);
 try{return await action(root);}finally{
  assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));
  assert.match(path.basename(root),/^mw-recovery-software-[a-f0-9-]{36}$/);
  await rm(root,{recursive:true,force:true});
 }
}
const scripts=new URL('../../supabase/operations/',import.meta.url);
const bash=[process.env.BASH,'C:/Program Files/Git/bin/bash.exe','/bin/bash'].find(p=>p&&existsSync(p));

test('public preparation has a finite larger unpack budget without accepting a partial result',()=>{
 assert.ok(Number.isSafeInteger(PREPARE_TIMEOUT_MS));
 assert.ok(PREPARE_TIMEOUT_MS>20*60*1000&&PREPARE_TIMEOUT_MS<=60*60*1000);
 assertGuestCommandPassed('MW_UNPACK_OK\r\nMW_COMMAND_1_0\r\n','MW_COMMAND_1_','MW_UNPACK_OK');
 for(const output of ['MW_COMMAND_1_0\n','MW_UNPACK_OK\nMW_COMMAND_1_1\n','MW_UNPACK_OK\nMW_COMMAND_2_0\n','MW_UNPACK_OK\nMW_COMMAND_1_0\nMW_COMMAND_1_1\n']){
  assert.throws(()=>assertGuestCommandPassed(output,'MW_COMMAND_1_','MW_UNPACK_OK'));
 }
});

test('a guest success marker does not conceal a nonzero or missing QEMU exit',()=>{
 assertVmExitPassed(0);
 for(const code of [1,-1,null,undefined,'0'])assert.throws(()=>assertVmExitPassed(code));
});

test('VM result records retain failed host and guest observations independently',()=>{
 for(const [code,commands]of [[0,true],[0,false],[1,true],[1,false],[null,false],[-4058,false]]){
  const result=vmResultRecord('restore','attempt-restore-123','vm-invocation-restore-123.json',code,commands);
  assert.equal(result.qemuExitCode,code);assert.equal(result.guestCommandsPassed,commands);
  assert.equal(result.mode,'restore');assert.equal(result.share,'attempt-restore-123');assert.equal(result.invocation,'vm-invocation-restore-123.json');
  assert.equal(Number.isNaN(Date.parse(result.closedAt)),false);assert.equal('verified' in result,false);
 }
 assert.throws(()=>vmResultRecord('restore','../escape','vm-invocation-restore-123.json',0,true));
 assert.throws(()=>vmResultRecord('restore','attempt-restore-123','vm-invocation-prepare-123.json',0,true));
 assert.throws(()=>vmResultRecord('restore','attempt-restore-123','vm-invocation-restore-123.json','0',true));
 assert.throws(()=>vmResultRecord('restore','attempt-restore-123','vm-invocation-restore-123.json',0,'true'));
});

test('the empty-cluster catalog query must return actual read-only target JSON',()=>{
 const result={kind:'isolated-target-privilege-observations',readOnly:true,serverVersion:'170006',sourceFunctionColumnInitialAclCaptured:false};
 assertEmptyPrivilegeEvidence(result);
 for(const value of [null,{}, {...result,readOnly:false},{...result,kind:'source-proof'},{...result,sourceFunctionColumnInitialAclCaptured:true},{...result,serverVersion:'160000'}])assert.throws(()=>assertEmptyPrivilegeEvidence(value));
});

test('a prior prepare invocation refuses another format attempt without modifying evidence',()=>fixture(async root=>{
 await refuseRepeatedPrepare(root);
 await writeFile(path.join(root,'vm-invocation-inspect-1.json'),'authored inspection');
 await refuseRepeatedPrepare(root);
 const evidence=path.join(root,'vm-invocation-prepare-1.json');await writeFile(evidence,'authored failed preparation');
 await assert.rejects(refuseRepeatedPrepare(root),/never automatically reformat/);
 assert.equal(await readFile(evidence,'utf8'),'authored failed preparation');
 assert.equal((await readdir(root)).length,2);
}));

test('public invocations get distinct empty output shares and retain old output bytes',()=>fixture(async root=>{
 const a=await createPublicSoftwareShare(root,'prepare');await writeFile(path.join(a.share,'unpack.log'),'earlier result');
 const b=await createPublicSoftwareShare(root,'inspect');
 assert.notEqual(a.share,b.share);assert.equal(path.dirname(a.share),root);assert.equal(path.dirname(b.share),root);
 assert.equal(await readFile(path.join(a.share,'unpack.log'),'utf8'),'earlier result');assert.deepEqual(await readdir(b.share),[]);
 const before=await readdir(root);await assert.rejects(createPublicSoftwareShare(root,'restore'),/invalid public/);assert.deepEqual(await readdir(root),before);
}));

test('the extension build share copies only its two public inputs and the reviewed script',()=>fixture(async root=>{
 await mkdir(path.join(root,'share'));
 for(const name of ['pg_net.tar.gz','curl-source.tar.xz'])await writeFile(path.join(root,'share',name),'AUTHORED public source '+name);
 await writeFile(path.join(root,'share','earlier-build.log'),'retain old output');
 const output=await createPublicSoftwareShare(root,'build-pgnet');
 assert.deepEqual((await readdir(output.share)).sort(),['build-pgnet.sh','curl-source.tar.xz','pg_net.tar.gz']);
 assert.equal(await readFile(path.join(output.share,'pg_net.tar.gz'),'utf8'),'AUTHORED public source pg_net.tar.gz');
 assert.equal(await readFile(path.join(output.share,'build-pgnet.sh'),'utf8'),(await readFile(new URL('recovery-build-pgnet.sh',scripts),'utf8')).replaceAll('\r\n','\n'));
 assert.equal(await readFile(path.join(root,'share','earlier-build.log'),'utf8'),'retain old output');
}));

test('the empty-cluster smoke rejects absent/incomplete unpack and substituted pinned inputs',()=>fixture(async root=>{
 await assert.rejects(createPublicSoftwareShare(root,'software-smoke'),/ENOENT/);
 await writeFile(path.join(root,'software-prepared.json'),JSON.stringify({complete:false,qemuExitCode:0}));
 await assert.rejects(createPublicSoftwareShare(root,'software-smoke'),/complete software unpack/);
 await writeFile(path.join(root,'software-prepared.json'),JSON.stringify({complete:true,qemuExitCode:1}));
 await assert.rejects(createPublicSoftwareShare(root,'software-smoke'),/complete software unpack/);
 await writeFile(path.join(root,'software-prepared.json'),JSON.stringify({complete:true,qemuExitCode:0}));
 await mkdir(path.join(root,'assets/locale-software/usr/lib/locale'),{recursive:true});
 await writeFile(path.join(root,'assets/locale-software/usr/lib/locale/locale-archive'),'AUTHORED incorrect public payload');
 await assert.rejects(createPublicSoftwareShare(root,'software-smoke'),/integrity refused/);
 assert.equal(existsSync(path.join(root,'software-smoke-verified.json')),false);
}));

test('reviewed public guest scripts parse without executing their commands',t=>{
 if(!bash){t.skip('Bash unavailable; empty-VM execution is a separate check');return;}
 for(const name of ['recovery-build-pgnet.sh','recovery-software-smoke.sh']){
  const child=spawnSync(bash,['--noprofile','--norc','-n',fileURLToPath(new URL(name,scripts)).replaceAll('\\','/')],{encoding:'utf8',timeout:10000,windowsHide:true});
  assert.equal(child.status,0,child.error?.message||child.stderr);
 }
});

test('the actual native-alias function preserves builds and refuses missing or unresolved modules',async t=>{
 if(!bash){t.skip('Bash unavailable; no native-module claim is made');return;}
 const source=await readFile(new URL('recovery-build-pgnet.sh',scripts),'utf8');
 const fn=source.match(/^ensure_real_module\(\) \{[\s\S]*?^\}/m)?.[0];assert.ok(fn);
 async function run(root,module,ldd='printf "fixture dependency resolved\\n"'){
  const body='set -eu\nroot=$(cygpath -u "$1" 2>/dev/null || printf "%s" "$1")\nlibdir="$root/lib"\nnative_root="$root/native"\nmodule_evidence_root="$root/evidence"\nldd(){ '+ldd+'; }\n'+fn+'\nensure_real_module "$2"\n';
  return spawnSync(bash,['--noprofile','--norc','-c',body,'authored-native-fixture',root.replaceAll('\\','/'),module],{encoding:'utf8',timeout:10000,windowsHide:true});
 }
 async function nativeFixture(action){return fixture(async root=>{for(const p of ['lib','native','evidence'])await mkdir(path.join(root,p));await action(root);});}
 await t.test('preserves the newly built pg_net rather than the image fallback',()=>nativeFixture(async root=>{
  await writeFile(path.join(root,'lib/pg_net.so'),'AUTHORED newly built');await writeFile(path.join(root,'native/pg_net.so'),'AUTHORED stock');
  const result=await run(root,'pg_net');assert.equal(result.status,0,result.error?.message||result.stderr);assert.equal(await readFile(path.join(root,'lib/pg_net.so'),'utf8'),'AUTHORED newly built');
 }));
 await t.test('refuses a missing pg_net build even when a stock fallback exists',()=>nativeFixture(async root=>{
  await writeFile(path.join(root,'native/pg_net.so'),'AUTHORED stock');assert.notEqual((await run(root,'pg_net')).status,0);assert.equal(existsSync(path.join(root,'lib/pg_net.so')),false);
 }));
 await t.test('refuses unknown names and missing pinned aliases',()=>nativeFixture(async root=>{
  for(const name of ['../escape','unreviewed','pg_cron'])assert.notEqual((await run(root,name)).status,0);
  assert.deepEqual(await readdir(path.join(root,'lib')),[]);
 }));
 await t.test('refuses an ldd error or a dependency marked not found',()=>nativeFixture(async root=>{
  await writeFile(path.join(root,'lib/pg_cron.so'),'AUTHORED module');
  for(const ldd of ['return 1','printf "libfixture.so => not found\\n"'])assert.notEqual((await run(root,'pg_cron',ldd)).status,0);
 }));
 await t.test('uses a present pinned native alias when the plugin alias is absent',()=>nativeFixture(async root=>{
  await writeFile(path.join(root,'native/pg_cron.so'),'AUTHORED pinned module');
  const result=await run(root,'pg_cron');assert.equal(result.status,0,result.error?.message||result.stderr);assert.equal(await readFile(path.join(root,'lib/pg_cron.so'),'utf8'),'AUTHORED pinned module');
 }));
 await t.test('accepts a resolving pinned symlink, not only a regular-name find result',child=>nativeFixture(async root=>{
  await writeFile(path.join(root,'native/pg_cron-versioned.so'),'AUTHORED versioned module');
  try{await symlink(path.join(root,'native/pg_cron-versioned.so'),path.join(root,'native/pg_cron.so'));}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){child.skip('Host cannot create file symlinks; real Linux empty-VM check remains required');return;}throw error;}
  const result=await run(root,'pg_cron');assert.equal(result.status,0,result.error?.message||result.stderr);assert.equal(await readFile(path.join(root,'lib/pg_cron.so'),'utf8'),'AUTHORED versioned module');
 }));
});
