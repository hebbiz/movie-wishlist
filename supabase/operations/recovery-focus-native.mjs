// Focused PG17 schema/ACL repeat, not a full Supabase/service restore.
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {randomBytes} from 'node:crypto';
import {nativeAclChecks} from './recovery-acl-checks.mjs';
import {graphqlAclSupplement} from './recovery-schema-supplement.mjs';
export async function focusedNative(config,source,open,key,blocks){
 let running=false,phase='init',port;
 const password=randomBytes(32).toString('hex');
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k))),PGPASSWORD:password,PGCONNECT_TIMEOUT:'5',PGAPPNAME:'mw-offline-recovery-focus'};
 const root=config.localRoot,data=path.join(root,'data');
 async function native(tool,args,input,allowed=false){
  return new Promise((resolve,reject)=>{
   const control=tool==='pg_ctl';
   const p=spawn(path.join(config.bin,tool+'.exe'),args,{env,windowsHide:true,stdio:control?['ignore','ignore','ignore']:['pipe','pipe','pipe']});
   const out=[],err=[];let bytes=0;const timer=setTimeout(()=>p.kill(),60000);
   p.stdout?.on('data',c=>{bytes+=c.length;if(bytes>16*1024*1024)p.kill();else out.push(c)});p.stderr?.on('data',c=>err.push(c));p.stdin?.on('error',()=>{});
   p.on('error',e=>{clearTimeout(timer);reject(e)});p.on('close',code=>{clearTimeout(timer);const result={code,out:Buffer.concat(out).toString(),err:Buffer.concat(err).toString()};code===0||allowed?resolve(result):reject(Object.assign(new Error('native-failed'),{privateResult:result}))});
   p.stdin?.end(input??'');
  });
 }
 const args=()=>['-h','127.0.0.1','-p',String(port),'-U','supabase_admin','-d','postgres'];
 const sql=async text=>(await native('psql',['-X','-At','-v','ON_ERROR_STOP=1',...args()],text)).out;
 try{
  const pw=path.join(root,'init-password');await writeFile(pw,password,{flag:'wx',mode:0o600});
  await native('initdb',['-D',data,'-U','supabase_admin','--pwfile='+pw,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
  port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p))})});
  await writeFile(path.join(data,'postgresql.auto.conf'),`listen_addresses='127.0.0.1'\nport=${port}\nshared_preload_libraries=''\nlog_statement='none'\nlog_min_error_statement='panic'\nmax_connections=10\nshared_buffers='16MB'\n`);
  phase='start';await native('pg_ctl',['-D',data,'-l',path.join(root,'server.log'),'-w','start']);running=true;
  phase='roles';const roles=(await open('roles-before.aesgcm',false)).toString().replace(/^CREATE ROLE supabase_admin;\r?\n/m,'');await sql(roles);
  // The archive's public/auth DDL has no extension C functions. No cron, net,
  // event-trigger bootstrap or restored row-trigger execution in this repeat.
  const ident=x=>'"'+x.replaceAll('"','""')+'"';
  // -n selects members, not global SCHEMA entries in this archive. Restore
  // those explicit source definitions/ACLs too; do not substitute new rights.
  phase='schema-prerequisites';await sql(blocks.find(x=>x.header.startsWith('auth; Type: SCHEMA;')).body);
  await sql('ALTER SCHEMA public OWNER TO '+ident(source.schemas.find(x=>x.nspname==='public').owner)+';');
  phase='mw-auth-schema';const archive=await open('database.aesgcm',false);
  try{await native('pg_restore',['--schema-only','--schema=public','--schema=auth','--exit-on-error',...args()],archive)}finally{archive.fill(0)}
  for(const b of blocks.filter(x=>/^SCHEMA (?:public|auth); Type: ACL;/.test(x.header)))await sql(b.body);
  phase='schema-redump';const target=(await native('pg_dump',['--schema-only','--schema=public','--schema=auth',...args()])).out;
  phase='schema-acl-before';await sql('CREATE SCHEMA graphql AUTHORIZATION supabase_admin; CREATE SCHEMA graphql_public AUTHORIZATION supabase_admin;');
  const scoped={schemas:source.schemas.filter(x=>['public','auth','graphql','graphql_public'].includes(x.nspname)),tables:source.tables.filter(x=>['public','auth'].includes(x.schema))};
  const before=(await sql(nativeAclChecks(scoped))).trim().split(/\r?\n/).filter(x=>x.startsWith('{')).map(JSON.parse);
  phase='schema-acl-repair';await sql(graphqlAclSupplement(source));
  const after=(await sql(nativeAclChecks(scoped))).trim().split(/\r?\n/).filter(x=>x.startsWith('{')).map(JSON.parse);
  phase='catalog';const inventory=JSON.parse(await sql(await readFile(new URL('./recovery-target-inventory.sql',import.meta.url),'utf8')));
  return {target,inventory,summary:{serverVersion:await sql("SELECT current_setting('server_version_num');"),beforeAcl:before,afterAcl:after,loopbackOnly:await sql("SELECT current_setting('listen_addresses')='127.0.0.1';"),noPreload:await sql("SELECT current_setting('shared_preload_libraries')='';")}};
 }catch(e){
  // Private evidence only, never returned in the public error.
  const {encryptBytes}=await import('./recovery-archive.mjs');
  await encryptBytes(Buffer.from(JSON.stringify({phase,native:e.privateResult??null})),path.join(config.directory,'focused-failure-'+Date.now()+'.aesgcm'),key);
  throw Object.assign(new Error('focused-native-failed'),{code:'NATIVE_PHASE_'+phase});
 }finally{
  if(running)await native('pg_ctl',['-D',data,'-m','immediate','-w','stop'],null,true);
 }
}
