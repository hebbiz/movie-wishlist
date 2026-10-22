import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

test('M4 retained document: revalidation, expiry and context boundaries without discovery replay', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const root = resolve(import.meta.dirname, '..');
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') return res.end('<button id="entry">Entry</button><input id="medium" value="DVD"><input id="url" value="manual"><style>dialog{height:250px;overflow:auto}</style>');
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + (process.platform === 'win32' ? '\\' : '/'))) return res.writeHead(403).end();
    try { res.setHeader('content-type', extname(file) === '.mjs' ? 'text/javascript' : 'text/plain'); res.end(await readFile(file)); } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true }); t.after(() => browser.close());
  for (const mode of ['retained', 'expiry', 'expiry-timer', 'expiry-pending-apply', 'pending-revalidation', 'inflight', 'logout', 'user', 'group', 'film', 'list', 'form-session', 'access-revoked', 'access-error']) await t.test(mode, async t => {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } }); t.after(() => page.close());
    const external = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    if (mode === 'expiry-timer') await page.clock.install();
    await page.evaluate(async mode => {
      const { createMediaAdvice } = await import('/assets/media-advice.mjs');
      window.c = { userId: 'u', groupId: 'g', imdbId: 'tt1234567', formSession: 's' };
      window.clock = 1000; window.allowed = true; window.accessError = false; window.writes = 0; window.calls = 0; window.storageWrites = 0;
      Storage.prototype.setItem = () => { storageWrites++; throw Error('No storage'); };
      window.row = { id: 'authored', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' }, provenance: { source: 'AUTHORED' }, link: { href: 'https://itunes.apple.com/ua/movie/id123' } };
      window.control = createMediaAdvice({ document, entry: document.querySelector('#entry'), context: () => c, now: () => clock,
        capability: async () => { if (accessError) throw Error('AUTHORED'); return allowed; },
        validateApply: () => new Promise(r => window.releaseApply = r),
        renewContext: () => c = { ...c, formSession: 'renewed' },
        discover: async () => { calls++; if (mode === 'inflight') await new Promise(r => window.releaseDiscovery = r); return { rows: [row] }; },
        readForm: () => ({ recommended_medium: document.querySelector('#medium').value, purchase_url: document.querySelector('#url').value }),
        writeForm: fields => { writes++; document.querySelector('#medium').value = fields.recommended_medium; document.querySelector('#url').value = fields.purchase_url; },
      });
    }, mode);
    await page.locator('#entry').click(); await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
    if (mode === 'inflight') {
      await page.waitForFunction(() => !!window.releaseDiscovery);
      await page.evaluate(async () => { await control.refresh(); releaseDiscovery(); });
    }
    await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    if (mode === 'retained' || mode === 'inflight') {
      await page.evaluate(async () => {
        window.detail = control.dialog.querySelector('details'); detail.open = true;
        control.dialog.scrollTop = 60; window.topBefore = control.dialog.scrollTop;
        await control.refresh(); await control.refresh();
      });
      assert.deepEqual(await page.evaluate(() => [control.dialog.open, detail.isConnected, detail.open, control.dialog.scrollTop === topBefore, calls, writes, storageWrites]), [true, true, true, true, 1, 0, 0]);
      await page.keyboard.press('Escape'); await page.evaluate(() => control.refresh());
      assert.equal(await page.evaluate(() => control.dialog.open), false);
      await page.locator('#entry').click();
      assert.equal(await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).isDisabled(), true);
      assert.equal(await page.evaluate(() => detail.isConnected && detail.open), true);
    } else if (mode === 'pending-revalidation') {
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.getByRole('button', { name: 'Перенести в картку' }).click();
      await page.waitForFunction(() => !!window.releaseApply);
      await page.evaluate(async () => { await control.refresh(); releaseApply(true); });
      await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    } else if (mode.startsWith('expiry')) {
      if (mode === 'expiry-pending-apply') {
        await page.getByRole('button', { name: 'Обрати', exact: true }).click();
        await page.getByRole('button', { name: 'Перенести в картку' }).click();
        await page.waitForFunction(() => !!window.releaseApply);
        await page.evaluate(() => { clock += 30 * 60 * 1000; releaseApply(true); });
      } else if (mode === 'expiry-timer') await page.clock.fastForward(30 * 60 * 1000);
      else await page.evaluate(async () => { clock += 30 * 60 * 1000; await control.refresh(); });
      await page.getByRole('button', { name: 'Оновити вручну' }).waitFor();
      assert.equal(await page.locator('.media-advice-row').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Скопіювати короткий звіт' }).count(), 0);
      assert.equal(await page.evaluate(() => calls), 1);
      await page.getByRole('button', { name: 'Оновити вручну' }).click();
      assert.equal(await page.evaluate(() => calls), 1);
      await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).click();
      await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => calls), 2);
    } else {
      await page.evaluate(async mode => {
        if (mode === 'logout') { c = null; control.invalidate(); }
        if (mode === 'user') c.userId = 'other';
        if (mode === 'group') c.groupId = 'other';
        if (mode === 'film') c.imdbId = 'tt7654321';
        if (mode === 'list') c.listId = 'other';
        if (mode === 'form-session') c.formSession = 'other';
        if (mode === 'access-revoked') allowed = false;
        if (mode === 'access-error') accessError = true;
        await control.refresh();
      }, mode);
      assert.equal(await page.evaluate(() => control.dialog.open), false);
      assert.equal(await page.locator('.media-advice-row').count(), 0);
      assert.equal(await page.evaluate(() => calls), 1);
    }
    assert.equal(await page.evaluate(() => writes), 0);
    assert.equal(await page.locator('#url').inputValue(), 'manual');
    assert.equal(await page.evaluate(() => storageWrites), 0);
    assert.deepEqual(external, []);
    await page.evaluate(() => control.invalidate());
  });
});
