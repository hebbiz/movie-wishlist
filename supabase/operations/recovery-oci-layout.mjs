// Public OCI software preparation only. Does not read/decrypt the backup.
import { mkdir, readFile, writeFile, link } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
const root=process.argv[2], assets=path.join(root,'assets'), shared=path.join(root,'share');
await mkdir(path.join(shared,'oci/blobs/sha256'),{recursive:true});
async function writeSameOrNew(file,bytes){try{await writeFile(file,bytes,{flag:'wx'})}catch(e){if(e.code!=='EEXIST'||!(await readFile(file)).equals(Buffer.from(bytes)))throw e}}
const manifestBytes=await readFile(path.join(assets,'supabase-manifest.json'));
const manifest=JSON.parse(manifestBytes);
const digest=createHash('sha256').update(manifestBytes).digest('hex');
const token=(await (await fetch('https://auth.docker.io/token?service=registry.docker.io&scope=repository:supabase/postgres:pull')).json()).token;
const response=await fetch('https://registry-1.docker.io/v2/supabase/postgres/blobs/'+manifest.config.digest,{headers:{Authorization:'Bearer '+token}});
if(!response.ok)throw new Error('public image config fetch failed');
const config=Buffer.from(await response.arrayBuffer());
if('sha256:'+createHash('sha256').update(config).digest('hex')!==manifest.config.digest)throw new Error('config digest mismatch');
await writeSameOrNew(path.join(shared,'oci/blobs/sha256',manifest.config.digest.slice(7)),config);
await writeSameOrNew(path.join(shared,'oci/blobs/sha256',digest),manifestBytes);
for(const [i,layer]of manifest.layers.entries()){
 const destination=path.join(shared,'oci/blobs/sha256',layer.digest.slice(7));
 try{await link(path.join(assets,'layer-'+String(i).padStart(2,'0')+'.tar.gz'),destination)}
 catch(e){if(e.code!=='EEXIST')throw e;const hash=createHash('sha256');for await(const chunk of createReadStream(destination))hash.update(chunk);if('sha256:'+hash.digest('hex')!==layer.digest)throw new Error('existing blob digest mismatch')}
}
await writeSameOrNew(path.join(shared,'oci/oci-layout'),JSON.stringify({imageLayoutVersion:'1.0.0'}));
await writeSameOrNew(path.join(shared,'oci/index.json'),JSON.stringify({schemaVersion:2,manifests:[{mediaType:manifest.mediaType,digest:'sha256:'+digest,size:manifestBytes.length,annotations:{'org.opencontainers.image.ref.name':'recovery'}}]}));
const release=await (await fetch('https://api.github.com/repos/opencontainers/umoci/releases/tags/v0.6.0')).json();
const binary=release.assets.find(a=>a.name==='umoci.linux.amd64');
const bytes=Buffer.from(await (await fetch(binary.browser_download_url)).arrayBuffer());
if('sha256:'+createHash('sha256').update(bytes).digest('hex')!==binary.digest)throw new Error('umoci checksum mismatch');
await writeSameOrNew(path.join(shared,'umoci'),bytes);
await writeSameOrNew(path.join(assets,'oci-preparation.json'),JSON.stringify({manifest:'sha256:'+digest,config:manifest.config.digest,umoci:binary.digest}));
console.log('OCI_LAYOUT_AND_UNPACKER_VERIFIED');
