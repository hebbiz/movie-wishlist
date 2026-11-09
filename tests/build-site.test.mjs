import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.site-dist');
const build = () => execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: root });

test('publish output preserves app dependencies but excludes development files', async () => {
  build();
  for (const path of [
    'index.html', 'app.html', 'invite.html', 'app.js', 'styles.css',
    'service-worker.js', 'site.webmanifest', 'privacy/index.html', 'terms/index.html',
    'assets/media-advice.mjs', 'assets/media-advice-entry-access.mjs',
    'assets/icons/android-chrome-192x192.png', 'shared/media-link-policy.mjs',
    'research/grounded-answer-demo/public/tmdb-logo.svg',
  ]) {
    assert.ok(existsSync(join(output, path)), `${path} must be published`);
    assert.deepEqual(readFileSync(join(output, path)), readFileSync(join(root, path)), `${path} must remain unchanged`);
  }
  for (const path of [
    'docs/m4-media-advice.md', 'test', 'tests', 'scripts', 'supabase', 'netlify',
    'research/grounded-answer-demo/server.mjs', 'research/grounded-answer-demo/tmdb.mjs',
    'package.json', 'netlify.toml',
  ]) assert.equal(existsSync(join(output, path)), false, `${path} must not be published`);

  // Load the actual output to catch missing browser-module imports.
  await import(pathToFileURL(join(output, 'assets/media-advice.mjs')).href);
  await import(pathToFileURL(join(output, 'assets/media-advice-entry-access.mjs')).href);

  // A rebuild must not retain files from an older publish tree.
  writeFileSync(join(output, 'obsolete-file.txt'), 'old');
  build();
  assert.equal(existsSync(join(output, 'obsolete-file.txt')), false);
  assert.ok(existsSync(join(root, 'research/grounded-answer-demo/tmdb.mjs')), 'server sources stay available for function bundling');
});
