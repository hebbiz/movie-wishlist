// Installed-browser mobile viewport only, not Safari/iPhone or live validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { HELD_OUT_FILMS } from '../held-out.mjs';
import { authoredDiscoveryData } from '../discovery.mjs';

test('held-out mobile picker/report/draft: four mocked discoveries, no stale result or destination', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  for (const partial of [false, true]) await t.test(partial ? 'partial-source-results' : 'all-authored-responses', async t => {
    const calls = [], external = [], errors = [];
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'the-thing-1982', mode: 'live',
      tmdbToken: 'private-held-token', motnKey: 'private-held-key', fetchImpl: async (url, init) => {
        assert.equal(init.redirect, 'manual'); assert.equal(init.method, 'GET'); calls.push(url);
        const f = Object.values(HELD_OUT_FILMS).find(f => url === f.kinobazaURL ||
          url.startsWith(`https://api.themoviedb.org/3/movie/${f.tmdbId}?`) ||
          url === `https://api.themoviedb.org/3/movie/${f.tmdbId}/watch/providers` ||
          url === `https://api.movieofthenight.com/v4/shows/${f.imdbId}?country=ua`);
        assert.ok(f, 'No destination or unconfigured request');
        const data = authoredDiscoveryData(f);
        if (partial && f.id === 'the-thing-1982' && url.includes('themoviedb')) return new Response('private-error-body', { status: 503 });
        if (url.includes('themoviedb')) return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
        if (url.includes('movieofthenight')) return Response.json(data.motn);
        return new Response(data.html, { headers: { 'content-type': 'text/html' } });
      } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close());
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: () => Promise.reject(new Error('Authored denied clipboard')),
    } }));
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#discovery-film option').count(), 6); assert.equal(calls.length, 0);
    for (const id of Object.keys(HELD_OUT_FILMS)) {
      const f = HELD_OUT_FILMS[id], kino = Boolean(f.kinobazaURL);
      await page.locator('#discovery-film').selectOption(id);
      await page.waitForFunction(id => document.querySelector('#discovery-chosen').textContent.includes(id === 'parasite' ? 'Parasite' : id === 'kingdom-of-heaven' ? 'Kingdom' : id.endsWith('1982') ? '1982' : '2011'), id);
      await page.waitForFunction(() => !document.querySelector('#run').disabled);
      assert.equal(await page.locator('#report-copy').isDisabled(), true);
      assert.equal(await page.locator('#report-text').inputValue(), '');
      const chosen = await page.locator('#discovery-chosen').textContent();
      assert.match(chosen, new RegExp(`Kinobaza ${kino ? 'on' : 'off'} · budget ${kino ? 4 : 3}`));
      const before = calls.length;
      await page.locator('#run').click(); await page.waitForFunction(() => !document.querySelector('#report-copy').disabled);
      const shown = await page.locator('#answer').textContent();
      assert.match(shown, /insufficient-evidence/);
      assert.equal(await page.locator('.best-option, .verified-offer').count(), 0);
      assert.doesNotMatch(await page.locator('.matching-summary').allTextContents().then(x => x.join('\n')), /Same supported regional card pointer/);
      if (partial && id === 'the-thing-1982') assert.ok(await page.locator('article[data-row-id^="motn:"]').count());
      assert.ok(calls.length - before <= (kino ? 4 : 3));
      if (id === 'kingdom-of-heaven') {
        const row = page.locator('article[data-row-id^="motn:"]').first();
        await row.getByRole('button', { name: 'Select and review' }).click();
        const fields = JSON.parse(await page.locator('#draft-included').textContent());
        assert.equal(fields.year, '2005'); assert.equal(fields.title, 'Kingdom of Heaven');
        assert.doesNotMatch(JSON.stringify(fields), /Director's Cut|audio|subtitles/);
        await page.locator('#draft-confirm').click();
        await page.locator('#local-draft input[name="title"]').fill('private-edited-value');
        await row.getByRole('button', { name: 'Select and review' }).click();
        await page.locator('#draft-review-cancel').click();
        assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'private-edited-value');
      }
      const noCopyCalls = calls.length;
      await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
      const report = await page.locator('#report-text').inputValue();
      assert.ok(report.includes(f.title)); assert.match(report, /Commit: unknown/);
      assert.match(report, /C\/D deferred/); assert.doesNotMatch(report, /private-|https:/);
      if (partial && id === 'the-thing-1982') assert.match(report, /identity unresolved/);
      assert.equal(calls.length, noCopyCalls);
    }
    assert.equal(calls.length, partial ? 13 : 14);
    await page.locator('#discovery-film').selectOption('the-thing-1982');
    await page.waitForFunction(() => document.querySelector('#run').textContent.includes('Used for this film'));
    assert.equal(await page.locator('#run').isDisabled(), true); assert.equal(await page.locator('#report-copy').isDisabled(), true);
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  });
  await t.test('WebKit available', { skip: !existsSync(webkit.executablePath()) }, () => {});
});
