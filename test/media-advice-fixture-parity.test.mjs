// Textual parity against committed data, not a new source response or a mock
// baseline implemented with current functions. Only import paths, comments and
// the shared catalogue export name may change. Runtime parity is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MEDIA_ADVICE_BASELINE_SHA, readMediaAdviceBaselineSources } from './media-advice-history.fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const normalize = source => source.replaceAll('\r\n', '\n');
const read = async name => normalize(await readFile(new URL(`../${name}`, import.meta.url), 'utf8'));
function frozen(name) {
  try {
    return normalize(execFileSync('git', ['show', `${MEDIA_ADVICE_BASELINE_SHA}:${name}`], {
      cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024,
    }));
  } catch {
    throw Error(`Frozen fixture baseline ${MEDIA_ADVICE_BASELINE_SHA}:${name} is unavailable. ` +
      `Run git fetch origin ${MEDIA_ADVICE_BASELINE_SHA} (or git fetch --unshallow origin), ` +
      'then rerun node --test test/media-advice-fixture-parity.test.mjs. No skip or current-code fallback.');
  }
}
const withoutComments = source => source.replace(/^\/\/[^\n]*(?:\n|$)/gm, '').trim();

test('relocated fixture implementations equal the fixed pre-separation baseline except reviewed imports/comments', async () => {
  readMediaAdviceBaselineSources(); // Same explicit full/shallow history prerequisite as frozen runtime parity.
  for (const name of ['assisted-kinobaza', 'film-workflow', 'kinobaza-localization', 'recommendation-markup']) {
    let before = frozen(`research/grounded-answer-demo/test/${name}.fixture.mjs`);
    let after = await read(`test/${name}.fixture.mjs`);
    if (name === 'kinobaza-localization') {
      const oldImports = "import { syntheticHtml } from '../synthetic.mjs';\nimport { FILMS } from '../config.mjs';\n";
      const newImport = "import { syntheticHtml, SYNTHETIC_FILMS as FILMS } from './kinobaza-html.fixture.mjs';\n";
      assert.ok(before.includes(oldImports)); assert.ok(after.includes(newImport));
      before = before.replace(oldImports, ''); after = after.replace(newImport, '');
    }
    assert.equal(withoutComments(after), withoutComments(before), `${name}: preserve every authored value, URL, byte escape and builder`);
  }
});

test('shared HTML builder and three fixture identities equal their frozen demo originals', async () => {
  const current = await read('test/kinobaza-html.fixture.mjs');
  const oldConfig = frozen('research/grounded-answer-demo/config.mjs');
  const oldSynthetic = frozen('research/grounded-answer-demo/synthetic.mjs');
  const catalogue = (source, name) => {
    const match = source.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\{[\\s\\S]*?\\n\\}\\);`, 'g'));
    assert.equal(match?.length, 1, `Exactly one ${name} catalogue is required`);
    return match[0].replace(`export const ${name}`, 'export const FILMS');
  };
  const builder = source => {
    const start = source.indexOf('export function syntheticHtml(film) {');
    assert.ok(start >= 0);
    const end = source.indexOf('\n}', start);
    assert.ok(end > start);
    return source.slice(start, end + 2);
  };
  assert.equal(catalogue(current, 'SYNTHETIC_FILMS'), catalogue(oldConfig, 'FILMS'));
  assert.equal(builder(current), builder(oldSynthetic));
});
