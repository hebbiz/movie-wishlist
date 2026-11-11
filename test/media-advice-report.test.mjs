import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMediaReport, mediaSourceDetails } from '../src/media-advice/media-advice-report.mjs';
import { authoredGroupedMediaRows, authoredDuneMediaResult } from './media-advice-group.fixture.mjs';
import { fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { CARD, markup } from './assisted-kinobaza.fixture.mjs';
import { IDS } from './film-workflow.fixture.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { safeDirectorProfileDiagnostic } from '../shared/director-profile-diagnostics.mjs';

test('recovered noncritical markup is named without retaining parser attributes or arbitrary issue content', () => {
 for (const issue of ['noncritical-image-markup-recovered', 'noncritical-recommendation-markup-recovered']) {
  const report = safeMediaReport({ resolver: { cards: [{ identity: 'matched', extractionDiagnostic: {
    status: 'partial', issues: [issue, 'PRIVATE_ATTRIBUTE', 'https://private.example/'],
    candidateCount: 3, foreignCandidateCount: 0, blockCount: 3, filmAudioState: 'unknown', raw: 'PRIVATE_BODY',
  } }] } });
  assert.match(report, /Extraction: partial; candidates 3.*localization blocks 3/);
  assert.ok(report.includes(`issues ["${issue}"]`));
  assert.doesNotMatch(report, /PRIVATE|https?:|raw|ATTRIBUTE/);
 }
});

test('Dune authored source signs and M4 region interpretation are separate in the copied report, without changing source rows', async () => {
  const result = await authoredDuneMediaResult(), before = JSON.stringify(result.rows);
  const report = safeMediaReport(result);
  assert.match(report, /M4 Kinobaza interpretation\/apple: UA by application rule matched-provider-block-app-ua-interpretation; audio reported-positive, subtitles reported-negative; not independently verified availability or offer binding/);
  for (const key of ['rakuten','megogo']) assert.match(report, new RegExp(`M4 Kinobaza interpretation/${key}:.*audio reported-positive, subtitles reported-positive`));
  assert.match(report, /kinobaza\/apple: territory unknown/);
  assert.match(report, /Kinobaza apple\/variant-1 audio source values: reported-positive.*Укр\. звук \(стерео\).*"literal":"\+"/);
  assert.match(report, /Kinobaza apple\/variant-1 subtitles source values: reported-negative.*"literal":"−"/);
  assert.match(report, /Kinobaza megogo\/variant-1 audio source values: reported-positive.*укр\. аудіо/);
  assert.doesNotMatch(report, /https?:|AUTHOR%|9999001|9999002|<html/);
  assert.equal(JSON.stringify(result.rows), before);
});

test('literal Kinobaza diagnostics are bounded and withhold URL/credential-shaped or unsupported labels and values', () => {
  const row = authoredGroupedMediaRows()[6];
  row.kinobazaLocalization.audio.evidence = [
    { label: 'Укр. звук (token=PRIVATE)', literal: '+', state: 'positive' },
    { label: 'Укр. звук (https://private.example/PRIVATE)', literal: 'PRIVATE', state: 'PRIVATE' },
    { label: 'PRIVATE BODY', literal: '−', state: 'negative' },
    ...Array.from({ length: 9 }, () => ({ label: 'Укр. звук (стерео)', literal: '+', state: 'positive' })),
  ];
  const report = safeMediaReport({ rows: [row] });
  assert.match(report, /"label":"withheld","literal":"\+","state":"positive"/);
  assert.match(report, /"label":"withheld","literal":"unknown","state":"unknown"/);
  assert.match(report, /omitted 4/);
  assert.doesNotMatch(report, /PRIVATE|https?:|private\.example|token=/);
});

test('empty source value remains distinct from a missing language field without implying absence', () => {
  const row = authoredGroupedMediaRows()[6];
  row.kinobazaLocalization.audio = { state: 'unknown', evidence: [{ label: 'Укр. звук', literal: '', state: 'unknown' }] };
  delete row.kinobazaLocalization.subtitles;
  const report = safeMediaReport({ rows: [row] });
  assert.match(report, /audio source values: unknown; evidence \[\{"label":"Укр\. звук","literal":"","state":"unknown"\}\]/);
  assert.match(report, /subtitles source values: unknown; evidence \[\]/);
  assert.equal(mediaSourceDetails(row).kinobazaLocalization.audio.evidence[0].literal, '');
});

test('diagnostic-only projections retain literal localization evidence and unmapped access without URLs or raw/secret fields', () => {
  const row = { source: 'kinobaza', name: 'Plex', access: { state: 'reported', value: 'rent' }, reason: 'provider-mapping-unresolved',
    provenance: { source: 'Kinobaza HTML', sourceURL: 'https://private.example/PRIVATE', body: 'PRIVATE_BODY', token: 'PRIVATE_TOKEN' },
    kinobazaLocalization: { href: 'https://private.example/PRIVATE', audio: { state: 'reported-positive', evidence: [{ label: 'Укр. звук (dolby)', literal: '+', state: 'positive', formatLiteral: 'dolby', rawHTML: 'PRIVATE_HTML' }] } },
    observations: [{ audio: { state: 'reported', ukrainian: [{ language: 'ukr' }] }, quality: { state: 'reported', value: 'hd' }, price: { state: 'reported', amount: { state: 'reported', value: '1.23' }, currency: { state: 'reported', value: 'XXX' } }, link: { href: 'https://private.example/PRIVATE' } }],
    body: 'PRIVATE_BODY', credentials: 'PRIVATE_SECRET' };
  const before = JSON.stringify(row), details = mediaSourceDetails(row), text = JSON.stringify(details);
  assert.equal(details.name, 'Plex'); assert.equal(details.access.value, 'rent');
  assert.match(text, /Укр\. звук \(dolby\)/); assert.match(text, /provider-mapping-unresolved/);
  assert.match(text, /1\.23/); assert.match(text, /XXX/); assert.match(text, /ukr/);
  assert.doesNotMatch(text, /PRIVATE|https?:|sourceURL|href|rawHTML|credentials|body/);
  assert.equal(JSON.stringify(row), before);
  for (const value of ['https://private.example/PRIVATE','token=PRIVATE','Bearer PRIVATE','tvly-PRIVATE123456789']) {
    assert.equal(mediaSourceDetails({ name: value }).name, '[withheld]');
  }
});
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

test('all eight Prime/HBO/Rakuten source claims retain their own generated group-variant references and scopes', () => {
  const rows = authoredGroupedMediaRows();
  rows[0].quality = { state: 'reported', value: 'PRIVATE_QUALITY' };
  rows[0].price = { state: 'reported', amount: { state: 'invalid', value: 'PRIVATE_PRICE' }, currency: { state: 'reported', value: 'PRIVATE_CURRENCY' } };
  rows[6].kinobazaLocalization.issues = ['ambiguous-provider-block', 'possible-block-conflict-scope-unestablished', 'PRIVATE_BLOCK_ISSUE https://secret.example/'];
  const before = JSON.stringify(rows), report = safeMediaReport({ rows });
  assert.equal((report.match(/^(?:motn|tmdb|kinobaza)\/(?:prime|hbo|rakuten):/gm) ?? []).length, 8);
  assert.equal((report.match(/^Variant /gm) ?? []).length, 8);
  for (const [reference, source, access] of [
    ['prime/variant-1', 'motn', 'rental'], ['prime/variant-2', 'motn', 'purchase'],
    ['hbo/variant-1', 'motn', 'subscription'], ['hbo/variant-2', 'tmdb', 'subscription'],
    ['rakuten/variant-1', 'motn', 'rental'], ['rakuten/variant-2', 'tmdb', 'buy'],
    ['rakuten/variant-3', 'kinobaza', 'subscription'], ['rakuten/variant-4', 'motn', 'subscription'],
  ]) assert.ok(report.includes(`Variant ${reference}: source ${source}; access ${access};`));
  assert.match(report, /Variant prime\/variant-1: source motn; access rental; quality reported; price reported \(amount invalid, currency reported\)/);
  assert.match(report, /motn\/prime: UA source context; MOTN audio reported-uk/);
  assert.match(report, /motn\/prime: UA source context; MOTN audio unknown/);
  assert.match(report, /kinobaza\/rakuten: territory unknown; Kinobaza provider-block audio reported-positive, subtitles reported-positive/);
  assert.match(report, /conflicts 1 \[audio:unverified-flag\]/);
  assert.match(report, /block issues \[ambiguous-provider-block, possible-block-conflict-scope-unestablished\]/);
  assert.doesNotMatch(report, /PRIVATE|AUTHORED|AUTHOR%|https?:|authored-conflict|sourceURL|snippet/);
  assert.equal(JSON.stringify(rows), before);
});

test('variant diagnostics preserve only allowlisted access, field states, conflict fields/types and block issue codes', () => {
  const row = { id: 'kinobaza:PRIVATE_ROW', identityStatus: 'matched', provider: { key: 'rakuten', name: 'PRIVATE_PLATFORM' },
    provenance: { source: 'PRIVATE_SOURCE', sourceURL: 'https://secret.example/?token=PRIVATE', snippet: 'PRIVATE_SNIPPET' },
    access: { state: 'reported', value: 'PRIVATE_ACCESS' }, quality: { state: 'PRIVATE_QUALITY', value: 'PRIVATE_QUALITY_VALUE' },
    price: { state: 'invalid', amount: { state: 'PRIVATE_AMOUNT', value: 'PRIVATE_PRICE' }, currency: { state: 'not-reported', value: 'PRIVATE_CURRENCY' } },
    conflicts: [{ field: 'subtitles', type: 'conflicting-block-labels', source: 'PRIVATE_CONFLICT_SOURCE' }, { field: 'PRIVATE_FIELD', type: 'PRIVATE_TYPE' }],
    kinobazaLocalization: { issues: ['unsupported-provider-block', 'conflicting-block-labels', 'PRIVATE_ISSUE', 'unsupported-provider-block'] } };
  const report = safeMediaReport({ rows: [row] });
  assert.match(report, /Variant rakuten\/variant-1: source kinobaza; access unknown; quality unknown; price invalid \(amount unknown, currency not-reported\)/);
  assert.match(report, /conflicts 2 \[subtitles:conflicting-block-labels, unknown-field:unverified-flag\]/);
  assert.match(report, /block issues \[unsupported-provider-block, conflicting-block-labels\]/);
  assert.doesNotMatch(report, /PRIVATE|https?:|sourceURL|snippet|\[object Object\]/);
});

test('unresolved groups get distinct generated references and source labels only use exact recognized provenance', () => {
  const base = { identityStatus: 'matched', provider: { key: 'prime' }, audio: { state: 'unknown' }, subtitles: { state: 'unknown' } };
  const rows = [{ ...base, id: 'motn:canonical' }, { ...base, id: 'PRIVATE_ID', identityStatus: 'unresolved', provenance: { source: 'Movie of the Night' } },
    { ...base, id: 'PRIVATE_ID', providerConflict: true, provenance: { source: '__proto__' } },
    { ...base, id: 'PRIVATE_ID', provider: { key: '__proto__' }, provenance: { source: 'constructor' } }];
  const report = safeMediaReport({ rows });
  assert.match(report, /Variant prime\/variant-1: source motn/);
  assert.match(report, /Variant unmapped-group-2\/variant-1: source motn/);
  assert.match(report, /Variant unmapped-group-3\/variant-1: source unknown.*provider conflict yes/);
  assert.match(report, /Variant unmapped-group-4\/variant-1: source unknown/);
  assert.doesNotMatch(report, /PRIVATE|__proto__|constructor|function Object|\[object Object\]/);
});

test('supplementary variant diagnostics retain the existing maximum of 24 reported source rows', () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ id: `motn:PRIVATE_${index}`, identityStatus: 'matched', provider: { key: 'prime' } }));
  const report = safeMediaReport({ rows });
  assert.equal((report.match(/^motn\/prime:/gm) ?? []).length, 24);
  assert.equal((report.match(/^Variant /gm) ?? []).length, 24);
  assert.match(report, /Variant prime\/variant-24:/); assert.doesNotMatch(report, /variant-25|PRIVATE/);
});

