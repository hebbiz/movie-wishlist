// Official public headers for the disposable extension build, not an app dep.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.argv[2],url='https://curl.se/download/curl-8.4.0.tar.xz';
const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error('official headers download failed');
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.length>10*1024**2)throw new Error('public source size bound');
const metadata={url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),verification:'official HTTPS download, locally computed hash; not a signature claim'};
await writeFile(path.join(root,'share/curl-source.tar.xz'),bytes,{flag:'wx'});
await writeFile(path.join(root,'assets/curl-source.json'),JSON.stringify(metadata,null,2),{flag:'wx'});
console.log(JSON.stringify(metadata));
