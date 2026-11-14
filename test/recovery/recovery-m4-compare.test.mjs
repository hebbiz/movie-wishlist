// Authored SQL serialization fixtures only: never execute SQL or read a backup.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareM4, m4Contract, assertM4InputBinding} from '../../supabase/operations/recovery-m4-compare.mjs';
import {schemaBlocks} from '../../supabase/operations/recovery-schema-compare.mjs';
import {normalizeSchema, copyBlocks} from '../../supabase/operations/recovery-local.mjs';

const schema = 'media_advice_private';
const constraints = [
 ['permissions','permissions_pkey'], ['sessions','sessions_pkey'],
 ['sessions','sessions_user_id_form_session_key'], ['cleanup_health','cleanup_health_pkey'],
 ['user_regions','user_regions_pkey'], ['beta_config','beta_config_pkey'],
 ['pilot_access_users','pilot_access_users_pkey'], ['beta_feature_assignments','beta_feature_assignments_pkey']
];
const foreignKeys = ['permissions','sessions','user_regions','pilot_access_users','beta_feature_assignments']
 .map(table => [table, table + '_user_id_fkey']);
const comments = [
 ['TABLE permissions', schema], ['TABLE user_regions', schema], ['TABLE beta_config', schema],
 ['TABLE pilot_access_users', schema], ['COLUMN sessions.source_cap', schema],
 ['FUNCTION media_advice_beta_global_action(uuid, text, uuid, text, uuid, text)', 'public']
];

