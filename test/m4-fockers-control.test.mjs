import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fockersControl, cap12ControlSeries, cap12ControlFilms } from '../scripts/m4-fockers-control.mjs';
import { rankedCandidates, resolverQueries, resolverRefusalQuery } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';

// Every response below is authored, not a historical/live source archive.
const keys={tmdbToken:'author-local-tmdb-key',tavilyKey:'author-local-tavily-key'};
const base='https://kinobazaua.com/titles/', correct=base+'authored-original',wrong=base+'authored-other';
const requestId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const details=()=>({id:990001,imdb_id:'tt0290002',title:'Авторський переклад',original_title:'Authored original',release_date:'2004-12-01',
  external_ids:{imdb_id:'tt0290002'},alternative_titles:{titles:[{title:'Authored alternate',iso_3166_1:'GB'}]},
  translations:{translations:[]},release_dates:{results:[]},credits:{crew:[{id:990002,job:'Director',name:'Authored director',original_name:'Authored director'}]}});
function transport({searchResults=[[wrong,correct]],throwSearch=false,secretEcho=false,missingCorrelation=false,findResults}={}) {
  const sent=[];let searches=0;
  return {sent,fetchImpl:async(url,init)=>{
    sent.push({url,init});assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
    if(url.includes('/find/'))return Response.json({movie_results:findResults??[{id:990001,title:'Авторський переклад',original_title:'Authored original'}]});
    if(url.includes('/movie/990001?'))return Response.json(details());
    if(url==='https://api.tavily.com/search'){
      assert.equal(init.method,'POST');assert.equal(new Headers(init.headers).get('authorization'),`Bearer ${keys.tavilyKey}`);
      searches++;if(throwSearch)throw Error(`never echo ${keys.tavilyKey}`);
      const query=JSON.parse(init.body).query;
      return Response.json({...(!missingCorrelation?{query:query.replaceAll('"',''),request_id:requestId}:{}),
        results:(searchResults[searches-1]??searchResults.at(-1)).map(url=>({url,title:'NEVER_COPY_TAVILY_TITLE',content:secretEcho?keys.tavilyKey:'NEVER_COPY_SEARCH_SNIPPET',score:0.999}))});
    }
    assert.ok([wrong,correct].includes(url),'only discovered admitted pointers can be read');
    assert.equal(new Headers(init.headers).has('authorization'),false);assert.equal(init.method,'GET');
    return new Response(markup({url,title:url===correct?'Авторський переклад':'Зовсім інший фільм',original:url===correct?'Authored original':'Different original',year:2004}),{headers:{'content-type':'text/html'}});
  }};
}

test('one memory-only control captures the same Tavily call and exact runtime ranking before card reads',async()=>{
  const mocked=transport(),out=await fockersControl(keys,mocked.fetchImpl);
  assert.equal(out.execution,'local-diagnostic');assert.equal(out.historicalReconstruction,false);assert.equal(out.buildSha,null);
  assert.equal(out.status,'completed-current-control-not-historical-reconstruction');
  assert.deepEqual(out.counts,{tmdb:2,search:1,cards:2,tmdbPerson:0,kinobazaPerson:0,total:5});
  assert.deepEqual(out.reservations,['tmdb-find','tmdb-details','search-1','kinobaza-1','kinobaza-2']);
  assert.equal(out.searches[0].query,JSON.parse(mocked.sent.find(item=>item.url==='https://api.tavily.com/search').init.body).query);
  assert.equal(out.searches[0].requestId,requestId);assert.equal(out.searches[0].responseObservation,'bounded-current-response');
  assert.deepEqual(out.searches[0].returnedURLs.map(item=>item.url),[wrong,correct]);
  assert.deepEqual(out.admittedRankedUnion,rankedCandidates([wrong,correct],out.film));
  assert.deepEqual(out.readCards.map(card=>card.url),[correct,wrong]);
  assert.deepEqual(out.readCards[0].rankedCandidatesBeforeRead,[correct,wrong]);
  assert.equal(out.readCards[0].identity,'matched');assert.equal(out.readCards[1].reason,'source-title-conflict');
  assert.deepEqual(out.readCards[0].observed.h2,['Authored original']);
  assert.ok(out.projection.rows>0);assert.ok(out.projection.providers.some(item=>item.provider==='apple'&&item.audio.state==='reported-positive'));
  assert.ok(out.projection.providers.some(item=>item.link.hasURL));
  assert.doesNotMatch(JSON.stringify(out),/NEVER_COPY|author-local-(?:tmdb|tavily)-key|authorization|rawHtml|rawResponse|overview/);
  assert.ok(mocked.sent.every(item=>!item.url.includes('/search?')&&!/movieofthenight|watch\/providers|apple\.com/.test(item.url)));
});

