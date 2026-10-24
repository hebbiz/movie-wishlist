// Authored TMDb/search/HTML responses only; no live requests or reconstructed pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { practicalFilms, practicalOperation, inspectPublicIdentity } from '../scripts/m4-practical-series.mjs';
import { detailsData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
const keys = {tmdbToken:'AUTHORED_TMDB_KEY',tavilyKey:'AUTHORED_TAVILY_KEY'};
test('five locked controls have no supplied source URLs and invalid operations cannot fetch',async()=>{
  assert.equal(practicalFilms.length,5); assert.ok(practicalFilms.every(f=>Object.keys(f).sort().join(',')==='title,year'));
  for(const operation of [{action:'resolve',film:6},{action:'resolve',film:0},{action:'resolve',film:1,extra:true},
    {action:'inspect-card',film:1,url:'https://kinobazaua.com/persons/authored'},
    {action:'inspect-person',film:1,url:'https://kinobazaua.com/persons/authored?secret=hidden'},
    {action:'inspect-person',film:1,url:'https://foreign.example/persons/authored'}]) {
    const out=await practicalOperation({...keys,operation,context:null},()=>assert.fail('invalid operation cannot dispatch'));
    assert.equal(out.result.counts.total,0); assert.match(out.result.status,/invalid|unadmitted/);
  }
});
test('trusted identity is reused in parent-memory context; actual resolver still reserves its stages',async()=>{
  const fetched=[];
  const send=async(url,init)=>{
    fetched.push(url); assert.equal(init.redirect,'manual'); assert.equal(init.credentials,'omit');
    if(url.includes('/search/movie?'))return Response.json({results:[{id:IDS[0],original_title:'Blade Runner 2049',release_date:'2017-01-01'}]});
    if(url.includes(`/movie/${IDS[0]}?`))return Response.json({...detailsData(IDS[0]),original_title:'Blade Runner 2049',release_date:'2017-01-01'});
    assert.equal(url,'https://api.tavily.com/search');return Response.json({results:[]});
  };
  const first=await practicalOperation({...keys,operation:{action:'identify',film:1}},send);
  assert.equal(first.result.status,'identity-established'); assert.equal(first.result.counts.tmdb,2);
  assert.equal(first.context.films[1].tmdbId,IDS[0]);
  const second=await practicalOperation({...keys,operation:{action:'resolve',film:1},context:first.context},send);
  assert.equal(second.result.counts.tmdb,0);assert.equal(second.result.counts.search,2);assert.equal(second.result.counts.cards,0);
  assert.equal(second.result.status,'no-admitted-search-candidates');assert.equal(fetched.length,4);
  assert.doesNotMatch(JSON.stringify([first,second]),/AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY|authorization|snippet|content/);
  const status=await practicalOperation({...keys,operation:{action:'status'},context:first.context},()=>assert.fail('status has no HTTP'));
  assert.deepEqual(status.result.cachedFilms,[1]);assert.equal(status.result.counts.total,0);
});
test('public inspection emits bounded identity fields rather than arbitrary content',()=>{
  const inspected=inspectPublicIdentity(markup()+'<p>AUTHORED_PRIVATE_BODY</p><script>AUTHORED_PRIVATE_SCRIPT</script>','https://kinobazaua.com/titles/authored-card');
  assert.ok(inspected.headings.some(h=>h.text==='Authored original'));
  assert.doesNotMatch(JSON.stringify(inspected),/AUTHORED_PRIVATE|<html|<table|at=|click.justwatch/);
  const profile=inspectPublicIdentity('<h1>Authored person</h1><h2>AUTHORED_FILMOGRAPHY</h2><p>AUTHORED_BIOGRAPHY</p>','https://kinobazaua.com/persons/authored-person');
  assert.equal(profile.profileHeading,'Authored person');
  assert.doesNotMatch(JSON.stringify(profile),/AUTHORED_FILMOGRAPHY|AUTHORED_BIOGRAPHY/);
});

test('series uses the actual public-search fallback, counts it, and keeps only safe ephemeral pointers',async()=>{
  const film={id:'authored',tmdbId:IDS[0],imdbId:`tt${IDS[0]}`,identityTitle:'Вигаданий фільм',originalTitle:'Authored original',year:2001,directorCount:1,directorAliases:['Authored director'],titleAliases:['Вигаданий фільм','Authored original']};
  const wrong='https://kinobazaua.com/titles/authored-wrong',correct='https://kinobazaua.com/titles/authored-original';
  const sent=[];
  const out=await practicalOperation({...keys,operation:{action:'resolve',film:1},context:{films:{1:film}}},async(url,init)=>{
    sent.push(url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
    if(url==='https://api.tavily.com/search')return Response.json({results:[{url:wrong,content:'AUTHORED_PRIVATE_SNIPPET'}]});
    if(url.startsWith('https://kinobazaua.com/search?')){
      assert.equal(init.method,'GET');assert.equal(init.headers.Authorization,undefined);
      return new Response('<div id="nav-titles"><a href="/titles/authored-original">AUTHORED_PRIVATE_SEARCH_TEXT</a></div>',{headers:{'content-type':'text/html'}});
    }
    assert.ok([wrong,correct].includes(url));return new Response(markup({url,...(url===wrong?{title:'Different authored film'}:{})}),{headers:{'content-type':'text/html'}});
  });
  assert.equal(out.result.status,'ok');assert.equal(sent.length,4);
  assert.deepEqual(out.result.counts,{tmdb:0,search:2,cards:2,personPages:0,total:4});
  assert.deepEqual(out.result.resolver.searches.map(s=>s.provider),['tavily','kinobaza-public-search']);
  assert.equal(out.result.confirmed[0].sourceURL,correct);assert.equal(out.result.confirmed[0].providerBlocks,1);
  assert.equal(out.result.searchPointers.length,2);assert.equal(out.result.searchPointers[1][0].originalPathname,'/titles/authored-original');
  assert.deepEqual(out.context,{films:{1:film}},'no search response or HTML is retained in session context');
  assert.doesNotMatch(JSON.stringify(out),/AUTHORED_PRIVATE|AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY|<div|<h1/);
});
