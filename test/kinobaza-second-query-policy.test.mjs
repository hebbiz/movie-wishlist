// Authored identities, URLs and transport responses only. These examples do not
// archive live search results or prove a real film's availability or tracks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver, resolverQueries, resolverRefusalQuery } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup } from './assisted-kinobaza.fixture.mjs';
import { safeMediaReport } from '../src/media-advice/media-advice-report.mjs';

const SEARCH = 'https://api.tavily.com/search';
const URLS = ['unrelated-first', 'unrelated-second', 'authored-original']
  .map(slug => `https://kinobazaua.com/titles/${slug}`);
const FILM = { id: 'authored-second-search', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: ['Вигаданий фільм', 'Authored original'], directorCount: 1,
  directorAliases: ['Authored director'],
  directorPeople: [{ namespace: 'tmdb:person', personId: 999999, names: ['Authored director'] }],
  identityContext: { tmdbId: 999900001, titleEvidence: [
    { title: 'Authored original', source: 'original' },
    { title: 'Вигаданий фільм', source: 'requested' },
  ], releaseEvidence: [] } };

test('restored second query retains primary, localized title and trusted director with unchanged domain/path restriction', () => {
  assert.deepEqual(resolverQueries(FILM), [
    '"Authored original" 2001 site:kinobazaua.com/titles/',
    '"Authored original" "Вигаданий фільм" "Authored director" 2001 site:kinobazaua.com/titles/',
  ]);
  assert.equal(resolverRefusalQuery(FILM), resolverQueries(FILM)[1]);
  assert.match(resolverQueries(FILM)[1], /^"Authored original" "Вигаданий фільм" "Authored director" /);
});

test('an explicitly English translation remains primary and the combined second query retains the selected localized title', () => {
  const film = { ...FILM, originalTitle: 'Authored German original', identityContext: {
    ...FILM.identityContext, titleEvidence: [
      { title: 'Authored German original', source: 'original' },
      { title: 'Authored English translation', source: 'translation', language: 'en', country: 'GB' },
    ],
  } };
  assert.deepEqual(resolverQueries(film), [
    '"Authored English translation" 2001 site:kinobazaua.com/titles/',
    '"Authored English translation" "Вигаданий фільм" "Authored director" 2001 site:kinobazaua.com/titles/',
  ]);
});

test('without a distinct known title the second contextual slot retains director disambiguation', () => {
  const film = { ...FILM, identityTitle: FILM.originalTitle, titleAliases: [FILM.originalTitle] };
  assert.deepEqual(resolverQueries(film), [
    '"Authored original" 2001 site:kinobazaua.com/titles/',
    '"Authored original" "Authored director" 2001 site:kinobazaua.com/titles/',
  ]);
  const ambiguous = { ...film, directorCount: 2, directorPeople: [
    film.directorPeople[0], { namespace: 'tmdb:person', personId: 999998, names: ['Other person'] },
  ] };
  assert.equal(resolverQueries(ambiguous)[1], '"Authored original" 2001 site:kinobazaua.com/titles/');
});

test('confirmed premiere and selected year remain separate query contexts', () => {
  const film = { ...FILM, year: 2008, identityContext: { ...FILM.identityContext, releaseEvidence: [
    { date: '2006-09-09T00:00:00Z', year: 2006, type: 1, country: 'CA' },
    { date: '2008-06-01T00:00:00Z', year: 2008, type: 3, country: 'US' },
  ] } };
  assert.deepEqual(resolverQueries(film), [
    '"Authored original" 2006 site:kinobazaua.com/titles/',
    '"Authored original" "Вигаданий фільм" "Authored director" 2008 site:kinobazaua.com/titles/',
  ]);
  const unrelated = { ...film, identityContext: { ...film.identityContext, tmdbId: FILM.tmdbId + 1 } };
  assert.ok(resolverQueries(unrelated).every(query => query.includes(' 2008 ')));
});

test('known alternative title is escaped and bounded without a made-up URL or a new query slot', () => {
  const film = { ...FILM, identityTitle: 'A "quoted" \\ known name' };
  const queries = resolverQueries(film);
  assert.equal(queries[1], '"Authored original" "A  quoted    known name" "Authored director" 2001 site:kinobazaua.com/titles/');
  const long = resolverQueries({ ...FILM, identityTitle: 'Y'.repeat(500) });
  assert.equal(long.length, 2);
  assert.ok(long.every(query => query.length <= 550));
  assert.ok(long.every(query => query.endsWith('site:kinobazaua.com/titles/')));
});

