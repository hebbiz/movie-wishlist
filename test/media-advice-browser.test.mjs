import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';
import { authoredGroupedMediaRows, authoredDuneMediaResult } from './media-advice-group.fixture.mjs';

test('real form Mykola dialog: desktop/iPhone X/Air, one automatic discovery, isolated transfer and report', { skip: !process.env.PLAYWRIGHT_MODULE_PATH }, async t => {
  const root = resolve(import.meta.dirname, '..');
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      const file = resolve(root, '.' + path);
      if (!file.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw Error();
      res.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[extname(file)] ?? 'text/plain');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true }); t.after(() => browser.close());
  for (const [width, height] of [[1280, 900], [375, 812], [420, 912], [820, 1180]]) await t.test(`${width}x${height}`, async t => {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' }); t.after(() => context.close());
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('AUTHORED denied'); } } });
      window.authoredOpened=[];window.open=(...args)=>{authoredOpened.push(args);return null;};
    });
    let allowed = false, calls = [], resolveDiscover;
    t.after(() => { resolveDiscover?.(); resolveDiscover = null; });
    const trackingURL='https://itunes.apple.com/ua/movie/id123?at=&x=%2F&campaign='+ 'AUTHORED-long-original-pointer%2f'.repeat(24);
    const authored = { film: { title:'Authored film', originalTitle:'Authored original', year:2020, imdbId:'tt1234567' }, rows: [{ id: 'motn:1', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' }, country: 'UA', access: { state: 'reported', value: 'rental' }, provenance: { source: 'AUTHORED' }, link: { href: trackingURL } }], sources: [{ source: 'tmdb', status: 'partial', identity: 'matched' }], unmapped: [{ name: 'Plex', source: 'tmdb' }], metrics:{ requestsMade:4, requestBudget:8, ledgerReservations:4 } };
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: `window.authoredDBWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:'user'}}:null}}),onAuthStateChange:fn=>{window.authoredAuthEvent=fn;}},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:{role:'owner'}})};return q;},insert:fields=>{window.authoredDBWrites.push({name,fields,operation:'insert'});return{error:{message:'AUTHORED stop before ordinary save completion'}}},update:fields=>{window.authoredDBWrites.push({name,fields,operation:'update'});return{eq:async()=>({error:{message:'AUTHORED stop before ordinary save completion'}})}}})})}` });
      if (u.origin !== origin) return route.abort();
      if (u.pathname === '/.netlify/functions/movie-lookup') return route.fulfill({json:{title:'Authored added film',year:2024,poster_url:null,overview:null}});
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
    await page.locator('#mediaAdviceEntry').click();
    await page.getByRole('button', { name: 'Обрати', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', {name:'Знайти варіанти',exact:true}).count(),0);
    assert.ok(await page.locator('.media-advice-chat .mykola-message-row .mykola-avatar').count()>0);
    assert.ok(await page.locator('.media-advice-chat .mykola-bubble').count()>0);
    assert.equal(await page.locator('.media-advice-chat .user-bubble p').evaluate(e=>getComputedStyle(e).color),'rgb(17, 17, 17)');
    assert.equal(await page.locator('.media-advice-answer p').evaluate(e=>getComputedStyle(e).color),'rgb(244, 244, 244)');
    assert.match(await page.locator('.media-advice-dialog').innerText(),/Authored film/);
    assert.doesNotMatch(await page.locator('.media-advice-chat').innerText(),/Джерельні HTTP|ledger|requestsMade|requestBudget|identity:|searchCalls/);
    assert.equal(await page.locator('.media-advice-row .media-advice-variant-select').count(),0,'a single source row needs no variant selector');
    assert.equal(await page.locator('.media-advice-row details,.media-advice-row pre').count(),0,'technical provenance belongs in diagnostics');
    assert.doesNotMatch(await page.locator('.media-advice-options').innerText(),/TMDb|JustWatch|Movie of the Night|Kinobaza HTML|AUTHORED/);
    assert.equal(await page.getByRole('table').count(),1,'all services share one compact comparison');
    assert.deepEqual(await page.getByRole('columnheader').allTextContents(),['Сервіс','Укр. аудіо','Укр. субтитри']);
    assert.equal(await page.locator('.media-advice-row').evaluateAll(rows=>rows.every(row=>row.tagName==='TR')),true);
    assert.equal(await page.locator('.media-advice-row img.media-advice-provider-icon').count(),1,'use the existing SVG platform emblem');
    assert.equal(await page.locator('.media-advice-provider-icon').evaluateAll(nodes=>nodes.every(n=>new URL(n.src).pathname.endsWith('.svg')&&n.alt==='')),true);
    await page.waitForFunction(()=>[...document.querySelectorAll('.media-advice-provider-icon')].every(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await page.locator('.media-advice-row button').count(),1,'one service picker, no repeated open/select action blocks');
    assert.equal(await page.locator('.media-advice-actions').getByRole('button',{name:'Обрати',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),1);
    assert.equal(await page.locator('.media-advice-legend').count(),1);
    assert.equal(await page.locator('.media-advice-comparison-caution').count(),1);
    assert.equal(await page.locator('.media-advice-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    // Real re-init path, with non-M4 data loaders isolated: unchanged auth
    // handler -> unchanged initApp -> actual loadCurrentRole -> M4 access refresh.
    await page.evaluate(() => {
      const dialog = mediaAdviceController.dialog;
      window.authoredChat = dialog.querySelector('.media-advice-chat');
      window.authoredBubble = authoredChat.querySelector('.mykola-bubble');
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
    assert.deepEqual(await page.evaluate(() => [mediaAdviceController.dialog.open, authoredChat.isConnected, authoredBubble.isConnected, mediaAdviceController.dialog.scrollTop === authoredScroll]), [true, true, true, true]);
    assert.equal(calls.filter(c => c.action === 'discover').length, 1);
    if (process.env.M4_SCREENSHOT_DIR) {
      await page.evaluate(() => mediaAdviceController.dialog.scrollTop = 0);
      await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/authored-${width}.png`,animations:'disabled' });
    }
    assert.deepEqual(await page.evaluate(()=>authoredOpened),[],'opening the advice and receiving results cannot visit a destination');
    assert.equal(await page.locator('.media-advice-row input[type=checkbox]').count(),0);
    await page.getByRole('button',{name:'Відкрити посилання',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>authoredOpened),[[trackingURL,'_blank','noopener,noreferrer']]);
    assert.equal(calls.filter(c=>c.action==='discover').length,1);
    assert.equal(await page.evaluate(()=>authoredDBWrites.length),0);
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.media-advice-preview h3')), true);
    const preview=page.locator('.media-advice-preview');
    assert.match(await preview.innerText(),/Посилання буде замінено\./);
    assert.doesNotMatch(await preview.innerText(),/https?:/);
    assert.equal(await preview.locator('details').evaluate(e=>e.open),false);
    if(width===420&&process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/preview-replaced-420.png`,animations:'disabled'});
    if(width===375&&process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/compact-long-preview-375.png`,animations:'disabled'});
    await preview.getByText('Повні адреси',{exact:true}).click();
    const fullAddresses=await preview.locator('details').innerText();
    assert.ok(fullAddresses.includes('https://old.example'));assert.ok(fullAddresses.includes(trackingURL));
    assert.equal(await page.locator('.media-advice-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    if(width===420&&process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/preview-full-addresses-420.png`,animations:'disabled'});
    if(width===375&&process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/expanded-long-preview-375.png`,animations:'disabled'});
    await page.getByRole('button', { name: 'Скасувати вибір' }).click();
    assert.equal(await page.getByRole('button', { name: 'Обрати', exact: true }).evaluate(e => document.activeElement === e), true);
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => !document.querySelector('.media-advice-dialog').open);
    assert.equal(await page.locator('#recommended_medium').inputValue(), 'Apple TV / iTunes');
    assert.equal(await page.locator('#purchase_url').inputValue(), authored.rows[0].link.href);
    assert.deepEqual(await page.evaluate(() => [document.querySelector('#title').value, document.querySelector('#status').value, document.querySelector('#owned_medium').value, activeAdviceRoom.id, mykolaChat.textContent]), ['Authored film', 'wishlist', '', 'KEEP', 'SOCIAL HISTORY']);
    assert.equal(calls.filter(c => c.action === 'discover').length, 1);
    if(width===420) {
      await page.locator('#mediaAdviceEntry').click();
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      assert.match(await preview.innerText(),/Посилання вже додано/);
      assert.doesNotMatch(await preview.innerText(),/https?:/);
      assert.equal(await preview.locator('details').evaluate(e=>e.open),false);
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/preview-same-420.png`,animations:'disabled'});
      await preview.getByText('Повні адреси',{exact:true}).click();
      assert.ok((await preview.locator('details').innerText()).includes(trackingURL));
      await page.getByRole('button',{name:'Скасувати вибір',exact:true}).click();
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      await page.locator('#purchase_url').fill('');
      await page.locator('#mediaAdviceEntry').click();
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      assert.match(await preview.innerText(),/Посилання буде додано\./);
      assert.doesNotMatch(await preview.innerText(),/https?:/);
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/preview-added-420.png`,animations:'disabled'});
      await preview.getByText('Повні адреси',{exact:true}).click();
      assert.ok((await preview.locator('details').innerText()).includes(trackingURL));
      await page.getByRole('button',{name:'Скасувати вибір',exact:true}).click();
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      assert.equal(calls.filter(c=>c.action==='discover').length,1);
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),0);
    }
    await page.locator('#purchase_url').fill('https://manual.example/');
    await page.locator('#mediaAdviceEntry').click(); assert.equal(await page.getByRole('button', { name: 'Знайти варіанти', exact: true }).count(), 0);
    assert.equal(await page.evaluate(()=>authoredOpened.length),1,'reopening does not repeat the explicit destination action');
    await page.getByRole('button', { name: '← До картки' }).click(); assert.equal(await page.locator('#purchase_url').inputValue(), 'https://manual.example/');
    await page.evaluate(() => mediaAdviceController.refresh());
    assert.equal(await page.evaluate(() => mediaAdviceController.dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mediaAdviceEntry');
    await page.locator('#mediaAdviceEntry').click();
    await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
    await page.locator('.media-advice-diagnostics').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.media-advice-diagnostics h3')), true);
    assert.equal(await page.getByLabel('Короткий звіт для копіювання').isVisible(),true);
    await page.getByText('Джерельні деталі варіантів',{exact:true}).click();
    assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/Plex/);
    assert.doesNotMatch(await page.locator('.media-advice-diagnostics details').innerText(),/https?:|sourceURL|href/);
    await page.getByRole('button', { name: 'Скопіювати короткий звіт' }).click();
    const report = await page.getByLabel('Короткий звіт для копіювання').inputValue();
    assert.doesNotMatch(report, /https?:|manual.example|AUTHORED|at=/);
    assert.match(report,/Authored film/); assert.match(report,/2020/); assert.match(report,/Source HTTP attempts: 4\/8/);
    const reportCalls=calls.filter(c=>c.action==='discover').length;
    await page.getByRole('button',{name:'← До порад',exact:true}).click();
    assert.equal(await page.locator('.media-advice-chat').isVisible(),true);
    assert.equal(calls.filter(c=>c.action==='discover').length,reportCalls);
    await page.getByRole('button', { name: '← До картки' }).click();
    // A new form session revokes a held response, without refund or retry.
    await page.evaluate(() => startEditMovie('list'));
    resolveDiscover = () => {};
    await page.locator('#mediaAdviceEntry').click();
    await page.waitForFunction(() => document.querySelector('.media-advice-dialog').textContent.includes('Шукаю варіанти'));
    while (calls.filter(c => c.action === 'discover').length < 2) await new Promise(r => setTimeout(r, 10));
    if (width === 420 && process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/authored-loading-420.png`,animations:'disabled' });
    await page.evaluate(() => resetFormMode()); resolveDiscover(); resolveDiscover = null;
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.media-advice-row').count(), 0);
    // Missing link needs an explicit clear, and manual edits invalidate a preview.
    authored.rows[0].link.href = null;
    await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click();
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    assert.match(await preview.innerText(),/Посилання буде очищено лише після підтвердження\./);
    assert.equal(await preview.locator('input[type=checkbox]').isChecked(),false);
    assert.doesNotMatch(await preview.innerText(),/https?:/);
    if(width===420&&process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/preview-missing-420.png`,animations:'disabled'});
    await preview.getByText('Повні адреси',{exact:true}).click();
    assert.ok((await preview.locator('details').innerText()).includes('https://old.example'));
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => document.querySelector('.media-advice-dialog').textContent.includes('очищення не підтверджено'));
    assert.match(await page.locator('.media-advice-dialog').innerText(), /очищення не підтверджено/);
    await page.getByRole('button', { name: 'Обрати', exact: true }).click();
    await page.locator('.media-advice-preview input').check();
    await page.evaluate(() => document.getElementById('purchase_url').value = 'https://new-manual.example/');
    await page.getByRole('button', { name: 'Перенести в картку' }).click();
    await page.waitForFunction(() => !document.querySelector('.media-advice-preview') && document.querySelector('.media-advice-notice').textContent.includes('Поля змінилися'));
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
    if ([375,420].includes(width)) {
      allowed = true;
      authored.rows = authoredGroupedMediaRows();
      authored.sources = [{source:'tmdb',status:'ok',identity:'matched'},{source:'motn',status:'ok',identity:'matched'},{source:'kinobaza',status:'partial',identity:'matched'}];
      await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-answer').waitFor();
      assert.equal(await page.locator('.media-advice-row').count(),3);
      assert.deepEqual(await page.locator('.media-advice-row').evaluateAll(rows=>rows.map(r=>r.dataset.providerKey)),['prime','hbo','rakuten']);
      assert.equal(await page.locator('.media-advice-variant-select').count(),0);
      assert.match(await page.locator('.media-advice-answer').innerText(),/Prime Video.*українське аудіо/);
      const beforeVariants=calls.filter(c=>c.action==='discover').length;
      const beforeVariantWrites=await page.evaluate(()=>authoredDBWrites.length);
      const rakuten=page.locator('.media-advice-row[data-provider-key="rakuten"]');
      assert.doesNotMatch(await page.locator('.media-advice-options').innerText(),/Ціна|1\.23|XXX|TMDb|JustWatch|Movie of the Night/);
      assert.equal(await page.getByRole('button',{name:'Обрати',exact:true}).count(),1);
      assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),1);
      assert.equal(await page.locator('.media-advice-row img.media-advice-provider-icon').count(),3);
      assert.equal(await page.locator('.media-advice-legend').count(),1);
      assert.equal(await page.locator('.media-advice-comparison-caution').count(),1);
      assert.equal(await page.locator('.media-advice-chat .mykola-message-row').last().getByRole('button',{name:'Діагностичний звіт'}).count(),1);
      const beforeReport = calls.filter(c=>c.action==='discover').length;
      await page.getByRole('button',{name:'Діагностичний звіт'}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Mapped source rows: 8/);
      await page.getByText('Джерельні деталі варіантів',{exact:true}).click();
      assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/Укр\. звук \(dolby\)/);
      assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/Kinobaza|kinobaza/);
      assert.doesNotMatch(await page.locator('.media-advice-diagnostics details').innerText(),/https?:|href|AUTHOR%/);
      if (process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({ path:`${process.env.M4_SCREENSHOT_DIR}/authored-report-420.png`,animations:'disabled' });
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeReport);
      await page.getByRole('button',{name:'← До порад'}).click();
      const selectedRow=authored.rows.find(r=>r.id==='motn:rakuten-rent');
      assert.equal(await rakuten.getAttribute('data-row-id'),selectedRow.id);
      await rakuten.locator('.media-advice-service-select').click();
      const offerSelect=page.getByLabel('Варіант сервісу Rakuten TV');
      assert.equal(await offerSelect.locator('option').count(),4,'the comparison does not merge different original offers');
      assert.match(await offerSelect.innerText(),/Оренда/);assert.match(await offerSelect.innerText(),/Купівля/);
      const originalConflict=authored.rows.find(r=>r.id==='motn:rakuten-conflict');
      await offerSelect.selectOption('3');
      assert.equal(await rakuten.getAttribute('data-row-id'),originalConflict.id);
      await page.getByRole('button',{name:'Відкрити посилання',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>authoredOpened.at(-1)),[originalConflict.link.href,'_blank','noopener,noreferrer']);
      await offerSelect.selectOption('0');
      assert.equal(await rakuten.getAttribute('data-row-id'),selectedRow.id);
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      assert.match(await page.locator('.media-advice-preview').innerText(),/Посилання буде замінено\./);
      await page.locator('.media-advice-preview').getByText('Повні адреси',{exact:true}).click();
      assert.ok((await page.locator('.media-advice-preview details').innerText()).includes(selectedRow.link.href));
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeVariantWrites);
      await page.getByRole('button',{name:'Перенести в картку',exact:true}).click();
      await page.waitForFunction(()=>!mediaAdviceController.dialog.open);
      assert.equal(await page.locator('#recommended_medium').inputValue(),'Rakuten TV');
      assert.equal(await page.locator('#purchase_url').inputValue(),selectedRow.link.href);
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeVariantWrites);
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeVariants);

      // Actual authored HTML -> extraction -> projection, with separate own
      // provider blocks and no country-section pointer or source HTTP request.
      const kino=await authoredDuneMediaResult();
      kino.rows[0].price={state:'reported',amount:{state:'reported',value:'91.17'},currency:{state:'reported',value:'XXX'}};
      const rawKino=structuredClone(kino.rows);
      Object.assign(authored,kino);
      const beforeKinoCalls=calls.filter(c=>c.action==='discover').length;
      const beforeKinoWrites=await page.evaluate(()=>authoredDBWrites.length);
      await page.evaluate(film=>{
        Object.assign(movies[0],{title:film.title,year:film.year,imdb_url:`https://imdb.com/title/${film.imdbId}`});
        startEditMovie('list');
      },kino.film);
      await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-answer').waitFor();
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeKinoCalls+1);
      assert.equal(await page.locator('.media-advice-row').count(),3);
      const kinoOrder=await page.locator('.media-advice-row').evaluateAll(cards=>cards.map(c=>c.dataset.providerKey));
      assert.deepEqual([...kinoOrder].sort(),['apple','megogo','rakuten']);
      const apple=page.locator('.media-advice-row[data-provider-key="apple"]');
      assert.deepEqual(kinoOrder,['apple','rakuten','megogo'],'language category first, then the agreed service priorities');
      assert.equal(await apple.locator('th[scope=row]').count(),1);assert.equal(await apple.locator('td').count(),2);
      assert.equal(await apple.locator('td').nth(0).innerText(),'+');
      assert.equal(await apple.locator('td').nth(1).innerText(),'−');
      assert.match(await apple.locator('td').nth(0).getAttribute('aria-label')??await apple.locator('td').nth(0).locator('[aria-label]').getAttribute('aria-label'),/українське аудіо|Кінобаз/i);
      assert.match(await apple.locator('td').nth(1).getAttribute('aria-label')??await apple.locator('td').nth(1).locator('[aria-label]').getAttribute('aria-label'),/субтитр|відсут|познач/i);
      for(const key of ['rakuten','megogo']) {
        const card=page.locator(`.media-advice-row[data-provider-key="${key}"]`);
        assert.equal(await card.locator('td').nth(0).innerText(),'+');
        assert.equal(await card.locator('td').nth(1).innerText(),'+');
      }
      for(const card of await page.locator('.media-advice-row').all()) {
        assert.match(await card.locator('th[scope=row]').innerText(),/◐/,'a Kinobaza block is partial availability evidence');
        const accessible=await card.locator('[aria-label]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')).join(' '));
        assert.match(accessible,/неповн|частков|окремо не перевірен/i);
      }
      assert.doesNotMatch(await page.locator('.media-advice-options').innerText(),/91\.17|XXX|Ціна|Доступно в Україні|гарантовано/i);
      assert.equal(await page.locator('.media-advice-row input[type=checkbox]').count(),0);
      await page.evaluate(async()=>{await mediaAdviceController.refresh();await mediaAdviceController.refresh();});
      assert.deepEqual(await page.locator('.media-advice-row').evaluateAll(cards=>cards.map(c=>c.dataset.providerKey)),kinoOrder);
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeKinoCalls+1);
      if(process.env.M4_SCREENSHOT_DIR) {
        await page.evaluate(()=>mediaAdviceController.dialog.scrollTop=0);
        await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/compact-comparison-${width}.png`,animations:'disabled'});
      }
      await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
      await page.getByText('Джерельні деталі варіантів',{exact:true}).click();
      const diagnosticRows=await page.locator('.media-advice-diagnostics details pre').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.textContent)));
      assert.equal(diagnosticRows.length,3);
      for(const original of rawKino) {
        const detail=diagnosticRows.find(r=>r.kinobazaLocalization?.provider===original.kinobazaLocalization.provider);
        assert.ok(detail);
        assert.equal(detail.country,original.country);
        assert.deepEqual(detail.audio,original.audio);assert.deepEqual(detail.subtitles,original.subtitles);
        assert.deepEqual(detail.kinobazaLocalization.audio,original.kinobazaLocalization.audio);
        assert.deepEqual(detail.kinobazaLocalization.subtitles,original.kinobazaLocalization.subtitles);
        assert.equal(detail.kinobazaLocalization.binding,original.kinobazaLocalization.binding);
        if(original.price?.amount?.value==='91.17') assert.deepEqual(detail.price,original.price);
      }
      assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/Укр\. звук \(стерео\)/);
      assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/91\.17/);
      await page.getByRole('button',{name:'← До порад',exact:true}).click();
      const openedBeforeKino=await page.evaluate(()=>authoredOpened.length);
      for(const [index,key] of ['apple','rakuten','megogo'].entries()) {
        const card=page.locator(`.media-advice-row[data-provider-key="${key}"]`);
        const original=rawKino.find(r=>r.provider.key===key);
        await card.locator('.media-advice-service-select').click();
        await page.getByRole('button',{name:'Відкрити посилання',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>authoredOpened.at(-1)),[original.link.href,'_blank','noopener,noreferrer']);
        await page.getByRole('button',{name:'Обрати',exact:true}).click();
        await page.locator('.media-advice-preview').getByText('Повні адреси',{exact:true}).click();
        assert.ok((await page.locator('.media-advice-preview details').innerText()).includes(original.link.href));
        assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeKinoWrites);
        await page.getByRole('button',{name:'Перенести в картку',exact:true}).click();
        await page.waitForFunction(()=>!mediaAdviceController.dialog.open);
        assert.equal(await page.locator('#recommended_medium').inputValue(),({apple:'Apple TV / iTunes',rakuten:'Rakuten TV',megogo:'Megogo'})[key]);
        assert.equal(await page.locator('#purchase_url').inputValue(),original.link.href);
        assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeKinoWrites);
        assert.equal(calls.filter(c=>c.action==='discover').length,beforeKinoCalls+1);
        if(index<2) await page.locator('#mediaAdviceEntry').click();
      }
      assert.equal(await page.evaluate(()=>authoredOpened.length),openedBeforeKino+3);
      assert.deepEqual(await page.evaluate(()=>[activeAdviceRoom.id,mykolaChat.textContent]),['KEEP','SOCIAL HISTORY']);
      await page.locator('#submitButton').click();
      await page.waitForFunction(n=>authoredDBWrites.length===n+1,beforeKinoWrites);
      const kinoSave=await page.evaluate(()=>authoredDBWrites.at(-1));
      assert.equal(kinoSave.name,'movie_group_lists');assert.equal(kinoSave.operation,'update');
      assert.equal(kinoSave.fields.purchase_url,rawKino.find(r=>r.provider.key==='megogo').link.href);
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeKinoCalls+1);

      // Positive labels require the selected film and this exact service block.
      for(const refusal of ['identity','service']) {
        const row=structuredClone(rawKino.find(r=>r.provider.key==='apple'));
        if(refusal==='identity') row.identityStatus='unresolved';
        else row.kinobazaLocalization.provider='Rakuten TV';
        authored.rows=[row];
        const beforeRefusal=calls.filter(c=>c.action==='discover').length;
        await page.evaluate(()=>startEditMovie('list'));await page.locator('#mediaAdviceEntry').click();
        await page.locator('.media-advice-answer').waitFor();
        assert.doesNotMatch(await page.locator('.media-advice-options').innerText(),/Українське аудіо(?: та субтитри)? — за даними Кінобази/);
        assert.equal(calls.filter(c=>c.action==='discover').length,beforeRefusal+1);
        assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeKinoWrites+1);
        if(refusal==='identity') assert.equal(await page.getByRole('button',{name:'Обрати',exact:true}).isDisabled(),true);
        await page.getByRole('button',{name:'← До картки',exact:true}).click();
      }
    }
    if (width === 1280) {
      allowed = true;
      // Authored source rows, not catalogue/availability assertions: the
      // comparison keeps language category ahead of the owner's service order.
      const allServices=['megogo','prime','hbo','netflix','rakuten','apple'];
      const sourceLanguage=()=>({state:'reported',ukrainian:[{language:'ukr'}]});
      const freshServiceRows=()=>allServices.map(key=>({
        id:`motn:comparison-${key}`,identityStatus:'matched',provider:{key},country:'UA',
        audio:sourceLanguage(),subtitles:{state:'unknown'},link:{href:null},
        provenance:{source:'Movie of the Night'},
      }));
      authored.rows=freshServiceRows();
      await page.evaluate(()=>startEditMovie('list'));await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-answer').waitFor();
      assert.deepEqual(await page.locator('.media-advice-row').evaluateAll(rows=>rows.map(r=>r.dataset.providerKey)),['apple','rakuten','prime','hbo','netflix','megogo']);
      assert.equal(await page.getByRole('table').count(),1);assert.equal(await page.getByRole('columnheader').count(),3);
      assert.equal(await page.getByRole('button',{name:'Обрати',exact:true}).count(),1);
      assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),0,'missing links never create an opening action');
      const tiedRankCalls=calls.filter(c=>c.action==='discover').length;
      await page.locator('.media-advice-row[data-provider-key="megogo"] .media-advice-service-select').click();
      assert.equal(calls.filter(c=>c.action==='discover').length,tiedRankCalls,'choosing a service cannot search again');
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      authored.rows=freshServiceRows().map(row=>({...row,audio:row.provider.key==='netflix'?sourceLanguage():{state:'unknown'},subtitles:row.provider.key==='prime'?sourceLanguage():{state:'unknown'}}));
      await page.evaluate(()=>startEditMovie('list'));await page.locator('#mediaAdviceEntry').click();await page.locator('.media-advice-answer').waitFor();
      assert.deepEqual(await page.locator('.media-advice-row').evaluateAll(rows=>rows.map(r=>r.dataset.providerKey)),['netflix','prime','apple','rakuten','hbo','megogo']);
      assert.match(await page.locator('.media-advice-answer').innerText(),/Netflix.*українське аудіо/);
      const unknownAudio=page.locator('.media-advice-row[data-provider-key="apple"] td').nth(0);
      assert.equal(await unknownAudio.innerText(),'?');
      assert.match(await unknownAudio.locator('[aria-label]').getAttribute('aria-label'),/невідом|не встановлен|не підтверджен/i);
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      for (const kind of ['no-results', 'identity-refusal', 'source-failed', 'unbound-localization', 'conflicting-properties', 'several', 'unsafe-link']) {
        authored.rows = ['no-results','identity-refusal','source-failed'].includes(kind) ? [] : [{
          id: 'kinobaza:authored', identityStatus: 'matched', kind: 'candidate-link', country: null,
          provider: { key: 'apple', name: 'Apple TV Store' }, provenance: { source: 'Kinobaza HTML' }, link: { href: 'https://itunes.apple.com/ua/movie/id123' },
          kinobazaLocalization: { audio: { state: 'reported-positive' }, subtitles: { state: 'reported-negative' } },
          conflicts: kind === 'conflicting-properties' ? [{ field: 'audio', type: 'conflicting-block-labels' }] : [],
        }];
        authored.sources = [{ source: 'kinobaza', status: kind === 'identity-refusal' ? 'identity-unresolved' : kind==='source-failed'?'stage-failed-no-retry':'partial', identity: kind === 'identity-refusal'||kind==='source-failed' ? 'unresolved' : 'matched' }];
        if (kind === 'several') authored.rows.push({ ...authored.rows[0], id: 'motn:independent', provider: { key: 'prime', name: 'Prime Video' }, kinobazaLocalization: undefined, link: { href: 'https://www.primevideo.com/detail/AUTHORED/' }, provenance: { source: 'Movie of the Night' } });
        if (kind === 'unsafe-link') authored.rows[0].link.href='javascript:alert(1)';
        await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click();
        await page.locator('.media-advice-answer').waitFor();
        assert.equal(await page.locator('.media-advice-row').count(), authored.rows.length);
        if (kind === 'unsafe-link') {
          assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),0);
          assert.equal(await page.evaluate(()=>authoredOpened.length),1);
        }
        if (kind === 'unbound-localization') {
          const cell=page.locator('.media-advice-row td').nth(0);
          assert.equal(await cell.innerText(),'?','a foreign-scope/unbound block does not become a proven offer track');
        }
        if (['no-results','identity-refusal','source-failed'].includes(kind)) assert.match(await page.locator('.media-advice-dialog').innerText(), /не означає, що фільм недоступний/);
        if(kind==='source-failed') {
          assert.match(await page.locator('.media-advice-chat').innerText(),/Частина відомостей неповна або не надійшла/);
          assert.doesNotMatch(await page.locator('.media-advice-chat').innerText(),/stage-failed-no-retry/);
          await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
          const failedReport=await page.getByLabel('Короткий звіт для копіювання').inputValue();
          assert.match(failedReport,/stage-failed-no-retry/);assert.match(failedReport,/Authored film/);assert.match(failedReport,/2020/);
          await page.getByRole('button',{name:'← До порад',exact:true}).click();
        }
        if (kind === 'conflicting-properties') {
          const cell=page.locator('.media-advice-row td').nth(0);
          assert.match(await cell.getAttribute('aria-label')??await cell.locator('[aria-label]').getAttribute('aria-label'),/суперечлив/i);
          assert.notEqual(await cell.innerText(),'−','conflict is not evidence that a track is absent');
          assert.equal(await page.locator('.media-advice-row details,.media-advice-row pre').count(),0);
          await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
          assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/conflicting-block-labels/);
          await page.getByRole('button',{name:'← До порад',exact:true}).click();
        }
        await page.getByRole('button', { name: '← До картки' }).click();
      }
      // Multiple already-matched cards: selecting a card renders separate original
      // rows without network or silent form enrichment.
      authored.rows = [];
      authored.cardChoices = [1,2].map(i => ({ id: 'card-' + i, sourceURL: 'https://kinobazaua.com/titles/authored-' + i, status:'ok', rows:[{
        id:'card-' + i + ':kinobaza:0', identityStatus:'matched', provider:{key:'apple',name:'Apple TV Store'}, provenance:{source:'Kinobaza HTML'}, link:{href:'https://itunes.apple.com/ua/movie/id' + (123 + i)},
      }], unmapped:[] }));
      await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click();
      await page.getByRole('button', { name: 'Використати підтверджену картку 1' }).waitFor();
      const beforeChoice = calls.filter(c => c.action === 'discover').length;
      await page.getByRole('button', { name: 'Використати підтверджену картку 1' }).click();
      assert.equal(await page.locator('.media-advice-row').count(), 1);
      await page.getByRole('button', { name: 'Використати підтверджену картку 2' }).click();
      assert.equal(await page.locator('.media-advice-row').count(), 1);
      assert.equal(calls.filter(c => c.action === 'discover').length, beforeChoice);
      assert.equal(await page.locator('#purchase_url').inputValue(), 'https://old.example');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
      await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
      await page.getByRole('button', { name: 'Скопіювати короткий звіт' }).click();
      await page.getByLabel('Короткий звіт для копіювання').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('mediaAdvice')), null);
      await page.getByRole('button', { name: '← До картки' }).click();
      // Both ways of establishing an add-form identity enter this dialog. The
      // source reply and local transfer still cannot perform an ordinary save.
      authored.cardChoices=[];
      authored.rows=[{id:'motn:added',identityStatus:'matched',provider:{key:'apple',name:'Apple TV Store'},country:'UA',provenance:{source:'Movie of the Night'},link:{href:'https://itunes.apple.com/ua/movie/id123'}}];
      await page.evaluate(()=>{
        resetFormMode(); movies=[]; pendingSearchQuery=null; pendingImdbUrl=null; pendingImdbId=null;
        getCurrentUserDisplayName=async()=> 'Owner';
        findExistingMovieMetadataByImdbId=async()=>({id:'authored-metadata'});
      });
      for(const formKind of ['lookup','selected-search-result']) {
        const imdbId=formKind==='lookup'?'tt2345678':'tt3456789';
        const title=formKind==='lookup'?'Authored added film':'Authored selected film';
        const year=formKind==='lookup'?2024:2025;
        authored.film={title,year,imdbId};
        const beforeCalls=calls.filter(c=>c.action==='discover').length;
        const beforeWrites=await page.evaluate(()=>authoredDBWrites.length);
        if(formKind==='lookup') {
          await page.locator('#showAddFormButton').click();
          assert.equal(await page.locator('#mediaAdviceEntry').isHidden(),true);
          await page.locator('#imdb_url').fill(`https://www.imdb.com/title/${imdbId}/`);
          await page.locator('#lookupButton').click();
        } else {
          await page.evaluate(({imdbId,title,year})=>{
            resetFormMode(); imdbSearchResults=[{imdb_id:imdbId,title,year}]; renderImdbSearchResults(imdbSearchResults);
          },{imdbId,title,year});
          await page.locator(`[data-add-imdb-id="${imdbId}"]`).click();
        }
        await page.locator('#mediaAdviceEntry').waitFor({state:'visible'});
        assert.equal(calls.filter(c=>c.action==='discover').length,beforeCalls);
        assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeWrites);
        await page.locator('#mediaAdviceEntry').click();
        await page.getByRole('button',{name:'Обрати',exact:true}).waitFor();
        assert.equal(calls.filter(c=>c.action==='discover').length,beforeCalls+1);
        const discovery=calls.filter(c=>c.action==='discover').at(-1);
        assert.equal(discovery.imdbId,imdbId);assert.equal(discovery.listId,null);
        assert.deepEqual(Object.keys(discovery).sort(),['action','formSession','groupId','imdbId','listId']);
        assert.match(await page.locator('.media-advice-dialog').innerText(),new RegExp(title));
        await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
        assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),new RegExp(title));
        await page.getByRole('button',{name:'← До порад',exact:true}).click();
        await page.getByRole('button',{name:'Обрати',exact:true}).click();
        await page.getByRole('button',{name:'Перенести в картку',exact:true}).click();
        await page.waitForFunction(()=>!mediaAdviceController.dialog.open);
        assert.equal(await page.locator('#recommended_medium').inputValue(),'Apple TV / iTunes');
        assert.equal(await page.locator('#purchase_url').inputValue(),'https://itunes.apple.com/ua/movie/id123');
        assert.equal(await page.locator('#title').inputValue(),title);assert.equal(await page.locator('#year').inputValue(),String(year));
        assert.deepEqual(await page.evaluate(()=>[activeAdviceRoom.id,mykolaChat.textContent]),['KEEP','SOCIAL HISTORY']);
        assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeWrites);
        await page.locator('#submitButton').click();
        await page.waitForFunction(n=>authoredDBWrites.length===n+1,beforeWrites);
        const save=await page.evaluate(()=>authoredDBWrites.at(-1));
        assert.equal(save.name,'movie_group_lists');assert.equal(save.operation,'insert');
        assert.equal(save.fields[0].recommended_medium,'Apple TV / iTunes');assert.equal(save.fields[0].purchase_url,'https://itunes.apple.com/ua/movie/id123');
        assert.equal(calls.filter(c=>c.action==='discover').length,beforeCalls+1);
      }
      // A successful ordinary Save (mocked DB only) destroys the cached M4
      // context. The new dialog itself never performs that write or a refresh.
      authored.film={title:'Authored film',year:2020,imdbId:'tt1234567'};
      await page.evaluate(()=>{
        movies=[{id:'list',imdb_url:'https://imdb.com/title/tt1234567',title:'Authored film',year:2020,status:'wishlist',recommended_medium:'DVD',purchase_url:'https://old.example',added_by:'Owner'}];
        const from=supabaseClient.from.bind(supabaseClient);
        supabaseClient.from=name=>{
          const table=from(name);
          if(name==='movie_group_lists') table.update=fields=>{authoredDBWrites.push({name,fields,operation:'update-success'});return{eq:async()=>({error:null})};};
          return table;
        };
        loadMovies=async()=>{}; startEditMovie('list');
      });
      await page.locator('#mediaAdviceEntry').click(); await page.getByRole('button',{name:'Обрати',exact:true}).waitFor();
      await page.getByRole('button',{name:'← До картки'}).click();
      const savedCalls=calls.filter(c=>c.action==='discover').length;
      const savedWrites=await page.evaluate(()=>authoredDBWrites.length);
      await page.locator('#submitButton').click();
      await page.waitForFunction(()=>document.querySelector('#formPanel').style.display==='none');
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),savedWrites+1);
      assert.equal(await page.evaluate(()=>mediaAdviceController.dialog.hasChildNodes()),false);
      assert.equal(await page.locator('#mediaAdviceEntry').isHidden(),true);
      assert.equal(calls.filter(c=>c.action==='discover').length,savedCalls);
    }
    await page.evaluate(() => resetFormMode()); assert.equal(await page.locator('.media-advice-dialog').isVisible(), false);
    await page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }); startEditMovie('list'); });
    assert.equal(await page.locator('#mediaAdviceEntry').isHidden(), true);
    assert.equal(await page.locator('#purchase_url').isEditable(), true); // unsupported capability environment must not break editing
    assert.equal(await page.evaluate(() => document.querySelector('#mediaAdviceEntry').type), 'button');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});