function block(name, type, scope, body, owner = 'postgres') {
 return {header: `${name}; Type: ${type}; Schema: ${scope}; Owner: ${owner}`, body};
}
function render(blocks) {
 return '-- PostgreSQL database dump\nSET default_tablespace = \'\';\nSET default_table_access_method = heap;\n' +
  blocks.map(b => `\n--\n-- Name: ${b.header}\n--\n\n${b.body.trim()}\n\n`).join('') +
  '\n--\n-- PostgreSQL database dump complete\n';
}
function copy(table, columns, rows) {
 return `COPY ${table} (${columns.join(', ')}) FROM stdin;\n${rows.length ? rows.join('\n') + '\n' : ''}\\.\n`;
}
function dataSql() {
 return m4Contract.tables.map(table => copy(`${schema}.${table}`, ['synthetic_value'], ['authored-private-row']))
  .join('\n') + '\n' + copy('supabase_migrations.schema_migrations', ['version','statements','name'],
   m4Contract.versions.map(version => `${version}\t{}\tsynthetic-migration`));
}
export function fixture() {
 const blocks = [
  block(schema, 'SCHEMA', '-', `CREATE SCHEMA ${schema};`),
  block(`SCHEMA ${schema}`, 'ACL', '-', `REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC;\nGRANT USAGE ON SCHEMA ${schema} TO service_role;`)
 ];
 for (const table of m4Contract.tables) {
  const body = table === 'sessions' ? `CREATE TABLE ${schema}.sessions (
    id uuid,
    group_id uuid,
    source_cap smallint DEFAULT 8 NOT NULL,
    attempts text[],
    CONSTRAINT media_advice_sessions_source_cap_check CHECK ((source_cap = ANY (ARRAY[8, 10, 12, 14]))),
    CONSTRAINT sessions_attempts_check CHECK ((cardinality(attempts) <= source_cap))
);` : `CREATE TABLE ${schema}.${table} (user_id uuid);`;
  blocks.push(block(table, 'TABLE', schema, body));
  blocks.push(block(`TABLE ${table}`, 'ACL', schema,
   `REVOKE ALL ON TABLE ${schema}.${table} FROM PUBLIC;\nGRANT SELECT ON TABLE ${schema}.${table} TO service_role;`));
  blocks.push(block(table, 'ROW SECURITY', schema, `ALTER TABLE ${schema}.${table} ENABLE ROW LEVEL SECURITY;`));
 }
 for (const [scope, signatures] of [[schema,m4Contract.privateFunctions], ['public',m4Contract.publicFunctions]]) {
  for (const signature of signatures) {
   blocks.push(block(signature, 'FUNCTION', scope,
    `CREATE FUNCTION ${scope}.${signature} RETURNS void LANGUAGE sql AS $_$SELECT NULL;$_$;`));
   blocks.push(block(`FUNCTION ${signature}`, 'ACL', scope,
    `REVOKE ALL ON FUNCTION ${scope}.${signature} FROM PUBLIC;` +
    (scope === 'public' ? `\nGRANT ALL ON FUNCTION public.${signature} TO service_role;` : '')));
  }
 }
 for (const [table,name] of constraints) {
  blocks.push(block(`${table} ${name}`, 'CONSTRAINT', schema,
   `ALTER TABLE ONLY ${schema}.${table} ADD CONSTRAINT ${name} PRIMARY KEY (user_id);`));
 }
 for (const [table,name] of foreignKeys) {
  blocks.push(block(`${table} ${name}`, 'FK CONSTRAINT', schema,
   `ALTER TABLE ONLY ${schema}.${table} ADD CONSTRAINT ${name} FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;`));
 }
 blocks.push(block('media_advice_sessions_user_created', 'INDEX', schema,
  `CREATE INDEX media_advice_sessions_user_created ON ${schema}.sessions USING btree (user_id, created_at);`));
 for (const [name,table,fn,timing,level,events,column] of m4Contract.triggers) {
  const eventText = events.map(event => event === 'UPDATE' && column ? `UPDATE OF ${column}` : event).join(' OR ');
  const [scope,tableName] = table.split('.');
  blocks.push(block(`${tableName} ${name}`, 'TRIGGER', scope,
   `CREATE TRIGGER ${name} ${timing} ${eventText} ON ${table} FOR EACH ${level} EXECUTE FUNCTION ${schema}.${fn}();`));
 }
 for (const [name,scope] of comments) {
  blocks.push(block(name, 'COMMENT', scope, `COMMENT ON ${name.replace(/^(TABLE|COLUMN|FUNCTION) /, `$1 ${scope}.`)} IS 'synthetic comment';`));
 }
 const sql = render(blocks), data = dataSql();
 return {
  sourceSchema: sql, targetSchema: sql, sourceData: data, targetData: data,
  aclRows: [{scope:'schemas',key:[schema],matched:true},
   ...m4Contract.tables.map(table => ({scope:'tables',key:[schema,table],matched:true}))],
  fullStatus: {actualRestore:true,verified:false}
 };
}
function changeSql(f, edit, both = false) {
 f.targetSchema = render(edit(schemaBlocks(f.targetSchema).map(b => ({...b}))));
 if (both) f.sourceSchema = f.targetSchema;
 return f;
}
function replaceBody(f, match, change, both = false) {
 return changeSql(f, blocks => blocks.map(b => match(b) ? {...b,body:change(b.body)} : b), both);
}
function refused(f) {
 try { assert.equal(compareM4(f).m4ArchivedReplayMatches, false); }
 catch (error) { assert.match(error.message, /^M4_|duplicate COPY|unterminated COPY|unsupported-acl-serialization/); }
}
const isType = (type, name) => b => b.header.startsWith(name + '; Type: ' + type + ';');

// Operator-wrapper tests may consume this authored fixture via a child process.
// This mode never reads a checkpoint and emits no real schema/data material.
if (process.argv[2] === '--fixture-json') {
 process.stdout.write(JSON.stringify(fixture()));
 process.exit(0);
}

test('synthetic fixture has all 79 expected SQL blocks; supplemental equality never promotes false full verification', () => {
 const f = fixture(), before = structuredClone(f.fullStatus);
 assert.equal(schemaBlocks(f.sourceSchema).length, 79);
 const result = compareM4(f);
 assert.equal(result.sourceBlocks, 79);
 assert.equal(result.targetBlocks, 79);
 assert.equal(result.m4ArchivedReplayMatches, true);
 assert.ok(Object.values(result.checks).every(v => v === true));
 assert.equal(result.fullVerifierVerified, false);
 assert.equal(result.wholeProjectRecoveryEstablished, false);
 assert.equal(result.independentFunctionColumnInitialAclAudit, false);
 assert.deepEqual(f.fullStatus, before);
 assert.equal(Object.hasOwn(result, 'verified'), false);
 const safe = JSON.stringify(result);
 for (const privateValue of ['authored-private-row','synthetic comment','CREATE FUNCTION','COPY media_advice_private']) {
  assert.equal(safe.includes(privateValue), false);
 }
});

