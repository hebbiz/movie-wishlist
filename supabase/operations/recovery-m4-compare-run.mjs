// Only recovery-m4-compare.ps1 supplies the same-profile key, over stdin.
// Safe aggregate stdout; SQL, data fingerprints and input hashes stay encrypted.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {compareM4,assertM4InputBinding} from './recovery-m4-compare.mjs';
import {encryptBytes,verifyArtifact,decryptSmallArtifact} from './recovery-archive.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
let key;
try {
 const chunks=[];for await(const c of process.stdin)chunks.push(c);
 const config=JSON.parse(Buffer.concat(chunks).toString());key=Buffer.from(config.keyBase64,'base64');delete config.keyBase64;
 if(key.length!==32 || process.platform!=='win32')throw new Error('refused');
 if(!/^checkpoint-\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(config.checkpoint)
  || !/^restore-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.status\.json$/.test(config.fullStatusName)
  || !/^[a-f0-9]{64}$/.test(config.fullStatusSha256))throw new Error('refused');
 const expectedDirectory=path.join(process.env.LOCALAPPDATA,'MovieWishlist/Recovery/mttkectgdqqmejpenkrn',config.checkpoint);
 if(path.resolve(config.directory)!==path.resolve(expectedDirectory))throw new Error('refused');
 const preflight=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('recovery-vm-preflight.ps1',import.meta.url)),'-VmRoot',config.root],{windowsHide:true,encoding:'utf8',timeout:120000});
 if(preflight.status!==0||preflight.stdout.trim()!=='PRIVATE_STOPPED_VM_ROOT_VERIFIED')throw new Error('refused');
 const fullPath=path.join(config.directory,config.fullStatusName),fullBytes=await readFile(fullPath);
 if(sha(fullBytes)!==config.fullStatusSha256)throw new Error('refused');
 const fullStatus=JSON.parse(fullBytes);
 const comparisonPath=fullPath.replace('.status.json','-comparisons.aesgcm');
 await verifyArtifact(comparisonPath,key);
 const proofBytes=await decryptSmallArtifact(comparisonPath,key), fullProof=JSON.parse(proofBytes.toString());proofBytes.fill(0);
 const detailsPath=fullPath.replace('.status.json','-details.aesgcm');
 await verifyArtifact(detailsPath,key);
 const detailsBytes=await decryptSmallArtifact(detailsPath,key),details=JSON.parse(detailsBytes.toString());detailsBytes.fill(0);
 const latest=JSON.parse(await readFile(path.join(config.root,'latest-restore.json'),'utf8'));
 if(!/^attempt-restore-\d+$/.test(latest.share))throw new Error('refused');
 const attempt=path.join(config.root,latest.share);
 const names=['source-schema.sql','target-schema.sql','source-data.sql','target-data.sql','acl-comparison.jsonl'];
 const input={};for(const n of names)input[n]=await readFile(path.join(attempt,n),'utf8');
 // Bind all four plaintext inputs to the authenticated full verifier's actual
 // source/target fingerprints, not merely filenames in a disposable directory.
 assertM4InputBinding(input,fullStatus,fullProof,details);
 const result=compareM4({sourceSchema:input['source-schema.sql'],targetSchema:input['target-schema.sql'],
  sourceData:input['source-data.sql'],targetData:input['target-data.sql'],
  aclRows:input['acl-comparison.jsonl'].split(/\r?\n/).filter(x=>x.startsWith('{')).map(JSON.parse),fullStatus});
 const at=new Date().toISOString(),stem='m4-replay-'+at.replaceAll(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
 const status={at,checkpoint:config.checkpoint,...result};
 // Detailed proof includes exact inputs for future OFFLINE replay, not another
 // plaintext data archive. It can be large and remains checkpoint-private;
 // never publish/share its inputs or upload this evidence.
 const bytes=Buffer.from(JSON.stringify({status,fullStatusName:config.fullStatusName,fullStatusSha256:config.fullStatusSha256,
  inputHashes:Object.fromEntries(names.map(n=>[n,sha(input[n])])),input,fullStatus,fullProof}));
 // Keep the resulting cipher inside the existing bounded decrypt reader.
 if(bytes.length>32*1024*1024-36){bytes.fill(0);throw new Error('replay evidence too large')}
 const cipher=path.join(config.directory,stem+'.aesgcm');
 try{await encryptBytes(bytes,cipher,key);await verifyArtifact(cipher,key)}finally{bytes.fill(0)}
 await writeFile(path.join(config.directory,stem+'.status.json'),JSON.stringify(status,null,2),{flag:'wx',mode:0o600});
 // Supplemental exit0 means only M4 fidelity passed; full false remains false.
 console.log(JSON.stringify(status));if(!result.m4ArchivedReplayMatches)process.exitCode=1;
}catch{console.log('OFFLINE_M4_COMPARISON_REFUSED_OR_FAILED');process.exitCode=1}finally{key?.fill(0)}
