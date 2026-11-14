// Relocation parity and an actual retained browser document across a local
// static-root switch. Auth/source results are authored; no external I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSite } from '../scripts/build-site.mjs';

const root = resolve(import.meta.dirname, '..');
const baseline = '15e29db04cf536c707a7d7dfba713affd57cac2c';
const ruleBaseline = 'a060cf6f9e2022fbdd5635623432b3684c1632a7';
const sharedModules = ['director-profile-diagnostics.mjs', 'media-advice-diagnostics.mjs',
  'media-link-policy.mjs', 'media-search-relevance-diagnostic.mjs'];
const identityModules = ['director-alias-crosswalk.mjs', 'film-identity-context.mjs', 'film-release-year.mjs',
  'kinobaza-movie-identity.mjs', 'terminal-roman-title.mjs', 'ukrainian-g-title.mjs'];
const modules = ['media-advice.mjs', 'media-advice-entry-access.mjs', 'media-advice-icons.mjs',
  'media-advice-presentation.mjs', 'media-advice-report.mjs', 'media-advice-link-choices.mjs'];
const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 30 * 1024 * 1024 });
const lf = value => value.toString().replace(/\r\n/g, '\n');
let baselineAvailable = false;
function requireReleasedBaseline() {
  if (baselineAvailable) return;
  for (const sha of [baseline, ruleBaseline]) {
    try { git('cat-file', '-e', `${sha}^{commit}`); }
    catch { throw Error(`Missing fixed layout Git baseline ${sha}. Run: git fetch origin ${sha}; then rerun this test. No current-code substitute or automatic fetch is used.`); }
  }
  baselineAvailable = true;
}

test('six frontend modules and app entry points equal released v1.4.0 except reviewed import paths', async () => {
  requireReleasedBaseline();
  for (const name of modules) {
    const previous = lf(git('show', `${baseline}:assets/${name}`));
    const current = lf(await readFile(resolve(root, 'src/media-advice', name)));
    assert.equal(current.replaceAll("from '../../shared/media-advice/", "from '../shared/"), previous, name);
  }
  for (const name of ['app.js', 'app.html']) {
    assert.equal(lf(await readFile(resolve(root, name))).replaceAll('./src/media-advice/media-advice', './assets/media-advice'),
      lf(git('show', `${baseline}:${name}`)), name);
  }
});

test('all ten rules equal the fixed pre-separation develop bodies byte-for-byte after checkout EOL normalization', async () => {
  requireReleasedBaseline();
  for (const [directory, names] of [['shared/media-advice', sharedModules], ['netlify/lib/media-advice/identity', identityModules]]) {
    for (const name of names) assert.equal(lf(await readFile(resolve(root, directory, name))),
      lf(git('show', `${ruleBaseline}:shared/${name}`)), name);
  }
});

function releasedPublicFiles(sha) {
  requireReleasedBaseline();
  const names = git('ls-tree', '-r', '--name-only', sha, '--', 'assets', 'shared', 'src', 'styles.css')
    .toString().trim().split(/\r?\n/).filter(Boolean);
  const batch = execFileSync('git', ['cat-file', '--batch'], { cwd: root, windowsHide: true,
    input: names.map(name => `${sha}:${name}\n`).join(''), maxBuffer: 30 * 1024 * 1024 });
  let cursor = 0;
  return new Map(names.map(name => {
    const end = batch.indexOf(10, cursor), header = batch.subarray(cursor, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(' ')[2]); cursor = end + 1;
    const value = batch.subarray(cursor, cursor + length); cursor += length + 1;
    return ['/' + name, value];
  }));
}

