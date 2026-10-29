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
  for (const mode of ['retained', 'expiry', 'expiry-timer', 'expiry-pending-apply', 'expiry-stale-apply', 'report-age', 'discovery-error', 'pending-revalidation', 'inflight', 'logout', 'user', 'group', 'film', 'list', 'form-session', 'access-revoked', 'access-error']) await t.test(mode, async t => {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } }); t.after(() => page.close());
    const external = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    if (mode === 'expiry-timer' || mode === 'report-age') await page.clock.install();
    await page.evaluate(async mode => {
      const { createMediaAdvice } = await import('/assets/media-advice.mjs');
      window.c = { userId: 'u', groupId: 'g', imdbId: 'tt1234567', formSession: 's',title:'Authored retained film',year:2020 };
      window.clock = 1000; window.allowed = true; window.accessError = false; window.writes = 0; window.calls = 0; window.storageWrites = 0; window.applyChecks = 0; window.discoveryContexts = [];
      Storage.prototype.setItem = () => { storageWrites++; throw Error('No storage'); };
      window.row = { id: 'authored', identityStatus: 'matched',country:'UA', provider: { key: 'apple', name: 'Apple TV Store' }, provenance: { source: 'AUTHORED' }, link: { href: 'https://itunes.apple.com/ua/movie/id123' } };
      window.otherRow = {...row,id:'authored-other',country:'GB',link:{href:'https://itunes.apple.com/gb/movie/id456'}};
      window.control = createMediaAdvice({ document, entry: document.querySelector('#entry'), context: () => c, now: () => clock,
        capability: async () => { if (accessError) throw Error('AUTHORED'); return allowed; },
        validateApply: () => { applyChecks++; return new Promise(r => window.releaseApply = r); },
        renewContext: () => c = { ...c, formSession: 'renewed' },
        discover: async c => { calls++; discoveryContexts.push({...c}); if (mode === 'discovery-error') throw Error('AUTHORED PRIVATE BODY'); if (mode === 'inflight') await new Promise(r => window.releaseDiscovery = r); return { rows: [row,otherRow],film:{title:'Authored retained film',year:2020,imdbId:'tt1234567'} }; },
        readForm: () => ({ recommended_medium: document.querySelector('#medium').value, purchase_url: document.querySelector('#url').value }),
        writeForm: fields => { writes++; document.querySelector('#medium').value = fields.recommended_medium; document.querySelector('#url').value = fields.purchase_url; },
      });
    }, mode);
    await page.locator('#entry').click();
    if (mode === 'discovery-error') {
      await page.waitForFunction(() => control.dialog.textContent.includes('Зараз не вдалося отримати відповідь'));
      assert.equal(await page.locator('.mykola-typing-bubble').count(),0);
      assert.doesNotMatch(await page.locator('.media-advice-chat').innerText(),/AUTHORED PRIVATE BODY/);
      await page.keyboard.press('Escape'); await page.locator('#entry').click();
      assert.equal(await page.evaluate(()=>calls),1,'a failed first attempt is not retried by reopening');
      await page.getByRole('button',{name:'Діагностичний звіт'}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Film: "Authored retained film"; year 2020; IMDb tt1234567/);
      await page.getByRole('button',{name:'← До порад'}).click();
      await page.getByRole('button',{name:'Оновити вручну'}).click();
      await page.waitForFunction(()=>calls===2 && control.dialog.textContent.includes('Зараз не вдалося отримати відповідь'));
      assert.equal(await page.evaluate(()=>writes),0); assert.deepEqual(external,[]);
      await page.evaluate(()=>control.invalidate()); return;
    }
    if (mode === 'inflight') {
      await page.waitForFunction(() => !!window.releaseDiscovery);
      await page.evaluate(async () => { await control.refresh(); releaseDiscovery(); });
    }
    await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    assert.equal(await page.getByRole('button',{name:'Знайти варіанти',exact:true}).count(),0);
    if (mode === 'report-age') {
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copiedReport=text}}));
      await page.getByRole('button',{name:'Діагностичний звіт'}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/within local 30-minute age limit/);
      await page.clock.fastForward(30*60*1000);
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Result freshness: stale/);
      await page.getByRole('button',{name:'Скопіювати короткий звіт'}).click();
      assert.match(await page.evaluate(()=>copiedReport),/Result freshness: stale/);
      await page.getByRole('button',{name:'← До порад'}).click();
      assert.equal(await page.locator('.media-advice-stale').isVisible(),true);
      assert.equal(await page.evaluate(()=>calls),1);
    } else if (mode === 'retained' || mode === 'inflight') {
      await page.evaluate(async () => {
        window.chat = control.dialog.querySelector('.media-advice-chat');
        window.card = chat.querySelector('.media-advice-row');
        window.bubble = chat.querySelector('.mykola-bubble');
        control.dialog.scrollTop = 60; window.topBefore = control.dialog.scrollTop;
        await control.refresh(); await control.refresh();
      });
      assert.deepEqual(await page.evaluate(() => [control.dialog.open, chat.isConnected, bubble.isConnected, card.isConnected,control.dialog.scrollTop === topBefore, calls, writes, storageWrites]), [true, true, true, true,true,1,0,0]);
      await page.evaluate(() => control.dialog.querySelector('.media-advice-report-bubble button').addEventListener('click', () => window.reportTop = control.dialog.scrollTop, {capture:true,once:true}));
      await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
      assert.equal(await page.locator('.media-advice-diagnostics').isVisible(),true);
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Authored retained film/);
      await page.getByRole('button',{name:'← До порад',exact:true}).click();
      await page.waitForFunction(() => control.dialog.scrollTop === reportTop);
      assert.deepEqual(await page.evaluate(()=>[chat.isConnected,bubble.isConnected,card.isConnected,control.dialog.scrollTop===reportTop,calls]),[true,true,true,true,1]);
      await page.keyboard.press('Escape'); await page.evaluate(() => control.refresh());
      assert.equal(await page.evaluate(() => control.dialog.open), false);
      await page.locator('#entry').click();
      await page.waitForFunction(() => control.dialog.open && control.dialog.scrollTop === reportTop);
      assert.equal(await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => card.isConnected), true);
      assert.equal(await page.evaluate(() => control.dialog.scrollTop === reportTop), true);
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
      assert.equal(await page.locator('.media-advice-stale').isVisible(),true);
      assert.equal(await page.locator('.media-advice-row').count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Діагностичний звіт',exact:true }).count(), 1);
      assert.equal(await page.evaluate(() => calls), 1);
      assert.equal(await page.evaluate(()=>writes),0,'expiry revokes pending selection without writing the form');
      await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Authored retained film/);
      await page.getByRole('button',{name:'← До порад',exact:true}).click();
      assert.equal(await page.evaluate(()=>calls),1,'reading a stale report never repeats discovery');
      if(mode==='expiry-stale-apply') {
        await page.getByRole('button',{name:'Обрати',exact:true}).click();
        await page.getByRole('button',{name:'Перенести в картку',exact:true}).click();
        await page.waitForFunction(()=>typeof releaseApply==='function');
        assert.equal(await page.evaluate(()=>applyChecks),1);
        await page.evaluate(()=>releaseApply(true));
        await page.waitForFunction(()=>writes===1);
        assert.equal(await page.evaluate(()=>calls),1,'fresh apply authorization does not fetch sources');
      } else {
        await page.getByRole('button', { name: 'Оновити вручну' }).click();
        await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => calls), 2);
        assert.deepEqual(await page.evaluate(()=>discoveryContexts.map(c=>c.formSession)),['s','renewed']);
      }
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
    assert.equal(await page.evaluate(() => writes), mode==='expiry-stale-apply'?1:0);
    assert.equal(await page.locator('#url').inputValue(), mode==='expiry-stale-apply'?'https://itunes.apple.com/ua/movie/id123':'manual');
    assert.equal(await page.evaluate(() => storageWrites), 0);
    assert.deepEqual(external, []);
    await page.evaluate(() => control.invalidate());
  });
});

