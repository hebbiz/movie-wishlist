// Deliberately structural output only; no row values, logs or function bodies.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {aclMismatchSummary} from './recovery-local.mjs';
import {focusedNative} from './recovery-focus-native.mjs';
import {schemaBlocks,blockMeaning,boundarySettings,catalogRows} from './recovery-schema-compare.mjs';
import {decryptSmallArtifact,verifyArtifact,encryptBytes} from './recovery-archive.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
async function schemaFromArchive(config,key){
 const file=path.join(config.directory,'database.aesgcm');await verifyArtifact(file,key);
 const p=spawn(path.join(config.bin,'pg_restore.exe'),['--schema-only','--file=-'],{windowsHide:true,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k))),stdio:['pipe','pipe','pipe']});
 const result=[],errors=[];let size=0;p.stdout.on('data',c=>{size+=c.length;if(size>16*1024*1024)p.kill();else result.push(c)});p.stderr.on('data',c=>errors.push(c));
 const exit=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',c=>{if(c===0)return resolve();const s=Buffer.concat(errors).toString();const phrases=[['input file is too short','SHORT_INPUT'],['does not appear to be a valid archive','INVALID_ARCHIVE'],['end of file','EOF'],['could not read','READ_FAILURE'],['seek','SEEK_REQUIRED'],['one of -d/--dbname and -f/--file must be specified','OUTPUT_REQUIRED']];const e=new Error('restore read failed');e.code=phrases.find(([p])=>s.includes(p))?.[1]??'NATIVE_READ_FAILED';reject(e)})});
 // This bounded custom archive fits in memory. No plaintext file is created.
 const bytes=await decryptSmallArtifact(file,key);
 p.stdin.on('error',()=>{});p.stdin.end(bytes);
 try{await exit;return Buffer.concat(result).toString()}finally{bytes.fill(0)}
}
let key,stage='input';
try {
 const chunks=[];for await(const c of process.stdin)chunks.push(c);
 const config=JSON.parse(Buffer.concat(chunks).toString());
 key=Buffer.from(config.keyBase64,'base64');delete config.keyBase64;
 const open=async(name,json=true)=>{const f=path.join(config.directory,name);await verifyArtifact(f,key);const bytes=await decryptSmallArtifact(f,key);return json?JSON.parse(bytes.toString()):bytes};
 stage='saved-evidence';const source=await open('source-inventory.aesgcm');
 const files=(await readdir(config.directory)).filter(x=>/^restore-.*-details\.aesgcm$/.test(x)).sort();
 const name=files.at(-1);const details=await open(name);
 const target=JSON.parse(details['target-inventory.json']);
 const checks=details['acl-comparison.jsonl'].trim().split(/\r?\n/).filter(x=>x.startsWith('{')).map(JSON.parse);
 const differences=checks.filter(x=>!x.matched).map(x=>{
  const rows=x.scope==='schemas'?'schemas':'tables';
  const find=inv=>inv[rows].find(r=>rows==='schemas'?r.nspname===x.key[0]:r.schema===x.key[0]&&r.name===x.key[1]);
  const a=find(source),b=find(target);
  return {scope:x.scope,key:x.key,owner:a.owner,extension:a.extension??null,source:a.acl,target:b.acl};
 });
 stage='schema-reader';const schema=await schemaFromArchive(config,key);
 const blocks=schemaBlocks(schema);
 const graphql=blocks.filter(x=>/graphql/.test(x.header)).map(x=>({header:x.header,grants:x.body.split('\n').filter(l=>/^(?:GRANT|REVOKE) /.test(l)),bodySha256:sha(x.body)}));
 stage='saved-fingerprints';const proofs=(await readdir(config.directory)).filter(x=>/^restore-.*-comparisons\.aesgcm$/.test(x)).sort();
 const fingerprints=await open(proofs.at(-1));
 const focused=(await readdir(config.directory)).filter(x=>/^focused-\d+-details\.aesgcm$/.test(x)).sort();
 if(focused.length){
  const f=await open(focused.at(-1));
  const constraintDifferences=f.targetInventory?source.constraints.filter(x=>['public','auth'].includes(x.schema)).flatMap(x=>{const t=f.targetInventory.constraints.find(y=>y.schema===x.schema&&y.table_name===x.table_name&&y.conname===x.conname);return JSON.stringify(x)===JSON.stringify(t)?[]:[{schema:x.schema,table:x.table_name,name:x.conname,source:x.definition,target:t?.definition,sourceType:x.contype,targetType:t?.contype,sourceValidated:x.convalidated,targetValidated:t?.convalidated}]}):null;
  const baseline=(await readdir(config.directory)).filter(x=>/^restore-.*\.status\.json$/.test(x)&&!x.startsWith('restore-cleanup')).sort().at(-1);
  const r=JSON.parse(await readFile(path.join(config.directory,baseline),'utf8'));
  const preservedSchemaOnly=f.extra.length===2&&f.extra.every(x=>/^(?:SCHEMA )?public; Type: (?:SCHEMA|COMMENT); Schema: -; Owner: pg_database_owner$/.test(x));
  const qualificationOnly=constraintDifferences?.every(x=>x.sourceType===x.targetType&&x.source.replace(/REFERENCES auth\./,'REFERENCES ')===x.target&&x.sourceValidated===x.targetValidated)===true;
  const earlier=await open(focused[0]);
  const conservativeBlockComparison=earlier.privateSchemaDifferences.every(x=>x.target&&blockMeaning(x.source)===blockMeaning(x.target));
  const expectedChecks=source.schemas.filter(x=>['auth','public','graphql','graphql_public'].includes(x.nspname)).length+source.tables.filter(x=>['auth','public'].includes(x.schema)).length;
  const assessment={at:new Date().toISOString(),fullProjectRoundTripVerified:false,baseline:baseline,focusedEvidence:focused.at(-1),nativeServerVersion:f.native.serverVersion.trim(),originalAcl:aclMismatchSummary(checks,source),focusedAclChecked:f.native.afterAcl.length,focusedAclAllMatched:f.native.afterAcl.length===expectedChecks&&f.native.afterAcl.every(x=>x.matched),sourceBlocks:f.sourceBlocks,meaningDifferences:f.schemaDifferences.length,conservativeBlockComparison,extraPublicSchemaSerializationOnly:preservedSchemaOnly,qualificationOnly,qualificationDifferences:constraintDifferences?.length,boundarySettingsMatch:f.boundarySettingsMatch,m4MigrationRecoveryQualified:r.actualRestore&&r.rowCounts&&r.copyData&&r.sequences&&r.roles&&r.relationships&&Object.values(r.catalog).every(Boolean)&&f.catalog.tables&&f.native.afterAcl.length===expectedChecks&&f.native.afterAcl.every(x=>x.matched)&&f.schemaDifferences.length===0&&preservedSchemaOnly&&qualificationOnly&&conservativeBlockComparison&&f.boundarySettingsMatch};
  const {writeFile}=await import('node:fs/promises');
  const assessmentName='focused-assessment-'+Date.now();
  await encryptBytes(Buffer.from(JSON.stringify(assessment)),path.join(config.directory,assessmentName+'.aesgcm'),key);
  await writeFile(path.join(config.directory,assessmentName+'.status.json'),JSON.stringify(assessment,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify(assessment,null,2));
 }
 if(config.localRoot){
  stage='native';const result=await focusedNative(config,source,open,key,blocks);
  const targetBlocks=schemaBlocks(result.target);
  const scoped=blocks.filter(x=>/; Schema: (?:public|auth);/.test(x.header)||/^(?:public|auth); Type: SCHEMA;/.test(x.header)||/^SCHEMA (?:public|auth); Type: (?:ACL|COMMENT);/.test(x.header));
  const targetMap=new Map(targetBlocks.map(x=>[x.header,x]));
  const schemaDifferences=scoped.filter(x=>!targetMap.has(x.header)||blockMeaning(x)!==blockMeaning(targetMap.get(x.header))).map(x=>({header:x.header,missing:!targetMap.has(x.header),sourceSha256:sha(blockMeaning(x)),targetSha256:targetMap.has(x.header)?sha(blockMeaning(targetMap.get(x.header))):null}));
  const extra=targetBlocks.filter(x=>!scoped.some(y=>y.header===x.header)).map(x=>x.header);
  const cat={};for(const field of ['tables','constraints'])cat[field]=JSON.stringify(catalogRows(source[field].filter(x=>['auth','public'].includes(x.schema))))===JSON.stringify(catalogRows(result.inventory[field].filter(x=>['auth','public'].includes(x.schema))));
  const proof={at:new Date().toISOString(),native:result.summary,catalog:cat,schemaDifferences,extra,boundarySettingsMatch:JSON.stringify(boundarySettings(schema))===JSON.stringify(boundarySettings(result.target)),sourceBlocks:scoped.length,targetBlocks:targetBlocks.length};
  await encryptBytes(Buffer.from(JSON.stringify({...proof,targetInventory:result.inventory,privateSchemaDifferences:scoped.filter(x=>schemaDifferences.some(d=>d.header===x.header)).map(x=>({source:x,target:targetMap.get(x.header)}))})),path.join(config.directory,'focused-'+Date.now()+'-details.aesgcm'),key);
  console.log(JSON.stringify({at:proof.at,beforeMismatches:proof.native.beforeAcl.filter(x=>!x.matched),afterAllAclMatch:proof.native.afterAcl.every(x=>x.matched),catalog:proof.catalog,schemaDifferences:proof.schemaDifferences,extra:proof.extra,boundarySettingsMatch:proof.boundarySettingsMatch,sourceBlocks:scoped.length,targetBlocks:targetBlocks.length},null,2));
 }
 console.log(JSON.stringify({evidence:name,checked:checks.length,mismatches:checks.filter(x=>!x.matched).length,differences,archiveGraphqlSchemaGrantsPresent:graphql.some(x=>/^SCHEMA /.test(x.header)&&x.grants.length),savedSchemaHashes:fingerprints.schema,extensions:source.extensions},null,2));
}catch(e){console.log(JSON.stringify({failure:stage,code:['EPERM','ENOENT','EPIPE','SHORT_INPUT','INVALID_ARCHIVE','EOF','READ_FAILURE','SEEK_REQUIRED','OUTPUT_REQUIRED','NATIVE_READ_FAILED'].includes(e.code)?e.code:'NOT_EXPOSED'}));process.exitCode=1}finally{key?.fill(0)}