test('true full status is reported without establishing whole-project recovery', () => {
 const f = fixture();
 f.fullStatus.verified = true;
 const result = compareM4(f);
 assert.equal(result.m4ArchivedReplayMatches, true);
 assert.equal(result.fullVerifierVerified, true);
 assert.equal(result.wholeProjectRecoveryEstablished, false);
});

test('unrelated schema differences do not conceal the unchanged failed full-verifier result', () => {
 const f = fixture();
 f.sourceSchema = render([...schemaBlocks(f.sourceSchema), block('unrelated', 'TABLE', 'public', 'CREATE TABLE public.unrelated (a text);')]);
 f.targetSchema = render([...schemaBlocks(f.targetSchema), block('unrelated', 'TABLE', 'public', 'CREATE TABLE public.unrelated (a integer);')]);
 const result = compareM4(f);
 assert.equal(result.m4ArchivedReplayMatches, true);
 assert.equal(result.fullVerifierVerified, false);
});

test('CRLF and ACL-statement order are serialization differences, not semantic changes', () => {
 const f = changeSql(fixture(), blocks => blocks.map(b => b.header.includes('; Type: ACL;') ?
  {...b,body:b.body.trim().split('\n').reverse().join('\n')} : b));
 f.targetSchema = f.targetSchema.replaceAll('\n','\r\n');
 assert.equal(compareM4(f).m4ArchivedReplayMatches, true);
});

test('named-argument FUNCTION, ACL and COMMENT headers retain exact supported function identities', () => {
 const named = 'media_advice_beta_global_action(p_user uuid, p_imdb text, p_form uuid, p_op text, p_session uuid, p_stage text)';
 const plain = 'media_advice_beta_global_action(uuid, text, uuid, text, uuid, text)';
 const f = changeSql(fixture(), blocks => blocks.map(b => ({...b,
  header:b.header.replaceAll(plain,named), body:b.body.replaceAll(plain,named)})), true);
 assert.equal(compareM4(f).m4ArchivedReplayMatches, true);
});

test('a changed function body, owner, or global SET fails archival equality', async t => {
 for (const kind of ['body','owner','setting']) await t.test(kind, () => {
  const f = fixture();
  if (kind === 'body') replaceBody(f, isType('FUNCTION','assert_pilot_access(uuid)'), body => body.replace('SELECT NULL','SELECT 1'));
  if (kind === 'owner') changeSql(f, blocks => blocks.map(b => isType('TABLE','sessions')(b) ? {...b,header:b.header.replace('Owner: postgres','Owner: other_owner')} : b));
  if (kind === 'setting') f.targetSchema = f.targetSchema.replace('SET default_table_access_method = heap;', 'SET default_table_access_method = other;');
  refused(f);
 });
});

test('symmetric omission of each required object class fails instead of comparing two incomplete inputs successfully', async t => {
 const representatives = [
  ['SCHEMA',schema], ['TABLE','permissions'], ['FUNCTION','assign_beta_feature(uuid)'],
  ['ACL','FUNCTION media_advice_cleanup()'], ['ROW SECURITY','user_regions'],
  ['CONSTRAINT','sessions sessions_user_id_form_session_key'],
  ['FK CONSTRAINT','permissions permissions_user_id_fkey'], ['INDEX','media_advice_sessions_user_created'],
  ['TRIGGER','users media_advice_set_default_region'], ['COMMENT','TABLE permissions'],
  ['COMMENT','COLUMN sessions.source_cap'], ['COMMENT','FUNCTION media_advice_beta_global_action(uuid, text, uuid, text, uuid, text)']
 ];
 for (const [type,name] of representatives) await t.test(`${type}: ${name}`, () => {
  const f = changeSql(fixture(), blocks => blocks.filter(b => !isType(type,name)(b)), true);
  refused(f);
 });
});

