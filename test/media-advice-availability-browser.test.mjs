import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';

// Authored source-shaped controls, NOT historical URLs/offers or live platform
// verification. The real local app runs with all remote HTTP blocked. Opening
// a chosen URL is intercepted; transfer updates the form without a Save.
const unknown = () => ({ state: 'unknown', evidence: [] });
const positive = () => ({ state: 'reported-positive', language: 'uk', evidence: [{ label: 'укр. субтитри', literal: '+', state: 'positive' }] });
const negative = () => ({ state: 'reported-negative', language: 'uk', evidence: [{ label: 'Укр. звук (стерео)', formatLiteral: 'стерео', literal: '−', state: 'negative' }] });
const film = (imdbId, title, year) => ({ id: `imdb:${imdbId}`, imdbId, title, year });
const fast6 = film('tt1905041', 'Fast & Furious 6', 2013);
const lostBus = film('tt21103218', 'The Lost Bus', 2025);
const shining = film('tt0081505', 'The Shining', 1980);
const police = film('tt0087928', 'Police Academy', 1984);
const appleURL = key => `https://tv.apple.com/ua/movie/authored-${key}/umc.cmc.authored${key}?at=AUTHORED%2f${key}#Exact`;
const rakutenURL = key => `https://rakuten.tv/ua/movies/authored-${key}?utm_source=AUTHORED%2f${key}#Exact`;
const providerName = key => ({ apple: 'Apple TV Store', appletvplus: 'Apple TV+', rakuten: 'Rakuten TV' })[key];
function row(selectedFilm, provider, id, href, { source = 'Movie of the Night', country = 'UA', access = 'buy', ...extra } = {}) {
  return { id, filmId: selectedFilm.id, identityStatus: 'matched', country,
    provider: { key: provider, sourceName: providerName(provider) }, access: { state: 'reported', value: access },
    audio: unknown(), subtitles: unknown(), conflicts: [], provenance: { source }, link: { href }, ...extra };
}
function caption(selectedFilm, provider, id, href, audio = unknown(), subtitles = positive(), access = 'buy') {
  return row(selectedFilm, provider, id, href, { source: 'Kinobaza HTML', country: null, access,
    territoryBasis: 'Outside territory section', linkAudit: { blockAssociation: 'associated' },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: providerName(provider), href, territory: null, issues: [], audio, subtitles } });
}
function uaSection(selectedFilm, provider, id, href) {
  return row(selectedFilm, provider, id, href, { source: 'Kinobaza HTML',
    territoryBasis: 'Explicit Ukrainian section; not entitlement',
    provenance: { source: 'Kinobaza HTML', upstream: 'JustWatch section (shared with TMDb)' },
    countrySignal: { state: 'source-section-claim', territory: { code: 'UA', label: 'Україна' }, provider: providerName(provider), href } });
}
const fastLink = row(fast6, 'apple', 'kinobaza:fast-selected-unknown', appleURL('fastselected'), { source: 'Kinobaza HTML', country: null });
const fastRows = [
  row(fast6, 'apple', 'tmdb:fast-rental', 'https://www.themoviedb.org/movie/82992/watch', { source: 'TMDb / JustWatch', access: 'rental' }),
  row(fast6, 'apple', 'motn:fast-purchase', null), fastLink,
];
const plusCaption = caption(lostBus, 'appletvplus', 'kinobaza:plus-caption', appleURL('pluscaption'), unknown(), positive(), 'subscription');
const plusUA = row(lostBus, 'appletvplus', 'motn:plus-ua', appleURL('plusunknown'), { access: 'subscription' });
const storeOnly = caption(lostBus, 'apple', 'kinobaza:store-only', appleURL('storeonly'), negative(), positive());
const mixedRows = [plusCaption, plusUA, storeOnly];
const storeControl = selectedFilm => {
  const key = selectedFilm.imdbId;
  return [
    caption(selectedFilm, 'apple', `kinobaza:${key}-apple-top`, appleURL(key + 'top'), negative()),
    uaSection(selectedFilm, 'apple', `kinobaza:${key}-apple-ua`, appleURL(key + 'region')),
    caption(selectedFilm, 'rakuten', `kinobaza:${key}-rakuten-top`, rakutenURL(key + 'top'), negative()),
    uaSection(selectedFilm, 'rakuten', `kinobaza:${key}-rakuten-ua`, rakutenURL(key + 'region')),
  ];
};
const sdkStub = `window.authoredDBWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:fn=>{window.authoredAuthEvent=fn;}},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:{role:'owner'}})};return q;},insert:fields=>{window.authoredDBWrites.push({name,fields});throw Error('AUTHORED Save forbidden');},update:fields=>{window.authoredDBWrites.push({name,fields});throw Error('AUTHORED Save forbidden');}})})}`;

