// Public software only, before any real-data decryption. No account credentials.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
const root=process.argv[2];
if(!root) throw new Error('private assets directory required');
await mkdir(root,{recursive:true});
const assets=[];
async function get(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(600000)});
  if(!response.ok) throw new Error('software download HTTP '+response.status);
  return response;
}
async function download(url,name,algorithm,expected,options={}) {
  const response=await get(url,options);
  const hash=createHash(algorithm);
  let bytes=0;
  await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_,done){bytes+=chunk.length;hash.update(chunk);done(null,chunk)}}),createWriteStream(path.join(root,name),{flags:'wx'}));
  const digest=hash.digest('hex');
  if(expected&&digest!==expected.toLowerCase()) throw new Error('software checksum mismatch');
  assets.push({name,url,bytes,algorithm,digest});
  console.log('SOFTWARE_DOWNLOADED '+name);
}
const qemu='qemu-w64-setup-20260811';
const sums=await (await get('https://qemu.weilnetz.de/w64/'+qemu+'.sha512')).text();
await download('https://qemu.weilnetz.de/w64/'+qemu+'.exe',qemu+'.exe','sha512',sums.match(/\b[0-9a-fA-F]{128}\b/)[0]);
const yaml=await (await get('https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/x86_64/latest-releases.yaml')).text();
const iso=yaml.match(/(?:file|iso): (alpine-virt-[0-9.]+-x86_64\.iso)/)?.[1];
if(!iso) throw new Error('official Alpine virt ISO not identified');
const isoUrl='https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/x86_64/'+iso;
const isoHash=(await (await get(isoUrl+'.sha256')).text()).match(/\b[a-fA-F0-9]{64}\b/)[0];
await download(isoUrl,iso,'sha256',isoHash);
const token=(await (await get('https://auth.docker.io/token?service=registry.docker.io&scope=repository:supabase/postgres:pull')).json()).token;
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'};
const manifestDigest='sha256:e884cde9f5594ddb30ebec888bd236d128eaf9c9b48cc864d8fa3d27a6c6c6bc';
const manifestBytes=Buffer.from(await (await get('https://registry-1.docker.io/v2/supabase/postgres/manifests/'+manifestDigest,{headers})).arrayBuffer());
if('sha256:'+createHash('sha256').update(manifestBytes).digest('hex')!==manifestDigest) throw new Error('image manifest digest mismatch');
const manifest=JSON.parse(manifestBytes);
const size=manifest.layers.reduce((n,l)=>n+l.size,0);
if(size>2*1024**3) throw new Error('image exceeds bounded compressed download size');
await writeFile(path.join(root,'supabase-manifest.json'),manifestBytes,{flag:'wx'});
const layers=[];
for(const [index,layer] of manifest.layers.entries()) {
  if(!layer.mediaType.includes('gzip')&&!layer.mediaType.includes('tar')) throw new Error('unsupported layer encoding');
  const name='layer-'+String(index).padStart(2,'0')+'.tar.gz';
  await download('https://registry-1.docker.io/v2/supabase/postgres/blobs/'+layer.digest,name,'sha256',layer.digest.slice(7),{headers});
  layers.push(name);
}
await writeFile(path.join(root,'assets.json'),JSON.stringify({qemu:qemu+'.exe',iso,image:'supabase/postgres:17.6.1.054',manifestDigest,layers,assets},null,2),{flag:'wx'});
console.log('SOFTWARE_ASSETS_READY');
