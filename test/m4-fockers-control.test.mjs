import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fockersControl } from '../scripts/m4-fockers-control.mjs';
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
