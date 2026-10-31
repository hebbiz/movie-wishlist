import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createDemo } from '../server.mjs';
import { selectRequest, requestBody, FILMS } from '../config.mjs';
import { syntheticHtml } from '../synthetic.mjs';
import { extractHtml, fetchHtmlCandidates } from '../html-source.mjs';

const options = { retrieval: 'kinobaza-html', discovery: 'digital-ua', urlSource: 'kinobaza' };
const select = (filmId = 'coherence') => selectRequest({ ...options, filmId });
const markup = (id = 'coherence') => syntheticHtml(FILMS[id]);
const parse = html => extractHtml(html, FILMS.coherence);
const htmlResponse = html => new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });

test('HTML source selection is fixed; unsupported configurations cannot produce a model body', () => {
  for (const id of ['coherence', 'dune-part-two']) {
    const chosen = select(id);
    assert.equal(chosen.sourceURL, `https://kinobaza.com.ua/titles/${id}`);
    assert.equal(chosen.prompt, null);
    assert.throws(() => requestBody(id, options), /no Gemini/);
  }
  for (const changes of [{ filmId: 'blade-runner-final-cut' }, { discovery: 'physical' }, { amazonRegion: 'us' }, { urlSource: 'apple-tv' }, { urlSource: '' }]) {
    assert.throws(() => createDemo({ ...options, ...changes, fetchImpl: () => assert.fail('No network') }));
  }
});

test('authored fixtures: exact href/raw spelling, territory sections and unscoped relative candidate', async () => {
  for (const id of ['coherence', 'dune-part-two']) {
    const result = await extractHtml(markup(id), FILMS[id]);
    assert.equal(result.identity.status, 'matched');
    assert.deepEqual(result.candidates.map(c => c.territory?.code ?? null), ['UA', 'PL', null]);
    const [ua, foreign, outside] = result.candidates;
    assert.equal(ua.provider, 'Example UA');
    assert.equal(ua.href, 'https://example.com/redirect?x=%2F&y=1');
    assert.equal(ua.rawHref, 'https://example.com/redirect?x=%2F&amp;y=1');
    assert.equal(foreign.hrefKind, 'absolute');
    assert.equal(outside.hrefKind, 'relative');
    assert.equal(outside.href, '/relative?x=%2F&y=1');
    assert.ok(result.candidates.every(c => !Object.hasOwn(c, 'availability')));
    assert.ok(result.candidates.every(c => !/navigation|JustWatch|script/.test(c.provider)));
  }
});

test('identity uses observed title/year/director, including nested year and inline label; no guessing', async () => {
  const nested = markup().replace('(2013)', '(<a>2013</a>)').replace('<table><tbody><tr><td>Режисер:</td><td>James Ward Byrkit</td></tr></tbody></table>', '<div>Режисер: <a>James Ward Byrkit</a></div>');
  assert.equal((await parse(nested)).identity.status, 'matched');
  for (const bad of [markup().replace('(2013)', '(2020)'), markup().replace('James Ward Byrkit', 'Someone Else'), markup().replace('<h2>Coherence</h2>', '<h2>Different Film</h2>'), markup().replace('</h1>', '</h1><h1>Another film (2013)</h1>')]) {
    const result = await parse(bad);
    assert.equal(result.status, 'identity-unresolved'); assert.deepEqual(result.candidates, []);
  }
});

test('missing href remains unresolved; unsafe schemes/credentials never become candidate URLs', async () => {
  const missing = await parse(markup().replace('href="https://example.com/redirect?x=%2F&amp;y=1"', ''));
  assert.equal(missing.candidates[0].issue, 'missing-href');
  assert.equal(missing.candidates[0].href, null);
  for (const href of ['javascript:alert(1)', 'java&#x73;cript:alert(1)', 'data:text/html,bad', 'file:///C:/private', 'https://user:password@example.com/', 'https://example.com/white space']) {
    const result = await parse(markup().replace('https://example.com/redirect?x=%2F&amp;y=1', href));
    assert.equal(result.candidates[0].href, null);
    assert.equal(result.candidates[0].status, 'unresolved');
    assert.ok(!JSON.stringify(result).includes('user:password'));
  }
});

test('attribution, navigation, ads, trailers and inert scripts cannot supply provider candidates', async () => {
  const a = '<a title="Дивитись / Купити на Excluded" href="https://example.com/not-an-offer">Excluded</a>';
  const inert = markup().replace('<a href="https://www.justwatch.com/ua/">', `<nav>${a}</nav><aside>${a}</aside><div class="advertisement">${a}</div><div class="trailer">${a}</div><script>${a}</script><template>${a}</template><a href="https://www.justwatch.com/ua/">`);
  const result = await parse(inert);
  assert.ok(!result.candidates.some(c => c.provider === 'Excluded'));
  assert.equal(result.candidates.length, 3);
});

