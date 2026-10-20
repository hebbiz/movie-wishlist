// Authored UI fixtures only. Existing server gate is used; no external transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { MYKOLA_STATES, mykolaFixture } from './mykola.fixture.mjs';

test('Mykola five authored mobile states: scope, actions, memory-only draft and screenshots', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  for (const kind of MYKOLA_STATES) await t.test(kind, async t => {
    const { result } = await mykolaFixture(kind), immutable = JSON.stringify(result);
    const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: result.film.id, fetchImpl: () => assert.fail('No external transport') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`, external = [], errors = [], posts = [];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close());
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: () => Promise.reject(new Error('AUTHORED denied')), readText: () => { throw Error('No clipboard reads'); },
    } }));
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) { external.push(u.origin); return route.abort(); }
      if (u.pathname === '/answer') {
        posts.push(u.pathname); const actual = await route.fetch(); assert.equal(actual.status(), 200);
        // Substitute only authored projected values after the real synthetic one-shot gate.
        return route.fulfill({ response: actual, json: { mode: 'synthetic', result } });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#discovery-film option').count(), 6);
    assert.equal(await page.locator('#discovery-film').inputValue(), result.film.id);
    await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#report-copy').disabled);
    const visible = await page.locator('#answer').innerText();
    const summary = await page.locator('#mykola-summary').innerText();
    assert.equal(summary.split(/[.!?]+/u).filter(x => x.trim()).length, 2);
    assert.doesNotMatch(visible, /compatible|insufficient-evidence|entitlement|binding|A:|B:|C\/D|best option|independently verified|working link|AUTHORED.*TOKEN/i);
    assert.match(visible, /SYNTHETIC ONLY/); assert.equal(await page.locator('#answer details[open]').count(), 0);
    assert.ok(await page.locator('.provider-group').count());
    assert.equal(await page.locator('.provider-group > button,.best-option,.verified-offer').count(), 0);
    if (kind === 'several') assert.match(summary, /2 платформи/);
    if (kind === 'unbound-localization') {
      assert.match(visible, /Кінобаза вказує українське аудіо; для цієї пропозиції ще не перевірено/);
      assert.match(visible, /субтитри — «−» у цьому блоці/);
      assert.match(await page.locator('article[data-row-id^="motn:"] .viewing-localization').innerText(), /аудіо — невідомо/);
      assert.match(await page.locator('article[data-row-id^="kinobaza:"]').last().innerText(), /Територія не встановлена/);
    }
    if (kind === 'conflicting-properties') { assert.match(visible, /суперечливі/); assert.match(visible, /можлива розбіжність/); assert.doesNotMatch(visible, /1\.23|4\.56/); }
    if (kind === 'candidates-only') { assert.match(visible, /Посилання-кандидат/); assert.match(visible, /саме посилання не підтверджує доступність/); }
    if (kind === 'partial-source') { assert.match(summary, /Дані неповні/); assert.match(visible, /TMDb \/ JustWatch: дані недоступні/); assert.ok(await page.locator('article[data-row-id^="motn:"]').count()); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.MYKOLA_SCREENSHOT_DIR) {
      await page.locator('#result').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.MYKOLA_SCREENSHOT_DIR}/${kind}.png`, fullPage: true });
    }
    const selectable = page.locator('article.discovery-card').filter({ has: page.getByRole('button', { name: 'Обрати', exact: true }) }).last();
    const id = await selectable.getAttribute('data-row-id'), original = result.rows.find(r => r.id === id);
    const before = posts.length, canOpen = await selectable.getByRole('link', { name: 'Відкрити посилання', exact: true }).count();
    if (canOpen) {
      const link = selectable.getByRole('link', { name: 'Відкрити посилання', exact: true });
      assert.equal(await link.getAttribute('href'), original.link.href);
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
      await link.evaluate(n => n.addEventListener('click', e => { e.preventDefault(); n.dataset.clicked = 'yes'; }));
      await link.click(); assert.equal(await link.getAttribute('data-clicked'), 'yes');
    }
    await selectable.getByRole('button', { name: 'Обрати', exact: true }).click();
    const fields = () => page.locator('#draft-included').textContent().then(JSON.parse);
    assert.deepEqual(Object.keys(await fields()), ['imdb_url', 'title', 'year', 'recommended_medium', 'purchase_url', 'status']);
    assert.equal((await fields()).purchase_url, original.link.kind === 'tracking-redirect' || original.link.acknowledgementRequired ? '' : canOpen ? original.link.href : '');
    assert.match(await page.locator('#draft-review details').textContent(), new RegExp(id));
    if (await page.locator('#draft-tracking-ack').count()) { await page.locator('#draft-tracking-ack').check(); assert.equal((await fields()).purchase_url, original.link.href); }
    await page.locator('#draft-confirm').click();
    await page.locator('#local-draft input[name="title"]').fill('PRIVATE_MANUAL_EDIT');
    await selectable.getByRole('button', { name: 'Обрати', exact: true }).click(); await page.locator('#draft-review-cancel').click();
    assert.equal(await page.locator('#local-draft input[name="title"]').inputValue(), 'PRIVATE_MANUAL_EDIT');
    await page.locator('#report-copy').click(); await page.locator('#report-fallback').waitFor({ state: 'visible' });
    assert.doesNotMatch(await page.locator('#report-text').inputValue(), /PRIVATE_MANUAL_EDIT|https?:|AUTHORED.*TOKEN|authored-token-only|authored-key-only/);
    assert.equal(posts.length, before); assert.equal(posts.length, 1); assert.equal(JSON.stringify(result), immutable);
    await page.setViewportSize({ width: 320, height: 800 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#discovery-film').selectOption('dune-part-two');
    await page.waitForFunction(() => document.querySelector('#discovery-chosen').textContent.includes('Dune: Part Two'));
    assert.equal(await page.locator('#report-text').inputValue(), ''); assert.equal(await page.locator('#report-copy').isDisabled(), true);
    assert.equal(posts.length, 1); assert.deepEqual(external, []); assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
  });
  await t.test('WebKit available', { skip: !existsSync(webkit.executablePath()) && 'WebKit absent; no download, not real iPhone' }, () => {});
});
