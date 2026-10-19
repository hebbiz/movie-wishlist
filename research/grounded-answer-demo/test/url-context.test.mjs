import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDemo } from '../server.mjs';
import { APPLE_UA_CARDS } from '../url-context.mjs';
import { selectRequest, requestBody, selectScenario, FILMS, AMAZON_REGIONS } from '../config.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { urlDisplayParts } from '../public/url-display.mjs';

const options = { retrieval: 'url-context', discovery: 'digital-ua' };
const fixture = (scenario = 'grounded', filmId = 'dune-part-two') => syntheticResponse(scenario, filmId, options);
const candidate = response => response.candidates[0];
const entries = response => candidate(response).urlContextMetadata.urlMetadata;

test('fixed URL catalogue: two official UA cards, no arbitrary URLs or expected offer facts', () => {
  assert.deepEqual(Object.keys(APPLE_UA_CARDS), ['dune-part-two', 'coherence']);
  for (const filmId of Object.keys(APPLE_UA_CARDS)) {
    const selection = selectRequest({ filmId, ...options });
    const body = requestBody(filmId, options);
    assert.equal(selection.sourceURL, APPLE_UA_CARDS[filmId]);
    assert.equal(new URL(selection.sourceURL).host, 'tv.apple.com');
    assert.equal(new URL(selection.sourceURL).pathname.split('/')[1], 'ua');
    assert.deepEqual(body.tools, [{ urlContext: {} }]);
    assert.equal(body.contents[0].parts[0].text, selection.prompt);
    assert.equal(selection.prompt.split(selection.sourceURL).length - 1, 1);
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'low' } });
    for (const instruction of ['Film identity', 'Viewing availability in Ukraine', 'Ukrainian audio', 'Ukrainian subtitles', '4K, HDR10, Dolby Vision and HD, each separately', 'Rental, purchase or subscription', 'Original language is not available audio', 'only in an account', 'Missing metadata is unknown']) assert.ok(selection.prompt.includes(instruction));
    assert.doesNotMatch(selection.prompt, /7\.99|3\.99|Russian|Dolby 5\.1|MEGOPACK|Ukrainian \(AAC/);
    assert.ok(!JSON.stringify(body.tools).includes('googleSearch'));
  }
});

test('invalid URL-mode combinations fail at startup, without a Search fallback', () => {
  for (const selection of [
    { retrieval: '' }, { retrieval: 'unknown' }, { retrieval: '__proto__' },
    { retrieval: 'url-context' }, { ...options, discovery: 'physical' },
    { ...options, amazonRegion: 'us' }, { ...options, amazonRegion: '' },
    { ...options, filmId: 'blade-runner-final-cut' },
  ]) assert.throws(() => createDemo({ ...selection, fetchImpl: () => assert.fail('Provider forbidden') }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, DEMO_RETRIEVAL: 'unknown', DEMO_MODE: 'synthetic', DEMO_ACCESS: 'localhost', DEMO_BIND_IPV4: undefined },
    encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEMO_RETRIEVAL/);
  assert.doesNotMatch(result.stdout, /Local .* demo/);
});

test('Search remains default with unchanged prompts/tool/settings for all 18 configurations', () => {
  for (const filmId of Object.keys(FILMS)) for (const configuration of [
    { discovery: 'physical' }, { discovery: 'digital-ua' },
    ...Object.keys(AMAZON_REGIONS).map(amazonRegion => ({ discovery: 'physical', amazonRegion })),
  ]) {
    const selected = selectRequest({ filmId, ...configuration });
    assert.equal(selected.retrieval, 'search');
    assert.equal(selected.sourceURL, null);
    assert.equal(selected.prompt, selectScenario({ filmId, ...configuration }).prompt);
    assert.deepEqual(requestBody(filmId, configuration), requestBody(filmId, { ...configuration, retrieval: 'search' }));
    assert.deepEqual(requestBody(filmId, configuration).tools, [{ googleSearch: {} }]);
  }
});

test('synthetic URL fixture is explicitly invented; never pretends a page was read', () => {
  for (const filmId of Object.keys(APPLE_UA_CARDS)) {
    const response = fixture('grounded', filmId);
    const displayed = urlDisplayParts(response, APPLE_UA_CARDS[filmId]);
    assert.match(displayed.text, /SYNTHETIC ONLY/);
    assert.match(displayed.text, /No page was retrieved or read/);
    assert.match(displayed.text, /unknown/);
    assert.equal(displayed.text, candidate(response).content.parts[0].text);
    assert.equal(candidate(response).groundingMetadata, undefined);
  }
});

