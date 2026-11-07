import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { mediaSourceDetails } from '../assets/media-advice-report.mjs';

// Authored source-shaped fixtures, not historical offers/HTML or independent
// platform verification. Only the real local app is served: all source/API,
// platform and Supabase HTTP is blocked, and explicit opens are intercepted.
const unknown = () => ({ state: 'unknown', evidence: [] });
const positive = label => ({ state: 'reported-positive', language: 'uk', evidence: [{ label, literal: '+', state: 'positive' }] });
const negative = format => ({ state: 'reported-negative', language: 'uk', evidence: [{
  label: format ? `Укр. звук (${format})` : 'Укр. звук', literal: '−', state: 'negative', ...(format ? { formatLiteral: format } : {}),
}] });
const film = (imdbId, title, year) => ({ id: `imdb:${imdbId}`, imdbId, title, year });
const shining = film('tt0081505', 'The Shining', 1980);
const fockers = film('tt0290002', 'Meet the Fockers', 2004);
const parents = film('tt0212338', 'Meet the Parents', 2000);
const lostBus = film('tt21103218', 'The Lost Bus', 2025);

function kinoRow(selectedFilm, provider, id, href, audio, subtitles, access = 'buy') {
  const name = { apple: 'itunes', appletvplus: 'Apple TV+', rakuten: 'Rakuten TV', netflix: 'Netflix', megogo: 'MEGOGO' }[provider];
  return { id: `kinobaza:${id}`, filmId: selectedFilm.id, identityStatus: 'matched', country: null,
    provider: { key: provider, sourceName: name }, access: { state: 'reported', value: access },
    audio: { state: 'unknown' }, subtitles: { state: 'unknown' }, conflicts: [], provenance: { source: 'Kinobaza HTML' },
    link: { href }, linkAudit: { blockAssociation: 'associated' },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: name, href, territory: null, issues: [], audio, subtitles } };
}
const appleHref = id => `https://tv.apple.com/ua/movie/authored-${id}/umc.cmc.authored${id}?at=AUTHORED%2f${id}#Exact`;
const rakutenHref = id => `https://rakuten.tv/ua/movies/authored-${id}?utm_source=AUTHORED%2f${id}#Exact`;
const shiningRows = [
  kinoRow(shining, 'apple', 'shining-apple', appleHref('shining'), negative('стерео'), positive('Укр. субтитри')),
  kinoRow(shining, 'rakuten', 'shining-rakuten', rakutenHref('shining'), negative('dolby'), positive('Укр. субтитри')),
];
const familyRows = selectedFilm => [kinoRow(selectedFilm, 'rakuten', `${selectedFilm.imdbId}-rakuten`, rakutenHref(selectedFilm.imdbId), negative('стерео'), positive('Укр. субтитри'))];
const plus = kinoRow(lostBus, 'appletvplus', 'plus-subtitles', appleHref('lostbusplus'), unknown(), positive('укр. субтитри'), 'subscription');
const storeNegative = kinoRow(lostBus, 'apple', 'store-negative', appleHref('lostbusstore'), negative('стерео'), positive('Укр. субтитри'));
const plusUnknown = { id: 'motn:plus-unknown', filmId: lostBus.id, identityStatus: 'matched', country: 'UA',
  provider: { key: 'appletvplus', sourceName: 'Apple TV+' }, access: { state: 'reported', value: 'subscription' },
  audio: { state: 'unknown' }, subtitles: { state: 'unknown' }, conflicts: [], provenance: { source: 'Movie of the Night' },
  link: { href: appleHref('lostbusunknown') } };