test('symmetric extra M4 objects and wrong overloads fail exact inventory', async t => {
 for (const extra of [
  block('extra_private()', 'FUNCTION', schema, `CREATE FUNCTION ${schema}.extra_private() RETURNS void LANGUAGE sql AS $_$SELECT NULL;$_$;`),
  block('sessions unexpected_constraint', 'CONSTRAINT', schema, 'ALTER TABLE ONLY media_advice_private.sessions ADD CONSTRAINT unexpected_constraint CHECK (true);'),
  block('TABLE cleanup_health', 'COMMENT', schema, "COMMENT ON TABLE media_advice_private.cleanup_health IS 'unexpected';")
 ]) await t.test(extra.header, () => refused(changeSql(fixture(), blocks => [...blocks,extra], true)));
 await t.test('same wrong function signature on both sides', () => {
  refused(changeSql(fixture(), blocks => blocks.map(b => ({...b,
   header:b.header.replaceAll('assign_beta_feature(uuid)', 'assign_beta_feature(text)'),
   body:b.body.replaceAll('assign_beta_feature(uuid)', 'assign_beta_feature(text)')})), true));
 });
});

test('exact duplicates and owner-alias duplicates are rejected, even symmetrically', async t => {
 for (const changedOwner of [false,true]) await t.test(changedOwner ? 'same object different owner' : 'identical header', () => {
  refused(changeSql(fixture(), blocks => {
   const duplicate = {...blocks.find(isType('TABLE','sessions'))};
   if (changedOwner) duplicate.header = duplicate.header.replace('Owner: postgres','Owner: other_owner');
   return [...blocks,duplicate];
  }, true));
 });
});

test('trigger timing, row/statement level, events, update column and bound function are independently required', async t => {
 const changes = [
  ['timing', body => body.replace('AFTER','BEFORE')],
  ['level', body => body.replace('FOR EACH ROW','FOR EACH STATEMENT')],
  ['events', body => body.replace('DELETE OR INSERT OR UPDATE OF region_code','INSERT OR UPDATE OF region_code')],
  ['column', body => body.replace('UPDATE OF region_code','UPDATE OF user_id')],
  ['binding', body => body.replace('assign_beta_feature_on_region()','set_default_user_region()')]
 ];
 for (const [name,change] of changes) await t.test(name, () => refused(replaceBody(fixture(),
  isType('TRIGGER','user_regions media_advice_assign_beta_feature_region'), change, true)));
});

test('legacy caps, default8, bounded attempts, nullable group and ENABLE RLS are explicit contracts', async t => {
 const changes = [
  ['default', body => body.replace('DEFAULT 8 NOT NULL','DEFAULT 14 NOT NULL')],
  ['cap set', body => body.replace('ARRAY[8, 10, 12, 14]','ARRAY[8, 10, 12]')],
  ['attempt bound', body => body.replace('cardinality(attempts) <= source_cap','cardinality(attempts) <= 100')],
  ['global nullable group', body => body.replace('group_id uuid,','group_id uuid NOT NULL,')]
 ];
 for (const [name,change] of changes) await t.test(name, () => refused(replaceBody(fixture(), isType('TABLE','sessions'), change, true)));
 await t.test('RLS disabled on both sides', () => refused(replaceBody(fixture(), isType('ROW SECURITY','permissions'),
  body => body.replace('ENABLE ROW LEVEL SECURITY','DISABLE ROW LEVEL SECURITY'), true)));
});

test('RPC ACLs reject client or unknown grants and missing service-only statements', async t => {
 for (const grantee of ['PUBLIC','anon','authenticated','unexpected_role']) await t.test(grantee, () => refused(replaceBody(fixture(),
  isType('ACL','FUNCTION media_advice_cleanup()'), body => body + `\nGRANT ALL ON FUNCTION public.media_advice_cleanup() TO ${grantee};`, true)));
 await t.test('PUBLIC revoke absent', () => refused(replaceBody(fixture(), isType('ACL','FUNCTION media_advice_cleanup()'),
  body => body.replace('REVOKE ALL ON FUNCTION public.media_advice_cleanup() FROM PUBLIC;',''), true)));
 await t.test('service grant absent', () => refused(replaceBody(fixture(), isType('ACL','FUNCTION media_advice_cleanup()'),
  body => body.replace('GRANT ALL ON FUNCTION public.media_advice_cleanup() TO service_role;',''), true)));
});

test('symmetric client or service ownership cannot be relabelled service-only RPC access', async t => {
 for (const owner of ['anon','authenticated','PUBLIC','service_role']) await t.test(owner, () => {
  const f = changeSql(fixture(), blocks => blocks.map(b =>
   (isType('FUNCTION','media_advice_cleanup()')(b) || isType('ACL','FUNCTION media_advice_cleanup()')(b)) ?
    {...b,header:b.header.replace('Owner: postgres','Owner: ' + owner)} : b), true);
  refused(f);
 });
});

