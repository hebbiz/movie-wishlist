// Authored transports/HTML only. No live search, captured body or film claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver, resolverQueries, resolverRefusalQuery, resolverReserveQuery, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';

const SEARCH = 'https://api.tavily.com/search';
const KEY = 'AUTHORED_PRIVATE_SEARCH_KEY';
const PERSON_KEY = 'AUTHORED_PRIVATE_PERSON_KEY';
const URLS = ['authored-first', 'authored-second', 'authored-original', 'authored-fourth'].map(slug => `https://kinobazaua.com/titles/${slug}`);
const PROFILE = 'https://kinobazaua.com/persons/authored-director';
const OTHER_PROFILE = 'https://kinobazaua.com/persons/another-director';
const THIRD_PROFILE = 'https://kinobazaua.com/persons/third-director';
const PERSON = 'https://api.themoviedb.org/3/person/999999?language=en-US&append_to_response=external_ids';
const LATIN = 'Authored Director', ALIAS = 'Авторський режисер';
const FILM = { id: 'authored-reserve', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: ['Вигаданий фільм', 'Authored original'], directorCount: 1, directorAliases: [LATIN],
  directorPeople: [{ namespace: 'tmdb:person', personId: 999999, names: [ALIAS, LATIN] }],
  identityContext: { tmdbId: 999900001, titleEvidence: [{ source: 'original', title: 'Authored original' }] } };
const linked = profile => `<a href="${profile}">${ALIAS}</a>`;
const PERSON_DATA = { id: 999999, name: LATIN, also_known_as: [], birthday: '1967-05-20', imdb_id: 'nm9999991', external_ids: { imdb_id: 'nm9999991' } };
const personPage = ({ birthday = '20 травня 1967' } = {}) => `<!doctype html><html><head><link rel="canonical" href="${PROFILE}"></head><body><div class="col-8"><h1 class="h2">${ALIAS}</h1><h2 class="h3 text-muted">${LATIN}</h2><p>Дата народження: ${birthday}</p><p>Ролі: режисер</p></div></body></html>`;
const mismatch = { title: 'Different film', original: 'Different original', year: 2002 };

async function run({ sourceCap = 12, searches = [[URLS[0], URLS[1]], [], [URLS[2]]], cards = [mismatch, mismatch, {}],
  reserveImpl, intercept, person = PERSON_DATA, page = personPage(), signal, prior = 4, diagnostics = true } = {}) {
  const calls = Array.from({ length: prior }, (_, i) => ({ stage: `baseline-${i}`, status: 'response-received' }));
  const reserved = [], requests = [], payloads = [];
  const out = await createKinobazaResolver({ apiKey: KEY })(FILM, { sourceCap, tmdbToken: PERSON_KEY, calls, signal, diagnostics,
    reserve: async stage => { reserved.push(stage); assert.equal(reserved.filter(s => s === stage).length, 1); if (reserveImpl) await reserveImpl(stage); },
    fetchImpl: async (url, init) => {
      requests.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      if (intercept) { const overridden = await intercept(url, init, requests); if (overridden !== undefined) return overridden; }
      if (url === SEARCH) {
        const payload = JSON.parse(init.body); payloads.push(payload);
        assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${KEY}`);
        const index = payload.exact_match === true ? 2 : payloads.length - 1;
        return Response.json({ query: payload.query, request_id: `authored-request-${index + 1}`, results: searches[index].map(url => ({ url, content: 'PRIVATE_RAW_SNIPPET' })) });
      }
      if (url === PERSON) { assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${PERSON_KEY}`); return Response.json(person); }
      assert.equal(new Headers(init.headers).has('authorization'), false); assert.equal(new Headers(init.headers).has('cookie'), false);
      if (url === PROFILE) return new Response(page, { headers: { 'content-type': 'text/html' } });
      assert.ok(URLS.includes(url), 'only an admitted discovered card or admitted linked profile may be read');
      return new Response(markup({ url, director: LATIN, ...cards[URLS.indexOf(url)] }), { headers: { 'content-type': 'text/html' } });
    } });
  assert.ok(calls.length <= sourceCap); assert.ok(out.resolver.searchCalls <= (sourceCap === 12 ? 3 : 2));
  assert.ok(out.resolver.cardCalls <= (sourceCap === 12 ? 3 : 2));
  assert.equal(new Set(requests.filter(url => URLS.includes(url))).size, requests.filter(url => URLS.includes(url)).length, 'no duplicate card GET');
  assert.ok(requests.every(url => !url.includes('kinobazaua.com/search') && !url.includes('justwatch') && !url.includes('apple')));
  assert.doesNotMatch(JSON.stringify({ resolver: out.resolver, calls }), /AUTHORED_PRIVATE|PRIVATE_RAW_SNIPPET|<html|nm9999991|1967/);
  return { out, calls, requests, reserved, payloads };
}

