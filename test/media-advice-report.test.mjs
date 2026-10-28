import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMediaReport } from '../assets/media-advice-report.mjs';
test('safe report permits IMDb-bound film identity but no secrets/raw URLs/body/manual fields or attested commit', () => {
  const result = { film: { title: 'Authored Film', year: 2001, imdbId: 'tt1234567', privateField: 'PRIVATE TITLE FIELD' }, rows: [{ id: 'motn:1', provider: { key: 'apple' }, country:'UA', link: { href: 'https://secret.example/?token=PRIVATE' }, price: { value: 'PRIVATE' } }],
    sources: [{ source:'tmdb', identity:'matched', status:'PRIVATE BODY' }], metrics: { requestsMade:5, requestBudget:8, calls:[{ stage:'tmdb-find', headers:'PRIVATE' }] },
    resolver: { searchCalls:1, cardCalls:0, unexamined:0, cards:[{ identity:'unresolved', reason:'PRIVATE' }] } };
  const report = safeMediaReport(result, { draft: { title:'PRIVATE EDIT' } });
  assert.doesNotMatch(report, /https?:|PRIVATE|token|BODY|EDIT/);
  assert.match(report, /Film: "Authored Film"; year 2001; IMDb tt1234567\./);
  assert.match(report, /5\/8/); assert.match(report, /not runtime-attested/);
});

test('report prefers result identity only when bound to the captured run IMDb', () => {
  const filmContext = { title: 'Captured Title', year: '2001', imdbId: 'tt1234567', purchase_url: 'PRIVATE FORM' };
  const report = safeMediaReport({ film: { title: 'Returned Title', year: 2002, imdbId: 'tt1234567' } }, { filmContext });
  assert.match(report, /Film: "Returned Title"; year 2002; IMDb tt1234567\./); assert.doesNotMatch(report, /Captured Title|PRIVATE/);
  const fallback = safeMediaReport({ film: { title: 'UNBOUND SOURCE TITLE', year: 2009 } }, { filmContext });
  assert.match(fallback, /Film: "Captured Title"; year 2001; IMDb tt1234567\./); assert.doesNotMatch(fallback, /UNBOUND|PRIVATE/);
  const resultBound = safeMediaReport({ imdbId: 'tt1234567', film: { title: 'Root-bound Title', year: '2003' } });
  assert.match(resultBound, /Film: "Root-bound Title"; year 2003; IMDb tt1234567\./);
});

test('conflicting or invalid captured run identity cannot relabel old results as a new film', () => {
  const film = { title: 'Old Result Title', year: 2001, imdbId: 'tt1234567' };
  for (const [result, filmContext] of [
    [{ film }, { title: 'New Form Title', year: 2026, imdbId: 'tt7654321' }],
    [{ film }, { title: 'New Form Title', year: 2026, imdbId: 'not-an-imdb-id' }],
    [{ film, imdbId: 'tt7654321' }, undefined],
  ]) {
    const report = safeMediaReport(result, { filmContext });
    assert.match(report, /Film: unknown; year unknown; IMDb unknown\./);
    assert.doesNotMatch(report, /Old Result Title|New Form Title|tt1234567|tt7654321/);
  }
});

test('missing identity stays unknown and a captured context supplies only explicitly allowed fields', () => {
  const unknown = safeMediaReport({ film: { title: 'UNBOUND TITLE', year: 2001 }, runtime: { execution: 'local-diagnostic', buildSha: 'a'.repeat(40) } });
  assert.match(unknown, /Film: unknown; year unknown; IMDb unknown\./); assert.match(unknown, /Commit: unknown/);
  assert.doesNotMatch(unknown, /UNBOUND|a{40}/);
  const report = safeMediaReport({}, { filmContext: { title: 'Українська   назва "Фільм"', year: '2026', imdbId: 'tt1234567', draft: 'PRIVATE', access_token: 'PRIVATE' } });
  assert.ok(report.includes('Film: "Українська назва \\"Фільм\\""; year 2026; IMDb tt1234567.'));
  assert.doesNotMatch(report, /PRIVATE|access_token|draft/);
});

test('film identity rejects URLs, credential-shaped text, controls and overlong titles without leaking input', () => {
  const unsafeTitles = ['https://secret.example/PRIVATE', 'www.secret.example/PRIVATE', 'javascript:PRIVATE',
    'https%3A%2F%2Fsecret.example/PRIVATE', 'Bearer PRIVATE_TOKEN', 'token=PRIVATE', 'api_key:PRIVATE',
    'sk-PRIVATE123456789', 'tvly-PRIVATE123456789', 'sb_secret_PRIVATE123456789', 'eyJPRIVATE.eyJPRIVATE.PRIVATE',
    'Abcdefghijklmnopqrstuvwxyz0123456789PRIVATE', 'Title\nPRIVATE', 'Title\u0000PRIVATE', 'Title\u2028PRIVATE', 'X'.repeat(501)];
  for (const title of unsafeTitles) {
    const report = safeMediaReport({ film: { title, year: '2026', imdbId: 'tt1234567' } });
    assert.match(report, /Film: unknown; year 2026; IMDb tt1234567\./);
    assert.doesNotMatch(report, /PRIVATE|secret\.example|X{501}/);
  }
  assert.ok(safeMediaReport({ film: { title: 'X'.repeat(500), year: 2026, imdbId: 'tt1234567' } }).includes('X'.repeat(500)));
  for (const invalidYear of ['0000', '2026 PRIVATE', '2026\nPRIVATE', {}, 0, 10000]) {
    const report = safeMediaReport({ film: { title: 'Authored Film', year: invalidYear, imdbId: 'tt1234567' } });
    assert.match(report, /year unknown; IMDb tt1234567/); assert.doesNotMatch(report, /PRIVATE|\[object Object\]/);
  }
});

test('source outcomes use exact status allowlists including TMDb A/B states, never API error text', () => {
  const report = safeMediaReport({ sources: [{ source: 'tmdb', identity: 'matched', status: 'A: partial; B: api-auth-error' },
    { source: 'motn', identity: 'unresolved', status: 'no-ua-options' }, { source: 'kinobaza', identity: 'matched', status: 'one-confirmed-bounded-not-exhaustive' }] });
  assert.match(report, /tmdb: identity matched; status A: partial; B: api-auth-error/);
  assert.match(report, /motn: identity unresolved; status no-ua-options/);
  assert.match(report, /kinobaza: identity matched; status one-confirmed-bounded-not-exhaustive/);
  for (const status of ['PRIVATE_BODY https://secret.example/', 'A: ok; B: PRIVATE', 'ok\nPRIVATE', 'api-auth-error: PRIVATE', {}]) {
    const withheld = safeMediaReport({ sources: [{ source: 'tmdb', status }, { source: 'motn', status }, { source: 'kinobaza', status }] });
    assert.match(withheld, /tmdb: identity unresolved; status unknown/); assert.doesNotMatch(withheld, /PRIVATE|https?:|\[object Object\]/);
  }
});

test('staleness is an explicit local-age flag and never runtime or source freshness attestation', () => {
  assert.match(safeMediaReport({}, { stale: true }), /Result freshness: stale \(30-minute local age limit reached\); no automatic source refresh/);
  assert.match(safeMediaReport({}, { stale: false }), /Result freshness: within local 30-minute age limit; not a provider update guarantee/);
  for (const stale of [undefined, 'PRIVATE', {}]) {
    const report = safeMediaReport({}, { stale });
    assert.match(report, /Result freshness: unknown; no automatic source refresh/); assert.doesNotMatch(report, /PRIVATE/);
  }
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
