import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createDemo } from '../server.mjs';
import { selectRequest, requestBody } from '../config.mjs';
import { MOTN_FILMS, normalizeMotn, syntheticMotn, fetchMotn } from '../motn.mjs';

const options = { retrieval: 'motn-api', discovery: 'digital-ua', filmId: 'coherence' };
const selection = () => selectRequest(options);
const fixture = () => syntheticMotn('coherence');
const key = 'OFFLINE-MOTN-KEY-DO-NOT-LOG';
const parse = data => normalizeMotn(data, 'coherence', '2026-10-18T00:00:00.000Z');

test('fixed two-film country/endpoint selection; unsupported input never builds Gemini request', () => {
  for (const filmId of Object.keys(MOTN_FILMS)) {
    const selected = selectRequest({ ...options, filmId });
    assert.equal(selected.country, 'ua'); assert.equal(selected.prompt, null);
    assert.equal(selected.sourceURL, `https://api.movieofthenight.com/v4/shows/${MOTN_FILMS[filmId].imdbId}?country=ua`);
    assert.throws(() => requestBody(filmId, options), /no Gemini/);
  }
  for (const changes of [{ filmId: 'blade-runner-final-cut' }, { discovery: 'physical' }, { discovery: undefined },
    { amazonRegion: 'us' }, { urlSource: 'kinobaza' }, { urlSource: '' }]) assert.throws(() => createDemo({ ...options, ...changes }));
  assert.throws(() => createDemo({ ...options, scenario: 'api-error' }));
});

test('UA only; multiple offers stay separate; price/audio/subtitles/quality do not transfer', () => {
  const result = parse(fixture());
  assert.equal(result.status, 'ok'); assert.equal(result.identity.status, 'matched');
  assert.equal(result.receivedAt, '2026-10-18T00:00:00.000Z'); assert.equal(result.country, 'ua');
  assert.equal(result.options.length, 2); assert.doesNotMatch(JSON.stringify(result), /Foreign|example.com\/foreign/);
  const [rent, buy] = result.options;
  assert.equal(rent.access.value, 'rent'); assert.equal(rent.price.currency.value, 'XXX');
  assert.equal(rent.link.value, 'https://example.com/invented?x=%2F&y=1');
  assert.equal(rent.ukrainianAudio.state, 'reported'); assert.equal(rent.ukrainianAudio.ukrainian[0].language, 'ukr');
  assert.equal(rent.ukrainianSubtitles.state, 'not-listed-completeness-unknown');
  assert.equal(buy.price.state, 'not-reported'); assert.equal(buy.quality.state, 'not-reported');
  assert.equal(buy.ukrainianAudio.state, 'not-listed-completeness-unknown');
  assert.equal(buy.ukrainianSubtitles.state, 'not-reported');
  assert.ok(!Object.hasOwn(rent, 'hdr')); assert.ok(!Object.hasOwn(rent, 'codec'));
});

test('positive locales vs missing/empty/incomplete lists; no original-language or country inference', () => {
  const data = fixture(); const first = data.streamingOptions.ua[0];
  first.audios = [{ language: 'uk', region: 'UKR' }, { language: 'eng' }];
  first.subtitles = [{ locale: { language: 'ukr' }, closedCaptions: false }];
  let row = parse(data).options[0];
  assert.equal(row.ukrainianAudio.state, 'reported'); assert.equal(row.ukrainianSubtitles.state, 'reported');
  first.audios = [{ language: 'eng', region: 'UKR' }, { language: 'ukraine' }];
  row = parse(data).options[0]; assert.equal(row.ukrainianAudio.state, 'not-listed-completeness-unknown');
  assert.equal(row.ukrainianAudio.completeness, 'not-established');
  delete first.audios; data.originalLanguage = 'ukr';
  assert.equal(parse(data).options[0].ukrainianAudio.state, 'not-reported');
  first.audios = 'ukr'; assert.equal(parse(data).options[0].ukrainianAudio.state, 'invalid');
});

test('Apple service name alone does not imply subscription; addon is separate; other type retained', () => {
  const data = fixture();
  for (const type of ['buy', 'rent', 'subscription', 'addon', 'other-access']) {
    data.streamingOptions.ua[0] = { service: { id: 'apple', name: 'Apple TV' }, type, addon: { id: 'example', name: 'Example channel' } };
    const row = parse(data).options[0]; assert.equal(row.access.value, type); assert.equal(row.addon.name.value, 'Example channel');
  }
});

