import test from 'node:test';
import assert from 'node:assert/strict';
import {copyBlocks,normalizeSchema,normalizeAcl,aclMismatchSummary} from '../supabase/operations/recovery-local.mjs';
import {graphqlAclSupplement} from '../supabase/operations/recovery-schema-supplement.mjs';
import {schemaBlocks,blockMeaning,boundarySettings,catalogRows} from '../supabase/operations/recovery-schema-compare.mjs';
import {nativeAclChecks} from '../supabase/operations/recovery-acl-checks.mjs';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
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
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('../supabase/operations/recovery-vm.mjs',import.meta.url)),root,'software-console'],{windowsHide:true,encoding:'utf8'});
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
