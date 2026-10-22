import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';

test('real form isolated advice: desktop/iPhone X/Air, default off, apply/cancel/stale/partial', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const root = resolve(import.meta.dirname, '..');
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      const file = resolve(root, '.' + path);
      if (!file.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw Error();
      res.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(file)] ?? 'text/plain');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true }); t.after(() => browser.close());
  for (const [width, height] of [[1280, 900], [375, 812], [820, 1180]]) await t.test(`${width}x${height}`, async t => {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' }); t.after(() => context.close());
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('AUTHORED denied'); } } }));
    let allowed = false, calls = [], resolveDiscover;
    t.after(() => { resolveDiscover?.(); resolveDiscover = null; });
    const authored = { rows: [{ id: 'motn:1', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' }, country: 'UA', access: { state: 'reported', value: 'rental' }, provenance: { source: 'AUTHORED' }, link: { href: 'https://itunes.apple.com/ua/movie/id123?at=&x=%2F' } }], sources: [{ source: 'TMDb', status: 'partial', identity: 'matched' }], unmapped: [{ name: 'Plex', source: 'TMDb' }] };
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: `window.authoredDBWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:fn=>{window.authoredAuthEvent=fn;}},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:{role:'owner'}})};return q;},update:fields=>{window.authoredDBWrites.push({name,fields});return{eq:async()=>({error:{message:'AUTHORED stop before ordinary save completion'}})}}})})}` });
      if (u.origin !== origin) return route.abort();
      if (u.pathname === '/.netlify/functions/media-advice') {
        const body = route.request().postDataJSON(); calls.push(body);
        if (body.action === 'capability') return route.fulfill({ json: { mykola_media_advice: allowed } });
        if (resolveDiscover) await new Promise(r => resolveDiscover = r);
        return route.fulfill({ json: { result: authored } });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('dialog', d => d.accept()); await page.goto(origin + '/app.html');
    await page.waitForFunction(() => !!mediaAdviceController);
    await page.evaluate(() => {
      document.getElementById('appLoader').style.display = 'none';
      mainView.style.display = 'block';
      currentUser = { id: 'user' }; currentRole = 'owner'; currentGroupId = 'group'; window.authoredLogin = true;
      movies = [{ id: 'list', imdb_url: 'https://imdb.com/title/tt1234567', title: 'Authored film', year: 2020, status: 'wishlist', recommended_medium: 'DVD', purchase_url: 'https://old.example', added_by: 'Owner' }];
      startEditMovie('list'); mykolaChat.textContent = 'SOCIAL HISTORY'; activeAdviceRoom = { id: 'KEEP' };
    });
    assert.equal(await page.locator('#mediaAdviceEntry').isHidden(), true);
    allowed = true; await page.evaluate(() => mediaAdviceController.refresh());
    await page.locator('#mediaAdviceEntry').click(); await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
    await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    // Real re-init path, with non-M4 data loaders isolated: unchanged auth
    // handler -> unchanged initApp -> actual loadCurrentRole -> M4 access refresh.
    await page.evaluate(() => {
      const dialog = mediaAdviceController.dialog;
      window.authoredDetail = dialog.querySelector('details'); authoredDetail.open = true;
      dialog.scrollTop = 120; window.authoredScroll = dialog.scrollTop;
      window.authoredLoaders = {}; window.authoredInitCalls = 0;
      for (const name of ['updateAuthUI', 'ensureUserMembership', 'loadCurrentUserGroups', 'loadCurrentGroup', 'renderCurrentGroupInfo', 'loadMovies']) {
        authoredLoaders[name] = window[name]; window[name] = async () => { if (name === 'loadMovies') authoredInitCalls++; };
      }
      authoredAuthEvent('TOKEN_REFRESHED', { user: { id: 'user' } });
    });
    await page.waitForFunction(() => !document.querySelector('#appLoader') || document.querySelector('#appLoader').style.display === 'none');
    await page.evaluate(async () => { await mediaAdviceController.refresh(); Object.assign(window, authoredLoaders); });
    assert.equal(await page.evaluate(() => authoredInitCalls), 1);
    assert.deepEqual(await page.evaluate(() => [mediaAdviceController.dialog.open, authoredDetail.isConnected, authoredDetail.open, mediaAdviceController.dialog.scrollTop === authoredScroll]), [true, true, true, true]);
    assert.equal(calls.filter(c => c.action === 'discover').length, 1);
    if (process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/authored-${width}.png` });
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    assert.match(await page.locator('.media-advice-dialog').innerText(), /підтвердження/);
    await page.locator('.media-advice-row input').check(); await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.getByRole('button', { name: 'Скасувати вибір' }).click();
    await page.locator('.media-advice-row input').check(); await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => !document.querySelector('.media-advice-dialog').open);
    assert.equal(await page.locator('#recommended_medium').inputValue(), 'Apple TV / iTunes');
    assert.equal(await page.locator('#purchase_url').inputValue(), authored.rows[0].link.href);
    assert.deepEqual(await page.evaluate(() => [document.querySelector('#title').value, document.querySelector('#status').value, document.querySelector('#owned_medium').value, activeAdviceRoom.id, mykolaChat.textContent]), ['Authored film', 'wishlist', '', 'KEEP', 'SOCIAL HISTORY']);
    assert.equal(calls.filter(c => c.action === 'discover').length, 1);
    await page.locator('#purchase_url').fill('https://manual.example/');
    await page.locator('#mediaAdviceEntry').click(); assert.equal(await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '← До картки' }).click(); assert.equal(await page.locator('#purchase_url').inputValue(), 'https://manual.example/');
    await page.evaluate(() => mediaAdviceController.refresh());
    assert.equal(await page.evaluate(() => mediaAdviceController.dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mediaAdviceEntry');
    await page.locator('#mediaAdviceEntry').click();
    await page.getByRole('button', { name: 'Скопіювати короткий звіт' }).click();
    const report = await page.getByLabel('Короткий звіт для копіювання').inputValue();
    assert.doesNotMatch(report, /https?:|manual.example|AUTHORED|at=/);
    await page.getByRole('button', { name: '← До картки' }).click();
    // A new form session revokes a held response, without refund or retry.
    await page.evaluate(() => startEditMovie('list'));
    resolveDiscover = () => {};
    await page.locator('#mediaAdviceEntry').click(); await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.media-advice-dialog').textContent.includes('Шукаю варіанти'));
    while (calls.filter(c => c.action === 'discover').length < 2) await new Promise(r => setTimeout(r, 10));
    await page.evaluate(() => resetFormMode()); resolveDiscover(); resolveDiscover = null;
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.media-advice-row').count(), 0);
    // Missing link needs an explicit clear, and manual edits invalidate a preview.
    authored.rows[0].link.href = null;
    await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click();
    await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click(); await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => document.querySelector('.media-advice-dialog').textContent.includes('очищення не підтверджено'));
    assert.match(await page.locator('.media-advice-dialog').innerText(), /очищення не підтверджено/);
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.locator('.media-advice-preview input').check();
    await page.evaluate(() => document.getElementById('purchase_url').value = 'https://new-manual.example/');
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => document.querySelector('.media-advice-dialog').textContent.includes('Поля змінилися'));
    assert.match(await page.locator('.media-advice-dialog').innerText(), /Поля змінилися/);
    await page.getByRole('button', { name: 'Обрати', exact: true }).click(); await page.locator('.media-advice-preview input').check();
    await page.getByRole('button', { name: 'Перенести в картку' }).click(); await page.waitForFunction(() => !document.querySelector('.media-advice-dialog').open);
    assert.equal(await page.locator('#purchase_url').inputValue(), '');
    // Revoked feature access suppresses transfer, while normal form fields stay editable.
    await page.locator('#mediaAdviceEntry').click(); await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    allowed = false; await page.getByRole('button', { name: 'Перенести в картку' }).click(); await page.waitForFunction(() => !document.querySelector('.media-advice-dialog').open);
    assert.equal(await page.locator('#mediaAdviceEntry').isHidden(), true);
    assert.equal(await page.locator('#purchase_url').isEditable(), true);
    assert.equal(await page.evaluate(() => window.authoredDBWrites.length), 0);
    await page.locator('#submitButton').click();
    await page.waitForFunction(() => window.authoredDBWrites.length === 1);
    assert.equal(await page.evaluate(() => window.authoredDBWrites[0].name), 'movie_group_lists');
    if (width === 1280) {
      allowed = true;
      for (const kind of ['no-results', 'identity-refusal', 'unbound-localization', 'conflicting-properties', 'several']) {
        authored.rows = kind === 'no-results' || kind === 'identity-refusal' ? [] : [{
          id: 'kinobaza:authored', identityStatus: 'matched', kind: 'candidate-link', country: null,
          provider: { key: 'apple', name: 'Apple TV Store' }, provenance: { source: 'Kinobaza HTML' }, link: { href: 'https://itunes.apple.com/ua/movie/id123' },
          kinobazaLocalization: { audio: { state: 'reported-positive' }, subtitles: { state: 'reported-negative' } },
          conflicts: kind === 'conflicting-properties' ? [{ field: 'audio', type: 'conflicting-block-labels' }] : [],
        }];
        authored.sources = [{ source: 'kinobaza', status: kind === 'identity-refusal' ? 'identity-unresolved' : 'partial', identity: kind === 'identity-refusal' ? 'unresolved' : 'matched' }];
        if (kind === 'several') authored.rows.push({ ...authored.rows[0], id: 'motn:independent', provider: { key: 'prime', name: 'Prime Video' }, kinobazaLocalization: undefined, link: { href: 'https://www.primevideo.com/detail/AUTHORED/' }, provenance: { source: 'Movie of the Night' } });
        await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click(); await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.media-advice-dialog').textContent.includes('Результати джерел'));
        assert.equal(await page.locator('.media-advice-row').count(), authored.rows.length);
        if (kind === 'unbound-localization') assert.match(await page.locator('.media-advice-dialog').innerText(), /для конкретної пропозиції ще не перевірено/);
        if (kind === 'no-results' || kind === 'identity-refusal') assert.match(await page.locator('.media-advice-dialog').innerText(), /не означає, що фільм недоступний/);
        if (kind === 'conflicting-properties') {
          assert.match(await page.locator('.media-advice-dialog').innerText(), /Суперечливі дані джерела/);
          await page.locator('.media-advice-row summary').click();
          assert.match(await page.locator('.media-advice-row pre').innerText(), /conflicting-block-labels/);
        }
        await page.getByRole('button', { name: '← До картки' }).click();
      }
      // Multiple already-matched cards: selecting a card renders separate original
      // rows without network or silent form enrichment.
      authored.rows = [];
      authored.cardChoices = [1,2].map(i => ({ id: 'card-' + i, sourceURL: 'https://kinobazaua.com/titles/authored-' + i, status:'ok', rows:[{
        id:'card-' + i + ':kinobaza:0', identityStatus:'matched', provider:{key:'apple',name:'Apple TV Store'}, provenance:{source:'Kinobaza HTML'}, link:{href:'https://itunes.apple.com/ua/movie/id' + (123 + i)},
      }], unmapped:[] }));
      await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click(); await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
      await page.getByRole('button', { name: 'Використати підтверджену картку card-1' }).waitFor();
      const beforeChoice = calls.filter(c => c.action === 'discover').length;
      await page.getByRole('button', { name: 'Використати підтверджену картку card-1' }).click();
      assert.equal(await page.locator('.media-advice-row').count(), 1);
      await page.getByRole('button', { name: 'Використати підтверджену картку card-2' }).click();
      assert.equal(await page.locator('.media-advice-row').count(), 1);
      assert.equal(calls.filter(c => c.action === 'discover').length, beforeChoice);
      assert.equal(await page.locator('#purchase_url').inputValue(), 'https://old.example');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
      await page.getByRole('button', { name: 'Скопіювати короткий звіт' }).click();
      await page.getByLabel('Короткий звіт для копіювання').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('mediaAdvice')), null);
      await page.getByRole('button', { name: '← До картки' }).click();
    }
    await page.evaluate(() => resetFormMode()); assert.equal(await page.locator('.media-advice-dialog').isVisible(), false);
    await page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }); startEditMovie('list'); });
    assert.equal(await page.locator('#mediaAdviceEntry').isHidden(), true);
    assert.equal(await page.locator('#purchase_url').isEditable(), true); // unsupported capability environment must not break editing
    assert.equal(await page.evaluate(() => document.querySelector('#mediaAdviceEntry').type), 'button');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