test('same-product service availability is independent of navigation choice; original tracks, conditions and addresses remain scoped',
  { skip: !process.env.PLAYWRIGHT_MODULE_PATH, timeout: 115000 }, async t => {
    const root = resolve(import.meta.dirname, '..');
    const server = createServer(async (req, res) => {
      try {
        const file = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
        if (!file.startsWith(root + sep)) throw Error('outside fixture');
        res.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[extname(file)] ?? 'text/plain');
        res.end(await readFile(file));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    t.after(() => browser.close());
    if (process.env.M4_SCREENSHOT_DIR) await mkdir(process.env.M4_SCREENSHOT_DIR, { recursive: true });

    async function setup(t, selectedFilm, rows, width, diagnostics) {
      const snapshot = JSON.stringify(rows), state = { discoveries: 0, blockedRemote: [] };
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, serviceWorkers: 'block' });
      t.after(() => context.close());
      const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics };
      const result = { film: selectedFilm, rows, sources: [{ source: 'kinobaza', status: 'ok', identity: 'matched' }], unmapped: [] };
      const projected = diagnostics ? { ...result, capabilities } : productMediaResult(result, capabilities);
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: sdkStub });
        if (url.origin !== origin) { state.blockedRemote.push(url.hostname); return route.abort(); }
        if (url.pathname === '/.netlify/functions/media-advice') {
          if (route.request().postDataJSON().action === 'capability') return route.fulfill({ json: capabilities });
          state.discoveries++; return route.fulfill({ json: { result: projected } });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('dialog', dialog => dialog.accept());
      await page.goto(origin + '/app.html');
      await page.waitForFunction(() => !!mediaAdviceController);
      await page.evaluate(f => {
        document.getElementById('appLoader').style.display = 'none'; mainView.style.display = 'block';
        currentUser = { id: 'user' }; currentRole = 'owner'; currentGroupId = 'group'; window.authoredLogin = true;
        window.authoredOpened = []; window.open = (...args) => { authoredOpened.push(args); return null; };
        movies = [{ id: 'list', imdb_url: `https://imdb.com/title/${f.imdbId}`, title: f.title, year: f.year,
          status: 'wishlist', recommended_medium: 'DVD', purchase_url: '', added_by: 'Authored' }];
        startEditMovie('list'); activeAdviceRoom = { id: 'KEEP' }; mykolaChat.textContent = 'UNCHANGED SOCIAL CHAT';
      }, selectedFilm);
      await page.locator('#mediaAdviceEntry').click();
      await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-provider-icon')].every(image => image.complete && image.naturalWidth > 0));
      t.after(() => assert.equal(JSON.stringify(rows), snapshot, 'display, choice and preview never mutate source observations'));
      return { page, state };
    }
    const service = (page, key) => page.locator(`[data-provider-key="${key}"]`);
    const cells = (page, key) => service(page, key).locator('td').allTextContents();
    async function pick(page, key, href) {
      await service(page, key).locator('.media-advice-service-select').click();
      const selector = page.locator('.media-advice-link-select');
      if (await selector.count()) {
        const labels = await selector.locator('option').allTextContents();
        assert.equal(new Set(labels).size, labels.length, 'distinct permitted choices have distinguishable labels');
        for (let index = 0; index < labels.length; index++) {
          await page.locator('.media-advice-link-select').selectOption(String(index));
          if (await page.locator('.media-advice-actions .media-advice-link-address p').textContent() === href) return;
        }
        assert.fail('the original representative must remain selectable');
      }
      assert.equal(await page.locator('.media-advice-actions .media-advice-link-address p').textContent(), href);
    }
    async function previewApply(page, state, key, href, expectedTracks, access) {
      await pick(page, key, href);
      const expectedMedium = key === 'apple' ? 'Apple TV / iTunes' : 'Rakuten TV';
      await page.getByRole('button', { name: 'Відкрити посилання', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => authoredOpened.at(-1)), [href, '_blank', 'noopener,noreferrer']);
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.getByText('Повні адреси', { exact: true }).click();
      const preview = await page.locator('.media-advice-preview').innerText();
      assert.ok(preview.includes(href), 'preview retains case, escaping and fragment of the exact source URL');
      if (key === 'apple') assert.ok(preview.includes(`Тип доступу: ${access}`), 'preview retains the selected original access condition');
      if (expectedTracks[0] === '?') assert.match(preview, /Українське аудіо: невідомо/);
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0);
      await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
      await page.waitForFunction(() => !mediaAdviceController.dialog.open);
      assert.equal(await page.locator('#recommended_medium').inputValue(), expectedMedium);
      assert.equal(await page.locator('#purchase_url').inputValue(), href, 'transfer never rewrites the selected original address');
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0, 'form transfer does not perform a Wishlist write');
      await page.locator('#mediaAdviceEntry').click();
      assert.equal(state.discoveries, 1, 'switching/reopening never repeats discovery');
    }
    async function layout(page) {
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const geometry = await page.locator('.media-advice-comparison').evaluate(table => {
        const bounds = element => { const r = element.getBoundingClientRect(); return { center: r.x + r.width / 2, width: r.width, height: r.height }; };
        return { headers: [...table.querySelectorAll('thead th')].map(bounds), rows: [...table.querySelectorAll('tbody tr')].map(row => ({
          cells: [...row.children].map(bounds), button: bounds(row.querySelector('button')) })) };
      });
      for (const row of geometry.rows) {
        assert.ok(row.button.width >= 44 && row.button.height >= 44);
        for (const [index, cell] of row.cells.entries()) assert.ok(Math.abs(cell.center - geometry.headers[index].center) < 1);
      }
      assert.ok(!(await page.locator('.media-advice-actions > p').allTextContents()).some(text => /Тип доступу|Джерело:/.test(text)), 'compact action block remains unchanged');
    }
    async function diagnosticsCheck(page, rows, enabled) {
      const button = page.getByRole('button', { name: 'Діагностичний звіт', exact: true });
      assert.equal(await button.count(), enabled ? 1 : 0);
      if (enabled) {
        await button.click();
        assert.equal(await page.locator('.media-advice-diagnostics pre').count(), rows.length, 'all distinct original source observations remain available only to authorized diagnostics');
        await page.getByRole('button', { name: '← До порад', exact: true }).click();
      } else assert.equal(await page.locator('.media-advice-diagnostics pre').count(), 0);
    }

    for (const [width, diagnostics] of [[375, false], [1280, true]]) {
      await t.test(`Fast6-shaped unknown-country Apple pointer / ${width}px`, async t => {
        const { page, state } = await setup(t, fast6, fastRows, width, diagnostics);
        await pick(page, 'apple', fastLink.link.href);
        assert.deepEqual(await cells(page, 'apple'), ['●', '?', '?'], 'same-product UA source claims survive selection of an unknown-country pointer');
        const mark = service(page, 'apple').locator('td').first().locator('.media-advice-symbol');
        assert.equal(await mark.getAttribute('data-state'), 'reported');
        assert.match(await mark.getAttribute('aria-label'), /Джерело.*України/);
        assert.match(await mark.getAttribute('aria-label'), /не.*(перевір|підтвердж)/);
        assert.equal(await page.locator('.media-advice-link-select').count(), 0, 'Store preference remains one choice, not a rent/buy toggle');
        await previewApply(page, state, 'apple', fastLink.link.href, ['?', '?'], 'Купівля');
        assert.deepEqual(await cells(page, 'apple'), ['●', '?', '?']);
        await layout(page); await diagnosticsCheck(page, fastRows, diagnostics);
        if (process.env.M4_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/service-availability-fast6-${width}.png`, animations: 'disabled' });
      });
      await t.test(`Lost Bus-shaped mixed original products / ${width}px`, async t => {
        const { page, state } = await setup(t, lostBus, mixedRows, width, diagnostics);
        assert.equal(await page.getByRole('button', { name: 'Apple TV / iTunes', exact: true }).count(), 1);
        assert.equal(await page.getByRole('button', { name: 'Apple TV+', exact: true }).count(), 0);
        for (const [selected, expected, access] of [
          [plusCaption, ['●', '?', '+'], 'Передплата'],
          [plusUA, ['●', '?', '?'], 'Передплата'],
          [storeOnly, ['◐', '−*', '+'], 'Купівля'],
          [plusCaption, ['●', '?', '+'], 'Передплата'],
        ]) {
          await pick(page, 'apple', selected.link.href);
          assert.deepEqual(await cells(page, 'apple'), expected, 'availability uses only the selected product; tracks stay with its selected original row');
          assert.equal(await page.locator('.media-advice-link-select option').count(), 3, 'two non-equivalent Plus choices and one Store preference survive');
          assert.equal(await service(page, 'apple').getAttribute('data-row-id'), selected.id);
          await previewApply(page, state, 'apple', selected.link.href, expected.slice(1), access);
          assert.deepEqual(await cells(page, 'apple'), expected);
        }
        await layout(page); await diagnosticsCheck(page, mixedRows, diagnostics);
        if (process.env.M4_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/service-availability-mixed-${width}.png`, animations: 'disabled' });
      });
      for (const selectedFilm of [shining, police]) await t.test(`${selectedFilm.title}-shaped explicit Kino UA / ${width}px`, async t => {
        const rows = storeControl(selectedFilm), { page, state } = await setup(t, selectedFilm, rows, width, diagnostics);
        for (const provider of ['apple', 'rakuten']) {
          assert.deepEqual(await cells(page, provider), ['●', '−*', '+'], 'validated country-section availability does not change format-qualified source languages');
          const selected = rows.find(row => row.provider.key === provider && row.kinobazaLocalization);
          await previewApply(page, state, provider, selected.link.href, ['−*', '+'], 'Купівля');
          assert.deepEqual(await cells(page, provider), ['●', '−*', '+']);
        }
        await layout(page); await diagnosticsCheck(page, rows, diagnostics);
        assert.deepEqual(await page.evaluate(() => [activeAdviceRoom.id, mykolaChat.textContent, authoredDBWrites.length]), ['KEEP', 'UNCHANGED SOCIAL CHAT', 0]);
      });
    }
    console.info('Authored service-availability browser controls: source HTTP 0; Supabase HTTP/writes 0; actual platform navigation 0. Film names identify authored controls, not live or historical source attestations.');
  });
