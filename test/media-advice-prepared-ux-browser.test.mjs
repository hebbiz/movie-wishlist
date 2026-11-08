import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Actual local app, authored source-shaped rows and mocked authorization. No
// source APIs, platform pages, real accounts or database writes are involved.
const film = { id: 'imdb:tt21103218', imdbId: 'tt21103218', title: 'The Lost Bus', year: 2025 };
const secondFilm = { id: 'imdb:tt0081505', imdbId: 'tt0081505', title: 'The Shining', year: 1980 };
const unknown = () => ({ state: 'unknown', evidence: [] });
const plusURL = suffix => `https://tv.apple.com/ua/movie/authored-${suffix}/umc.cmc.authored${suffix}?at=AUTHORED%2f${suffix}#Exact`;
const rowsFor = f => [
  ...['first', 'second'].map(suffix => ({ id: `motn:plus:${suffix}`, filmId: f.id, identityStatus: 'matched', country: 'UA',
    provider: { key: 'appletvplus', sourceName: 'Apple TV+' }, access: { state: 'reported', value: 'subscription' },
    audio: unknown(), subtitles: unknown(), provenance: { source: 'Movie of the Night' }, conflicts: [], link: { href: plusURL(suffix) } })),
  { id: 'kinobaza:megogo', filmId: f.id, identityStatus: 'matched', country: 'UA',
    provider: { key: 'megogo', sourceName: 'MEGOGO' }, access: { state: 'reported', value: 'subscription' },
    audio: unknown(), subtitles: unknown(), provenance: { source: 'Kinobaza HTML' }, conflicts: [],
    link: { href: 'https://megogo.net/ua/view/123456-authored.html?utm_source=AUTHORED%2fExact#Keep' } },
];
const sdkStub = `
window.authoredDBWrites=[]; window.authoredLogin=false; window.authoredUser='user-a'; window.authoredRole='owner';
window.authoredSessionReads=0; window.authoredSessionControls=[];
window.supabase={createClient:()=>({
  auth:{
    getSession:async()=>{
      window.authoredSessionReads++;
      if(window.authoredSessionQueue) return await new Promise((resolve,reject)=>window.authoredSessionControls.push({resolve,reject}));
      if(window.authoredSessionDelay) await new Promise(resolve=>window.authoredSessionRelease=resolve);
      return {data:{session:window.authoredLogin?{access_token:'AUTHORED',user:{id:window.authoredUser}}:null}};
    },
    getUser:async()=>({data:{user:window.authoredLogin?{id:window.authoredUser}:null}}),
    onAuthStateChange:fn=>{window.authoredAuthEvent=fn;return {data:{subscription:{unsubscribe(){}}}};}
  },
  from:name=>({
    select:()=>{const q={eq:()=>q,maybeSingle:async()=>{if(window.authoredRoleDelay) await new Promise(resolve=>window.authoredRoleRelease=resolve);return {data:{role:window.authoredRole}};}};return q;},
    insert:fields=>{window.authoredDBWrites.push({name,fields});throw Error('Authored Save forbidden');},
    update:fields=>{window.authoredDBWrites.push({name,fields});throw Error('Authored Save forbidden');}
  })
})};`;

