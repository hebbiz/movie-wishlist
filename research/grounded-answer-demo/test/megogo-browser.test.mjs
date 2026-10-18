import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { MEGOGO_URL } from '../megogo.mjs';
import { syntheticMegogo } from '../megogo-synthetic.mjs';

test('MEGOGO mobile browser (mock only, not real iPhone)', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); t.after(() => browser.close());
  const run = async (engine, mode, kind, t) => {
    let calls = 0;
    const server = createDemo({ mode, retrieval: 'megogo-html', discovery: 'digital-ua', fetchImpl: async (url, init) => {
      calls++; assert.equal(url, MEGOGO_URL); assert.equal(init.redirect, 'manual');
      if (kind === 'blocked') return new Response('DO_NOT_SHOW_BODY', { status: 403 });
      if (kind === 'redirect') return new Response(null, { status: 302, headers: { location: 'https://example.com/no' } });
      let html = syntheticMegogo({ body: '<dl><dt>Package</dt><dd>&lt;img src=x onerror=alert(1)&gt;</dd></dl>' });
      if (kind === 'mismatch') html = html.replaceAll('22027436', '999');
      if (kind === 'geo') html = html.replace('</main>', '<p>Not available in your country</p></main>');
      if (kind === 'unknown') html = '<!doctype html><main>Unknown markup</main>';
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    } });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await engine.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); t.after(() => page.close());
    const external = [], logs = []; let posts = 0;
    page.on('request', req => { if (!req.url().startsWith(origin)) external.push(req.url()); if (req.method() === 'POST') posts++; });
    page.on('console', m => logs.push(m.text()));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls, 0); assert.match(await page.locator('#source-url').textContent(), /22027436-dyuna/);
    assert.match(await page.locator('#retrieval-mode').textContent(), /megogo-html/);
    assert.match(await page.locator('#settings').textContent(), /fetcher geography: unknown/);
    assert.match(await page.locator('#prompt').textContent(), /One GET/);
    await page.locator('#run').evaluate(b => { b.click(); b.click(); });
    await page.locator('#result').waitFor({ state: 'visible' });
    assert.equal(posts, 1); assert.equal(calls, mode === 'live' ? 1 : 0); assert.equal(await page.locator('#run').isDisabled(), true);
    const text = await page.locator('#answer').textContent();
    assert.match(text, /entitlement/); assert.match(text, /unknown/);
    if (mode === 'synthetic') assert.match(text, /SYNTHETIC/);
    if (kind === 'normal' || kind === 'geo') { assert.match(text, /SYNTHETIC Example Package/); if (mode === 'live') assert.match(text, /<img src=x/); }
    if (kind === 'geo') assert.match(text, /geo-restricted/);
    if (kind === 'blocked') assert.match(text, /access-blocked/);
    if (kind === 'mismatch') assert.match(text, /identity-mismatch/);
    if (kind === 'unknown') assert.match(text, /unsupported-markup/);
    if (kind === 'redirect') assert.match(text, /redirect-not-followed/);
    assert.equal(await page.locator('#answer a,#answer img,#answer script,#answer iframe').count(), 0);
    assert.equal(await page.locator('#retrieval-result').textContent(), ''); assert.equal(await page.locator('#suggestions').textContent(), '');
    assert.deepEqual(external, []); assert.ok(!logs.some(s => /Example Package|DO_NOT_SHOW_BODY/.test(s)));
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
    for (const selector of ['#source-url', '#prompt', '#run', '#answer']) { await page.locator(selector).scrollIntoViewIfNeeded(); assert.equal(await page.locator(selector).isVisible(), true); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled); assert.equal(await page.locator('#answer').textContent(), '');
    assert.equal(calls, mode === 'live' ? 1 : 0);
  };
  for (const [mode, kind] of [['synthetic', 'normal'], ...['normal', 'geo', 'blocked', 'redirect', 'mismatch', 'unknown'].map(k => ['live', k])]) await t.test(`${mode}/${kind}`, t => run(browser, mode, kind, t));
  await t.test('WebKit', { skip: !existsSync(webkit.executablePath()) && 'WebKit binary absent; no download.' }, async t => {
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close()); await run(engine, 'synthetic', 'normal', t);
  });
});