const mixedRows = [plus, storeNegative, plusUnknown];
const conflict = { state: 'conflicting', language: 'uk', evidence: [
  { label: 'Укр. звук', literal: '+', state: 'positive' }, { label: 'Укр. звук', literal: '−', state: 'negative' },
] };
const stateRows = [
  kinoRow(shining, 'apple', 'broad-negative', appleHref('broadnegative'), negative(), positive('Укр. субтитри')),
  kinoRow(shining, 'rakuten', 'positive', rakutenHref('positive'), positive('укр. аудіо'), unknown()),
  kinoRow(shining, 'netflix', 'unknown', 'https://www.netflix.com/ua/title/987654', unknown(), unknown(), 'subscription'),
  kinoRow(shining, 'megogo', 'conflicting', 'https://megogo.net/ua/view/987654-authored.html', conflict, unknown()),
];
const sdkStub = `window.authoredDBWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:fn=>{window.authoredAuthEvent=fn;}},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:{role:'owner'}})};return q;},insert:fields=>{window.authoredDBWrites.push({name,fields});throw Error('AUTHORED Save forbidden');},update:fields=>{window.authoredDBWrites.push({name,fields});throw Error('AUTHORED Save forbidden');}})})}`;

test('qualified source negatives and compact actions: authored Shining/family/Apple fixtures in the real local app',
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
      const snapshot = JSON.stringify(rows);
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, serviceWorkers: 'block' });
      t.after(() => context.close());
      const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics };
      const result = { film: selectedFilm, rows, sources: [{ source: 'kinobaza', status: 'ok', identity: 'matched' }], unmapped: [] };
      const projected = diagnostics ? { ...result, capabilities } : productMediaResult(result, capabilities);
      const state = { discoveries: 0, blockedRemote: [] };
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
      t.after(() => assert.equal(JSON.stringify(rows), snapshot, 'display, choice and preview do not mutate original source data'));
      return { page, state };
    }
    const tableRow = (page, key) => page.locator(`[data-provider-key="${key}"]`);
    async function tracks(page, key) { return (await tableRow(page, key).locator('td').allTextContents()).slice(-2); }
    async function compactActions(page) {
      assert.ok(!(await page.locator('.media-advice-actions > p').allTextContents()).some(text => /Тип доступу|Джерело:/.test(text)),
        'the redundant Apple access/source paragraph is absent from actions (not from the preview or selector labels)');
    }
    async function selectOriginal(page, provider, href) {
      await tableRow(page, provider).locator('.media-advice-service-select').click();
      const select = page.locator('.media-advice-link-select');
      if (await select.count()) {
        const labels = await select.locator('option').allTextContents();
        assert.equal(new Set(labels).size, labels.length);
        for (let index = 0; index < labels.length; index++) {
          await page.locator('.media-advice-link-select').selectOption(String(index));
          if (await page.locator('.media-advice-actions .media-advice-link-address p').textContent() === href) { await compactActions(page); return; }
        }
        assert.fail('the original permitted URL must remain selectable');
      }
      assert.equal(await page.locator('.media-advice-actions .media-advice-link-address p').textContent(), href);
      await compactActions(page);
    }
    async function previewApply(page, state, provider, href, medium, access) {
      await selectOriginal(page, provider, href);
      await page.getByRole('button', { name: 'Відкрити посилання', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => authoredOpened.at(-1)), [href, '_blank', 'noopener,noreferrer']);
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.getByText('Повні адреси', { exact: true }).click();
      const preview = await page.locator('.media-advice-preview').innerText();
      assert.ok(preview.includes(href), 'preview preserves the exact source URL, including case/escaping/fragment');
      if (provider === 'apple') assert.ok(preview.includes(`Тип доступу: ${access}`), 'removing action noise does not remove access conditions from preview');
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0);
      await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
      await page.waitForFunction(() => !mediaAdviceController.dialog.open);
      assert.equal(await page.locator('#recommended_medium').inputValue(), medium);
      assert.equal(await page.locator('#purchase_url').inputValue(), href);
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0, 'explicit transfer changes form fields only, not Wishlist');
      await page.locator('#mediaAdviceEntry').click();
      assert.equal(state.discoveries, 1, 'reopening and switching links never repeats discovery');
    }
    async function qualifiedNegative(page, provider) {
      assert.deepEqual(await tracks(page, provider), ['−*', '+']);
      const mark = tableRow(page, provider).locator('td').nth(1).locator('.media-advice-symbol');
      assert.equal(await mark.getAttribute('data-state'), 'format-negative');
      assert.match(await mark.getAttribute('aria-label'), /зазначен.*формат|формат.*зазначен/iu);
      assert.match(await mark.getAttribute('aria-label'), /інш.*(невідом|не перевірено)/iu);
      assert.equal(await mark.getAttribute('title'), await mark.getAttribute('aria-label'));
      await page.locator('.media-advice-legend summary').click();
      assert.match(await page.locator('.media-advice-legend').innerText(), /−\*/u);
      assert.match(await page.locator('.media-advice-legend').innerText(), /формат|доріж/iu);
      await page.locator('.media-advice-legend summary').click();
    }
    async function layout(page) {
      const geometry = await page.locator('.media-advice-comparison').evaluate(table => {
        const bounds = element => { const r = element.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height, center: r.x + r.width / 2 }; };
        return { headers: [...table.querySelectorAll('thead th')].map(bounds), rows: [...table.querySelectorAll('tbody tr')].map(row => ({
          cells: [...row.children].map(bounds), button: bounds(row.querySelector('button')), slot: bounds(row.querySelector('.media-advice-icon-slot')) })) };
      });
      const steps = geometry.headers.slice(1).map((item, index) => item.center - geometry.headers[index].center);
      assert.ok(Math.max(...steps) - Math.min(...steps) < 1, 'four-column rhythm is unchanged by the qualifier');
      for (const row of geometry.rows) {
        assert.ok(row.button.width >= 44 && row.button.height >= 44);
        assert.ok(row.slot.x >= row.cells[0].x && row.slot.right <= row.cells[0].right);
        for (const [index, cell] of row.cells.entries()) assert.ok(Math.abs(cell.center - geometry.headers[index].center) < 1);
      }
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    async function diagnosticsCheck(page, rows, enabled) {
      const button = page.getByRole('button', { name: 'Діагностичний звіт', exact: true });
      if (!enabled) {
        assert.equal(await button.count(), 0);
        assert.equal(await page.locator('.media-advice-diagnostics pre, .media-advice-diagnostics textarea').count(), 0);
        return;
      }
      await button.click();
      const originals = await page.locator('.media-advice-diagnostics pre').allTextContents();
      assert.equal(originals.length, rows.length, 'authorized diagnostics retain all original observations');
      assert.deepEqual(originals.map(text => JSON.stringify(JSON.parse(text))).sort(), rows.map(row => JSON.stringify(mediaSourceDetails(row))).sort(),
        'each original source record retains its allowed diagnostics fields; private raw IDs remain filtered');
      if (rows.some(row => row.kinobazaLocalization?.audio.state === 'reported-negative')) assert.ok(originals.some(text => text.includes('reported-negative')));
      if (rows.some(row => row.kinobazaLocalization?.audio.evidence.some(item => item.formatLiteral))) assert.ok(originals.some(text => text.includes('formatLiteral')));
      await page.getByRole('button', { name: '← До порад', exact: true }).click();
    }

    for (const [width, diagnostics] of [[375, false], [1280, true]]) await t.test(`Shining-shaped two services / ${width}px / ${diagnostics ? 'diagnostic' : 'ordinary Beta'}`, async t => {
      const { page, state } = await setup(t, shining, shiningRows, width, diagnostics);
      for (const provider of ['apple', 'rakuten']) await qualifiedNegative(page, provider);
      await selectOriginal(page, 'apple', shiningRows[0].link.href);
      assert.equal(await page.locator('.media-advice-link-select').count(), 0, 'one usable Apple choice needs no selector or rent/buy switch');
      await layout(page);
      if (process.env.M4_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/scoped-negative-shining-${width}.png`, animations: 'disabled' });
      await diagnosticsCheck(page, shiningRows, diagnostics);
      await previewApply(page, state, 'apple', shiningRows[0].link.href, 'Apple TV / iTunes', 'Купівля');
      await previewApply(page, state, 'rakuten', shiningRows[1].link.href, 'Rakuten TV');
      for (const provider of ['apple', 'rakuten']) await qualifiedNegative(page, provider);
      assert.deepEqual(await page.evaluate(() => [activeAdviceRoom.id, mykolaChat.textContent, authoredDBWrites.length]), ['KEEP', 'UNCHANGED SOCIAL CHAT', 0]);
    });
    for (const [selectedFilm, width, diagnostics] of [[fockers, 375, false], [parents, 1280, true]]) await t.test(`${selectedFilm.title}-shaped Rakuten / ${width}px`, async t => {
      const rows = familyRows(selectedFilm), { page, state } = await setup(t, selectedFilm, rows, width, diagnostics);
      await qualifiedNegative(page, 'rakuten'); await layout(page); await diagnosticsCheck(page, rows, diagnostics);
      await previewApply(page, state, 'rakuten', rows[0].link.href, 'Rakuten TV');
      await qualifiedNegative(page, 'rakuten');
    });
    for (const [width, diagnostics] of [[375, false], [1280, true]]) await t.test(`mixed Apple original offers / ${width}px / ${diagnostics ? 'diagnostic' : 'ordinary Beta'}`, async t => {
      const { page, state } = await setup(t, lostBus, mixedRows, width, diagnostics);
      assert.equal(await page.getByRole('button', { name: 'Apple TV / iTunes', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Apple TV+', exact: true }).count(), 0);
      for (const [row, expected, access] of [
        [plus, ['?', '+'], 'Передплата'], [storeNegative, ['−*', '+'], 'Купівля'], [plusUnknown, ['?', '?'], 'Передплата'], [plus, ['?', '+'], 'Передплата'],
      ]) {
        await selectOriginal(page, 'apple', row.link.href);
        assert.equal(await page.locator('.media-advice-link-select option').count(), 3, 'two distinct subscription pointers and the preferred Store pointer remain available without a new access toggle');
        assert.deepEqual(await tracks(page, 'apple'), expected, 'selected original record never borrows another offer negative, positive or unknown tracks');
        assert.equal(await tableRow(page, 'apple').getAttribute('data-row-id'), row.id);
        await previewApply(page, state, 'apple', row.link.href, 'Apple TV / iTunes', access);
        assert.deepEqual(await tracks(page, 'apple'), expected);
      }
      await layout(page); await diagnosticsCheck(page, mixedRows, diagnostics);
      if (process.env.M4_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/scoped-negative-mixed-apple-${width}.png`, animations: 'disabled' });
      assert.equal(state.discoveries, 1);
    });
    await t.test('Store-only unknown rental retains its preferred original URL and rental preview without a new selector', async t => {
      const href = 'https://itunes.apple.com/ua/movie/id987654?at=AUTHORED%2fRENT#Exact';
      const rental = { ...plusUnknown, id: 'motn:store-rental', provider: { key: 'apple', sourceName: 'Apple TV Store' },
        access: { state: 'reported', value: 'rent' }, link: { href } };
      const { page, state } = await setup(t, lostBus, [rental], 375, false);
      assert.deepEqual(await tracks(page, 'apple'), ['?', '?']);
      assert.equal(await page.locator('.media-advice-link-select').count(), 0);
      await previewApply(page, state, 'apple', href, 'Apple TV / iTunes', 'Оренда');
      assert.deepEqual(await tracks(page, 'apple'), ['?', '?']);
      await layout(page);
    });
    await t.test('positive, unqualified negative, unknown and contradictory data stay distinct', async t => {
      const { page } = await setup(t, shining, stateRows, 1280, false);
      assert.deepEqual(await tracks(page, 'apple'), ['−', '+'], 'a broad explicit source negative is not silently changed to format-only or unknown');
      assert.deepEqual(await tracks(page, 'rakuten'), ['+', '?']);
      assert.deepEqual(await tracks(page, 'netflix'), ['?', '?']);
      assert.deepEqual(await tracks(page, 'megogo'), ['±', '?'], 'a contradiction never becomes an absence claim');
      await compactActions(page); await layout(page);
    });
    console.info('Authored scoped-negative browser controls: source HTTP 0; actual Supabase writes 0; actual platform navigation 0; film-shaped cases are not historical/live source assertions.');
  });
