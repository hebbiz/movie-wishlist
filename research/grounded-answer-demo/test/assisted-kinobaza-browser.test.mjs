// Authored loopback HTTP + installed mobile viewport. No live source or iPhone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { mockTransport } from './film-workflow.fixture.mjs';
import { CARD, markup } from './assisted-kinobaza.fixture.mjs';

test('assisted mobile card addition: admission, source gate, incremental draft preservation and stale protection', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); t.after(() => browser.close());
  for (const kind of ['normal', 'mismatch', 'redirect', 'stale', 'response-lost']) await t.test(kind, async t => {
    const transport = mockTransport(), kinoCalls = []; let release, ready;
    const held = new Promise(r => { ready = r; });
    const server = createDemo({ mode: 'live', retrieval: 'ua-discovery', discovery: 'digital-ua', tmdbToken: 'author-tmdb-key', motnKey: 'author-motn-key',
      fetchImpl: async (url, init) => {
        if (url !== CARD) return transport.fetchImpl(url, init);
        kinoCalls.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.headers.Authorization, undefined);
        const body = markup(kind === 'mismatch' ? { year: 2011 } : {});
        return kind === 'redirect' ? new Response('', { status: 301, headers: { location: CARD + '-redirect' } }) : new Response(body, { headers: { 'content-type': 'text/html' } });
      } });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), errors = [], external = [];
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    t.after(async () => { release?.(); await context.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); });
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
      if (kind === 'response-lost' && new URL(route.request().url()).pathname === '/dynamic/read-card') { await route.fetch(); return route.abort(); }
      if (kind === 'stale' && new URL(route.request().url()).pathname === '/dynamic/read-card') {
        const response = await route.fetch(); ready(); await new Promise(r => { release = r; }); try { return await route.fulfill({ response }); } catch { return; }
      }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin); await page.locator('#film-query').fill('Authored search'); await page.locator('#film-search-submit').click();
    await page.locator('#film-candidates button').first().click(); await page.locator('#film-identity-confirm').click(); await page.locator('#film-discover').click();
    await page.locator('#assisted-kinobaza').waitFor({ state: 'visible' }); assert.equal(transport.calls.length, 4);
    const motnRow = page.locator('article.discovery-card').last(); await motnRow.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.locator('#draft-tracking-ack').check(); await page.locator('#draft-confirm').click(); await page.locator('#local-draft input[name="title"]').fill('PRIVATE EDIT');
    await page.locator('#kinobaza-card-url').fill(CARD + '?bad'); await page.locator('#kinobaza-admit').click();
    await page.waitForFunction(() => document.querySelector('#kinobaza-status').textContent.includes('Адресу не прийнято'));
    assert.equal(kinoCalls.length, 0); assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE EDIT');
    await page.locator('#kinobaza-card-url').fill(CARD); await page.locator('#kinobaza-admit').click();
    await page.locator('#kinobaza-read').waitFor({ state: 'visible' }); assert.match(await page.locator('#kinobaza-status').innerText(), /Прийнята адреса: https:\/\/kinobazaua\.com/);
    assert.equal(kinoCalls.length, 0); assert.equal(transport.calls.length, 4);
    await page.locator('#kinobaza-read').click();
    if (kind === 'stale') {
      await held; await page.locator('#film-query').fill('New identity input'); release(); await page.waitForTimeout(100);
      assert.equal(await page.locator('#result').isHidden(), true); assert.equal(await page.locator('#assisted-kinobaza').isHidden(), true);
      assert.equal(await page.locator('#local-draft').isHidden(), true); assert.equal(await page.locator('#report-copy').isDisabled(), true);
    } else if (kind === 'response-lost') {
      await page.waitForFunction(() => document.querySelector('#film-counters').textContent.includes('unknown'));
      await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
      const report = await page.locator('#report-text').inputValue(); assert.match(report, /Kinobaza: assisted outcome\/accounting unknown; HTTP unknown\/1/);
      assert.doesNotMatch(report, /not evaluated|HTTP 0\/1|PRIVATE EDIT|https?:/);
      assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE EDIT'); assert.equal(kinoCalls.length, 1);
    } else {
      await page.waitForFunction(() => document.querySelector('#kinobaza-status').textContent.includes('Повтору немає'));
      assert.match(await page.locator('#film-counters').innerText(), /разом 5\/7/); assert.equal(kinoCalls.length, 1); assert.equal(transport.calls.length, 4);
      assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE EDIT');
      const status = await page.locator('#kinobaza-status').innerText(); assert.match(status, kind === 'normal' ? /identity matched/ : kind === 'mismatch' ? /identity mismatch/ : /redirect-not-followed/);
      if (kind === 'normal') {
        assert.ok(await page.locator('.viewing-localization').count() > 0);
        const row = page.locator('article.discovery-card').last(); await row.getByRole('button', { name: 'Обрати', exact: true }).click();
        await page.locator('#draft-review-cancel').click(); assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE EDIT');
      }
      await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
      const report = await page.locator('#report-text').inputValue(); assert.match(report, /Assisted HTTP: Kinobaza 1\/1/); assert.doesNotMatch(report, /https?:|PRIVATE EDIT|author-tmdb|author-motn|AUTHOR%|actionToken|sourceURL|authored-card/);
      assert.equal(kinoCalls.length, 1); await page.locator('#film-new-case').click();
      await page.waitForFunction(() => document.querySelector('#film-counters').textContent.includes('разом 0/6'));
      assert.equal(await page.locator('#assisted-kinobaza').isHidden(), true); assert.equal(await page.locator('#report-copy').isDisabled(), true);
    }
    await page.setViewportSize({ width: 320, height: 800 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  });
});
