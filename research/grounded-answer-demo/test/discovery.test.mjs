import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createDemo } from '../server.mjs';
import { selectRequest, requestBody, FILMS } from '../config.mjs';
import { runDiscovery, authoredDiscoveryData, composeDiscovery, mapProvider, classifyLink } from '../discovery.mjs';
import { prepareDraft, accessLabel, compactFields } from '../public/discovery-client.mjs';

const opts = { retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' };
const chosen = changes => selectRequest({ ...opts, ...changes });
const html = body => new Response(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
export function mockDiscovery({ calls = [], mutate = () => {}, fail = () => undefined } = {}) {
  return async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    const bad = fail(url, init); if (bad) return bad;
    const film = /220289|tt2866360|\/coherence$/.test(url) ? FILMS.coherence : FILMS['dune-part-two'];
    const data = authoredDiscoveryData(film); mutate(data, url);
    if (url.includes('kinobaza.com.ua')) { assert.equal(init.headers.Authorization, undefined); assert.equal(init.headers['X-API-Key'], undefined); return html(data.html); }
    if (url.includes('movieofthenight')) { assert.equal(init.headers.Authorization, undefined); return Response.json(data.motn); }
    assert.equal(init.headers['X-API-Key'], undefined);
    return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
  };
}
const live = (selection = chosen(), changes = {}) => runDiscovery(selection, { mode: 'live', tmdbToken: 'offline-TMDB', motnKey: 'offline-MOTN', fetchImpl: mockDiscovery(), ...changes });

test('fixed config, default Kinobaza on, no LLM body; unknown combinations fail closed', () => {
  for (const filmId of ['coherence', 'dune-part-two']) {
    assert.equal(chosen({ filmId }).film.id, filmId); assert.equal(chosen().kinobaza, 'on');
    assert.equal(chosen().requestBudget, 4); assert.equal(chosen({ kinobaza: 'off' }).requestBudget, 3);
    assert.throws(() => requestBody(filmId, opts), /no Gemini/);
  }
  for (const change of [{ filmId: 'blade-runner-final-cut' }, { discovery: 'physical' }, { amazonRegion: 'us' }, { urlSource: 'kinobaza' }, { kinobaza: '' }, { kinobaza: 'yes' }]) assert.throws(() => createDemo({ ...opts, ...change }));
  assert.throws(() => selectRequest({ retrieval: 'search', kinobaza: 'on' }));
});
for (const filmId of ['coherence', 'dune-part-two']) test(`${filmId}: synthetic zero calls, live-mocked max four, source/film identity and provenance`, async () => {
  const selection = chosen({ filmId });
  const synthetic = await runDiscovery(selection, { fetchImpl: () => assert.fail('Synthetic network') });
  assert.equal(synthetic.metrics.requestsMade, 0); assert.equal(synthetic.synthetic, true); assert.ok(synthetic.rows.length);
  const calls = [];
  const result = await live(selection, { fetchImpl: mockDiscovery({ calls }) });
  assert.equal(calls.length, 4); assert.equal(new Set(calls.map(c => c.url)).size, 4); assert.equal(result.metrics.requestsMade, 4);
  assert.ok(calls.filter(c => c.url.includes('themoviedb')).every(c => c.init.headers.Authorization === 'Bearer offline-TMDB'));
  assert.ok(calls.filter(c => c.url.includes('movieofthenight')).every(c => c.init.headers['X-API-Key'] === 'offline-MOTN'));
  assert.ok(result.rows.every(r => r.filmId === filmId && r.accountEntitlement === 'unknown' && r.provenance.method && r.provenance.sourceURL && r.provenance.receivedAt));
  assert.ok(result.rows.some(r => r.provenance.upstream.includes('JustWatch')));
  assert.equal(result.rows.filter(r => r.kind === 'source-offer').length, 3); // rent/buy not merged by brand.
  assert.ok(result.rows.every(r => r.hdr10.state === 'unknown' && r.dolbyVision.state === 'unknown'));
  assert.equal(result.sources.every(s => s.identity === 'matched'), true);
});
test('Kinobaza off: exactly three requests; malformed optional HTML nonblocking', async () => {
  const calls = []; const r = await live(chosen({ kinobaza: 'off' }), { fetchImpl: mockDiscovery({ calls }) });
  assert.equal(calls.length, 3); assert.equal(r.stages.kinobaza.status, 'disabled-no-request');
  const partial = await live(chosen(), { fetchImpl: mockDiscovery({ fail: url => url.includes('kinobaza') ? html('<h1>unsupported</h1>') : null }) });
  assert.ok(partial.rows.some(r => r.id.startsWith('motn:'))); assert.equal(partial.rows.some(r => r.id.startsWith('kinobaza:')), false);
});

test('Kinobaza manual redirect: exact fixed GET, content-free diagnostics, no Location/body retention or following', async () => {
  for (const status of [301, 302, 307, 308]) {
    const calls = [];
    const r = await live(chosen(), { fetchImpl: mockDiscovery({ calls, fail: url => url.includes('kinobaza') ? new Response('PRIVATE_REDIRECT_BODY', { status, headers: { Location: 'https://private.example/?secret=PRIVATE_LOCATION' } }) : null }) });
    assert.equal(calls.length, 4);
    assert.equal(calls.filter(c => c.url.includes('kinobaza')).length, 1);
    assert.ok(calls.some(c => c.url === 'https://kinobaza.com.ua/titles/coherence'));
    assert.equal(r.stages.kinobaza.result.status, 'redirect-not-followed');
    assert.equal(r.sources[2].identity, 'unresolved');
    assert.deepEqual(r.metrics.calls.find(c => c.stage === 'kinobaza'), { stage: 'kinobaza', method: 'GET', httpStatus: status, redirectLocation: 'present-not-retained' });
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_|private.example/);
    assert.ok(r.rows.some(row => row.id.startsWith('motn:')));
  }
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ fail: url => url.includes('kinobaza') ? new Response(null, { status: 302 }) : null }) });
  assert.equal(r.metrics.calls.find(c => c.stage === 'kinobaza').redirectLocation, 'missing');
});

