import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';
import { authoredGroupedMediaRows, authoredDuneMediaResult } from './media-advice-group.fixture.mjs';

async function assertColumnRhythm(page, viewportWidth, iconState = 'loaded') {
  await page.locator('.media-advice-comparison').evaluate(table => Promise.all(table.closest('.mykola-bubble').getAnimations().map(animation => animation.finished)));
  const geometry = await page.locator('.media-advice-comparison').evaluate(table => {
    const rect = element => { const r = element.getBoundingClientRect(); return { x:r.x, right:r.right, y:r.y, bottom:r.bottom, width:r.width, height:r.height, center:r.x+r.width/2 }; };
    const textRect = element => { const range=document.createRange(); range.selectNodeContents(element); return rect(range); };
    return {
      table:rect(table),
      headers:[...table.querySelectorAll('thead th')].map(header=>({ ...rect(header), text:textRect(header) })),
      rows:[...table.querySelectorAll('tbody tr')].map(row=>{
        const button=row.querySelector('.media-advice-service-select');
        const name=button.querySelector('.media-advice-service-name');
        const image=button.querySelector('.media-advice-provider-icon');
        return {
          cells:[...row.children].map(cell=>({ ...rect(cell), symbol:cell.tagName==='TD'?rect(cell.firstElementChild):null })),
          button:rect(button), name:{ ...rect(name), text:textRect(name), scrollWidth:name.scrollWidth, clientWidth:name.clientWidth },
          image:rect(image), iconState:button.dataset.iconState,
        };
      }),
    };
  });
  const steps=geometry.headers.slice(1).map((header,index)=>header.center-geometry.headers[index].center);
  assert.ok(steps.every(step=>step>0));
  assert.ok(Math.max(...steps)-Math.min(...steps)<=1, 'the four column centers have the same horizontal step, not merely overflow-free widths');
  for(const header of geometry.headers) {
    assert.ok(header.text.x>=header.x-1&&header.text.right<=header.right+1, 'each complete heading stays inside its own column');
    assert.ok(header.text.y>=header.y-1&&header.text.bottom<=header.bottom+1, 'heading text remains inside its own row');
  }
  for(const row of geometry.rows) {
    const service=row.cells[0];
    assert.ok(row.button.width>=44&&row.button.height>=44, 'selection retains a touch-sized target in both dimensions');
    assert.ok(row.button.x>=service.x-1&&row.button.right<=service.right+1, 'the service target never overlaps the next column');
    assert.ok(row.button.y>=service.y-1&&row.button.bottom<=service.bottom+1, 'the service target remains inside its row');
    for(const [index,cell] of row.cells.entries()) {
      assert.ok(Math.abs(cell.center-geometry.headers[index].center)<=1, 'each value uses the same center as its heading');
      if(cell.symbol) assert.ok(cell.symbol.x>=cell.x-1&&cell.symbol.right<=cell.right+1, 'a symbol stays inside its own column');
    }
    if(row.name.width>1&&row.name.height>1) {
      assert.ok(row.name.text.x>=row.button.x-1&&row.name.text.right<=row.button.right+1, 'the visible service name or fallback is not clipped across columns');
      assert.ok(row.name.text.y>=row.button.y-1&&row.name.text.bottom<=row.button.bottom+1, 'the visible name or fallback has enough vertical room');
      assert.ok(row.name.scrollWidth<=row.name.clientWidth+1, 'the full service name or fallback can wrap without horizontal clipping');
    }
  }
  if(viewportWidth>480) {
    const nameStarts=geometry.rows.map(row=>row.name.x);
    const textStarts=geometry.rows.map(row=>row.name.text.x);
    const iconCenters=geometry.rows.filter(row=>row.iconState==='loaded').map(row=>row.image.center);
    assert.ok(Math.max(...nameStarts)-Math.min(...nameStarts)<=1, 'visible names and fallback retain a separate common left axis');
    assert.ok(Math.max(...textStarts)-Math.min(...textStarts)<=1, 'the actual name text starts on that axis, including wrapped names');
    if(iconCenters.length>1) assert.ok(Math.max(...iconCenters)-Math.min(...iconCenters)<=1, 'loaded emblems share one vertical center axis despite different painted widths');
    for(const row of geometry.rows.filter(row=>row.iconState==='loaded')) {
      const nameSharesRow=row.name.y<row.image.bottom&&row.name.bottom>row.image.y;
      if(nameSharesRow) assert.ok(row.image.right<=row.name.x+1, 'a horizontal emblem/name pair never overlaps');
    }
  }
  const rounded=value=>Math.round(value*100)/100;
  console.info(`M4 column rhythm ${JSON.stringify({viewport:viewportWidth,iconState,tableWidth:rounded(geometry.table.width),centers:geometry.headers.map(header=>rounded(header.center)),steps:steps.map(rounded),...(viewportWidth>480?{emblemCenters:geometry.rows.filter(row=>row.iconState==='loaded').map(row=>rounded(row.image.center)),nameStarts:geometry.rows.map(row=>rounded(row.name.text.x))}:{})})}`);
}

