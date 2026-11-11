import test from 'node:test';
import assert from 'node:assert/strict';
import {safeIdentityDiagnostic,safePredictedDiagnostic} from '../shared/media-advice-diagnostics.mjs';
import {safeMediaReport} from '../src/media-advice/media-advice-report.mjs';
import {productMediaResult} from '../netlify/lib/media-advice-response.mjs';
import {safePossibleIrrelevantSearch} from '../shared/media-search-relevance-diagnostic.mjs';
test('new semantic/predicted diagnostics are allowlisted and cannot echo IDs, URLs, JSON or secrets',()=>{
 const data={status:'available',reason:'owned-movie-sameas',movieCount:1,idCount:2,datePublished:'2017-07-19',rawJSON:'PRIVATE_JSON',sourceURL:'https://private.invalid',ids:['PRIVATE_ID'],token:'PRIVATE_TOKEN'};
 const d=safeIdentityDiagnostic({movieSameAs:data});assert.equal(d.movieSameAs.yearAuthority,'none');assert.equal(d.movieSameAs.datePublished,'2017-07-19');assert.doesNotMatch(JSON.stringify(d),/PRIVATE_|private.invalid/);
 assert.deepEqual(safePredictedDiagnostic({status:'matched',reason:'identity-confirmed',url:'PRIVATE_URL'}),{status:'matched',reason:'identity-confirmed'});
 assert.deepEqual(safePredictedDiagnostic({status:'PRIVATE_STATUS',reason:'PRIVATE_REASON'}),{status:'unknown',reason:'unknown'});
});

test('search-only possible-irrelevance observation keeps its three-card bound and rejects confirmed cards',()=>{
 const card={title:'Other film (2001)',originalTitle:'Other film',identity:'mismatch',reason:'source-title-conflict',titleMismatch:true};
 const input={cards:Array.from({length:3},()=>({...card})),searches:[]};
 assert.equal(safePossibleIrrelevantSearch(input).cards.length,3);
 assert.equal(safePossibleIrrelevantSearch({...input,cards:[...input.cards,card]}),null);
 assert.equal(safePossibleIrrelevantSearch({...input,cards:[...input.cards.slice(0,2),{...card,identity:'matched'}]}),null);
});
test('fourth card and extra profile reservation remain visible only in privileged envelope',()=>{
 const result={film:{id:'imdb:tt1234567',imdbId:'tt1234567',title:'Authored film',year:1979},rows:[],unmapped:[],
  resolver:{status:'bounded-unresolved',predicted:{status:'unconfirmed',reason:'identity-or-markup-unconfirmed'},cards:Array.from({length:4},()=>({identity:'unresolved',reason:'director-known-person-conflict',diagnostics:{movieSameAs:{status:'available',reason:'owned-movie-sameas',movieCount:1,idCount:2,datePublished:'2017-07-19'}}}))},
  metrics:{calls:[{stage:'kinobaza-predicted'},{stage:'kinobaza-person-predicted'}]}};
 const report=safeMediaReport(result);assert.equal(report.match(/^Card:/gm).length,4);assert.match(report,/kinobaza-predicted: 1 reserved/);assert.match(report,/kinobaza-person-predicted: 1 reserved/);assert.match(report,/datePublished is not the film year/);
 const ordinary=productMediaResult(result,{mykola_media_advice:true,mykola_media_advice_diagnostics:false});assert.doesNotMatch(JSON.stringify(ordinary),/resolver|predicted|movieSameAs|datePublished|metrics|sameAs/);
});
