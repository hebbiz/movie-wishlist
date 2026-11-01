// Local study only: load reviewed baseline code, never fetch or archive source
// responses. Both policies inspect the same in-memory current card response.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractHtml } from '../research/grounded-answer-demo/html-source.mjs';
import { assistedIdentity } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
export const CASCADE_BASELINE_SHA = '5a9c3c38f892644d04988d9055e3463fc6b9b86b';
const source = 'research/grounded-answer-demo/assisted-kinobaza.mjs';

export async function loadCascadeBaseline() {
  const root = new URL('../', import.meta.url), moduleURL = new URL(source, root);
  // The protected Windows worker intentionally has no inherited PATH. Use the
  // verified local Git executable, like the runner's fixed Node executable.
  const git = process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
  const baseline = execFileSync(git, ['show', `${CASCADE_BASELINE_SHA}:${source}`],
    { cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 128 * 1024, windowsHide: true, stdio: ['ignore','pipe','ignore'] });
  // Only this fixed committed module is loaded. Relative imports resolve to the
  // unchanged shared extractor/registry; no browser/env-selected code is loaded.
  const code = baseline.replace(/from '(\.[^']+)'/g, (_, path) => `from '${new URL(path, moduleURL).href}'`);
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return loaded.assistedIdentity;
}

export async function compareCascadeCard(html, film, sourceURL, beforeIdentity) {
  const summary = card => ({ identity: card.identity?.status ?? 'unresolved', reason: card.identity?.reason ?? null,
    extraction: card.status, candidates: card.candidates?.length ?? 0, providerBlocks: card.localization?.blocks?.length ?? 0 });
  const before = performance.now();
  const oldCard = await extractHtml(html, film, { identityCheck: all => beforeIdentity(all, film, sourceURL) });
  const between = performance.now();
  const newCard = await extractHtml(html, film, { identityCheck: all => assistedIdentity(all, film, sourceURL) });
  return { sourceURL, baselineSha: CASCADE_BASELINE_SHA, execution: 'same-current-response-policy-comparison',
    before: summary(oldCard), after: summary(newCard),
    localParseMs: { before: Math.round((between - before) * 100) / 100, after: Math.round((performance.now() - between) * 100) / 100 } };
}
