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
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true }); t.after(() => browser.close());
  for (const [width, height] of [[1280, 900], [375, 812], [820, 1180]]) await t.test(`${width}x${height}`, async t => {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' }); t.after(() => context.close());
    let allowed = false, calls = [], resolveDiscover;
    const authored = { rows: [{ id: 'motn:1', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' }, country: 'UA', access: { state: 'reported', value: 'rental' }, provenance: { source: 'AUTHORED' }, link: { href: 'https://itunes.apple.com/ua/movie/id123?at=&x=%2F' } }], sources: [{ source: 'TMDb', status: 'partial', identity: 'matched' }], unmapped: [{ name: 'Plex', source: 'TMDb' }] };
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:()=>{}},from:()=>{throw Error('No DB operation allowed')}})}` });
      if (u.origin !== origin) return route.abort();
      if (u.pathname === '/.netlify/functions/media-advice') {
        const body = route.request().postDataJSON(); calls.push(body);
        if (body.action === 'capability') return route.fulfill({ json: { mykola_media_advice: allowed } });
        if (resolveDiscover) await new Promise(r => resolveDiscover = r);
        return route.fulfill({ json: { result: authored } });
      }
      return route.continue();
    });
    const page = await context.newPage(); await page.goto(origin + '/app.html');
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
    await page.evaluate(() => resetFormMode()); assert.equal(await page.locator('.media-advice-dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => document.querySelector('#mediaAdviceEntry').type), 'button');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
