// Authored HTTP/HTML/person fixtures only. No live film or availability claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createKinobazaResolver} from '../netlify/lib/kinobaza-resolver.mjs';
import {predictedKinobazaURL} from '../netlify/lib/kinobaza-predicted-url.mjs';
import {markup} from './assisted-kinobaza.fixture.mjs';
const SEARCH='https://api.tavily.com/search', KEY='AUTHORED_SEARCH_KEY', PERSON_KEY='AUTHORED_PERSON_KEY';
const URLS=['first','second','third'].map(x=>'https://kinobazaua.com/titles/authored-'+x);
const PREDICTED='https://kinobazaua.com/titles/authored-original';
const PROFILES=['first-person','new-person'].map(x=>'https://kinobazaua.com/persons/authored-'+x);
const PERSON_URL='https://api.themoviedb.org/3/person/999999?language=en-US&append_to_response=external_ids';
const ALIAS='Авторський режисер', LATIN='Authored Director';
const FILM={id:'authored-predicted',imdbId:'tt999900001',tmdbId:999900001,identityTitle:'Вигаданий фільм',originalTitle:'Authored original',year:2001,
 titleAliases:['Вигаданий фільм','Authored original'],directorCount:1,directorAliases:[LATIN],directorPeople:[{namespace:'tmdb:person',personId:999999,names:[LATIN]}],
 identityContext:{tmdbId:999900001,titleEvidence:[{source:'original',title:'Authored original'}]}};
