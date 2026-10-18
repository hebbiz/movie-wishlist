import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticTmdb } from '../tmdb.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('TMDb separate metadata / UA blocks on mobile viewport (mocks, not real iPhone)', { skip: !modulePath }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const cases = [
    ...['coherence', 'dune-part-two'].flatMap(filmId => ['synthetic', 'live'].map(mode => ({ filmId, mode, kind: 'normal' }))),
    ...['missing-token', 'auth-error', 'quota-B', 'identity', 'missing-crosswalk', 'missing-UA', 'empty-UA', 'partial-A', 'invalid-resource', 'empty-resource', 'supplied-id-conflict', 'fallback-title', 'hostile'].map(kind => ({ filmId: 'coherence', mode: 'live', kind })),
  ];
  for (const { filmId, mode, kind } of cases) await t.test(`${filmId}/${mode}/${kind}`, async t => {
    const calls = [], key = 'offline-tmdb-browser-token';
    const server = createDemo({ filmId, mode, retrieval: 'tmdb-data', discovery: 'digital-ua', tmdbToken: kind === 'missing-token' ? '' : key,
      fetchImpl: async (url, init) => {
        calls.push(url); assert.equal(init.headers.Authorization, `Bearer ${key}`);
        if (kind === 'auth-error' || kind === 'quota-B' && calls.length === 2) return new Response('PRIVATE_CONTENT', { status: kind === 'auth-error' ? 401 : 429 });
        const d = syntheticTmdb(filmId);
        if (kind === 'identity') d.details.external_ids.imdb_id = 'tt0000001';
        if (kind === 'missing-crosswalk') { delete d.details.imdb_id; delete d.details.external_ids.imdb_id; }
        if (kind === 'missing-UA') delete d.providers.results.UA;
        if (kind === 'empty-UA') d.providers.results.UA = {};
        if (kind === 'partial-A') delete d.details.translations;
        if (kind === 'invalid-resource') d.details.translations = [];
        if (kind === 'empty-resource') d.details.translations = {};
        if (kind === 'supplied-id-conflict') d.details.translations.id = 1;
        if (kind === 'fallback-title') d.details.translations.translations[0].data.title = '';
        if (kind === 'hostile') { d.details.title = '<img src="https://example.com/evil" onerror="alert(1)">'; d.providers.results.UA.link = 'javascript:alert(1)'; }
        return Response.json(url.endsWith('/watch/providers') ? d.providers : d.details);
      } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); t.after(() => page.close());
    const external = [], logs = [], errors = []; let posts = 0;
    page.on('request', r => { if (!r.url().startsWith(origin)) external.push(r.url()); if (r.method() === 'POST') posts++; });
    page.on('console', m => logs.push(m.text())); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls.length, 0); assert.match(await page.locator('#retrieval-mode').textContent(), /tmdb-data/);
    const session = await page.evaluate(async () => (await fetch('/session')).json());
    const urls = await page.locator('#source-url').textContent(); assert.ok(urls.includes(session.sourceURL) && urls.includes(session.providersURL));
    assert.match(await page.locator('#settings').textContent(), /Country: UA.*Locale: uk-UA.*max 2 requests.*no model/);
    assert.match(await page.locator('#service-notice').textContent(), /LIVE READINESS CONDITIONAL/);
    assert.match(await page.locator('#tmdb-credits').textContent(), /not endorsed or certified by TMDB/);
    assert.match(await page.locator('#tmdb-credits').textContent(), /JustWatch/);
    assert.equal(await page.locator('#tmdb-credits img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    assert.equal(await page.locator('input,textarea,select').count(), 0); assert.ok(!(await page.content()).includes(key));
    await page.locator('#run').evaluate(button => { button.click(); button.click(); }); await page.locator('#result').waitFor({ state: 'visible' });
    assert.equal(posts, 1);
    const expectedCalls = mode === 'synthetic' || kind === 'missing-token' ? 0 : ['identity', 'supplied-id-conflict', 'auth-error'].includes(kind) ? 1 : 2;
    assert.equal(calls.length, expectedCalls); if (calls.length) assert.equal(calls[0], session.sourceURL); if (calls.length === 2) assert.equal(calls[1], session.providersURL);
    const shown = await page.locator('#answer').textContent();
    assert.match(shown, /A — Identity.*B — Watch Providers/s); assert.match(shown, /not offer tracks/);
    assert.doesNotMatch(shown, /PRIVATE_CONTENT|offline-tmdb-browser|foreign must not display|javascript:alert|SYNTHETIC prose/);
    if (['identity', 'supplied-id-conflict'].includes(kind)) assert.match(shown, /identity-mismatch.*B not requested/s);
    if (kind === 'missing-token') assert.match(shown, /missing-token-no-request.*B not requested/s);
    if (kind === 'quota-B') assert.match(shown, /quota-or-rate-limit/);
    if (kind === 'auth-error') assert.match(shown, /api-auth-error/);
    if (kind === 'missing-crosswalk') assert.match(shown, /IMDb crosswalk: unknown/);
    if (kind === 'partial-A') assert.match(shown, /translations: missing; no fallback request/);
    if (kind === 'invalid-resource') assert.match(shown, /Appended resource translations: invalid.*Translations — explicit catalogue text, not dubbing: invalid/s);
    if (kind === 'empty-resource') assert.match(shown, /Appended resource translations: reported.*Translations — explicit catalogue text, not dubbing: missing/s);
    if (kind === 'normal') assert.match(shown, /Appended resource translations: reported.*Ukrainian catalogue title evidence: explicit-uk-title-reported/s);
    if (kind === 'fallback-title') assert.match(shown, /Ukrainian catalogue title evidence: not-established/);
    if (kind === 'missing-UA') assert.match(shown, /UA field: missing/);
    if (kind === 'empty-UA') assert.match(shown, /UA field: reported-empty/);
    if (kind === 'hostile') assert.match(shown, /<img src=/);
    if (mode === 'synthetic') assert.match(shown, /SYNTHETIC ONLY/);
    assert.equal(await page.locator('#answer img,#answer script,#answer iframe,#answer a').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(!logs.some(s => /offline-tmdb|PRIVATE_CONTENT|SYNTHETIC service/.test(s)));
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
    for (const selector of ['#source-url', '#prompt', '#run', '#answer', '#tmdb-credits']) { await page.locator(selector).scrollIntoViewIfNeeded(); assert.equal(await page.locator(selector).isVisible(), true); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#run').isDisabled(), true);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled); assert.equal(await page.locator('#answer').textContent(), ''); assert.equal(posts, 1); assert.equal(calls.length, expectedCalls);
  });
  await t.test('TMDb WebKit viewport', { skip: !existsSync(webkit.executablePath()) && 'WebKit binary absent; no download.' }, async t => {
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close());
    const server = createDemo({ retrieval: 'tmdb-data', discovery: 'digital-ua', fetchImpl: () => assert.fail('No network') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const page = await engine.newPage({ viewport: { width: 390, height: 844 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled); await page.locator('#run').click(); await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#answer').textContent(), /SYNTHETIC ONLY/);
  });
});