test('the reserve query quotes only the established original title with year/domain, never a director', () => {
  assert.equal(resolverReserveQuery(FILM), '"Authored original" 2001 site:kinobazaua.com/titles/');
  assert.equal(resolverReserveQuery({ ...FILM, directorCount: 2 }), '"Authored original" 2001 site:kinobazaua.com/titles/');
  assert.equal(resolverReserveQuery({ ...FILM, originalTitle: '' }), null);
  assert.equal(resolverReserveQuery({ ...FILM, originalTitle: 'Authored "quoted"\\title' }), '"Authored  quoted  title" 2001 site:kinobazaua.com/titles/');
  const long = { ...FILM, originalTitle: 'a'.repeat(500), directorPeople: [{ names: ['D'.repeat(500)] }] };
  assert.equal(resolverReserveQuery(long), '"' + 'a'.repeat(500) + '" 2001 site:kinobazaua.com/titles/');
  assert.ok(resolverReserveQuery(long).length <= 550);
});

test('only reserve search-3 uses Advanced exact_match; both existing Basic payloads remain unchanged', async () => {
  const result = await run();
  assert.deepEqual(result.payloads.map(p => p.query), [resolverQueries(FILM)[0], resolverRefusalQuery(FILM), resolverReserveQuery(FILM)]);
  assert.deepEqual(result.payloads.map(p => Object.hasOwn(p, 'exact_match') ? p.exact_match : null), [null, null, true]);
  assert.deepEqual(result.payloads.map(p => p.search_depth), ['basic', 'basic', 'advanced']);
  for (const payload of result.payloads) assert.deepEqual(Object.fromEntries(Object.entries(payload).filter(([key]) => !['query', 'exact_match', 'search_depth'].includes(key))), {
    topic: 'general', max_results: 5, auto_parameters: false,
    include_answer: false, include_raw_content: false, include_images: false,
    include_favicon: false, include_usage: false, include_domains: ['kinobazaua.com'], include_domains_mode: 'restrict' });
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2', 'search-3', 'kinobaza-3']);
  assert.equal(result.out.result.sourceURL, URLS[2]); assert.equal(result.out.result.identity.status, 'matched');
  assert.ok(result.out.result.candidates.length > 0); assert.equal(result.calls.length, 10);
  assert.deepEqual(result.out.resolver.searches.map(search => [search.provider, search.exactMatch ?? false]), [['tavily', false], ['tavily', false], ['tavily', true]]);
  assert.equal(result.out.resolver.searches[2].searchDepth, 'advanced');
});

test('a matched first or second card never triggers reserve or changes the first-two read order', async () => {
  for (const cards of [[{}, mismatch], [mismatch, {}]]) {
    const result = await run({ cards });
    assert.equal(result.out.result.identity.status, 'matched'); assert.ok(result.payloads.length <= 2);
    assert.deepEqual(result.requests.filter(url => URLS.includes(url)), URLS.slice(0, 2));
    assert.ok(!result.reserved.includes('search-3')); assert.ok(!result.reserved.includes('kinobaza-3'));
  }
});

test('legacy cap8/cap10 preserve two-search/two-card behavior and cannot acquire reserve stages', async () => {
  for (const sourceCap of [8, 10]) {
    const result = await run({ sourceCap });
    assert.equal(result.out.result, null); assert.equal(result.payloads.length, 2); assert.equal(result.out.resolver.cardCalls, 2);
    assert.ok(result.payloads.every(payload => payload.search_depth === 'basic' && !Object.hasOwn(payload, 'exact_match')));
    assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2']); assert.equal(result.calls.length, 8);
  }
});

