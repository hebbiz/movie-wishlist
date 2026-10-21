import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encryptBytes, decryptSmallArtifact, verifyArtifact } from '../supabase/operations/recovery-archive.mjs';
test('authored encrypted archive roundtrip, nonce uniqueness, tamper and wrong-key refusal', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'mw-archive-authored-'));
  try {
    const key=randomBytes(32), bytes=Buffer.from('AUTHORED DATA ONLY'), a=path.join(root,'a'), b=path.join(root,'b');
    await encryptBytes(bytes,a,key); await encryptBytes(bytes,b,key);
    assert.deepEqual(await decryptSmallArtifact(a,key),bytes);
    assert.equal(await verifyArtifact(a,key),bytes.length);
    const first=await readFile(a), second=await readFile(b);
    assert(!first.includes(bytes)); assert.notDeepEqual(first,second);
    await assert.rejects(verifyArtifact(a,randomBytes(32)));
    first[21]^=1; await writeFile(a,first); await assert.rejects(verifyArtifact(a,key));
    await assert.rejects(encryptBytes(bytes,b,key));
    assert.equal((await readFile(b)).length,bytes.length+36);
  } finally { await rm(root,{recursive:true,force:true}); }
});
