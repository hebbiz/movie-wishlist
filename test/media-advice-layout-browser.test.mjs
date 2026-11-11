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
const modules = ['media-advice.mjs', 'media-advice-entry-access.mjs', 'media-advice-icons.mjs',
  'media-advice-presentation.mjs', 'media-advice-report.mjs', 'media-advice-link-choices.mjs'];
const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 30 * 1024 * 1024 });
const lf = value => value.toString().replace(/\r\n/g, '\n');
let baselineAvailable = false;
function requireReleasedBaseline() {
  if (baselineAvailable) return;
  try { git('cat-file', '-e', `${baseline}^{commit}`); }
  catch { throw Error(`Missing fixed v1.4.0 Git baseline ${baseline}. Run: git fetch origin ${baseline}; then rerun this test. No current-code substitute or automatic fetch is used.`); }
  baselineAvailable = true;
}

test('six frontend modules and app entry points equal released v1.4.0 except reviewed import paths', async () => {
  requireReleasedBaseline();
  for (const name of modules) {
    const previous = lf(git('show', `${baseline}:assets/${name}`));
    const current = lf(await readFile(resolve(root, 'src/media-advice', name)));
    assert.equal(current.replaceAll("from '../../shared/", "from '../shared/"), previous, name);
  }
  for (const name of ['app.js', 'app.html']) {
    assert.equal(lf(await readFile(resolve(root, name))).replaceAll('./src/media-advice/media-advice', './assets/media-advice'),
      lf(git('show', `${baseline}:${name}`)), name);
  }
});

function releasedPublicFiles() {
  requireReleasedBaseline();
  const names = git('ls-tree', '-r', '--name-only', baseline, '--', 'assets', 'shared', 'styles.css')
    .toString().trim().split(/\r?\n/).filter(Boolean);
  const batch = execFileSync('git', ['cat-file', '--batch'], { cwd: root, windowsHide: true,
    input: names.map(name => `${baseline}:${name}\n`).join(''), maxBuffer: 30 * 1024 * 1024 });
  let cursor = 0;
  return new Map(names.map(name => {
    const end = batch.indexOf(10, cursor), header = batch.subarray(cursor, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(' ')[2]); cursor = end + 1;
    const value = batch.subarray(cursor, cursor + length); cursor += length + 1;
    return ['/' + name, value];
  }));
}

test('retained v1.4.0 document: cold, cached and mixed old module URLs survive a local deploy switch',
  { skip: !process.env.PLAYWRIGHT_MODULE_PATH, timeout: 120000 }, async t => {
    buildSite();
    const previous = releasedPublicFiles(), requests = [];
    let deployed = false;
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      try {
        let body;
        if (pathname === '/retained.html') body = '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><button id="entry">Поради</button></body></html>';
        else if (!deployed) { body = previous.get(pathname); if (!body) throw Error('not in released public files'); }
        else {
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
    for (const width of [375, 1280]) for (const state of ['cold', 'cached', 'mixed']) await t.test(`${width}px ${state}`, async t => {
      deployed = false; requests.length = 0;
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      t.after(() => context.close());
      const remote = [], errors = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== origin) { remote.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/retained.html');
      if (state === 'cached') await page.evaluate(async () => { window.retainedModule = await import('/assets/media-advice.mjs'); });
      if (state === 'mixed') await page.evaluate(async () => { window.retainedPresentation = await import('/assets/media-advice-presentation.mjs'); });
      deployed = true;
      await page.evaluate(async ({ hrefs, modules }) => {
        const media = await import('/assets/media-advice.mjs');
        if (window.retainedModule && window.retainedModule !== media) throw Error('cached module was replaced');
        const namespaces = await Promise.all(modules.map(name => import('/assets/' + name)));
        const canonical = await Promise.all(modules.map(name => import('/src/media-advice/' + name)));
        if (!window.retainedModule && !window.retainedPresentation) for (const [index, namespace] of namespaces.entries()) {
          if (Object.keys(namespace).join() !== Object.keys(canonical[index]).join()) throw Error('export mismatch');
          for (const name of Object.keys(namespace)) if (namespace[name] !== canonical[index][name]) throw Error('forwarder changed a binding');
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
      }, { hrefs, modules });
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
      for (const name of modules) assert.ok(requests.some(r => r.pathname === '/src/media-advice/' + name && r.deployed));
      assert.ok(requests.some(r => r.pathname === '/assets/icons/media/primevideo.svg' && r.status === 200));
      console.info(`Retained media document ${JSON.stringify({ width, state, reloads: 0, discoveries: 1, exactTransfer: true, externalHTTP: 0 })}`);
    });
  });
