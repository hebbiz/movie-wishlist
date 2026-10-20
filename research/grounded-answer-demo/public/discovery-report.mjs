// Allowlisted plain text only. Never serialize source payloads, URLs or draft input.
const films = { coherence: 'Coherence (2013)', 'dune-part-two': 'Dune: Part Two (2024)',
  'kingdom-of-heaven': 'Kingdom of Heaven (2005)', 'the-thing-1982': 'The Thing (1982)',
  'the-thing-2011': 'The Thing (2011)', parasite: 'Parasite (2019)' };
const sources = { tmdb: 'TMDb / JustWatch', motn: 'Movie of the Night', kinobaza: 'Kinobaza HTML' };
const providers = { apple: 'Apple TV Store', prime: 'Prime Video', netflix: 'Netflix', rakuten: 'Rakuten TV', hbo: 'HBO Max', megogo: 'MEGOGO' };
const outcomes = new Set(['compatible', 'conflicting', 'insufficient-evidence']);
const reasons = {
  'tmdb-primary-gate': 'TMDb primary ID gate; crosswalk separate', 'imdb-film-gate': 'Exact IMDb gate; supplied stable IDs agree',
  'structural-film-gate': 'Source title/year/director gate; no stable-ID crosswalk', 'stable-id-conflict': 'Conflicting stable identity evidence',
  'row-film-conflict': 'Row film differs from selected fixed film', 'source-identity-unresolved': 'Source identity unresolved',
  'provider-id-conflict': 'Namespaced provider-ID conflict', 'provider-mapping-unresolved': 'Provider mapping unresolved',
  'same-supported-regional-pointer': 'Same supported regional card pointer; destination unverified',
  'different-supported-card-ids': 'Different supported card IDs for proposed same-card link',
  'source-territory-differs': 'Source territories differ; no common regional scope established',
  'regional-pointer-unresolved': 'Regional card context unresolved', 'pointer-qualifiers-unresolved': 'Card qualifiers/version ambiguous',
  'no-supported-direct-pointer': 'Related film/provider claim, exact card unresolved',
  'no-comparable-card-peer': 'Supported pointer reported; no comparable peer card',
};
const known = (map, key, fallback) => Object.hasOwn(map, key) ? map[key] : fallback;
const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000 ? String(n) : 'unknown';
const identity = s => ['matched', 'mismatch', 'unresolved'].includes(s) ? s : 'unresolved';
export const reasonText = r => known(reasons, r, 'Evidence/reason unresolved');
export const sourceLabel = s => known(sources, s, 'Source unknown');
export function relationText(link) {
  return `${outcomes.has(link?.outcome) ? link.outcome : 'insufficient-evidence'}: ${reasonText(link?.reason)}`;
}
const statuses = new Set(['ok', 'partial', 'no-ua-options', 'disabled-no-request', 'missing-key-no-request', 'missing-token-no-request',
  'identity-mismatch', 'identity-unresolved', 'stage-failed-no-retry', 'deadline-no-retry', 'canonical-redirect-refused',
  'redirect-not-followed', 'http-error', 'invalid-response', 'timeout', 'unsupported-markup']);
function statusText(s) {
  if (statuses.has(s)) return s;
  const tmdb = /^A: (ok|partial|identity-mismatch|identity-unresolved|http-error|timeout|missing-token-no-request); B: (ok|partial|not-requested|invalid-response-or-id|http-error|timeout)$/.exec(s);
  return tmdb ? `A: ${tmdb[1]}; B: ${tmdb[2]}` : 'unresolved status (inspect page)';
}
function timestamp(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) || !Number.isFinite(Date.parse(s))) return 'unknown';
  return s;
}
const access = f => f?.state === 'reported' ? known({ rent: 'rental', rental: 'rental', buy: 'purchase', purchase: 'purchase',
  subscription: 'subscription', flatrate: 'subscription', 'ad-supported': 'ad-supported', free: 'free', addon: 'addon' }, f.value, 'unknown') : 'unknown';