test('two empty normal searches still allow the explicit reserve search/card slots without fabricating prior card attempts', async () => {
  const result = await run({ searches: [[], [], [URLS[2]]] });
  assert.deepEqual(result.reserved, ['search-1', 'search-2', 'search-3', 'kinobaza-3']);
  assert.equal(result.out.resolver.cardCalls, 1); assert.equal(result.out.resolver.searchCalls, 3); assert.equal(result.out.result.sourceURL, URLS[2]);
});

test('empty, duplicate-only and rejected reserve URLs do not authorize another old candidate GET', async () => {
  for (const third of [[], [URLS[0], URLS[0]], ['https://kinobazaua.com/search?q=authored'], ['https://foreign.example/titles/authored']]) {
    const result = await run({ searches: [[URLS[0], URLS[1], URLS[3]], [], third] });
    assert.equal(result.out.result, null); assert.equal(result.out.resolver.cardCalls, 2); assert.equal(result.payloads.length, 3);
    assert.ok(!result.reserved.includes('kinobaza-3')); assert.ok(!result.requests.includes(URLS[3]));
  }
});

test('reserve admits/ranks only discovered unread exact-response candidates and shares cross-stage deduplication', async () => {
  const result = await run({ searches: [[URLS[0], URLS[1], URLS[3]], [], [URLS[0], URLS[2], URLS[2], URLS[3]]] });
  assert.equal(result.out.result.sourceURL, URLS[2]); assert.equal(result.out.resolver.candidates, 4);
  assert.deepEqual(result.requests.filter(url => URLS.includes(url)), URLS.slice(0, 3));
  assert.equal(result.out.resolver.searches[2].duplicates, 1);
});

