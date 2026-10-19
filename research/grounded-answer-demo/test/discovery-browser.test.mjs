import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { FILMS } from '../config.mjs';
import { authoredDiscoveryData } from '../discovery.mjs';
import { localizedMarkup, tableBlock, paragraphBlock } from './kinobaza-localization.fixture.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('consolidated discovery mobile browser flow (mocks, not real iPhone)', { skip: !modulePath }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); t.after(() => browser.close());
  for (const kind of ['synthetic', 'normal', 'localization-hop', 'partial-redirect', 'tmdb-down', 'identity-conflict', 'providers-conflict', 'no-key', 'kino-fail', 'unknown-link', 'tracking', 'hostile', 'empty-UA', 'fields-conflict']) await t.test(kind, async t => {
    const calls = [], logs = [], external = [], errors = []; let posts = 0;
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence',
      mode: kind === 'synthetic' ? 'synthetic' : 'live', tmdbToken: kind === 'no-key' ? '' : 'offline-browser-tmdb', motnKey: 'offline-browser-motn',
      fetchImpl: async (url, init) => {
        calls.push(url); assert.equal(init.method, 'GET');
        if (kind === 'synthetic') assert.fail('No synthetic external call');
        const film = /220289|tt2866360|\/coherence$/.test(url) ? FILMS.coherence : FILMS['dune-part-two'];
        const data = authoredDiscoveryData(film);
        if (kind === 'localization-hop' && url.includes('kinobaza')) {
          if (url.includes('kinobaza.com.ua')) return new Response(null, { status: 301, headers: { Location: `https://kinobazaua.com/titles/${film.id}` } });
          return new Response(localizedMarkup(tableBlock() + paragraphBlock(), film.id), { headers: { 'content-type': 'text/html' } });
        }
        if (kind === 'partial-redirect') { delete data.tmdb.details.translations; if (url.includes('kinobaza')) return new Response('PRIVATE_ERROR', { status: 302, headers: { Location: 'https://private.example/PRIVATE_LOCATION' } }); }
        if (kind === 'identity-conflict') data.tmdb.details.imdb_id = 'tt0000001';
        if (kind === 'providers-conflict') data.tmdb.providers.id = 1;
        if (kind === 'hostile') data.tmdb.details.title = '<img src=https://example.com/SECRET onerror=alert(1)>';
        if (kind === 'empty-UA') { data.tmdb.providers.results.UA = {}; data.motn.streamingOptions.ua = []; }
        if (kind === 'unknown-link') data.motn.streamingOptions.ua[0].link = 'https://example.com/unknown';
        if (kind === 'fields-conflict') { const first = data.motn.streamingOptions.ua[0]; data.motn.streamingOptions.ua.push({ ...first, price: { amount: '1.23', currency: 'UAH' }, quality: 'hd' }); }
        if (url.includes('themoviedb')) {
          if (kind === 'tmdb-down') return new Response('PRIVATE_ERROR', { status: 500 });
          assert.equal(init.headers.Authorization, 'Bearer offline-browser-tmdb'); return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
        }
        if (url.includes('movieofthenight')) { assert.equal(init.headers['X-API-Key'], 'offline-browser-motn'); return Response.json(data.motn); }
        return new Response(kind === 'kino-fail' ? 'PRIVATE_ERROR' : data.html, { status: kind === 'kino-fail' ? 403 : 200, headers: { 'content-type': 'text/html' } });
      } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close());
    await context.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); external.push(route.request().url()); return route.abort(); });
    const page = await context.newPage(); page.on('console', m => logs.push(m.text())); page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url() === origin + '/answer') posts++; });
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls.length, 0); assert.match(await page.locator('#discovery-chosen').textContent(), /Coherence.*UA.*budget 5 \(4 without redirect\)/);
    await page.locator('#run').dblclick(); await page.locator('#result').waitFor({ state: 'visible' });
    assert.equal(posts, 1); assert.equal(await page.locator('#run').isDisabled(), true);
    const shown = await page.locator('#answer').textContent();
    assert.match(shown, /not|Not/); assert.doesNotMatch(shown, /offline-browser|PRIVATE_ERROR/);
    if (['identity-conflict', 'providers-conflict'].includes(kind)) assert.match(shown, /conflict-no-common-identity/);
    if (kind === 'tmdb-down' || kind === 'no-key') assert.ok(await page.locator('article[data-row-id^="motn:"]').count());
    if (kind === 'fields-conflict') assert.match(shown, /CONFLICT/);
    assert.equal(await page.locator('#discovery-source-details').evaluate(n => n.open), false);
    assert.equal(await page.locator('#answer article details[open]').count(), 0);
    assert.equal(await page.locator('#answer article').evaluateAll(nodes => nodes.every(n => n.querySelectorAll(':scope > p').length <= 4)), true);
    assert.equal(await page.locator('#answer article h4').evaluateAll(nodes => nodes.every(n => !/ · (rent|buy|rental|purchase|flatrate|subscription)\b/.test(n.textContent))), true);
    assert.ok(await page.locator('#discovery-credits').getByText('Movie of the Night', { exact: false }).count());
    if (kind === 'partial-redirect') {
      assert.match(await page.locator('#discovery-source-status').textContent(), /A: partial; B: ok.*canonical-redirect-refused/);
      assert.doesNotMatch(shown, /PRIVATE_LOCATION|private.example/);
      await page.locator('#discovery-source-details summary').click();
      assert.match(await page.locator('#discovery-source-details').textContent(), /present-not-retained|"httpStatus": 302/);
      await page.locator('#discovery-source-details summary').click();
    }
    if (kind === 'hostile') { assert.equal(await page.locator('#answer img,#answer script,#answer iframe').count(), 0); assert.match(shown, /<img src=/); }
    if (kind === 'synthetic') assert.match(shown, /SYNTHETIC ONLY/);
    if (kind === 'localization-hop') {
      assert.equal(calls.length, 5); assert.match(shown, /HTTP calls: 5\/5/);
      assert.match(shown, /film-level UA audio claim — not provider tracks/);
      assert.match(shown, /UA audio \+ \(Kinobaza block\)/);
      assert.match(shown, /UA subtitles − \(named block labels only\)/);
    }
    const exactRow = page.locator('article[data-row-id^="motn:"]').first();
    if (await exactRow.count()) {
      await exactRow.getByRole('button', { name: 'Select and review' }).click();
      assert.equal(await page.locator('#local-draft').isVisible(), false);
      assert.match(await page.locator('#draft-included').textContent(), /wishlist/);
      assert.doesNotMatch(await page.locator('#draft-included').textContent(), /sidecar|audio|subtitles|price|quality|currency/);
      await page.locator('#draft-confirm').click();
      const input = page.locator('#local-draft input[name="purchase_url"]');
      assert.equal(await input.inputValue(), kind === 'unknown-link' ? '' : 'https://tv.apple.com/ua/movie/synthetic/umc.cmc.syntheticonly');
      await page.locator('#local-draft input[name="title"]').fill('Edited in page only');
      const draftValues = () => page.locator('#local-draft input').evaluateAll(nodes => nodes.map(n => [n.name, n.value]));
      const edited = await draftValues(), requestsBeforeDraftCancel = calls.length;
      assert.equal(await page.locator('#draft-cancel-edits').count(), 0); // No destructive reset disguised as Cancel.
      await exactRow.getByRole('button', { name: 'Select and review' }).click(); await page.locator('#draft-review-cancel').click(); assert.equal(await page.locator('#local-draft').isVisible(), true);
      assert.deepEqual(await draftValues(), edited); assert.equal(calls.length, requestsBeforeDraftCancel);
      const before = await input.inputValue();
      const tracking = page.locator('article[data-row-id^="kinobaza:"]').filter({ hasText: 'Tracking candidate — destination unverified' });
      if (await tracking.count()) {
        await tracking.first().getByRole('button', { name: 'Select and review' }).click();
        assert.match(await page.locator('#draft-included').textContent(), /"purchase_url": ""/);
        await page.locator('#draft-review-cancel').click(); assert.equal(await input.inputValue(), before);
        await tracking.first().getByRole('button', { name: 'Select and review' }).click(); await page.locator('#draft-tracking-ack').check();
        assert.match(await page.locator('#draft-included').textContent(), /click.justwatch.com\/a\?synthetic=%2F&x=1/);
        await page.locator('#draft-confirm').click(); assert.equal(await input.inputValue(), 'https://click.justwatch.com/a?synthetic=%2F&x=1');
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(!logs.some(s => /offline-browser|SYNTHETIC|PRIVATE_ERROR/.test(s)));
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const s of ['#discovery-film', '#run', '#discovery-credits']) { await page.locator(s).scrollIntoViewIfNeeded(); assert.equal(await page.locator(s).isVisible(), true); }
    const count = calls.length;
    await page.locator('#discovery-film').selectOption('dune-part-two'); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls.length, count); assert.equal(await page.locator('#local-draft').isVisible(), false);
    assert.match(await page.locator('#discovery-chosen').textContent(), /Dune: Part Two/);
    await page.locator('#run').click(); await page.locator('#result').waitFor({ state: 'visible' }); assert.equal(posts, 2); assert.ok(calls.length <= (kind === 'localization-hop' ? 10 : 8));
    await page.locator('#discovery-film').selectOption('coherence'); await page.waitForTimeout(50); assert.equal(await page.locator('#run').isDisabled(), true); assert.equal(posts, 2);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled); assert.equal(await page.locator('#answer').textContent(), ''); assert.equal(await page.locator('#local-draft').isVisible(), false); assert.equal(posts, 2);
  });
  await t.test('WebKit narrow viewport', { skip: !existsSync(webkit.executablePath()) && 'WebKit absent; no download; not real iPhone.' }, async t => {
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close());
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', fetchImpl: () => assert.fail('No network') }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
    const context = await engine.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close()); const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`); await page.locator('#run').click(); await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#answer').textContent(), /SYNTHETIC ONLY/);
  });
});