test('A diagnostic distinguishes missing/invalid resources from valid resources with missing optional fields', async () => {
  const cases = [
    ['missing', d => delete d.tmdb.details.translations, 'partial', 'missing'],
    ['invalid resource', d => { d.tmdb.details.translations = []; }, 'partial', 'invalid'],
    ['missing optional', d => { d.tmdb.details.translations = {}; }, 'ok', 'reported'],
    ['invalid field', d => { d.tmdb.details.translations = { translations: 'INVALID_PRIVATE_VALUE' }; }, 'partial', 'reported'],
  ];
  for (const [label, mutate, status, resourceState] of cases) {
    const calls = []; const r = await live(chosen(), { fetchImpl: mockDiscovery({ calls, mutate }) });
    const diagnostic = r.sources[0].diagnostics;
    assert.equal(diagnostic.status, status, label); assert.equal(diagnostic.resources.translations.state, resourceState, label);
    assert.equal(r.sources[0].identity, 'matched'); assert.match(r.sources[0].status, new RegExp(`A: ${status}; B: ok`));
    assert.ok(r.rows.some(row => row.id.startsWith('tmdb:'))); assert.equal(calls.length, 4);
    assert.ok(diagnostic.fields.some(f => f.path === 'metadata.translations' && f.state === (label === 'missing optional' ? 'missing' : label === 'invalid field' ? 'invalid' : resourceState)));
    assert.doesNotMatch(JSON.stringify(diagnostic), /INVALID_PRIVATE_VALUE|SYNTHETIC|ВИГАДАНА/);
  }
});

