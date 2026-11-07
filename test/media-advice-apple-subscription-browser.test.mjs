import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Opt-in real browser against app.html, authored source rows and an entirely
// local Save interceptor. No provider/source/API/Supabase request is allowed.
test('Apple TV+ real app form: accessible mobile/wide comparison, explicit preview/apply and ordinary local-only Save capture', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
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
  const filmId = 'imdb:tt21103218', href = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored?at=Exact%2fValue#Anchor';
  const plus = { id: 'kinobaza:plus', filmId, identityStatus: 'matched', country: null, provider: { key: 'appletvplus', sourceName: 'Apple TV+' },
    access: { state: 'reported', value: 'subscription' }, audio: { state: 'unknown' }, subtitles: { state: 'unknown' }, conflicts: [],
    provenance: { source: 'Kinobaza HTML' }, link: { href }, linkAudit: { blockAssociation: 'associated' },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: 'Apple TV+', href, territory: null, issues: [], audio: { state: 'unknown', evidence: [] },
      subtitles: { state: 'reported-positive', language: 'uk', evidence: [{ label: 'укр. субтитри', literal: 'укр. субтитри', state: 'positive' }] } } };
  const store = { id: 'tmdb:store', filmId, identityStatus: 'matched', country: 'UA', provider: { key: 'apple', sourceName: 'Apple TV Store' },
    access: { state: 'reported', value: 'buy' }, audio: { state: 'unknown' }, subtitles: { state: 'unknown' }, conflicts: [],
    provenance: { source: 'TMDb / JustWatch' }, link: { href: 'https://itunes.apple.com/ua/movie/id123?at=Store%2fOnly' } };
  const result = { film: { id: filmId, imdbId: 'tt21103218', title: 'The Lost Bus', year: 2025 }, rows: [plus, store],
    sources: [{ source: 'kinobaza', status: 'ok', identity: 'matched' }], unmapped: [{ name: 'Plex', source: 'tmdb' }, { name: 'Plex', source: 'motn' }],
    capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: false } };
  for (const [width, height] of [[375, 812], [420, 912], [820, 1180], [1280, 900]]) await t.test(`${width}x${height}`, async t => {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' }); t.after(() => context.close());
    let discoveries = 0; const blockedRemote = [];
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: `window.authoredDBWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:fn=>{window.authoredAuthEvent=fn;}},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:{role:'owner'}})};return q;},insert:fields=>{window.authoredDBWrites.push({name,fields,operation:'insert'});return{error:{message:'AUTHORED stop before ordinary save completion'}}},update:fields=>{window.authoredDBWrites.push({name,fields,operation:'update'});return{eq:async()=>({error:{message:'AUTHORED stop before ordinary save completion'}})}}})})}` });
      if (u.origin !== origin) { blockedRemote.push(u.hostname); return route.abort(); }
      if (u.pathname === '/.netlify/functions/media-advice') {
        if (route.request().postDataJSON().action === 'capability') return route.fulfill({ json: result.capabilities });
        discoveries++; return route.fulfill({ json: { result } });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
    await page.goto(origin + '/app.html');
    await page.waitForFunction(() => !!mediaAdviceController);
    await page.evaluate(() => {
      document.getElementById('appLoader').style.display = 'none'; mainView.style.display = 'block';
      currentUser = { id: 'user' }; currentRole = 'owner'; currentGroupId = 'group'; window.authoredLogin = true;
      window.authoredOpened = []; window.open = (...args) => { authoredOpened.push(args); return null; };
      movies = [{ id: 'list', imdb_url: 'https://imdb.com/title/tt21103218', title: 'The Lost Bus', year: 2025, status: 'wishlist', recommended_medium: 'DVD', purchase_url: '', added_by: 'Authored' }];
      startEditMovie('list'); mykolaChat.textContent = 'SOCIAL HISTORY'; activeAdviceRoom = { id: 'KEEP' };
    });
    await page.locator('#mediaAdviceEntry').click();
    await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-provider-icon')].every(image => image.complete && image.naturalWidth > 0));
    const choice = page.getByRole('button', { name: 'Apple TV+', exact: true });
    assert.equal(await choice.count(), 1);
    await choice.focus(); await page.keyboard.press('Enter');
    assert.equal(await choice.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Apple TV / iTunes', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await page.locator('[data-provider-key="appletvplus"] td').allTextContents(), ['◐', '?', '+']);
    assert.deepEqual(await page.locator('[data-provider-key="apple"] td').allTextContents(), ['●', '?', '?']);
    assert.match(await page.locator('.media-advice-actions').innerText(), /Тип доступу: Передплата/);
    assert.equal(await page.locator('.media-advice-other').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Діагностичний звіт' }).count(), 0);
    assert.equal(await page.locator('.media-advice-link-select').count(), 0);
    const geometry = await page.locator('.media-advice-comparison').evaluate(table => {
      const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, center: r.x + r.width / 2, width: r.width, height: r.height }; };
      return { headers: [...table.querySelectorAll('thead th')].map(rect), rows: [...table.querySelectorAll('tbody tr')].map(row => ({
        cells: [...row.children].map(rect), button: rect(row.querySelector('button')), slot: rect(row.querySelector('.media-advice-icon-slot')),
        plus: row.dataset.providerKey === 'appletvplus' ? rect(row.querySelector('.media-advice-icon-slot > span')) : null,
        name: rect(row.querySelector('.media-advice-service-name')), label: row.querySelector('button').getAttribute('aria-label') })) };
    });
    const steps = geometry.headers.slice(1).map((h, i) => h.center - geometry.headers[i].center);
    assert.ok(Math.max(...steps) - Math.min(...steps) < 1);
    for (const row of geometry.rows) {
      assert.ok(row.button.width >= 44 && row.button.height >= 44);
      assert.ok(row.slot.x >= row.cells[0].x && row.slot.right <= row.cells[0].right);
      for (const [i, cell] of row.cells.entries()) assert.ok(Math.abs(cell.center - geometry.headers[i].center) < 1);
      if (row.plus) assert.ok(row.plus.x >= row.slot.x && row.plus.right <= row.slot.right, 'visible plus stays inside its service emblem slot');
      assert.equal(row.name.width <= 1, width <= 480, 'loaded names are visually hidden only on mobile');
    }
    assert.equal(await page.locator('.media-advice-dialog').evaluate(e => e.scrollWidth <= e.clientWidth), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/apple-subscription-${width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    assert.match(await page.locator('.media-advice-preview').innerText(), /→ Apple TV\+/);
    assert.match(await page.locator('.media-advice-preview').innerText(), /Тип доступу: Передплата/);
    await page.getByText('Повні адреси', { exact: true }).click();
    assert.ok((await page.locator('.media-advice-preview').innerText()).includes(href));
    assert.equal(await page.evaluate(() => authoredDBWrites.length), 0);
    await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
    await page.waitForFunction(() => !mediaAdviceController.dialog.open);
    assert.equal(await page.locator('#recommended_medium').inputValue(), 'Apple TV+');
    assert.equal(await page.locator('#purchase_url').inputValue(), href);
    assert.deepEqual(await page.evaluate(() => [document.querySelector('#status').value, document.querySelector('#owned_medium').value, activeAdviceRoom.id, mykolaChat.textContent]), ['wishlist', '', 'KEEP', 'SOCIAL HISTORY']);
    assert.equal(await page.evaluate(() => authoredDBWrites.length), 0, 'apply changes only form fields, never Save');
    await page.locator('#mediaAdviceEntry').click();
    assert.equal(discoveries, 1);
    await page.locator('[data-provider-key="appletvplus"] img').evaluate(image => image.dispatchEvent(new Event('error')));
    assert.equal(await choice.getAttribute('data-icon-state'), 'failed');
    assert.equal(await choice.locator('.media-advice-service-name').isVisible(), true);
    assert.equal(await choice.getAttribute('aria-label'), 'Apple TV+');
    assert.equal(await page.locator('.media-advice-dialog').evaluate(e => e.scrollWidth <= e.clientWidth), true);
    if (width === 375 && process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/apple-subscription-fallback-${width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '← До картки', exact: true }).click();
    await page.locator('#submitButton').click();
    await page.waitForFunction(() => authoredDBWrites.length === 1);
    const saved = await page.evaluate(() => authoredDBWrites[0]);
    assert.equal(saved.name, 'movie_group_lists'); assert.equal(saved.operation, 'update');
    assert.equal(saved.fields.recommended_medium, 'Apple TV+'); assert.equal(saved.fields.purchase_url, href);
    await page.evaluate(saved => fillForm({ title: 'The Lost Bus', year: 2025, ...saved }), saved.fields);
    assert.equal(await page.locator('#recommended_medium').inputValue(), 'Apple TV+');
    assert.equal(await page.locator('#purchase_url').inputValue(), href);
    assert.deepEqual(await page.evaluate(() => authoredOpened), [], 'no real or mocked platform transition was invoked');
    assert.equal(discoveries, 1);
    console.info(`Apple subscription browser ${JSON.stringify({ viewport: width, centers: geometry.headers.map(h => h.center), steps, localOnlySavePayloadCaptured: true, sourceHTTP: 0, supabaseHTTP: 0, abortedRemoteHosts: [...new Set(blockedRemote)] })}`);
  });
});
