// Local study only: load reviewed baseline code, never fetch or archive source
// responses. Both policies inspect the same in-memory current card response.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractHtml } from '../netlify/lib/kinobaza-html.mjs';
import { assistedIdentity } from '../netlify/lib/kinobaza-card.mjs';
export const CASCADE_BASELINE_SHA = '5a9c3c38f892644d04988d9055e3463fc6b9b86b';
const source = 'research/grounded-answer-demo/assisted-kinobaza.mjs';

export async function loadCascadeBaseline(sha = CASCADE_BASELINE_SHA) {
  if (![CASCADE_BASELINE_SHA,'21d1be24acf2b654254c38c9b252246ed8de1343'].includes(sha)) throw Error('fixed-local-baseline-required');
  const root = new URL('../', import.meta.url), moduleURL = new URL(source, root);
  // The protected Windows worker intentionally has no inherited PATH. Use the
  // verified local Git executable, like the runner's fixed Node executable.
  const git = process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
  const baseline = execFileSync(git, ['show', `${sha}:${source}`],
    { cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 128 * 1024, windowsHide: true, stdio: ['ignore','pipe','ignore'] });
  // Keep the pinned body/gates and Git source path. Its extractor import used
  // the demo wrapper only with an explicit identityCheck, which delegates
  // unchanged to this runtime extractor. No demo scenario/catalogue is needed.
  const runtimeImports = new Map([
    ['research/grounded-answer-demo/html-source.mjs', 'netlify/lib/kinobaza-html.mjs'],
    ['shared/media-advice-diagnostics.mjs', 'shared/media-advice/media-advice-diagnostics.mjs'],
    ['shared/director-alias-crosswalk.mjs', 'netlify/lib/media-advice/identity/director-alias-crosswalk.mjs'],
  ]), rebound = new Map();
  const code = baseline.replace(/from '(\.[^']+)'/g, (_, path) => {
    const absolute = new URL(path, moduleURL);
    const relative = fileURLToPath(absolute).slice(fileURLToPath(root).length).replaceAll('\\', '/');
    if (runtimeImports.has(relative)) {
      rebound.set(relative, (rebound.get(relative) ?? 0) + 1);
      return `from '${new URL(runtimeImports.get(relative), root).href}'`;
    }
    return `from '${absolute.href}'`;
  });
  if ([...runtimeImports.keys()].some(path => rebound.get(path) !== 1)) throw Error('fixed-baseline-runtime-import-unestablished');
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  loaded.assistedIdentity.baselineSha = sha;
  return loaded.assistedIdentity;
}

export async function compareCascadeCard(html, film, sourceURL, beforeIdentity) {
  const summary = card => ({ identity: card.identity?.status ?? 'unresolved', reason: card.identity?.reason ?? null,
    extraction: card.status, candidates: card.candidates?.length ?? 0, providerBlocks: card.localization?.blocks?.length ?? 0 });
  const before = performance.now();
  // The previous production service did not retain translations. Do not lend
  // new English title evidence (or a diagnostic control spelling) to its gate.
  const baselineFilm = beforeIdentity.baselineSha === '21d1be24acf2b654254c38c9b252246ed8de1343' && film.identityContext ?
    { ...film, identityContext: undefined, titleAliases: [film.identityTitle,film.originalTitle,
      ...film.identityContext.titleEvidence.filter(t=>t.source === 'alternative').map(t=>t.title)].filter(Boolean) } : film;
  const oldCard = await extractHtml(html, baselineFilm, { identityCheck: all => beforeIdentity(all, baselineFilm, sourceURL) });
  const between = performance.now();
  const newCard = await extractHtml(html, film, { identityCheck: all => assistedIdentity(all, film, sourceURL) });
  return { sourceURL, baselineSha: beforeIdentity.baselineSha ?? CASCADE_BASELINE_SHA, execution: 'same-current-response-policy-comparison-before-optional-profile',
    before: summary(oldCard), after: summary(newCard),
    localParseMs: { before: Math.round((between - before) * 100) / 100, after: Math.round((performance.now() - between) * 100) / 100 } };
}