test('a novel strict candidate still must pass stable IDs/title/year/director and withholds all rows if it fails', async () => {
  for (const third of [mismatch, { stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' }, { year: 2002 }, { director: 'Unproven director' }]) {
    const result = await run({ cards: [mismatch, mismatch, third] });
    assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []); assert.equal(result.out.resolver.cardCalls, 3);
    assert.equal(result.out.resolver.cards[2].candidates, 0); assert.notEqual(result.out.resolver.cards[2].identity, 'matched');
  }
});

test('search auth/access/rate/quota/HTTP/redirect failures do not become reserve retries', async () => {
  for (const status of [301, 401, 403, 429, 432, 433, 500]) {
    for (const failureAt of [1, 2]) {
      let search = 0;
      const result = await run({ intercept: url => url === SEARCH && ++search === failureAt ? new Response('', { status }) : undefined });
      assert.equal(result.requests.filter(url => url === SEARCH).length, failureAt);
      assert.ok(!result.reserved.includes('search-3')); assert.equal(result.out.result, null);
    }
  }
});

test('card HTTP/challenge/redirect/transport failures do not acquire reserve stages', async () => {
  for (const failure of [() => new Response('', { status: 403 }), () => new Response('', { status: 429 }),
    () => new Response('', { status: 302 }), () => new Response('captcha', { headers: { 'content-type': 'text/html' } }),
    () => { throw Error('PRIVATE_TRANSPORT'); }]) {
    const result = await run({ intercept: url => url === URLS[0] ? failure() : undefined });
    assert.ok(!result.reserved.includes('search-3')); assert.equal(result.out.result, null);
  }
});

test('an HTTP200 malformed unrelated card can still permit a new exact candidate, never a refetch', async () => {
  const result = await run({ intercept: url => url === URLS[0] ? new Response('<!doctype html><html><body><div id="availabilityAccordion"></div>', { headers: { 'content-type': 'text/html' } }) : undefined,
    searches: [[URLS[0], URLS[1]], [], [URLS[2]]] });
  assert.equal(result.out.result.sourceURL, URLS[2]); assert.equal(result.out.resolver.cards[0].identity, 'unresolved');
  assert.equal(result.requests.filter(url => url === URLS[0]).length, 1);
});

test('reservation denial before dispatch does not authorize reserve, retries, or a duplicate stage', async () => {
  for (const denied of ['search-2', 'kinobaza-2', 'search-3', 'kinobaza-3']) {
    const result = await run({ reserveImpl: stage => { if (stage === denied) throw Error('PRIVATE_LEDGER_ERROR'); } });
    assert.equal(result.out.result, null); assert.equal(result.reserved.filter(stage => stage === denied).length, 1);
    if (['search-2', 'kinobaza-2'].includes(denied)) assert.ok(!result.reserved.includes('search-3'));
  }
});

test('a completed first-two linked-person proof runs before reserve and suppresses reserve if it confirms', async () => {
  const result = await run({ cards: [{ director: linked(PROFILE) }, mismatch] });
  assert.equal(result.out.result.sourceURL, URLS[0]); assert.equal(result.out.result.identity.status, 'matched');
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2', 'tmdb-person', 'kinobaza-person']);
  assert.equal(result.calls.length, 10); assert.ok(!result.reserved.includes('search-3'));
});

test('an unspent person pair may confirm the reserve card within total cap12', async () => {
  const result = await run({ cards: [mismatch, mismatch, { director: linked(PROFILE) }] });
  assert.equal(result.out.result.sourceURL, URLS[2]); assert.equal(result.out.result.identity.status, 'matched');
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2', 'search-3', 'kinobaza-3', 'tmdb-person', 'kinobaza-person']);
  assert.equal(result.calls.length, 12); assert.equal(result.out.resolver.directorProfile.sourceAttempts, 2);
});

test('a reserve-search position cannot break an equal film-evidence tie between different linked people', async () => {
  for (const thirdProfile of [PROFILE, OTHER_PROFILE, THIRD_PROFILE]) {
    const result = await run({ cards: [{ director: linked(PROFILE) }, { director: linked(OTHER_PROFILE) }, { director: linked(thirdProfile) }] });
    assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
    assert.equal(result.calls.length, 10); assert.equal(result.out.resolver.cardCalls, 3);
    assert.equal(result.requests.includes(PERSON), false);
    assert.equal(result.requests.some(url => url.startsWith('https://kinobazaua.com/persons/')), false);
    assert.equal(result.out.resolver.directorProfile.reason, 'director-profile-candidates-ambiguous');
    assert.equal(result.out.resolver.directorProfile.selection.eligibleCards, 3);
    assert.deepEqual(result.out.resolver.directorProfile.selection.selectedCards, []);
    assert.equal(result.out.resolver.directorProfile.sourceAttempts, 0);
    assert.ok(result.out.resolver.cards.every(card => card.identity === 'unresolved' && card.candidates === 0));
  }
});

test('a reserve card with stronger scoped film ID can win the existing evidence ordering, not merely exact-search rank', async () => {
  const result = await run({ cards: [{ director: linked(OTHER_PROFILE) }, { director: linked(THIRD_PROFILE) },
    { title: 'Невідомий переклад', stable: `<tr><td>IMDb:</td><td>${FILM.imdbId}</td></tr>`, director: linked(PROFILE) }] });
  assert.equal(result.out.result.sourceURL, URLS[2]); assert.equal(result.out.result.identity.status, 'matched');
  assert.equal(result.out.result.identity.diagnostics.strategy, 'original-year-director-translation');
  assert.deepEqual(result.out.resolver.directorProfile.selection.selectedCards, [3]);
  assert.equal(result.out.resolver.directorProfile.selection.basis, 'scoped-film-id');
  assert.equal(result.calls.length, 12); assert.equal(result.requests.filter(url => url === PERSON).length, 1);
  assert.equal(result.requests.filter(url => url === PROFILE).length, 1);
  assert.ok(result.out.resolver.cards.slice(0, 2).every(card => card.identity === 'unresolved' && card.candidates === 0));
});

test('a spent nonconfirming pair cannot be reacquired for the reserve card or exceed total cap12', async () => {
  for (const director of [LATIN, linked(OTHER_PROFILE)]) {
    const result = await run({ cards: [{ director: linked(PROFILE) }, mismatch, { director }], page: personPage({ birthday: '26 травня 1967' }) });
    assert.equal(result.calls.length, 12); assert.equal(result.requests.filter(url => url === PERSON).length, 1);
    assert.equal(result.requests.filter(url => url.startsWith('https://kinobazaua.com/persons/')).length, 1);
    assert.equal(result.out.result?.identity.status ?? null, director === LATIN ? 'matched' : null);
    assert.ok(result.requests.indexOf(SEARCH, result.requests.indexOf(PERSON)) > result.requests.indexOf(PROFILE), 'reserve starts after the old pair completed');
  }
});

test('failed person-source HTTP/transport or unknown reservation outcome blocks reserve', async () => {
  for (const failure of [() => new Response('', { status: 401 }), () => new Response('', { status: 429 }), () => { throw Error('PRIVATE_PERSON_TRANSPORT'); }]) {
    const result = await run({ cards: [{ director: linked(PROFILE) }, mismatch], intercept: url => url === PERSON ? failure() : undefined });
    assert.equal(result.out.result, null); assert.ok(!result.reserved.includes('search-3'));
  }
  const result = await run({ cards: [{ director: linked(PROFILE) }, mismatch], reserveImpl: stage => { if (stage === 'tmdb-person') throw Error('PRIVATE_LEDGER'); } });
  assert.ok(!result.reserved.includes('search-3')); assert.equal(result.requests.includes(PERSON), false);
});

test('exhausted global budget and aborted deadline never dispatch the reserve stage', async () => {
  for (const prior of [7, 8]) {
    const budget = await run({ prior });
    assert.equal(budget.calls.length, prior + 4); assert.ok(!budget.reserved.includes('search-3'), 'retain headroom for a possible reserve card');
  }
  const controller = new AbortController(); controller.abort();
  const deadline = await run({ signal: controller.signal }); assert.equal(deadline.requests.length, 0); assert.equal(deadline.reserved.length, 0);
});

test('reserve search/card stage timeout spends at most its single attempt and never retries', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const stalledStage of ['search-3', 'kinobaza-3']) {
    let ready;
    const started = new Promise(resolve => { ready = resolve; });
    let searchCalls = 0;
    const pending = run({ intercept: (url, init) => {
      if (url === SEARCH) searchCalls++;
      if (stalledStage === 'search-3' && url === SEARCH && JSON.parse(init.body).exact_match === true ||
          stalledStage === 'kinobaza-3' && url === URLS[2]) {
        ready(); return new Promise(() => {});
      }
    } });
    await started; t.mock.timers.tick(15_000);
    const result = await pending;
    assert.equal(result.out.result, null); assert.equal(searchCalls, 3);
    assert.equal(result.reserved.filter(stage => stage === stalledStage).length, 1);
    assert.equal(result.calls.length, stalledStage === 'search-3' ? 9 : 10);
    assert.equal(result.out.resolver.cardCalls, stalledStage === 'search-3' ? 2 : 3);
  }
});