test('display-only access aliases and compact fields preserve raw observations and honest unknowns', async () => {
  for (const [a, b, expected] of [['rent', 'rental', 'Rental'], ['buy', 'purchase', 'Purchase'], ['flatrate', 'subscription', 'Subscription']]) {
    for (const v of [a, b]) { const f = { state: 'reported', value: v }; assert.equal(accessLabel(f), expected); assert.equal(f.value, v); }
  }
  for (const v of ['unknown', '__proto__', 'constructor']) assert.equal(accessLabel({ state: 'reported', value: v }), 'Access unknown');
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => { const o = d.motn.streamingOptions.ua[0]; o.price = { amount: '3.99', currency: 'UAH' }; o.quality = 'hd'; o.audios = []; o.subtitles = []; } }) });
  const row = r.rows.find(r => r.id.startsWith('motn:') && r.access.value === 'rent');
  const before = JSON.stringify(row), fields = compactFields(row);
  assert.ok(fields.known.includes('Video: hd')); assert.ok(fields.known.includes('3.99 UAH (source; unverified)'));
  assert.ok(fields.unknown.includes('UA audio')); assert.ok(fields.unknown.includes('UA subtitles')); assert.ok(fields.unknown.includes('DV'));
  assert.equal(JSON.stringify(row), before);
  const draft = prepareDraft(r, row);
  assert.deepEqual(Object.keys(draft.fields), ['imdb_url', 'title', 'year', 'recommended_medium', 'purchase_url', 'status']);
  assert.doesNotMatch(JSON.stringify(draft.fields), /3.99|UAH|USD|Dolby|audio|price|quality/);
});
for (const code of [401, 403, 429, 500]) test(`TMDb HTTP ${code} leaves independent fixed-ID MOTN useful`, async () => {
  const calls = []; const r = await live(chosen(), { fetchImpl: mockDiscovery({ calls, fail: url => url.includes('themoviedb') ? new Response('PRIVATE_BODY', { status: code }) : null }) });
  assert.equal(calls.filter(c => c.url.includes('themoviedb')).length, 1); assert.ok(r.rows.some(r => r.id.startsWith('motn:')));
  assert.equal(r.sources.find(s => s.source === 'tmdb').identity, 'unresolved'); assert.doesNotMatch(JSON.stringify(r), /PRIVATE_BODY/);
});
test('B failure, no-UA and missing keys retain partials without fake unavailability', async () => {
  const bError = await live(chosen(), { fetchImpl: mockDiscovery({ fail: url => url.endsWith('/watch/providers') ? new Response('', { status: 429 }) : null }) });
  assert.equal(bError.stages.tmdb.result.providers.status, 'quota-or-rate-limit'); assert.ok(bError.rows.some(r => r.id.startsWith('motn:')));
  const empty = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => { delete d.tmdb.providers.results.UA; d.motn.streamingOptions.ua = []; } }) });
  assert.equal(empty.stages.tmdb.result.providers.uaState, 'missing'); assert.equal(empty.stages.motn.result.optionsState, 'reported-empty');
  assert.ok(empty.rows.every(r => r.availability.state === 'unknown'));
  const calls = []; const missing = await live(chosen({ kinobaza: 'off' }), { tmdbToken: '', motnKey: '', fetchImpl: mockDiscovery({ calls }) });
  assert.equal(calls.length, 0); assert.equal(missing.rows.length, 0);
});
for (const source of ['tmdb', 'motn']) test(`${source} stable conflict: affected source withheld, no common matched identity, others independently gated`, async () => {
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => { if (source === 'tmdb') d.tmdb.details.external_ids.imdb_id = 'tt0000001'; else d.motn.tmdbId = 'movie/1'; } }) });
  assert.equal(r.identity.status, 'conflict-no-common-identity'); assert.deepEqual(r.identity.conflicts, [source]);
  assert.equal(r.rows.some(r => r.id.startsWith(source + ':')), false); assert.ok(r.rows.length > 0);
});
test('year variance does not override stable IDs; original/spoken catalogue languages do not become tracks', async () => {
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => { d.motn.releaseYear = 2014; d.motn.streamingOptions.ua.forEach(o => { o.audios = []; delete o.subtitles; delete o.quality; }); d.tmdb.details.spoken_languages = [{ iso_639_1: 'uk' }]; } }) });
  assert.equal(r.stages.motn.result.identity.status, 'matched'); assert.ok(r.stages.motn.result.identity.warnings.length);
  for (const row of r.rows) { assert.ok(!row.audio.ukrainian?.length); assert.notEqual(row.quality.value, 'hd'); }
});
test('Watch Providers returned stable-ID conflict is explicit and cannot borrow Details identity; B errors visible in compact stage status', async () => {
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => { d.tmdb.providers.id = 1; } }) });
  assert.equal(r.identity.status, 'conflict-no-common-identity'); assert.ok(r.identity.conflicts.includes('tmdb'));
  assert.equal(r.sources[0].evidence.providers.tmdbId.value, 1);
  assert.equal(r.rows.some(r => r.id.startsWith('tmdb:')), false); assert.ok(r.rows.some(r => r.id.startsWith('motn:')));
  assert.match(r.sources[0].status, /B: invalid-response-or-id/);
  const error = await live(chosen(), { fetchImpl: mockDiscovery({ fail: url => url.endsWith('/watch/providers') ? new Response('', { status: 429 }) : null }) });
  assert.match(error.sources[0].status, /B: quota-or-rate-limit/);
});
test('exact source values and scope-specific possible conflicts retained; no country currency/quality fallback', async () => {
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => {
    const first = d.motn.streamingOptions.ua[0]; first.price = { amount: '3.99', currency: 'UAH' }; first.quality = 'hd';
    d.motn.streamingOptions.ua.push({ ...first, price: { amount: '3.99', currency: 'USD' }, quality: 'uhd' });
  } }) });
  const rows = r.rows.filter(r => r.id.startsWith('motn:') && r.access.value === 'rent');
  assert.deepEqual(rows.map(r => r.price.currency.value).sort(), ['UAH', 'USD']); assert.ok(rows.every(r => r.conflicts.length === 2));
  assert.ok(r.rows.some(r => r.access.value === 'buy' && r.price.state === 'not-reported'));
});
test('audio then subtitles precede explicit format, without a best-option label', async () => {
  const r = await live(chosen(), { fetchImpl: mockDiscovery({ mutate: d => {
    const first = d.motn.streamingOptions.ua[0]; first.audios = []; first.quality = 'uhd'; first.subtitles = [];
    d.motn.streamingOptions.ua.push({ ...first, audios: [{ language: 'ukr' }], quality: 'hd', type: 'buy' });
    d.motn.streamingOptions.ua.push({ ...first, subtitles: [{ locale: { language: 'ukr' } }], quality: 'hd', type: 'subscription', service: { id: 'prime', name: 'Prime Video' } });
  } }) });
  assert.ok(r.rows[0].audio.ukrainian.length); assert.ok(r.rows[1].subtitles.ukrainian.length);
});
test('explicit provider mapping preserves namespaces; Apple subscription/unknown IDs not Store', () => {
  assert.equal(mapProvider('tmdb', 2, 'Apple TV Store').sourceId, 'tmdb:provider:2');
  assert.equal(mapProvider('tmdb', 1, 'Apple TV Store'), null); assert.equal(mapProvider('tmdb', 2, 'Netflix'), null);
  assert.equal(mapProvider('motn', 'apple', 'Apple TV Store', 'subscription'), null);
  assert.equal(mapProvider('motn', 'apple', 'Apple TV', 'rent').key, 'apple');
  assert.equal(mapProvider('motn', 'apple', 'Apple TV', 'subscription'), null);
  assert.equal(mapProvider('kinobaza', undefined, 'Apple TV'), null);
  assert.equal(mapProvider('motn', 'unknown', 'Prime Video', 'rent'), null);
  assert.equal(mapProvider('kinobaza', undefined, 'Prime'), null);
  for (const name of ['Rakuten TV', 'HBO Max', 'Netflix', 'Prime Video', 'MEGOGO']) assert.ok(mapProvider('kinobaza', undefined, name));
});
test('exact/tracking/search/relative/watch/unknown/unsafe URLs; encoding preserved, no resolution', () => {
  const p = mapProvider('kinobaza', undefined, 'iTunes');
  const cases = [
    ['https://tv.apple.com/ua/movie/synthetic/umc.cmc.syntheticonly', 'exact-card-unverified'],
    ['https://click.justwatch.com/a?r=%2F%3F&amp=x', 'tracking-redirect'],
    ['https://www.youtube.com/results?search_query=synthetic', 'search'],
    ['/relative?x=%2F', 'relative'], ['https://www.themoviedb.org/movie/1/watch?locale=UA', 'tmdb-watch-page'],
    ['https://example.com/card', 'unknown'], ['javascript:alert(1)', 'unsafe'], ['https://a:b@tv.apple.com/ua/movie/x/umc.cmc.x', 'unsafe'],
  ];
  for (const [href, kind] of cases) { const r = classifyLink(href, p); assert.equal(r.kind, kind); if (kind !== 'unsafe') assert.equal(r.href, href); assert.equal(r.transferable, ['exact-card-unverified', 'tracking-redirect'].includes(kind)); }
  assert.equal(classifyLink('https://example.com/unknown', { key: '__proto__' }).transferable, false);
});
test('draft review: URL blank without permitted candidate; tracking opt-in; fields/sidecar stay separate, no mutation', async () => {
  const r = await runDiscovery(chosen()); const exact = r.rows.find(r => r.link.kind === 'exact-card-unverified');
  const before = JSON.stringify(r); const d = prepareDraft(r, exact);
  assert.equal(d.fields.status, 'wishlist'); assert.equal(d.fields.purchase_url, exact.link.href); assert.equal(d.fields.recommended_medium, 'Apple TV / iTunes');
  assert.equal(d.fields.price, undefined); assert.equal(d.fields.owned_medium, undefined); assert.equal(JSON.stringify(r), before);
  const tracking = r.rows.find(r => r.link.kind === 'tracking-redirect');
  assert.equal(prepareDraft(r, tracking).fields.purchase_url, ''); assert.equal(prepareDraft(r, tracking, true).fields.purchase_url, tracking.link.href);
  for (const kind of ['search', 'relative', 'unsafe', 'unknown', 'tmdb-watch-page']) {
    const row = { ...exact, link: { href: 'https://example.com/no', kind, transferable: false } }; const result = { ...r, rows: [row] };
    assert.equal(prepareDraft(result, row, true).fields.purchase_url, '');
  }
});
test('unexpected credential echo in another source is withheld without projecting secret', async () => {
  const r = await live(chosen(), { motnKey: 'offline-"MOTN', fetchImpl: mockDiscovery({ mutate: d => { d.tmdb.details.title = 'offline-"MOTN'; } }) });
  assert.equal(r.stages.tmdb.result, null); assert.doesNotMatch(JSON.stringify(r), /offline-MOTN/); assert.ok(r.rows.length);
});
test('total cancellation propagated to requests; no retry, preserves completed stage', async () => {
  const calls = [];
  const normal = mockDiscovery({ calls });
  const r = await live(chosen({ kinobaza: 'off' }), { deadlineMs: 20, fetchImpl: async (url, init) => {
    if (url.includes('movieofthenight')) return new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); });
    return normal(url, init);
  } });
  assert.ok(r.rows.some(r => r.id.startsWith('tmdb:'))); assert.equal(r.stages.motn.result.status, 'invalid-or-network-response-no-retry'); assert.equal(r.metrics.requestsMade, 3);
});

