// Clean-layout regression, not an npm install or a live source probe. Copy only
// named repository code/fixtures, then reuse the already-installed locked
// parser packages. Fresh sanitized Node processes prevent module-cache and
// NODE_PATH/NODE_OPTIONS leakage between the missing/installed cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, cp, lstat, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const prefix = 'mw-m4-runtime-root-install-';
const runtime = ['kinobaza-card.mjs', 'kinobaza-html.mjs', 'kinobaza-localization.mjs',
  'media-discovery-compose.mjs', 'media-source-motn.mjs', 'media-source-tmdb.mjs'];
const identity = ['director-alias-crosswalk.mjs', 'film-release-year.mjs', 'kinobaza-movie-identity.mjs',
  'terminal-roman-title.mjs', 'ukrainian-g-title.mjs'];
const shared = ['media-advice-diagnostics.mjs', 'media-link-policy.mjs'];
const files = ['package.json', 'package-lock.json',
  ...runtime.map(name => `netlify/lib/${name}`), ...identity.map(name => `netlify/lib/media-advice/identity/${name}`),
  ...shared.map(name => `shared/media-advice/${name}`),
  'test/kinobaza-html.fixture.mjs', 'test/kinobaza-localization.fixture.mjs',
  'test/assisted-kinobaza.fixture.mjs'];

