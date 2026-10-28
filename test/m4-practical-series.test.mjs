// Authored TMDb/search/HTML responses only; no live requests or reconstructed pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { practicalFilms, practicalStudies, practicalOperation, inspectPublicIdentity } from '../scripts/m4-practical-series.mjs';
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

test('pilot study has three title/year-only controls and selects them without changing the historical default',async()=>{
  assert.equal(practicalStudies['practical-five'],practicalFilms);
  assert.deepEqual(practicalStudies['pilot-retrieval'],[
    {title:'Blade Runner',year:1982},{title:'Mortal Kombat',year:2021},{title:'Supergirl',year:2026},
  ]);
  assert.ok(practicalStudies['pilot-retrieval'].every(f=>Object.keys(f).sort().join(',')==='title,year'));
  for (const [i,control] of practicalStudies['pilot-retrieval'].entries()) {
    const calls=[];
    const out=await practicalOperation({...keys,operation:{action:'identify',film:i+1},context:{study:'pilot-retrieval'}},async(url,init)=>{
      calls.push(url);assert.equal(init.method,'GET');
      if(calls.length===1) {
        assert.equal(url,`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(control.title)}&language=uk-UA&include_adult=false&page=1&year=${control.year}`);
        return Response.json({results:[{id:IDS[0],original_title:control.title,release_date:`${control.year}-01-01`}]});
      }
      return Response.json({...detailsData(IDS[0]),original_title:control.title,release_date:`${control.year}-01-01`});
    });
    assert.equal(out.result.status,'identity-established');assert.equal(out.result.film,`${control.title} (${control.year})`);
    assert.equal(out.result.counts.tmdb,2);assert.equal(calls.length,2);
  }
  for(const context of [{study:'unknown'},{study:'pilot-retrieval'}]) {
    const out=await practicalOperation({...keys,operation:{action:'identify',film:4},context},()=>assert.fail('invalid study/control cannot fetch'));
    assert.match(out.result.status,/invalid-local/);assert.equal(out.result.counts.total,0);
  }
});

test('director inspection admits one fixed GET only from a cached single trusted TMDb person',async()=>{
  const film={directorCount:1,directorPeople:[{namespace:'tmdb:person',personId:999999,names:['Authored director']}]};
  const data={id:999999,name:'Authored director',also_known_as:['Авторський режисер'],birthday:'1970-02-28',imdb_id:'nm9999999',external_ids:{imdb_id:'nm9999999'},biography:'AUTHORED_PRIVATE_BIO',homepage:'https://private.example/?key=AUTHORED_PRIVATE_URL'};
  const calls=[];
  const out=await practicalOperation({...keys,operation:{action:'inspect-director',film:1},context:{study:'pilot-retrieval',films:{1:film}}},async(url,init)=>{
    calls.push(url);assert.equal(url,'https://api.themoviedb.org/3/person/999999?language=uk-UA&append_to_response=external_ids');
    assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.headers.Authorization,`Bearer ${keys.tmdbToken}`);
    return Response.json(data);
  });
  assert.equal(out.result.status,'director-identity-inspected');assert.equal(calls.length,1);
  assert.deepEqual(out.result.counts,{tmdb:1,search:0,cards:0,personPages:0,total:1});
  assert.deepEqual(out.result.directorIdentity,{personId:999999,name:'Authored director',alsoKnownAs:['Авторський режисер'],dateOfBirth:'1970-02-28',imdbNameId:'nm9999999'});
  assert.equal(out.result.identity,undefined);assert.doesNotMatch(JSON.stringify(out),/AUTHORED_PRIVATE|biography|homepage|AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY/);
  for(const cached of [undefined,{...film,directorCount:2},{...film,directorPeople:[{namespace:'tmdb:person',personId:'999999'}]}]) {
    const refused=await practicalOperation({...keys,operation:{action:'inspect-director',film:1},context:{films:{1:cached}}},()=>assert.fail('uncached/ambiguous director cannot fetch'));
    assert.equal(refused.result.status,'cached-single-director-required');assert.equal(refused.result.counts.total,0);
  }
  for(const changed of [{id:999998},{also_known_as:Array(33).fill('Authored')},{birthday:'1970-02-30'},{external_ids:{imdb_id:'nm8888888'}},{external_ids:{id:999998}}]) {
    const refused=await practicalOperation({...keys,operation:{action:'inspect-director',film:1},context:{films:{1:film}}},async()=>Response.json({...data,...changed}));
    assert.equal(refused.result.status,'tmdb-person-identity-refused');assert.equal(refused.result.counts.tmdb,1);assert.equal(refused.result.directorIdentity,undefined);
  }
  const arbitraryURL=await practicalOperation({...keys,operation:{action:'inspect-director',film:1,url:'https://api.themoviedb.org/3/person/1'},context:{films:{1:film}}},()=>assert.fail('director URL cannot be supplied'));
  assert.equal(arbitraryURL.result.status,'invalid-operation');assert.equal(arbitraryURL.result.counts.total,0);
});

test('director inspection refuses root/appended API errors and malformed external IDs without rejecting missing optional IDs',async()=>{
  const film={directorCount:1,directorPeople:[{namespace:'tmdb:person',personId:999999,names:['Authored director']}]};
  const data={id:999999,name:'Authored director',also_known_as:[],imdb_id:'nm9999999',external_ids:{imdb_id:'nm9999999'}};
  const inspect=async changed=>{
    let calls=0;
    const out=await practicalOperation({...keys,operation:{action:'inspect-director',film:1},context:{films:{1:film}}},async()=>{
      calls++;return Response.json({...data,...changed,status_message:'AUTHORED_PRIVATE_ERROR'});
    });
    assert.equal(calls,1);assert.equal(out.result.counts.tmdb,1);assert.equal(out.result.counts.total,1);
    assert.doesNotMatch(JSON.stringify(out),/AUTHORED_PRIVATE_ERROR|status_message/);
    return out.result;
  };
  for(const changed of [{success:false},{status_code:7},{external_ids:{success:false}},{external_ids:{status_code:7}},
    {external_ids:'invalid-object'},{external_ids:[]},{external_ids:false},{external_ids:7}]){
    const refused=await inspect(changed);
    assert.equal(refused.status,'tmdb-person-identity-refused');assert.equal(refused.directorIdentity,undefined);
  }
  for(const external_ids of [undefined,null]){
    const accepted=await inspect({external_ids});
    assert.equal(accepted.status,'director-identity-inspected');assert.equal(accepted.directorIdentity.imdbNameId,'nm9999999');
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
  assert.equal(out.result.discovery.mappedCount,2);assert.equal(out.result.discovery.unmappedCount,0);
  const discovery=out.result.confirmed[0].discovery;
  assert.equal(discovery.filmUkrainianAudio.state,'reported-positive');
  assert.ok(discovery.mapped.some(r=>r.audio.state==='reported-positive'&&r.subtitles.state==='reported-negative'));
  assert.ok(discovery.mapped.every(r=>r.providerKey==='apple'));
  assert.deepEqual(discovery.extractionIssues,[]);
  assert.equal(out.result.searchPointers.length,2);assert.equal(out.result.searchPointers[1][0].originalPathname,'/titles/authored-original');
  assert.deepEqual(out.context,{films:{1:film}},'no search response or HTML is retained in session context');
  assert.doesNotMatch(JSON.stringify(out),/AUTHORED_PRIVATE|AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY|<div|<h1|click\.justwatch|AUTHOR%2fONLY|author=%2F/);
});