test('prepared Mykola UX: local browser controls, cold cache and deliberately pending SVGs',
  { skip: !process.env.PLAYWRIGHT_MODULE_PATH, timeout: 115000 }, async t => {
    const root = resolve(import.meta.dirname, '..');
    const server = createServer(async (req, res) => {
      try {
        const file = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
        if (!file.startsWith(root + sep)) throw Error('outside fixture');
        res.setHeader('Cache-Control', 'no-store');
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

    async function setup(t, width, options = {}) {
      const state = { discoveries: 0, capabilities: [], iconRequests: [], blockedRemote: [],
        capabilityMode: options.capabilityMode ?? 'allow', iconMode: options.iconMode ?? 'normal',
        holdDiscover: options.holdDiscover ?? false, holdModule: options.holdModule ?? false,
        pendingModules: [], pendingCapabilities: [], pendingIcons: [], pendingDiscoveries: [] };
      const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 }, serviceWorkers: 'block' });
      // Install before module defaults capture Date.now. Only this authored
      // wall clock moves; real timers/deadlines and performance.now stay real.
      await context.addInitScript(() => {
        const realNow = Date.now.bind(Date); window.authoredClockOffset = 0;
        Date.now = () => realNow() + window.authoredClockOffset;
      });
      t.after(async () => { state.releaseModules?.(); state.releaseCapabilities?.(); state.releaseIcons?.(); state.releaseDiscoveries?.(); await context.close(); });
      state.releaseModules = () => state.pendingModules.splice(0).forEach(resolve => resolve());
      state.releaseCapabilities = () => state.pendingCapabilities.splice(0).forEach(resolve => resolve());
      state.releaseIcons = () => state.pendingIcons.splice(0).forEach(resolve => resolve());
      state.releaseDiscoveries = () => state.pendingDiscoveries.splice(0).forEach(resolve => resolve());
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: sdkStub });
        if (url.origin !== origin) { state.blockedRemote.push(url.hostname); return route.abort(); }
        if (url.pathname === '/assets/media-advice.mjs' && state.holdModule) {
          await new Promise(resolve => state.pendingModules.push(resolve));
          return route.fulfill({ contentType: 'text/javascript', body: await readFile(resolve(root, '.' + url.pathname)) });
        }
        if (url.pathname.startsWith('/assets/icons/media/') && url.pathname.endsWith('.svg')) {
          state.iconRequests.push({ path: url.pathname, at: Date.now(), discoveries: state.discoveries });
          const mode = state.iconMode;
          if (mode === 'hold') await new Promise(resolve => state.pendingIcons.push(resolve));
          if (mode === 'fail') return route.abort('failed');
          return route.fulfill({ contentType: 'image/svg+xml', body: await readFile(resolve(root, '.' + url.pathname)) });
        }
        if (url.pathname === '/.netlify/functions/media-advice') {
          const body = route.request().postDataJSON();
          if (body.action === 'capability') {
            const mode = state.capabilityMode; state.capabilities.push(body);
            if (mode.startsWith('hold')) await new Promise(resolve => state.pendingCapabilities.push(resolve));
            if (mode.endsWith('deny')) return route.fulfill({ status: 403, json: { status: 'access-unavailable' } });
            if (mode === 'fail') return route.abort('failed');
            return route.fulfill({ json: { mykola_media_advice: true, mykola_media_advice_diagnostics: false } });
          }
          state.discoveries++;
          if (state.holdDiscover) await new Promise(resolve => state.pendingDiscoveries.push(resolve));
          const selected = body.imdbId === secondFilm.imdbId ? secondFilm : film;
          return route.fulfill({ json: { result: { film: selected, rows: rowsFor(selected), unmapped: [], sources: [],
            capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: false } } } });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('dialog', dialog => dialog.accept());
      await page.goto(origin + '/app.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof startEditMovie === 'function');
      if (!options.holdModule) await page.waitForFunction(() => !!mediaAdviceController);
      await page.evaluate(({ film, secondFilm }) => {
        document.getElementById('appLoader').style.display = 'none'; mainView.style.display = 'block';
        currentUser = { id: 'user-a' }; currentRole = 'owner'; currentGroupId = 'group-a'; window.authoredLogin = true;
        window.authoredOpened = []; window.open = (...args) => { authoredOpened.push(args); return null; };
        movies = [film, secondFilm].map((f, index) => ({ id: `list-${index}`, group_id: 'group-a', imdb_url: `https://imdb.com/title/${f.imdbId}`,
          title: f.title, year: f.year, status: 'wishlist', recommended_medium: 'DVD', purchase_url: '', added_by: 'Authored' }));
      }, { film, secondFilm });
      return { page, state };
    }
    const service = (page, key) => page.locator(`[data-provider-key="${key}"] .media-advice-service-select`);
    async function openCard(page, index = 0) {
      await page.evaluate(i => startEditMovie(`list-${i}`), index);
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
    }
    async function snapshot(page, name) {
      if (process.env.M4_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/${name}.png`, animations: 'disabled' });
    }
    async function assertLayout(page) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal viewport overflow');
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
      for (const key of ['apple', 'megogo']) {
        const rect = await service(page, key).boundingBox();
        assert.ok(rect.width >= 44 && rect.height >= 44, 'service selection remains a usable touch target');
      }
    }
    async function transferSecondApple(page, state) {
      await service(page, 'apple').click();
      const select = page.locator('.media-advice-link-select');
      assert.equal(await select.locator('option').count(), 2, 'independent authored subscription addresses stay separate');
      for (const index of ['1', '0', '1']) await select.selectOption(index);
      assert.equal(await page.locator('.media-advice-actions .media-advice-link-address p').textContent(), plusURL('second'));
      await page.getByRole('button', { name: 'Відкрити посилання', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => authoredOpened.at(-1)), [plusURL('second'), '_blank', 'noopener,noreferrer']);
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.getByText('Повні адреси', { exact: true }).click();
      assert.ok((await page.locator('.media-advice-preview').innerText()).includes(plusURL('second')));
      await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
      await page.waitForFunction(() => !mediaAdviceController.dialog.open);
      assert.equal(await page.locator('#recommended_medium').inputValue(), 'Apple TV / iTunes');
      assert.equal(await page.locator('#purchase_url').inputValue(), plusURL('second'), 'exact source URL survives transfer');
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0);
      await page.locator('#mediaAdviceEntry').click();
      assert.equal(state.discoveries, 1, 'preview, repeated selection and reopen do not rediscover');
    }

    for (const width of [375, 1280]) await t.test(`cold cache pending icons / ${width}px`, async t => {
      const { page, state } = await setup(t, width, { iconMode: 'hold', holdDiscover: true });
      await openCard(page);
      assert.equal(state.discoveries, 0, 'warming access does not search');
      await page.locator('#mediaAdviceEntry').click();
      await page.locator('.mykola-typing-bubble').waitFor();
      await page.waitForFunction(() => document.querySelectorAll('link[rel="preload"][as="image"][href^="/assets/icons/media/"]').length === 6);
      assert.ok(state.iconRequests.length > 0, 'local SVG loading starts while discovery is still pending');
      assert.equal(await page.locator('.media-advice-comparison').count(), 0);
      state.holdDiscover = false; state.releaseDiscoveries();
      await page.locator('.media-advice-comparison').waitFor({ timeout: 2000 });
      assert.equal(await service(page, 'apple').getAttribute('data-icon-state'), 'pending');
      assert.equal(await service(page, 'apple').getAttribute('aria-label'), 'Apple TV / iTunes');
      assert.equal(await service(page, 'megogo').getAttribute('aria-label'), 'MEGOGO');
      if (width <= 480) assert.ok(await service(page, 'apple').locator('.media-advice-service-name').evaluate(name => name.getBoundingClientRect().width <= 1), 'mobile pending state never presents a temporary full text label');
      await assertLayout(page); await snapshot(page, `prepared-icons-pending-${width}`);
      state.iconMode = 'normal'; state.releaseIcons();
      await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-service-select')].every(button => button.dataset.iconState === 'loaded'));
      await assertLayout(page); await snapshot(page, `prepared-icons-loaded-${width}`);
      await transferSecondApple(page, state);
    });

    await t.test('failed local icons show an accessible text fallback without delaying results', async t => {
      const { page, state } = await setup(t, 375, { iconMode: 'fail' });
      await openCard(page); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-service-select')].every(button => button.dataset.iconState === 'failed'));
      assert.equal(await service(page, 'apple').getAttribute('aria-label'), 'Apple TV / iTunes');
      assert.ok(await service(page, 'apple').locator('.media-advice-service-name').evaluate(name => name.getBoundingClientRect().width > 1));
      await assertLayout(page); await snapshot(page, 'prepared-icons-failed-375');
      await transferSecondApple(page, state);
    });

    await t.test('permanently pending icons have a bounded fallback and cannot replace it with late icons', async t => {
      const { page, state } = await setup(t, 375, { iconMode: 'hold' });
      await openCard(page); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor({ timeout: 2000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-service-select')].every(button => button.dataset.iconState === 'failed'), null, { timeout: 7000 });
      state.iconMode = 'normal'; state.releaseIcons();
      await page.waitForFunction(() => [...document.querySelectorAll('.media-advice-provider-icon')].every(image => image.complete));
      assert.equal(await service(page, 'apple').getAttribute('data-icon-state'), 'failed', 'terminal fallback is stable after a late SVG load');
      assert.ok(await service(page, 'apple').locator('.media-advice-service-name').evaluate(name => name.getBoundingClientRect().width > 1));
      assert.equal(state.discoveries, 1);
    });

    for (const width of [375, 1280]) await t.test(`prepared access is visible in the card opening turn / ${width}px`, async t => {
      const { page, state } = await setup(t, width);
      await page.waitForFunction(() => typeof prepareMediaAdviceAccess === 'function');
      await page.evaluate(() => prepareMediaAdviceAccess());
      assert.ok(state.capabilities.length > 0, 'server capability is prepared before the movie form is open');
      assert.equal(state.discoveries, 0);
      const opened = await page.evaluate(() => {
        startEditMovie('list-0');
        return { formVisible: formPanel.style.display !== 'none', entryVisible: !document.getElementById('mediaAdviceEntry').hidden };
      });
      assert.deepEqual(opened, { formVisible: true, entryVisible: true }, 'a confirmed, same-scope display hint avoids a later layout jump');
      await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor();
      await page.getByRole('button', { name: '← До картки', exact: true }).click();
      await page.evaluate(() => startEditMovie('list-1'));
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
      assert.equal(state.discoveries, 1, 'switching films prepares access, never performs a search');
      await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-film').filter({ hasText: secondFilm.title }).waitFor();
      await page.locator('.media-advice-comparison').waitFor();
      assert.equal(state.discoveries, 2, 'only the explicit click discovers the new film');
      await assertLayout(page); await snapshot(page, `prepared-access-${width}`);
    });

    for (const mode of ['hold-deny', 'fail']) await t.test(`${mode} capability never holds the ordinary movie card open`, async t => {
      const { page, state } = await setup(t, 375, { capabilityMode: mode });
      await page.evaluate(() => { window.authoredPreparation = prepareMediaAdviceAccess(); startEditMovie('list-0'); });
      assert.equal(await page.locator('#title').inputValue(), film.title);
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(await page.locator('#submitButton').isEnabled(), true, 'ordinary form actions stay available');
      state.releaseCapabilities();
      await page.evaluate(() => Promise.resolve(window.authoredPreparation));
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(state.discoveries, 0);
    });

    await t.test('a permanently stalled capability expires without delaying the ordinary form', async t => {
      const { page, state } = await setup(t, 375, { capabilityMode: 'hold' });
      await page.evaluate(() => { window.authoredPreparationDone = false; window.authoredPreparation = prepareMediaAdviceAccess().finally(() => { authoredPreparationDone = true; }); startEditMovie('list-0'); });
      assert.equal(await page.locator('#title').inputValue(), film.title);
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      await page.waitForFunction(() => authoredPreparationDone, null, { timeout: 6500 });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(await page.locator('#submitButton').isEnabled(), true);
      assert.equal(state.discoveries, 0);
      state.releaseCapabilities();
    });

    await t.test('the capability deadline also covers a stalled local auth session read', async t => {
      const { page, state } = await setup(t, 375);
      await page.evaluate(() => {
        authoredSessionDelay = true; window.authoredPreparationDone = false; window.authoredPreparationStarted = performance.now();
        window.authoredPreparation = prepareMediaAdviceAccess({ force: true }).finally(() => { authoredPreparationDone = true; });
        startEditMovie('list-0');
      });
      assert.equal(await page.locator('#title').inputValue(), film.title);
      await page.waitForFunction(() => typeof authoredSessionRelease === 'function');
      await page.waitForFunction(() => authoredPreparationDone, null, { timeout: 6500 });
      assert.ok(await page.evaluate(() => performance.now() - authoredPreparationStarted >= 3900), 'the authored auth delay exercised the capability deadline');
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(await page.locator('#submitButton').isEnabled(), true);
      assert.equal(state.capabilities.length, 0, 'a missing session cannot send a capability request');
      await page.evaluate(async () => {
        authoredSessionDelay = false; authoredSessionRelease();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(state.capabilities.length, 0, 'late auth resolution cannot send an expired request');
      assert.equal(state.discoveries, 0);
    });

    for (const staleOutcome of ['resolve', 'reject']) await t.test(`a new auth read recovers after the previous getSession deadline / late ${staleOutcome}`, async t => {
      const { page, state } = await setup(t, 375);
      await page.evaluate(() => {
        window.authoredSessionQueue = true; window.authoredFirstReadDone = false;
        window.authoredRecoveryReadBaseline = authoredSessionReads;
        window.authoredFirstRead = prepareMediaAdviceAccess({ force: true }).finally(() => { authoredFirstReadDone = true; });
        startEditMovie('list-0');
      });
      await page.waitForFunction(() => authoredSessionControls.length === 1);
      await page.waitForFunction(() => authoredFirstReadDone, null, { timeout: 6500 });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(state.capabilities.length, 0, 'the expired raw auth read has not authorized HTTP');
      await page.evaluate(() => {
        window.authoredRecoveryDone = false;
        window.authoredRecovery = Promise.all([
          prepareMediaAdviceAccess({ force: true }), prepareMediaAdviceAccess({ force: true }),
          mediaAdviceController.refresh(), mediaAdviceController.refresh(),
        ]).finally(() => { authoredRecoveryDone = true; });
      });
      await page.waitForFunction(() => authoredSessionControls.length === 2, null, { timeout: 1800 });
      assert.equal(await page.evaluate(() => authoredSessionReads - authoredRecoveryReadBaseline), 2,
        'simultaneous preparation and exact refresh share one fresh bounded SDK read');
      assert.equal(state.capabilities.length, 0, 'the new shared read is held independently of the old read');
      if (staleOutcome === 'reject') {
        await page.evaluate(() => { window.authoredFreshFlight = mediaAdviceSession(); });
        await page.evaluate(async () => {
          authoredSessionControls[0].reject(new Error('Authored late session rejection'));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          // Late settlement must not clear the newer in-flight singleflight.
          window.authoredThirdRefresh = mediaAdviceController.refresh();
          window.authoredThirdPrepare = prepareMediaAdviceAccess({ force: true });
        });
        assert.equal(await page.evaluate(() => mediaAdviceSession() === authoredFreshFlight), true,
          'late settlement cannot detach the replacement shared read, independently of consumer-level deduplication');
        assert.equal(await page.evaluate(() => authoredSessionControls.length), 2,
          'the obsolete rejection cannot detach the fresh pending read');
      }
      await page.evaluate(() => authoredSessionControls[1].resolve({ data: { session: { access_token: 'AUTHORED', user: { id: 'user-a' } } } }));
      await page.waitForFunction(() => authoredRecoveryDone);
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => mediaAdviceAccessPreparation.peek(mediaAdviceContext())), true);
      assert.equal(state.discoveries, 0, 'recovering permission does not itself search');
      assert.equal(state.capabilities.length, 2, 'one prepared-scope and one exact-context check recover, without duplicate HTTP');
      const recoveredCapabilityCount = state.capabilities.length;
      if (staleOutcome === 'resolve') await page.evaluate(async () => {
        authoredSessionControls[0].resolve({ data: { session: { access_token: 'AUTHORED-OLD', user: { id: 'old-user' } } } });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), true, 'stale auth cannot clear a recovered entry');
      assert.equal(await page.evaluate(() => mediaAdviceAccessPreparation.peek(mediaAdviceContext())), true,
        'stale auth does not invalidate the newer prepared access hint');
      assert.equal(state.capabilities.length, recoveredCapabilityCount, 'late auth cannot start a stale capability HTTP request');
      await page.evaluate(() => { authoredSessionQueue = false; });
      await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor();
      assert.equal(state.discoveries, 1, 'the recovered entry opens on the existing page with one explicit search');
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0);
    });

    await t.test('a current capability denial stays denied when an expired getSession later succeeds', async t => {
      const { page, state } = await setup(t, 1280);
      await page.evaluate(() => {
        authoredSessionQueue = true; window.authoredOldReadDone = false;
        window.authoredOldRead = prepareMediaAdviceAccess({ force: true }).finally(() => { authoredOldReadDone = true; });
        startEditMovie('list-0');
      });
      await page.waitForFunction(() => authoredSessionControls.length === 1);
      await page.waitForFunction(() => authoredOldReadDone, null, { timeout: 6500 });
      state.capabilityMode = 'deny';
      await page.evaluate(() => {
        window.authoredCurrentDenialDone = false;
        window.authoredCurrentDenial = Promise.all([prepareMediaAdviceAccess({ force: true }), mediaAdviceController.refresh()])
          .finally(() => { authoredCurrentDenialDone = true; });
      });
      await page.waitForFunction(() => authoredSessionControls.length === 2, null, { timeout: 1800 });
      await page.evaluate(() => authoredSessionControls[1].resolve({ data: { session: { access_token: 'AUTHORED', user: { id: 'user-a' } } } }));
      await page.waitForFunction(() => authoredCurrentDenialDone);
      assert.ok(state.capabilities.length >= 1, 'the current server response, rather than an old local session, supplies the denial');
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      const deniedCapabilityCount = state.capabilities.length;
      await page.evaluate(async () => {
        authoredSessionControls[0].resolve({ data: { session: { access_token: 'AUTHORED-OLD', user: { id: 'user-a' } } } });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false, 'a late old success cannot resurrect denied access');
      assert.equal(await page.evaluate(() => mediaAdviceAccessPreparation.peek(mediaAdviceContext())), false);
      assert.equal(state.capabilities.length, deniedCapabilityCount);
      assert.equal(state.discoveries, 0);
    });

    await t.test('group capability starts in parallel with an unresolved role query', async t => {
      const { page, state } = await setup(t, 1280);
      await page.evaluate(() => { window.authoredRoleDelay = true; window.authoredRoleLoad = loadCurrentRole(); });
      await page.waitForFunction(() => typeof authoredRoleRelease === 'function');
      await page.evaluate(() => prepareMediaAdviceAccess());
      assert.ok(state.capabilities.length > 0, 'capability does not wait for the role response');
      await page.evaluate(() => { authoredRoleDelay = false; authoredRoleRelease(); return authoredRoleLoad; });
      await openCard(page);
      assert.equal(state.discoveries, 0);
    });

    await t.test('a delayed Mykola module never delays the movie form', async t => {
      const { page, state } = await setup(t, 375, { holdModule: true });
      await page.evaluate(() => startEditMovie('list-0'));
      assert.equal(await page.locator('#title').inputValue(), film.title);
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      state.holdModule = false; state.releaseModules();
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
      assert.equal(state.discoveries, 0);
    });

    await t.test('role and group changes cannot reuse the previous entry hint or result', async t => {
      const { page, state } = await setup(t, 1280);
      await page.evaluate(() => prepareMediaAdviceAccess());
      await openCard(page); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor();
      await page.evaluate(() => { window.authoredRole = 'visitor'; return loadCurrentRole(); });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.open), false);
      assert.equal(state.discoveries, 1);
      await page.evaluate(() => { window.authoredRole = 'owner'; return loadCurrentRole(); });
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
      state.capabilityMode = 'hold';
      await page.evaluate(() => {
        currentGroupId = 'group-b'; movies.forEach(movie => { movie.group_id = 'group-b'; });
        window.authoredRoleLoad = loadCurrentRole();
      });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false, 'scope change discards the previous group permission immediately');
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.open), false);
      state.capabilityMode = 'allow'; state.releaseCapabilities();
      await page.evaluate(() => window.authoredRoleLoad);
      await openCard(page);
      assert.ok(state.capabilities.some(request => request.groupId === 'group-b'));
      assert.equal(state.discoveries, 1, 'role/group revalidation itself never discovers');
    });

    await t.test('group capability denial immediately clears a result even while the role query is still pending', async t => {
      const { page, state } = await setup(t, 1280);
      await openCard(page); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor();
      state.capabilityMode = 'deny';
      await page.evaluate(() => {
        window.authoredRoleDelay = true; window.authoredRoleLoadDone = false;
        window.authoredRoleLoad = loadCurrentRole().finally(() => { authoredRoleLoadDone = true; });
      });
      await page.waitForFunction(() => typeof authoredRoleRelease === 'function');
      await page.waitForFunction(() => !mediaAdviceController.dialog.open);
      assert.equal(await page.evaluate(() => authoredRoleLoadDone), false, 'capability rejection does not wait for the outstanding role response');
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(await page.locator('.media-advice-comparison').count(), 0, 'private data is removed immediately');
      assert.equal(state.capabilities.at(-1).listId, null, 'this rejection comes from parallel group preparation, not a later exact-form refresh');
      assert.equal(state.discoveries, 1);
      await page.evaluate(() => { authoredRoleDelay = false; authoredRoleRelease(); return authoredRoleLoad; });
    });

    await t.test('sign out and switching users discard prepared permission and private results', async t => {
      const { page, state } = await setup(t, 375);
      await page.evaluate(() => prepareMediaAdviceAccess()); await openCard(page);
      await page.locator('#mediaAdviceEntry').click(); await page.locator('.media-advice-comparison').waitFor();
      await page.evaluate(() => {
        appHasInitialized = false; authoredLogin = false; authoredAuthEvent('SIGNED_OUT', null); currentUser = null;
      });
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.open), false);
      assert.equal(await page.locator('.media-advice-comparison').count(), 0, 'another user cannot see the prior private result');
      state.capabilityMode = 'deny';
      await page.evaluate(() => {
        authoredUser = 'user-b'; authoredLogin = true; currentUser = { id: 'user-b' }; currentRole = 'owner';
        return prepareMediaAdviceAccess();
      });
      await page.evaluate(() => startEditMovie('list-0'));
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
      assert.equal(state.discoveries, 1);
    });

    await t.test('a feature flag revocation is rechecked on click before discovery', async t => {
      const { page, state } = await setup(t, 375);
      await page.evaluate(() => prepareMediaAdviceAccess()); await openCard(page);
      state.capabilityMode = 'deny';
      await page.locator('#mediaAdviceEntry').click();
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'hidden' });
      assert.equal(state.discoveries, 0, 'display preparation cannot authorize an actual discovery');
      assert.equal(await page.locator('.media-advice-comparison').count(), 0);
    });

    await t.test('entry revalidation cannot supersede a pending authorized click or require a second click', async t => {
      const { page, state } = await setup(t, 1280);
      await page.evaluate(() => prepareMediaAdviceAccess()); await openCard(page);
      await page.evaluate(() => mediaAdviceController.refresh());
      const beforeExact = state.capabilities.filter(request => request.listId === 'list-0').length;
      state.capabilityMode = 'hold';
      const clickCapability = page.waitForRequest(request => {
        if (!request.url().endsWith('/.netlify/functions/media-advice')) return false;
        const body = request.postDataJSON(); return body.action === 'capability' && body.listId === 'list-0';
      });
      await page.locator('#mediaAdviceEntry').click(); await clickCapability;
      await page.evaluate(() => { authoredClockOffset += 31000; revalidateMediaAdviceEntry(); });
      assert.equal(await page.evaluate(() => mediaAdviceAccessPreparation.peek(mediaAdviceContext())), false,
        'the prepared display hint really expired during the pending exact click');
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), true, 'hint expiry cannot hide an entry whose click is awaiting exact authorization');
      await page.locator('#mediaAdviceEntry').click();
      assert.equal(state.discoveries, 0, 'pending authorization has not searched');
      state.capabilityMode = 'allow'; state.releaseCapabilities();
      await page.locator('.media-advice-comparison').waitFor();
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.open), true);
      assert.equal(state.discoveries, 1, 'the original permitted click completes without another discovery');
      assert.equal(state.capabilities.filter(request => request.listId === 'list-0').length, beforeExact + 1,
        'refresh and repeated click reuse the pending exact entry check');
      await page.getByRole('button', { name: '← До картки', exact: true }).click();
      assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), true, 'the freshly authorized opening leaves an entry available after closing the dialog');
    });

    await t.test('returning focus rechecks a revoked feature flag without rediscovering', async t => {
      const { page, state } = await setup(t, 1280);
      await page.evaluate(() => prepareMediaAdviceAccess()); await openCard(page);
      await page.locator('#mediaAdviceEntry').click(); await page.locator('.media-advice-comparison').waitFor();
      state.capabilityMode = 'deny';
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.media-advice-dialog').evaluate(dialog => dialog.open), false);
      assert.equal(state.discoveries, 1);
    });

    await t.test('revoked permission at preview transfer never applies its exact URL', async t => {
      const { page, state } = await setup(t, 1280);
      await openCard(page); await page.locator('#mediaAdviceEntry').click();
      await page.locator('.media-advice-comparison').waitFor();
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.locator('.media-advice-preview').waitFor();
      state.capabilityMode = 'deny';
      await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#purchase_url').inputValue(), '');
      assert.equal(await page.locator('#recommended_medium').inputValue(), 'DVD');
      assert.equal(await page.evaluate(() => authoredDBWrites.length), 0);
      assert.equal(state.discoveries, 1);
    });
    console.info('Prepared UX browser controls: source HTTP 0; real Supabase HTTP/writes 0; real platform navigation 0. Routes and permissions are authored fixtures, not live attestations.');
  });
