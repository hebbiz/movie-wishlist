import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { selectRequest, requestBody } from '../config.mjs';
import { createDemo } from '../server.mjs';
import { TMDB_FILMS, syntheticTmdb, projectTmdbIdentity, projectTmdbProviders, fetchTmdb } from '../tmdb.mjs';

const options = { retrieval: 'tmdb-data', discovery: 'digital-ua', filmId: 'coherence' };
const selection = () => selectRequest(options);
const fixture = () => syntheticTmdb('coherence');
const token = 'OFFLINE-TMDB-TOKEN-SENTINEL';
const a = d => projectTmdbIdentity(d, 'coherence', '2026-10-18T00:00:00Z');
const b = d => projectTmdbProviders(d, 'coherence', '2026-10-18T00:00:00Z');
const mock = (data = fixture(), calls = []) => async (url, init) => { calls.push({ url, init }); return Response.json(url.endsWith('/watch/providers') ? data.providers : data.details); };

test('fixed IDs, uk-UA metadata / uppercase UA projection, exact two URLs; invalid config fails before listening', () => {
  for (const filmId of Object.keys(TMDB_FILMS)) {
    const s = selectRequest({ ...options, filmId }); const f = TMDB_FILMS[filmId];
    assert.equal(s.sourceURL, `https://api.themoviedb.org/3/movie/${f.tmdbId}?language=uk-UA&append_to_response=external_ids,alternative_titles,credits,release_dates,translations`);
    assert.equal(s.providersURL, `https://api.themoviedb.org/3/movie/${f.tmdbId}/watch/providers`);
    assert.equal(s.country, 'UA'); assert.equal(s.prompt, null); assert.equal(s.imdbId, f.imdbId);
    assert.throws(() => requestBody(filmId, options), /no Gemini/);
  }
  for (const change of [{ discovery: undefined }, { discovery: 'physical' }, { filmId: 'blade-runner-final-cut' }, { amazonRegion: 'us' }, { urlSource: 'apple-tv' }, { urlSource: '' }, { scenario: 'api-error' }]) assert.throws(() => createDemo({ ...options, ...change }));
});

test('identity exact primary ID; translated titles/year variance do not reject; missing IMDb stays unknown', () => {
  const d = fixture().details; d.release_date = '2014-01-01'; d.title = 'Different localized text';
  assert.equal(a(d).identity.status, 'matched');
  delete d.imdb_id; d.external_ids.imdb_id = null;
  assert.equal(a(d).identity.status, 'matched'); assert.equal(a(d).identity.crosswalk, 'unknown');
  assert.equal(a(d).identity.detailsImdb.state, 'missing'); assert.equal(a(d).identity.externalImdb.state, 'null');
});

const appendedNames = ['external_ids', 'alternative_titles', 'credits', 'release_dates', 'translations'];
test('appended objects need no repeated movie ID; all five retain projected fields and the two-call budget', async () => {
  const data = fixture();
  for (const name of appendedNames) delete data.details[name].id;
  const calls = []; const r = await fetchTmdb(selection(), token, mock(data, calls));
  assert.equal(r.identity.status, 'ok'); assert.equal(r.identity.identity.status, 'matched');
  assert.equal(r.identity.identity.externalImdb.value, TMDB_FILMS.coherence.imdbId);
  assert.equal(r.identity.metadata.alternativeTitles.items.length, 1);
  assert.equal(r.identity.metadata.directors.items.length, 1);
  assert.equal(r.identity.metadata.releaseDates.items.length, 1);
  assert.equal(r.identity.metadata.translations.items.length, 1);
  assert.equal(r.providers.status, 'ok'); assert.equal(r.requestsMade, 2); assert.equal(calls.length, 2);
});

test('missing resource vs malformed resource vs valid object with missing fields are separate', () => {
  for (const name of appendedNames) {
    for (const [value, expected] of [[undefined, 'missing'], [null, 'null'], [[], 'invalid'], ['bad', 'invalid'], [false, 'invalid'],
      [{ id: null }, 'invalid'], [{ id: '220289' }, 'invalid'], [{ success: false, status_code: 34 }, 'invalid'], [{}, 'reported']]) {
      const data = fixture().details;
      if (value === undefined) delete data[name]; else data[name] = value;
      const result = a(data);
      assert.equal(result.resources[name].state, expected, `${name} / ${JSON.stringify(value)}`);
      if (value && !Array.isArray(value) && Object.keys(value).length === 0) {
        const projected = ({ external_ids: 'externalIds', alternative_titles: 'alternativeTitles', credits: 'directors', release_dates: 'releaseDates', translations: 'translations' })[name];
        assert.equal(result.metadata[projected].state, name === 'external_ids' ? 'reported' : 'missing');
        if (name === 'external_ids') assert.equal(result.identity.externalImdb.state, 'missing');
      }
    }
  }
});