test('documented retrieval success is transport metadata, not truth/freshness/entitlement', () => {
  const response = fixture();
  candidate(response).content.parts = [{ thought: true, text: 'hidden thought' }, { text: 'Ї🪐 original\n' }, { text: '<script>not HTML</script>' }];
  candidate(response).citationMetadata = { citationSources: [{ uri: APPLE_UA_CARDS['dune-part-two'], license: 'as returned' }] };
  candidate(response).groundingMetadata = { groundingChunks: [{ web: { uri: APPLE_UA_CARDS['dune-part-two'] } }] };
  const data = urlDisplayParts(response, APPLE_UA_CARDS['dune-part-two']);
  assert.equal(data.text, 'Ї🪐 original\n<script>not HTML</script>');
  assert.deepEqual(data.metadata, candidate(response).urlContextMetadata);
  assert.deepEqual(data.attribution, candidate(response).citationMetadata);
  assert.deepEqual(data.groundingAttribution, candidate(response).groundingMetadata);
  assert.equal(data.matchingSuccess, true);
  assert.match(data.notice, /Not proof of truth, freshness or Ukrainian entitlement/);
});

test('retrieval error/paywall/unsafe status remains visible alongside unchanged answer', () => {
  for (const scenario of ['retrieval-error', 'retrieval-paywall', 'retrieval-unsafe']) {
    const response = fixture(scenario);
    const data = urlDisplayParts(response, APPLE_UA_CARDS['dune-part-two']);
    assert.equal(data.matchingSuccess, false);
    assert.match(data.notice, /Page reading is NOT established/);
    assert.equal(data.text, candidate(response).content.parts[0].text);
    assert.deepEqual(data.metadata, candidate(response).urlContextMetadata);
  }
});

test('missing, malformed, duplicate, foreign, unspecified and future statuses never claim success', () => {
  for (const change of [
    response => { delete candidate(response).urlContextMetadata; },
    response => { entries(response)[0].urlRetrievalStatus = 'URL_RETRIEVAL_STATUS_UNSPECIFIED'; },
    response => { entries(response)[0].urlRetrievalStatus = 'FUTURE_STATUS'; },
    response => { entries(response)[0].retrievedUrl = APPLE_UA_CARDS.coherence; },
    response => { entries(response).push({ ...entries(response)[0] }); },
    response => { candidate(response).urlContextMetadata.urlMetadata = 'not-an-array'; },
    response => { candidate(response).urlContextMetadata.urlMetadata = [null]; },
    response => { candidate(response).urlContextMetadata.urlMetadata = []; },
  ]) {
    const response = fixture(); change(response);
    const data = urlDisplayParts(response, APPLE_UA_CARDS['dune-part-two']);
    assert.equal(data.matchingSuccess, false);
    assert.match(data.notice, /NOT established/);
  }
});

test('empty/truncated/unsupported output is not fabricated; retrieval metadata still visible', () => {
  for (const finishReason of ['MAX_TOKENS', 'SAFETY', 'CONTINUATION']) {
    const response = fixture(); candidate(response).finishReason = finishReason;
    const data = urlDisplayParts(response, APPLE_UA_CARDS['dune-part-two']);
    assert.equal(data.text, '');
    assert.deepEqual(data.metadata, candidate(response).urlContextMetadata);
    assert.match(data.notice, /no partial text displayed/);
  }
  for (const response of [null, {}, { candidates: [] }]) assert.throws(() => urlDisplayParts(response));
  const unexpected = fixture(); candidate(unexpected).groundingMetadata = { searchEntryPoint: { renderedContent: 'unexpected' } };
  assert.throws(() => urlDisplayParts(unexpected), /Unexpected Search/);
});

async function start(t, overrides = {}) {
  const server = createDemo({ ...options, ...overrides });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, session: async () => (await fetch(`${origin}/session`)).json() };
}