test('identity refusal spends the unchanged second Tavily slot and reranks its union before second read',async()=>{
  const mocked=transport({searchResults:[[wrong],[wrong,correct]]}),out=await fockersControl(keys,mocked.fetchImpl);
  assert.deepEqual(out.counts,{tmdb:2,search:2,cards:2,tmdbPerson:0,kinobazaPerson:0,total:6});
  assert.deepEqual(out.readCards.map(card=>card.url),[wrong,correct]);
  assert.deepEqual(out.readCards[0].rankedCandidatesBeforeRead,[wrong]);
  assert.deepEqual(out.readCards[1].rankedCandidatesBeforeRead,[correct,wrong]);
  assert.equal(out.readCards[1].identity,'matched');assert.equal(out.resolver.candidates,2);assert.equal(out.resolver.unexamined,0);
  // Use only observed trusted projection values to reconstruct the query film.
  const film={...out.film,identityTitle:out.film.title,titleAliases:out.film.titleAliases,directorCount:1,directorPeople:out.film.directorPeople,
    identityContext:{tmdbId:990001,titleEvidence:[{title:'Authored original',source:'original'}]}};
  assert.equal(out.searches[0].query,resolverQueries(film)[0]);assert.equal(out.searches[1].query,resolverRefusalQuery(film));
  assert.deepEqual(out.reservations,['tmdb-find','tmdb-details','search-1','kinobaza-1','search-2','kinobaza-2']);
});

test('two empty results do not seed a known card URL or authorize any further call',async()=>{
  const mocked=transport({searchResults:[[],[]]}),out=await fockersControl(keys,mocked.fetchImpl);
  assert.equal(out.counts.total,4);assert.equal(out.counts.search,2);assert.equal(out.counts.cards,0);
  assert.equal(out.resolver.status,'no-admitted-search-candidates');assert.deepEqual(out.readCards,[]);assert.deepEqual(out.admittedRankedUnion,[]);
});

test('failed attempts are counted once and never retried or interpolated into output',async()=>{
  const mocked=transport({throwSearch:true}),out=await fockersControl(keys,mocked.fetchImpl);
  assert.equal(out.counts.total,3);assert.equal(out.counts.search,1);assert.equal(out.attempts.at(-1).outcome,'transport-outcome-unknown');
  assert.equal(out.resolver.status,'search-transport-or-json-error');assert.deepEqual(out.searches[0].returnedURLs,[]);
  assert.equal(out.searches[0].requestId,null);assert.equal(out.searches[0].responseQuery,null);
  assert.doesNotMatch(JSON.stringify(out),/author-local-tavily-key|never echo/);
});

test('missing correlation is unknown; secrets in current body are withheld rather than printed',async()=>{
  const ordinary=transport({missingCorrelation:true}),out=await fockersControl(keys,ordinary.fetchImpl);
  assert.equal(out.searches[0].requestId,null);assert.equal(out.searches[0].responseQuery,null);assert.ok(out.searches[0].query);
  const unsafe=transport({secretEcho:true}),hidden=await fockersControl(keys,unsafe.fetchImpl);
  assert.equal(hidden.counts.total,3);assert.equal(hidden.counts.cards,0);assert.equal(hidden.searches[0].responseObservation,'unsafe-source-content-withheld');
  assert.equal(hidden.resolver.status,'unsafe-source-content-withheld');assert.doesNotMatch(JSON.stringify(hidden),/author-local-(?:tmdb|tavily)-key/);
});

