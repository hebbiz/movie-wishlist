import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';

// Authored navigation/evidence fixtures, NOT the three historical Lost Bus
// addresses or independent claims about any platform's availability. Browser
// requests stay local; source APIs, Supabase and platform navigation are blocked.
const wrapper = (target, cx) => `https://click.justwatch.com/a?cx=${cx}&r=${encodeURIComponent(target)}&uct_country=ua`;
const film = { id: 'imdb:tt21103218', imdbId: 'tt21103218', title: 'The Lost Bus', year: 2025 };
const appleCard = 'https://tv.apple.com/ua/movie/%D0%B0%D0%B2%D1%82%D0%BE%D0%B1%D1%83%D1%81/umc.cmc.authoredlostbus';
const captionHref = wrapper(`${appleCard}?at=AUTHORED%2fCAPTION&ct=CAPTION`, 'AUTHORED-CAPTION');
const regionalHref = wrapper(`${appleCard}?at=AUTHORED%2fREGIONAL&ct=REGIONAL`, 'AUTHORED-REGIONAL');
const motnHref = `${appleCard}?offer=unknown&at=AUTHORED%2fMOTN`;
const storeHref = 'https://itunes.apple.com/ua/movie/id900123?at=AUTHORED%2fSTORE';
const unknown = () => ({ state: 'unknown' });
function sourceRow(id, provider, href, extra = {}) {
  return { id, filmId: film.id, identityStatus: 'matched', country: 'UA', provider: { key: provider, sourceName: provider },
    access: { state: 'reported', value: 'subscription' }, audio: unknown(), subtitles: unknown(), conflicts: [],
    provenance: { source: 'Movie of the Night' }, link: { href }, ...extra };
}
const plusCaption = sourceRow('kinobaza:plus-caption', 'appletvplus', captionHref, {
  country: null, provider: { key: 'appletvplus', sourceName: 'Apple TV+' }, provenance: { source: 'Kinobaza HTML' },
  linkAudit: { blockAssociation: 'associated' },
  kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: 'Apple TV+', href: captionHref, territory: null, issues: [],
    audio: { state: 'unknown', evidence: [] }, subtitles: { state: 'reported-positive', language: 'uk',
      evidence: [{ label: 'укр. субтитри', literal: 'укр. субтитри', state: 'positive' }] } },
});
const plusRegional = sourceRow('kinobaza:plus-regional', 'appletvplus', regionalHref, { provenance: { source: 'Kinobaza HTML' } });
const plusMotn = sourceRow('motn:plus-unknown-qualifier', 'appletvplus', motnHref);
const store = sourceRow('tmdb:store-buy', 'apple', storeHref, { provider: { key: 'apple', sourceName: 'Apple TV Store' },
  access: { state: 'reported', value: 'buy' }, provenance: { source: 'TMDb / JustWatch' } });
const otherTargets = {
  netflix: ['https://www.netflix.com/ua/title/900111', 'https://www.netflix.com/ua/title/900112'],
  megogo: ['https://megogo.net/ua/view/900211-authored.html', 'https://megogo.net/ua/view/900212-authored.html'],
  prime: ['https://www.primevideo.com/detail/AUTHORED301', 'https://www.primevideo.com/detail/AUTHORED302'],
};
const otherRows = Object.entries(otherTargets).flatMap(([provider, targets]) => [
  sourceRow(`${provider}:same-one`, provider, wrapper(targets[0], 'AUTHORED-ONE')),
  sourceRow(`${provider}:same-two`, provider, wrapper(targets[0], 'AUTHORED-TWO')),
  sourceRow(`${provider}:different-card`, provider, targets[1]),
]);
const rows = [plusMotn, plusRegional, plusCaption, store, ...otherRows];
const rawResult = { film, rows, sources: [{ source: 'kinobaza', status: 'ok', identity: 'matched' }], unmapped: [] };
const rowSnapshot = JSON.stringify(rows);

const sdkStub = `window.authoredDBWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:fn=>{window.authoredAuthEvent=fn;}},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:{role:'owner'}})};return q;},insert:fields=>{window.authoredDBWrites.push({name,fields});throw Error('AUTHORED Save forbidden');},update:fields=>{window.authoredDBWrites.push({name,fields});throw Error('AUTHORED Save forbidden');}})})}`;