test('both fixed URLs/session prompts equal exactly one mocked request; browser overrides ignored', async t => {
  for (const filmId of Object.keys(APPLE_UA_CARDS)) await t.test(filmId, async t => {
    let calls = 0; let sent;
    const { origin, session } = await start(t, { filmId, mode: 'live', apiKey: 'offline-key', fetchImpl: async (_, init) => {
      calls++; sent = JSON.parse(init.body); assert.equal(init.redirect, 'error');
      return Response.json(fixture('grounded', filmId));
    } });
    const page = await session();
    assert.equal(page.sourceURL, APPLE_UA_CARDS[filmId]);
    assert.equal(page.retrieval, 'url-context');
    const attempt = () => fetch(`${origin}/answer`, {
      method: 'POST', headers: { Origin: origin, 'x-demo-session': page.token },
      body: JSON.stringify({ prompt: 'override', sourceURL: 'https://example.com', retrieval: 'search' }),
    });
    const results = await Promise.all([attempt(), attempt()]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await attempt()).status, 409);
    assert.equal(calls, 1);
    assert.equal(sent.contents[0].parts[0].text, page.prompt);
    assert.ok(page.prompt.includes(page.sourceURL));
    assert.deepEqual(sent, requestBody(filmId, options));
  });
});

test('URL mode missing key/API/JSON/transport errors consume one session, no retry', async t => {
  for (const kind of ['missing-key', 'http', 'json', 'transport']) await t.test(kind, async t => {
    let calls = 0;
    const { origin, session } = await start(t, { mode: 'live', apiKey: kind === 'missing-key' ? '' : 'offline-key', fetchImpl: async () => {
      calls++;
      if (kind === 'http') return new Response('PRIVATE_PROVIDER_BODY', { status: 429 });
      if (kind === 'json') return new Response('PRIVATE_PROVIDER_BODY');
      throw new Error('PRIVATE_PROVIDER_BODY');
    } });
    const page = await session();
    const post = () => fetch(`${origin}/answer`, { method: 'POST', headers: { Origin: origin, 'x-demo-session': page.token } });
    const response = await post();
    assert.equal(response.status, kind === 'missing-key' ? 503 : 502);
    assert.ok(!(await response.text()).includes('PRIVATE_PROVIDER_BODY'));
    assert.equal((await post()).status, 409);
    assert.equal(calls, kind === 'missing-key' ? 0 : 1);
  });
});

test('URL-only LAN gate protects assets/session/answer; wrong auth/Host/Origin cannot spend token', async t => {
  for (const urlSource of ['apple-tv', 'kinobaza']) await t.test(urlSource, async t => {
    const address = '192.168.88.7'; // Test-only Host; server listens only on loopback.
    const password = 'offline-url-password';
    const auth = `Basic ${Buffer.from(`demo:${password}`).toString('base64')}`;
    let calls = 0;
    const server = createDemo({ ...options, urlSource, access: 'lan', bindIPv4: address, lanPassword: password,
      interfaces: { test: [{ address, internal: false }] }, mode: 'live', apiKey: 'offline-key',
      fetchImpl: async () => { calls++; return Response.json(syntheticResponse('grounded', undefined, { ...options, urlSource })); },
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;
    const origin = `http://${address}:${port}`;
    const request = (path, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${port}${path}`, { method, headers: { Host: `${address}:${port}`, ...headers } }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
      }); req.on('error', reject); req.end();
    });
    for (const path of ['/', '/url-display.mjs', '/session', '/answer']) assert.equal((await request(path)).status, 401);
    const page = await (await request('/session', 'GET', { Authorization: auth })).json();
    assert.ok(!JSON.stringify(page).includes(password));
    const headers = { Authorization: auth, Origin: origin, 'x-demo-session': page.token };
    for (const [override, expected] of [[{ Authorization: 'Basic d3Jvbmc=' }, 401], [{ Host: 'localhost' }, 403], [{ Origin: 'http://example.com' }, 403]]) assert.equal((await request('/answer', 'POST', { ...headers, ...override })).status, expected);
    assert.equal(calls, 0);
    assert.equal((await request('/answer', 'POST', headers)).status, 200);
    assert.equal((await request('/answer', 'POST', headers)).status, 409);
    assert.equal(calls, 1);
  });
});

test('URL modules have no storage/logging/network calls; prompt/catalogue have no search tool', async () => {
  for (const file of ['../url-context.mjs', '../public/url-display.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /writeFile|appendFile|createWriteStream|localStorage|sessionStorage|indexedDB|sendBeacon|console\.|fetch\(/);
    assert.doesNotMatch(source, /googleSearch\s*:/);
  }
});