async function absent(target) {
  try { await access(target); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

async function installedPackage(entry, name) {
  let cursor = dirname(await realpath(entry));
  while (true) {
    try {
      const metadata = JSON.parse(await readFile(join(cursor, 'package.json'), 'utf8'));
      if (metadata.name === name) return { directory: cursor, version: metadata.version };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(cursor);
    if (parent === cursor) throw Error(`Installed package root not found: ${name}`);
    cursor = parent;
  }
}

const childEnvironment = () => Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));

const childPrelude = `
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
let unintendedFetches = 0;
globalThis.fetch = () => { unintendedFetches++; assert.fail('No external source request is permitted.'); };
const { extractHtml } = await import('./netlify/lib/kinobaza-html.mjs');
const { assistedIdentity, fetchAssistedKinobaza } = await import('./netlify/lib/kinobaza-card.mjs');
const { markup, CARD } = await import('./test/assisted-kinobaza.fixture.mjs');
const { tableBlock, paragraphBlock } = await import('./test/kinobaza-localization.fixture.mjs');
const film = { id: 'imdb:tt999900001', imdbId: 'tt999900001', tmdbId: 999900001, identityTitle: 'Вигаданий фільм',
  originalTitle: 'Authored original', year: 2001, titleAliases: [], directorAliases: ['Authored director'], directorCount: 1 };
const html = markup({ blocks: tableBlock('itunes', [['Укр. звук (стерео)', '-'], ['Укр. субтитри', '+']]) + paragraphBlock('megogo', '(укр. аудіо [5.1])') });
const extract = (body, options = {}) => extractHtml(body, film, { identityCheck: all => assistedIdentity(all, film, CARD), ...options });
let intercepted = 0;
const response = body => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const send = async (url, init) => {
  intercepted++;
  assert.equal(url, CARD); assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
  return response(html);
};
`;

function runChild(directory, body) {
  const stdout = execFileSync(process.execPath, ['--input-type=module', '--eval', childPrelude + body], {
    cwd: directory, env: childEnvironment(), encoding: 'utf8', windowsHide: true,
    timeout: 20_000, maxBuffer: 512 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout);
}

test('runtime parser uses the clean repository-root install, not retired demo or inherited node_modules', { timeout: 60_000 }, async t => {
  const tempRoot = resolve(tmpdir()), directory = await mkdtemp(join(tempRoot, prefix));
  t.after(async () => {
    const target = resolve(directory);
    assert.equal(dirname(target), tempRoot);
    assert.ok(basename(target).startsWith(prefix));
    const entry = await lstat(target);
    assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), 'Cleanup must target the exact authored temporary directory.');
    await rm(target, { recursive: true, force: true, maxRetries: 15, retryDelay: 100 });
  });
  // Do not accidentally inherit the main checkout's packages. ESM ignores
  // NODE_PATH; also reject any parser package in the temp directory's ancestors.
  let ancestor = dirname(directory);
  while (true) {
    assert.ok(await absent(join(ancestor, 'node_modules/parse5')), `Isolation requires no ancestor parser at ${ancestor}`);
    const parent = dirname(ancestor); if (parent === ancestor) break; ancestor = parent;
  }
  for (const file of files) {
    const target = join(directory, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(ROOT, file), target, { errorOnExist: true, force: false });
  }
  assert.ok(await absent(join(directory, 'node_modules')));
  assert.ok(await absent(join(directory, 'research')));

  await t.test('without a parser, local extraction returns an actionable root-install error without I/O', () => {
    const result = runChild(directory, `
const parsed = await extract(html);
for (const result of [parsed]) {
  assert.equal(result.status, 'parser-unavailable'); assert.deepEqual(result.candidates, []);
  const action = result.issues.join(' ');
  assert.match(action, /npm ci --ignore-scripts/);
  assert.match(action, /(?:repository|repo) root/i);
  assert.doesNotMatch(action, /--prefix|npm (?:add|install)/);
}
assert.equal(intercepted, 0); assert.equal(unintendedFetches, 0);
console.log(JSON.stringify({ extraction: parsed.status, intercepted, unintendedFetches }));
`);
    assert.deepEqual(result, { extraction: 'parser-unavailable', intercepted: 0, unintendedFetches: 0 });
  });

  const lock = JSON.parse(await readFile(join(ROOT, 'package-lock.json'), 'utf8'));
  const parserEntry = fileURLToPath(import.meta.resolve('parse5'));
  const parser = await installedPackage(parserEntry, 'parse5');
  const entities = await installedPackage(createRequire(parserEntry).resolve('entities'), 'entities');
  for (const [name, installed] of [['parse5', parser], ['entities', entities]]) {
    assert.equal(installed.version, lock.packages[`node_modules/${name}`].version, 'Use the already installed root-lockfile version.');
    await cp(installed.directory, join(directory, 'node_modules', name), { recursive: true, dereference: true, errorOnExist: true, force: false });
  }
  assert.ok(await absent(join(directory, 'research')));

  await t.test('root-only parser packages support real identity/localization and one bounded intercepted HTML GET', () => {
    const result = runChild(directory, `
const parsed = await extract(html);
assert.equal(parsed.identity.status, 'matched');
assert.equal(parsed.identity.reason, 'explicit-title-year-director-match');
const apple = parsed.localization.blocks.find(block => block.provider === 'itunes');
const megogo = parsed.localization.blocks.find(block => block.provider === 'megogo');
assert.equal(apple.audio.state, 'reported-negative'); assert.equal(apple.subtitles.state, 'reported-positive');
assert.equal(megogo.audio.state, 'reported-positive'); assert.equal(megogo.subtitles.state, 'unknown');
const fetched = await fetchAssistedKinobaza(CARD, film, send);
assert.equal(fetched.identity.status, 'matched'); assert.equal(fetched.requestsMade, 1);
assert.equal(intercepted, 1); assert.equal(unintendedFetches, 0);
assert.deepEqual(fetched.candidates, parsed.candidates);
await assert.rejects(access('research'), { code: 'ENOENT' });
const wrong = await extract(html.replace('<h2>Authored original</h2>', '<h2>Other authored film</h2>'));
assert.equal(wrong.identity.status, 'unresolved'); assert.equal(wrong.identity.reason, 'source-original-title-unestablished'); assert.deepEqual(wrong.candidates, []);
console.log(JSON.stringify({ identity: parsed.identity.status, audio: [apple.audio.state, megogo.audio.state], subtitles: [apple.subtitles.state, megogo.subtitles.state], intercepted, unintendedFetches, wrongIdentity: wrong.identity.status }));
`);
    assert.deepEqual(result, { identity: 'matched', audio: ['reported-negative', 'reported-positive'],
      subtitles: ['reported-positive', 'unknown'], intercepted: 1, unintendedFetches: 0, wrongIdentity: 'unresolved' });
  });

  await t.test('installed parser never supplies an implicit identity gate or accepts wrong film/year/director', () => {
    const result = runChild(directory, `
const missing = await extractHtml(html, film);
assert.equal(missing.identity.status, 'unresolved'); assert.equal(missing.identity.reason, 'identity-check-required');
assert.deepEqual(missing.candidates, []);
for (const body of [markup({ original: 'Other film' }), markup({ year: 2002 }), markup({ director: 'Other director' })]) {
  const rejected = await extract(body);
  assert.notEqual(rejected.identity.status, 'matched'); assert.deepEqual(rejected.candidates, []);
  assert.deepEqual(rejected.localization?.blocks ?? [], []);
}
assert.equal(unintendedFetches, 0);
console.log(JSON.stringify({ missingIdentity: missing.identity.status, rejected: 3, intercepted, unintendedFetches }));
`);
    assert.deepEqual(result, { missingIdentity: 'unresolved', rejected: 3, intercepted: 0, unintendedFetches: 0 });
  });
  t.diagnostic('Authored clean-tree test only: reused locked local parse5/entities at repository root; no npm command, package download, nested install, or live source HTTP.');
});