test('shared established-card navigation: real app Lost Bus-shaped, Store and other services; original offers/URLs are not joined',
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

    async function setup(t, width, result, diagnostics) {
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, serviceWorkers: 'block' });
      t.after(() => context.close());
      const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics };
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
      await page.evaluate(film => {
        document.getElementById('appLoader').style.display = 'none'; mainView.style.display = 'block';
        currentUser = { id: 'user' }; currentRole = 'owner'; currentGroupId = 'group'; window.authoredLogin = true;
        window.authoredOpened = []; window.open = (...args) => { authoredOpened.push(args); return null; };
        movies = [{ id: 'list', imdb_url: `https://imdb.com/title/${film.imdbId}`, title: film.title, year: film.year,
          status: 'wishlist', recommended_medium: 'DVD', purchase_url: '', added_by: 'Authored' }];
        startEditMovie('list'); activeAdviceRoom = { id: 'KEEP' }; mykolaChat.textContent = 'UNCHANGED SOCIAL CHAT';
      }, result.film);
      await page.locator('#mediaAdviceEntry').click();
      await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-provider-icon')].every(image => image.complete && image.naturalWidth > 0));
      return { page, state };
    }

    async function pick(page, provider, originalURL) {
      await page.locator(`[data-provider-key="${provider}"] .media-advice-service-select`).click();
      const select = page.locator('.media-advice-link-select');
      const count = await select.count();
      if (!count) {
        assert.equal(await page.locator('.media-advice-actions .media-advice-link-address p').textContent(), originalURL);
        return;
      }
      const options = await select.locator('option').allTextContents();
      assert.equal(new Set(options).size, options.length, 'uncertain distinct choices remain distinguishable, without asserting equivalence');
      for (let index = 0; index < options.length; index++) {
        await page.locator('.media-advice-link-select').selectOption(String(index));
        if (await page.locator('.media-advice-actions .media-advice-link-address p').textContent() === originalURL) return;
      }
      assert.fail(`original representative not selectable: ${originalURL}`);
    }

    async function openPreviewApply(page, state, provider, originalURL, medium) {
      await pick(page, provider, originalURL);
      const previousOpens = await page.evaluate(() => authoredOpened.length);
      await page.getByRole('button', { name: 'Відкрити посилання', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => authoredOpened.at(-1)), [originalURL, '_blank', 'noopener,noreferrer']);
      assert.equal(await page.evaluate(() => authoredOpened.length), previousOpens + 1);
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.getByText('Повні адреси', { exact: true }).click();
      assert.ok((await page.locator('.media-advice-preview').innerText()).includes(originalURL));
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0, 'preview and open never Save');
      await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
      await page.waitForFunction(() => !mediaAdviceController.dialog.open);
      assert.equal(await page.locator('#recommended_medium').inputValue(), medium);
      assert.equal(await page.locator('#purchase_url').inputValue(), originalURL, 'no stripping, decoding, canonicalization or representative substitution');
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0, 'apply updates only local form fields');
      await page.locator('#mediaAdviceEntry').click();
      assert.equal(state.discoveries, 1, 'reopening/changing navigation never repeats discovery');
    }

    for (const width of [375, 1280]) for (const diagnostics of [false, true]) await t.test(`${width}px / ${diagnostics ? 'authorized diagnostics' : 'ordinary Beta'}`, async t => {
      const { page, state } = await setup(t, width, rawResult, diagnostics);
      assert.equal(await page.locator('.media-advice-comparison tbody tr').count(), 4);
      assert.equal(await page.getByRole('button', { name: 'Apple TV / iTunes', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Apple TV+', exact: true }).count(), 0);
      await pick(page, 'apple', captionHref);
      assert.equal(await page.locator('.media-advice-link-select option').count(), 3,
        'three Plus rows make two choices, with the Store product still a third separate choice');
      assert.equal(await page.locator('[data-provider-key="apple"]').getAttribute('data-row-id'), plusCaption.id);
      assert.deepEqual(await page.locator('[data-provider-key="apple"] td').allTextContents(), ['◐', '?', '+']);
      await pick(page, 'apple', motnHref);
      assert.deepEqual(await page.locator('[data-provider-key="apple"] td').allTextContents(), ['●', '?', '?'],
        'an unknown qualifier cannot borrow the Kino representative subtitles');
      await pick(page, 'apple', storeHref);
      assert.deepEqual(await page.locator('[data-provider-key="apple"] td').allTextContents(), ['●', '?', '?']);
      await pick(page, 'apple', captionHref);

      const geometry = await page.locator('.media-advice-comparison').evaluate(table => {
        const bounds = element => { const r = element.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height, center: r.x + r.width / 2 }; };
        return { headers: [...table.querySelectorAll('thead th')].map(bounds), rows: [...table.querySelectorAll('tbody tr')].map(row => ({
          cells: [...row.children].map(bounds), button: bounds(row.querySelector('button')), slot: bounds(row.querySelector('.media-advice-icon-slot')) })) };
      });
      const steps = geometry.headers.slice(1).map((item, index) => item.center - geometry.headers[index].center);
      assert.ok(Math.max(...steps) - Math.min(...steps) < 1, 'four-column rhythm retained');
      for (const row of geometry.rows) {
        assert.ok(row.button.width >= 44 && row.button.height >= 44);
        assert.ok(row.slot.x >= row.cells[0].x && row.slot.right <= row.cells[0].right);
        for (const [index, cell] of row.cells.entries()) assert.ok(Math.abs(cell.center - geometry.headers[index].center) < 1);
      }
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (!diagnostics && process.env.M4_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/link-card-grouping-${width}.png`, animations: 'disabled' });
      if (diagnostics) {
        await page.getByRole('button', { name: 'Діагностичний звіт', exact: true }).click();
        assert.equal(await page.locator('.media-advice-diagnostics pre').count(), rows.length, 'every original source observation survives navigation grouping');
        assert.equal(await page.locator('.media-advice-diagnostic-link').count(), 4, 'both Kino pointers plus uncertain MOTN and Store addresses remain available to authorized user');
        await page.getByRole('button', { name: '← До порад', exact: true }).click();
      } else {
        assert.equal(await page.getByRole('button', { name: 'Діагностичний звіт', exact: true }).count(), 0);
        assert.equal(await page.locator('.media-advice-diagnostics pre, .media-advice-diagnostics textarea').count(), 0);
      }
      for (const [provider, medium] of [['netflix', 'Netflix'], ['megogo', 'Megogo'], ['prime', 'Prime Video']]) {
        await page.locator(`[data-provider-key="${provider}"] .media-advice-service-select`).click();
        assert.equal(await page.locator('.media-advice-link-select option').count(), 2, `${provider}: wrapper cx difference joins only the same admitted declared card; different card remains`);
        await openPreviewApply(page, state, provider, wrapper(otherTargets[provider][0], 'AUTHORED-ONE'), medium);
        await openPreviewApply(page, state, provider, otherTargets[provider][1], medium);
      }
      await openPreviewApply(page, state, 'apple', motnHref, 'Apple TV / iTunes');
      await pick(page, 'apple', motnHref);
      assert.deepEqual(await page.locator('[data-provider-key="apple"] td').allTextContents(), ['●', '?', '?']);
      await openPreviewApply(page, state, 'apple', captionHref, 'Apple TV / iTunes');
      await pick(page, 'apple', captionHref);
      assert.deepEqual(await page.locator('[data-provider-key="apple"] td').allTextContents(), ['◐', '?', '+'], 'original representative/evidence survives repeated switching and reopen');
      await openPreviewApply(page, state, 'apple', storeHref, 'Apple TV / iTunes');
      assert.deepEqual(await page.evaluate(() => [activeAdviceRoom.id, mykolaChat.textContent, authoredDBWrites.length]), ['KEEP', 'UNCHANGED SOCIAL CHAT', 0]);
      assert.equal(state.discoveries, 1);
      console.info(`Authored card grouping browser ${JSON.stringify({ width, diagnostics, originalRows: rows.length, applePlusRaw: 3, applePlusChoices: 2,
        fourColumnSteps: steps, sourceHTTP: 0, supabaseHTTP: 0, actualPlatformNavigation: 0, interceptedExplicitOpens: await page.evaluate(() => authoredOpened.length),
        blockedRemoteHosts: [...new Set(state.blockedRemote)] })}`);
    });

    await t.test('Store-only Mad Max-shaped links retain the established one-choice priority', async t => {
      const storeFilm = { id: 'imdb:tt1392190', imdbId: 'tt1392190', title: 'Mad Max: Fury Road', year: 2015 };
      const tv = 'https://tv.apple.com/ua/movie/authored-mad-max/umc.cmc.authoredmadmax?playableId=tvs.sbd.9001%3A123&at=AUTHORED%2fTOP';
      const top = sourceRow('kinobaza:store-top', 'apple', tv, { filmId: storeFilm.id, country: null, provider: { key: 'apple', sourceName: 'itunes' },
        territoryBasis: 'Outside territory section', provenance: { source: 'Kinobaza HTML' }, linkAudit: { blockAssociation: 'associated' },
        access: { state: 'reported', value: 'buy' }, kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: 'itunes', href: tv, territory: null, issues: [], audio: unknown(), subtitles: unknown() } });
      const ownITunes = { ...top, id: 'kinobaza:store-itunes', link: { href: storeHref }, kinobazaLocalization: { ...top.kinobazaLocalization, href: storeHref } };
      const unrelatedOffer = sourceRow('motn:store-rent', 'apple', `${tv}&offer=rent`, { filmId: storeFilm.id, access: { state: 'reported', value: 'rent' } });
      const { page, state } = await setup(t, 1280, { film: storeFilm, rows: [unrelatedOffer, ownITunes, top], sources: [], unmapped: [] }, false);
      assert.equal(await page.locator('.media-advice-link-select').count(), 0, 'established Store preference is not a rent/buy toggle or a claim of equivalent offers');
      await openPreviewApply(page, state, 'apple', tv, 'Apple TV / iTunes');
      assert.equal(await page.locator('.media-advice-link-select').count(), 0);
    });
    assert.equal(JSON.stringify(rows), rowSnapshot, 'browser projection/grouping did not mutate authored raw observations');
  });