test('optional appended IDs accepted only when matching; every supplied movie/IMDb conflict still withholds B', async () => {
  for (const name of appendedNames) {
    const data = fixture(); data.details[name].id = 220289;
    assert.equal(a(data.details).identity.status, 'matched'); assert.equal(a(data.details).status, 'ok');
    data.details[name].id = 1; const calls = [];
    const r = await fetchTmdb(selection(), token, mock(data, calls));
    assert.equal(r.identity.identity.status, 'mismatch'); assert.equal(r.providers.status, 'not-requested'); assert.equal(calls.length, 1);
  }
  const data = fixture(); delete data.details.external_ids.id; data.details.external_ids.imdb_id = 'tt0000001';
  assert.equal(a(data.details).identity.status, 'mismatch');
});

test('malformed resource fields are distinct from a valid resource with absent fields', () => {
  for (const [name, field, projected] of [['alternative_titles', 'titles', 'alternativeTitles'], ['credits', 'crew', 'directors'],
    ['release_dates', 'results', 'releaseDates'], ['translations', 'translations', 'translations']]) {
    const data = fixture().details; data[name] = { [field]: 'not-an-array' };
    const r = a(data); assert.equal(r.resources[name].state, 'reported'); assert.equal(r.metadata[projected].state, 'invalid');
    assert.equal(r.status, 'partial');
  }
});

test('stable IDs conflict or malformed primary/crosswalk are never ignored; B is not requested', async () => {
  for (const [status, change] of [['mismatch', d => d.id = 1], ['mismatch', d => d.imdb_id = 'tt0000001'],
    ['mismatch', d => d.external_ids.imdb_id = 'tt0000001'], ['mismatch', d => d.credits.id = 1],
    ['unresolved', d => delete d.id], ['unresolved', d => d.id = '220289'], ['unresolved', d => d.imdb_id = 'bad']]) {
    const data = fixture(); change(data.details); const calls = [];
    const result = await fetchTmdb(selection(), token, mock(data, calls));
    assert.equal(result.identity.identity.status, status); assert.equal(result.providers.status, 'not-requested');
    assert.equal(result.requestsMade, 1); assert.equal(calls.length, 1); assert.equal(result.providers.uaState, undefined);
  }
});

test('explicit uk catalogue title distinct from requested-title fallback, UA alias and film languages', () => {
  const data = fixture().details;
  assert.equal(a(data).localization.ukrainianCatalogueTitle, 'explicit-uk-title-reported');
  for (const title of ['', ' ', undefined, null]) {
    data.translations.translations[0].data.title = title;
    const result = a(data); assert.equal(result.localization.ukrainianCatalogueTitle, 'not-established');
    assert.equal(result.metadata.alternativeTitles.items[0].country.value, 'UA');
  }
  data.original_language = 'uk'; data.spoken_languages = [{ iso_639_1: 'uk' }];
  assert.equal(a(data).localization.ukrainianCatalogueTitle, 'not-established');
  data.translations.translations[0].iso_639_1 = 'en'; data.translations.translations[0].data.title = 'English title';
  assert.equal(a(data).localization.ukrainianCatalogueTitle, 'not-established');
  assert.doesNotMatch(JSON.stringify(a(data)), /SYNTHETIC prose/);
});

test('director job, country dates, alias types, translation prose presence only; append omissions are partial without fallback', async () => {
  const data = fixture(); data.details.credits.crew.push({ job: 'Writer', known_for_department: 'Directing', name: 'NOT DIRECTOR' });
  data.details.release_dates.results.push({ iso_3166_1: 'GB', release_dates: [] });
  let r = a(data.details); assert.equal(r.metadata.directors.items.length, 1);
  assert.equal(r.metadata.releaseDates.items[1].country.value, 'GB'); assert.equal(r.metadata.releaseDates.items[1].dates.state, 'reported-empty');
  assert.equal(r.metadata.translations.items[0].overview.state, 'reported-nonempty');
  for (const resource of ['external_ids', 'alternative_titles', 'credits', 'release_dates', 'translations']) {
    const d = fixture(); delete d.details[resource]; const calls = [];
    r = await fetchTmdb(selection(), token, mock(d, calls));
    assert.equal(r.identity.status, 'partial'); assert.equal(r.identity.identity.status, 'matched');
    assert.equal(r.requestsMade, 2); assert.equal(calls.length, 2);
  }
});

