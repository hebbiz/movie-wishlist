// Official client software only; aligns schema-dump generator with backup17.11.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.argv[2],base='https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-17/';
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('official client download unavailable');return r;}
const listing=await(await get(base)).text();
const name=listing.match(/href="(postgresql-client-17_17\.11-[^"/]*pgdg24\.04[^"/]*_amd64\.deb)"/)?.[1];
if(!name)throw new Error('exact official Ubuntu24 PG17.11 client not in repository');
const bytes=Buffer.from(await(await get(base+name)).arrayBuffer());
if(bytes.length>20*1024**2)throw new Error('public package bound');
await writeFile(path.join(root,'assets/pg-client17.11.deb'),bytes,{flag:'wx'});
const record={url:base+name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,verification:'official HTTPS repository; local integrity hash, not signature attestation'};
await writeFile(path.join(root,'assets/pg-client17.11.json'),JSON.stringify(record,null,2),{flag:'wx'});
console.log(JSON.stringify(record));