test('HTTP session picker, ignored browser overrides, no startup requests, one-shot and fixed source budget', async t => {
  const calls = []; const server = createDemo({ ...opts, mode: 'live', tmdbToken: 'offline-TMDB', motnKey: 'offline-MOTN', fetchImpl: mockDiscovery({ calls }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal(calls.length, 0);
  for (const path of ['/session?film=evil', '/session?film=coherence&url=https://example.com', '/session?film=coherence&film=dune-part-two', '/session?prompt=override']) assert.equal((await fetch(origin + path)).status, 400);
  for (const filmId of ['coherence', 'dune-part-two']) {
    const response = await fetch(origin + '/session?film=' + filmId); const s = await response.json();
    assert.equal(s.film.id, filmId); assert.equal(s.requestBudget, 4); assert.equal(s.kinobaza, 'on'); assert.equal(s.model, null);
    assert.doesNotMatch(JSON.stringify(s), /offline-TMDB|offline-MOTN/);
    const init = { method: 'POST', headers: { Origin: origin, 'x-demo-session': s.token }, body: JSON.stringify({ filmId: 'evil', prompt: 'evil', url: 'https://example.com' }) };
    const r = await fetch(origin + '/answer', init); assert.match(r.headers.get('cache-control'), /no-store/);
    const result = (await r.json()).result; assert.equal(result.film.id, filmId); assert.equal(result.metrics.requestsMade, 4);
    assert.equal((await fetch(origin + '/answer', init)).status, 409);
  }
  assert.equal(calls.length, 8);
});
test('source files retain no response persistence, production client or LLM paths in new mode', async () => {
  for (const file of ['discovery.mjs', 'public/discovery-client.mjs']) {
    const code = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|writeFile|console\.(log|error)|supabase|generateContent|googleSearch|urlContext|innerHTML\s*=/);
  }
});

test('new picker/assets/answer retain LAN auth, exact Host/Origin, no credential payload and pre-await one-shot', async t => {
  const address = '192.168.88.7', password = 'offline-discovery-password'; // Authored address only; bind loopback.
  const authorization = 'Basic ' + Buffer.from('demo:' + password).toString('base64'); const calls = [];
  const server = createDemo({ ...opts, mode: 'live', access: 'lan', bindIPv4: address, lanPassword: password,
    interfaces: { fixture: [{ address, internal: false }] }, tmdbToken: 'offline-TMDB', motnKey: 'offline-MOTN', fetchImpl: mockDiscovery({ calls }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const port = server.address().port, origin = `http://${address}:${port}`;
  const request = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${port}${path}`, { method, headers: { Host: `${address}:${port}`, ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    }); req.on('error', reject); req.end();
  });
  for (const path of ['/', '/session?film=dune-part-two', '/discovery-client.mjs', '/answer']) assert.equal((await request(path)).status, 401);
  const response = await request('/session?film=coherence', { Authorization: authorization }); const session = await response.json();
  assert.doesNotMatch(JSON.stringify(session), /offline-TMDB|offline-MOTN|offline-discovery-password/);
  const headers = { Authorization: authorization, Origin: origin, 'x-demo-session': session.token };
  for (const change of [{ Host: 'evil' }, { Origin: 'http://evil' }, { Origin: '' }, { Authorization: 'Basic bad' }]) assert.ok([401, 403].includes((await request('/answer', { ...headers, ...change }, 'POST')).status));
  assert.equal(calls.length, 0);
  const results = await Promise.all([request('/answer', headers, 'POST'), request('/answer', headers, 'POST')]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal(calls.length, 4);
  assert.equal((await request('/session?film=dune-part-two', { Authorization: authorization, Origin: 'http://evil' })).status, 403);
});
for (const kind of ['invalid-json', 'oversize', 'redirect', 'source-blocked']) test(`bounded composition ${kind}: partials, no retry/destination/body leak`, async () => {
  const calls = []; const r = await live(chosen(), { fetchImpl: mockDiscovery({ calls, fail: url => {
    if (!url.includes('movieofthenight')) return null;
    if (kind === 'invalid-json') return new Response('PRIVATE invalid {', { headers: { 'content-type': 'application/json' } });
    if (kind === 'oversize') return new Response('PRIVATE', { headers: { 'content-type': 'application/json', 'content-length': '99999999' } });
    return new Response('PRIVATE', { status: kind === 'redirect' ? 302 : 403, headers: { location: 'https://example.com/never-fetch' } });
  } }) });
  assert.equal(calls.length, 4); assert.equal(calls.some(c => c.url.includes('example.com')), false);
  assert.equal(r.rows.some(r => r.id.startsWith('motn:')), false); assert.ok(r.rows.length); assert.doesNotMatch(JSON.stringify(r), /PRIVATE|never-fetch/);
});
