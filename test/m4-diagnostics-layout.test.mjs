// Layout/guard checks only: fixed Git bodies, authored stdin and no HTTP/SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'd7c98664ad5b3a975b47cca237ba9e30b865e0ee';
const directory = 'scripts/media-advice-diagnostics/';
const names = ['m4-cascade-comparison.mjs', 'm4-control-credentials.mjs',
  'm4-control-diagnostic.mjs', 'm4-control-password-prompt.ps1',
  'm4-director-person-diagnostic.mjs', 'm4-fockers-control.mjs',
  'm4-pilot-page-inspection.mjs', 'm4-practical-request.ps1',
  'm4-practical-series.mjs', 'm4-practical-session.ps1',
  'm4-predicted-controls.mjs', 'm4-profile-markup-inspection.mjs',
  'm4-read-control-result.ps1', 'm4-url-diagnostics.mjs'];
const read = path => readFileSync(new URL(path, new URL('../', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).toString().replaceAll('\r\n', '\n');
function requireBaseline() {
  try { git('cat-file', '-e', baseline + '^{commit}'); }
  catch { throw Error('Missing fixed diagnostics-layout Git baseline ' + baseline +
    '. Run: git fetch origin ' + baseline + '; then rerun this test. No auto-fetch, skip or current-body substitute.'); }
}

test('fourteen diagnostic tools have one canonical location and no old-path wrappers; root build tools stay put', () => {
  assert.deepEqual(readdirSync(new URL('../' + directory, import.meta.url)).sort(), [...names].sort());
  assert.equal(names.filter(name => name.endsWith('.mjs')).length, 10);
  assert.equal(names.filter(name => name.endsWith('.ps1')).length, 4);
  for (const name of names) assert.equal(existsSync(new URL('../scripts/' + name, import.meta.url)), false, name);
  assert.deepEqual(readdirSync(new URL('../scripts/', import.meta.url)).sort(),
    ['build-site.mjs', 'media-advice-diagnostics', 'stamp-media-advice-build.mjs']);
});

test('all fourteen tool bodies equal the fixed develop baseline except reviewed path/root relocation', () => {
  requireBaseline();
  for (const name of names) {
    let expected = git('show', baseline + ':scripts/' + name);
    if (name.endsWith('.mjs')) {
      expected = expected.replace(/from '\.\.\/(netlify|shared|src)\//g, "from '../../$1/")
        .replaceAll("new URL('../', import.meta.url)", "new URL('../../', import.meta.url)");
      if (name === 'm4-predicted-controls.mjs') expected = expected
        .replaceAll("'scripts/m4-predicted-controls.mjs'", "'scripts/media-advice-diagnostics/m4-predicted-controls.mjs'")
        .replaceAll("'scripts/m4-control-credentials.mjs'", "'scripts/media-advice-diagnostics/m4-control-credentials.mjs'");
    } else expected = expected.replaceAll('$repoPath = Split-Path -Parent $PSScriptRoot',
      '$repoPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)');
    assert.equal(read(directory + name), expected, name + ': only reviewed location changes are allowed');
  }
  for (const name of ['build-site.mjs', 'stamp-media-advice-build.mjs']) {
    assert.equal(read('scripts/' + name), git('show', baseline + ':scripts/' + name), name + ' must remain unchanged');
  }
});

test('nine importable Node tools load without executing source requests or using current demo/test code', () => {
  const urls = names.filter(name => name.endsWith('.mjs') && name !== 'm4-pilot-page-inspection.mjs')
    .map(name => new URL('../' + directory + name, import.meta.url).href);
  const code = `import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      const result = next(specifier, context);
      if (result.url.startsWith('file:') && new URL(result.url).pathname.split('/').some(p => ['research','test','tests'].includes(p))) throw Error('operator-boundary');
      return result;
    } });
    const requests = [];
    globalThis.fetch = () => { requests.push('HTTP'); throw Error('external request during import'); };
    for (const url of ${JSON.stringify(urls)}) await import(url);
    assert.deepEqual(requests, []);
    process.stdout.write('nine-operators-imported-no-transport');`;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', code],
    { cwd: resolve(root, 'test'), encoding: 'utf8', windowsHide: true, timeout: 15000 }), 'nine-operators-imported-no-transport');
});

test('the tenth tool retains its CLI-only explicit-live-inspection refusal with zero requests', () => {
  const url = new URL('../' + directory + 'm4-pilot-page-inspection.mjs', import.meta.url).href;
  const code = `globalThis.fetch = () => { throw Error('forbidden-HTTP'); }; await import(${JSON.stringify(url)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code],
    { cwd: resolve(root, 'test'), encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), { status: 'explicit-live-inspection-required', sourceRequests: 0 });
});

for (const mode of ['wrong-commit', 'dirty-source']) test('predicted CLI rejects ' + mode + ' at relocated repository root before input/credentials/HTTP', () => {
  const entry = new URL('../' + directory + 'm4-predicted-controls.mjs', import.meta.url);
  const code = `import assert from 'node:assert/strict';
    import child from 'node:child_process';
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    import { resolve } from 'node:path';
    const calls = [], touches = [];
    const expected = ${JSON.stringify(baseline)}, mode = ${JSON.stringify(mode)};
    child.execFileSync = (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd });
      if (args.join(' ') === 'rev-parse HEAD') return mode === 'wrong-commit' ? '0'.repeat(40) : expected;
      return ' M scripts/media-advice-diagnostics/m4-predicted-controls.mjs';
    };
    fs.readFile = async () => { touches.push('input'); throw Error('forbidden-input'); };
    fs.writeFile = async () => { touches.push('output'); throw Error('forbidden-output'); };
    globalThis.fetch = () => { touches.push('HTTP'); throw Error('forbidden-HTTP'); };
    Object.defineProperty(process, 'stdin', { value: { [Symbol.asyncIterator]() { touches.push('credentials'); throw Error('forbidden-credentials'); } } });
    syncBuiltinESMExports();
    process.argv = [process.execPath, ${JSON.stringify(fileURLToPath(entry))},
      '--input', 'never-read.json', '--input-sha256', '0'.repeat(64),
      '--expected-commit', expected, '--output', 'never-written.json'];
    await import(${JSON.stringify(entry.href)});
    // Assert outside the CLI's own catch; its fail-closed output must not hide
    // a failing test assertion about the Git command or guarded paths.
    assert.equal(process.exitCode, 1);
    assert.equal(calls.length, mode === 'wrong-commit' ? 1 : 2);
    for (const call of calls) assert.equal(resolve(call.cwd), resolve(${JSON.stringify(root)}));
    assert.deepEqual(calls[0].args, ['rev-parse', 'HEAD']);
    if (mode === 'dirty-source') {
      const args = calls[1].args;
      assert.deepEqual(args.slice(0,4), ['status','--porcelain','--untracked-files=all','--']);
      assert.ok(args.includes('scripts/media-advice-diagnostics/m4-predicted-controls.mjs'));
      assert.ok(args.includes('scripts/media-advice-diagnostics/m4-control-credentials.mjs'));
      assert.ok(!args.includes('scripts/m4-predicted-controls.mjs'));
    }
    assert.deepEqual(touches, []);
    process.exitCode = 0;
    process.stdout.write('guard-observed-before-IO');`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code],
    { cwd: resolve(root, 'test'), encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(output, '{"status":"control-unavailable-do-not-rerun-check-existing-report"}\nguard-observed-before-IO');
});
