import test from 'node:test';
import assert from 'node:assert/strict';
import {copyBlocks,normalizeSchema,normalizeAcl} from '../supabase/operations/recovery-local.mjs';
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