test('IMDb find ambiguity stops after one attempt and bad credentials cause zero requests',async()=>{
  const ambiguous=transport({findResults:[{id:990001},{id:990003}]}),out=await fockersControl(keys,ambiguous.fetchImpl);
  assert.equal(out.status,'tmdb-find-unresolved');assert.equal(out.counts.total,1);
  let calls=0;const invalid=await fockersControl({tmdbToken:'has whitespace',tavilyKey:'key'},()=>{calls++;throw Error();});
  assert.equal(calls,0);assert.equal(invalid.counts.total,0);
});

test('one-shot entry point reads only stdin and never opens a report or credential file',async()=>{
  const script=await readFile(new URL('../scripts/m4-fockers-control.mjs',import.meta.url),'utf8');
  assert.match(script,/readControlCredentials\(process\.stdin\)/);assert.doesNotMatch(script,/process\.env|writeFile|appendFile|createWriteStream|console\.|api\.movieofthenight|watch\/providers/);
  assert.doesNotMatch(script,/titles\/(?:meet-the-fockers|little-fockers|meet-the-parents)/);
});

function seriesTransport({needReserve=false,brokenCardClone=false,usages,providerTimes}={}){
  const sent=[];let selected,searches=0;
  const wrong2='https://kinobazaua.com/titles/authored-other-second';
  return {sent,fetchImpl:async(url,init)=>{
    sent.push({url,init});assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
    const imdb=/\/find\/(tt\d+)\?/.exec(url)?.[1];
    if(imdb){selected=cap12ControlFilms.find(film=>film.imdbId===imdb);assert.ok(selected);searches=0;return Response.json({movie_results:[{id:990001}]});}
    if(url.includes('/movie/990001?'))return Response.json({...details(),imdb_id:selected.imdbId,external_ids:{imdb_id:selected.imdbId},release_date:`${selected.year}-12-01`});
    if(url==='https://api.tavily.com/search'){
      searches++;const payload=JSON.parse(init.body);assert.equal(payload.exact_match,searches===3?true:undefined);
      assert.equal(payload.search_depth,searches===3?'advanced':'basic');assert.equal(payload.include_usage,false);
      if(searches<3)assert.equal(init.body,JSON.stringify({query:payload.query,search_depth:'basic',topic:'general',max_results:5,auto_parameters:false,
        include_answer:false,include_raw_content:false,include_images:false,include_favicon:false,include_usage:false,include_domains:['kinobazaua.com'],include_domains_mode:'restrict'}),
      'the two established Tavily payloads retain their exact original JSON bytes and property order');
      const urls=needReserve?(searches===1?[wrong]:searches===2?[wrong2]:[correct,wrong]):[wrong,correct];
      return Response.json({query:payload.query,request_id:requestId,...(usages?{usage:usages[searches-1]}:{}),...(providerTimes?{response_time:providerTimes[searches-1]}:{}),
        results:urls.map(url=>({url,content:'NEVER_RETAIN_RAW_BODY_OR_SNIPPET'}))});
    }
    assert.ok([correct,wrong,wrong2].includes(url));
    const response=new Response(markup({url,title:url===correct?'Авторський переклад':'A Different Authored Film',original:url===correct?'Authored original':'Other authored original',year:selected.year}),{headers:{'content-type':'text/html'}});
    if(brokenCardClone&&url===wrong)response.clone=()=>{throw Error('authored-observation-unavailable');};return response;
  }};
}