test('UA only; bucket/access separation, source ordering, no provider deep links or offer-language inference', () => {
  const data = fixture().providers;
  data.results.ua = { rent: [{ provider_name: 'LOWERCASE LEAK' }] };
  data.results.UA.link = 'https://www.themoviedb.org/movie/220289/watch?locale=UA';
  data.results.UA.future = [{ provider_id: 123, provider_name: 'FUTURE SYNTHETIC' }];
  const r = b(data); assert.equal(r.uaState, 'reported'); assert.equal(r.watchLink.value, data.results.UA.link);
  assert.deepEqual(r.buckets.map(x => x.name), ['flatrate', 'rent', 'buy', 'ads', 'future']);
  assert.equal(r.buckets[1].providers.state, 'reported-empty'); assert.equal(r.buckets[3].providers.state, 'missing');
  assert.match(r.buckets[4].access, /unknown/); assert.equal(r.buckets[0].providers.items[0].displayPriority.value, 10);
  assert.doesNotMatch(JSON.stringify(r), /foreign must not display|LOWERCASE LEAK/);
  assert.equal(r.audio, undefined); assert.equal(r.quality, undefined); assert.equal(r.buckets[0].providers.items[0].link, undefined);
});

test('missing/null/empty/invalid UA and bucket are separate; absent results is not unavailability', () => {
  for (const [value, expected] of [[undefined, 'missing'], [null, 'null'], [{}, 'reported-empty'], [[], 'invalid']]) {
    const d = fixture().providers; if (value === undefined) delete d.results.UA; else d.results.UA = value;
    assert.equal(b(d).uaState, expected);
  }
  for (const [value, expected] of [[undefined, 'missing'], [null, 'null'], [[], 'reported-empty'], [{}, 'invalid']]) {
    const d = fixture().providers; d.results.UA.rent = value;
    assert.equal(b(d).buckets.find(x => x.name === 'rent').providers.state, expected);
  }
  for (const d of [null, {}, { id: 1, results: {} }, { id: 220289, results: null }]) assert.match(b(d).status, /invalid/);
});

test('unsafe values withheld, text is not executed; response size/array bounds prevent oversized projection', () => {
  for (const link of ['javascript:alert(1)', 'https://user:password@www.themoviedb.org/movie/1', 'https://example.com/provider', '/relative']) {
    const d = fixture().providers; d.results.UA.link = link; assert.equal(b(d).watchLink.state, 'invalid'); assert.ok(!JSON.stringify(b(d)).includes(link));
  }
  const d = fixture().details; d.translations.translations = Array(2001).fill({});
  assert.equal(a(d).metadata.translations.state, 'invalid'); assert.equal(a(d).status, 'partial');
});

test('two serial fixed GETs, server-side Bearer, manual redirects/omit credentials; no hidden requests', async () => {
  const calls = []; const r = await fetchTmdb(selection(), token, mock(fixture(), calls));
  assert.equal(r.identity.status, 'ok'); assert.equal(r.providers.status, 'ok'); assert.equal(r.requestsMade, 2);
  assert.deepEqual(calls.map(c => c.url), [selection().sourceURL, selection().providersURL]);
  for (const { url, init } of calls) { assert.ok(!url.includes(token)); assert.equal(init.method, 'GET'); assert.equal(init.headers.Authorization, `Bearer ${token}`); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.equal(init.body, undefined); }
  for (const field of ['sourceURL', 'providersURL', 'country', 'locale']) await assert.rejects(() => fetchTmdb({ ...selection(), [field]: 'https://example.com' }, token, () => assert.fail('No request')));
  for (const key of ['', 'bad\nkey']) { const r = await fetchTmdb(selection(), key, () => assert.fail('No key no request')); assert.equal(r.requestsMade, 0); assert.equal(r.providers.status, 'not-requested'); }
});

test('B waits for A and validates its own stable ID, including malformed body; primary-ID block is not empty UA', async () => {
  let finishA; const first = new Promise(resolve => { finishA = resolve; }); const calls = [];
  const pending = fetchTmdb(selection(), token, async url => { calls.push(url); return calls.length === 1 ? first : Response.json(fixture().providers); });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.length, 1);
  finishA(Response.json(fixture().details)); const result = await pending; assert.equal(result.requestsMade, 2);
  for (const providers of [{ id: 1, results: fixture().providers.results }, [], null, { id: 220289, results: [] }]) {
    const data = fixture(); data.providers = providers;
    const r = await fetchTmdb(selection(), token, mock(data));
    assert.equal(r.identity.identity.status, 'matched'); assert.equal(r.requestsMade, 2);
    assert.match(r.providers.status, /invalid/); assert.equal(r.providers.uaState, undefined);
  }
});

