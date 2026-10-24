// Authored examples only; no source responses, real card claims or live requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver, resolverQueries, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { runControlDiagnostic } from '../scripts/m4-control-diagnostic.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { detailsData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';

const film = { id: 'authored', tmdbId: IDS[0], imdbId: `tt${IDS[0]}`,
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: ['Вигаданий фільм', 'Authored original', 'Later alias'],
  directorCount: 1, directorAliases: ['Authored director'] };
const urls = Array.from({ length: 5 }, (_, i) => `https://kinobazaua.com/titles/authored-card-${i + 1}`);
const endpoint = 'https://api.tavily.com/search';

async function resolveWith(fetchImpl) {
  const reserved = [], calls = [];
  const out = await createKinobazaResolver({ apiKey: 'AUTHORED_SEARCH_KEY' })(film, {
    fetchImpl, calls, reserve: async stage => { assert.ok(!reserved.includes(stage)); reserved.push(stage); },
  });
  return { out, reserved, calls };
}

test('title/year search omits the added director, preserving primary/alternate title order and path scope', () => {
  assert.deepEqual(resolverQueries(film), [
    '"Authored original" 2001 site:kinobazaua.com/titles/',
    '"Вигаданий фільм" 2001 site:kinobazaua.com/titles/',
  ]);
  assert.doesNotMatch(resolverQueries(film).join('\n'), /Authored director|Later alias/);
  assert.deepEqual(resolverQueries({ ...film, directorAliases: ['Different spelling', 'Інше написання'] }), resolverQueries(film));
  // A director name legitimately within the supplied title is not rewritten.
  assert.equal(resolverQueries({ ...film, originalTitle: 'A film about Authored director' })[0],
    '"A film about Authored director" 2001 site:kinobazaua.com/titles/');
});

test('existing title deduplication, escaping and bounds do not change with director removal', () => {
  assert.deepEqual(resolverQueries({ ...film, originalTitle: '  Same  ', identityTitle: 'Same', titleAliases: ['Other', 'Third'] }), [
    '"Same" 2001 site:kinobazaua.com/titles/', '"Other" 2001 site:kinobazaua.com/titles/',
  ]);
  assert.equal(resolverQueries({ ...film, originalTitle: 'A "quoted" \\ title', year: null })[0],
    '"A  quoted    title" site:kinobazaua.com/titles/');
  assert.deepEqual(resolverQueries({ ...film, originalTitle: 'x'.repeat(501), identityTitle: 'bad\nname', titleAliases: ['Allowed'] }), [
    '"Allowed" 2001 site:kinobazaua.com/titles/',
  ]);
  assert.equal(resolverQueries({ ...film, originalTitle: 'x'.repeat(500) })[0],
    `"${'x'.repeat(500)}" 2001 site:kinobazaua.com/titles/`);
  assert.deepEqual(resolverQueries({ originalTitle: '\u0000', identityTitle: 'x'.repeat(501), titleAliases: [] }), []);
});

test('director-free query keeps exact basic Tavily request and independent domain restriction', async () => {
  let calls = 0;
  const out = await tavilySearch('AUTHORED_SEARCH_KEY', async (url, init) => {
    calls++; assert.equal(url, endpoint);
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    assert.equal(init.headers.Authorization, 'Bearer AUTHORED_SEARCH_KEY');
    assert.deepEqual(JSON.parse(init.body), {
      query: '"Authored original" 2001 site:kinobazaua.com/titles/',
      search_depth: 'basic', topic: 'general', max_results: 5, auto_parameters: false,
      include_answer: false, include_raw_content: false, include_images: false,
      include_favicon: false, include_usage: false, include_domains: ['kinobazaua.com'], include_domains_mode: 'restrict',
    });
    return Response.json({ results: [] });
  }).search(resolverQueries(film)[0]);
  assert.equal(calls, 1); assert.equal(out.status, 'ok'); assert.deepEqual(out.urls, []);
});

