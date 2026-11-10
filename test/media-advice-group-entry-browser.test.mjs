import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Real local app handlers, deterministic authored auth / rights / lookup / source
// responses. The baseline is read from Git so concurrent implementation edits
// cannot change the comparison. No live credentials, accounts or database.
const baselineSHA = '1f257566326bbe5968208cb13dd3d833d7fa879e';
const film = { id: 'imdb:tt1596343', imdbId: 'tt1596343', title: 'Fast Five', year: 2011 };
const secondFilm = { id: 'imdb:tt0081505', imdbId: 'tt0081505', title: 'The Shining', year: 1980 };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sdk = `
window.authoredUser='user-a'; window.authoredLogin=false; window.authoredRole='owner'; window.authoredSessionDelay=60; window.authoredRoleDelay=80;
window.authoredWrites=[]; window.authoredSessionReads=0; window.authoredSessionQueue=false; window.authoredSessionControls=[]; window.authoredProfileHold=false;
window.supabase={createClient:()=>({auth:{
  getSession:async()=>{ authoredSessionReads++; authoredMark('session-start');
    if(authoredSessionQueue) return new Promise((resolve,reject)=>authoredSessionControls.push({resolve,reject}));
    await new Promise(resolve=>setTimeout(resolve,authoredSessionDelay)); authoredMark('session-end');
    return {data:{session:authoredLogin?{access_token:'AUTHORED',user:{id:authoredUser}}:null}}; },
  getUser:async()=>({data:{user:authoredLogin?{id:authoredUser}:null}}),
  onAuthStateChange:fn=>{window.authoredAuthEvent=fn;return {data:{subscription:{unsubscribe(){}}}};}
},from:name=>({select:()=>{const q={eq:()=>q,maybeSingle:async()=>{
  authoredMark('role-start'); const role=authoredRole; await new Promise(resolve=>setTimeout(resolve,authoredRoleDelay));
  authoredMark('role-end',{role}); return {data:{role}};
},single:async()=>{ authoredMark('profile-start'); if(authoredProfileHold) await new Promise(resolve=>window.authoredProfileRelease=resolve);
 authoredMark('profile-end');return {data:{display_name:'Authored',email:'authored@example.invalid'}}; }};return q;},insert:data=>{authoredWrites.push({name,data});throw Error('Authored write forbidden');},update:data=>{authoredWrites.push({name,data});throw Error('Authored write forbidden');}})})};`;

const trace = () => {
  window.authoredEvents = [];
  window.authoredMark = (name, fields = {}) => authoredEvents.push({ name, at: performance.now(), ...fields });
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options) => {
    const path = new URL(url, location.href).pathname;
    let body;
    if (path === '/.netlify/functions/media-advice') {
      body = JSON.parse(options.body); authoredMark('http-start', { action: body.action, imdbId: body.imdbId ?? null, groupId: body.groupId });
    } else if (path === '/.netlify/functions/movie-lookup') authoredMark('lookup-start');
    const response = await originalFetch(url, options);
    if (body) authoredMark('http-end', { action: body.action, status: response.status });
    else if (path === '/.netlify/functions/movie-lookup') authoredMark('lookup-end');
    return response;
  };
  let lastVisible = false;
  new MutationObserver(() => {
    const entry = document.getElementById('mediaAdviceEntry');
    const visible = !!entry && !entry.hidden && entry.getClientRects().length > 0;
    if (visible !== lastVisible) {
      authoredMark(visible ? 'entry-visible' : 'entry-hidden', { disabled: entry?.disabled ?? null }); lastVisible = visible;
    }
  }).observe(document, { subtree: true, attributes: true, childList: true });
};
const instrument = `
window.authoredInstrumented=true;
const authoredOriginalEstablish=establishMediaAdvice;
establishMediaAdvice=function(){ authoredMark('film-context-start',{imdbId:normalizeImdbIdFromUrl(document.getElementById('imdb_url').value)});
  const answer=authoredOriginalEstablish(); authoredMark('film-established',{entryVisible:!document.getElementById('mediaAdviceEntry').hidden}); return answer; };
const authoredModuleTimer=setInterval(()=>{if(mediaAdviceController){authoredMark('controller-ready');clearInterval(authoredModuleTimer);}},5);
appLoader.style.display='none'; document.body.classList.add('app-ready'); mainView.style.display='block';
currentUser={id:'user-a'}; currentGroupId='group-a'; currentRole=null; currentProfile={display_name:'Authored'};
authoredLogin=true; movies=[]; authoredMark('group-context-ready'); window.authoredRoleLoad=loadCurrentRole(); prepareMediaAdviceAccess();
`;