test('row comparison diagnostics retain discrepancy versus non-comparable distinctions without peer IDs or raw values', () => {
  const reasons = ['package-scope-unresolved','version-scope-unresolved','package-differs','version-differs',
    'same-declared-card-offer-scope-unknown','card-pointer-equivalence-unestablished'];
  for (const reason of reasons) {
    const outcome = reason === 'same-declared-card-offer-scope-unknown' ? 'possible-discrepancy' : 'non-comparable';
    const row = { id: 'motn:PRIVATE_ROW', identityStatus: 'matched', provider: { key: 'prime' }, comparisonsOmitted: 3,
      comparisons: [{ field: 'quality', outcome, reason, peer: 'https://secret.example/PRIVATE_PEER', value: 'PRIVATE_VALUE' },
        { field: 'PRIVATE_FIELD', outcome: 'PRIVATE_OUTCOME', reason: 'PRIVATE_REASON', peer: 'PRIVATE_PEER' }] };
    const report = safeMediaReport({ rows: [row] });
    assert.ok(report.includes(`comparisons 2 [quality:${outcome}:${reason}, unknown-field:unknown:unknown]; comparisons omitted 3.`));
    assert.doesNotMatch(report, /PRIVATE|https?:|peer|value|snippet/);
  }
  const comparisons = Array.from({ length: 8 }, () => ({ field: 'price', outcome: 'non-comparable', reason: 'package-differs' }));
  const report = safeMediaReport({ rows: [{ id: 'motn:0', provider: { key: 'prime' }, comparisons, comparisonsOmitted: 'PRIVATE_COUNT' }] });
  assert.equal((report.match(/price:non-comparable:package-differs/g) ?? []).length, 4);
  assert.match(report, /comparisons 8 \[/); assert.match(report, /comparisons omitted unknown/); assert.doesNotMatch(report, /PRIVATE/);
});

// Author-written film IDs/HTML only; not archived source pages or live evidence.
const cascadeFilm = { id:'authored-cascade', tmdbId:IDS[0], imdbId:`tt${IDS[0]}`, identityTitle:'Вигаданий фільм',
  originalTitle:'Authored original', year:2001, titleAliases:[], directorAliases:['Authored director'], directorCount:1 };
const reportCard = identity => ({ identity:identity.status, reason:identity.reason, diagnostics:identity.diagnostics });
async function authoredCascadeIdentity({ film = cascadeFilm, html = markup() } = {}) {
  return (await fetchAssistedKinobaza(CARD,film,async () => new Response(html,{headers:{'content-type':'text/html'}}))).identity;
}

test('same-ID/title/year report recognizes the cascade route without claiming that skipped director gates passed',async()=>{
  const identity=await authoredCascadeIdentity({html:markup({director:'Unconfirmed authored spelling',stable:`<tr><td>IMDb:</td><td>tt${IDS[0]}</td></tr>`})});
  assert.equal(identity.status,'matched');assert.equal(identity.reason,'explicit-stable-title-year-match');
  const report=safeMediaReport({resolver:{cards:[reportCard(identity)]}});
  assert.match(report,/Card: matched; reason explicit-stable-title-year-match; gate none-or-unknown/);
  assert.match(report,/Identity route stable-id-title-year; years \{"selected":2001,"source":2001,"delta":0\}/);
  for(const gate of ['director-presence','director-scope','director-alias']){
    assert.equal(identity.diagnostics.gates[gate],'not-evaluated');
    assert.ok(report.includes(`"${gate}":"not-evaluated"`));assert.ok(!report.includes(`"${gate}":"pass"`));
  }
  assert.match(report,/"stableIdMatch":true/);assert.match(report,/"directorAliasMatch":false/);
  assert.doesNotMatch(report,/Unconfirmed authored spelling|Authored director|https?:|tt999900001/);
});

test('different-year confirmation reports numeric selected/source/delta and actual director checks separately',async()=>{
  for(const [selected,source,delta] of [[2008,2006,-2],[2006,2008,2]]){
    const identity=await authoredCascadeIdentity({film:{...cascadeFilm,year:selected},html:markup({year:source,stable:`<tr><td>TMDb:</td><td>${IDS[0]}</td></tr>`})});
    assert.equal(identity.status,'matched');assert.equal(identity.reason,'explicit-stable-and-structural-match');
    const report=safeMediaReport({resolver:{cards:[reportCard(identity)]}});
    assert.ok(report.includes(`Identity route stable-id-title-director-year-variance; years ${JSON.stringify({selected,source,delta})}`));
    assert.match(report,/"yearEqual":false/);
    for(const gate of ['director-presence','director-scope','director-alias'])assert.ok(report.includes(`"${gate}":"pass"`));
  }
});

test('missing/invalid years and legacy diagnostics remain unknown rather than inventing a cascade route or fresh result',()=>{
  const legacy=safeMediaReport({resolver:{cards:[{identity:'matched',reason:'explicit-title-year-director-match',diagnostics:{gates:{'director-alias':'pass'}}}]}},{stale:true});
  assert.match(legacy,/reason explicit-title-year-director-match/);
  assert.match(legacy,/Identity route unconfirmed; years \{"selected":null,"source":null,"delta":null\}/);
  assert.match(legacy,/Result freshness: stale/);assert.match(legacy,/"director-presence":"not-evaluated"/);
  for(const years of [undefined,null,{}, {selected:2001}, {source:2006}, {selected:'2001',source:'2006'},
    {selected:0,source:10000},{selected:NaN,source:Infinity}]){
    const report=safeMediaReport({resolver:{cards:[{identity:'unresolved',reason:'selected-year-missing',diagnostics:{years}}]}});
    const selected=years?.selected===2001?2001:null,source=years?.source===2006?2006:null;
    assert.ok(report.includes(`Identity route unconfirmed; years ${JSON.stringify({selected,source,delta:null})}`));
    assert.doesNotMatch(report,/NaN|Infinity|\[object Object\]/);
  }
});

test('cascade diagnostics withhold injected strategy/year/ID/URL/secret fields and recompute delta',()=>{
  const malicious=['PRIVATE_STRATEGY','https://private.example/?token=PRIVATE','Bearer PRIVATE_TOKEN',{},['stable-id-title-year']];
  for(const strategy of malicious){
    const report=safeMediaReport({resolver:{cards:[{identity:'matched',reason:'explicit-stable-title-year-match',sourceURL:'https://private.example/PRIVATE_CARD',
      tmdbId:'PRIVATE_TMDB_ID',imdbId:'PRIVATE_IMDB_ID',directorPersonId:'PRIVATE_PERSON_ID',rawHTML:'PRIVATE_HTML',
      diagnostics:{strategy,years:{selected:'2001 token=PRIVATE',source:{raw:'PRIVATE_YEAR'},delta:'PRIVATE_DELTA'},
        sourceURL:'https://private.example/PRIVATE',ids:{imdb:'PRIVATE_ID'},personId:'PRIVATE_PERSON',raw:'PRIVATE_BODY',
        gates:{'director-alias':'PRIVATE_GATE',PRIVATE_GATE:'pass'},comparisons:{stableIdMatch:'PRIVATE_FLAG'},counts:{directorCount:'PRIVATE_COUNT'}}}]}});
    assert.match(report,/Identity route unconfirmed; years \{"selected":null,"source":null,"delta":null\}/);
    assert.match(report,/"director-alias":"not-evaluated"/);assert.match(report,/"stableIdMatch":null/);
    assert.doesNotMatch(report,/PRIVATE|https?:|Bearer|token=|rawHTML|sourceURL|personId|tmdbId|imdbId/);
  }
  const recomputed=safeMediaReport({resolver:{cards:[{identity:'matched',diagnostics:{strategy:'stable-id-title-director-year-variance',years:{selected:2008,source:2006,delta:'PRIVATE_DELTA'}}}]}});
  assert.match(recomputed,/years \{"selected":2008,"source":2006,"delta":-2\}/);assert.doesNotMatch(recomputed,/PRIVATE/);
});

test('ordinary Beta product projection omits cascade diagnostics independently of the matched route',async()=>{
  const identity=await authoredCascadeIdentity({html:markup({director:'Unconfirmed authored spelling',stable:`<tr><td>IMDb:</td><td>tt${IDS[0]}</td></tr>`})});
  const result={film:{id:'imdb:tt1234567',imdbId:'tt1234567',title:'Authored film',year:2001},rows:[],resolver:{cards:[reportCard(identity)]},
    runtime:{runId:'PRIVATE_RUN'},metrics:{requestsMade:5,requestBudget:8}};
  const projected=productMediaResult(result,{mykola_media_advice:true,mykola_media_advice_diagnostics:false});
  assert.doesNotMatch(JSON.stringify(projected),/resolver|strategy|years|gates|stableId|director|PRIVATE|explicit-stable-title-year-match/);
  const report=safeMediaReport(result);assert.match(report,/Identity route stable-id-title-year/);
});

test('linked director profile diagnostics/report keep exact allowlisted outcomes and counts without names, IDs, URLs or raw fields', () => {
  const input = { status: 'confirmed', reason: 'confirmed-person-profile-facts', basis: 'exact-name-birthdate-role',
    sourceAttempts: 2, reservationRequests: 2, reservationsAcknowledged: 2, tmdbPersonCalls: 1, kinobazaPersonCalls: 1,
    attempts: [
      { stage: 'tmdb-person', status: 'response-received', httpStatus: 200, name: 'PRIVATE_NAME', body: 'PRIVATE_BODY' },
      { stage: 'kinobaza-person', status: 'response-received', httpStatus: 200, sourceURL: 'https://private.example/PRIVATE', html: 'PRIVATE_HTML' },
      { stage: 'PRIVATE_STAGE', status: 'PRIVATE_STATUS', httpStatus: 999, secret: 'PRIVATE_KEY' },
    ], accounting: 'reserved-attempts-spent-no-retry',
    comparisons: { stableIdConflict: false, stableIdMatch: false, birthdayConflict: false, birthdayMatch: true, latinNameMatch: true, nativeAliasMatch: true, raw: 'PRIVATE_COMPARISON' },
    tmdbPersonId: 'PRIVATE_PERSON_ID', imdbId: 'PRIVATE_IMDB', dateOfBirth: 'PRIVATE_BIRTHDAY',
    name: 'PRIVATE_NAME', aliases: ['PRIVATE_ALIAS'], profileURL: 'https://private.example/PRIVATE',
    sourceURL: 'https://private.example/?token=PRIVATE', rawHTML: 'PRIVATE_HTML', credentials: 'PRIVATE_KEY',
  };
  const before = JSON.stringify(input), safe = safeDirectorProfileDiagnostic(input);
  assert.deepEqual(safe, { status: 'confirmed', reason: 'confirmed-person-profile-facts', basis: 'exact-name-birthdate-role',
    sourceAttempts: 2, reservationRequests: 2, reservationsAcknowledged: 2, tmdbPersonCalls: 1, kinobazaPersonCalls: 1,
    attempts: [{ stage: 'tmdb-person', status: 'response-received', httpStatus: 200 }, { stage: 'kinobaza-person', status: 'response-received', httpStatus: 200 },
      { stage: 'unknown', status: 'unknown', httpStatus: null }],
    accounting: 'reserved-attempts-spent-no-retry',
    comparisons: { stableIdConflict: false, stableIdMatch: false, birthdayConflict: false, birthdayMatch: true, latinNameMatch: true, nativeAliasMatch: true } });
  assert.equal(JSON.stringify(input), before);
  const report = safeMediaReport({ resolver: { directorProfile: input } });
  assert.ok(report.includes(`Linked director profile: ${JSON.stringify(safe)}.`));
  assert.doesNotMatch(report, /PRIVATE|https?:|rawHTML|profileURL|sourceURL|dateOfBirth|tmdbPersonId|imdbId|aliases|credentials/);
  const product = productMediaResult({ rows: [], resolver: { directorProfile: input } }, { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  assert.doesNotMatch(JSON.stringify(product), /directorProfile|PRIVATE|reason|basis|sourceAttempts/);
});

test('director diagnostic prefix injection and malformed counts/states never become allowed report content', () => {
  const safe = safeDirectorProfileDiagnostic({ status: 'PRIVATE_STATUS', reason: 'director-profile-PRIVATE_ERROR', basis: 'PRIVATE_BASIS',
    sourceAttempts: 4, reservationRequests: '2', reservationsAcknowledged: -1, tmdbPersonCalls: Infinity, kinobazaPersonCalls: null,
    attempts: [{ stage: 'PRIVATE_STAGE', status: 'PRIVATE_STATUS', httpStatus: 999, sourceURL: 'https://private.example/PRIVATE' }],
    accounting: 'PRIVATE_ACCOUNTING', comparisons: { birthdayMatch: 'true', latinNameMatch: 'PRIVATE_FLAG' }, raw: 'PRIVATE_BODY' });
  assert.deepEqual(safe, { status: 'unknown', reason: 'unknown', basis: null, sourceAttempts: null, reservationRequests: null,
    reservationsAcknowledged: null, tmdbPersonCalls: null, kinobazaPersonCalls: null,
    attempts: [{ stage: 'unknown', status: 'unknown', httpStatus: null }], accounting: 'unknown',
    comparisons: { stableIdConflict: null, stableIdMatch: null, birthdayConflict: null, birthdayMatch: null, latinNameMatch: null, nativeAliasMatch: null } });
  const report = safeMediaReport({ resolver: { directorProfile: { ...safe, reason: 'profile-PRIVATE', sourceURL: 'https://private.example/PRIVATE' } } });
  assert.match(report, /Linked director profile: \{"status":"unknown","reason":"unknown","basis":null/);
  assert.doesNotMatch(report, /PRIVATE|https?:|sourceURL|raw|Infinity/);
});

test('profile pair allocation diagnostics retain safe card indexes/basis but no profile facts or untrusted content', () => {
  const input = {status:'unresolved',reason:'director-profile-candidates-ambiguous',sourceAttempts:0,
    selection:{eligibleCards:2,selectedCards:[],unverifiedCards:2,basis:'ambiguous-top-profiles',profileURL:'https://private.example/PRIVATE',aliases:['PRIVATE_ALIAS']}};
  const report = safeMediaReport({resolver:{directorProfile:input}});
  assert.match(report,/director-profile-candidates-ambiguous/);
  assert.match(report,/"eligibleCards":2,"unverifiedCards":2,"selectedCards":\[\],"basis":"ambiguous-top-profiles"/);
  assert.doesNotMatch(report,/PRIVATE|https?:|profileURL|aliases/);
  const safe = safeDirectorProfileDiagnostic({...input,selection:{eligibleCards:99,unverifiedCards:'2',selectedCards:[1,2,2,'1',3,4,'PRIVATE'],basis:'PRIVATE'}});
  assert.deepEqual(safe.selection,{eligibleCards:null,unverifiedCards:null,selectedCards:[1,2,3,4],basis:'unknown'});
  const product = productMediaResult({rows:[],resolver:{directorProfile:input}},{mykola_media_advice:true,mykola_media_advice_diagnostics:false});
  assert.doesNotMatch(JSON.stringify(product),/directorProfile|selection|ambiguous-top-profiles|PRIVATE/);
});

test('contextual release-year confirmation is recognized separately from same-year and shared-ID routes in the short report', async () => {
  const film = { ...cascadeFilm, year: 2008, identityContext: { tmdbId: cascadeFilm.tmdbId, titleEvidence: [],
    releaseEvidence: [{ date: '2006-09-09T00:00:00.000Z', year: 2006, type: 1, country: 'CA', language: 'en' }] } };
  const identity = await authoredCascadeIdentity({ film, html: markup({ year: 2006 }) });
  assert.equal(identity.status, 'matched'); assert.equal(identity.reason, 'explicit-title-release-year-director-match');
  const report = safeMediaReport({ resolver: { cards: [{ ...reportCard(identity), releaseYearEvidence: identity.releaseYearEvidence,
    sourceURL: 'https://private.example/PRIVATE', personId: 'PRIVATE_PERSON' }] } });
  assert.match(report, /Card: matched; reason explicit-title-release-year-director-match; gate none-or-unknown/);
  assert.match(report, /Identity route title-release-year-director; years \{"selected":2008,"source":2006,"delta":-2\}/);
  assert.match(report, /"yearEqual":false/); assert.match(report, /"director-alias":"pass"/);
  assert.doesNotMatch(report, /PRIVATE|https?:|2006-09-09|releaseYearEvidence|sourceURL|personId/);
});