test('identity mismatches fail closed, never returning another title options', () => {
  for (const change of [d => d.imdbId = 'tt0000000', d => delete d.imdbId, d => d.showType = 'series',
    d => d.originalTitle = 'Another movie', d => d.releaseYear = 2020, d => d.tmdbId = 'movie/1', d => d.directors = ['Someone Else']]) {
    const data = fixture(); change(data); const result = parse(data);
    assert.equal(result.status, 'identity-unresolved'); assert.deepEqual(result.options, []);
  }
  const translated = fixture(); translated.title = 'Зв’язок';
  assert.equal(parse(translated).identity.status, 'matched'); // originalTitle still matches.
});

test('empty/missing UA is not unavailability; malformed responses do not look successful', () => {
  for (const value of [undefined, []]) {
    const data = fixture(); if (value) data.streamingOptions.ua = value; else delete data.streamingOptions.ua;
    const result = parse(data); assert.equal(result.status, 'no-ua-options'); assert.deepEqual(result.options, []);
    assert.equal(result.uaField, value ? 'reported' : 'not-reported');
  }
  for (const data of [null, [], 'not JSON object', { ...fixture(), streamingOptions: null },
    { ...fixture(), streamingOptions: { ua: {} } }]) assert.equal(parse(data).status, 'invalid-response');
  const bad = fixture(); bad.streamingOptions.ua = [null]; assert.equal(parse(bad).status, 'partial');
});

test('unsafe URLs and invalid fields withheld; no destination resources', () => {
  for (const url of ['javascript:alert(1)', 'https://user:secret@example.com', '/relative', 'https://example.com/back\\slash', 'https://example.com/white space']) {
    const data = fixture(); data.streamingOptions.ua[0].link = url;
    const result = parse(data); assert.equal(result.options[0].link.state, 'invalid');
    assert.ok(!JSON.stringify(result).includes(url));
  }
  const data = fixture(); data.streamingOptions.ua[0].quality = 'HDR10';
  assert.equal(parse(data).options[0].quality.state, 'invalid');
});

test('one exact bounded GET, server-side header only, no country lookup/LLM/destination/fallback', async () => {
  const calls = [];
  const result = await fetchMotn(selection(), key, async (url, init) => { calls.push({ url, init }); return Response.json(fixture()); });
  assert.equal(result.status, 'ok'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, selection().sourceURL); assert.ok(!calls[0].url.includes(key));
  assert.equal(calls[0].init.headers['X-API-Key'], key); assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'manual'); assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.body, undefined);
  assert.ok(!JSON.stringify(result).includes(key)); assert.ok(!Object.hasOwn(result, 'raw'));
  await assert.rejects(() => fetchMotn({ ...selection(), sourceURL: 'https://example.com' }, key, () => assert.fail('No arbitrary source')));
  for (const credential of ['', 'bad\nkey']) assert.match((await fetchMotn(selection(), credential, () => assert.fail('No request'))).status, /key-no-request/);
});

test('auth/quota/redirect/HTTP/invalid/oversize/timeout errors never leak provider content or retry', async t => {
  const cases = [
    ...[301, 302, 401, 403, 404, 429, 500].map(status => [String(status), () => new Response(`SECRET ${key}`, { status, headers: { location: 'https://example.com/no-follow' } })]),
    ['invalid-json', () => new Response('{not json ' + key, { headers: { 'content-type': 'application/json' } })],
    ['html', () => new Response('<script>unsafe</script>')],
    ['too-large', () => new Response('x', { headers: { 'content-type': 'application/json', 'content-length': '9999999' } })],
    ['stream-too-large', () => Response.json(fixture())],
    ['echo-key', () => Response.json({ ...fixture(), title: key })],
    ['timeout', () => new Promise(() => {})],
  ];
  for (const [name, make] of cases) await t.test(name, async () => {
    let calls = 0;
    const result = await fetchMotn(selection(), key, async () => { calls++; return make(); }, { timeoutMs: name === 'timeout' ? 10 : 1000, maxBytes: name === 'stream-too-large' ? 10 : 10000 });
    assert.equal(calls, 1); assert.notEqual(result.status, 'ok'); assert.deepEqual(result.options, []);
    assert.ok(!JSON.stringify(result).includes(key)); assert.doesNotMatch(JSON.stringify(result), /SECRET|script|no-follow/);
  });
});

