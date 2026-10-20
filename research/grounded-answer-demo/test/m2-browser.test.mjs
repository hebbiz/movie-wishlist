import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { FILMS } from '../config.mjs';
import { authoredDiscoveryData } from '../discovery.mjs';
import { localizedMarkup, tableBlock } from './kinobaza-localization.fixture.mjs';

test('M2 direct A/B + copy report mobile browser (authored mocks only)', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); t.after(() => browser.close());
  for (const kind of ['copied', 'denied', 'unavailable', 'partial', 'request-error', 'stale-copy', 'region-identity']) await t.test(kind, async t => {
    const calls = [], external = [], errors = []; let posts = 0;
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence', mode: 'live',
      tmdbToken: 'offline-m2-token', motnKey: 'offline-m2-key', fetchImpl: async (url, init) => {
        calls.push(url); assert.equal(init.method, 'GET');
        const film = /220289|tt2866360|\/coherence$/.test(url) ? FILMS.coherence : FILMS['dune-part-two'];
        const data = authoredDiscoveryData(film), href = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored000?at=&at=TEST%2fCODE';
        data.motn.streamingOptions.ua[0].link = kind === 'region-identity' ? href.replace('/ua/', '/gb/') : href;
        data.html = localizedMarkup(tableBlock('itunes', [['Укр. звук', '+'], ['Укр. субтитри', '-']], href.replaceAll('&', '&amp;')), film.id);
        if (kind === 'region-identity') data.tmdb.details.imdb_id = 'tt99999999';
        if (url.includes('themoviedb')) {
          if (kind === 'partial') return new Response('SECRET_SOURCE_BODY', { status: 500 });
          return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
        }
        if (url.includes('movieofthenight')) return Response.json(data.motn);
        assert.ok(url.includes('kinobaza')); return new Response(data.html, { headers: { 'content-type': 'text/html' } });
      } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close());
    await context.addInitScript(kind => {
      window.__writes = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: kind === 'unavailable' ? undefined : {
        writeText(text) { window.__writes.push(text); if (kind === 'denied') return Promise.reject(new Error('SECRET_CLIPBOARD_ERROR'));
          if (kind === 'stale-copy') return new Promise(resolve => { window.__finishCopy = resolve; }); return Promise.resolve(); },
        readText() { throw new Error('No clipboard reads allowed'); },
      } });
    }, kind);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.href); return route.abort(); }
      if (kind === 'request-error' && url.pathname === '/answer') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"SECRET_SERVER_ERROR"}' });
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url() === origin + '/answer') posts++; });
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls.length, 0); assert.equal(await page.locator('#report-copy').isDisabled(), true);
    await page.locator('#run').click(); await page.locator('#report-copy').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#report-copy').disabled);
    const count = calls.length; assert.equal(posts, 1); assert.ok(count <= 4);
    if (kind !== 'request-error') {
      const shown = await page.locator('#answer').textContent();
      assert.match(shown, /Related film\/provider claim|Supported pointer/);
      assert.match(shown, /no localization transfer/);
      if (kind === 'region-identity') {
        assert.match(await page.locator('#matching-subjects').textContent(), /Conflicting stable identity/);
        assert.equal(await page.locator('article[data-row-id^="tmdb:"]').count(), 0);
        assert.doesNotMatch(await page.locator('.matching-summary').allTextContents().then(s => s.join('\n')), /Same supported regional card pointer/);
      } else assert.match(shown, /Same supported regional card pointer/);
      const row = page.locator('article[data-row-id^="motn:"]').first();
      await row.getByRole('button', { name: 'Select and review' }).click();
      const included = async () => JSON.parse(await page.locator('#draft-included').textContent());
      assert.equal((await included()).purchase_url, '');
      await page.locator('#draft-tracking-ack').check(); assert.match((await included()).purchase_url, /at=&at=TEST%2fCODE$/);
      await page.locator('#draft-confirm').click();
      await page.locator('#local-draft input[name="title"]').fill('PRIVATE_MANUAL_DRAFT');
      await row.getByRole('button', { name: 'Select and review' }).click(); await page.locator('#draft-review-cancel').click();
      assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE_MANUAL_DRAFT');
    }
    assert.deepEqual(await page.evaluate(() => window.__writes), []);
    await page.locator('#report-copy').click();
    if (kind === 'stale-copy') {
      assert.equal(await page.locator('#report-status').textContent(), 'Copying…');
      await page.locator('#discovery-film').selectOption('dune-part-two');
      await page.waitForFunction(() => document.querySelector('#discovery-chosen').textContent.includes('Dune: Part Two'));
      await page.evaluate(() => window.__finishCopy()); await page.waitForTimeout(30);
      assert.equal(await page.locator('#report-status').textContent(), ''); assert.equal(await page.locator('#report-text').inputValue(), '');
      assert.equal(await page.locator('#report-copy').isDisabled(), true);
    } else {
      await page.waitForFunction(() => !document.querySelector('#report-copy').disabled);
      const fallback = ['denied', 'unavailable'].includes(kind);
      assert.equal(await page.locator('#report-fallback').isVisible(), fallback);
      assert.match(await page.locator('#report-status').textContent(), fallback ? /copy manually/ : /Copied short report/);
      const text = fallback ? await page.locator('#report-text').inputValue() : await page.evaluate(() => window.__writes.at(-1));
      assert.match(text, /Commit: unknown/); assert.match(text, /Coherence/);
      assert.doesNotMatch(text, /PRIVATE_MANUAL_DRAFT|SECRET_|offline-m2|https?:|Authorization|TEST%2fCODE/);
      if (kind !== 'request-error') assert.match(text, /edited yes; latest selection cancelled yes/);
      else assert.match(text, /HTTP-call count unknown/);
      if (fallback) {
        assert.equal(await page.locator('#report-text').evaluate(n => n.readOnly), true);
        await page.getByRole('button', { name: 'Select report text', exact: true }).click();
        assert.equal(await page.locator('#report-text').evaluate(n => n.selectionEnd - n.selectionStart === n.value.length), true);
      }
      await page.locator('#report-copy').click(); await page.waitForFunction(() => !document.querySelector('#report-copy').disabled);
      if (kind !== 'request-error') assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE_MANUAL_DRAFT');
      await page.locator('#discovery-film').selectOption('dune-part-two'); await page.waitForFunction(() => document.querySelector('#discovery-chosen').textContent.includes('Dune: Part Two'));
      assert.equal(await page.locator('#report-text').inputValue(), ''); assert.equal(await page.locator('#report-status').textContent(), '');
    }
    assert.equal(calls.length, count); assert.equal(posts, 1); assert.deepEqual(external, []); assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#report-copy').isDisabled(), true); assert.deepEqual(await page.evaluate(() => window.__writes), []);
  });
  await t.test('WebKit copy fallback viewport', { skip: !existsSync(webkit.executablePath()) && 'WebKit absent; no download, not real iPhone.' }, async t => {
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close());
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', fetchImpl: () => assert.fail('No external call') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
    const context = await engine.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close());
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const page = await context.newPage(); await page.goto(origin); await page.locator('#run').click();
    await page.waitForFunction(() => !document.querySelector('#report-copy').disabled); await page.locator('#report-copy').click();
    await page.locator('#report-fallback').waitFor({ state: 'visible' }); assert.match(await page.locator('#report-text').inputValue(), /SYNTHETIC ONLY/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
