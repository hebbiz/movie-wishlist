// Test-only pinned history reader. It never fetches or falls back to current code.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

export function readMediaAdviceBaselineSources(runGit = execFileSync) {
  const options = { cwd: repository, encoding: 'utf8', windowsHide: true,
    maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };
  try { runGit('git', ['cat-file', '-e', `${MEDIA_ADVICE_BASELINE_SHA}^{commit}`], options); }
  catch { throw unavailable(); }

  // Verify every required historical file before any frozen module executes.
  // A partial history/source read must never leave a partial parity baseline.
  const sources = new Map();
  for (const path of MEDIA_ADVICE_BASELINE_PATHS) {
    try { sources.set(path, runGit('git', ['show', `${MEDIA_ADVICE_BASELINE_SHA}:${path}`], options)); }
    catch { throw unavailable(path); }
  }
  return sources;
}
