import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { FILMS } from '../config.mjs';
import { syntheticHtml } from '../synthetic.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('HTML display / narrow viewport (offline, not real iPhone)', { skip: !modulePath }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const cases = [
    ...['coherence', 'dune-part-two'].flatMap(filmId => ['synthetic', 'live'].map(mode => ({ filmId, mode, kind: 'normal' }))),
    ...['redirect', 'blocked', 'rate-limit', 'oversized', 'identity', 'markup'].map(kind => ({ filmId: 'coherence', mode: 'live', kind })),
  ];
  for (const { filmId, mode, kind } of cases) await t.test(`${filmId}/${mode}/${kind}`, async t => {
    let calls = 0;
    const server = createDemo({ filmId, mode, discovery: 'digital-ua', retrieval: 'kinobaza-html', urlSource: 'kinobaza',
      fetchImpl: async (url, init) => {
        calls++; assert.equal(url, `https://kinobaza.com.ua/titles/${filmId}`);
        assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
        if (kind === 'redirect') return new Response(null, { status: 302, headers: { location: 'https://example.com/never-follow' } });
        if (kind === 'blocked' || kind === 'rate-limit') return new Response('PRIVATE_NOT_LOGGED', { status: kind === 'blocked' ? 403 : 429 });
        if (kind === 'oversized') return new Response('x', { headers: { 'content-type': 'text/html', 'content-length': '9999999' } });
        let html = syntheticHtml(FILMS[filmId]);
        if (kind === 'identity') html = html.replace(FILMS[filmId].director, 'Not The Director');
        if (kind === 'markup') html = html.replace('id="availabilityAccordion"', 'id="changed"');
        return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
      },
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); t.after(() => page.close());
    const external = []; const logs = []; let posts = 0;
    page.on('request', req => { if (!req.url().startsWith(origin)) external.push(req.url()); if (req.method() === 'POST') posts++; });
    page.on('console', message => logs.push(message.text()));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls, 0); assert.equal(posts, 0);
    assert.match(await page.locator('#retrieval-mode').textContent(), /kinobaza-html/);
    assert.ok((await page.locator('#source-url').textContent()).includes(`https://kinobaza.com.ua/titles/${filmId}`));
    assert.match(await page.locator('#settings').textContent(), /no model/);
    assert.equal(await page.locator('input,textarea,select').count(), 0);
    await page.locator('#run').evaluate(button => { button.click(); button.click(); });
    await page.locator('#result').waitFor({ state: 'visible' });
    assert.equal(posts, 1); assert.equal(calls, mode === 'live' ? 1 : 0);
    assert.equal(await page.locator('#run').isDisabled(), true);
    const shown = await page.locator('#answer').textContent();
    assert.match(shown, /not availability/);
    if (kind === 'normal') {
      assert.match(shown, /Example UA/); assert.match(shown, /Example Foreign/); assert.match(shown, /Territory unknown/);
      assert.match(shown, /%2F&y=1/); assert.match(shown, /%2F&amp;y=1/);
      if (mode === 'synthetic') assert.match(shown, /SYNTHETIC ONLY/);
    } else assert.match(shown, /redirect-not-followed|access-blocked-no-retry|response-too-large|identity-unresolved|unsupported-markup/);
    assert.equal(await page.locator('#answer a,#answer img,#answer script,#answer iframe').count(), 0);
    assert.equal(await page.locator('#retrieval-result').textContent(), '');
    assert.equal(await page.locator('#suggestions').textContent(), '');
    assert.deepEqual(external, []); assert.ok(!logs.some(s => /Example UA|PRIVATE_NOT_LOGGED/.test(s)));
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
    for (const selector of ['#source-url', '#prompt', '#run', '#answer']) { await page.locator(selector).scrollIntoViewIfNeeded(); assert.equal(await page.locator(selector).isVisible(), true); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#answer').textContent(), ''); assert.equal(calls, mode === 'live' ? 1 : 0);
  });
  await t.test('HTML WebKit viewport', { skip: !existsSync(webkit.executablePath()) && 'WebKit binary absent; no download.' }, async t => {
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close());
    const server = createDemo({ retrieval: 'kinobaza-html', discovery: 'digital-ua', fetchImpl: () => assert.fail('No network') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await engine.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    await page.locator('#run').click(); await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#answer').textContent(), /SYNTHETIC ONLY/);
  });
});