test('cap12 single live pass adds only exact reserve search/card and compares cap10 through RAM replay, not HTTP',async()=>{
  const mocked=seriesTransport({needReserve:true}),out=await cap12ControlSeries(keys,mocked.fetchImpl,{films:[cap12ControlFilms[0]]}),result=out.cases[0];
  assert.equal(mocked.sent.length,8);assert.deepEqual(result.counts,{tmdb:2,search:3,cards:3,tmdbPerson:0,kinobazaPerson:0,total:8});
  assert.equal(result.configuredResolverCap,12);assert.equal(result.serverLedgerCapAttested,false);assert.deepEqual(result.omittedBaselineSources,['tmdb-providers','motn-title']);
  assert.equal(result.attempts.length,8);assert.ok(result.attempts.every(attempt=>attempt.outcome==='response-received'&&attempt.httpStatus===200));
  assert.deepEqual(result.reservations,['tmdb-find','tmdb-details','search-1','kinobaza-1','search-2','kinobaza-2','search-3','kinobaza-3']);
  assert.deepEqual(result.searches.map(search=>search.mode),['normal','normal','reserve-exact']);
  assert.deepEqual(result.searches.map(search=>search.searchDepth),['basic','basic','advanced']);assert.deepEqual(result.searches.map(search=>search.declaredCreditsPerRequest),[1,1,2]);
  assert.deepEqual(result.tavilyAccounting.depthAttempts,{basic:2,advanced:1,unknown:0});assert.equal(result.tavilyAccounting.declaredCredits.total,4);
  assert.equal(result.tavilyAccounting.returnedUsage.unknownRequests,3);assert.equal(result.tavilyAccounting.returnedUsage.reportedCreditsSubtotal,0);
  assert.equal(result.tavilyAccounting.returnedUsage.complete,false);assert.equal(out.tavilyAccounting.attempts,3,'RAM replay adds no billable-attempt claim');
  assert.deepEqual(result.readCards.map(card=>card.identity),['mismatch','mismatch','matched']);
  assert.equal(result.readCards[2].candidatePool,'reserve-search-only');assert.deepEqual(result.readCards[2].eligibleUnreadBeforeRead,[correct]);
  assert.equal(result.counterfactualCap10.execution,'memory-replay-current-first-two-slots-not-independent-live');assert.equal(result.counterfactualCap10.externalRequests,0);
  assert.equal(result.counterfactualCap10.complete,true);assert.deepEqual(result.counterfactualCap10.confirmed,[]);
  assert.equal(result.counterfactualCap10.replayedSourceReads,4);assert.equal(result.counterfactualCap10.cards.length,2);
  assert.ok(!result.counterfactualCap10.reservations.includes('search-3'));assert.doesNotMatch(JSON.stringify(out),/NEVER_RETAIN|author-local-/);
});

test('all eight controls reuse one credential object but no previous-film response cache or additional live baseline calls',async()=>{
  const mocked=seriesTransport(),emitted=[],out=await cap12ControlSeries(keys,mocked.fetchImpl,{onCase:result=>emitted.push(result)});
  assert.equal(out.cases.length,8);assert.equal(emitted.length,8);assert.equal(mocked.sent.length,40);assert.equal(out.counts.total,40);
  assert.deepEqual(out.cases.map(result=>result.film.imdbId),cap12ControlFilms.map(film=>film.imdbId));
  assert.ok(out.cases.every(result=>result.counts.search===1&&result.counts.cards===2));
  assert.ok(out.cases.every(result=>result.counterfactualCap10.complete&&result.counterfactualCap10.externalRequests===0&&result.counterfactualCap10.confirmed.includes(correct)));
  assert.ok(emitted.every(result=>JSON.stringify(result).length<12*1024),'normal compact case fits a mobile-friendly line');
  assert.ok(mocked.sent.every(item=>!item.url.includes('/search?')&&!/movieofthenight|watch\/providers|apple\.com/.test(item.url)));
});

test('unavailable RAM snapshot stays unknown rather than refetching or asserting a cap10 counterfactual failure',async()=>{
  const mocked=seriesTransport({brokenCardClone:true}),out=await cap12ControlSeries(keys,mocked.fetchImpl,{films:[cap12ControlFilms[0]]}),result=out.cases[0];
  assert.equal(mocked.sent.length,5);assert.equal(result.readCards[0].identity,'matched','diagnostic clone failure cannot alter the actual adapter body');
  assert.equal(result.counterfactualCap10.externalRequests,0);assert.equal(result.counterfactualCap10.complete,false);
  assert.equal(result.counterfactualCap10.status,'unknown-unrecorded-source');assert.deepEqual(result.counterfactualCap10.confirmed,[]);
});

