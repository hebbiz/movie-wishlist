// Installed mobile viewport + authored source mocks, never real iPhone/live coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { mockTransport, IDS } from './film-workflow.fixture.mjs';

test('M3.1 mobile search/preview/confirm/discovery: authored identities, counters, draft/report and no extra requests', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); t.after(() => browser.close());
  for (const kind of ['normal', 'missing-crosswalk', 'partial-source', 'identity-conflict', 'second-search-preview', 'late-discovery', 'clipboard-unavailable', 'local-response-lost'].filter(k => !process.env.M31_BROWSER_CASE || k === process.env.M31_BROWSER_CASE)) await t.test(kind, async t => {
    const transport = mockTransport({ mutate(d, p) {
      if (kind === 'missing-crosswalk' && p === 'preview') { delete d.imdb_id; delete d.external_ids; }
      if (kind === 'identity-conflict' && p === 'preview') d.external_ids.imdb_id = `tt${IDS[1]}`;
    }, response(p, d) { return kind === 'partial-source' && p === 'providers' ? new Response('PRIVATE', { status: 503 }) : Response.json(d); } });
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', mode: 'live', tmdbToken: 'author-tmdb-key', motnKey: 'author-motn-key', fetchImpl: transport.fetchImpl });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`, external = [], errors = [], localCalls = [];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(unavailable => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: unavailable ? undefined : { writeText: () => Promise.reject(Error('AUTHOR denied')) } }), kind === 'clipboard-unavailable');
    let releaseLate, lateReady;
    t.after(async () => { releaseLate?.(); await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const held = new Promise(resolve => { lateReady = resolve; });
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith('/dynamic/')) localCalls.push(path);
      if (kind === 'local-response-lost' && path === '/dynamic/search') { await route.fetch(); return route.abort(); }
      if (kind === 'late-discovery' && path === '/dynamic/discover') {
        const response = await route.fetch(); lateReady(); await new Promise(resolve => { releaseLate = resolve; });
        try { return await route.fulfill({ response }); } catch { return; }
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(8000);
    await page.goto(origin); await page.locator('#film-search').waitFor(); assert.equal(await page.locator('#discovery-film option').count(), 6);
    await page.locator('#film-query').fill('Authored user search'); await page.waitForTimeout(30); assert.equal(transport.calls.length, 0);
    await page.locator('#film-search-submit').click();
    if (kind === 'local-response-lost') {
      await page.waitForFunction(() => document.querySelector('#film-counters').textContent.includes('unknown'));
      await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
      assert.match(await page.locator('#report-text').inputValue(), /search unknown\/2/);
      assert.equal(transport.calls.length, 1); assert.equal(await page.locator('#film-search-submit').isDisabled(), true);
      assert.deepEqual(external, []); assert.deepEqual(errors, []); return;
    }
    await page.locator('#film-candidates button').first().waitFor();
    assert.equal(await page.locator('#film-candidates button').count(), 2); assert.equal(await page.locator('#film-identity-confirm').count(), 0); assert.equal(transport.calls.length, 1);
    await page.locator('#film-candidates button').first().click(); await page.locator('#film-preview').waitFor({ state: 'attached' });
    if (kind === 'identity-conflict') {
      await page.waitForFunction(() => document.querySelector('#film-search-status').textContent.includes('identity-unresolved'), null, { timeout: 5000 }).catch(async () => assert.fail(`Authored conflict UI status: ${await page.locator('#film-search-status').innerText()}`));
      assert.equal(await page.locator('#film-identity-confirm').count(), 0); assert.equal(transport.calls.length, 2);
      await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
      assert.match(await page.locator('#report-text').inputValue(), /Selected identity: not confirmed/);
    } else {
      await page.locator('#film-identity-confirm').waitFor(); assert.equal(transport.calls.length, 2); assert.equal(await page.locator('#film-discover').count(), 0);
      if (kind === 'second-search-preview') {
        await page.locator('#film-query').fill('Explicit alternate query'); await page.locator('#film-search-submit').click();
        await page.waitForFunction(() => document.querySelector('#film-counters').textContent.includes('search 2/2'));
        await page.locator('#film-candidates button').nth(1).click(); await page.locator('#film-identity-confirm').waitFor();
        assert.match(await page.locator('#film-preview').innerText(), /2009/);
      }
      await page.locator('#film-identity-confirm').click(); await page.locator('#film-discover').waitFor();
      const beforeDiscovery = transport.calls.length; assert.equal(beforeDiscovery, kind === 'second-search-preview' ? 4 : 2);
      await page.locator('#film-discover').click();
      if (kind === 'late-discovery') {
        await held; await page.locator('#film-query').fill('New pending title');
        assert.equal(await page.locator('#result').isHidden(), true); releaseLate(); await page.waitForTimeout(80);
        assert.equal(await page.locator('#result').isHidden(), true); assert.equal(await page.locator('#report-copy').isDisabled(), true);
      } else {
        await page.waitForFunction(() => !document.querySelector('#report-copy').disabled);
        const expectedCalls = kind === 'missing-crosswalk' ? 3 : kind === 'second-search-preview' ? 6 : 4;
        assert.equal(transport.calls.length, expectedCalls); assert.match(await page.locator('#film-counters').innerText(), new RegExp(`разом ${expectedCalls}/6`));
        const row = page.locator('article.discovery-card').last(); await row.getByRole('button', { name: 'Обрати', exact: true }).click();
        let fields = JSON.parse(await page.locator('#draft-included').innerText());
        if (kind !== 'missing-crosswalk') { assert.equal(fields.purchase_url, ''); await page.locator('#draft-tracking-ack').check(); fields = JSON.parse(await page.locator('#draft-included').innerText()); assert.match(fields.purchase_url, /at=&at=REFERRAL%2fONLY$/); }
        else assert.equal(fields.imdb_url, '');
        await page.locator('#draft-confirm').click(); await page.locator('#local-draft input[name="title"]').fill('PRIVATE DRAFT');
        await row.getByRole('button', { name: 'Обрати', exact: true }).click(); await page.locator('#draft-review-cancel').click();
        assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE DRAFT');
        await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
        const report = await page.locator('#report-text').inputValue(); assert.match(report, /M3\.1/); assert.match(report, /search \d\/2; preview \d\/2; discovery \d\/2/);
        assert.match(report, /dynamic M3\.1 scope/); assert.doesNotMatch(report, /PRIVATE DRAFT|Authored user search|author-tmdb|author-motn|REFERRAL|https?:|actionToken/);
        assert.equal(transport.calls.length, expectedCalls);
        await page.locator('#film-query').fill('Another pending movie');
        assert.equal(await page.locator('#local-draft').isHidden(), true); assert.equal(await page.locator('#report-fallback').isHidden(), true); assert.equal(await page.locator('#report-copy').isDisabled(), true);
      }
    }
    await page.locator('#film-new-case').click(); await page.waitForFunction(() => document.querySelector('#film-counters').textContent.includes('разом 0/6'));
    assert.equal(await page.locator('#film-preview').innerText(), '');
    // The same server handles another film without restart; old rows/report/draft stay gone.
    await page.locator('#film-query').fill('Second case'); await page.locator('#film-search-submit').click(); await page.locator('#film-candidates button').first().waitFor();
    await page.locator('#discovery-film').selectOption('dune-part-two');
    await page.waitForFunction(() => document.querySelector('#discovery-chosen').textContent.includes('Dune: Part Two'));
    assert.equal(await page.locator('#film-candidates').innerText(), ''); assert.equal(await page.locator('#report-copy').isDisabled(), true);
    await page.setViewportSize({ width: 320, height: 800 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    assert.ok(localCalls.every(p => /^\/dynamic\/(search|preview|confirm|discover|invalidate|new-case)$/.test(p)));
  });
  await t.test('WebKit viewport', { skip: !existsSync(webkit.executablePath()) ? 'WebKit absent; no download, not real iPhone' : false }, async () => {
    const browser = await webkit.launch(); await browser.close();
  });
});