test('native private ACL checks require each exact key once and matched true', async t => {
 const cases = {
  missing: rows => rows.filter(r => r.key[1] !== 'permissions'),
  duplicate: rows => [...rows.filter(r => r.key[1] !== 'permissions'), {...rows.find(r => r.key[1] === 'sessions')}],
  extra: rows => [...rows,{scope:'tables',key:[schema,'unexpected'],matched:true}],
  mismatch: rows => rows.map(r => r.key[1] === 'permissions' ? {...r,matched:false} : r),
  nonboolean: rows => rows.map(r => r.key[1] === 'permissions' ? {...r,matched:'true'} : r),
  schemaMismatch: rows => rows.map(r => r.scope === 'schemas' ? {...r,matched:false} : r),
  schemaMissing: rows => rows.filter(r => r.scope !== 'schemas')
 };
 for (const [name,change] of Object.entries(cases)) await t.test(name, () => {
  const f = fixture(); f.aclRows = change(f.aclRows); refused(f);
 });
});

test('COPY record ordering is ignored, while duplicates and column identity are preserved', async t => {
 const f = fixture();
 f.sourceData = f.sourceData.replace('authored-private-row\n', 'a\nb\na\n');
 f.targetData = f.targetData.replace('authored-private-row\n', 'b\na\na\n');
 assert.equal(compareM4(f).m4ArchivedReplayMatches, true);
 await t.test('duplicate lost', () => {
  const changed = {...f,targetData:f.targetData.replace('b\na\na\n','b\na\n')}; refused(changed);
 });
 await t.test('value changed', () => {
  const changed = fixture(); changed.targetData = changed.targetData.replace('authored-private-row','changed-private-row'); refused(changed);
 });
 await t.test('column header changed', () => {
  const changed = fixture(); changed.targetData = changed.targetData.replace('(synthetic_value)','(different_column)'); refused(changed);
 });
});

test('missing, extra, duplicated and unterminated COPY blocks fail closed', async t => {
 const cases = {
  missing: sql => sql.replace(copy(`${schema}.beta_config`,['synthetic_value'],['authored-private-row']),''),
  extra: sql => sql + copy(`${schema}.extra`,['value'],['synthetic']),
  duplicate: sql => sql + copy(`${schema}.sessions`,['synthetic_value'],['authored-private-row']),
  unterminated: sql => sql.slice(0,sql.lastIndexOf('\\.'))
 };
 for (const [name,change] of Object.entries(cases)) await t.test(name, () => {
  const f = fixture(); f.sourceData = change(f.sourceData); f.targetData = f.sourceData; refused(f);
 });
});

test('migration history checks named version column, whole payload and each required version exactly once', async t => {
 await t.test('version is not first column', () => {
  const f = fixture();
  const reordered = copy('supabase_migrations.schema_migrations',['statements','version','name'],
   m4Contract.versions.map(version => `{}\t${version}\tsynthetic-migration`));
  f.sourceData = f.sourceData.slice(0,f.sourceData.indexOf('COPY supabase_migrations.')) + reordered;
  f.targetData = f.sourceData;
  assert.equal(compareM4(f).m4ArchivedReplayMatches, true);
 });
 for (const kind of ['missing version','duplicate version','missing version column','changed non-version value']) await t.test(kind, () => {
  const f = fixture(), first = m4Contract.versions[0];
  if (kind === 'missing version') f.sourceData = f.sourceData.replace(`${first}\t{}\tsynthetic-migration\n`,'');
  if (kind === 'duplicate version') f.sourceData = f.sourceData.replace(`${first}\t{}\tsynthetic-migration\n`,`${first}\t{}\tsynthetic-migration\n${first}\t{}\tsynthetic-migration\n`);
  if (kind === 'missing version column') f.sourceData = f.sourceData.replace('(version, statements, name)','(other_column, statements, name)');
  if (kind !== 'changed non-version value') f.targetData = f.sourceData;
  else f.targetData = f.targetData.replace('synthetic-migration','changed-migration');
  refused(f);
 });
});

