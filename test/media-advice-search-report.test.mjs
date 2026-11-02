import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMediaReport } from '../assets/media-advice-report.mjs';

// Authored structured examples, not historical Tavily responses or source HTML.
const HEADING = 'Можливо, нерелевантні результати пошуку';
function authoredDiagnostic() {
  return {
    film: { title: 'Authored sought film', year: 2015, imdbId: 'tt1234567' },
    searches: [{ query: '"Authored sought film" 2015 site:kinobazaua.com/titles/',
      requestId: '40f03988-1e98-4bb6-bdcc-289c3cfde187', responseQuery: 'Authored sought film 2015' }],
    cards: [
      { title: 'Інший авторський фільм (2015)', originalTitle: 'Another authored film',
        url: 'https://kinobazaua.com/titles/another-authored-film', identity: 'mismatch',
        reason: 'source-title-conflict', titleMismatch: true },
      { title: 'Ще одна авторська картка (2015)', originalTitle: 'Further authored card',
        url: 'https://kinobazaua.com/titles/further-authored-card', identity: 'mismatch',
        reason: 'source-title-conflict', titleMismatch: true },
    ],
  };
}
function reportResult(diagnostic = authoredDiagnostic()) {
  return { capabilities: { mykola_media_advice_diagnostics: true },
    film: { title: 'Authored sought film', year: 2015, imdbId: 'tt1234567' }, rows: [],
    resolver: { possibleIrrelevantSearch: diagnostic } };
}

test('protected report displays paired actual queries and read card fields without declaring a provider failure', () => {
  const result = reportResult(), before = JSON.stringify(result);
  const report = safeMediaReport(result);
  assert.ok(report.includes(HEADING));
  assert.ok(report.includes('Фільм цього запуску: "Authored sought film"; рік 2015; IMDb tt1234567.'));
  assert.ok(report.includes('фактично надісланий query "\\"Authored sought film\\" 2015 site:kinobazaua.com/titles/"'));
  assert.ok(report.includes('request_id "40f03988-1e98-4bb6-bdcc-289c3cfde187"'));
  assert.ok(report.includes('query відповіді Tavily "Authored sought film 2015"'));
  assert.ok(report.includes('назва "Інший авторський фільм (2015)"; оригінальна назва "Another authored film"'));
  assert.ok(report.includes('адреса "https://kinobazaua.com/titles/another-authored-film"'));
  assert.match(report, /причина відхилення source-title-conflict; ознака незбігу назв possible/);
  assert.match(report, /не доводить, що це інший фільм або помилка Tavily/);
  assert.match(report, /Відмінність query відповіді.*сама по собі не доводить переплутану відповідь/);
  assert.equal(JSON.stringify(result), before);
});

test('missing or false diagnostic capability does not expose new queries, card names, request IDs or URLs', () => {
  for (const capability of [undefined, false, 'true', 1, null]) {
    const result = reportResult();
    result.capabilities = capability === undefined ? undefined : { mykola_media_advice_diagnostics: capability };
    const report = safeMediaReport(result);
    assert.ok(!report.includes(HEADING));
    assert.doesNotMatch(report, /another-authored-film|Further authored card|40f03988|site:kinobazaua|https:\/\/kinobazaua/);
  }
});

test('missing captured metadata remains explicitly unknown while a valid other card supports the possible signal', () => {
  const diagnostic = authoredDiagnostic();
  diagnostic.film = { title: null, year: null, imdbId: null };
  diagnostic.searches = [{ query: null, requestId: null, responseQuery: null }];
  diagnostic.cards[1] = { title: null, originalTitle: null, url: null, identity: 'unresolved', reason: null, titleMismatch: null };
  const report = safeMediaReport(reportResult(diagnostic));
  assert.ok(report.includes(HEADING));
  assert.match(report, /Фільм цього запуску: unknown; рік unknown; IMDb unknown/);
  assert.match(report, /фактично надісланий query unknown; request_id unknown; query відповіді Tavily unknown/);
  assert.match(report, /Прочитана картка 2: назва unknown; оригінальна назва unknown; адреса unknown; identity unresolved; причина відхилення unknown; ознака незбігу назв unknown/);
  assert.doesNotMatch(report, /undefined|\[object Object\]/);
});

