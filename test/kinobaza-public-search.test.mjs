// Authored markup only; no copied source HTML or live requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kinobazaSearchURL, isKinobazaSearchURL, kinobazaPublicSearch } from '../netlify/lib/kinobaza-public-search.mjs';
import { safeSearchDiagnostic } from '../shared/media-advice-diagnostics.mjs';

const origin = 'https://kinobazaua.com';
const page = inside => `<!doctype html><html><body><a href="/titles/outside-authored">Outside</a><div id="nav-persons"><a href="/persons/authored-person">Person</a></div><div id="nav-titles">${inside}</div></body></html>`;
const response = (html, options = {}) => new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' }, ...options });
const link = (href, label = 'PRIVATE_LABEL') => `<a href="${href}">${label}</a>`;

test('public search URL has one fixed endpoint and canonical encoding of a bounded title', () => {
  const title = 'Authored title / "Тест"? & #';
  assert.equal(kinobazaSearchURL(title), `${origin}/search?q=${encodeURIComponent(title)}`);
  assert.equal(kinobazaSearchURL('  Authored  '), `${origin}/search?q=Authored`);
  assert.equal(isKinobazaSearchURL(kinobazaSearchURL(title)), true);
  assert.equal(isKinobazaSearchURL(kinobazaSearchURL('x'.repeat(500))), true);
  for (const value of [null, '', ' ', 'bad\nname', 'bad\u0000name', 'bad\u200dname', 'x'.repeat(501)]) assert.equal(kinobazaSearchURL(value), null);
  for (const url of [null, `${origin}/`, `${origin}/search`, `${origin}/search?q=`, `${origin}/search?q=A+B`, `${origin}/search?q=A&x=1`, `${origin}/search?q=A#x`,
    `${origin}/search?q=%ff`, `${origin}/search?q=%41`, `${origin}/search?q=%20A`, `${origin}/search?q=${'x'.repeat(501)}`,
    'http://kinobazaua.com/search?q=A', 'https://www.kinobazaua.com/search?q=A', 'https://kinobazaua.com:443/search?q=A', 'https://u@kinobazaua.com/search?q=A',
    'https://kinobazaua.com.evil.invalid/search?q=A', `${origin}/titles/a`, `${origin}/search/?q=A`, `${origin}/search?x=1&q=A`]) assert.equal(isKinobazaSearchURL(url), false, String(url));
});

test('public search accepts only its fixed GET without credentials, redirects, body or arbitrary headers', async () => {
  let calls = 0;
  const provider = kinobazaPublicSearch(async (url, init) => {
    calls++; assert.equal(url, kinobazaSearchURL('Authored title'));
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    assert.deepEqual(Object.keys(init.headers).sort(), ['Accept', 'User-Agent']);
    assert.equal(provider.accepts(url, init), true); return response(page(''));
  });
  const valid = { method: 'GET', redirect: 'manual', credentials: 'omit' };
  assert.equal(provider.accepts(kinobazaSearchURL('Authored title'), valid), true);
  for (const change of [{ method: 'POST' }, { redirect: 'follow' }, { credentials: 'include' }, { body: 'private' },
    { headers: { Authorization: 'PRIVATE' } }, { headers: { Cookie: 'PRIVATE' } }, { headers: { 'X-Other': 'PRIVATE' } }]) assert.equal(provider.accepts(kinobazaSearchURL('Authored title'), { ...valid, ...change }), false);
  assert.equal(provider.accepts(`${origin}/titles/authored`, valid), false);
  assert.equal((await provider.search('Authored title')).status, 'ok'); assert.equal(calls, 1);
});

test('one observed titles container yields exact relative pointers, deduplicates and counts rejected forms', async () => {
  let observed, calls = 0;
  const html = page([
    link('/titles/authored-one'), link('/titles/authored-one'), link('/titles/authored-two-2001'),
    link('/titles/authored-one/videos'), link('/titles/authored-one?x=1'), link('/titles/authored-one#x'), link('/persons/authored'),
    link('https://evil.invalid/titles/authored'), link(`${origin}/titles/absolute-authored`), '<a>Missing href</a>',
    '<template><a href="/titles/inert-authored">Hidden</a></template>',
  ].join(''));
  const result = await kinobazaPublicSearch(async () => { calls++; return response(html); }, {
    onCandidateURLs: urls => { observed = [...urls]; urls.length = 0; throw Error('PRIVATE_HOOK'); },
  }).search('Authored title');
  assert.equal(calls, 1); assert.equal(result.status, 'ok');
  assert.deepEqual(result.urls, [`${origin}/titles/authored-one`, `${origin}/titles/authored-two-2001`]);
  assert.deepEqual(observed, result.urls);
  assert.deepEqual(result.diagnostics, { returned: 10, admitted: 2, rejected: 7, duplicates: 1,
    rejectionCategories: { 'non-string': 1, 'unsupported-spelling': 1, 'foreign-host': 1, 'unsupported-path': 2, fragment: 1, query: 1 } });
  const safe = safeSearchDiagnostic(result.status, result.diagnostics);
  assert.equal(safe.outcome, 'candidates-admitted'); assert.equal(safe.returned, 10);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|outside-authored|inert-authored|authored-person|evil/);
});