const OTHER={title:'Another Latin film',original:'Other original',year:2002};
const STABLE=`<tr><td>IMDb:</td><td>${FILM.imdbId}</td></tr>`;
const linked=index=>`<a href="${PROFILES[index]}">${ALIAS}</a>`;
const page=(index,birthday)=>`<!doctype html><link rel="canonical" href="${PROFILES[index]}"><div class="col-8"><h1 class="h2">${ALIAS}</h1><h2 class="h3 text-muted">${LATIN}</h2><p>Дата народження: ${birthday}</p><p>Ролі: режисер</p></div>`;
const PERSON={id:999999,name:LATIN,also_known_as:[],birthday:'1967-05-20',imdb_id:'nm9999991',external_ids:{imdb_id:'nm9999991'}};
async function run({cap=14,film=FILM,searches=[[URLS[0],URLS[1]],[],[URLS[2]]],cards=[OTHER,OTHER,OTHER],predicted={},person=PERSON,intercept,reserveImpl,prior=4,signal}={}){
 const calls=Array.from({length:prior},(_,i)=>({stage:'baseline-'+i,status:'response-received'})),reserved=[],requests=[],payloads=[];
 const out=await createKinobazaResolver({apiKey:KEY})(film,{sourceCap:cap,tmdbToken:PERSON_KEY,calls,signal,diagnostics:true,
 reserve:async stage=>{assert.ok(!reserved.includes(stage));reserved.push(stage);if(reserveImpl)await reserveImpl(stage);},
 fetchImpl:async(url,init)=>{requests.push(url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
  if(intercept){const value=await intercept(url,init);if(value!==undefined)return value;}
  if(url===SEARCH){payloads.push(JSON.parse(init.body));const i=payloads.length-1;return Response.json({results:(searches[i]??[]).map(url=>({url,content:'PRIVATE_SNIPPET'}))});}
  if(url===PERSON_URL)return Response.json(person);
  assert.ok(!new Headers(init.headers).has('authorization'));assert.ok(!new Headers(init.headers).has('cookie'));
  if(PROFILES.includes(url))return new Response(page(PROFILES.indexOf(url),PROFILES.indexOf(url)===0?'21 травня 1967':'20 травня 1967'),{headers:{'content-type':'text/html'}});
  assert.ok(URLS.includes(url)||url===PREDICTED,'no arbitrary URL/slug/destination');
  return new Response(markup({url,director:LATIN,...(url===PREDICTED?predicted:cards[URLS.indexOf(url)])}),{headers:{'content-type':'text/html'}});
 }});
 assert.ok(calls.length<=cap);assert.ok(out.resolver.searchCalls<=3);assert.ok(out.resolver.cardCalls<=4);
 const cardReads=requests.filter(u=>URLS.includes(u)||u===PREDICTED);assert.equal(new Set(cardReads).size,cardReads.length);
 assert.ok(requests.every(u=>!u.includes('kinobazaua.com/search')&&!u.includes('justwatch')&&!u.includes('apple')));
 assert.doesNotMatch(JSON.stringify({resolver:out.resolver,calls}),/AUTHORED_.*KEY|PRIVATE_SNIPPET|nm9999991|1967|<html/);
 return {out,calls,reserved,requests,payloads};
}
test('first three Tavily opportunities unchanged; only then one predicted URL',async()=>{
 const before=await run({cap:12}),after=await run();assert.deepEqual(after.payloads,before.payloads);
 assert.deepEqual(after.requests.slice(0,before.requests.length),before.requests);
 assert.equal(after.out.result.sourceURL,PREDICTED);assert.equal(after.out.result.identity.status,'matched');
 assert.equal(after.out.resolver.cardCalls,4);assert.equal(after.out.resolver.predicted.status,'matched');assert.equal(after.reserved.at(-1),'kinobaza-predicted');
 assert.ok(after.out.result.candidates.length>0);
 assert.equal(after.out.resolver.possibleIrrelevantSearch,undefined);
});
test('preserves cap8/10/12 without a predicted stage',async()=>{for(const cap of [8,10,12]){const r=await run({cap});assert.ok(!r.requests.includes(PREDICTED));assert.ok(!r.reserved.includes('kinobaza-predicted'));assert.equal(r.out.resolver.predicted,undefined);}});
test('an earlier successful card skips prediction and preserves its result',async()=>{for(const cards of [[{},OTHER,OTHER],[OTHER,{},OTHER],[OTHER,OTHER,{}]]){const r=await run({cards});assert.equal(r.out.result.identity.status,'matched');assert.equal(r.out.resolver.predicted.reason,'prior-card-confirmed');assert.ok(!r.requests.includes(PREDICTED));}});
test('already-read prediction is not fetched again even after refusal',async()=>{const r=await run({searches:[[PREDICTED,URLS[0]],[],[URLS[2]]],predicted:OTHER});assert.equal(r.out.result,null);assert.equal(r.requests.filter(u=>u===PREDICTED).length,1);assert.equal(r.out.resolver.predicted.reason,'already-read');});
test('a generated mismatching pointer cannot alone accuse the Tavily search of unrelated results',async()=>{
 const unconfirmed={director:'Unknown spelling'};
 const r=await run({cards:[unconfirmed,unconfirmed,unconfirmed],predicted:OTHER});
 assert.equal(r.out.result,null);assert.equal(r.out.resolver.cardCalls,4);
 assert.equal(r.out.resolver.cards.at(-1).reason,'source-title-conflict');
 assert.equal(r.out.resolver.possibleIrrelevantSearch,undefined);
});
test('empty search results allow predicted discovery, not invented search/card attempts',async()=>{const r=await run({searches:[[],[],[]]});assert.equal(r.out.result.sourceURL,PREDICTED);assert.equal(r.out.resolver.cardCalls,1);assert.deepEqual(r.reserved,['search-1','search-2','search-3','kinobaza-predicted']);});
test('one predicted card still must pass IDs, original/year/director and ambiguous structure',async()=>{for(const predicted of [OTHER,{stable:'<tr><td>IMDb:</td><td>tt999900002</td></tr>'},{year:2002},{director:'Unknown director'},{original:'Different original'}]){const r=await run({predicted});assert.equal(r.out.result,null);assert.equal(r.out.resolver.predicted.status,'unconfirmed');assert.equal(r.out.resolver.cards.at(-1).candidates,0);}});
test('no original title or unsupported script means no guessed URL',async()=>{for(const originalTitle of ['', '기생충']){const r=await run({film:{...FILM,originalTitle}});assert.ok(!r.requests.includes(PREDICTED));assert.equal(r.out.resolver.predicted.reason,'no-safe-original-title-prediction');}});
test('punctuation normalization yields one pointer, not a year/Roman/alias expansion',()=>{assert.equal(predictedKinobazaURL('Gladiator II'),'https://kinobazaua.com/titles/gladiator-ii');assert.equal(predictedKinobazaURL('Mad Max: Fury Road'),'https://kinobazaua.com/titles/mad-max-fury-road');assert.equal(predictedKinobazaURL("Schindler’s List"),'https://kinobazaua.com/titles/schindlers-list');assert.equal(predictedKinobazaURL('Män som hatar kvinnor'),'https://kinobazaua.com/titles/man-som-hatar-kvinnor');assert.equal(predictedKinobazaURL('電影 movie'),null);assert.equal(predictedKinobazaURL('<x>'),null);});
test('predicted redirect/404/access/challenge/transport do not follow or guess another URL',async()=>{for(const failure of [()=>new Response('',{status:302,headers:{Location:'https://foreign.example'}}),()=>new Response('',{status:404}),()=>new Response('',{status:403}),()=>new Response('captcha',{headers:{'content-type':'text/html'}}),()=>{throw Error('PRIVATE_TRANSPORT');}]){const r=await run({intercept:url=>url===PREDICTED?failure():undefined});assert.equal(r.out.result,null);assert.equal(r.requests.filter(u=>u===PREDICTED).length,1);assert.equal(r.requests.at(-1),PREDICTED);}});
test('Tavily errors or source access failures are not retry/bypass opportunities',async()=>{for(const [target,response]of [[SEARCH,()=>new Response('',{status:401})],[URLS[0],()=>new Response('',{status:403})]]){const r=await run({intercept:url=>url===target?response():undefined});assert.ok(!r.requests.includes(PREDICTED));}});
test('reservation lost/denied is not dispatched and is not repeated',async()=>{const r=await run({reserveImpl:stage=>{if(stage==='kinobaza-predicted')throw Error('UNKNOWN_RESERVATION');}});assert.ok(!r.requests.includes(PREDICTED));assert.equal(r.reserved.filter(s=>s==='kinobaza-predicted').length,1);assert.equal(r.out.resolver.predicted.status,'not-dispatched');});
test('deadline or full cap prevents prediction, not earlier-stage truncation',async()=>{const r=await run({prior:8});assert.equal(r.calls.length,14);assert.equal(r.out.resolver.predicted.reason,'budget');assert.ok(!r.requests.includes(PREDICTED));const controller=new AbortController();controller.abort();const stopped=await run({signal:controller.signal});assert.equal(stopped.requests.length,0);});
test('spent original pair permits one new profile only with same trusted TMDb projection, max14',async()=>{
 const r=await run({cards:[{director:linked(0)},OTHER,OTHER],predicted:{title:'Новий переклад',director:linked(1),stable:STABLE}});
 assert.equal(r.out.result.sourceURL,PREDICTED);assert.equal(r.calls.length,14);assert.equal(r.requests.filter(u=>u===PERSON_URL).length,1);
 assert.deepEqual(r.requests.filter(u=>PROFILES.includes(u)),PROFILES);assert.equal(r.reserved.at(-1),'kinobaza-person-predicted');
 assert.equal(r.out.resolver.directorProfile.sourceAttempts,3);
});
test('missing valid TMDb projection with spent pair cannot refetch it for predicted card',async()=>{
 const r=await run({person:{...PERSON,id:7},cards:[{director:linked(0)},OTHER,OTHER],predicted:{title:'Новий переклад',director:linked(1),stable:STABLE}});
 assert.equal(r.out.result,null);assert.equal(r.requests.filter(u=>u===PERSON_URL).length,1);assert.ok(!r.requests.includes(PROFILES[1]));
 assert.equal(r.out.resolver.directorProfile.reason,'director-profile-predicted-projection-unavailable');assert.ok(r.calls.length<=14);
});
test('an unused pair remains available to a predicted card, max13 actual slots',async()=>{const r=await run({predicted:{title:'Новий переклад',director:linked(1),stable:STABLE}});assert.equal(r.out.result.sourceURL,PREDICTED);assert.equal(r.calls.length,13);assert.ok(r.reserved.includes('tmdb-person'));assert.ok(r.reserved.includes('kinobaza-person'));assert.ok(!r.reserved.includes('kinobaza-person-predicted'));});
test('predicted pointer never breaks an equal-profile-evidence ambiguity',async()=>{const r=await run({cards:[{director:linked(0)},OTHER,OTHER],predicted:{title:'Новий переклад',director:linked(1)}});assert.equal(r.out.result,null);assert.equal(r.out.resolver.directorProfile.reason,'director-profile-candidates-ambiguous');assert.ok(!r.requests.includes(PROFILES[1]));});