test('removing director from query does not bypass source director, title or stable-ID gates', async () => {
  for (const [change, identity, reason] of [
    [{}, 'matched', 'explicit-title-year-director-match'],
    [{ director: 'Unknown director spelling' }, 'unresolved', 'director-alias-unestablished'],
    [{ director: 'Authored director, Another director' }, 'unresolved', 'director-alias-unestablished'],
    [{ title: 'Different film' }, 'mismatch', 'source-title-conflict'],
    [{ director: 'Unknown director spelling', stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' }, 'mismatch', 'source-stable-id-conflict'],
  ]) {
    let searches = 0, cards = 0;
    const { out, reserved } = await resolveWith(async (url, init) => {
      assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      if (url === endpoint) {
        searches++; assert.doesNotMatch(JSON.parse(init.body).query, /Authored director/);
        return Response.json({ results: [{ url: urls[0], title: 'Not identity evidence', content: 'Not evidence' }] });
      }
      cards++; assert.equal(url, urls[0]);
      return new Response(markup({ url, ...change }), { headers: { 'content-type': 'text/html' } });
    });
    assert.equal(searches, 1); assert.equal(cards, 1);
    assert.deepEqual(reserved, ['search-1', 'kinobaza-1']);
    assert.equal(out.resolver.cards[0].identity, identity); assert.equal(out.resolver.cards[0].reason, reason);
    if (identity === 'matched') assert.equal(out.result.identity.status, 'matched');
    else { assert.equal(out.result, null); assert.deepEqual(out.choices, []); }
  }
});

test('alternative search remains only after successful zero admitted URLs, including rejected person pointer', async () => {
  for (const firstResults of [[], [{ url: 'https://kinobazaua.com/persons/authored-director' }]]) {
    const queries = [];
    const { out, reserved } = await resolveWith(async (url, init) => {
      if (url === endpoint) {
        queries.push(JSON.parse(init.body).query);
        return Response.json({ results: queries.length === 1 ? firstResults : [{ url: urls[0] }] });
      }
      assert.equal(url, urls[0]);
      return new Response(markup({ url }), { headers: { 'content-type': 'text/html' } });
    });
    assert.deepEqual(queries, resolverQueries(film)); assert.equal(out.resolver.searchCalls, 2);
    assert.equal(out.result.identity.status, 'matched');
    assert.deepEqual(reserved, ['search-1', 'search-2', 'kinobaza-1']);
  }
});

test('search auth/quota/transport/malformed errors do not become alternative search or card fetch', async () => {
  for (const kind of [401, 403, 429, 500, 'transport', 'malformed']) {
    let attempts = 0;
    const { out, reserved } = await resolveWith(async url => {
      attempts++; assert.equal(url, endpoint);
      if (kind === 'transport') throw Error('AUTHORED_PRIVATE_ERROR');
      if (kind === 'malformed') return Response.json({ results: null });
      return new Response('AUTHORED_PRIVATE_ERROR', { status: kind });
    });
    assert.equal(attempts, 1); assert.equal(out.resolver.searchCalls, 1); assert.equal(out.resolver.cardCalls, 0);
    assert.equal(out.result, null); assert.deepEqual(reserved, ['search-1']);
    assert.doesNotMatch(JSON.stringify(out), /AUTHORED_PRIVATE_ERROR|AUTHORED_SEARCH_KEY/);
  }
});

test('two successful empty searches exhaust alternatives; accepted candidates still cap reads at two', async () => {
  const empty = await resolveWith(async url => { assert.equal(url, endpoint); return Response.json({ results: [] }); });
  assert.equal(empty.out.status, 'no-admitted-search-candidates'); assert.deepEqual(empty.reserved, ['search-1', 'search-2']);
  let searches = 0, cards = 0;
  const bounded = await resolveWith(async (url, init) => {
    assert.equal(init.redirect, 'manual');
    if (url === endpoint) return Response.json({ results: ++searches === 1 ? [] : urls.map(url => ({ url })) });
    cards++; assert.equal(url, urls[cards - 1]);
    return new Response(markup({ url }), { headers: { 'content-type': 'text/html' } });
  });
  assert.equal(searches, 2); assert.equal(cards, 2);
  assert.deepEqual(bounded.reserved, ['search-1', 'search-2', 'kinobaza-1', 'kinobaza-2']);
  assert.equal(bounded.out.resolver.unexamined, 3); assert.equal(bounded.out.choices.length, 2);
});

test('single-film title/year control continues real admission/identity/extraction and never exceeds 2+2+2', async () => {
  const sent = []; let searches = 0;
  const result = await runControlDiagnostic({ tmdbToken: 'AUTHORED_TMDB_KEY', tavilyKey: 'AUTHORED_SEARCH_KEY', titleYearControl: true,
    fetchImpl: async (url, init) => {
      sent.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      if (url.startsWith('https://api.themoviedb.org/3/search/movie?')) return Response.json({ results: [{ id: IDS[0], original_title: 'Blade Runner 2049', release_date: '2017-01-01' }] });
      if (url.startsWith(`https://api.themoviedb.org/3/movie/${IDS[0]}?`)) {
        return Response.json({ ...detailsData(IDS[0]), original_title: 'Blade Runner 2049', release_date: '2017-01-01' });
      }
      if (url === endpoint) {
        assert.doesNotMatch(JSON.parse(init.body).query, /Authored director/);
        return Response.json({ results: ++searches === 1 ? [] : urls.map(url => ({ url, content: 'AUTHORED_PRIVATE_SNIPPET', score: 0.98 })) });
      }
      assert.ok(urls.slice(0, 2).includes(url), 'no unexamined card or provider/destination fetch');
      return new Response(markup({ url, original: 'Blade Runner 2049', year: 2017 }), { headers: { 'content-type': 'text/html' } });
    },
  });
  assert.equal(result.mode, 'title-year-control');
  assert.deepEqual(result.limits, { tmdb: 2, search: 2, cards: 2, total: 6 });
  assert.deepEqual(result.accounting, { priorAttempts: 17, cumulativeMax: 23 });
  assert.deepEqual(result.counts, { tmdb: 2, search: 2, cards: 2, total: 6 });
  assert.equal(result.cases.length, 1); assert.equal(result.cases[0].film, 'Blade Runner 2049');
  assert.equal(result.cases[0].resolver.cardCalls, 2); assert.equal(result.cases[0].resolver.unexamined, 3);
  assert.ok(result.cases[0].resolver.cards.every(card => card.identity === 'matched' && ['ok', 'partial'].includes(card.extraction)));
  assert.equal(result.cases[0].cards.length, 2);
  for (const [i, card] of result.cases[0].cards.entries()) {
    assert.equal(card.sourceURL, urls[i]); assert.equal(card.diagnostics.failedGate, null);
    assert.deepEqual(card.comparison.source.h2, ['Blade Runner 2049']);
    assert.equal(card.comparison.source.year, 2017);
    assert.deepEqual(card.comparison.source.directors, ['Authored director']);
    assert.ok(card.comparison.expected.titleAliases.includes('Blade Runner 2049'));
    assert.ok(card.comparison.expected.directorAliases.includes('Authored director'));
    assert.equal(card.comparison.expected.year, 2017);
  }
  assert.equal(result.cases[0].status, 'multiple-confirmed-cards-choose'); assert.equal(sent.length, 6);
  assert.doesNotMatch(JSON.stringify(result), /AUTHORED_TMDB_KEY|AUTHORED_SEARCH_KEY|AUTHORED_PRIVATE_SNIPPET|Not identity evidence|Not evidence|<h1|<table/);
});

test('title/year control missing credentials and provider failure never spend an automatic second attempt', async () => {
  const absent = await runControlDiagnostic({ titleYearControl: true, fetchImpl: () => assert.fail('no credentials means no dispatch') });
  assert.equal(absent.status, 'blocked-missing-local-credentials');
  assert.deepEqual(absent.counts, { tmdb: 0, search: 0, cards: 0, total: 0 });
  assert.equal(absent.cases.length, 1);
  const stopped = await runControlDiagnostic({ titleYearControl: true, tmdbToken: 'AUTHORED_TMDB_KEY', tavilyKey: 'AUTHORED_SEARCH_KEY', fetchImpl: async url => {
    if (url.startsWith('https://api.themoviedb.org/3/search/movie?')) return Response.json({ results: [{ id: IDS[0], original_title: 'Blade Runner 2049', release_date: '2017-01-01' }] });
    if (url.startsWith(`https://api.themoviedb.org/3/movie/${IDS[0]}?`)) return Response.json({ ...detailsData(IDS[0]), original_title: 'Blade Runner 2049', release_date: '2017-01-01' });
    assert.equal(url, endpoint); return new Response('AUTHORED_PRIVATE_BODY', { status: 401 });
  } });
  assert.deepEqual(stopped.counts, { tmdb: 2, search: 1, cards: 0, total: 3 });
  assert.equal(stopped.cases[0].status, 'search-auth-error');
  assert.equal(stopped.cases[0].resolver.searchCalls, 1); assert.equal(stopped.cases[0].resolver.cardCalls, 0);
  assert.deepEqual(stopped.cases[0].cards, []);
  assert.doesNotMatch(JSON.stringify(stopped), /AUTHORED_PRIVATE_BODY|AUTHORED_TMDB_KEY|AUTHORED_SEARCH_KEY/);
  await assert.rejects(runControlDiagnostic({ titleYearControl: true, urlDiagnostic: true, fetchImpl: () => assert.fail('invalid modes cannot dispatch') }), { message: 'incompatible-control-modes' });
});