test('global UA advice availability: browser timing and actual add / edit lifecycle',
  { skip: !process.env.PLAYWRIGHT_MODULE_PATH, timeout: 115000 }, async t => {
    const root = resolve(import.meta.dirname, '..');
    const study = resolve(root, '../m4-group-entry-study');
    await mkdir(study, { recursive: true });
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    t.after(() => browser.close());
    const staticBaseline = new Map();
    // Read the baseline in two Git processes BEFORE any browser timing starts.
    // Per-request `git show` would add process latency only to the old build.
    const baselinePaths = execFileSync('git', ['ls-tree', '-r', '--name-only', baselineSHA, '--', 'app.html', 'app.js', 'styles.css', 'assets', 'shared'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
    const batch = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: baselinePaths.map(path => `${baselineSHA}:${path}\n`).join(''), maxBuffer: 30 * 1024 * 1024 });
    let cursor = 0;
    for (const path of baselinePaths) {
      const end = batch.indexOf(10, cursor), header = batch.subarray(cursor, end).toString();
      const size = Number(header.split(' ').at(-1));
      if (!Number.isFinite(size)) throw Error('Missing baseline file');
      staticBaseline.set(path, batch.subarray(end + 1, end + 1 + size)); cursor = end + size + 2;
    }
    async function source(path, baseline) {
      const relative = path.replace(/^\//, '');
      if (!baseline) return readFile(resolve(root, relative));
      if (!staticBaseline.has(relative)) throw Error('No baseline source');
      return staticBaseline.get(relative);
    }
    const server = createServer(async (req, res) => {
      try {
        const path = new URL(req.url, 'http://localhost').pathname;
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside fixture');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] ?? 'text/plain');
        res.end(await readFile(file));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const timings = [];

    async function setup(t, options = {}) {
      const state = { requests: [], discoveries: 0, lookup: 0, mode: options.mode ?? 'allow', pending: [],
        capabilityDelay: options.capabilityDelay ?? 300, moduleDelay: options.moduleDelay ?? 0, baseline: options.baseline ?? false };
      const context = await browser.newContext({ viewport: { width: options.width ?? 375, height: 900 }, serviceWorkers: 'block' });
      await context.addInitScript(trace);
      t.after(async () => { state.pending.splice(0).forEach(fn => fn()); await context.close(); });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: sdk });
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/.netlify/functions/media-advice') {
          const body = route.request().postDataJSON(); state.requests.push(body);
          if (body.action === 'discover') {
            state.discoveries++;
            const selected = body.imdbId === secondFilm.imdbId ? secondFilm : film;
            return route.fulfill({ json: { result: { film: selected, rows: [{id:'authored:megogo',filmId:selected.id,identityStatus:'matched',country:'UA',provider:{key:'megogo',sourceName:'MEGOGO'},access:{state:'reported',value:'subscription'},audio:{state:'unknown',evidence:[]},subtitles:{state:'reported-positive',evidence:[]},conflicts:[],provenance:{source:'Kinobaza HTML'},link:{href:'https://megogo.net/ua/view/123456-authored.html?source=AUTHORED%2fExact#Keep'}}], unmapped: [], sources: [], capabilities: { mykola_media_advice: true } } } });
          }
          const mode = state.mode;
          if (mode === 'hold' || mode === 'hold-deny') await new Promise(resolve => state.pending.push(resolve));
          else await wait(state.capabilityDelay);
          if (mode === 'fail') return route.abort('failed');
          return route.fulfill({ status: mode.endsWith('deny') ? 403 : 200, json: mode.endsWith('deny') ? { status: 'access-unavailable' } : { mykola_media_advice: true, mykola_media_advice_diagnostics: false } });
        }
        if (url.pathname === '/.netlify/functions/movie-lookup') {
          state.lookup++; await wait(180);
          return route.fulfill({ json: { title: film.title, year: film.year } });
        }
        if (url.pathname === '/assets/media-advice.mjs' && state.moduleDelay) await wait(state.moduleDelay);
        try {
          let body = await source(url.pathname, state.baseline);
          if (url.pathname === '/app.js') body = body.toString().replace(/^initApp\(\);\r?$/gm, '// Authored known-user/group boundary is installed by the browser fixture.') + '\n' + instrument;
          return route.fulfill({ contentType: ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(url.pathname)] ?? 'text/plain', body });
        } catch { return route.fulfill({ status: 404, body: '' }); }
      });
      const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
      await page.goto(origin + '/app.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.authoredInstrumented);
      await page.evaluate(() => authoredRoleLoad);
      return { page, state };
    }
    async function seed(page) {
      await page.evaluate(({ film, secondFilm }) => {
        movies = [film, secondFilm].map((movie, i) => ({ ...movie, id: `list-${i}`, group_id: currentGroupId, imdb_url: `https://imdb.com/title/${movie.imdbId}`, status: 'wishlist', recommended_medium: 'DVD', added_by: 'Authored' }));
        authoredMark('movies-available'); prepareMediaAdviceAccess();
      }, { film, secondFilm });
    }
    async function add(page, { immediate = false } = {}) {
      if (immediate) await page.evaluate(imdbId => {
        showAddFormButton.click(); const input=document.getElementById('imdb_url'); input.value=`https://www.imdb.com/title/${imdbId}/`;
        input.dispatchEvent(new Event('input',{bubbles:true})); lookupButton.click();
      }, film.imdbId);
      else {
        await page.locator('#showAddFormButton').click();
        await page.locator('#imdb_url').fill(`https://www.imdb.com/title/${film.imdbId}/`);
        await page.locator('#lookupButton').click();
      }
      await page.waitForFunction(title => document.getElementById('title').value === title, film.title);
    }
    async function measure(page, state, name) {
      await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
      const record = await page.evaluate(() => {
        const events = authoredEvents.slice();
        const group = events.find(e => e.name === 'group-context-ready')?.at ?? null;
        const established = events.filter(e => e.name === 'film-established').at(-1);
        const form = established?.at ?? null;
        const observed = events.filter(e => e.name === 'entry-visible' && e.at >= (form - 2)).at(-1)?.at ?? performance.now();
        const visible = established?.entryVisible ? form : observed;
        const relative = events.map(e => ({ ...e, at: +(e.at - group).toFixed(1) }));
        return { formFilledMs: +(form - group).toFixed(1), buttonVisibleMs: +(visible - group).toFixed(1), gapMs: +Math.max(0, visible - form).toFixed(1), events: relative };
      });
      const result = { name, baseline: state.baseline, ...record, capabilityRequests: state.requests.filter(r => r.action !== 'discover').length, discoveries: state.discoveries };
      timings.push(result); console.info('GROUP_ENTRY_TIMING ' + JSON.stringify(result));
      return result;
    }

    for (const baseline of [true, false]) {
      if (process.env.M4_AVAILABILITY_QA_ONLY) continue;
      if (!baseline && process.env.M4_BASELINE_ONLY) continue;
      for (const type of ['cold-empty-add', 'cold-edit', 'ready-repeated-add']) await t.test(`${baseline ? 'baseline' : 'updated'} timing ${type}`, async t => {
        const { page, state } = await setup(t, { baseline, moduleDelay: type.startsWith('cold') ? 600 : 0, width: type === 'cold-edit' ? 1280 : 375 });
        if (type === 'cold-edit') {
          await wait(350); await seed(page); await page.evaluate(() => startEditMovie('list-0'));
        } else if (type === 'ready-repeated-add') {
          await page.waitForFunction(() => !!mediaAdviceController); await seed(page);
          await page.evaluate(() => prepareMediaAdviceAccess()); await add(page, { immediate: true });
        } else await add(page, { immediate: true });
        const first = await measure(page, state, type);
        assert.equal(state.discoveries, 0, 'availability preparation cannot discover sources');
        assert.equal(await page.locator('#submitButton').isEnabled(), true);
        if (!baseline && type === 'ready-repeated-add') assert.ok(first.gapMs <= 25, 'prepared global availability is rendered with the established form');
        if (!baseline && type === 'cold-edit') assert.ok(first.gapMs <= 25, 'global availability is ready before existing movie metadata arrives');
        if (type === 'ready-repeated-add') {
          await page.evaluate(() => resetFormMode()); await add(page, { immediate: true });
          const repeated = await measure(page, state, `${type}-reopen`);
          assert.ok(repeated.gapMs <= 25);
        }
      });
    }
    if (!process.env.M4_BASELINE_ONLY) {
      await t.test('empty group starts global availability before any IMDb or heavy controller exists', async t => {
        const { page, state } = await setup(t, { moduleDelay: 3000, capabilityDelay: 100 });
        await page.waitForFunction(() => authoredEvents.some(e => e.name === 'http-end' && e.action === 'availability'));
        assert.equal(await page.evaluate(() => movies.length), 0);
        assert.ok(state.requests.some(r => r.action === 'availability' && Object.keys(r).join() === 'action'));
        assert.equal(state.requests.some(r => r.action === 'capability'), false, 'no film or list capability is needed for availability');
        await add(page, { immediate: true });
        assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), true);
        assert.equal(await page.locator('#mediaAdviceEntry').isDisabled(), true);
        assert.equal(await page.locator('#mediaAdviceEntry').getAttribute('aria-busy'), 'true');
        assert.equal(await page.evaluate(() => !!mediaAdviceController), false, 'visibility need not wait for the heavy controller');
        assert.equal(state.discoveries, 0);
        await page.waitForFunction(() => !!mediaAdviceController);
        await page.locator('#mediaAdviceEntry').click();
        await page.locator('.media-advice-comparison').waitFor();
        assert.equal(state.discoveries, 1);
        assert.equal(state.requests.filter(r => r.action === 'availability').length, 1, 'opening uses the prepared session hint');
        assert.equal(state.requests.some(r => r.action === 'capability'), false, 'opening does not add a film permission precheck');
        assert.deepEqual(Object.keys(state.requests.find(r => r.action === 'discover')).sort(), ['action', 'formSession', 'imdbId']);
      });
      for (const mode of ['deny', 'fail', 'hold-deny']) await t.test(`${mode} availability never blocks add or edit`, async t => {
        const { page, state } = await setup(t, { mode });
        await add(page);
        assert.equal(await page.locator('#title').inputValue(), film.title);
        assert.equal(await page.locator('#submitButton').isEnabled(), true);
        assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
        state.pending.splice(0).forEach(fn => fn());
        await seed(page); await page.evaluate(() => startEditMovie('list-1'));
        assert.equal(await page.locator('#title').inputValue(), secondFilm.title);
        assert.equal(state.discoveries, 0);
      });
      await t.test('groups and roles do not invalidate global advice; visitor can read but cannot transfer', async t => {
        const { page, state } = await setup(t, { capabilityDelay: 30 });
        await page.evaluate(() => prepareMediaAdviceAccess()); await seed(page);
        await page.evaluate(() => startEditMovie('list-0'));
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        const availableRequests = state.requests.filter(r => r.action === 'availability').length;
        await page.evaluate(() => { currentGroupId = 'group-b'; authoredRole = 'visitor'; return loadCurrentRole(); });
        await page.evaluate(() => startEditMovie('list-0'));
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        await page.locator('#mediaAdviceEntry').click();
        await page.locator('.media-advice-comparison').waitFor();
        await page.locator('[data-provider-key="megogo"] .media-advice-service-select').click();
        assert.equal(await page.getByRole('button', { name: 'Обрати', exact: true }).isDisabled(), true);
        assert.ok((await page.locator('.media-advice-actions').innerText()).includes('права'));
        assert.equal(state.requests.filter(r => r.action === 'availability').length, availableRequests, 'group and role changes reuse same authenticated session availability');
        assert.equal(state.discoveries, 1);
        assert.equal(await page.evaluate(() => authoredWrites.length), 0);
        await page.getByRole('button', { name: '← До картки', exact: true }).click();
        await page.evaluate(() => { currentGroupId = null; currentRole = null; invalidateMediaAdvice(); });
        await add(page, { immediate: true });
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        assert.equal(state.requests.filter(r => r.action === 'availability').length, availableRequests, 'no group membership is required for viewing advice');
      });
      await t.test('updateAuthUI prepares availability before an unresolved profile and before group rights exist', async t => {
        const { page, state } = await setup(t, { capabilityDelay: 30 });
        await page.evaluate(() => {
          authoredProfileHold = true; authoredUser = 'profile-user'; currentGroupId = null; currentRole = null;
          window.authoredProfileWork = updateAuthUI();
        });
        await page.waitForFunction(() => typeof authoredProfileRelease === 'function');
        await page.waitForFunction(() => mediaAdviceAccessPreparation?.peek({userId:'profile-user'}) === true);
        assert.equal(await page.evaluate(() => authoredEvents.filter(e => e.name === 'profile-end').length), 0);
        assert.ok(state.requests.filter(r => r.action === 'availability').every(r => Object.keys(r).join() === 'action'));
        await page.evaluate(() => { authoredProfileHold = false; authoredProfileRelease(); return authoredProfileWork; });
        assert.equal(state.discoveries, 0);
      });
      await t.test('late old-user allow cannot restore current denied access', async t => {
        const { page, state } = await setup(t, { mode: 'hold' });
        await add(page);
        state.mode = 'deny';
        await page.evaluate(() => { authoredUser = 'user-b'; currentUser = { id: 'user-b' }; window.authoredChangedUser = prepareMediaAdviceAccess({ force: true }); });
        state.pending.splice(0).forEach(fn => fn()); await page.evaluate(() => authoredChangedUser);
        assert.equal(await page.locator('#mediaAdviceEntry').isVisible(), false);
        state.mode = 'allow';
        await page.evaluate(() => prepareMediaAdviceAccess({ force: true }));
        await add(page, { immediate: true });
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        assert.equal(state.discoveries, 0);
      });
      await t.test('fresh failed availability hides entry; later healthy allow restores without reload', async t => {
        const { page, state } = await setup(t, { capabilityDelay: 60 });
        await page.evaluate(() => prepareMediaAdviceAccess()); await add(page);
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        state.mode = 'deny'; await page.evaluate(() => prepareMediaAdviceAccess({ force: true }));
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'hidden' });
        state.mode = 'allow'; await page.evaluate(() => prepareMediaAdviceAccess({ force: true }));
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        assert.equal(state.discoveries, 0);
      });
      await t.test('owner to visitor to member keeps one-shot result and rejects a late preview apply', async t => {
        const { page, state } = await setup(t, { capabilityDelay: 30 });
        await page.evaluate(() => prepareMediaAdviceAccess()); await seed(page);
        await page.evaluate(() => startEditMovie('list-0'));
        await page.locator('#mediaAdviceEntry').click();
        await page.locator('.media-advice-comparison').waitFor();
        await page.locator('[data-provider-key="megogo"] .media-advice-service-select').click();
        await page.getByRole('button', { name: 'Обрати', exact: true }).click();
        await page.locator('.media-advice-preview').waitFor();
        state.mode = 'hold';
        const applyRequest = page.waitForRequest(request => request.url().endsWith('/.netlify/functions/media-advice') && request.postDataJSON().action === 'apply-capability');
        await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click(); await applyRequest;
        await page.evaluate(() => { authoredRole = 'visitor'; return loadCurrentRole(); });
        assert.equal(await page.locator('.media-advice-preview').count(), 0, 'changed editing rights discard the pending preview');
        state.mode = 'allow'; state.pending.splice(0).forEach(fn => fn());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.locator('#purchase_url').inputValue(), '');
        assert.equal(await page.locator('#recommended_medium').inputValue(), 'DVD');
        await page.locator('[data-provider-key="megogo"] .media-advice-service-select').click();
        assert.equal(await page.getByRole('button', { name: 'Обрати', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: '← До картки', exact: true }).click();
        await page.locator('#mediaAdviceEntry').click(); await page.locator('.media-advice-comparison').waitFor();
        assert.equal(state.discoveries, 1, 'visitor reopening reuses the already spent one-shot result');
        await page.evaluate(() => { authoredRole = 'member'; return loadCurrentRole(); });
        await page.getByRole('button', { name: '← До картки', exact: true }).click();
        await page.locator('#mediaAdviceEntry').click(); await page.locator('.media-advice-comparison').waitFor();
        await page.locator('[data-provider-key="megogo"] .media-advice-service-select').click();
        assert.equal(await page.getByRole('button', { name: 'Обрати', exact: true }).isEnabled(), true);
        assert.equal(state.discoveries, 1, 'restored member rights do not spend a second source session');
        assert.equal(state.requests.filter(request => request.action === 'availability').length, 1);
        assert.equal(await page.evaluate(() => authoredWrites.length), 0);
      });
      await t.test('INITIAL_SESSION during the first held UI session read completes cold availability without reinitialization', async t => {
        const { page, state } = await setup(t, { capabilityDelay: 30 });
        await page.evaluate(() => {
          currentUser = null; currentGroupId = null; currentRole = null; appHasInitialized = false;
          authoredLogin = false; authoredSessionQueue = true; mediaAdviceSessionFlight = null;
          syncMediaAdviceEntryScope(); window.authoredColdUIDone = false;
          window.authoredColdUI = updateAuthUI().finally(() => { authoredColdUIDone = true; });
        });
        await page.waitForFunction(() => authoredSessionControls.length === 1);
        await page.evaluate(() => {
          authoredUser = 'initial-session-user'; authoredLogin = true;
          authoredAuthEvent('INITIAL_SESSION', { access_token: 'AUTHORED', user: { id: authoredUser } });
          authoredSessionQueue = false;
          // The in-flight storage read is older than the event and returns no session.
          authoredSessionControls[0].resolve({ data: { session: null } });
        });
        await page.waitForFunction(() => authoredColdUIDone);
        await page.waitForFunction(() => mediaAdviceAccessPreparation?.peek({ userId: 'initial-session-user' }) === true);
        assert.equal(await page.evaluate(() => currentUser?.id), 'initial-session-user');
        assert.equal(await page.evaluate(() => appHasInitialized), false, 'the auth callback did not rely on a later initApp pass');
        await add(page, { immediate: true });
        await page.locator('#mediaAdviceEntry').waitFor({ state: 'visible' });
        assert.equal(state.discoveries, 0);
        assert.equal(await page.evaluate(() => authoredWrites.length), 0);
      });
    }
    if (timings.length) await writeFile(resolve(study, process.env.M4_BASELINE_ONLY ? 'baseline-timing.json' : 'before-after-timing.json'), JSON.stringify({
      kind: 'controlled-local-browser-not-deployed-live', baselineSHA, conditions: { roleMs: 80, sessionMs: 60, capabilityMs: 300, lookupMs: 180, coldControllerMs: 600, coldEditMovieAvailabilityMs: 350 },
      boundaries: 'Actual loadCurrentRole, add-form + IMDb lookup handlers, and startEditMovie. Initial initApp invocation is replaced with a known-user/group fixture boundary; movie-list availability is authored. Full authentication bootstrap and live Supabase are not exercised. Immediate measurement actions dispatch the actual click/input handlers without automation think time; QA cases use browser locators.',
      externalSourceHTTP: 0, realSupabaseHTTP: 0, databaseWrites: 0, timings,
    }, null, 2));
    console.info('Global-availability browser control: external source HTTP 0; live Supabase 0; database writes 0; all authorization and lookup answers are authored fixtures.');
  });