test('missing or untrusted full-verifier status cannot be silently replaced by a synthetic PASS', async t => {
 for (const status of [undefined,{}, {verified:false}, {actualRestore:false,verified:false}, {actualRestore:true,verified:'false'}]) {
  await t.test(JSON.stringify(status) ?? 'undefined', () => {
   const f = fixture(); f.fullStatus = status;
   assert.throws(() => compareM4(f), /M4_FULL_STATUS_REQUIRED/);
  });
 }
});

function bindingFixture() {
 const f = fixture(), at = '2000-01-01T00:00:00.000Z';
 const unrelated = copy('public.unrelated', ['value'], ['whole-dump-binding-sentinel']);
 const input = {
  'source-schema.sql':f.sourceSchema, 'target-schema.sql':f.targetSchema,
  'source-data.sql':f.sourceData + unrelated, 'target-data.sql':f.targetData + unrelated,
  'acl-comparison.jsonl':f.aclRows.map(row => JSON.stringify(row)).join('\n') + '\n'
 };
 const fullStatus = {...f.fullStatus,at};
 const fullProof = {at,schema:{},copyBlocks:{}};
 for (const side of ['source','target']) {
  fullProof.schema[side] = createHash('sha256').update(normalizeSchema(input[side + '-schema.sql'])).digest('hex');
  fullProof.copyBlocks[side] = [...copyBlocks(input[side + '-data.sql'])];
 }
 return {input,fullStatus,fullProof,details:{'acl-comparison.jsonl':input['acl-comparison.jsonl']}};
}

test('input binding accepts only the full-verifier recorded SQL/COPY/ACL inputs, without changing verified false', () => {
 const f = bindingFixture(), before = structuredClone(f);
 assert.doesNotThrow(() => assertM4InputBinding(f.input,f.fullStatus,f.fullProof,f.details));
 assert.deepEqual(f,before);
 assert.equal(f.fullStatus.verified,false);
});

test('input binding rejects changed source/target SQL and data, including symmetric replacement and unrelated data', async t => {
 for (const [name,sides,kind] of [
  ['source schema',['source'],'schema'], ['target schema',['target'],'schema'],
  ['symmetric schema',['source','target'],'schema'], ['source data',['source'],'data'],
  ['target data',['target'],'data'], ['symmetric data',['source','target'],'data'],
  ['non-M4 target data',['target'],'unrelated data']
 ]) await t.test(name, () => {
  const f = bindingFixture();
  for (const side of sides) {
   const filename = side + (kind === 'schema' ? '-schema.sql' : '-data.sql');
   f.input[filename] = kind === 'schema' ? f.input[filename].replace('SELECT NULL','SELECT 42') :
    kind === 'data' ? f.input[filename].replace('authored-private-row','changed-private-row') :
     f.input[filename].replace('whole-dump-binding-sentinel','changed-non-M4-row');
  }
  assert.throws(() => assertM4InputBinding(f.input,f.fullStatus,f.fullProof,f.details), /M4_INPUT_BINDING/);
 });
});

test('input binding rejects missing fingerprints, ACL evidence and timestamp mismatches', async t => {
 const cases = {
  schemaFingerprint: f => {delete f.fullProof.schema.source;},
  schemaFingerprints: f => {delete f.fullProof.schema;},
  copyFingerprint: f => {delete f.fullProof.copyBlocks.target;},
  copyFingerprints: f => {delete f.fullProof.copyBlocks;},
  copySubset: f => {f.fullProof.copyBlocks.source.pop();},
  copyDuplicate: f => {f.fullProof.copyBlocks.source.push(f.fullProof.copyBlocks.source[0]);},
  changedAcl: f => {f.input['acl-comparison.jsonl'] = f.input['acl-comparison.jsonl'].replace('"matched":true','"matched":false');},
  missingDetails: f => {f.details = undefined;},
  missingAclBoth: f => {delete f.input['acl-comparison.jsonl']; delete f.details['acl-comparison.jsonl'];},
  timestamp: f => {f.fullProof.at = '2000-01-02T00:00:00.000Z';},
  missingTimestamp: f => {delete f.fullStatus.at;},
  missingProofTimestamp: f => {delete f.fullProof.at;}
 };
 for (const [name,change] of Object.entries(cases)) await t.test(name, () => {
  const f = bindingFixture(); change(f);
  assert.throws(() => assertM4InputBinding(f.input,f.fullStatus,f.fullProof,f.details), /M4_INPUT_BINDING/);
 });
});