test('both stages bound errors/timeout/UTF8/oversize/secret echo; no retries, fallback, body leaks or extra calls', async t => {
  const cases = [
    ...[302, 401, 403, 404, 429, 500].map(status => [String(status), () => new Response(`PRIVATE ${token}`, { status })]),
    ['bad-json', () => new Response('{bad', { headers: { 'content-type': 'application/json' } })],
    ['wrong-type', () => new Response('<html>PRIVATE</html>')],
    ['oversize-header', () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '99999999' } })],
    ['oversize-stream', () => Response.json({ large: 'x'.repeat(4000) })],
    ['UTF8', () => new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } })],
    ['echo-token', () => Response.json({ value: token })],
    ['timeout-fetch', () => new Promise(() => {})],
    ['timeout-body', () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } })],
  ];
  for (const stage of ['A', 'B']) for (const [name, response] of cases) await t.test(`${stage}/${name}`, async () => {
    let count = 0; const data = fixture();
    const r = await fetchTmdb(selection(), token, async () => { count++; return stage === 'B' && count === 1 ? Response.json(data.details) : response(); }, { timeoutMs: 30, maxBytes: 3000 });
    assert.equal(count, stage === 'A' ? 1 : 2); assert.equal(r.requestsMade, count);
    assert.notEqual((stage === 'A' ? r.identity : r.providers).status, 'ok');
    assert.doesNotMatch(JSON.stringify(r), /OFFLINE-TMDB|PRIVATE/); if (stage === 'A') assert.equal(r.providers.status, 'not-requested');
  });
});

async function start(t, extra = {}) {
  const server = createDemo({ ...options, ...extra }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve))); return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
test('session matches transport; synthetic no network; browser override ignored; concurrent one-shot on success/failure', async t => {
  for (const mode of ['synthetic', 'live', 'missing-token']) await t.test(mode, async t => {
    const calls = []; const { origin } = await start(t, { mode: mode === 'synthetic' ? mode : 'live', tmdbToken: mode === 'missing-token' ? '' : token, fetchImpl: mock(fixture(), calls) });
    const session = await (await fetch(`${origin}/session`)).json(); assert.equal(calls.length, 0);
    assert.equal(session.model, null); assert.equal(session.requestBudget, 2); assert.equal(session.tmdbId, 220289); assert.equal(session.country, 'UA');
    assert.ok(!JSON.stringify(session).includes(token));
    const headers = { Origin: origin, 'x-demo-session': session.token };
    const post = () => fetch(`${origin}/answer`, { method: 'POST', headers, body: JSON.stringify({ filmId: 'bad', sourceURL: 'https://example.com', token: 'override' }) });
    const responses = await Promise.all([post(), post()]); assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const result = await responses.find(r => r.status === 200).json();
    assert.equal(calls.length, mode === 'live' ? 2 : 0); assert.ok(!JSON.stringify(result).includes(token));
    if (calls.length) assert.deepEqual(calls.map(c => c.url), [session.sourceURL, session.providersURL]);
    assert.equal((await post()).status, 409);
  });
});

test('LAN auth, exact Host/Origin protect all new assets/session/answer; wrong auth cannot cause a request', async t => {
  const address = '192.168.77.8', password = 'offline-lan-only'; let calls = 0;
  const { server, origin: loopback } = await start(t, { mode: 'live', tmdbToken: token, access: 'lan', bindIPv4: address, lanPassword: password,
    interfaces: { fixture: [{ address, internal: false }] }, fetchImpl: async url => { calls++; return Response.json(url.endsWith('/watch/providers') ? fixture().providers : fixture().details); } });
  const host = `${address}:${server.address().port}`, origin = `http://${host}`, auth = `Basic ${Buffer.from(`demo:${password}`).toString('base64')}`;
  const req = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const r = httpRequest(loopback + path, { method, headers: { Host: host, ...headers } }, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode }))); }); r.on('error', reject); r.end();
  });
  for (const path of ['/', '/session', '/answer', '/tmdb-display.mjs', '/tmdb-logo.svg']) assert.equal((await req(path)).status, 401);
  const session = await (await req('/session', { Authorization: auth })).json(); const good = { Origin: origin, Authorization: auth, 'x-demo-session': session.token };
  for (const [change, status] of [[{ Authorization: 'Basic d3Jvbmc=' }, 401], [{ Host: 'localhost' }, 403], [{ Origin: 'https://example.com' }, 403]]) assert.equal((await req('/answer', { ...good, ...change }, 'POST')).status, status);
  assert.equal(calls, 0); assert.equal((await req('/answer', good, 'POST')).status, 200); assert.equal(calls, 2);
});

test('no logging/storage/LLM/raw archives/destination fetch; synthetic avoids real expected offer facts', async () => {
  const adapter = await readFile(new URL('../tmdb.mjs', import.meta.url), 'utf8');
  const display = await readFile(new URL('../public/tmdb-display.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(adapter + display, /console\.|writeFile|localStorage|sessionStorage|indexedDB|innerHTML|generativelanguage|googleSearch/);
  assert.equal((adapter.match(/fetchImpl\(/g) ?? []).length, 1); assert.doesNotMatch(display, /fetch\(|createElement\('(script|iframe)'\)/);
  assert.doesNotMatch(JSON.stringify(fixture()), /tv\.apple|primevideo|Netflix|3\.99|7\.99/);
});