test('identical normal query payloads replay their separate observed responses in call order, never a last-value cache',async()=>{
  const mocked=seriesTransport({needReserve:true});
  const send=async(url,init)=>{const response=await mocked.fetchImpl(url,init);if(!url.includes('/movie/990001?'))return response;
    const value=await response.json();return Response.json({...value,title:value.original_title,alternative_titles:{titles:[]},credits:{crew:[]}});};
  const out=await cap12ControlSeries(keys,send,{films:[cap12ControlFilms[0]]}),result=out.cases[0];
  assert.equal(result.searches[0].query,result.searches[1].query);assert.equal(mocked.sent.length,8);
  assert.deepEqual(result.counterfactualCap10.reads.filter(read=>read.type==='cards').map(read=>read.url),[wrong,'https://kinobazaua.com/titles/authored-other-second']);
  assert.equal(result.counterfactualCap10.complete,true);assert.equal(result.counterfactualCap10.externalRequests,0);
});

test('a failed control retains its requested film and does not automatically rerun the case',async()=>{
  let count=0;const out=await cap12ControlSeries(keys,async()=>{count++;throw Error('author-local-tmdb-key');},{films:[cap12ControlFilms[0]]});
  assert.equal(count,1);assert.equal(out.counts.total,1);assert.equal(out.cases[0].requested.imdbId,'tt0290002');assert.equal(out.cases[0].counterfactualCap10.complete,false);
  assert.deepEqual(out.cases[0].attempts,[{type:'tmdb',outcome:'transport-outcome-unknown',httpStatus:null}]);
  assert.doesNotMatch(JSON.stringify(out),/author-local-tmdb-key/);
});

test('series film selection cannot expand beyond the approved fixed eight IMDb contexts',async()=>{
  let calls=0;await assert.rejects(cap12ControlSeries(keys,()=>{calls++;},{films:[{title:'Other',year:2000,imdbId:'tt0000001'}]}),/invalid-local-study/);
  await assert.rejects(cap12ControlSeries(keys,()=>{calls++;},{films:[cap12ControlFilms[0],cap12ControlFilms[0]]}),/invalid-local-study/);assert.equal(calls,0);
});

test('declared depth credits remain distinct from returned numeric usage and provider response timing',async()=>{
  const mocked=seriesTransport({needReserve:true,usages:[{credits:1},{credits:0},{credits:2}],providerTimes:[0.25,0.3,0.4]}),
    out=await cap12ControlSeries(keys,mocked.fetchImpl,{films:[cap12ControlFilms[0]]}),result=out.cases[0];
  assert.equal(mocked.sent.length,8);assert.deepEqual(result.searches.map(search=>search.returnedUsage),[
    {state:'reported',credits:1},{state:'reported',credits:0},{state:'reported',credits:2}]);
  assert.deepEqual(result.searches.map(search=>search.providerResponseTimeSeconds),[0.25,0.3,0.4]);
  assert.ok(result.searches.every(search=>Number.isInteger(search.elapsedMs)&&search.elapsedMs>=0));
  assert.equal(result.tavilyAccounting.declaredCredits.total,4);assert.equal(result.tavilyAccounting.returnedUsage.reportedCreditsSubtotal,3,'do not replace returned usage with a scheduled-cost estimate');
  assert.equal(result.tavilyAccounting.returnedUsage.complete,true);assert.equal(result.tavilyAccounting.elapsedMs,result.searches.reduce((sum,search)=>sum+search.elapsedMs,0));
  assert.deepEqual(out.tavilyAccounting,result.tavilyAccounting);assert.match(result.tavilyAccounting.declaredCredits.basis,/not-billed-usage/);
  const split=result.tavilyAccounting.depthAccounting;
  assert.equal(split.basic.attempts,2);assert.equal(split.advanced.attempts,1);assert.equal(split.basic.declaredCreditsSubtotal,2);assert.equal(split.advanced.declaredCreditsSubtotal,2);
  assert.equal(split.basic.returnedUsage.reportedCreditsSubtotal,1);assert.equal(split.advanced.returnedUsage.reportedCreditsSubtotal,2);
  assert.equal(split.basic.elapsedMs,result.searches[0].elapsedMs+result.searches[1].elapsedMs);assert.equal(split.advanced.elapsedMs,result.searches[2].elapsedMs);
});

