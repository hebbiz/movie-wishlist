import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.site-dist');
const build = () => execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: root });
const publicFiles = ['index.html', 'app.html', 'invite.html', 'app.js', 'styles.css', 'service-worker.js', 'site.webmanifest'];
const publicDirectories = ['assets', 'shared', 'privacy', 'terms'];

function filesBelow(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = prefix + entry.name;
    assert.equal(entry.isSymbolicLink(), false, `Publish inventory must not follow a symlink: ${file}`);
    return entry.isDirectory() ? filesBelow(join(directory, entry.name), file + '/') : [file];
  }).sort();
}
const digest = file => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
function section(config, name) {
  const lines = config.split(/\r?\n/), start = lines.findIndex(line => line.trim() === `[${name}]`);
  assert.notEqual(start, -1, `Missing Netlify context ${name}`);
  const after = lines.slice(start + 1), end = after.findIndex(line => /^\s*\[/.test(line));
  return (end < 0 ? after : after.slice(0, end)).join('\n');
}

test('publish output preserves only public app dependencies, rebuilds cleanly and leaves Function/pilot sources in Git', async t => {
  // The expected surface is independent of the build script's private array.
  // Assets/shared/legal directories are deliberate public roots, except their
  // Markdown metadata. Every output file must correspond to an existing public
  // source file; source-attribution documents stay tracked but are not deployed.
  const expected = [...publicFiles, ...publicDirectories.flatMap(directory => filesBelow(join(root, directory), directory + '/'))]
    .filter(file => !/\.md$/i.test(file)).sort();
  const allowed = new Set(expected);
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
  const retained = tracked.filter(file => !allowed.has(file));
  const before = new Map(retained.map(file => [file, digest(file)]));
  for (const file of ['research/grounded-answer-demo/server.mjs', 'research/grounded-answer-demo/public/tmdb-logo.svg',
    'assets/icons/media/SOURCES.md',
    'docs/m4-media-advice.md', 'scripts/build-site.mjs', 'tests/build-site.test.mjs', 'test/media-advice-server.test.mjs',
    'netlify/functions/media-advice.mjs', 'netlify/lib/media-source-tmdb.mjs',
    'supabase/migrations/20261108185237_media_advice_global_access.sql', 'package.json', 'package-lock.json', 'netlify.toml']) {
    assert.ok(before.has(file), `${file} must stay tracked at the repository root, not become public output`);
  }
  const migrations = retained.filter(file => /^supabase\/migrations\/\d+_media_advice_.*\.sql$/.test(file));
  assert.deepEqual(migrations.sort(), [
    '20261020205122_media_advice_access_ledger.sql', '20261021072002_media_advice_review_fixes.sql',
    '20261031135149_media_advice_beta_ua.sql', '20261101180436_media_advice_identity_budget.sql',
    '20261102181617_media_advice_exact_reserve_budget.sql', '20261104210025_media_advice_predicted_card_budget.sql',
    '20261108185237_media_advice_global_access.sql',
  ].map(file => `supabase/migrations/${file}`), 'The seven M4 migrations remain tracked and private; unrelated migrations stay preserved too.');
  const verifyOutput = () => {
    assert.deepEqual(filesBelow(output), expected, 'The complete output must equal the declared public surface.');
    for (const file of expected) assert.deepEqual(readFileSync(join(output, file)), readFileSync(join(root, file)), `${file} must remain byte-identical`);
    for (const directory of ['research', 'docs', 'test', 'tests', 'scripts', 'supabase', 'netlify', 'node_modules', '.git']) {
      assert.equal(existsSync(join(output, directory)), false, `${directory} must not be published, including empty/stale directories`);
    }
    for (const file of filesBelow(output)) {
      assert.doesNotMatch(file, /(?:^|\/)(?:package(?:-lock)?\.json|netlify\.toml|\.env(?:\.[^/]*)?|\.gitignore)$|\.(?:md|sql|toml|ps1|cs)$/i,
        `Documentation/server SQL/configuration/tooling must not appear in public output: ${file}`);
    }
  };

  build(); verifyOutput();
  // Every published .mjs is a pure browser/shared module at evaluation time.
  // Do not evaluate app.js, the service worker, or inline page scripts: those
  // intentionally need a browser. No test module may initiate network traffic.
  t.mock.method(globalThis, 'fetch', () => assert.fail('Publish checks must not fetch external sources.'));
  const modules = expected.filter(file => file.endsWith('.mjs'));
  for (const file of modules) {
    assert.match(file, /^(?:assets|shared)\//);
    await import(pathToFileURL(join(output, file)).href);
  }
  const app = readFileSync(join(output, 'app.js'), 'utf8');
  const appHtml = readFileSync(join(output, 'app.html'), 'utf8');
  for (const entry of ['media-advice-entry-access.mjs', 'media-advice.mjs']) {
    assert.ok(app.includes(`import("./assets/${entry}")`), `App dynamic entry ${entry} remains unchanged`);
    assert.ok(appHtml.includes(`href="./assets/${entry}"`), `Module preload ${entry} remains available`);
    assert.ok(allowed.has(`assets/${entry}`));
  }
  const advice = readFileSync(join(output, 'assets/media-advice.mjs'), 'utf8');
  assert.match(advice, /logo\.src\s*=\s*['"]\/assets\/icons\/tmdb\.svg['"]/);
  assert.doesNotMatch(advice, /\/research\/grounded-answer-demo\/public\/tmdb-logo\.svg/);
  assert.match(advice, /logo\.alt\s*=\s*['"]TMDB['"]/);
  assert.match(advice, /logo\.width\s*=\s*110\b/);
  assert.match(advice, /https:\/\/www\.themoviedb\.org/);
  assert.match(advice, /not endorsed or certified by TMDB/);
  assert.deepEqual(readFileSync(join(output, 'assets/icons/tmdb.svg')), readFileSync(join(root, 'assets/icons/tmdb.svg')));
  const manifest = JSON.parse(readFileSync(join(output, 'site.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/app.html');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) assert.ok(allowed.has(icon.src.replace(/^\//, '')), `PWA icon ${icon.src} remains public`);
  assert.ok(expected.includes('privacy/index.html') && expected.includes('terms/index.html'));

  const config = readFileSync(join(root, 'netlify.toml'), 'utf8');
  assert.match(section(config, 'build'), /^\s*command\s*=\s*"node scripts\/build-site\.mjs"\s*$/m);
  assert.match(section(config, 'build'), /^\s*publish\s*=\s*"\.site-dist"\s*$/m);
  assert.match(section(config, 'context.develop'), /^\s*command\s*=\s*"node scripts\/stamp-media-advice-build\.mjs && node scripts\/build-site\.mjs"\s*$/m);
  assert.doesNotMatch(config, /(?:directory|functions)\s*=\s*['"]\.site-dist\//);

  // Rebuilds must remove the former research-logo exception and arbitrary
  // nested server/private/stale content, even within otherwise public roots.
  const stale = ['obsolete-file.txt', 'research/grounded-answer-demo/public/tmdb-logo.svg',
    'research/grounded-answer-demo/server.mjs', 'netlify/functions/media-advice.mjs', 'netlify/lib/media-source-tmdb.mjs',
    'scripts/private.mjs', 'docs/private.md', 'test/fixture.mjs', 'tests/fixture.mjs',
    'supabase/migrations/stale.sql', 'config/private.toml', 'assets/icons/stale.svg',
    'assets/icons/media/SOURCES.md', 'privacy/nested/stale.html'];
  for (const file of stale) {
    const destination = join(output, file); mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, 'STALE OUTPUT FIXTURE');
  }
  writeFileSync(join(output, 'assets/icons/tmdb.svg'), 'STALE LOGO FIXTURE');
  build(); verifyOutput();
  for (const file of stale) assert.equal(existsSync(join(output, file)), false, `${file} must not survive a rebuild`);
  assert.deepEqual(new Map(retained.map(file => [file, digest(file)])), before,
    'Both builds must leave all tracked nonpublic code/docs/tests/migrations/configuration unchanged, including the build stamp.');
  t.diagnostic(`Offline publish check: ${expected.length} exact public files, ${modules.length} browser/shared modules imported, ${retained.length} tracked private files preserved, seven M4 migrations retained.`);
});
