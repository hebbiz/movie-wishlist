// Explicit local investigation only. No HTML/archive, credentials, destinations
// or claims of historical reconstruction. Public metadata and DOM counts only.
import { parse } from 'parse5';
import { inspectPublicIdentity } from './m4-practical-series.mjs';
if (!process.argv.includes('--live-inspection')) {
  process.stdout.write('{"status":"explicit-live-inspection-required","sourceRequests":0}\n');
  process.exit(2);
}
const cards = ['blade-runner', 'mortal-kombat-2021', 'supergirl-2026'];
const attr = (n,k) => n.attrs?.find(a=>a.name===k)?.value;
const text = n => (n.childNodes??[]).map(c=>c.nodeName==='#text'?c.value:['script','style','template','iframe','noscript'].includes(c.tagName)?'':text(c)).join(' ').replace(/\s+/gu,' ').trim();
const shape = n => ({tag:n.tagName,id:attr(n,'id'),class:attr(n,'class')});
for (const slug of cards) {
  const url=`https://kinobazaua.com/titles/${slug}`,out={execution:'local-diagnostic',sourceURL:url,attempts:1};
  try {
    const r=await fetch(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});
    out.httpStatus=r.status;
    if(!r.ok||!/^text\/html\b/i.test(r.headers.get('content-type')??'')){void r.body?.cancel();out.status='http-or-type-refusal';}
    else {
      const chunks=[];let bytes=0;
      for await(const p of r.body){bytes+=p.length;if(bytes>2*1024*1024)throw Error('bounded');chunks.push(p);}
      const html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes)),all=[],stack=[parse(html,{sourceCodeLocationInfo:true})];
      while(stack.length){if(all.length>100000)throw Error('bounded');const n=stack.pop();all.push(n);if(!['script','style','template','iframe','noscript'].includes(n.tagName))stack.push(...n.childNodes??[]);}
      const accordion=all.filter(n=>attr(n,'id')==='availabilityAccordion');
      out.status='current-markup-inspected';out.bytes=bytes;out.identityFields=inspectPublicIdentity(html,url);
      out.accordions=accordion.map(n=>({node:shape(n),parent:shape(n.parentNode),children:(n.childNodes??[]).filter(c=>c.tagName).map(shape)}));
      out.badges=all.filter(n=>n.tagName==='div'&&attr(n,'title')?.includes('існує українське аудіо')).map(n=>({text:text(n).slice(0,120),title:attr(n,'title'),parent:shape(n.parentNode)}));
      out.providerAnchors=all.filter(n=>n.tagName==='a'&&/^(?:Доступно (?:в|у)|Купити в|Дивитись \/ Купити на) /i.test(attr(n,'title')??'')).slice(0,12).map(n=>({title:attr(n,'title'),text:text(n).slice(0,120),parent:shape(n.parentNode),grandparent:shape(n.parentNode?.parentNode??{})}));
    }
  }catch{out.status='bounded-read-failed-no-retry';}
  process.stdout.write(JSON.stringify(out)+'\n');
}