async function assertServiceComparisonLayout(page, width) {
  await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-provider-icon')].every(image => image.complete && image.naturalWidth > 0));
  // Measure settled geometry, not the existing 180ms bubbleIn scale(0.98).
  // Keep the same 44px assertion; do not change application animation/timing.
  await page.locator('.media-advice-comparison').evaluate(table => Promise.all(table.closest('.mykola-bubble').getAnimations().map(animation => animation.finished)));
  const layout = await page.locator('.media-advice-comparison').evaluate(table => {
    const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height, center: r.x + r.width / 2 }; };
    const headers = [...table.querySelectorAll('thead th')].map(header => ({ ...rect(header), align: getComputedStyle(header).textAlign }));
    return {
      width: table.clientWidth, scrollWidth: table.scrollWidth, headers,
      rows: [...table.querySelectorAll('tbody tr')].map(rect),
      services: [...table.querySelectorAll('.media-advice-service-select')].map(button => {
        const name = button.querySelector('.media-advice-service-name');
        const style = getComputedStyle(name), image = button.querySelector('.media-advice-provider-icon');
        return { label: button.getAttribute('aria-label'), title: button.title, text: name.textContent,
          state: button.dataset.iconState, button: rect(button), name: rect(name),
          image: rect(image), imageFit: getComputedStyle(image).objectFit,
          nameDisplay: style.display, nameVisibility: style.visibility,
          language: [...button.closest('tr').querySelectorAll('td')].map(cell => ({ ...rect(cell), align: getComputedStyle(cell).textAlign, symbol: rect(cell.firstElementChild) })),
        };
      }),
    };
  });
  assert.deepEqual(await page.getByRole('columnheader').allTextContents(), ['Сервіс', 'Доступ', 'Аудіо', 'Субтитри']);
  assert.equal(await page.locator('.media-advice-table-caption').evaluate(element=>element.tagName), 'CAPTION');
  assert.equal(await page.locator('.media-advice-table-caption').innerText(), 'Аудіо та субтитри — українською');
  assert.equal(await page.locator('.media-advice-table-caption').isVisible(), true, 'the native caption explains both language columns');
  assert.ok(layout.headers.every(header => header.align === 'center'), 'all four column headings are centered on every viewport');
  assert.ok(Math.max(...layout.rows.map(row => row.height)) - Math.min(...layout.rows.map(row => row.height)) <= 1, 'loaded service rows have one consistent height');
  assert.ok(layout.scrollWidth <= layout.width + 1, 'the comparison itself has no horizontal overflow');
  for (const service of layout.services) {
    assert.equal(service.state, 'loaded');
    assert.equal(service.label, service.text, 'the full service name remains the accessible button name');
    assert.equal(service.title, service.text, 'the emblem has a full-name tooltip');
    assert.ok(service.button.height >= 44, 'service selection retains a touch-sized target on every viewport');
    assert.ok(Math.abs(layout.headers[0].center - service.button.center) <= 1, 'the service choice lines up with its centered column heading');
    assert.equal(service.imageFit, 'contain', 'emblem dimensions never distort the SVG proportions');
    assert.equal(service.language.length, 3, 'availability has a separate cell before the two language cells');
    assert.ok(service.language[0].symbol.x - service.image.right >= 8, 'the emblem and availability symbol have visible separation');
    for (const [index, cell] of service.language.entries()) {
      const header = layout.headers[index + 1];
      assert.equal(cell.align, 'center');
      assert.ok(Math.abs(header.center - cell.symbol.center) <= 1, 'availability and language symbols line up with their centered column headings');
      assert.ok(header.height >= 30, 'column headings retain readable vertical room');
    }
    if (width <= 480) {
      assert.ok(service.name.width <= 1 && service.name.height <= 1, 'a loaded mobile emblem replaces the visible service name');
      assert.notEqual(service.nameDisplay, 'none', 'the name is visually hidden rather than removed');
      assert.notEqual(service.nameVisibility, 'hidden');
    } else {
      assert.ok(service.name.width > 1 && service.name.height > 1, 'wider viewports retain emblem and visible name');
    }
  }
  assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const service of layout.services) assert.equal(await page.getByRole('button', { name: service.label, exact: true }).count(), 1);
  await assertColumnRhythm(page,width);
}