test('missing, invalid and unbounded returned usage never becomes zero actual billed usage or leaks raw telemetry',async()=>{
  const mocked=seriesTransport({needReserve:true,usages:[undefined,{credits:'PRIVATE_USAGE_STRING_NEVER_OUTPUT',private:'PRIVATE_USAGE_OBJECT_NEVER_OUTPUT'},{credits:1001}],providerTimes:[undefined,'PRIVATE_RESPONSE_TIME_NEVER_OUTPUT',-1]}),
    out=await cap12ControlSeries(keys,mocked.fetchImpl,{films:[cap12ControlFilms[0]]}),result=out.cases[0];
  assert.deepEqual(result.searches.map(search=>search.returnedUsage.state),['not-returned','invalid','invalid']);
  assert.ok(result.searches.every(search=>search.returnedUsage.credits===null&&search.providerResponseTimeSeconds===null));
  assert.equal(result.tavilyAccounting.returnedUsage.reportedRequests,0);assert.equal(result.tavilyAccounting.returnedUsage.unknownRequests,3);
  assert.equal(result.tavilyAccounting.returnedUsage.complete,false);assert.equal(result.tavilyAccounting.declaredCredits.total,4);
  assert.doesNotMatch(JSON.stringify(out),/PRIVATE_USAGE|PRIVATE_RESPONSE|Infinity|NEVER_RETAIN/);
});

test('four-film subset sums only actual Basic/Advanced attempts without changing series selection or automatic retries',async()=>{
  const films=[cap12ControlFilms[0],cap12ControlFilms[1],cap12ControlFilms[3],cap12ControlFilms[5]],mocked=seriesTransport({needReserve:true}),
    out=await cap12ControlSeries(keys,mocked.fetchImpl,{films});
  assert.equal(mocked.sent.length,32);assert.equal(out.counts.search,12);assert.deepEqual(out.tavilyAccounting.depthAttempts,{basic:8,advanced:4,unknown:0});
  assert.equal(out.tavilyAccounting.declaredCredits.total,16);assert.equal(out.tavilyAccounting.returnedUsage.unknownRequests,12);assert.equal(out.tavilyAccounting.returnedUsage.complete,false);
  assert.equal(out.tavilyAccounting.depthAccounting.basic.declaredCreditsSubtotal,8);assert.equal(out.tavilyAccounting.depthAccounting.advanced.declaredCreditsSubtotal,8);
  assert.equal(out.tavilyAccounting.depthAccounting.basic.returnedUsage.unknownRequests,8);assert.equal(out.tavilyAccounting.depthAccounting.advanced.returnedUsage.unknownRequests,4);
  assert.deepEqual(out.cases.map(result=>result.requested.imdbId),films.map(film=>film.imdbId));
  assert.ok(out.cases.every(result=>result.counterfactualCap10.externalRequests===0));
});

test('failed Tavily dispatch retains its actual depth, declared rate and unknown usage without another attempt',async()=>{
  const mocked=transport({throwSearch:true}),out=await fockersControl(keys,mocked.fetchImpl);
  assert.equal(out.counts.search,1);assert.deepEqual(out.tavilyAccounting.depthAttempts,{basic:1,advanced:0,unknown:0});
  assert.equal(out.tavilyAccounting.declaredCredits.total,1);assert.equal(out.tavilyAccounting.returnedUsage.unknownRequests,1);
  assert.deepEqual(out.searches[0].returnedUsage,{state:'unavailable',credits:null});assert.ok(Number.isInteger(out.searches[0].elapsedMs));
});
