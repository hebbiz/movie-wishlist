// Test-only pinned history reader. It never fetches or falls back to current code.
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, writeFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export const MEDIA_ADVICE_BASELINE_SHA = '42b4b849d77281e1660701500c7bba9e6ec44b02';
export const MEDIA_ADVICE_BASELINE_PATHS = Object.freeze([
  'research/grounded-answer-demo/kinobaza-localization.mjs',
  'research/grounded-answer-demo/html-source.mjs',
  'research/grounded-answer-demo/tmdb.mjs',
  'research/grounded-answer-demo/motn.mjs',
  'research/grounded-answer-demo/assisted-kinobaza.mjs',
  'research/grounded-answer-demo/discovery.mjs',
  'netlify/lib/kinobaza-director-verifier.mjs',
  'netlify/lib/kinobaza-resolver.mjs',
  'netlify/lib/media-advice-service.mjs',
]);

// Complete, reviewed historical closure, including the original circular
// config -> discovery -> synthetic -> config wiring. These are Git objects,
// not current checkout dependencies or a second permanent demo installation.
export const MEDIA_ADVICE_BASELINE_CLOSURE = Object.freeze([
  ...MEDIA_ADVICE_BASELINE_PATHS,
  'netlify/lib/director-candidate-selection.mjs', 'netlify/lib/director-profile.mjs',
  'netlify/lib/kinobaza-predicted-url.mjs',
  'research/grounded-answer-demo/config.mjs', 'research/grounded-answer-demo/held-out.mjs',
  'research/grounded-answer-demo/megogo.mjs', 'research/grounded-answer-demo/synthetic.mjs',
  'research/grounded-answer-demo/test/kinobaza-localization.fixture.mjs',
  'research/grounded-answer-demo/url-context.mjs',
  'shared/director-alias-crosswalk.mjs', 'shared/director-profile-diagnostics.mjs',
  'shared/film-identity-context.mjs', 'shared/film-release-year.mjs',
  'shared/kinobaza-movie-identity.mjs', 'shared/media-advice-diagnostics.mjs',
  'shared/media-link-policy.mjs', 'shared/media-search-relevance-diagnostic.mjs',
  'shared/terminal-roman-title.mjs', 'shared/ukrainian-g-title.mjs',
  'test/media-advice-group.fixture.mjs',
]);

const repository = fileURLToPath(new URL('../', import.meta.url));
function unavailable(path) {
  // Do not attach the caught Git error: stderr could contain local config,
  // credentials or user paths. Only reviewed constants appear in this message.
  const missing = path ? `required file ${path}` : 'commit';
  const error = new Error(`Frozen media-advice parity baseline ${MEDIA_ADVICE_BASELINE_SHA} is unavailable locally (${missing}). ` +
    `From the repository root, run git fetch origin ${MEDIA_ADVICE_BASELINE_SHA}; ` +
    'for a shallow checkout, git fetch --unshallow origin is another option. ' +
    'Then rerun node --test test/media-advice-runtime-parity.test.mjs. ' +
    'No automatic fetch, skipped parity check or current-code fallback is allowed.');
  error.code = 'M4_FROZEN_BASELINE_UNAVAILABLE';
  return error;
}

export function readMediaAdviceBaselineSources(runGit = execFileSync, paths = MEDIA_ADVICE_BASELINE_PATHS) {
  const options = { cwd: repository, encoding: 'utf8', windowsHide: true,
    maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };
  try { runGit('git', ['cat-file', '-e', `${MEDIA_ADVICE_BASELINE_SHA}^{commit}`], options); }
  catch { throw unavailable(); }

  // Verify every required historical file before any frozen module executes.
  // A partial history/source read must never leave a partial parity baseline.
  const sources = new Map();
  for (const path of paths) {
    try { sources.set(path, runGit('git', ['show', `${MEDIA_ADVICE_BASELINE_SHA}:${path}`], options)); }
    catch { throw unavailable(path); }
  }
  return sources;
}

export async function loadMediaAdviceBaseline() {
  const sources = readMediaAdviceBaselineSources(execFileSync, MEDIA_ADVICE_BASELINE_CLOSURE);
  const historicalRoot = new URL('https://frozen.invalid/');
  // Do not silently resolve any missing historical import against current code.
  for (const [file, source] of sources) {
    for (const [, , specifier] of source.matchAll(/(?:\bfrom\s+|\bimport\(\s*)(['"])([^'"]+)\1/g)) {
      if (specifier === 'parse5' || specifier === 'node:crypto') continue;
      if (!specifier.startsWith('.')) throw Error(`Unreviewed frozen package dependency: ${file} -> ${specifier}`);
      const target = new URL(specifier, new URL(file, historicalRoot));
      if (target.origin !== historicalRoot.origin || !sources.has(target.pathname.slice(1))) {
        throw Error(`Missing frozen dependency: ${file} -> ${specifier}`);
      }
    }
  }
  const tempRoot = resolve(tmpdir()), prefix = 'mw-m4-frozen-baseline-';
  const directory = await mkdtemp(join(tempRoot, prefix));
  const rootURL = pathToFileURL(directory + '/');
  const dispose = async () => {
    const target = resolve(directory), entry = await lstat(target);
    if (dirname(target) !== tempRoot || !basename(target).startsWith(prefix) || !entry.isDirectory() || entry.isSymbolicLink()) {
      throw Error('Unsafe frozen baseline cleanup target');
    }
    await rm(target, { recursive: true, force: true, maxRetries: 15, retryDelay: 100 });
  };
  try {
    const parserURL = import.meta.resolve('parse5');
    for (const [file, source] of sources) {
      const target = fileURLToPath(new URL(file, rootURL));
      await mkdir(dirname(target), { recursive: true });
      // Only the package resolution URL changes. Relative historical paths,
      // module bodies, default gates, input data and all assertions stay exact.
      await writeFile(target, source.replaceAll("import('parse5')", `import('${parserURL}')`));
    }
  } catch (error) { await dispose(); throw error; }
  return { sources, dispose, importModule: file => {
    if (!sources.has(file)) throw Error(`Unreviewed frozen entry: ${file}`);
    return import(new URL(file, rootURL).href);
  } };
}