test('missing search observations show unknown fields without inventing a search count', () => {
  const diagnostic = authoredDiagnostic();
  diagnostic.searches = [];
  const report = safeMediaReport(reportResult(diagnostic));
  assert.ok(report.includes(HEADING));
  assert.ok(report.includes('Пошук: фактично надісланий query unknown; request_id unknown; query відповіді Tavily unknown.'));
  assert.doesNotMatch(report, /^Пошук \d:/m);
});

test('successful cards, alias-only mismatch and insufficient title comparisons cannot create the section', () => {
  for (const update of [
    cards => { cards[0].identity = 'matched'; },
    cards => { for (const card of cards) card.titleMismatch = false; },
    cards => { for (const card of cards) card.titleMismatch = null; },
    cards => { cards.splice(0); },
  ]) {
    const diagnostic = authoredDiagnostic(); update(diagnostic.cards);
    const report = safeMediaReport(reportResult(diagnostic));
    assert.ok(!report.includes(HEADING));
    assert.doesNotMatch(report, /another-authored-film|request_id|query відповіді Tavily/);
  }
});

test('protected possible-search section is not copied into a conflicting film context', () => {
  const diagnostic = authoredDiagnostic();
  for (const resultId of ['tt7654321', null]) {
    const result = reportResult(diagnostic);
    if (resultId) result.film.imdbId = resultId;
    const report = safeMediaReport(result, resultId ? {} : { filmContext: { imdbId: 'tt7654321', title: 'Other film' } });
    assert.ok(!report.includes(HEADING));
    assert.doesNotMatch(report, /another-authored-film|40f03988|query відповіді Tavily/);
  }
});

test('new report exception remains bounded and excludes unsupported arbitrary payload fields', () => {
  const diagnostic = authoredDiagnostic();
  diagnostic.rawResponse = 'PRIVATE_BODY';
  diagnostic.apiKey = 'PRIVATE_KEY';
  diagnostic.cards[0].snippet = 'PRIVATE_SNIPPET';
  diagnostic.searches[0].headers = { Authorization: 'Bearer PRIVATE_TOKEN' };
  diagnostic.searches.push({ ...diagnostic.searches[0], requestId: '8132e4b8-c24f-4b88-9326-d0e6fdb40ff8' });
  diagnostic.searches.push({ query: 'PRIVATE_THIRD_QUERY', requestId: 'PRIVATE_THIRD_ID', responseQuery: 'PRIVATE_THIRD_RESPONSE' });
  const report = safeMediaReport(reportResult(diagnostic));
  assert.ok(report.includes(HEADING));
  assert.equal((report.match(/^Пошук [12]:/gm) ?? []).length, 2);
  assert.equal((report.match(/^Прочитана картка [12]:/gm) ?? []).length, 2);
  assert.doesNotMatch(report, /PRIVATE|rawResponse|Authorization|snippet|Bearer/);
  diagnostic.cards.push({ ...diagnostic.cards[0], title: 'PRIVATE_THIRD_CARD' });
  assert.ok(!safeMediaReport(reportResult(diagnostic)).includes(HEADING));
});

test('protected report withholds credential-shaped captured values and non-title-card addresses', () => {
  const diagnostic = authoredDiagnostic();
  diagnostic.searches[0] = { query: 'token=PRIVATE_QUERY', requestId: 'Bearer PRIVATE_REQUEST_ID', responseQuery: 'tvly-PRIVATE_RESPONSE_123456' };
  diagnostic.cards[1] = { title: 'PRIVATE_CARD https://private.example/', originalTitle: 'Bearer PRIVATE_ORIGINAL',
    url: 'https://kinobazaua.com/titles/further-authored-card?token=PRIVATE_URL', identity: 'unresolved',
    reason: 'PRIVATE_REASON', titleMismatch: null };
  const report = safeMediaReport(reportResult(diagnostic));
  assert.ok(report.includes(HEADING));
  assert.match(report, /фактично надісланий query unknown; request_id unknown; query відповіді Tavily unknown/);
  assert.match(report, /Прочитана картка 2: назва unknown; оригінальна назва unknown; адреса unknown/);
  assert.doesNotMatch(report, /PRIVATE|Bearer|token=|private\.example|tvly-/);
});