test('country ambiguity withholds every country candidate while retaining the separately bounded badge', async () => {
  for (const [body, issue] of [
    [markup().replace('Доступно в Україні', 'Український інтерфейс'), 'unsupported-or-conflicting-territory'],
    [markup().replace('data-bs-target="#collapseUA"', 'data-bs-target="#collapsePL"'), 'unsupported-or-conflicting-territory'],
    [markup().replace('id="collapseUA"', 'id="collapseXX"'), 'ambiguous-territory-panel'],
  ]) {
    const result = await parse(body);
    assert.equal(result.status, 'partial'); assert.equal(result.identity.status, 'matched'); assert.deepEqual(result.issues, ['not-an-absolute-provider-url', issue]);
    assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].provider, 'Example Outside');
    assert.equal(result.candidates[0].territory, null); assert.equal(result.candidates[0].href, '/relative?x=%2F&y=1');
    assert.deepEqual(result.availabilitySignals, []);
  }
});

test('changed boundary, parse errors and CAPTCHA still withhold all claims', async () => {
  for (const html of [
    markup().replace('id="availabilityAccordion"', 'id="changed"'),
    markup().replace('href="/relative', 'href="x" href="/relative'),
    '<!doctype html><html><head><title>CAPTCHA</title></head><body>Verify access</body></html>',
  ]) { const result = await parse(html); assert.ok(['unsupported-markup', 'identity-unresolved'].includes(result.status)); assert.deepEqual(result.candidates, []); }
});

// Authored tokenization regressions, not an archive of any source response.
const brokenTrailerImage = '<img alt="Authored "quoted" trailer" src="/authored.jpg">';
const afterViewing = (image = brokenTrailerImage) => markup().replace('</body>', `${image}</body>`);
test('located noncritical image attribute errors after a closed viewing boundary preserve exact candidates', async () => {
  const expected = await parse(markup()), result = await parse(afterViewing());
  assert.equal(result.status, 'partial'); assert.equal(result.identity.status, 'matched');
  assert.deepEqual(result.candidates, expected.candidates);
  assert.deepEqual(result.localization, expected.localization);
  assert.deepEqual(result.availabilitySignals, expected.availabilitySignals);
  assert.deepEqual(result.issues, [...expected.issues, 'noncritical-image-markup-recovered']);
});

test('the same image errors in or before critical structures still refuse before identity', async () => {
  const append = content => markup().replace('</body>', `${content}</body>`);
  const cases = [
    markup().replace('<h1>', `${brokenTrailerImage}<h1>`),
    markup().replace('<div id="collapseUA"', `${brokenTrailerImage}<div id="collapseUA"`),
    append(`<h1>${brokenTrailerImage}</h1>`), append(`<h2>${brokenTrailerImage}</h2>`),
    append(`<table><tbody><tr><td>${brokenTrailerImage}</td></tr></tbody></table>`),
    append(`<table>${brokenTrailerImage}<tbody><tr><td>Authored</td></tr></tbody></table>`),
    append(`<a title="Дивитись / Купити на Apple TV" href="https://example.com/">${brokenTrailerImage}</a>`),
    append('<img alt="Authored "broken" swallowed <h1> title">'),
    afterViewing().replace('</div><script>', '<script>'),
    markup().replace('id="availabilityAccordion"', 'id="changed"').replace('</body>', `${brokenTrailerImage}</body>`),
    append(`<div id="availabilityAccordion"></div>${brokenTrailerImage}`),
  ];
  for (const [index, body] of cases.entries()) {
    let checks = 0;
    const result = await extractHtml(body, FILMS.coherence, { identityCheck: () => { checks++; return { status: 'matched' }; } });
    assert.equal(result.status, 'unsupported-markup', `critical case ${index}`); assert.deepEqual(result.issues, ['html-parse-errors']);
    assert.equal(checks, 0); assert.deepEqual(result.candidates, []); assert.equal(result.localization, undefined);
  }
});

test('duplicate and other attribute errors remain critical, including after many tolerated events', async () => {
  for (const body of [
    afterViewing('<img alt="one" alt="two">'),
    afterViewing('<img src="/x\u0000">'),
    afterViewing().replace('</head>', '<link rel="canonical" href="first" href="second"></head>'),
    afterViewing().replace('data-bs-target="#collapseUA"', 'data-bs-target="#collapseUA" data-bs-target="#collapsePL"'),
    afterViewing().replace('id="collapseUA"', 'id="collapseUA" id="collapsePL"'),
    afterViewing().replace('href="https://example.com/redirect', 'href="first" href="https://example.com/redirect'),
    afterViewing(brokenTrailerImage.repeat(12) + '<img alt="first" alt="second">'),
    afterViewing(brokenTrailerImage.repeat(257)),
  ]) {
    const result = await parse(body);
    assert.equal(result.status, 'unsupported-markup'); assert.deepEqual(result.issues, ['html-parse-errors']);
    assert.deepEqual(result.candidates, []);
  }
});

test('one bounded GET only; no key/cookies/body, redirects manual, no destination requests', async () => {
  const calls = [];
  const result = await fetchHtmlCandidates(select(), async (url, init) => { calls.push({ url, init }); return htmlResponse(markup()); });
  assert.equal(result.identity.status, 'matched'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, select().sourceURL);
  assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.body, undefined);
  assert.doesNotMatch(JSON.stringify(calls[0].init.headers), /cookie|authorization|api-key/i);
  assert.ok(!Object.hasOwn(result, 'html'));
  await assert.rejects(() => fetchHtmlCandidates({ ...select(), sourceURL: 'https://example.com' }, () => assert.fail('No arbitrary fetch')));
});