test('retained v1.4.0 and PR245 documents: old frontend and shared URLs survive a local deploy switch',
  { skip: !process.env.PLAYWRIGHT_MODULE_PATH, timeout: 240000 }, async t => {
    buildSite();
    const versions = { released: releasedPublicFiles(baseline), pr245: releasedPublicFiles(ruleBaseline) }, requests = [];
    let deployed = false, previous = versions.released, staleBodies = false, entryPrefix = '/assets/';
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      try {
        let body;
        if (pathname === '/retained.html') body = '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><button id="entry">Поради</button></body></html>';
        else if (!deployed) { body = previous.get(pathname); if (!body) throw Error('not in released public files'); }
        else if (staleBodies && pathname.startsWith(entryPrefix) && pathname.endsWith('.mjs')) {
          body = previous.get(pathname); if (!body) throw Error('not in retained frontend');
        } else {
          const published = resolve(root, '.site-dist'), file = resolve(published, '.' + pathname);
          if (!file.startsWith(published + sep)) throw Error('outside fixture');
          body = await readFile(file);
        }
        requests.push({ pathname, deployed, status: 200 });
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[extname(pathname)] ?? 'application/octet-stream');
        res.end(body);
      } catch { requests.push({ pathname, deployed, status: 404 }); res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    t.after(() => browser.close());
    const hrefs = ['https://www.primevideo.com/detail/AUTHOREDONE?ref_=Exact%2fCase#First',
      'https://www.primevideo.com/detail/AUTHOREDTWO?ref_=Other%2fCase#Second'];
    for (const cohort of ['released', 'pr245']) for (const width of [375, 1280]) for (const state of ['cold', 'cached', 'mixed', 'stale-body']) await t.test(`${cohort} ${width}px ${state}`, async t => {
      deployed = false; staleBodies = false; previous = versions[cohort]; requests.length = 0;
      entryPrefix = cohort === 'released' ? '/assets/' : '/src/media-advice/';
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      t.after(() => context.close());
      const remote = [], errors = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== origin) { remote.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/retained.html');
      if (state === 'cached') await page.evaluate(async prefix => { window.retainedModule = await import(prefix + 'media-advice.mjs'); }, entryPrefix);
      if (state === 'mixed') await page.evaluate(async prefix => { window.retainedPresentation = await import(prefix + 'media-advice-presentation.mjs'); }, entryPrefix);
      deployed = true; staleBodies = state === 'stale-body';
      await page.evaluate(async ({ hrefs, modules, sharedModules, entryPrefix, state }) => {
        const media = await import(entryPrefix + 'media-advice.mjs');
        if (window.retainedModule && window.retainedModule !== media) throw Error('cached module was replaced');
        const namespaces = await Promise.all(modules.map(name => import(entryPrefix + name)));
        const canonical = await Promise.all(modules.map(name => import('/src/media-advice/' + name)));
        if (state === 'cold') for (const [index, namespace] of namespaces.entries()) {
          if (Object.keys(namespace).join() !== Object.keys(canonical[index]).join()) throw Error('export mismatch');
          for (const name of Object.keys(namespace)) if (namespace[name] !== canonical[index][name]) throw Error('forwarder changed a binding');
        }
        const oldShared = await Promise.all(sharedModules.map(name => import('/shared/' + name)));
        const newShared = await Promise.all(sharedModules.map(name => import('/shared/media-advice/' + name)));
        if (['cold', 'stale-body'].includes(state)) for (const [index, namespace] of oldShared.entries()) {
          if (Object.keys(namespace).join() !== Object.keys(newShared[index]).join()) throw Error('shared export mismatch');
          for (const name of Object.keys(namespace)) if (namespace[name] !== newShared[index][name]) throw Error('shared forwarder changed a binding');
        }
        window.authoredForm = { recommended_medium: 'DVD', purchase_url: 'https://old.example.invalid/' };
        window.authoredDiscoveries = 0; window.authoredWrites = 0;
        const ctx = { userId: 'authored', groupId: 'authored', imdbId: 'tt1596343', formSession: 'authored', title: 'Fast Five', year: 2011 };
        const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: false };
        const rows = hrefs.map((href, index) => ({ id: 'authored:' + index, identityStatus: 'matched', country: 'UA', provider: { key: 'prime' },
          access: { state: 'reported', value: 'rent' }, audio: { state: 'unknown' }, subtitles: { state: 'unknown' }, conflicts: [],
          provenance: { source: 'Movie of the Night' }, link: { href } }));
        window.authoredController = media.createMediaAdvice({ document, entry: document.getElementById('entry'), context: () => ctx,
          readForm: () => ({ ...authoredForm }), writeForm: fields => { authoredWrites++; Object.assign(authoredForm, fields); },
          capability: async () => capabilities, discover: async () => { authoredDiscoveries++; return { rows, capabilities }; } });
        await authoredController.refresh();
      }, { hrefs, modules, sharedModules, entryPrefix, state });
      await page.locator('#entry').click();
      const select = page.locator('.media-advice-link-select'); await select.waitFor();
      assert.equal(await select.locator('option').count(), 2);
      await select.selectOption('1'); await select.selectOption('0'); await select.selectOption('1');
      await page.getByRole('button', { name: 'Обрати', exact: true }).click();
      await page.getByText('Повні адреси', { exact: true }).click();
      assert.ok((await page.locator('.media-advice-preview').innerText()).includes(hrefs[1]));
      assert.equal(await page.evaluate(() => authoredWrites), 0);
      await page.getByRole('button', { name: 'Перенести в картку', exact: true }).click();
      await page.waitForFunction(() => !authoredController.dialog.open);
      assert.deepEqual(await page.evaluate(() => authoredForm), { recommended_medium: 'Prime Video', purchase_url: hrefs[1] });
      await page.locator('#entry').click(); await select.waitFor();
      assert.equal(await select.inputValue(), '1');
      assert.equal(await page.evaluate(() => authoredDiscoveries), 1, 'reopening must not discover again');
      assert.equal(await page.getByRole('button', { name: 'Діагностичний звіт', exact: true }).count(), 0);
      assert.equal(page.url(), origin + '/retained.html', 'same retained document, no reload');
      assert.deepEqual(remote, []); assert.deepEqual(errors, []);
      assert.equal(requests.filter(r => r.pathname.endsWith('.mjs') && r.status !== 200).length, 0);
      const cachedCanonical = cohort !== 'pr245' ? [] : state === 'cached'
        ? modules.filter(name => name !== 'media-advice-entry-access.mjs')
        : state === 'mixed' ? ['media-advice-presentation.mjs'] : [];
      for (const name of modules) {
        const observed = requests.filter(r => r.pathname === '/src/media-advice/' + name);
        assert.equal(observed.length, 1, 'Each canonical URL is fetched once; evaluated modules are not refetched');
        assert.equal(observed[0].deployed, !cachedCanonical.includes(name), name + ' comes from the expected deploy phase');
      }
      assert.ok(requests.some(r => r.pathname === '/assets/icons/media/primevideo.svg' && r.status === 200));
      for (const name of sharedModules) assert.ok(requests.some(r => r.pathname === '/shared/' + name && r.status === 200));
      if (state === 'stale-body') for (const name of sharedModules) assert.ok(requests.some(r => r.pathname === '/shared/' + name && r.deployed), 'old shared URL fetched after deploy');
      console.info(`Retained media document ${JSON.stringify({ cohort, width, state, reloads: 0, discoveries: 1, exactTransfer: true, externalHTTP: 0 })}`);
    });
  });