test('missing, duplicate, wrong-kind or excessive title scope is unresolved; an empty unique container succeeds', async () => {
  for (const html of ['<div id="other"></div>', '<div id="nav-titles"></div><div id="nav-titles"></div>', '<section id="nav-titles"></section>',
    '<div id="nav-titles"></div><span id="nav-titles"></span>', page(link('/titles/authored').repeat(501)), page('<i></i>'.repeat(100_001)), page('<div>'.repeat(260) + '</div>'.repeat(260))]) {
    let hooks = 0;
    const result = await kinobazaPublicSearch(async () => response(html), { onCandidateURLs: () => hooks++ }).search('Authored');
    assert.deepEqual(result, { status: 'search-invalid-response', urls: [] }); assert.equal(hooks, 0);
  }
  const empty = await kinobazaPublicSearch(async () => response(page('No authored matches'))).search('Authored');
  assert.deepEqual(empty, { status: 'ok', urls: [], diagnostics: { returned: 0, admitted: 0, rejected: 0, duplicates: 0, rejectionCategories: {} } });
  assert.equal(safeSearchDiagnostic(empty.status, empty.diagnostics).outcome, 'empty-response');
});

test('responsive duplicates and auxiliary links do not exhaust the structural scan before card admission',async()=>{
  // Authored shape motivated by observed counts, not copied search HTML.
  const pointers=Array.from({length:10},(_,i)=>link(`/titles/authored-${i}`).repeat(4)).join('');
  const auxiliary=Array.from({length:133},()=>link('/genres/authored')).join('');
  const out=await kinobazaPublicSearch(async()=>response(page(pointers+auxiliary))).search('Authored');
  assert.equal(out.status,'ok');assert.equal(out.urls.length,10);
  assert.deepEqual(out.diagnostics,{returned:173,admitted:10,rejected:133,duplicates:30,rejectionCategories:{'unsupported-path':133}});
});

test('redirects, access challenges and HTTP errors consume one request without following or retrying', async () => {
  for (const [reply, expected] of [
    [() => response('', { status: 302, headers: { location: `${origin}/titles/never-follow` } }), 'search-redirect-refused'],
    [() => response('PRIVATE_ERROR', { status: 401 }), 'search-auth-error'],
    [() => response('PRIVATE_ERROR', { status: 403 }), 'search-access-denied'],
    [() => response('PRIVATE_ERROR', { status: 429 }), 'search-rate-limit'],
    [() => response('PRIVATE_ERROR', { status: 500 }), 'search-http-error'],
    [() => response(page('captcha challenge PRIVATE_ERROR')), 'search-access-denied'],
    [() => response(page('cf-chl- PRIVATE_ERROR')), 'search-access-denied'],
  ]) {
    let calls = 0;
    const result = await kinobazaPublicSearch(async () => { calls++; return reply(); }).search('Authored');
    assert.deepEqual(result, { status: expected, urls: [] }); assert.equal(calls, 1);
  }
});

test('HTML type, UTF-8 decoding and declared/streamed byte bounds fail closed', async () => {
  for (const [reply, status] of [
    [() => response(page(''), { headers: { 'content-type': 'application/json' } }), 'search-invalid-response'],
    [() => response(page(''), { headers: { 'content-type': 'text/html; charset=windows-1251' } }), 'search-invalid-response'],
    [() => new Response(new Uint8Array([255]), { headers: { 'content-type': 'text/html' } }), 'search-transport-or-json-error'],
    [() => response(page(''), { headers: { 'content-type': 'text/html', 'content-length': String(2 * 1024 * 1024 + 1) } }), 'search-response-too-large'],
    [() => response('x'.repeat(2 * 1024 * 1024 + 1)), 'search-response-too-large'],
  ]) assert.deepEqual(await kinobazaPublicSearch(async () => reply()).search('Authored'), { status, urls: [] });
});

test('secret echoes are withheld before callbacks or output, including decoded href attributes', async () => {
  const secret = 'AUTHORED_PRIVATE_KEY';
  for (const html of [page(secret), page(link('/titles/authored', secret)), page(link(`/titles/${secret.replaceAll('_', '&#95;')}`))]) {
    let hooks = 0;
    const result = await kinobazaPublicSearch(async () => response(html), { secrets: [secret], onCandidateURLs: () => hooks++ }).search('Authored');
    assert.deepEqual(result, { status: 'unsafe-source-content-withheld', urls: [] }); assert.equal(hooks, 0);
  }
  let calls = 0;
  const result = await kinobazaPublicSearch(async () => { calls++; throw Error('no request'); }, { secrets: [secret] }).search(secret);
  assert.deepEqual(result, { status: 'unsafe-source-content-withheld', urls: [] }); assert.equal(calls, 0);
});

test('invalid or pre-cancelled titles make zero requests; cancellation also bounds response streaming', async () => {
  let calls = 0;
  const provider = kinobazaPublicSearch(async () => { calls++; throw Error('PRIVATE_ERROR'); });
  assert.equal((await provider.search('')).status, 'search-invalid-response');
  assert.equal((await provider.search('Authored', { signal: AbortSignal.abort() })).status, 'search-timeout-no-retry');
  assert.equal(calls, 0);
  assert.deepEqual(await provider.search('Authored'), { status: 'search-transport-or-json-error', urls: [] }); assert.equal(calls, 1);
  const controller = new AbortController(); let cancelled = false;
  const streaming = kinobazaPublicSearch(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/html' } }));
  const pending = streaming.search('Authored', { signal: controller.signal });
  setImmediate(() => controller.abort());
  assert.deepEqual(await pending, { status: 'search-timeout-no-retry', urls: [] });
  assert.equal(cancelled, true);
});

test('the same 15-second timer bounds a request that never resolves', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = kinobazaPublicSearch(async () => new Promise(() => {})).search('Authored');
  t.mock.timers.tick(15_000);
  assert.deepEqual(await pending, { status: 'search-timeout-no-retry', urls: [] });
});