test('the invocation deadline expiring after second-card response makes no reserve request', async () => {
  const controller = new AbortController();
  const result = await run({ signal: controller.signal, intercept: url => {
    if (url === URLS[1]) { controller.abort(); return new Response(markup({ url, ...mismatch }), { headers: { 'content-type': 'text/html' } }); }
  } });
  assert.equal(result.out.result, null); assert.ok(!result.reserved.includes('search-3')); assert.equal(result.requests.length, 4);
});

test('the adapter never makes exact mode true for false, string, or missing options', async () => {
  const payloads = [];
  const provider = tavilySearch(KEY, async (_url, init) => { payloads.push(JSON.parse(init.body)); return Response.json({ results: [] }); });
  for (const exactMatch of [undefined, false, 'true', 1, true]) await provider.search('"Authored original" 2001', { exactMatch });
  assert.deepEqual(payloads.map(payload => payload.exact_match ?? null), [null, null, null, null, true]);
});

test('only the explicit advanced depth changes the adapter default; unknown depth never enables auto parameters', async () => {
  const payloads = [];
  const provider = tavilySearch(KEY, async (_url, init) => { payloads.push(JSON.parse(init.body)); return Response.json({ results: [] }); });
  for (const searchDepth of [undefined, 'basic', 'advanced', true, 'ADVANCED', 'unknown']) await provider.search('"Authored original" 2001', { searchDepth });
  assert.deepEqual(payloads.map(payload => payload.search_depth), ['basic', 'basic', 'advanced', 'basic', 'basic', 'basic']);
  assert.ok(payloads.every(payload => payload.auto_parameters === false && payload.include_usage === false));
});