test('timeout includes a stalled response body; invalid UTF-8 and locale/price shapes stay explicit', async () => {
  const stalled = new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } });
  assert.equal((await fetchMotn(selection(), key, async () => stalled, { timeoutMs: 10 })).status, 'timeout-no-retry');
  const invalidUTF8 = new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } });
  assert.equal((await fetchMotn(selection(), key, async () => invalidUTF8)).status, 'invalid-or-network-response-no-retry');
  const data = fixture(); data.streamingOptions.ua[0].subtitles = [{ locale: { language: 123 } }];
  data.streamingOptions.ua[0].price = { amount: {}, currency: 'XXX' };
  const result = parse(data); assert.equal(result.status, 'partial');
  assert.equal(result.options[0].ukrainianSubtitles.state, 'invalid'); assert.equal(result.options[0].price.amount.state, 'invalid');
});

async function start(t, extra = {}) {
  const server = createDemo({ ...options, ...extra });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
test('session exact endpoint matches a single mock; browser prompt/country/key override ignored; failure consumes token', async t => {
  for (const mode of ['synthetic', 'live']) await t.test(mode, async t => {
    const calls = [];
    const { origin } = await start(t, { mode, motnKey: key, apiKey: 'NEVER-GEMINI', fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json(fixture()); } });
    const sessionText = await (await fetch(`${origin}/session`)).text(); const session = JSON.parse(sessionText);
    assert.ok(!sessionText.includes(key)); assert.equal(session.model, null); assert.equal(session.country, 'ua');
    const headers = { Origin: origin, 'x-demo-session': session.token };
    const response = await fetch(`${origin}/answer`, { method: 'POST', headers, body: JSON.stringify({ country: 'gb', prompt: 'ignored', url: 'https://example.com', key: 'ignored' }) });
    const payload = await response.json(); assert.equal(payload.result.status, 'ok');
    assert.equal(calls.length, mode === 'live' ? 1 : 0);
    if (calls.length) assert.equal(calls[0].url, session.sourceURL);
    assert.equal((await fetch(`${origin}/answer`, { method: 'POST', headers })).status, 409);
    assert.ok(!JSON.stringify(payload).includes(key));
  });
  const { origin } = await start(t, { mode: 'live', fetchImpl: () => assert.fail('No key') });
  const session = await (await fetch(`${origin}/session`)).json(); const headers = { Origin: origin, 'x-demo-session': session.token };
  assert.equal((await (await fetch(`${origin}/answer`, { method: 'POST', headers })).json()).result.status, 'missing-key-no-request');
  assert.equal((await fetch(`${origin}/answer`, { method: 'POST', headers })).status, 409);
});

test('LAN auth/Host/Origin protect new mode and display asset; unauthorized calls do not consume token', async t => {
  const address = '192.168.77.8'; const password = 'offline-lan-only';
  let calls = 0;
  const { server, origin: loopback } = await start(t, { mode: 'live', motnKey: key, access: 'lan', bindIPv4: address, lanPassword: password,
    interfaces: { fixture: [{ address, internal: false }] }, fetchImpl: async () => { calls++; return Response.json(fixture()); } });
  const host = `${address}:${server.address().port}`; const origin = `http://${host}`;
  const auth = `Basic ${Buffer.from(`demo:${password}`).toString('base64')}`;
  const req = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const request = httpRequest(loopback + path, { method, headers: { Host: host, ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode })));
    }); request.on('error', reject); request.end();
  });
  for (const path of ['/', '/session', '/answer', '/motn-display.mjs']) assert.equal((await req(path)).status, 401);
  const session = await (await req('/session', { Authorization: auth })).json();
  const good = { Origin: origin, Authorization: auth, 'x-demo-session': session.token };
  assert.equal((await req('/answer', { ...good, Authorization: 'Basic d3Jvbmc=' }, 'POST')).status, 401);
  assert.equal((await req('/answer', { ...good, Origin: 'https://example.com' }, 'POST')).status, 403);
  assert.equal((await req('/answer', { ...good, Host: 'localhost' }, 'POST')).status, 403);
  assert.equal(calls, 0); assert.equal((await req('/answer', good, 'POST')).status, 200); assert.equal(calls, 1);
  assert.equal((await req('/answer', good, 'POST')).status, 409);
});

test('adapter/display contain no logging, storage, model call or destination fetch; source data is synthetic only', async () => {
  const source = await readFile(new URL('../motn.mjs', import.meta.url), 'utf8');
  const display = await readFile(new URL('../public/motn-display.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source + display, /console\.|writeFile|localStorage|sessionStorage|indexedDB|innerHTML|generativelanguage|googleSearch/);
  assert.equal((source.match(/fetchImpl\(/g) ?? []).length, 1);
  assert.doesNotMatch(display, /fetch\(|createElement\('(img|script|iframe)'\)/);
  assert.doesNotMatch(JSON.stringify(fixture()), /tv\.apple|primevideo|netflix|7\.99|3\.99/);
});
