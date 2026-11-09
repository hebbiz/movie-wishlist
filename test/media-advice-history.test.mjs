// Authored Git responses only: no fetch, repository mutation or source request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { MEDIA_ADVICE_BASELINE_SHA, MEDIA_ADVICE_BASELINE_PATHS,
  MEDIA_ADVICE_BASELINE_CLOSURE,
  readMediaAdviceBaselineSources } from './media-advice-history.fixture.mjs';

const privateError = () => Object.assign(new Error('PRIVATE_GIT_STDERR https://user:password@invalid.example'),
  { stderr: 'PRIVATE_GIT_STDERR', stdout: 'PRIVATE_GIT_STDOUT' });
function safeFailure(error, path) {
  assert.equal(error.code, 'M4_FROZEN_BASELINE_UNAVAILABLE');
  assert.match(error.message, new RegExp(`git fetch origin ${MEDIA_ADVICE_BASELINE_SHA}`));
  assert.match(error.message, /git fetch --unshallow origin/);
  assert.match(error.message, /node --test test\/media-advice-runtime-parity\.test\.mjs/);
  assert.match(error.message, /No automatic fetch, skipped parity check or current-code fallback is allowed/);
  if (path) assert.ok(error.message.includes(path));
  assert.doesNotMatch(String(error.stack) + JSON.stringify(error), /PRIVATE_GIT|user:password|invalid\.example/);
  assert.equal(error.cause, undefined);
  return true;
}

test('frozen parity history uses one fixed commit and all required files in the actual repository', () => {
  assert.match(MEDIA_ADVICE_BASELINE_SHA, /^[0-9a-f]{40}$/);
  assert.equal(MEDIA_ADVICE_BASELINE_PATHS.length, 9);
  assert.equal(new Set(MEDIA_ADVICE_BASELINE_PATHS).size, 9);
  assert.equal(Object.isFrozen(MEDIA_ADVICE_BASELINE_PATHS), true);
  const calls = [];
  const sources = readMediaAdviceBaselineSources((command, args, options) => {
    calls.push({ command, args, options });
    assert.equal(command, 'git');
    assert.equal(options.cwd, fileURLToPath(new URL('../', import.meta.url)));
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.windowsHide, true);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.equal(options.maxBuffer, 2 * 1024 * 1024);
    return args[0] === 'show' ? `// authored frozen source ${args[1]}` : '';
  });
  assert.deepEqual(calls[0].args, ['cat-file', '-e', `${MEDIA_ADVICE_BASELINE_SHA}^{commit}`]);
  assert.deepEqual(calls.slice(1).map(call => call.args),
    MEDIA_ADVICE_BASELINE_PATHS.map(path => ['show', `${MEDIA_ADVICE_BASELINE_SHA}:${path}`]));
  assert.deepEqual([...sources.keys()], MEDIA_ADVICE_BASELINE_PATHS);
  for (const [path, source] of sources) assert.equal(source, `// authored frozen source ${MEDIA_ADVICE_BASELINE_SHA}:${path}`);
  assert.ok(calls.every(call => !call.args.some(arg => ['fetch', 'checkout', 'reset', 'pull'].includes(arg))));
});

test('missing pinned commit fails closed with explicit full/shallow recovery instructions and no Git stderr', () => {
  const calls = [];
  assert.throws(() => readMediaAdviceBaselineSources((command, args) => {
    calls.push({ command, args }); throw privateError();
  }), error => safeFailure(error));
  assert.deepEqual(calls, [{ command: 'git', args: ['cat-file', '-e', `${MEDIA_ADVICE_BASELINE_SHA}^{commit}`] }]);
});

test('retired demo parity declares the entire pinned closure, including circular wiring and frozen shared code', () => {
  assert.equal(MEDIA_ADVICE_BASELINE_CLOSURE.length, 29);
  assert.equal(new Set(MEDIA_ADVICE_BASELINE_CLOSURE).size, 29);
  assert.equal(Object.isFrozen(MEDIA_ADVICE_BASELINE_CLOSURE), true);
  for (const file of MEDIA_ADVICE_BASELINE_PATHS) assert.ok(MEDIA_ADVICE_BASELINE_CLOSURE.includes(file));
  for (const file of ['research/grounded-answer-demo/config.mjs', 'research/grounded-answer-demo/synthetic.mjs',
    'research/grounded-answer-demo/held-out.mjs', 'research/grounded-answer-demo/url-context.mjs',
    'research/grounded-answer-demo/test/kinobaza-localization.fixture.mjs',
    'shared/media-link-policy.mjs', 'shared/kinobaza-movie-identity.mjs', 'test/media-advice-group.fixture.mjs']) {
    assert.ok(MEDIA_ADVICE_BASELINE_CLOSURE.includes(file), `Historical dependency must not fall back to the current checkout: ${file}`);
  }
  const calls = [];
  const sources = readMediaAdviceBaselineSources((command, args) => {
    calls.push({ command, args });
    return args[0] === 'show' ? `// frozen ${args[1]}` : '';
  }, MEDIA_ADVICE_BASELINE_CLOSURE);
  assert.deepEqual([...sources.keys()], MEDIA_ADVICE_BASELINE_CLOSURE);
  assert.deepEqual(calls.slice(1).map(call => call.args),
    MEDIA_ADVICE_BASELINE_CLOSURE.map(file => ['show', `${MEDIA_ADVICE_BASELINE_SHA}:${file}`]));
  assert.ok(calls.every(call => call.command === 'git' && ['cat-file', 'show'].includes(call.args[0])));
});

test('missing required historical file fails before a partial baseline can escape; every file is checked', () => {
  for (let missing = 0; missing < MEDIA_ADVICE_BASELINE_PATHS.length; missing++) {
    const calls = [];
    assert.throws(() => readMediaAdviceBaselineSources((command, args) => {
      calls.push({ command, args });
      if (args[0] === 'show' && args[1] === `${MEDIA_ADVICE_BASELINE_SHA}:${MEDIA_ADVICE_BASELINE_PATHS[missing]}`) throw privateError();
      return args[0] === 'show' ? '// authored source that is never executed' : '';
    }), error => safeFailure(error, MEDIA_ADVICE_BASELINE_PATHS[missing]));
    assert.equal(calls.length, missing + 2);
    assert.deepEqual(calls.at(-1).args, ['show', `${MEDIA_ADVICE_BASELINE_SHA}:${MEDIA_ADVICE_BASELINE_PATHS[missing]}`]);
    assert.ok(calls.every(call => ['cat-file', 'show'].includes(call.args[0])));
  }
});