test('redirect, 403/429 and HTTP errors are content-free statuses, with no retries', async t => {
  for (const code of [301, 302, 307, 403, 429, 500]) await t.test(String(code), async () => {
    let calls = 0;
    const result = await fetchHtmlCandidates(select(), async () => { calls++; return new Response('PRIVATE_ERROR_BODY', { status: code, headers: { location: 'https://example.com/no-follow' } }); });
    assert.equal(calls, 1); assert.equal(result.httpStatus, code);
    assert.match(result.status, code < 400 ? /redirect-not-followed/ : /no-retry/);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ERROR_BODY|example.com/);
  });
});

test('header/body size limits, content type, invalid UTF-8 and bounded timeout fail closed', async () => {
  const cases = [
    [() => new Response('x', { headers: { 'content-type': 'text/html', 'content-length': '999' } }), 'response-too-large'],
    [() => htmlResponse('x'.repeat(50)), 'response-too-large'],
    [() => new Response('x', { headers: { 'content-type': 'application/json' } }), 'unsupported-content-type'],
    [() => new Response(new Uint8Array([255]), { headers: { 'content-type': 'text/html' } }), 'network-or-decoding-error-no-retry'],
    [() => new Promise(() => {}), 'timeout-no-retry'],
    [() => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/html' } }), 'timeout-no-retry'],
  ];
  for (const [reply, expected] of cases) {
    let calls = 0;
    const result = await fetchHtmlCandidates(select(), async () => { calls++; return reply(); }, { maxBytes: 32, timeoutMs: 30 });
    assert.equal(result.status, expected); assert.equal(calls, 1);
  }
});

test('server synthetic needs no key/network; live mock one-shot/session/config/auth gate preserved', async t => {
  for (const mode of ['synthetic', 'live']) await t.test(mode, async t => {
    let calls = 0;
    const server = createDemo({ ...options, filmId: 'coherence', mode, fetchImpl: async () => { calls++; assert.equal(mode, 'live'); return htmlResponse(markup()); } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/session`); const session = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(session.sourceURL, select().sourceURL);
    assert.equal(session.model, null); assert.equal(session.prompt, null); assert.match(session.operation, /One GET/);
    const post = headers => fetch(`${origin}/answer`, { method: 'POST', headers: { Origin: origin, 'x-demo-session': session.token, ...headers }, body: '{"sourceURL":"https://example.com/override"}' });
    assert.equal((await post({ Origin: 'http://example.com' })).status, 403); assert.equal(calls, 0);
    const replies = await Promise.all([post(), post()]);
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
    const payload = await replies.find(r => r.status === 200).json();
    assert.equal(payload.result.identity.status, 'matched'); assert.equal(payload.response, undefined);
    assert.equal((await post()).status, 409); assert.equal(calls, mode === 'synthetic' ? 0 : 1);
  });
});

test('HTML LAN auth protects every route and rejects wrong Host/Origin before any source GET', async t => {
  const address = '192.168.88.7'; // Test Host only, listener remains loopback.
  const password = 'offline-html-password';
  const auth = `Basic ${Buffer.from(`demo:${password}`).toString('base64')}`;
  let calls = 0;
  const server = createDemo({ ...options, filmId: 'coherence', mode: 'live', access: 'lan', bindIPv4: address, lanPassword: password,
    interfaces: { test: [{ address, internal: false }] }, fetchImpl: async () => { calls++; return htmlResponse(markup()); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port; const origin = `http://${address}:${port}`;
  const request = (path, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${port}${path}`, { method, headers: { Host: `${address}:${port}`, ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode })));
    }); req.on('error', reject); req.end();
  });
  for (const path of ['/', '/html-display.mjs', '/session', '/answer']) assert.equal((await request(path)).status, 401);
  const page = await (await request('/session', 'GET', { Authorization: auth })).json();
  assert.ok(!JSON.stringify(page).includes(password));
  const headers = { Authorization: auth, Origin: origin, 'x-demo-session': page.token };
  for (const [override, status] of [[{ Authorization: 'Basic d3Jvbmc=' }, 401], [{ Host: 'localhost' }, 403], [{ Origin: 'http://example.com' }, 403]]) assert.equal((await request('/answer', 'POST', { ...headers, ...override })).status, status);
  assert.equal(calls, 0); assert.equal((await request('/answer', 'POST', headers)).status, 200);
  assert.equal((await request('/answer', 'POST', headers)).status, 409); assert.equal(calls, 1);
});

test('adapter/display have no persistence, logging, evaluation or HTML insertion hooks', async () => {
  for (const file of ['../html-source.mjs', '../public/html-display.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /writeFile|appendFile|createWriteStream|localStorage|sessionStorage|indexedDB|sendBeacon|console\.|innerHTML|outerHTML|DOMParser|eval\(/);
  }
});