async function assertSourceFooter(page, width) {
  const details = page.locator('.media-advice-attribution');
  const footer = details.locator('footer.media-advice-source-footer');
  const navigation = footer.getByRole('navigation', { name: 'Джерела даних' });
  const links = navigation.getByRole('link');
  const expected = [
    ['TMDb', 'https://www.themoviedb.org/'],
    ['JustWatch', 'https://www.justwatch.com/'],
    ['Movie of the Night', 'https://www.movieofthenight.com/about/api'],
    ['Кінобаза', 'https://kinobazaua.com/'],
  ];
  assert.equal(await details.locator(':scope > footer').count(), 1, 'source links and attribution share one footer inside the expanded explanation');
  assert.equal(await links.count(), 4);
  assert.deepEqual(await links.evaluateAll(elements => elements.map(a => [a.textContent, a.href])), expected, 'source destinations remain exactly unchanged');
  assert.deepEqual(await links.evaluateAll(elements => elements.map(a => [a.target, a.rel])), expected.map(() => ['_blank', 'noopener noreferrer']));
  assert.equal(await footer.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.', { exact: true }).count(), 1);
  assert.deepEqual(await footer.locator('img').evaluate(image => [image.getAttribute('src'), image.alt, image.width]), ['/research/grounded-answer-demo/public/tmdb-logo.svg', 'TMDB', 110]);
  assert.equal(await details.locator(':scope > p').count(), 4, 'the explanation is consolidated before the attribution footer');
  assert.equal(await footer.evaluate(element => element.scrollWidth <= element.clientWidth), true, 'the footer wraps without horizontal overflow');
  assert.equal(await details.evaluate(element => element.scrollWidth <= element.clientWidth), true);
  for (const link of await links.all()) {
    assert.equal(await link.isVisible(), true);
    assert.equal(await link.evaluate(element => { const r=element.getBoundingClientRect(), p=element.closest('footer').getBoundingClientRect(); return r.x >= p.x-1 && r.right <= p.right+1; }), true, 'each full source label fits inside the footer');
  }
  // Native anchors must remain reachable in document order without activating
  // a destination or invoking discovery. Keyboard focus also checks the real
  // :focus-visible styling rather than inferring accessibility from tabindex.
  await details.locator('summary').focus();
  for (let index = 0; index < expected.length; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await links.nth(index).evaluate(element => element === document.activeElement), true, 'Tab reaches each source link in its visible order');
    assert.equal(await links.nth(index).evaluate(element => { const style=getComputedStyle(element); return element.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0; }), true, 'a focused source link has a visible keyboard indicator');
  }
  if (process.env.M4_SCREENSHOT_DIR && [375,420,1280].includes(width)) {
    await details.locator('summary').focus();
    const visibleSection = await details.evaluate(element => {
      const dialog=element.closest('dialog'), header=dialog.querySelector('.media-advice-header');
      dialog.scrollTop += element.getBoundingClientRect().top - (header.getBoundingClientRect().bottom + 8);
      const section=element.getBoundingClientRect(), heading=header.getBoundingClientRect(), viewport=dialog.getBoundingClientRect();
      return { top:section.top, bottom:section.bottom, headerBottom:heading.bottom, dialogBottom:viewport.bottom };
    });
    if (visibleSection.top >= visibleSection.headerBottom && visibleSection.bottom <= visibleSection.dialogBottom) {
      // A sticky dialog header must not cover the first lines in a cropped
      // screenshot. Position the real scroll container; never hide UI or
      // resize/rewrite the rendered content to manufacture a full capture.
      await details.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/source-footer-section-${width}.png`, animations: 'disabled' });
    } else {
      await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/source-footer-section-${width}-top.png`, animations: 'disabled' });
      await details.locator('footer').scrollIntoViewIfNeeded();
      await page.locator('.media-advice-dialog').screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/source-footer-section-${width}-bottom.png`, animations: 'disabled' });
    }
  }
}

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
    assert.equal(await page.locator('.media-advice-link-select').count(),0,'a single admissible link is immediately available without a selector');
    assert.equal(await page.locator('.media-advice-variant-select').count(),0,'raw source rows are not a user-facing choice');
    assert.equal(await page.locator('.media-advice-row details,.media-advice-row pre').count(),0,'technical provenance belongs in diagnostics');
    assert.doesNotMatch(await page.locator('.media-advice-options').innerText(),/TMDb|JustWatch|Movie of the Night|Kinobaza HTML|AUTHORED/);
    assert.equal(await page.getByRole('table').count(),1,'all services share one compact comparison');
    assert.deepEqual(await page.getByRole('columnheader').allTextContents(),['Сервіс','Доступ','Аудіо','Субтитри']);
    assert.equal(await page.locator('.media-advice-row').evaluateAll(rows=>rows.every(row=>row.tagName==='TR')),true);
    assert.equal(await page.locator('.media-advice-row img.media-advice-provider-icon').count(),1,'use the existing SVG platform emblem');
    assert.equal(await page.locator('.media-advice-provider-icon').evaluateAll(nodes=>nodes.every(n=>new URL(n.src).pathname.endsWith('.svg')&&n.alt==='')),true);
    await page.waitForFunction(()=>[...document.querySelectorAll('.media-advice-provider-icon')].every(image=>image.complete&&image.naturalWidth>0));
    await assertServiceComparisonLayout(page, width);
    assert.equal(await page.locator('.media-advice-row button').count(),1,'one service picker, no repeated open/select action blocks');
    assert.equal(await page.locator('.media-advice-actions').getByRole('button',{name:'Обрати',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),1);
    assert.equal(await page.locator('.media-advice-legend').count(),1);
    assert.deepEqual(await page.locator('.media-advice-legend').evaluate(e=>[e.tagName,e.open]),['DETAILS',false]);
    assert.equal(await page.locator('.media-advice-legend').innerText(),'Що означають позначки','the symbol explanation is closed by default');
    assert.equal(await page.locator('.media-advice-comparison-caution').count(),0,'the table does not repeat a standalone technical caution');
    assert.equal(await page.locator('.media-advice-attribution').evaluate(e=>e.open),false);
    assert.equal(await page.locator('.media-advice-row [role=img][aria-label]').count(),3,'availability and both language symbols remain individually labelled when the legend is closed');
    await page.getByText('Що означають позначки',{exact:true}).click();
    assert.equal(await page.locator('.media-advice-legend').evaluate(e=>e.open),true);
    assert.match(await page.locator('.media-advice-legend').innerText(),/\? — невідомо; ± — дані різняться/);
    await page.getByText('Про джерела та обмеження',{exact:true}).click();
    assert.equal(await page.locator('.media-advice-attribution').evaluate(e=>e.open),true);
    await assertSourceFooter(page, width);
    assert.equal(calls.filter(c => c.action === 'discover').length, 1, 'expanding the source footer and focusing its links never starts discovery');
    assert.equal(await page.evaluate(()=>authoredDBWrites.length),0);
    assert.deepEqual(await page.evaluate(()=>authoredOpened),[]);
    assert.equal(context.pages().length, 1, 'viewing and tabbing through attribution never opens a destination');
    assert.equal(page.url(), origin + '/app.html');
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
    assert.deepEqual(await page.locator('.media-advice-legend,.media-advice-attribution').evaluateAll(elements=>elements.map(e=>e.open)),[true,true]);
    const retainedScroll=await page.evaluate(()=>mediaAdviceController.dialog.scrollTop);
    // Activate the existing close action without Playwright first scrolling the
    // header into view: otherwise a vacuous retained position of zero can pass.
    await page.locator('.media-advice-header button').evaluate(button=>button.click());
    await page.locator('#mediaAdviceEntry').click();
    await page.locator('.media-advice-dialog').waitFor({state:'visible'});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.deepEqual(await page.locator('.media-advice-legend,.media-advice-attribution').evaluateAll(elements=>elements.map(e=>e.open)),[true,true],'reopening preserves the two expanded explanations');
    assert.equal(await page.evaluate(()=>mediaAdviceController.dialog.scrollTop),retainedScroll,'reopening restores the retained dialog position');
    assert.equal(calls.filter(c=>c.action==='discover').length,1,'expanding explanations, re-init and reopening never search again');
    await page.getByText('Що означають позначки',{exact:true}).click();
    await page.getByText('Про джерела та обмеження',{exact:true}).click();
    assert.deepEqual(await page.locator('.media-advice-legend,.media-advice-attribution').evaluateAll(elements=>elements.map(e=>e.open)),[false,false]);
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
      authored.unmapped = [];
      authored.sources = [{source:'tmdb',status:'ok',identity:'matched'},{source:'motn',status:'ok',identity:'matched'},{source:'kinobaza',status:'partial',identity:'matched'}];
      await page.evaluate(() => startEditMovie('list')); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-answer').waitFor();
      assert.equal(await page.locator('.media-advice-row').count(),3);
      assert.deepEqual(await page.locator('.media-advice-row').evaluateAll(rows=>rows.map(r=>r.dataset.providerKey)),['prime','hbo','rakuten']);
      await assertServiceComparisonLayout(page, width);
      assert.equal(await page.locator('.media-advice-variant-select').count(),0);
      assert.match(await page.locator('.media-advice-answer').innerText(),/Prime Video.*українськ(?:е аудіо|ою доріжкою)/);
      const beforeVariants=calls.filter(c=>c.action==='discover').length;
      const beforeVariantWrites=await page.evaluate(()=>authoredDBWrites.length);
      const rakuten=page.locator('.media-advice-row[data-provider-key="rakuten"]');
      assert.doesNotMatch(await page.locator('.media-advice-options').innerText(),/Ціна|1\.23|XXX|TMDb|JustWatch|Movie of the Night/);
      assert.equal(await page.getByRole('button',{name:'Обрати',exact:true}).count(),1);
      assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),1);
      assert.equal(await page.locator('.media-advice-row img.media-advice-provider-icon').count(),3);
      assert.equal(await page.locator('.media-advice-legend').count(),1);
      assert.equal(await page.locator('.media-advice-legend').evaluate(e=>e.open),false);
      assert.equal(await page.locator('.media-advice-comparison-caution').count(),0);
      assert.equal(await page.locator('.media-advice-chat .mykola-message-row').last().getByRole('button',{name:'Діагностичний звіт'}).count(),1);
      const beforeReport = calls.filter(c=>c.action==='discover').length;
      await page.getByRole('button',{name:'Діагностичний звіт'}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Mapped source rows: 8/);
      await page.getByText('Джерельні деталі варіантів',{exact:true}).click();
      assert.equal(await page.locator('.media-advice-diagnostics details pre').count(),8,'all eight original rows remain in diagnostics');
      assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/Укр\. звук \(dolby\)/);
      assert.match(await page.locator('.media-advice-diagnostics details').innerText(),/Kinobaza|kinobaza/);
      assert.doesNotMatch(await page.locator('.media-advice-diagnostics details').innerText(),/https?:|href|AUTHOR%/);
      if (process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({ path:`${process.env.M4_SCREENSHOT_DIR}/authored-report-420.png`,animations:'disabled' });
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeReport);
      await page.getByRole('button',{name:'← До порад'}).click();
      const selectedRow=authored.rows.find(r=>r.id==='motn:rakuten-rent');
      assert.equal(await rakuten.getAttribute('data-row-id'),selectedRow.id);
      await rakuten.locator('.media-advice-service-select').click();
      assert.equal(await rakuten.locator('.media-advice-service-select').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.media-advice-service-select[aria-pressed="true"]').count(),1,'service selection remains explicit with emblem-only mobile buttons');
      const offerSelect=page.getByLabel('Посилання сервісу Rakuten TV');
      assert.equal(await offerSelect.locator('option').count(),3,'four Rakuten rows expose only their three different admissible literal links');
      assert.doesNotMatch(await offerSelect.innerText(),/Оренда|Купівля|TMDb|Movie of the Night|kinobaza:|motn:/,'the choice describes links, not internal offer rows');
      assert.match(await offerSelect.innerText(),/Посилання 1/);assert.match(await offerSelect.innerText(),/Посилання 3/);
      const originalConflict=authored.rows.find(r=>r.id==='motn:rakuten-conflict');
      await offerSelect.selectOption('2');
      assert.equal(await rakuten.getAttribute('data-row-id'),originalConflict.id);
      await page.getByRole('button',{name:'Відкрити посилання',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>authoredOpened.at(-1)),[originalConflict.link.href,'_blank','noopener,noreferrer']);
      await offerSelect.selectOption('0');
      assert.equal(await rakuten.getAttribute('data-row-id'),selectedRow.id);
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/compact-distinct-links-${width}.png`,animations:'disabled'});
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

      // The Supergirl-shaped eight original rows still yield three services;
      // four Rakuten rent/buy/block rows with one exact URL need no chooser.
      authored.rows=authoredGroupedMediaRows();
      for(const row of authored.rows.filter(row=>row.provider.key==='rakuten')) row.link.href=selectedRow.link.href;
      const beforeSharedCalls=calls.filter(c=>c.action==='discover').length;
      await page.evaluate(()=>startEditMovie('list'));await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-answer').waitFor();
      assert.equal(await page.locator('.media-advice-row').count(),3);
      await page.locator('.media-advice-row[data-provider-key="rakuten"] .media-advice-service-select').click();
      assert.equal(await page.locator('.media-advice-link-select').count(),0,'four duplicate Rakuten URLs do not create a user-facing choice');
      assert.equal(await page.locator('.media-advice-variant-select').count(),0);
      assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),1);
      assert.equal(await page.getByRole('button',{name:'Обрати',exact:true}).count(),1);
      await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Mapped source rows: 8/);
      await page.getByText('Джерельні деталі варіантів',{exact:true}).click();
      assert.equal(await page.locator('.media-advice-diagnostics details pre').count(),8);
      await page.getByRole('button',{name:'← До порад',exact:true}).click();
      await page.getByRole('button',{name:'Відкрити посилання',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>authoredOpened.at(-1)),[selectedRow.link.href,'_blank','noopener,noreferrer']);
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/compact-one-link-${width}.png`,animations:'disabled'});
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      await page.locator('.media-advice-preview').getByText('Повні адреси',{exact:true}).click();
      assert.ok((await page.locator('.media-advice-preview details').innerText()).includes(selectedRow.link.href));
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeVariantWrites,'link opening and preview do not write to the Wishlist');
      await page.getByRole('button',{name:'Перенести в картку',exact:true}).click();
      await page.waitForFunction(()=>!mediaAdviceController.dialog.open);
      assert.equal(await page.locator('#purchase_url').inputValue(),selectedRow.link.href);
      assert.equal(await page.locator('#recommended_medium').inputValue(),'Rakuten TV');
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeVariantWrites,'transfer still changes local form fields only');
      await page.locator('#mediaAdviceEntry').click();
      assert.equal(await page.locator('.media-advice-link-select').count(),0);
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeSharedCalls+1,'link deduplication, diagnostic access and reopen add no discovery');

      // Actual authored HTML -> extraction -> projection, with separate own
      // provider blocks and no country-section pointer or source HTTP request.
      const kino=await authoredDuneMediaResult();
      // Deliberately authored positive film-level metadata: it stays in the
      // safe report, never adds a separate recommendation bubble or offer track.
      kino.filmLocalization={ukrainianAudio:{state:'reported-positive'}};
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
      assert.doesNotMatch(await page.locator('.media-advice-chat').innerText(),/Є згадка про українське аудіо для фільму загалом/);
      assert.equal(await page.locator('.media-advice-legend').evaluate(e=>e.open),false);
      assert.equal(await page.locator('.media-advice-attribution').evaluate(e=>e.open),false);
      assert.match(await page.locator('.media-advice-answer').innerText(),/Apple TV.*українськ(?:е аудіо|ою доріжкою)/);
      const kinoOrder=await page.locator('.media-advice-row').evaluateAll(cards=>cards.map(c=>c.dataset.providerKey));
      assert.deepEqual([...kinoOrder].sort(),['apple','megogo','rakuten']);
      const apple=page.locator('.media-advice-row[data-provider-key="apple"]');
      assert.deepEqual(kinoOrder,['apple','rakuten','megogo'],'language category first, then the agreed service priorities');
      await assertServiceComparisonLayout(page, width);
      assert.equal(await apple.locator('th[scope=row]').count(),1);assert.equal(await apple.locator('td').count(),3);
      assert.equal(await apple.locator('td').nth(1).innerText(),'+');
      assert.equal(await apple.locator('td').nth(2).innerText(),'−');
      assert.match(await apple.locator('td').nth(1).getAttribute('aria-label')??await apple.locator('td').nth(1).locator('[aria-label]').getAttribute('aria-label'),/українське аудіо|Кінобаз/i);
      assert.match(await apple.locator('td').nth(2).getAttribute('aria-label')??await apple.locator('td').nth(2).locator('[aria-label]').getAttribute('aria-label'),/субтитр|відсут|познач/i);
      for(const key of ['rakuten','megogo']) {
        const card=page.locator(`.media-advice-row[data-provider-key="${key}"]`);
        assert.equal(await card.locator('td').nth(1).innerText(),'+');
        assert.equal(await card.locator('td').nth(2).innerText(),'+');
      }
      for(const card of await page.locator('.media-advice-row').all()) {
        assert.doesNotMatch(await card.locator('th[scope=row]').innerText(),/◐/,'the availability symbol no longer shares the service column');
        assert.equal(await card.locator('td').nth(0).innerText(),'◐','a Kinobaza block is partial availability evidence in its own column');
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
        await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/natural-dialog-${width}.png`,animations:'disabled'});
        await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/mobile-service-icons-${width}.png`,animations:'disabled'});
        await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-dialog-${width}.png`,animations:'disabled'});
        await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-table-${width}.png`,animations:'disabled'});
      }
      await page.getByRole('button',{name:'Діагностичний звіт',exact:true}).click();
      assert.match(await page.getByLabel('Короткий звіт для копіювання').inputValue(),/Film-level UA audio badge: reported-positive; not provider tracks\./);
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
      // A genuinely failed emblem request must reveal a readable full-name
      // fallback, not a broken-image-only button. A new explicit form session
      // remounts the images; choosing/reopening still adds no source discovery.
      let failedEmblems=0;
      const failEmblem=route=>{failedEmblems++;return route.abort();};
      // Retain the selected film binding from the preceding authored Dune run.
      authored.rows=authoredGroupedMediaRows().map(row=>({...row,filmId:authored.film.id}));
      const beforeFallbackCalls=calls.filter(c=>c.action==='discover').length;
      const beforeFallbackWrites=await page.evaluate(()=>authoredDBWrites.length);
      await page.evaluate(()=>startEditMovie('list'));await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-answer').waitFor();
      assert.equal(await page.locator('.media-advice-service-select').count(),3,'the fallback fixture belongs to the current selected film');
      // Force an actual local asset failure, not a decoded image-cache hit.
      // This query exists only in the test; production SVG URLs stay unchanged.
      await context.route('**/assets/icons/media/*.svg?authored-failure=1',failEmblem);
      await page.locator('.media-advice-provider-icon').evaluateAll(images=>images.forEach(image=>image.src=new URL(image.src).pathname+'?authored-failure=1'));
      await page.waitForFunction(()=>document.querySelectorAll('.media-advice-service-select[data-icon-state="failed"]').length===3);
      assert.equal(failedEmblems,3,'failed state comes from three actual locally aborted emblem requests');
      const fallbackServices=await page.locator('.media-advice-service-select').evaluateAll(buttons=>buttons.map(button=>{
        const name=button.querySelector('.media-advice-service-name'),r=name.getBoundingClientRect();
        const image=button.querySelector('.media-advice-provider-icon');
        return {name:name.textContent,label:button.getAttribute('aria-label'),width:r.width,height:r.height,imageShown:image.getBoundingClientRect().width>0&&getComputedStyle(image).display!=='none'};
      }));
      for(const service of fallbackServices) {
        assert.equal(service.label,service.name);assert.ok(service.width>1&&service.height>1,'full service name is visible when its emblem fails');
        assert.equal(service.imageShown,false,'failed emblem is not displayed beside the fallback');
        assert.equal(await page.getByRole('button',{name:service.name,exact:true}).count(),1);
      }
      await assertColumnRhythm(page,width,'failed');
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),true);
      const fallbackPrime=page.getByRole('button',{name:'Prime Video',exact:true});
      await fallbackPrime.focus();await fallbackPrime.press('Enter');
      assert.equal(await fallbackPrime.getAttribute('aria-pressed'),'true');
      assert.match(await page.locator('.media-advice-actions').innerText(),/Обраний сервіс: Prime Video/);
      await page.getByRole('button',{name:'Обрати',exact:true}).click();
      await page.locator('.media-advice-preview').waitFor();
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeFallbackWrites,'fallback selection and preview stay local');
      await page.getByRole('button',{name:'Скасувати вибір',exact:true}).click();
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-fallback-${width}.png`,animations:'disabled'});
      await page.getByRole('button',{name:'← До картки',exact:true}).click();await page.locator('#mediaAdviceEntry').click();
      assert.equal(await page.locator('.media-advice-service-select[data-icon-state="failed"]').count(),3);
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeFallbackCalls+1,'new explicit form session searches once; icon failure, keyboard choice and reopen do not search again');
      assert.equal(failedEmblems,3,'reopening retains the fallback without reloading the emblem');
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      await context.unroute('**/assets/icons/media/*.svg?authored-failure=1',failEmblem);
    }
    if (width > 480) {
      // The same three authored blocks also exercise the actual tablet/desktop
      // layout, rather than deriving wide-view assertions from a one-row table.
      allowed = true;
      const savedResult={...authored}, savedMovie=await page.evaluate(()=>({...movies[0]}));
      const kino=await authoredDuneMediaResult();
      Object.assign(authored,kino);
      const beforeWideCalls=calls.filter(c=>c.action==='discover').length;
      const beforeWideWrites=await page.evaluate(()=>authoredDBWrites.length);
      await page.evaluate(film=>{
        Object.assign(movies[0],{title:film.title,year:film.year,imdb_url:`https://imdb.com/title/${film.imdbId}`});
        startEditMovie('list');
      },kino.film);
      await page.locator('#mediaAdviceEntry').click();await page.locator('.media-advice-answer').waitFor();
      await assertServiceComparisonLayout(page,width);
      assert.equal(await page.locator('.media-advice-row').count(),3);
      const rakuten=page.getByRole('button',{name:'Rakuten TV',exact:true});
      await rakuten.focus();await rakuten.press('Space');
      assert.equal(await rakuten.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.media-advice-service-select[aria-pressed="true"]').count(),1);
      if(process.env.M4_SCREENSHOT_DIR) {
        await page.evaluate(()=>mediaAdviceController.dialog.scrollTop=0);
        await page.locator('.media-advice-dialog').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-dialog-${width}.png`,animations:'disabled'});
        await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-table-${width}.png`,animations:'disabled'});
      }
      if(width===1280) {
        const beforeResizeCalls=calls.filter(c=>c.action==='discover').length;
        const beforeResizeWrites=await page.evaluate(()=>authoredDBWrites.length);
        // Exercise the narrowest width and both sides of the name breakpoint
        // on this same in-memory result, without another discovery fixture.
        for(const resizedWidth of [320,480,481,600,640,641,700]) {
          await page.setViewportSize({width:resizedWidth,height:900});
          await assertServiceComparisonLayout(page,resizedWidth);
          assert.equal(await rakuten.getAttribute('aria-pressed'),'true');
          if(process.env.M4_SCREENSHOT_DIR) {
            await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-table-${resizedWidth}.png`,animations:'disabled'});
          }
        }
        await page.setViewportSize({width,height});
        await assertServiceComparisonLayout(page,width);
        assert.equal(calls.filter(c=>c.action==='discover').length,beforeResizeCalls,'responsive reflow reuses the same result without discovery');
        assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeResizeWrites,'responsive reflow performs no save');
      }
      await page.getByRole('button',{name:'← До картки',exact:true}).click();await page.locator('#mediaAdviceEntry').click();
      assert.equal(await rakuten.getAttribute('aria-pressed'),'true','keyboard selection survives reopening on tablet and desktop');
      assert.equal(calls.filter(c=>c.action==='discover').length,beforeWideCalls+1);
      assert.equal(await page.evaluate(()=>authoredDBWrites.length),beforeWideWrites);
      const failEmblem=route=>route.abort();
      await context.route('**/assets/icons/media/*.svg?authored-wide-failure=1',failEmblem);
      // A single failed emblem must not pull its fallback name into the icon
      // column while the remaining emblem/name pairs keep their common axes.
      await page.locator('.media-advice-row[data-provider-key="apple"] .media-advice-provider-icon').evaluate(image=>image.src=new URL(image.src).pathname+'?authored-wide-failure=1');
      await page.waitForFunction(()=>document.querySelectorAll('.media-advice-service-select[data-icon-state="failed"]').length===1);
      await assertColumnRhythm(page,width,'one-failed');
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-mixed-fallback-${width}.png`,animations:'disabled'});
      await page.locator('.media-advice-service-select[data-icon-state="loaded"] .media-advice-provider-icon').evaluateAll(images=>images.forEach(image=>image.src=new URL(image.src).pathname+'?authored-wide-failure=1'));
      await page.waitForFunction(()=>document.querySelectorAll('.media-advice-service-select[data-icon-state="failed"]').length===3);
      for(const fallback of await page.locator('.media-advice-service-select').all()) {
        assert.equal(await fallback.locator('.media-advice-service-name').isVisible(),true);
        assert.equal(await fallback.locator('.media-advice-provider-icon').isVisible(),false);
        const name=await fallback.locator('.media-advice-service-name').innerText();
        assert.equal(await fallback.getAttribute('aria-label'),name);
      }
      await assertColumnRhythm(page,width,'failed');
      if(width===1280) {
        for(const resizedWidth of [481,600,641]) {
          await page.setViewportSize({width:resizedWidth,height:900});
          await assertColumnRhythm(page,resizedWidth,'failed');
        }
        await page.setViewportSize({width,height});
      }
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-fallback-${width}.png`,animations:'disabled'});
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      await context.unroute('**/assets/icons/media/*.svg?authored-wide-failure=1',failEmblem);
      for(const key of Object.keys(authored)) if(!(key in savedResult)) delete authored[key];
      Object.assign(authored,savedResult);
      await page.evaluate(movie=>Object.assign(movies[0],movie),savedMovie);
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
      await assertServiceComparisonLayout(page, width);
      if(process.env.M4_SCREENSHOT_DIR) await page.locator('.media-advice-comparison').screenshot({path:`${process.env.M4_SCREENSHOT_DIR}/service-axes-all-service-emblems-${width}.png`,animations:'disabled'});
      assert.equal(await page.getByRole('table').count(),1);assert.equal(await page.getByRole('columnheader').count(),4);
      assert.equal(await page.getByRole('button',{name:'Обрати',exact:true}).count(),1);
      assert.equal(await page.getByRole('button',{name:'Відкрити посилання',exact:true}).count(),0,'missing links never create an opening action');
      assert.equal(await page.locator('.media-advice-link-select').count(),0,'zero admissible links need no selector');
      const tiedRankCalls=calls.filter(c=>c.action==='discover').length;
      await page.locator('.media-advice-row[data-provider-key="megogo"] .media-advice-service-select').click();
      assert.equal(calls.filter(c=>c.action==='discover').length,tiedRankCalls,'choosing a service cannot search again');
      await page.getByRole('button',{name:'← До картки',exact:true}).click();
      authored.rows=freshServiceRows().map(row=>({...row,audio:row.provider.key==='netflix'?sourceLanguage():{state:'unknown'},subtitles:row.provider.key==='prime'?sourceLanguage():{state:'unknown'}}));
      await page.evaluate(()=>startEditMovie('list'));await page.locator('#mediaAdviceEntry').click();await page.locator('.media-advice-answer').waitFor();
      assert.deepEqual(await page.locator('.media-advice-row').evaluateAll(rows=>rows.map(r=>r.dataset.providerKey)),['netflix','prime','apple','rakuten','hbo','megogo']);
      assert.match(await page.locator('.media-advice-answer').innerText(),/Netflix.*українськ(?:е аудіо|ою доріжкою)/);
      const unknownAudio=page.locator('.media-advice-row[data-provider-key="apple"] td').nth(1);
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
          assert.equal(await page.locator('.media-advice-link-select').count(),0,'an unsafe URL is not offered as a choice');
          assert.equal(await page.evaluate(()=>authoredOpened.length),1);
        }
        if (kind === 'unbound-localization') {
          const cell=page.locator('.media-advice-row td').nth(1);
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
          const cell=page.locator('.media-advice-row td').nth(1);
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

