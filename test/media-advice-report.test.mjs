import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMediaReport } from '../assets/media-advice-report.mjs';
test('safe report has only allowlisted metadata, no secrets/raw URLs/body/manual fields or attested commit', () => {
  const result = { film: { title: 'PRIVATE TITLE' }, rows: [{ id: 'motn:1', provider: { key: 'apple' }, country:'UA', link: { href: 'https://secret.example/?token=PRIVATE' }, price: { value: 'PRIVATE' } }],
    sources: [{ source:'tmdb', identity:'matched', status:'PRIVATE BODY' }], metrics: { requestsMade:5, requestBudget:8, calls:[{ stage:'tmdb-find', headers:'PRIVATE' }] },
    resolver: { searchCalls:1, cardCalls:0, unexamined:0, cards:[{ identity:'unresolved', reason:'PRIVATE' }] } };
  const report = safeMediaReport(result, { draft: { title:'PRIVATE EDIT' } });
  assert.doesNotMatch(report, /https?:|PRIVATE|token|BODY|EDIT/);
  assert.match(report, /5\/8/); assert.match(report, /not runtime-attested/);
});

test('report labels only known search providers, with no URL/query or injected provider text',()=>{
  for(const provider of ['tavily','kinobaza-public-search','PRIVATE_PROVIDER']){
    const report=safeMediaReport({resolver:{searches:[{provider,status:'ok',returned:1,admitted:1,rejected:0,duplicates:0,rejectionCategories:{},query:'PRIVATE_QUERY',url:'https://secret.example/'}]}});
    assert.match(report,new RegExp(`provider ${provider==='PRIVATE_PROVIDER'?'unknown':provider}\\.`));
    assert.doesNotMatch(report,/PRIVATE|https?:/);
  }
});

test('safe extraction diagnostics distinguish lost country claims from retained localization and expose only a pointer digest',()=>{
  const result={rows:[{id:'kinobaza:0',provider:{key:'apple'},country:null}],unmapped:[],resolver:{cards:[{
    identity:'matched',cardRef:'a'.repeat(64),extractionDiagnostic:{status:'partial',candidateCount:3,foreignCandidateCount:2,blockCount:1,filmAudioState:'reported-positive',
      issues:['missing-explicit-ukraine-section','PRIVATE_BODY https://source.example/'],sourceURL:'https://source.example/?token=PRIVATE',html:'PRIVATE_HTML'},
  }]}};
  const report=safeMediaReport(result);
  assert.match(report,/Extraction: partial; candidates 3, foreign-context 2, localization blocks 1, film audio reported-positive/);
  assert.match(report,/missing-explicit-ukraine-section/);assert.match(report,/requested-card SHA256 a{64}/);
  assert.match(report,/Kinobaza projection: mapped 1; other platforms 0; foreign-context candidates are not UA offers/);
  assert.match(report,/territory unknown/);assert.doesNotMatch(report,/PRIVATE|https?:|HTML/);
  result.resolver.cards[0].cardRef='https://secret.example/PRIVATE';result.resolver.cards[0].extractionDiagnostic={status:'PRIVATE',candidateCount:-1,foreignCandidateCount:'0',blockCount:100000,filmAudioState:'PRIVATE',issues:['PRIVATE']};
  const withheld=safeMediaReport(result);assert.match(withheld,/Extraction: unknown; candidates unknown, foreign-context unknown, localization blocks unknown, film audio unknown/);
  assert.match(withheld,/requested-card SHA256 unknown/);assert.doesNotMatch(withheld,/PRIVATE|https?:/);
});
