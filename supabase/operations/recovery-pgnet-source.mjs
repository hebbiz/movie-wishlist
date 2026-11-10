// Public official extension source only. No backup credentials or source DB.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.argv[2];
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('official software fetch failed');return r;}
const ref=await(await get('https://api.github.com/repos/supabase/pg_net/git/ref/tags/v0.20.4')).json();
if(ref.object.type!=='commit'||!/^698fb05[0-9a-f]{33}$/.test(ref.object.sha))throw new Error('unexpected official release identity');
const url='https://codeload.github.com/supabase/pg_net/tar.gz/'+ref.object.sha;
const bytes=Buffer.from(await(await get(url)).arrayBuffer());
if(bytes.length>10*1024**2)throw new Error('software source bound');
await writeFile(path.join(root,'share/pg_net.tar.gz'),bytes,{flag:'wx'});
const metadata={release:'v0.20.4',commit:ref.object.sha,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
await writeFile(path.join(root,'assets/pg-net-source.json'),JSON.stringify(metadata,null,2),{flag:'wx'});
const makefile=await(await get('https://raw.githubusercontent.com/supabase/pg_net/'+ref.object.sha+'/Makefile')).text();
await writeFile(path.join(root,'assets/pg-net-Makefile'),makefile,{flag:'wx'});
console.log(JSON.stringify(metadata));
console.log(makefile);
