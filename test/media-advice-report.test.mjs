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
