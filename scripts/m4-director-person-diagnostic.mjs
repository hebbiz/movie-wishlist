// Opt-in person-identity check only. Not an app endpoint or runtime resolver.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { readTmdbJson } from '../research/grounded-answer-demo/tmdb.mjs';
import { readTmdbCredential } from './m4-control-credentials.mjs';
const movieId = 335984, targetAlias = 'Денні Вільньов';
const creditsURL = 'https://api.themoviedb.org/3/movie/335984/credits?language=uk-UA';
const personPageURL = 'https://kinobazaua.com/persons/denis-villeneuve';
const normalize = s => typeof s === 'string' ? s.normalize('NFC').replace(/\s+/gu,' ').trim().toLocaleLowerCase('uk-UA') : '';
const text = s => typeof s === 'string' && s.length > 0 && s.length <= 500 && !/[\p{C}]/u.test(s) ? s : null;
const validId = id => Number.isSafeInteger(id) && id > 0;
const attr = (n,key) => n.attrs?.find(a=>a.name===key)?.value;
const nodeText = n => (n.childNodes??[]).map(c=>c.nodeName==='#text'?c.value:['script','style','template','iframe','noscript'].includes(c.tagName)?'':nodeText(c)).join(' ').replace(/\s+/gu,' ').trim();
const excluded = n => { for(let p=n;p;p=p.parentNode)if(['nav','aside','footer','template','iframe','noscript'].includes(p.tagName))return true;return false; };
function personLink(url) {
  if(typeof url!=='string')return null;
  const imdb=/^https:\/\/(?:www\.)?imdb\.com\/name\/(nm\d{1,20})\/?$/.exec(url);
  const tmdb=/^https:\/\/(?:www\.)?themoviedb\.org\/person\/([1-9]\d{0,15})(?:-[a-z0-9-]+)?\/?$/.exec(url);
  return imdb?{namespace:'imdb:person',id:imdb[1]}:tmdb&&validId(Number(tmdb[1]))?{namespace:'tmdb:person',id:Number(tmdb[1])}:null;
}
export function inspectKinobazaPerson(html) {
  const stack=[parse(html)],nodes=[];let structuralLimit=false;
  while(stack.length){if(nodes.length>=20_000){structuralLimit=true;break;}const n=stack.pop();nodes.push(n);stack.push(...(n.childNodes??[]));}
  const active=nodes.filter(n=>!excluded(n));
  const headings=active.filter(n=>n.tagName==='h1').map(nodeText);
  const canonicals=active.filter(n=>n.tagName==='link'&&(attr(n,'rel')??'').split(/\s+/).includes('canonical')).map(n=>attr(n,'href'));
  const people=[],links=[];let malformedStructuredData=0;
  for(const node of active){
    if(node.tagName==='a'){
      const id=personLink(attr(node,'href'));if(id&&links.length<16)links.push({...id,label:text(nodeText(node)),title:text(attr(node,'title')),association:'unestablished-profile-ownership'});
    }
    if(node.tagName!=='script'||attr(node,'type')!=='application/ld+json')continue;
    const raw=(node.childNodes??[]).map(n=>n.value??'').join('');
    if(raw.length>131_072){structuralLimit=true;continue;}
    try{
      const queue=[JSON.parse(raw)];let scanned=0;
      while(queue.length){
        if(++scanned>128){structuralLimit=true;break;}const item=queue.shift();
        if(Array.isArray(item)){queue.push(...item);continue;}
        if(!item||typeof item!=='object')continue;
        if(item['@graph'])queue.push(item['@graph']);
        const types=Array.isArray(item['@type'])?item['@type']:[item['@type']];
        if(!types.some(t=>['Person','https://schema.org/Person','http://schema.org/Person'].includes(t)))continue;
        const aliases=Array.isArray(item.alternateName)?item.alternateName:item.alternateName?[item.alternateName]:[];
        const sameAs=Array.isArray(item.sameAs)?item.sameAs:item.sameAs?[item.sameAs]:[];
        if(aliases.length>32||sameAs.length>32||people.length>=8){structuralLimit=true;continue;}
        const ids=[...sameAs,item['@id']].map(personLink).filter(Boolean);
        people.push({name:text(item.name),aliases:aliases.map(text).filter(Boolean),ids,
          birthday:text(item.birthDate),placeOfBirth:text(typeof item.birthPlace==='string'?item.birthPlace:item.birthPlace?.name),
          profileURLMatches:item.url===personPageURL||item['@id']===personPageURL,
          profileURLConflict:[item.url,item['@id']].filter(v=>v!==undefined&&!personLink(v)).some(v=>v!==personPageURL)});
      }
    }catch{malformedStructuredData++;}
  }
  return {sourceURL:personPageURL,headings:headings.slice(0,4).map(text),headingCount:headings.length,
    canonicalCount:canonicals.length,canonicalMatches:canonicals.length===1&&canonicals[0]===personPageURL,
    people,links,malformedStructuredData,structuralLimit:structuralLimit||headings.length>4};
}
async function readPersonHTML(send,signal){
  const local=AbortSignal.timeout(15_000),combined=AbortSignal.any([signal,local]);let reader;
  const aborted=new Promise((_,reject)=>{if(combined.aborted)reject(Error());else combined.addEventListener('abort',()=>reject(Error()),{once:true});});
  const bounded=p=>Promise.race([p,aborted]);
  try{
    const r=await bounded(send(personPageURL,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html'},signal:combined}));
    const stop=status=>{void r.body?.cancel().catch(()=>{});return{status};};
    if(r.status>=300&&r.status<400)return stop('person-page-redirect-refused');
    if(!r.ok)return stop([403,429].includes(r.status)?'person-page-access-blocked':'person-page-http-error');
    if(!/^text\/html(?:\s*;|$)/i.test(r.headers.get('content-type')??'')||!r.body)return stop('person-page-invalid-content');
    if(Number(r.headers.get('content-length'))>512*1024)return stop('person-page-too-large');
    reader=r.body.getReader();const chunks=[];let size=0;
    for(;;){const part=await bounded(reader.read());if(part.done)break;size+=part.value.byteLength;if(size>512*1024){void reader.cancel().catch(()=>{});return{status:'person-page-too-large'};}chunks.push(part.value);}
    const html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size));
    if(/captcha|cf-chl-|challenge-platform/i.test(html))return{status:'person-page-challenge-refused'};
    return{status:'ok',html};
  }catch{if(reader)void reader.cancel().catch(()=>{});return{status:combined.aborted?'person-page-timeout-no-retry':'person-page-network-or-decoding-error'};}
}
export async function runDirectorPersonDiagnostic({tmdbToken,fetchImpl=fetch}={}){
  const counts={tmdb:0,personPages:0,total:0},attempts=[],evidence={};
  const base={execution:'local-diagnostic',buildSha:null,runId:randomUUID(),startedAt:new Date().toISOString(),mode:'director-person-check',
    limits:{tmdb:2,personPages:1,total:3},accounting:{priorAttempts:22,cumulativeMax:25}};
  const done=outcome=>{
    const out={...base,status:'completed-controls-not-historical-reconstruction',counts,attempts,outcome,evidence};
    return tmdbToken&&JSON.stringify(out).includes(tmdbToken)?{...base,status:'unsafe-diagnostic-output-withheld',counts,attempts,outcome:'withheld',evidence:{}}:out;
  };
  if(typeof tmdbToken!=='string'||!tmdbToken||tmdbToken.length>4096||/\s/.test(tmdbToken))return done('blocked-missing-local-tmdb-credential');
  const signal=AbortSignal.timeout(45_000),seen=new Set();let detailsURL;
  const dispatch=stage=>async(url,init)=>{
    const type=stage==='kinobaza-person'?'personPages':'tmdb';
    const expected=stage==='movie-credits'?creditsURL:stage==='person-details'?detailsURL:stage==='kinobaza-person'?personPageURL:null;
    if(!expected||url!==expected||seen.has(stage)||counts.total>=3||counts[type]>=base.limits[type]||signal.aborted||init.method!=='GET'||init.redirect!=='manual'||init.credentials!=='omit'||type==='personPages'&&Object.keys(init.headers??{}).some(k=>/authorization|cookie|key/i.test(k)))throw Error('person-check-boundary');
    seen.add(stage);counts[type]++;counts.total++;const attempt={stage,outcome:'dispatched'};attempts.push(attempt);
    try{const r=await fetchImpl(url,{...init,signal:AbortSignal.any([signal,init.signal].filter(Boolean))});attempt.outcome='response-received';attempt.httpStatus=r.status;return r;}
    catch{attempt.outcome='transport-outcome-unknown';throw Error('person-check-transport');}
  };
  try{
    const credits=await readTmdbJson(creditsURL,tmdbToken,dispatch('movie-credits'),{signal,timeoutMs:15_000});
    if(credits.status!=='ok')return done(`credits-${credits.status}`);
    if(credits.data?.id!==movieId||!Array.isArray(credits.data.crew)||credits.data.crew.length>5000)return done('credits-invalid-movie-or-crew');
    const directors=credits.data.crew.filter(c=>c?.job==='Director');
    if(directors.length!==1||!validId(directors[0].id))return done('credits-director-unresolved');
    const personId=directors[0].id;
    evidence.credits={sourceURL:creditsURL,movieId,personId,name:text(directors[0].name),originalName:text(directors[0].original_name)};
    detailsURL=`https://api.themoviedb.org/3/person/${personId}?language=uk-UA&append_to_response=external_ids`;
    const person=await readTmdbJson(detailsURL,tmdbToken,dispatch('person-details'),{signal,timeoutMs:15_000});
    if(person.status!=='ok')return done(`person-${person.status}`);
    if(person.data?.id!==personId)return done('person-stable-id-conflict');
    const d=person.data;
    if(d.success===false||Object.hasOwn(d,'status_code'))return done('person-invalid-response');
    if(d.external_ids!==undefined&&d.external_ids!==null&&
      (typeof d.external_ids!=='object'||Array.isArray(d.external_ids)||d.external_ids.success===false||Object.hasOwn(d.external_ids,'status_code')||
       Object.hasOwn(d.external_ids,'id')&&d.external_ids.id!==personId))return done('person-external-id-conflict-or-invalid');
    const aliases=d.also_known_as??[];
    if(!Array.isArray(aliases)||aliases.length>100||!aliases.every(v=>text(v)))return done('person-alias-metadata-unresolved');
    const ids=[d.imdb_id,d.external_ids?.imdb_id].filter(v=>v!==undefined&&v!==null&&v!=='');
    if(ids.some(id=>typeof id!=='string'||!/^nm\d{1,20}$/.test(id))||new Set(ids).size>1)return done('person-external-id-conflict-or-invalid');
    const matchingAliases=[text(d.name),...aliases].filter(v=>normalize(v)===normalize(targetAlias));
    evidence.person={sourceURL:detailsURL,namespace:'tmdb:person',personId,name:text(d.name),aliasesExamined:aliases.length,
      aliasesState:d.also_known_as===undefined?'missing':d.also_known_as===null?'null':aliases.length?'reported':'reported-empty',
      matchingAliases:[...new Set(matchingAliases)],imdbId:ids[0]??null};
    if(matchingAliases.length)return done('confirmed-tmdb-person-alias'); // Third read not needed.
    evidence.person.birthday=text(d.birthday);evidence.person.placeOfBirth=text(d.place_of_birth);
    const page=await readPersonHTML(dispatch('kinobaza-person'),signal);
    if(page.status!=='ok')return done(page.status);
    if(page.html.includes(tmdbToken))return done('unsafe-person-page-withheld');
    const profile=inspectKinobazaPerson(page.html);evidence.kinobaza=profile;
    const profilePerson=profile.people.length===1?profile.people[0]:null;
    const profileImdb=profilePerson?.ids.filter(p=>p.namespace==='imdb:person').map(p=>p.id)??[];
    const profileTmdb=profilePerson?.ids.filter(p=>p.namespace==='tmdb:person').map(p=>p.id)??[];
    const targetName=profilePerson&&[profilePerson.name,...profilePerson.aliases].some(v=>normalize(v)===normalize(targetAlias));
    if(!profile.structuralLimit&&!profile.malformedStructuredData&&profile.canonicalMatches&&profile.headingCount===1&&normalize(profile.headings[0])===normalize(targetAlias)&&targetName&&profilePerson.profileURLMatches&&!profilePerson.profileURLConflict&&
      ids.length&&profileImdb.length&&profileImdb.every(id=>id===ids[0])&&profileTmdb.every(id=>id===personId))return done('confirmed-external-person-id');
    return done('unresolved-profile-evidence-needs-review');
  }catch{return done(signal.aborted?'person-check-deadline-no-retry':'person-check-failed-no-retry');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let credentials;
  try{
    if(!process.argv.includes('--live-person-check')||!process.argv.includes('--credentials-stdin'))throw Error();
    credentials=await readTmdbCredential(process.stdin);
    process.stdout.write(JSON.stringify(await runDirectorPersonDiagnostic(credentials))+'\n');
  }catch{process.stdout.write('{"execution":"local-diagnostic","status":"local-run-failed-no-retry"}\n');process.exitCode=2;}
  finally{if(credentials)credentials.tmdbToken=null;}
}
