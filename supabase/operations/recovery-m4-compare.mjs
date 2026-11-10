// Offline supplemental archive fidelity comparison; never executes SQL.
// This is deliberately NOT part of recovery-local's full verifier.
import {copyBlocks} from './recovery-local.mjs';
import {schemaBlocks, blockMeaning, boundarySettings} from './recovery-schema-compare.mjs';
import {normalizeSchema} from './recovery-local.mjs';
import {createHash} from 'node:crypto';

export const m4Contract = Object.freeze({
 tables: ['beta_config','beta_feature_assignments','cleanup_health','permissions','pilot_access_users','sessions','user_regions'],
 privateFunctions: ['set_default_user_region()','assert_beta_access(uuid, uuid, text, uuid)','lock_beta_feature_assignment()',
  'detach_beta_feature_assignment()','assign_beta_feature(uuid)','sync_beta_feature_region(uuid)',
  'assign_beta_feature_on_region()','assign_beta_feature_on_activation()','assert_beta_feature_access(uuid)','assert_pilot_access(uuid)'],
 publicFunctions: ['media_advice_action(uuid, uuid, text, uuid, uuid, text, uuid, text)',
  'media_advice_beta_action(uuid, uuid, text, uuid, uuid, text, uuid, text)',
  'media_advice_beta_global_action(uuid, text, uuid, text, uuid, text)','media_advice_cleanup()'],
 constraints: ['beta_config beta_config_pkey','beta_feature_assignments beta_feature_assignments_pkey',
  'cleanup_health cleanup_health_pkey','permissions permissions_pkey','pilot_access_users pilot_access_users_pkey',
  'sessions sessions_pkey','sessions sessions_user_id_form_session_key','user_regions user_regions_pkey'],
 foreignKeys: ['permissions permissions_user_id_fkey','sessions sessions_user_id_fkey','user_regions user_regions_user_id_fkey',
  'pilot_access_users pilot_access_users_user_id_fkey','beta_feature_assignments beta_feature_assignments_user_id_fkey'],
 // name, table, target function, timing, level, event-set, UPDATE column (if any)
 triggers: [
  ['media_advice_set_default_region','auth.users','set_default_user_region','AFTER','ROW',['INSERT'],null],
  ['media_advice_lock_beta_feature_user_delete','auth.users','lock_beta_feature_assignment','BEFORE','STATEMENT',['DELETE'],null],
  ['media_advice_lock_beta_feature_region','media_advice_private.user_regions','lock_beta_feature_assignment','BEFORE','STATEMENT',['DELETE','INSERT','UPDATE'],null],
  ['media_advice_assign_beta_feature_region','media_advice_private.user_regions','assign_beta_feature_on_region','AFTER','ROW',['DELETE','INSERT','UPDATE'],'region_code'],
  ['media_advice_lock_beta_feature_activation','media_advice_private.beta_config','lock_beta_feature_assignment','BEFORE','STATEMENT',['DELETE','INSERT','UPDATE'],null],
  ['media_advice_assign_beta_feature_activation','media_advice_private.beta_config','assign_beta_feature_on_activation','AFTER','ROW',['INSERT','UPDATE'],'enabled'],
  ['media_advice_lock_beta_feature_permission','media_advice_private.permissions','lock_beta_feature_assignment','BEFORE','STATEMENT',['DELETE','INSERT','UPDATE'],null],
  ['media_advice_detach_beta_feature_assignment','media_advice_private.permissions','detach_beta_feature_assignment','BEFORE','ROW',['DELETE','UPDATE'],null]
 ],
 versions: ['20261020205122','20261021072002','20261031135149','20261101180436','20261102181617','20261104210025','20261108185237']
});
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a,b) => equal([...a].sort(), [...b].sort());
const privateSchema = 'media_advice_private';
// pg_dump FUNCTION definition headers use types; ACL/COMMENT spellings may
// include argument names. Accept only this contract's simple UUID/text types.
function signature(s) {
 return s.replace(/\(([^()]*)\)$/,(_,args)=>'('+args.split(',').filter(x=>x.trim()).map(arg=>{
  const tokens=arg.trim().split(/\s+/);
  if(tokens.length>2 || !['uuid','text'].includes(tokens.at(-1))) throw new Error('M4_SIGNATURE');
  return tokens.at(-1);
 }).join(', ')+')');
}
function objectName(b) {
 if(b.type==='FUNCTION') return signature(b.name);
 if(['ACL','COMMENT'].includes(b.type)&&b.name.startsWith('FUNCTION ')) return 'FUNCTION '+signature(b.name.slice(9));
 return b.name;
}
function identity(b) {return [b.schema,b.type,objectName(b)].join('|')}
function expectedIdentities() {
 const id=(schema,type,name)=>[schema,type,name].join('|');
 return [id('-','SCHEMA',privateSchema),id('-','ACL','SCHEMA '+privateSchema),
  ...m4Contract.tables.flatMap(t=>['TABLE','ROW SECURITY'].map(type=>id(privateSchema,type,t)).concat(id(privateSchema,'ACL','TABLE '+t))),
  ...m4Contract.privateFunctions.flatMap(f=>[id(privateSchema,'FUNCTION',f),id(privateSchema,'ACL','FUNCTION '+f)]),
  ...m4Contract.publicFunctions.flatMap(f=>[id('public','FUNCTION',f),id('public','ACL','FUNCTION '+f)]),
  ...m4Contract.constraints.map(n=>id(privateSchema,'CONSTRAINT',n)),
  ...m4Contract.foreignKeys.map(n=>id(privateSchema,'FK CONSTRAINT',n)),
  id(privateSchema,'INDEX','media_advice_sessions_user_created'),
  ...['permissions','user_regions','beta_config','pilot_access_users'].map(n=>id(privateSchema,'COMMENT','TABLE '+n)),
  id(privateSchema,'COMMENT','COLUMN sessions.source_cap'),
  id('public','COMMENT','FUNCTION '+m4Contract.publicFunctions[2]),
  ...m4Contract.triggers.map(([n,table])=>id(table.split('.')[0],'TRIGGER',table.split('.')[1]+' '+n))];
}
function blocks(sql) {
 const parsed = schemaBlocks(sql).map(b => {
  const m=b.header.match(/^(.*); Type: ([^;]+); Schema: ([^;]+); Owner: (.*)$/);
  if(!m) throw new Error('M4_SCHEMA_HEADER');
  return {...b, name:m[1],type:m[2],schema:m[3],owner:m[4]};
 });
 if(!parsed.length || new Set(parsed.filter(selected).map(identity)).size!==parsed.filter(selected).length) throw new Error('M4_SCHEMA_DUPLICATE_OR_EMPTY');
 return parsed;
}
function selected(b) {
 return b.schema===privateSchema || (b.type==='SCHEMA' && b.name===privateSchema)
  || b.name.includes('media_advice_') || /\bmedia_advice_private\./.test(b.body);
}
function triggerMatches(b, [name,table,fn,timing,level,events,column]) {
 const m=blockMeaning(b).match(/^CREATE TRIGGER (\w+) (BEFORE|AFTER) (.+?) ON ([\w.]+) FOR EACH (ROW|STATEMENT) EXECUTE FUNCTION ([\w.]+)\(\);$/m);
 if(!m || m[1]!==name || m[2]!==timing || m[4]!==table || m[5]!==level || m[6]!==privateSchema+'.'+fn) return false;
 const clauses=m[3].split(' OR '), update=clauses.find(x=>x.startsWith('UPDATE'));
 return sameSet(clauses.map(x=>x.split(' ')[0]),events) && (update ?? '')===(events.includes('UPDATE')?'UPDATE'+(column?' OF '+column:''):'');
}
function requiredStructure(all) {
 const own=all.filter(selected);
 return sameSet(own.map(identity),expectedIdentities())
  && m4Contract.triggers.every(t=>own.filter(b=>b.type==='TRIGGER'&&triggerMatches(b,t)).length===1);
}
function ledgerAndRls(all) {
 const table=all.find(b=>b.name==='sessions'&&b.type==='TABLE'&&b.schema===privateSchema);
 const sql=table ? blockMeaning(table) : '';
 return /\bsource_cap smallint DEFAULT 8 NOT NULL\b/.test(sql)
  && /\bARRAY\[8, 10, 12, 14\]/.test(sql) && /cardinality\(attempts\) <= source_cap/.test(sql)
  && /\bgroup_id uuid,/.test(sql) && !/\bgroup_id uuid NOT NULL\b/.test(sql)
  && m4Contract.tables.every(t=>all.filter(b=>b.type==='ROW SECURITY'&&b.schema===privateSchema&&b.name===t
   && blockMeaning(b)===`ALTER TABLE ${privateSchema}.${t} ENABLE ROW LEVEL SECURITY;`).length===1);
}
function rpcAcl(all) {
 return m4Contract.publicFunctions.every(fn=>{
  const a=all.filter(b=>b.type==='ACL'&&b.schema==='public'&&objectName(b)==='FUNCTION '+fn);
  if(a.length!==1 || !['postgres','supabase_admin'].includes(a[0].owner)) return false;
  const lines=blockMeaning(a[0]).split('\n');
  const parsed=lines.map(line=>line.match(/^(REVOKE|GRANT) ALL ON FUNCTION public\.(.+) (FROM|TO) ([a-z_]+|PUBLIC);$/));
  return parsed.every(m=>m&&signature(m[2])===fn&&m[3]===(m[1]==='GRANT'?'TO':'FROM')
    && (m[1]==='GRANT'?['service_role',a[0].owner].includes(m[4]):['PUBLIC',a[0].owner].includes(m[4])))
   && parsed.some(m=>m?.[1]==='REVOKE'&&m[4]==='PUBLIC')
   && parsed.some(m=>m?.[1]==='GRANT'&&m[4]==='service_role');
 });
}
function privateCopies(sql) {
 const all=copyBlocks(sql);
 const entries=[...all].filter(([h])=>/^COPY media_advice_private\./.test(h));
 const names=entries.map(([h])=>h.match(/^COPY media_advice_private\.(\w+) \(/)?.[1]);
 if(!sameSet(names,m4Contract.tables)) throw new Error('M4_COPY_INVENTORY');
 return {all,entries};
}
function history(sql, all) {
 const keys=[...all.keys()].filter(h=>/^COPY supabase_migrations\.schema_migrations /.test(h));
 if(keys.length!==1) throw new Error('M4_HISTORY_INVENTORY');
 const key=keys[0];
 const columns=key.match(/\(([^)]+)\) FROM stdin;$/)?.[1].split(', ');
 const versionIndex=columns?.indexOf('version');
 if(versionIndex===undefined || versionIndex<0) throw new Error('M4_HISTORY_COLUMNS');
 const lines=sql.replaceAll('\r\n','\n').split('\n');
 const start=lines.indexOf(key), end=lines.indexOf('\\.',start+1);
 if(start<0||end<0) throw new Error('M4_HISTORY_TERMINATOR');
 const versions=lines.slice(start+1,end).map(x=>x.split('\t')[versionIndex]);
 return {key,fingerprint:all.get(key),versionsOnce:m4Contract.versions.every(v=>versions.filter(x=>x===v).length===1)};
}
// Input schemas/data must be the authenticated source archive and its actual
// isolated target redumps. Equality is fidelity, not an independent ACL audit.
export function compareM4({sourceSchema,targetSchema,sourceData,targetData,aclRows,fullStatus}) {
 if(!fullStatus || typeof fullStatus.verified!=='boolean' || fullStatus.actualRestore!==true) throw new Error('M4_FULL_STATUS_REQUIRED');
 if(!Array.isArray(aclRows)) throw new Error('M4_ACL_INPUT');
 const a=blocks(sourceSchema), b=blocks(targetSchema), x=a.filter(selected), y=b.filter(selected);
 const bm=new Map(y.map(t=>[t.header,blockMeaning(t)]));
 const sa=privateCopies(sourceData),ta=privateCopies(targetData);
 const sh=history(sourceData,sa.all),th=history(targetData,ta.all);
 const native=aclRows.filter(r=>r.scope==='tables'&&r.key?.[0]===privateSchema);
 const checks={
  requiredObjectIdentities:requiredStructure(a)&&requiredStructure(b),
  selectedBlocksEqual:x.length>0&&x.length===y.length&&x.every(t=>bm.get(t.header)===blockMeaning(t)),
  boundarySettingsEqual:equal(boundarySettings(sourceSchema),boundarySettings(targetSchema)),
  ledgerAndRls:ledgerAndRls(a)&&ledgerAndRls(b),
  serviceOnlyRpcAcl:rpcAcl(a)&&rpcAcl(b),
  privateTablePayloadsEqual:equal(sa.entries.sort(),ta.entries.sort()),
  migrationHistoryEqual:sh.key===th.key&&sh.fingerprint===th.fingerprint,
  sevenMigrationVersionsOnce:sh.versionsOnce&&th.versionsOnce,
  nativePrivateTableAcl:sameSet(native.map(r=>r.key?.length===2?r.key[1]:null),m4Contract.tables)&&native.every(r=>r.matched===true),
  nativePrivateSchemaAcl:aclRows.filter(r=>r.scope==='schemas'&&r.key?.[0]===privateSchema).length===1
   && aclRows.some(r=>r.scope==='schemas'&&r.key?.length===1&&r.key[0]===privateSchema&&r.matched===true)
 };
 return {kind:'m4-archived-replay-comparison',contract:'global-access-20261108185237',
  sourceBlocks:x.length,targetBlocks:y.length,checks,m4ArchivedReplayMatches:Object.values(checks).every(v=>v===true),
  fullVerifierVerified:fullStatus.verified,wholeProjectRecoveryEstablished:false,
  independentFunctionColumnInitialAclAudit:false};
}
// The runner authenticates/decrypts fullProof and details before calling this.
// Full dump inputs may not be replaced with a fixture, subset or current code.
export function assertM4InputBinding(input,fullStatus,fullProof,details) {
 if(fullProof?.at!==fullStatus?.at || typeof fullStatus?.at!=='string'
  || typeof input['acl-comparison.jsonl']!=='string' || !input['acl-comparison.jsonl'].trim()
  || input['acl-comparison.jsonl']!==details?.['acl-comparison.jsonl'])throw new Error('M4_INPUT_BINDING');
 for(const side of ['source','target']){
  const hash=createHash('sha256').update(normalizeSchema(input[side+'-schema.sql'])).digest('hex');
  const actual=[...copyBlocks(input[side+'-data.sql'])].sort(),recorded=fullProof.copyBlocks?.[side];
  if(hash!==fullProof.schema?.[side] || !Array.isArray(recorded) || !equal(actual,[...recorded].sort()))throw new Error('M4_INPUT_BINDING');
 }
}
