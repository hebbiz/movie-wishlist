import test from 'node:test';
import assert from 'node:assert/strict';
import {copyBlocks,normalizeSchema,normalizeAcl,aclMismatchSummary,vmIsolationEvidence} from '../../supabase/operations/recovery-local.mjs';
import {graphqlAclSupplement} from '../../supabase/operations/recovery-schema-supplement.mjs';
import {schemaBlocks,blockMeaning,boundarySettings,catalogRows} from '../../supabase/operations/recovery-schema-compare.mjs';
import {nativeAclChecks} from '../../supabase/operations/recovery-acl-checks.mjs';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
test('authored COPY comparison is order independent and retains duplicate rows',()=>{
 const a='COPY public.fixture (id, value) FROM stdin;\n1\ta\\nb\n2\tc\n\\.\n';
 const b='COPY public.fixture (id, value) FROM stdin;\n2\tc\n1\ta\\nb\n\\.\n';
 assert.deepEqual(copyBlocks(a),copyBlocks(b));
 assert.notDeepEqual(copyBlocks(a),copyBlocks(b.replace('2\tc','1\ta\\nb')));
 assert.notDeepEqual(copyBlocks(a),copyBlocks(a.replace('(id, value)','(value, id)')));
});
test('software console refuses authored private-stage marker before reading assets or starting QEMU',async()=>{
 const root=path.join(tmpdir(),'restore-20261022-qemu-'+randomUUID().slice(0,8));
 await mkdir(root);
 try{
  await writeFile(path.join(root,'private-data-staged.json'),'{}');
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('../../supabase/operations/recovery-vm.mjs',import.meta.url)),root,'software-console'],{windowsHide:true,encoding:'utf8'});
  assert.notEqual(child.status,0);assert.match(child.stderr,/private data forbids software console/);
  assert.doesNotMatch(child.stdout,/VM_BOOTED|PUBLIC_SOFTWARE_CONSOLE/);
 }finally{await rm(root,{recursive:true})}
});
test('native ACL checks preserve NULL defaults, grantor and grant-option comparison',()=>{
 const sql=nativeAclChecks({schemas:[{nspname:"author's schema",owner:'Case"Owner',acl:null}],tables:[{schema:'fixture',name:'row',owner:'owner',acl:'{owner=arwdDxtm/owner}'}]});
 assert.match(sql,/default_transaction_read_only=on/);
 assert.ok(sql.includes("acldefault('n','\"Case\"\"Owner\"'::regrole::oid)"));
 assert.ok(sql.includes("author''s schema"));
 assert.match(sql,/EXCEPT ALL/);
 assert.match(sql,/aclexplode/);
 assert.ok(sql.includes("'{owner=arwdDxtm/owner}'::aclitem[]"));
 assert.doesNotMatch(sql,/\b(?:GRANT|REVOKE|UPDATE|INSERT|DELETE)\b/);
});
test('ACL item order is not a privilege change, NULL is not an empty ACL',()=>{
 assert.deepEqual(normalizeAcl('{a=r/b,c=rw/d}'),normalizeAcl('{c=rw/d,a=r/b}'));
 assert.notDeepEqual(normalizeAcl('{a=r/b}'),normalizeAcl('{a=r*/b}'));
 assert.notDeepEqual(normalizeAcl('{a=r/b}'),normalizeAcl('{a=r/c}'));
 assert.notDeepEqual(normalizeAcl(null),normalizeAcl('{}'));
 assert.deepEqual(normalizeAcl('{"\\"comma,role\\"=r/b",c=w/d}'),['"comma,role"=r/b','c=w/d']);
 assert.throws(()=>normalizeAcl('{"unterminated}'));
});
test('schema normalization removes client version/random restrict, not DDL or grants',()=>{
 const a='-- Dumped by pg_dump version 17.11\n\\restrict aaa\nCREATE TABLE x(id int);\n\\unrestrict aaa\n';
 const b=a.replace('17.11','17.6').replaceAll('aaa','bbb');
 assert.equal(normalizeSchema(a),normalizeSchema(b));
 assert.notEqual(normalizeSchema(a),normalizeSchema(b+'GRANT SELECT ON x TO y;\n'));
});
test('malformed or repeated COPY sections fail instead of being silently ignored',()=>{
 assert.throws(()=>copyBlocks('COPY public.fixture (id) FROM stdin;\n1\n'));
 const block='COPY public.fixture (id) FROM stdin;\n1\n\\.\n';
 assert.throws(()=>copyBlocks(block+block));
});
test('zero table ACL differences is not evidence of extension-owned table failures',()=>{
 const rows=[{scope:'schemas',key:['fixture'],matched:false}];
 assert.deepEqual(aclMismatchSummary(rows,{tables:[]}),{aclMismatchCount:1,schemaAclMismatchCount:1,tableAclMismatchCount:0,tableAclMismatchesExtensionOwned:null});
 assert.equal(aclMismatchSummary([{scope:'tables',key:['public','fixture'],matched:false}],{tables:[{schema:'public',name:'fixture',extension:null}]}).tableAclMismatchesExtensionOwned,false);
});
test('schema supplement restores captured grants only and refuses a different source baseline',()=>{
 const acl='{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}';
 const inventory={schemas:['graphql','graphql_public'].map(nspname=>({nspname,owner:'supabase_admin',acl}))};
 const sql=graphqlAclSupplement(inventory);
 assert.equal((sql.match(/GRANT USAGE ON SCHEMA/g)||[]).length,4);
 assert.equal((sql.match(/WITH GRANT OPTION/g)||[]).length,2);
 assert.match(sql,/SET LOCAL ROLE supabase_admin/);
 assert.match(sql,/nspacl IS NULL OR NOT EXISTS/);
 assert.match(sql,/unreviewed-target-schema-acl/);
 assert.doesNotMatch(sql,/GRANT ALL|REVOKE|ON TABLE|ON FUNCTION/);
 assert.throws(()=>graphqlAclSupplement({schemas:inventory.schemas.map(x=>({...x,acl:x.acl.replace('anon=U/','anon=UC/')}))}),/unreviewed-source/);
 assert.throws(()=>graphqlAclSupplement({schemas:inventory.schemas.slice(1)}),/unreviewed-source/);
});
test('ACL statement order is presentation, privileges/grantors/options are not',()=>{
 const header='fixture; Type: ACL; Schema: public; Owner: owner';
 const a={header,body:'--\nGRANT SELECT ON TABLE public.fixture TO anon;\nGRANT UPDATE ON TABLE public.fixture TO authenticated;\n'};
 const b={header,body:'GRANT UPDATE ON TABLE public.fixture TO authenticated;\nGRANT SELECT ON TABLE public.fixture TO anon;\n'};
 assert.equal(blockMeaning(a),blockMeaning(b));
 assert.notEqual(blockMeaning(a),blockMeaning({...b,body:b.body.replace('SELECT','ALL')}));
 assert.notEqual(blockMeaning(a),blockMeaning({...b,body:b.body.replace('TO anon;','TO anon WITH GRANT OPTION;')}));
 assert.throws(()=>blockMeaning({...a,body:a.body+'DO $$ BEGIN NULL; END $$;'}),/unsupported/);
});
test('dump boundary SET relocation is checked separately and function contents remain literal',()=>{
 const header='fixture(); Type: FUNCTION; Schema: public; Owner: owner';
 const body="--\n\nCREATE FUNCTION public.fixture() RETURNS text LANGUAGE sql AS $$\nSET default_tablespace = 'inside';\n--\n$$;\nALTER FUNCTION public.fixture() OWNER TO owner;\n";
 const tail="\nSET default_tablespace = '';\n\nSET default_table_access_method = heap;\n\n";
 assert.equal(blockMeaning({header,body}),blockMeaning({header,body:body+tail}));
 assert.notEqual(blockMeaning({header,body}),blockMeaning({header,body:body.replace("'inside'","'changed'")}));
 assert.notDeepEqual(boundarySettings(tail),boundarySettings(tail.replace('heap','other')));
 assert.match(blockMeaning({header,body}),/--\n\$\$/);
 const input='\n--\n-- Name: '+header+'\n'+body;
 assert.equal(schemaBlocks(input)[0].header,header);
});
test('catalog row ordering/ACL text does not hide owners, RLS or constraint changes',()=>{
 const a=[{schema:'public',name:'z',owner:'owner',relrowsecurity:true,acl:null},{schema:'auth',name:'a',owner:'owner',relrowsecurity:true,acl:'{}'}];
 assert.deepEqual(catalogRows(a),catalogRows([...a].reverse().map(x=>({...x,acl:null}))));
 assert.notDeepEqual(catalogRows(a),catalogRows(a.map(x=>({...x,relrowsecurity:false}))));
 assert.notDeepEqual(catalogRows(a),catalogRows(a.map(x=>({...x,owner:'other'}))));
});
test('supplemental target privilege evidence is read-only, scoped and retained privately without declaring source equivalence',async()=>{
 const op=new URL('../../supabase/operations/',import.meta.url);
 const sql=await readFile(new URL('recovery-target-acl.sql',op),'utf8');
 assert.match(sql,/^\\set QUIET on$/m);
 // String literals name privileges; only executable tokens are checked here.
 const executable=sql.replace(/--[^\n]*/g,'').replace(/'(?:[^']|'')*'/g,"''");
 assert.match(executable,/BEGIN READ ONLY;/);
 assert.match(executable,/ROLLBACK;\s*$/);
 assert.doesNotMatch(executable,/\b(?:GRANT|REVOKE|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|TRUNCATE|COPY|DO|CALL)\b/i);
 assert.doesNotMatch(executable,/\b(?:pg_authid|rolpassword|pg_get_functiondef|dblink|http_post)\b/i);
 assert.match(sql,/nspname IN \('graphql','graphql_public','extensions'\)/);
 for(const catalog of ['pg_init_privs','pg_default_acl','pg_auth_members','pg_depend'])assert.ok(sql.includes(catalog));
 for(const kind of ['schema','function','table','sequence'])assert.ok(sql.includes(`has_${kind}_privilege`));
 assert.match(sql,/'sourceFunctionColumnInitialAclCaptured',false/);
 assert.match(sql,/'proceduralOrDynamicDependencyCoverageComplete',false/);
 assert.match(sql,/'zeroRegisteredDependenciesProvesUnused',false/);
 assert.match(sql,/'registered_inbound_dependencies'/);
 assert.match(sql,/pg_describe_object\(d\.classid,d\.objid,d\.objsubid\)/);
 assert.match(sql,/JOIN pg_depend d ON d\.refclassid=s\.classid AND d\.refobjid=s\.objid/);
 assert.match(sql,/COALESCE\(p\.proacl,acldefault\('f',p\.proowner\)\)/);
 assert.doesNotMatch(sql,/\b51\b|\b49\b|\bverified\b/);
 const guest=await readFile(new URL('recovery-guest-inside.sh',op),'utf8');
 assert.match(guest,/psql -At -d postgres -f \/recovery\/target-acl\.sql > \/recovery\/target-privileges\.json 2> \/recovery\/target-privileges\.log/);
 assert.ok(guest.indexOf('target-privileges.json')<guest.indexOf('redump-data.log'));
 const verifier=await readFile(new URL('recovery-local.mjs',op),'utf8');
 assert.match(verifier,/files\.filter\(x=>\/\\\.\(\?:log\|jsonl\?\|txt\|sql\)\$\//);
 assert.doesNotMatch(verifier,/name!==['"]target-privileges\.json['"]/);
});
function hostEvidenceFixture(){
 const root='C:/private/restore-20261115-qemu-12345678',share='attempt-restore-1234';
 const args=['-machine','pc','-accel','tcg,thread=multi','-cpu','max','-smp','2','-m','768',
  '-nodefaults','-no-user-config','-display','none','-monitor','none','-serial','stdio','-nic','none','-parallel','none',
  '-kernel',root+'/alpine/boot/vmlinuz-virt','-initrd',root+'/alpine/boot/initramfs-virt','-append','console=ttyS0 quiet',
  '-drive',`file=${root}/assets/alpine-virt-3.24.4-x86_64.iso,media=cdrom,if=ide,readonly=on`,
  '-drive',`file=${root}/software.iso,media=cdrom,if=ide,readonly=on`,
  '-drive',`file=${root}/work.qcow2,format=qcow2,if=virtio`,
  '-drive',`file=fat:rw:${root}/${share},format=raw,if=virtio`];
 return {root,latest:{share},invocations:[{name:'vm-invocation-restore-5678.json',record:{mode:'restore',share,args}}],
  results:[{name:'vm-result-restore-5678.json',record:{format:1,mode:'restore',share,invocation:'vm-invocation-restore-5678.json',qemuExitCode:0,guestCommandsPassed:true}}]};
}
test('host isolation evidence derives actual no-NIC/driver proof and refuses missing, changed, ambiguous or failed records',()=>{
 const good=hostEvidenceFixture();
 assert.deepEqual(vmIsolationEvidence(good),{vmIsolationVerified:true,restoreDriverVerified:true,networkDevice:false,vmInvocationCount:1});
 const refuses=(edit,code)=>{const f=structuredClone(good);edit(f);assert.throws(()=>vmIsolationEvidence(f),code);};
 refuses(f=>{f.invocations=[];},/VM_HOST_EVIDENCE_MISSING/);
 refuses(f=>{f.results=[];},/VM_RESTORE_HOST_RESULT_MISSING/);
 refuses(f=>{f.invocations[0].record.args.push('-netdev','user,id=unsafe');},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args.push('-qmp','tcp:127.0.0.1:1234');},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args.push('-vnc',':0');},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{const a=f.invocations[0].record.args;a[a.indexOf('-nic')+1]='user,hostfwd=tcp::22-:22';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{const a=f.invocations[0].record.args;a.splice(a.indexOf('-nodefaults'),1);},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args[1]='pc,netdev=hidden';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args[f.invocations[0].record.args.length-1]='file=fat:rw:C:/elsewhere/attempt-restore-1234,format=raw,if=virtio';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args[f.invocations[0].record.args.length-1]+=',file.file.filename=https://example.invalid/block';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args[f.invocations[0].record.args.length-1]+=',driver=nbd,server.host=example.invalid';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.invocations[0].record.args[f.invocations[0].record.args.length-1]+=',';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{const a=f.invocations[0].record.args;a[a.indexOf('-drive')+1]+=',readonly=off';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{const a=f.invocations[0].record.args;a[a.indexOf('-drive')+1]='file=https://example.invalid/alpine.iso,media=cdrom,if=ide,readonly=on';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{const a=f.invocations[0].record.args;a[a.indexOf('-kernel')+1]=f.root+'/alpine/other-kernel';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{const a=f.invocations[0].record.args;a[a.indexOf('-initrd')+1]=f.root+'/alpine/boot/initramfs-virt/';},/VM_ISOLATION_ARGUMENTS/);
 refuses(f=>{f.latest.share='attempt-restore-999';},/VM_LATEST_RESTORE_BINDING/);
 refuses(f=>{f.results[0].record.share='attempt-restore-999';},/VM_RESTORE_HOST_RESULT_BINDING/);
 refuses(f=>{f.results[0].record.qemuExitCode=1;},/VM_RESTORE_HOST_FAILED/);
 refuses(f=>{f.results[0].record.qemuExitCode=null;},/VM_RESTORE_HOST_FAILED/);
 refuses(f=>{f.results[0].record.guestCommandsPassed=false;},/VM_RESTORE_HOST_FAILED/);
 refuses(f=>{f.results.push(structuredClone(f.results[0]));},/VM_RESTORE_HOST_RESULT_MISSING/);
 const reordered=structuredClone(good),driveAt=reordered.invocations[0].record.args.indexOf('-drive');
 const pairs=reordered.invocations[0].record.args.splice(driveAt);
 for(let i=pairs.length-2;i>=0;i-=2)reordered.invocations[0].record.args.push(pairs[i],pairs[i+1]);
 assert.equal(vmIsolationEvidence(reordered).vmIsolationVerified,true);
 const publicRun=structuredClone(good.invocations[0]);
 publicRun.name='vm-invocation-prepare-123.json';publicRun.record.mode='prepare';
 publicRun.record.share='attempt-software-prepare-123-abcdef12';
 publicRun.record.args[publicRun.record.args.length-1]=`file=fat:rw:${good.root}/${publicRun.record.share},format=raw,if=virtio`;
 good.invocations.unshift(publicRun);
 assert.equal(vmIsolationEvidence(good).vmInvocationCount,2);
 publicRun.record.args.push('-net','user');
 assert.throws(()=>vmIsolationEvidence(good),/VM_ISOLATION_ARGUMENTS/);
});
