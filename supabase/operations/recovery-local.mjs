// Operator-only, local backup/VM verification. Never prints data or native errors.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyArtifact, decryptSmallArtifact, encryptBytes } from './recovery-archive.mjs';
let config,key;
const sha=x=>createHash('sha256').update(x).digest('hex');
const ident=x=>'"'+x.replaceAll('"','""')+'"';
async function native(tool,args){
 return new Promise((resolve,reject)=>{
  const p=spawn(path.join(config.bin,tool+'.exe'),args,{windowsHide:true,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k))),stdio:['ignore','ignore','pipe']});
  const chunks=[];p.stderr.on('data',x=>chunks.push(x));p.on('error',reject);
  p.on('close',code=>code===0?resolve():reject(new Error('local native operation failed')));
 });
}
async function stage(){
 const share=path.join(config.root,'share');
 await writeFile(path.join(config.root,'private-data-staged.json'),JSON.stringify({at:new Date().toISOString(),consoleForbidden:true}),{flag:'wx',mode:0o600});
 const manifest=JSON.parse(await readFile(path.join(config.directory,'status.json'),'utf8'));
 for(const [source,target] of [['database','database.dump'],['roles-before','roles.sql'],['source-inventory','source-inventory.json']]){
  const file=path.join(config.directory,source+'.aesgcm');
  const expected=manifest.files.find(x=>x.name===source+'.aesgcm');
  if(!expected||sha(await readFile(file))!==expected.sha256)throw new Error('original artifact hash mismatch');
  await verifyArtifact(file,key);
  const plain=await decryptSmallArtifact(file,key);await writeFile(path.join(share,target),plain,{flag:'wx',mode:0o600});plain.fill(0);
 }
 const inventory=JSON.parse(await readFile(path.join(share,'source-inventory.json'),'utf8'));
 let sql="\\set ON_ERROR_STOP on\nSET row_security=off;\n";
 // SQL generated only from authenticated identifiers, quoted; output stays private.
 for(const t of inventory.tables){
  sql+=`SELECT json_build_object('schema',${literal(t.schema)},'name',${literal(t.name)},'count',count(*)::text) FROM ${ident(t.schema)}.${ident(t.name)};\n`;
 }
 await writeFile(path.join(share,'counts.sql'),sql,{flag:'wx',mode:0o600});
 await native('pg_restore',['--schema-only','--file='+path.join(share,'source-schema.sql'),path.join(share,'database.dump')]);
 await native('pg_restore',['--data-only','--file='+path.join(share,'source-data.sql'),path.join(share,'database.dump')]);
 for(const [source,target] of [['recovery-guest.sh','guest-restore.sh'],['recovery-guest-inside.sh','guest-inside.sh'],['recovery-target-inventory.sql','target-inventory.sql'],['recovery-target-relationships.sql','target-relationships.sql']]){
  const text=(await readFile(new URL(source,import.meta.url),'utf8')).replaceAll('\r\n','\n');
  await writeFile(path.join(share,target),text,{flag:'wx',mode:0o600});
 }
 console.log('AUTHENTICATED_EXISTING_BACKUP_STAGED_PRIVATELY');
}
function literal(x){return "'"+x.replaceAll("'","''")+"'"}
// COPY rows contain escaped embedded newlines, so one physical line per record.
export function copyBlocks(sql){
 const blocks=new Map();let header=null,rows=[];
 for(const line of sql.replaceAll('\r\n','\n').split('\n')){
  if(header!==null){if(line==='\\.'){if(blocks.has(header))throw new Error('duplicate COPY');blocks.set(header,sha(rows.sort().join('\n')));header=null;rows=[];}else rows.push(line)}
  else if(/^COPY .+ FROM stdin;$/.test(line))header=line;
 }
 if(header!==null)throw new Error('unterminated COPY');return blocks;
}
export function normalizeSchema(sql){
 return sql.replaceAll('\r\n','\n').split('\n').filter(x=>
  !/^-- Dumped (?:from database|by pg_dump) version /.test(x)&&!/^\\(?:un)?restrict\b/.test(x)
 ).join('\n').trim();
}
export function normalizeAcl(value){
 if(value===null)return null;
 if(typeof value!=='string'||!value.startsWith('{')||!value.endsWith('}'))throw new Error('invalid ACL array');
 if(value==='{}')return [];
 const items=[];let current='',quoted=false,escaped=false;
 for(const ch of value.slice(1,-1)){
  if(escaped){current+=ch;escaped=false;continue}
  if(ch==='\\'){escaped=true;continue}
  if(ch==='"'){quoted=!quoted;continue}
  if(ch===','&&!quoted){items.push(current);current=''}else current+=ch;
 }
 if(quoted||escaped)throw new Error('unterminated ACL array');items.push(current);
 return items.sort();
}
export function aclMismatchSummary(rows,inventory){
 const bad=rows.filter(x=>x.matched!==true),tables=bad.filter(x=>x.scope==='tables');
 return {aclMismatchCount:bad.length,schemaAclMismatchCount:bad.filter(x=>x.scope==='schemas').length,
  tableAclMismatchCount:tables.length,
  tableAclMismatchesExtensionOwned:tables.length?tables.every(x=>Boolean(inventory.tables.find(t=>t.schema===x.key[0]&&t.name===x.key[1])?.extension)):null};
}
// Public metadata only; never infer isolation from a hardcoded status value.
// Historical software preparation may predate host-result records, but the
// actual restore must bind its own successful host/guest result exactly.
export function vmIsolationEvidence({root,latest,invocations,results}){
 if(!latest||!/^attempt-restore-\d+$/.test(latest.share)||!Array.isArray(invocations)||!invocations.length||!Array.isArray(results))throw new Error('VM_HOST_EVIDENCE_MISSING');
 const normalized=value=>value.replaceAll('\\','/').replace(/\/+$/,'').toLowerCase();
 const base=normalized(root);
 const filename=value=>value.replaceAll('\\','/').toLowerCase();
 const flag=new Set(['-nodefaults','-no-user-config']);
 const valueOptions=new Set(['-machine','-accel','-cpu','-smp','-m','-display','-monitor','-serial','-nic','-parallel','-kernel','-initrd','-append','-drive']);
 const names=new Set();
 for(const item of invocations){
  const record=item.record;
  if(!/^vm-invocation-(?:prepare|inspect|build-pgnet|software-smoke|software-console|restore)-\d+\.json$/.test(item.name)||names.has(item.name)||!record||!Array.isArray(record.args)||record.args.some(x=>typeof x!=='string')||typeof record.share!=='string')throw new Error('VM_INVOCATION_INVALID');
  names.add(item.name);
  if(item.name.slice('vm-invocation-'.length).replace(/-\d+\.json$/,'')!==record.mode)throw new Error('VM_INVOCATION_MODE_MISMATCH');
  const sharePattern=record.mode==='restore'?/^attempt-restore-\d+$/:record.mode==='software-console'?/^share$/:new RegExp('^attempt-software-'+record.mode+'-\\d+-[a-f0-9]{8}$');
  if(!sharePattern.test(record.share))throw new Error('VM_INVOCATION_SHARE_INVALID');
  const options=new Map();
  for(let i=0;i<record.args.length;i++){
   const option=record.args[i];
   if(flag.has(option)){if(options.has(option))throw new Error('VM_ISOLATION_ARGUMENTS');options.set(option,[true]);continue;}
   if(!valueOptions.has(option)||i+1>=record.args.length)throw new Error('VM_ISOLATION_ARGUMENTS');
   const value=record.args[++i];
   if(value.startsWith('-')||/hostfwd|guestfwd|netdev|qmp|vnc|(?:tcp|udp):/i.test(value))throw new Error('VM_ISOLATION_ARGUMENTS');
   if(options.has(option)&&option!=='-drive')throw new Error('VM_ISOLATION_ARGUMENTS');
   options.set(option,[...(options.get(option)??[]),value]);
  }
  if(![...flag].every(f=>options.has(f))||!['-display','-monitor','-nic','-parallel'].every(f=>options.get(f)?.[0]==='none')||options.get('-serial')?.[0]!=='stdio')throw new Error('VM_ISOLATION_ARGUMENTS');
  if(filename(options.get('-kernel')?.[0]??'')!==base+'/alpine/boot/vmlinuz-virt'
   ||filename(options.get('-initrd')?.[0]??'')!==base+'/alpine/boot/initramfs-virt')throw new Error('VM_ISOLATION_ARGUMENTS');
  const drives=options.get('-drive')??[];
  const driveKinds=new Set();
  for(const drive of drives){
   // Accept the actual four local-drive grammars only. Merely checking the
   // prefix before a comma would permit network block options after that comma.
   const m=drive.match(/^file=([^,]+)(,.*)$/);
   if(!m)throw new Error('VM_ISOLATION_ARGUMENTS');
   const file=filename(m[1]),suffix=m[2],prefix=base+'/assets/alpine-virt-';
   let kind;
   if(file.startsWith(prefix)&&/^\d+\.\d+\.\d+-x86_64\.iso$/.test(file.slice(prefix.length))
    &&suffix===',media=cdrom,if=ide,readonly=on')kind='alpine';
   else if(file===base+'/software.iso'&&suffix===',media=cdrom,if=ide,readonly=on')kind='software';
   else if(file===base+'/work.qcow2'&&suffix===',format=qcow2,if=virtio')kind='work';
   else if(file===`fat:rw:${base}/${record.share}`&&suffix===',format=raw,if=virtio')kind='share';
   else throw new Error('VM_ISOLATION_ARGUMENTS');
   if(driveKinds.has(kind))throw new Error('VM_ISOLATION_ARGUMENTS');
   driveKinds.add(kind);
  }
  if(drives.length!==4||driveKinds.size!==4)throw new Error('VM_ISOLATION_ARGUMENTS');
 }
 const restore=invocations.filter(x=>x.record.mode==='restore'&&x.record.share===latest.share);
 if(restore.length!==1)throw new Error('VM_LATEST_RESTORE_BINDING');
 const matched=results.filter(x=>x.record?.invocation===restore[0].name);
 if(matched.length!==1)throw new Error('VM_RESTORE_HOST_RESULT_MISSING');
 const result=matched[0];
 if(result.name!==restore[0].name.replace('vm-invocation-','vm-result-')||result.record.format!==1||result.record.mode!=='restore'||result.record.share!==latest.share)throw new Error('VM_RESTORE_HOST_RESULT_BINDING');
 if(result.record.qemuExitCode!==0||result.record.guestCommandsPassed!==true)throw new Error('VM_RESTORE_HOST_FAILED');
 return {vmIsolationVerified:true,restoreDriverVerified:true,networkDevice:false,vmInvocationCount:invocations.length};
}
async function verify(){
 let share=path.join(config.root,'share');
 try{const latest=JSON.parse(await readFile(path.join(config.root,'latest-restore.json'),'utf8'));if(!/^attempt-restore-\d+$/.test(latest.share))throw new Error('private path refused');share=path.join(config.root,latest.share)}catch(e){if(e.code!=='ENOENT')throw e}
 const stamp=new Date().toISOString().replaceAll(/[:.]/g,'-');
 const evidence={at:new Date().toISOString(),actualRestore:false,networkDevice:null,tcpListener:null,vmIsolationVerified:false,restoreDriverVerified:false};
 const files=await readdir(share);const privateFiles={};
 // Persist detailed diagnostics encrypted BEFORE temporary VM deletion, never echo.
 for(const name of files.filter(x=>/\.(?:log|jsonl?|txt|sql)$/.test(x))){privateFiles[name]=(await readFile(path.join(share,name))).toString('utf8')}
 const diagnostics=Object.fromEntries(Object.entries(privateFiles).filter(([name])=>
  !name.endsWith('.sql')&&name!=='source-inventory.json'&&name!=='target-data.sql'
 ));
 // Preserve host launch/isolation/preparation evidence before removing staging.
 // Safe keys prevent collisions with guest diagnostics or the M4 input binding.
 const hostNames=(await readdir(config.root)).filter(name=>
  /^vm-(?:invocation|result)-[a-z0-9.-]+\.json$/.test(name)
  || /^(?:serial|qemu)-[a-z0-9.-]+\.log$/.test(name)
  || /^(?:software-prepared|software-smoke-verified|latest-restore|private-data-staged)\.json$/.test(name));
 for(const name of hostNames)diagnostics['host/'+name]=await readFile(path.join(config.root,name),'utf8');
 try{
  for(const name of (await readdir(path.join(config.root,'assets'))).filter(name=>/^[a-z0-9.-]+\.json$/.test(name)))diagnostics['assets/'+name]=await readFile(path.join(config.root,'assets',name),'utf8');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 await encryptBytes(Buffer.from(JSON.stringify(diagnostics)),path.join(config.directory,'restore-'+stamp+'-details.aesgcm'),key);
 evidence.phaseDiagnostics=['initdb','start','roles-restore','pre-data','data','post-data','relationships','redump-data','redump-schema'].filter(x=>files.includes(x+'.log')).map(stage=>({stage,errorReported:/\b(?:ERROR|FATAL|PANIC):|command not found|cannot execute|No such file or directory/.test(privateFiles[stage+'.log'])}));
 const logged=Object.entries(privateFiles).filter(([name])=>name.endsWith('.log')).map(([,text])=>text).join('\n');
 evidence.safeErrorCodes=[];
 for(const [pattern,code]of [[/extension .* is not available/,'EXTENSION_UNAVAILABLE'],[/must be loaded via shared_preload_libraries/,'PRELOAD_REQUIRED'],[/already exists/,'OBJECT_ALREADY_EXISTS'],[/permission denied/,'LOCAL_PERMISSION_DENIED'],[/No such file or directory/,'LOCAL_DEPENDENCY_MISSING'],[/invalid locale|invalid LC_COLLATE|collation .* does not exist/,'LOCALE_DEPENDENCY'],[/unrecognized configuration parameter/,'CONFIGURATION_UNSUPPORTED']])if(pattern.test(logged))evidence.safeErrorCodes.push(code);
 try{
  if(!files.includes('restore-complete.json'))throw new Error('RESTORE_NOT_COMPLETED');
  const complete=JSON.parse(privateFiles['restore-complete.json']);evidence.serverVersion=complete.serverVersion;
  if(!String(complete.serverVersion).startsWith('17'))throw new Error('SERVER_MAJOR');
  evidence.actualRestore=true;
  const hostRecords=prefix=>hostNames.filter(name=>name.startsWith(prefix)).map(name=>({name,record:JSON.parse(diagnostics['host/'+name])}));
  Object.assign(evidence,vmIsolationEvidence({root:config.root,
   latest:JSON.parse(diagnostics['host/latest-restore.json']??'null'),
   invocations:hostRecords('vm-invocation-'),results:hostRecords('vm-result-')}));
  evidence.relationships=complete.validatedForeignKeysNoOrphans===true;
  evidence.cronDisabled=complete.cronDisabled===true;evidence.noTcp=complete.noTcp===true;
  evidence.tcpListener=complete.noTcp===true?false:null;
  evidence.pgNetWorkerAbsent=complete.pgNetWorkerAbsent===true;
  evidence.pgNetProcessingDisabled=complete.pgNetProcessingDisabled===true;
  evidence.pgNetIsolated=complete.pgNetIsolated===true;
  evidence.httpQueueEmpty=complete.httpQueueEmpty===true;
  evidence.nativeDependencies=JSON.parse(privateFiles['native-dependencies.json']).verified===true;
  const source=JSON.parse(privateFiles['source-inventory.json']);
  const target=JSON.parse(privateFiles['target-inventory.json']);
  const equal=x=>JSON.stringify(x);
  const aclRows=privateFiles['acl-comparison.jsonl']?.trim().split(/\r?\n/).filter(x=>x.startsWith('{')).map(JSON.parse)??[];
  const aclKey=(scope,key)=>scope+':'+JSON.stringify(key);
  const aclMap=new Map(aclRows.map(x=>[aclKey(x.scope,x.key),x.matched]));
  const aclExpected=[...source.schemas.map(s=>aclKey('schemas',[s.nspname])),...source.tables.map(t=>aclKey('tables',[t.schema,t.name]))];
  evidence.aclEffective=aclRows.length===aclExpected.length&&aclMap.size===aclExpected.length&&aclExpected.every(k=>aclMap.get(k)===true);
  const badAcl=aclRows.filter(x=>x.matched!==true);
  evidence.publicSchemaAndTablesAclMatch=aclRows.some(x=>x.key[0]==='public')&&!badAcl.some(x=>x.key[0]==='public');
  Object.assign(evidence,aclMismatchSummary(aclRows,source));
  evidence.schemaAclMismatch=badAcl.some(x=>x.scope==='schemas');
  evidence.alignedClient=/\b17\.11\b/.test(privateFiles['aligned-client-version.txt']??'');
  evidence.catalog={};
  evidence.rawAclTextMatches={};
  for(const field of ['schemas','extensions','tables','constraints']){
   const normalize=rows=>rows.map(row=>{if(!Object.hasOwn(row,'acl'))return row;const{acl,...rest}=row;return rest});
   evidence.catalog[field]=equal(normalize(source[field]))===equal(normalize(target[field]));
   if(['schemas','tables'].includes(field)){
    const raw=rows=>rows.map(row=>({...row,acl:normalizeAcl(row.acl)}));
    evidence.rawAclTextMatches[field]=equal(raw(source[field]))===equal(raw(target[field]));
   }
  }
  const counts=privateFiles['target-counts.jsonl'].trim().split(/\r?\n/).filter(x=>x.startsWith('{')).map(JSON.parse);
  evidence.rowCounts=source.counts.every(s=>{
   if(s.schema==='net'&&['_http_response','http_request_queue'].includes(s.name))return true;
   const t=counts.find(t=>t.schema===s.schema&&t.name===s.name);return !s.unreadable&&t?.count===s.count;
  });
  const a=copyBlocks(privateFiles['source-data.sql']),b=copyBlocks(privateFiles['target-data.sql']);
  evidence.copyData=a.size===b.size&&[...a].every(([k,v])=>b.get(k)===v);
  const sequences=s=>s.split(/\r?\n/).filter(x=>/^SELECT pg_catalog.setval\(/.test(x)).sort();
  evidence.sequences=equal(sequences(privateFiles['source-data.sql']))===equal(sequences(privateFiles['target-data.sql']));
  evidence.schemaSql=normalizeSchema(privateFiles['source-schema.sql'])===normalizeSchema(privateFiles['target-schema.sql']);
  const normalizeRoles=sql=>sql.replaceAll('\r\n','\n').split('\n').filter(x=>x.trim()&&
   !/^-- Dumped (?:from database|by pg_dumpall) version /.test(x)&&!/^\\(?:un)?restrict\b/.test(x)&&
   !/^(?:CREATE|ALTER) ROLE mw_restore_bootstrap\b/.test(x)
  ).join('\n').trim();
  evidence.roles=normalizeRoles(privateFiles['roles.sql'])===normalizeRoles(privateFiles['target-roles.sql']);
  // Preserve comparison fingerprints, not a second raw SQL/data archive.
  const fingerprints={at:evidence.at,schema:{source:sha(normalizeSchema(privateFiles['source-schema.sql'])),target:sha(normalizeSchema(privateFiles['target-schema.sql']))},copyBlocks:{source:[...a],target:[...b]},roles:{source:sha(normalizeRoles(privateFiles['roles.sql'])),target:sha(normalizeRoles(privateFiles['target-roles.sql']))},sequences:{source:sha(equal(sequences(privateFiles['source-data.sql']))),target:sha(equal(sequences(privateFiles['target-data.sql'])))}};
  const proofFile=path.join(config.directory,'restore-'+stamp+'-comparisons.aesgcm');
  await encryptBytes(Buffer.from(JSON.stringify(fingerprints)),proofFile,key);await verifyArtifact(proofFile,key);
  evidence.verified=evidence.vmIsolationVerified&&evidence.restoreDriverVerified&&Object.values(evidence.catalog).every(Boolean)&&evidence.aclEffective&&evidence.alignedClient&&evidence.rowCounts&&evidence.copyData&&evidence.sequences&&evidence.schemaSql&&evidence.roles&&evidence.relationships&&evidence.cronDisabled&&evidence.noTcp&&evidence.pgNetProcessingDisabled&&evidence.pgNetIsolated&&evidence.httpQueueEmpty&&evidence.nativeDependencies;
 }catch(e){evidence.failure=/^[A-Z_]+$/.test(e.message)?e.message:'VERIFICATION_FAILED';evidence.verified=false}
 await writeFile(path.join(config.directory,'restore-'+stamp+'.status.json'),JSON.stringify(evidence,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify(evidence));if(!evidence.verified)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const input=[];for await(const c of process.stdin)input.push(c);config=JSON.parse(Buffer.concat(input).toString());key=Buffer.from(config.keyBase64,'base64');delete config.keyBase64;
  if(key.length!==32)throw new Error('key');if(config.mode==='stage')await stage();else if(config.mode==='verify')await verify();else throw new Error('mode');
 }catch{console.log('LOCAL_RECOVERY_FAILED_DETAILS_NOT_PRINTED');process.exitCode=1}finally{key?.fill(0)}
}
