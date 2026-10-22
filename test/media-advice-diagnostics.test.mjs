import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { candidateDiagnostics, tavilySearch, createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { safeMediaReport, motnLanguageReport } from '../assets/media-advice-report.mjs';
import { fetchAssistedKinobaza } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { normalizeMotnFor } from '../research/grounded-answer-demo/motn.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { buildEvidence } from '../scripts/stamp-media-advice-build.mjs';
import { mediaRuntime } from '../netlify/lib/media-advice-runtime.mjs';
import { runControlDiagnostic } from '../scripts/m4-control-diagnostic.mjs';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { markup, CARD } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { IDS, motnData, detailsData } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';
const film={id:'authored',tmdbId:IDS[0],imdbId:`tt${IDS[0]}`,identityTitle:'Вигаданий фільм',originalTitle:'Authored original',year:2001,directorCount:1,directorAliases:['Authored director'],titleAliases:['Вигаданий фільм','Authored original']};
const response=html=>new Response(html,{headers:{'content-type':'text/html'}});
test('MOTN missing/null/empty/non-UA/invalid/positive stay distinct in copied report, not Kinobaza claims',()=>{
  for(const [input,expected] of [[undefined,'not-reported (missing-or-null)'],[null,'not-reported (missing-or-null)'],[[],'empty-list (completeness unknown)'],[[{language:'eng'}],'uk-not-listed (completeness unknown)'],['ukr','invalid-withheld'],[[{language:'ukr'}],'reported-uk (completeness unknown)']]){
    const data=motnData(IDS[0]);data.streamingOptions.ua[0].audios=input;
    data.streamingOptions.ua[0].subtitles=[{locale:{language:'ukr'},closedCaptions:false}];
    const result=normalizeMotnFor(data,film), stages={tmdb:{status:'off'},motn:{status:result.status,result},kinobaza:{status:'off'}};
    const composed=composeDiscovery(film,stages,{sourceURLs:{motn:'https://example.com/authored'}}),row=composed.rows[0];
    assert.equal(motnLanguageReport(row.audio),expected);
    const report=safeMediaReport(composed);assert.ok(report.includes(`MOTN audio ${expected}`));assert.match(report,/subtitles reported-uk/);assert.doesNotMatch(report,/motn\/apple:.*provider-block/);
    assert.match(safeMediaReport({rows:[{id:'kinobaza:1',provider:{key:'apple'},kinobazaLocalization:{audio:{state:'reported-positive'},subtitles:{state:'reported-negative'}}}]}),/Kinobaza provider-block audio reported-positive, subtitles reported-negative/);
  }
});
test('empty vs all-rejected vs provider error; no URL, snippet, query or score in diagnostics/report',async()=>{
  for(const [items,outcome] of [[[],'empty-response'],[[{url:CARD+'?PRIVATE=1',content:'PRIVATE_BODY',score:1}],'all-rejected']]){
    const resolver=createKinobazaResolver({apiKey:'AUTHORED_KEY'});
    const r=await resolver(film,{calls:[],reserve:async()=>{},fetchImpl:async()=>Response.json({results:items})});
    assert.equal(r.resolver.searches.length,2);assert.ok(r.resolver.searches.every(s=>s.outcome===outcome));
    const report=safeMediaReport({resolver:r.resolver});assert.ok(report.includes(outcome));assert.doesNotMatch(report,/PRIVATE|https?:|score|content|AUTHORED/);
  }
  const r=await createKinobazaResolver({apiKey:'AUTHORED_KEY'})(film,{calls:[],reserve:async()=>{},fetchImpl:async()=>new Response('',{status:429})});
  assert.equal(r.resolver.searches.length,1);assert.equal(r.resolver.searches[0].status,'search-rate-limit');assert.equal(r.resolver.searches[0].returned,null);
  const d=candidateDiagnostics([{url:CARD},{url:CARD},{url:'http://kinobazaua.com/titles/a'},{url:'https://u@kinobazaua.com/titles/a'},{url:'https://kinobazaua.com:443/titles/a'},{url:CARD+'#x'},{url:CARD+'/sub'}]);
  assert.deepEqual(d.diagnostics,{returned:7,admitted:1,duplicates:1,rejected:5,rejectionCategories:{'unsafe-scheme':1,credentials:1,port:1,fragment:1,'unsupported-path':1}});
});
test('identity comparison values only reach explicit local hook; safe diagnostics preserve gates/withholding',async()=>{
  for(const [changes,status,gate] of [[{},'matched',null],[{title:'PRIVATE_OBSERVED_TITLE'},'mismatch','heading-alias'],[{director:'PRIVATE_DIRECTOR'},'unresolved','director-alias'],[{stable:'<tr><td>IMDb:</td><td>tt999900002</td></tr>',director:'PRIVATE_DIRECTOR'},'mismatch','stable-id-conflict']]){
    let diagnostic;const result=await fetchAssistedKinobaza(CARD,film,async()=>response(markup(changes)),{onIdentityDiagnostic:d=>diagnostic=d});
    assert.equal(result.identity.status,status);assert.equal(result.identity.diagnostics.failedGate,gate);assert.equal(diagnostic.sourceURL,CARD);
    assert.ok(diagnostic.sourceIdentity.h1[0]);assert.equal(diagnostic.expected.originalTitle,undefined);assert.ok(diagnostic.expected.titleAliases.includes('Authored original'));
    assert.equal(diagnostic.sourceIdentity.directors[0],changes.director??'Authored director');
    if(status!=='matched')assert.deepEqual(result.candidates,[]);
    assert.doesNotMatch(JSON.stringify(result.identity),/PRIVATE|Authored director|Authored original|https?:/);
    const report=safeMediaReport({resolver:{cards:[{identity:status,reason:result.identity.reason,diagnostics:{...result.identity.diagnostics,unexpected:'PRIVATE_BODY'}}]}});
    assert.doesNotMatch(report,/PRIVATE|https?:/);if(gate==='heading-alias')assert.match(report,/not independent proof/);
    if(gate==='stable-id-conflict')assert.equal(result.identity.diagnostics.gates['heading-alias'],'not-evaluated');
  }
});
test('build/runtime attestation requires matching trusted deployment; IDs are independent non-capability UUIDs',()=>{
  const sha='a'.repeat(40),deployId='b'.repeat(24),env={NETLIFY:'true',CONTEXT:'branch-deploy',BRANCH:'develop',COMMIT_REF:sha,DEPLOY_ID:deployId};
  const evidence=buildEvidence(env,sha),r=mediaRuntime({deploy:{id:deployId}},evidence);
  assert.equal(r.buildSha,sha);assert.match(safeMediaReport({runtime:r}),/server build stamp/);
  assert.notEqual(r.runId,mediaRuntime({deploy:{id:deployId}},evidence).runId);
  for(const altered of [{...env,NETLIFY:'false'},{...env,BRANCH:'main'},{...env,DEPLOY_ID:'PRIVATE'},{...env,COMMIT_REF:'c'.repeat(40)}])assert.equal(buildEvidence(altered,sha).sha,null);
  assert.equal(mediaRuntime({},evidence).buildSha,null);assert.equal(mediaRuntime({deploy:{id:'c'.repeat(24)}},evidence).buildSha,null);
  assert.match(safeMediaReport({runtime:{execution:'local-diagnostic',buildSha:sha}}),/Commit: unknown/);
});
test('incomplete identity scan never reports comparison false as completed evidence',async()=>{
  const r=await fetchAssistedKinobaza(CARD,film,async()=>response(markup({stable:'<tr><td>IMDb:</td><td>tt999900001</td></tr>'.repeat(33)})));
  assert.equal(r.identity.reason,'source-identity-structure-limit');assert.equal(r.identity.diagnostics.failedGate,'structure-limit');
  assert.ok(Object.values(r.identity.diagnostics.comparisons).every(v=>v===null));assert.deepEqual(r.candidates,[]);
});
test('HTTP ignores browser SHA/run/diagnostic callbacks; no extra source requests or ledger fields',async()=>{
  const uuid='00000000-0000-4000-8000-000000000001', calls=[];
  const h=createMediaAdviceHandler({env:()=>'',client:{auth:{getUser:async()=>({data:{user:{id:uuid}}})},rpc:async(_,args)=>{calls.push(args);return{data:{id:uuid,attempts:[]}};}},run:async()=>({rows:[],runtime:{buildSha:'PRIVATE'}})});
  const r=await h(new Request('https://app.example/.netlify/functions/media-advice',{method:'POST',headers:{origin:'https://app.example',authorization:'Bearer AUTHORED','content-type':'application/json'},body:JSON.stringify({action:'discover',groupId:uuid,formSession:uuid,imdbId:film.imdbId,buildSha:'a'.repeat(40),runtime:{runId:uuid},onIdentityDiagnostic:true})}));
  const data=await r.json();assert.equal(r.status,200);assert.equal(data.result.runtime.buildSha,null);assert.notEqual(data.result.runtime.runId,uuid);assert.deepEqual(calls.map(c=>c.p_op),['start','finish']);assert.doesNotMatch(JSON.stringify(calls),/buildSha|runtime|onIdentityDiagnostic/);
});
test('local controls fail closed without both credentials, zero attempts; mocked control cap12 is not live validation',async()=>{
  const missing=await runControlDiagnostic({fetchImpl:()=>assert.fail('no credentials means no request')});assert.equal(missing.counts.total,0);assert.equal(missing.status,'blocked-missing-local-credentials');
  const calls=[],searchCount={};
  const result=await runControlDiagnostic({tmdbToken:'AUTHORED_TMDB_KEY',tavilyKey:'AUTHORED_TAVILY_KEY',fetchImpl:async(url,init)=>{
    calls.push(url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
    const u=new URL(url);
    if(u.pathname==='/3/search/movie'){const second=u.searchParams.get('query')==='Mortal Kombat';return Response.json({results:[{id:IDS[second?1:0],original_title:second?'Mortal Kombat':'Blade Runner 2049',release_date:second?'2021-01-01':'2001-01-01'}]});}
    if(u.hostname==='api.themoviedb.org'){const second=u.pathname.includes(String(IDS[1])),d=detailsData(IDS[second?1:0]);d.original_title=second?'Mortal Kombat':'Blade Runner 2049';d.release_date=second?'2021-01-01':'2001-01-01';return Response.json(d);}
    if(u.hostname==='api.tavily.com'){const second=JSON.parse(init.body).query.includes('Mortal Kombat');searchCount[second]=(searchCount[second]??0)+1;return Response.json({results:searchCount[second]===1?[]:[{url:CARD},{url:CARD+'-second'}]});}
    return response(markup({url,title:'PRIVATE_UNESTABLISHED_ALIAS'}));
  }});
  assert.deepEqual(result.counts,{tmdb:4,search:4,cards:4,total:12});assert.equal(calls.length,12);assert.equal(result.execution,'local-diagnostic');assert.equal(result.buildSha,null);
  assert.ok(calls.every(u=>!u.includes('movieofthenight')&&!u.includes('watch/providers')&&!u.includes('justwatch')));
  assert.ok(result.cases.every(c=>c.cards.length===2&&c.cards.every(d=>d.reason==='source-title-conflict')));
  assert.doesNotMatch(JSON.stringify(result),/AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY/);
});
test('new contracts have no source-body persistence/logging; only build identifiers are written by build stamp',async()=>{
  for(const path of ['../netlify/lib/kinobaza-resolver.mjs','../shared/media-advice-diagnostics.mjs','../assets/media-advice-report.mjs']){
    const source=await readFile(new URL(path,import.meta.url),'utf8');assert.doesNotMatch(source,/console\.|localStorage|sessionStorage|writeFile|appendFile/);
  }
});
test('local failed identity attempts consume count, never trigger provider search/retry or echo error bodies',async()=>{
  let calls=0;
  const r=await runControlDiagnostic({tmdbToken:'AUTHORED_TMDB_KEY',tavilyKey:'AUTHORED_TAVILY_KEY',fetchImpl:async()=>{calls++;throw Error('PRIVATE_TRANSPORT');}});
  assert.equal(calls,2);assert.deepEqual(r.counts,{tmdb:2,search:0,cards:0,total:2});assert.ok(r.cases.every(c=>c.counts.total===1));assert.doesNotMatch(JSON.stringify(r),/PRIVATE_TRANSPORT|AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY/);
});
test('local controls count each Tavily 401 once; unknown search counts are not an empty/rejected search',async()=>{
  const calls=[];
  const result=await runControlDiagnostic({tmdbToken:'AUTHORED_TMDB_KEY',tavilyKey:'AUTHORED_TAVILY_KEY',fetchImpl:async(url,init)=>{
    calls.push(url);const u=new URL(url);
    if(u.pathname==='/3/search/movie'){
      const second=u.searchParams.get('query')==='Mortal Kombat';
      return Response.json({results:[{id:IDS[second?1:0],original_title:second?'Mortal Kombat':'Blade Runner 2049',release_date:second?'2021-01-01':'2001-01-01'}]});
    }
    if(u.hostname==='api.themoviedb.org'){
      const second=u.pathname.includes(String(IDS[1])),data=detailsData(IDS[second?1:0]);
      data.original_title=second?'Mortal Kombat':'Blade Runner 2049';data.release_date=second?'2021-01-01':'2001-01-01';
      return Response.json(data);
    }
    assert.equal(url,'https://api.tavily.com/search');assert.equal(init.headers.Authorization,'Bearer AUTHORED_TAVILY_KEY');
    return new Response('PRIVATE_ERROR AUTHORED_TAVILY_KEY',{status:401});
  }});
  assert.equal(calls.length,6);assert.deepEqual(result.counts,{tmdb:4,search:2,cards:0,total:6});
  for(const item of result.cases){
    assert.equal(item.status,'search-auth-error');assert.deepEqual(item.counts,{tmdb:2,search:1,cards:0,total:3});
    assert.equal(item.resolver.searchCalls,1);assert.equal(item.resolver.cardCalls,0);assert.deepEqual(item.cards,[]);
    assert.deepEqual(item.resolver.searches,[{status:'search-auth-error',outcome:'provider-error',returned:null,admitted:null,rejected:null,duplicates:null,rejectionCategories:{}}]);
  }
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_ERROR|AUTHORED_TAVILY_KEY|AUTHORED_TMDB_KEY/);
});