const linkKinds = new Set(['missing', 'unsafe', 'unknown', 'relative', 'search', 'tmdb-watch-page', 'tracking-redirect', 'exact-card-unverified']);
export function buildShortReport({ filmId, mode, receivedAt, result, failed = false, draft = {} } = {}) {
  const lines = ['MW-FUT-01-M2 — short report', known(films, filmId, 'Fixed film unknown'),
    mode === 'synthetic' ? 'SYNTHETIC ONLY — authored data, not live validation.' : mode === 'live' ? 'LIVE source claims — not owner validation or entitlement.' : 'Mode unknown.',
    `Browser receipt: ${timestamp(receivedAt)}`, 'Commit: unknown (runtime provenance not attested).'];
  if (failed) lines.push('Request failed/invalid response; source results and HTTP-call count unknown. No retry.');
  else {
    lines.push(`HTTP calls: ${count(result?.metrics?.requestsMade)}/${count(result?.metrics?.requestBudget)}; elapsed: ${count(result?.metrics?.elapsedMs)} ms (not benchmark/cost).`);
    for (const source of ['tmdb', 'motn', 'kinobaza']) {
      const s = result?.sources?.find(s => s.source === source);
      const a = result?.matching?.subjects?.find(s => s.source === source);
      lines.push(`${sourceLabel(source)}: ${statusText(s?.status)}; identity ${identity(s?.identity)}; A ${relationText(a)}.`);
    }
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const links = new Map((result?.matching?.rows ?? []).map(r => [r.rowId, r]));
    for (const row of rows.slice(0, 12)) {
      const source = typeof row.id === 'string' ? row.id.split(':')[0] : '';
      const m = links.get(row.id);
      const unknowns = [['territory', row.country === 'UA'], ['access', access(row.access) !== 'unknown'],
        ['version', row.cut?.state === 'reported'], ['audio', row.audio?.ukrainian?.length > 0], ['subtitles', row.subtitles?.ukrainian?.length > 0],
        ['video', row.quality?.state === 'reported'], ['price', row.price?.amount?.state === 'reported' && row.price?.currency?.state === 'reported']].filter(([, present]) => !present).map(([key]) => key);
      const block = row.kinobazaLocalization;
      const blockState = s => ['reported-positive', 'reported-negative', 'conflicting'].includes(s) ? s : 'unknown';
      lines.push(`${sourceLabel(source)} / ${known(providers, row.provider?.key, 'Platform unresolved')} / ${access(row.access)} / link ${linkKinds.has(row.link?.kind) ? row.link.kind : 'unknown'}; B ${relationText(m?.B)}; unknown: ${unknowns.join(', ') || 'none in summary'}; conflicts ${count(row.conflicts?.length)}${block ? `; own-block audio ${blockState(block.audio?.state)}, subtitles ${blockState(block.subtitles?.state)} (no enrichment)` : ''}.`);
    }
    if (rows.length > 12) lines.push(`Omitted rows: ${count(rows.length - 12)}; inspect the page for remaining unknowns/conflicts.`);
    lines.push(`Unmapped observations: ${count(result?.unmapped?.length)} (no canonical draft selection).`);
  }
  lines.push(`Draft: ${draft.present === true ? 'present' : 'not present'}; confirmed ${draft.confirmed === true ? 'yes' : 'no'}; edited ${draft.edited === true ? 'yes' : 'no'}; latest selection cancelled ${draft.selectionCancelled === true ? 'yes' : 'no'}; cleared ${draft.cleared === true ? 'yes' : 'no'}. Contents excluded.`,
    'Separate source rows; C/D deferred; unknown is not absent. No verified/best offer or account entitlement.',
    'TMDb and Kinobaza JustWatch sections share lineage; other upstream independence not established.');
  return lines.join('\n'); // Bounded fixed fields/12 compact rows, no raw strings or URLs.
}

export async function writeShortReport(text, navigator) {
  try {
    if (typeof text !== 'string' || text.length > 12_000 || typeof navigator?.clipboard?.writeText !== 'function') return 'fallback';
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch { return 'fallback'; } // Never surface browser exception text or falsely report success.
}