async function run({ path = 'refused-first', change = {}, alternateStatus } = {}) {
  const sent = [], reserved = [], queries = [];
  // Retain all four ordinary baseline source attempts. No fake extra runtime
  // capacity is supplied to the two search/two card opportunities below.
  const calls = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn']
    .map(stage => ({ stage, status: 'response-received' }));
  const out = await createKinobazaResolver({ apiKey: 'AUTHORED_SEARCH_KEY' })(FILM, {
    sourceCap: 10, calls,
    reserve: async stage => {
      assert.ok(!reserved.includes(stage));
      assert.ok(calls.length < 10, 'no dispatch can exceed the existing cap10');
      reserved.push(stage);
    },
    fetchImpl: async (url, init) => {
      sent.push(url);
      assert.equal(init.redirect, 'manual');
      assert.equal(init.credentials, 'omit');
      if (url === SEARCH) {
        const body = JSON.parse(init.body);
        queries.push(body.query);
        assert.equal(body.search_depth, 'basic');
        assert.equal(body.auto_parameters, false);
        assert.equal(body.include_answer, false);
        assert.equal(body.include_raw_content, false);
        assert.deepEqual(body.include_domains, ['kinobazaua.com']);
        assert.equal(body.include_domains_mode, 'restrict');
        assert.equal(body.max_results, 5);
        if (queries.length === 2 && alternateStatus) return new Response('PRIVATE_PROVIDER_BODY', { status: alternateStatus });
        const urls = queries.length === 1
          ? path === 'empty-first' ? [] : path === 'matched-first' ? [URLS[2]] : URLS.slice(0, 2)
          : [URLS[0], URLS[2], URLS[2]];
        return Response.json({ results: urls.map(url => ({ url,
          title: 'PRIVATE_SEARCH_TITLE', content: 'PRIVATE_SEARCH_SNIPPET', score: 1 })) });
      }
      assert.ok(URLS.includes(url), 'only a returned, admitted pointer may be read');
      assert.equal(init.method, 'GET');
      assert.equal(new Headers(init.headers).has('authorization'), false);
      return new Response(markup({ url,
        ...(url === URLS[2] ? change : { title: 'An unrelated authored film' }),
      }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  assert.ok(out.resolver.searchCalls <= 2);
  assert.ok(out.resolver.cardCalls <= 2);
  assert.ok(calls.length <= 10);
  assert.equal(new Set(reserved).size, reserved.length);
  assert.ok(sent.every(url => url === SEARCH || URLS.includes(url)));
  assert.doesNotMatch(JSON.stringify(out), /PRIVATE_SEARCH|AUTHORED_SEARCH_KEY|PRIVATE_PROVIDER_BODY/);
  assert.doesNotMatch(safeMediaReport({ resolver: out.resolver }), /https?:|PRIVATE|AUTHORED_SEARCH_KEY/);
  return { out, sent, reserved, calls, queries };
}

for (const path of ['empty-first', 'refused-first']) test(`${path}: restored combined second query shares its slot and still requires independent identity`, async () => {
  const result = await run({ path });
  assert.deepEqual(result.queries, resolverQueries(FILM));
  assert.equal(result.out.result.sourceURL, URLS[2]);
  assert.equal(result.out.result.identity.status, 'matched');
  assert.ok(result.out.result.candidates.length > 0);
  assert.equal(result.out.resolver.searchCalls, 2);
  assert.equal(result.out.resolver.cardCalls, 2);
  assert.equal(result.calls.length, 8);
  assert.equal(result.out.resolver.candidates, path === 'empty-first' ? 2 : 3);
  assert.equal(result.out.resolver.searches[1].duplicates, 1);
  assert.equal(result.out.resolver.cards[0].identity, path === 'empty-first' ? 'matched' : 'mismatch');
  const cards = result.sent.filter(url => url !== SEARCH);
  assert.deepEqual(cards, path === 'empty-first' ? [URLS[2], URLS[0]] : [URLS[0], URLS[2]],
    'existing rank may prioritize only an actually returned exact-title pointer; old unrelated pointers do not prove identity');
  assert.deepEqual(result.reserved, path === 'empty-first'
    ? ['search-1', 'search-2', 'kinobaza-1', 'kinobaza-2']
    : ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2']);
});

test('matched first card does not automatically spend the alternate search slot', async () => {
  const result = await run({ path: 'matched-first' });
  assert.deepEqual(result.queries, resolverQueries(FILM).slice(0, 1));
  assert.equal(result.out.result.identity.status, 'matched');
  assert.equal(result.out.resolver.cardCalls, 1);
  assert.equal(result.out.resolver.searchCalls, 1);
  assert.equal(result.calls.length, 6);
});

for (const [label, change, reason] of [
  ['conflicting stable ID', { stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' }, 'source-stable-id-conflict'],
  ['conflicting heading', { title: 'A different authored title' }, 'source-title-conflict'],
  ['different original title', { original: 'A different authored original' }, 'source-original-title-unestablished'],
  ['different year', { year: 2002 }, 'source-year-conflict-without-stable-crosswalk'],
  ['unconfirmed director', { director: 'An unverified person spelling' }, 'director-alias-unestablished'],
]) test(`an admitted exact-looking second-search pointer cannot bypass ${label}`, async () => {
  const result = await run({ change });
  assert.equal(result.out.result, null);
  assert.deepEqual(result.out.choices, []);
  assert.equal(result.out.resolver.cards[1].reason, reason);
  assert.equal(result.out.resolver.cards[1].candidates, 0);
  assert.equal(result.out.resolver.searchCalls, 2);
  assert.equal(result.out.resolver.cardCalls, 2);
  assert.equal(result.calls.length, 8);
});

for (const status of [401, 429, 503]) test(`alternative search HTTP ${status} is not retried and cannot open a third slot`, async () => {
  const result = await run({ alternateStatus: status });
  assert.equal(result.out.result, null);
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2']);
  assert.equal(result.out.resolver.searchCalls, 2);
  assert.equal(result.out.resolver.cardCalls, 1);
  assert.equal(result.calls.length, 7);
});
