import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

test('pending authorization cannot apply a revoked selection token', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const root = resolve(import.meta.dirname, '..');
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') return res.end('<button id="entry">Entry</button><input id="medium" value="DVD"><input id="url" value="https://old.example/"><div id="other">OTHER CHAT</div>');
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + (process.platform === 'win32' ? '\\' : '/'))) return res.writeHead(403).end();
    try { res.setHeader('content-type', extname(file) === '.mjs' ? 'text/javascript' : 'text/plain'); res.end(await readFile(file)); } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  t.after(() => browser.close());
  for (const mode of ['cancel', 'escape', 'close', 'new-selection', 'variant-change', 'form-edit', 'apply']) await t.test(mode, async t => {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } }); t.after(() => page.close());
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      const { createMediaAdvice } = await import('/assets/media-advice.mjs');
      const row = { id: 'authored', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' }, link: { href: 'https://itunes.apple.com/ua/movie/id123' } };
      const other = {...row,id:'authored-tracking',link:{href:'https://itunes.apple.com/ua/movie/id456?at=AUTHOR%2fONLY'}};
      window.writes = 0; window.sourceCalls = 0;
      window.control = createMediaAdvice({ document, entry: document.querySelector('#entry'),
        context: () => ({ userId: 'u', groupId: 'g', imdbId: 'tt1234567', formSession: 's' }), capability: async () => true,
        validateApply: () => new Promise(r => window.releaseApply = r),
        discover: async () => { window.sourceCalls++; return { rows: [row,other] }; },
        readForm: () => ({ recommended_medium: document.querySelector('#medium').value, purchase_url: document.querySelector('#url').value }),
        writeForm: fields => { window.writes++; document.querySelector('#medium').value = fields.recommended_medium; document.querySelector('#url').value = fields.purchase_url; },
      });
    });
    await page.locator('#entry').click();
    await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    assert.equal(await page.locator('.media-advice-row').count(),1);
    assert.equal(await page.locator('.media-advice-variant-select option').count(),2);
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => typeof releaseApply === 'function');
    if (mode === 'cancel' || mode === 'new-selection' || mode==='variant-change') await page.getByRole('button', { name: 'Скасувати вибір' }).click();
    if (mode === 'escape') await page.keyboard.press('Escape');
    if (mode === 'close') await page.evaluate(() => control.dialog.close());
    if (mode === 'new-selection') await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    if (mode === 'variant-change') {
      const variants=page.locator('.media-advice-variant-select');
      await page.evaluate(()=>window.retainedCard=document.querySelector('.media-advice-row'));
      await variants.selectOption('authored-tracking');
      assert.equal(await page.locator('.media-advice-row input[type=checkbox]').isChecked(),false);
      await page.locator('.media-advice-row input[type=checkbox]').check();
      await variants.selectOption('authored');
      assert.equal(await page.locator('.media-advice-row input[type=checkbox]').count(),0);
      await variants.selectOption('authored-tracking');
      assert.equal(await page.locator('.media-advice-row input[type=checkbox]').isChecked(),false,'acknowledgement is scoped to the selected original variant');
      assert.equal(await page.evaluate(()=>retainedCard===document.querySelector('.media-advice-row')),true);
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      assert.equal(await page.locator('.media-advice-preview').count(),0);
      await page.locator('.media-advice-row input[type=checkbox]').check();
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      assert.match(await page.locator('.media-advice-preview').innerText(),/id456\?at=AUTHOR%2fONLY/);
    }
    if (mode === 'form-edit') await page.evaluate(() => document.querySelector('#url').value = 'https://manual.example/');
    await page.evaluate(async () => { releaseApply(true); await new Promise(r => setTimeout(r, 0)); });
    if(mode==='variant-change') {
      assert.equal(await page.evaluate(()=>writes),0,'the previous variant authorization cannot apply the new selection');
      await page.evaluate(()=>window.releasedOldApply=releaseApply);
      await page.getByRole('button',{name:'Перенести в картку',exact:true}).click();
      await page.waitForFunction(()=>releaseApply!==releasedOldApply);
      await page.evaluate(()=>releaseApply(true));
      await page.waitForFunction(()=>writes===1);
    }
    const applied=mode==='apply'||mode==='variant-change';
    assert.equal(await page.evaluate(() => writes), applied ? 1 : 0);
    assert.equal(await page.locator('#medium').inputValue(), applied ? 'Apple TV / iTunes' : 'DVD');
    assert.equal(await page.locator('#url').inputValue(), mode==='variant-change'?'https://itunes.apple.com/ua/movie/id456?at=AUTHOR%2fONLY':mode === 'apply' ? 'https://itunes.apple.com/ua/movie/id123' : mode === 'form-edit' ? 'https://manual.example/' : 'https://old.example/');
    assert.equal(await page.evaluate(() => sourceCalls), 1);
    assert.equal(await page.locator('#other').textContent(), 'OTHER CHAT');
  });
});
