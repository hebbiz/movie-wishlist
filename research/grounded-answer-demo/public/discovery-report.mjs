// Allowlisted plain text only. Never serialize source payloads, URLs or draft input.
const films = { coherence: 'Coherence (2013)', 'dune-part-two': 'Dune: Part Two (2024)',
  'kingdom-of-heaven': 'Kingdom of Heaven (2005)', 'the-thing-1982': 'The Thing (1982)',
  'the-thing-2011': 'The Thing (2011)', parasite: 'Parasite (2019)' };
const sources = { tmdb: 'TMDb / JustWatch', motn: 'Movie of the Night', kinobaza: 'Kinobaza HTML' };
const providers = { apple: 'Apple TV Store', prime: 'Prime Video', netflix: 'Netflix', rakuten: 'Rakuten TV', hbo: 'HBO Max', megogo: 'MEGOGO' };
const outcomes = new Set(['compatible', 'conflicting', 'insufficient-evidence', 'not-evaluated']);
const reasons = {
  'tmdb-primary-gate': 'TMDb primary ID gate; crosswalk separate', 'imdb-film-gate': 'Exact IMDb gate; supplied stable IDs agree',
  'structural-film-gate': 'Source title/year/director gate; no stable-ID crosswalk', 'stable-id-conflict': 'Conflicting stable identity evidence',
  'source-year-conflict-without-stable-crosswalk': 'Year differs; stable-ID crosswalk unestablished; source claims withheld',
  'source-title-conflict': 'Source title conflicts with selected aliases; source claims withheld',
  'source-canonical-conflict': 'Source canonical conflicts with admitted card; source claims withheld',
  'source-identity-conflict': 'Source identity gate refused; conflict basis unresolved',
  'row-film-conflict': 'Row film differs from selected fixed film', 'source-identity-unresolved': 'Source identity unresolved',
  'provider-id-conflict': 'Namespaced provider-ID conflict', 'provider-mapping-unresolved': 'Provider mapping unresolved',
  'same-supported-regional-pointer': 'Same supported regional card pointer; destination unverified',
  'different-supported-card-ids': 'Different supported card IDs for proposed same-card link',
  'source-territory-differs': 'Source territories differ; no common regional scope established',
  'regional-pointer-unresolved': 'Regional card context unresolved', 'pointer-qualifiers-unresolved': 'Card pointer qualifiers unresolved (not a proved cut/version)',
  'disabled-by-scenario': 'not evaluated — disabled by scenario',
  'missing-imdb-crosswalk': 'not evaluated — no verified IMDb crosswalk',
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
const pointerCodes = new Set(['opaque-tracking-destination-unknown', 'country-watch-page-only', 'link-not-reported',
  'link-kind-not-comparable', 'explicit-authority-unresolved', 'path-encoding-unresolved', 'fragment-unclassified',
  'query-key-malformed', 'query-key-repeated', 'query-key-unclassified']);
const comparisonCodes = new Set(['same-declared-card-offer-scope-unknown', 'card-pointer-equivalence-unestablished',
  'package-differs', 'package-scope-unresolved', 'version-differs', 'version-scope-unresolved']);
const localizationState = field => ['reported-positive', 'reported-negative', 'conflicting'].includes(field?.state) ? field.state : 'unknown';
const fieldNames = new Set(['quality', 'price', 'audio', 'subtitles', 'localization']);
export function comparisonSummary(row) {
  const possible = (row.comparisons ?? []).filter(c => c.outcome === 'possible-discrepancy');
  const separate = (row.comparisons ?? []).filter(c => c.outcome === 'non-comparable');
  const fields = items => [...new Set(items.map(c => c.field).filter(f => fieldNames.has(f)))].join('/');
  return [possible.length ? `Possible discrepancy ${fields(possible)} — offer/field scope unestablished` : '',
    separate.length ? `Non-comparable observations ${fields(separate)} — no confirmed field conflict` : ''].filter(Boolean).join('; ');
}
function diagnosticSummary(d) {
  const parts = [];
  for (const key of ['external_ids', 'alternative_titles', 'credits', 'release_dates', 'translations']) {
    const state = d?.resources?.[key]?.state;
    if (['missing', 'null', 'invalid'].includes(state)) parts.push(`resource.${key}:${state}`);
  }
  const path = /^metadata(?:\.(?:originalTitle|requestedTitle|releaseDate|originalLanguage|spokenLanguages|externalIds|alternativeTitles|directors|releaseDates|translations|items|country|title|type|language|name|id|originalName|dates|date|overview|tagline|[0-9]{1,4}))+$/;
  for (const field of (Array.isArray(d?.fields) ? d.fields : []).slice(0, 32)) {
    if (field.state === 'invalid' && typeof field.path === 'string' && field.path.length <= 180 && path.test(field.path)) parts.push(`${field.path}:invalid`);
  }
  return parts.length ? parts.slice(0, 8).join(', ') + (parts.length > 8 || d?.omitted > 0 ? '; diagnostic-paths-omitted' : '')
    : 'partial-cause-not-in-summary; missing optional fields alone are not a cause';
}
const statuses = new Set(['ok', 'partial', 'no-ua-options', 'disabled-no-request', 'missing-key-no-request', 'missing-token-no-request',
  'identity-unresolved', 'identity-mismatch', 'access-blocked-no-retry', 'http-error-no-retry', 'unsupported-content-type', 'response-too-large',
  'empty-response', 'challenge-unsupported-no-retry', 'timeout-or-cancelled-no-retry', 'network-or-decoding-error-no-retry', 'parser-unavailable', 'unresolved', 'unsafe-response-withheld',
  'not-evaluated-missing-crosswalk',
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
  const dynamic = result?.dynamic === true && result.film?.dynamic === true && result.film.id === filmId;
  const safeTitle = dynamic && typeof result.film.title === 'string' && result.film.title.length <= 180 && !/[\p{C}<>]|https?:|@/iu.test(result.film.title) ? result.film.title : 'Selected title withheld';
  const lines = [dynamic ? `MW-FUT-01-M3.1${result.assisted ? '/M3.2 assisted' : ''} — short report` : 'MW-FUT-01-M2 — short report', dynamic ? safeTitle : known(films, filmId, 'Fixed film unknown'),
    mode === 'synthetic' ? 'SYNTHETIC ONLY — authored data, not live validation.' : mode === 'live' ? 'LIVE source claims — not owner validation or entitlement.' : 'Mode unknown.',
    `Browser receipt: ${timestamp(receivedAt)}`, 'Commit: unknown (runtime provenance not attested).'];
  if (dynamic) {
    const a = result.accounting;
    lines.push(`HTTP phases: search ${count(a?.counters?.search)}/2; preview ${count(a?.counters?.preview)}/2; discovery ${count(a?.counters?.discovery)}/2; case cap${a?.cap === 7 ? 7 : 6}.`,
      `Phase elapsed ms: search ${count(a?.phaseElapsedMs?.search)}; preview ${count(a?.phaseElapsedMs?.preview)}; discovery ${count(a?.phaseElapsedMs?.discovery)}. Not benchmark/cost.`,
      `Selected TMDb ID: ${Number.isSafeInteger(result.film.tmdbId) && result.film.tmdbId > 0 && result.film.tmdbId <= 2_147_483_647 ? result.film.tmdbId : 'unknown'}; IMDb crosswalk ${/^tt\d{1,20}$/.test(result.film.imdbId ?? '') ? `reported-match (${result.film.imdbId})` : 'unknown — MOTN not evaluated'}.`,
      'Kinobaza: not evaluated — dynamic M3.1 scope, not a resolver failure.');
    if (result.assisted || a?.cap === 7) {
      lines[lines.length - 1] = result.assisted ? 'Kinobaza: assisted card check; not automated discovery or offer enrichment.' : 'Kinobaza: address admitted; source not evaluated yet.';
      lines.push(`Assisted HTTP: Kinobaza ${count(a?.counters?.kinobaza)}/1; total case cap7; phase elapsed ${count(a?.phaseElapsedMs?.kinobaza)} ms.`);
      if (result.assistedContribution) {
        const c = result.assistedContribution;
        const reasons = new Set(['source-canonical-conflict', 'source-canonical-ambiguous', 'malformed-source-stable-id', 'source-stable-id-conflict', 'source-identity-structure-incomplete', 'source-identity-structure-limit', 'source-title-year-missing',
          'source-title-conflict', 'source-original-title-unestablished', 'source-original-title-scope-unestablished', 'selected-year-missing', 'source-year-conflict-without-stable-crosswalk', 'source-or-selected-director-missing', 'director-scope-unestablished', 'director-alias-unestablished', 'explicit-stable-and-structural-match', 'explicit-title-year-director-match', 'html-parse-errors']);
        lines.push(`Assisted addition: identity ${identity(c.identity)}; candidates ${count(c.candidates)}; localization blocks ${count(c.blocks)}; reason ${reasons.has(c.reason) ? c.reason : 'unresolved-or-inspect-page'}.`);
        const extractionCodes = new Set(['html-size-limit', 'html-parse-errors', 'noncritical-image-markup-recovered', 'missing-or-duplicate-availabilityAccordion', 'unsupported-accordion-items',
          'ambiguous-territory-heading', 'ambiguous-territory-control', 'unsupported-or-conflicting-territory', 'ambiguous-territory-panel',
          'missing-explicit-ukraine-section', 'candidate-count-limit', 'unresolved-parser-or-structure']);
        const extraction = (Array.isArray(c.extractionIssues) ? c.extractionIssues : []).filter(code => extractionCodes.has(code)).slice(0, 8);
        if (extraction.length) lines.push(`Assisted extraction diagnostics: ${extraction.join(', ')}; not evidence of absent offers.`);
      }
    }
  }
  if (failed) lines.push('Request failed/invalid response; source results and HTTP-call count unknown. No retry.');
  else {
    lines.push(`HTTP calls: ${count(result?.metrics?.requestsMade)}/${count(result?.metrics?.requestBudget)}; elapsed: ${count(result?.metrics?.elapsedMs)} ms (not benchmark/cost).`);
    for (const source of ['tmdb', 'motn', 'kinobaza']) {
      const s = result?.sources?.find(s => s.source === source);
      const a = result?.matching?.subjects?.find(s => s.source === source);
      if (s?.status === 'disabled-no-request') {
        lines.push(`${sourceLabel(source)}: not evaluated — ${dynamic ? 'dynamic M3.1 scope' : 'disabled by scenario'}; no request.`); continue;
      }
      lines.push(`${sourceLabel(source)}: ${statusText(s?.status)}; identity ${identity(s?.identity)}; A ${relationText(a)}.`);
      if (source === 'tmdb' && s?.diagnostics?.status === 'partial') lines.push(`TMDb A partial diagnostics: ${diagnosticSummary(s.diagnostics)}.`);
    }
    lines.push(result?.sources?.some(s => s.source === 'kinobaza' && s.status === 'disabled-no-request')
      ? `Kinobaza localization: not evaluated — ${dynamic ? 'dynamic M3.1 scope' : 'disabled by scenario'}.`
      : `Kinobaza film-level localization: UA audio ${localizationState(result?.filmLocalization?.ukrainianAudio)}; not provider tracks.`);
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const links = new Map((result?.matching?.rows ?? []).map(r => [r.rowId, r]));
    for (const row of rows.slice(0, 12)) {
      const source = typeof row.id === 'string' ? row.id.split(':')[0] : '';
      const m = links.get(row.id);
      const unknowns = [['territory', row.country === 'UA'], ['access', access(row.access) !== 'unknown'],
        ['version', row.cut?.state === 'reported'], ['audio', row.audio?.ukrainian?.length > 0], ['subtitles', row.subtitles?.ukrainian?.length > 0],
        ['video', row.quality?.state === 'reported'], ['price', row.price?.amount?.state === 'reported' && row.price?.currency?.state === 'reported']].filter(([, present]) => !present).map(([key]) => key);
      const block = row.kinobazaLocalization;
      const details = (m?.B?.detailCodes ?? []).filter(c => pointerCodes.has(c)).slice(0, 2);
      const conflicts = (row.conflicts ?? []).filter(c => fieldNames.has(c.field)).slice(0, 4).map(c => `${c.field}:${c.type === 'conflicting-block-labels' ? 'conflicting-block-labels' : 'unverified-flag'}`);
      const comparisons = (row.comparisons ?? []).slice(0, 4).filter(c => ['possible-discrepancy', 'non-comparable'].includes(c.outcome) && fieldNames.has(c.field) && comparisonCodes.has(c.reason)).map(c => `${c.outcome}:${c.field}:${c.reason}`);
      lines.push(`${sourceLabel(source)} / ${known(providers, row.provider?.key, 'Platform unresolved')} / ${access(row.access)} / link ${linkKinds.has(row.link?.kind) ? row.link.kind : 'unknown'}; B ${relationText(m?.B)}${details.length ? ` [${details.join(',')}]` : ''}; unknown: ${unknowns.join(', ') || 'none in summary'}; conflicts ${count(row.conflicts?.length)}${conflicts.length ? ` [${conflicts.join(',')}]` : ''}${comparisons.length ? `; ${comparisons.join(',')}` : ''}${row.comparisonsOmitted > 0 ? '; comparison-details-omitted' : ''}.`);
      if (block) lines.push(`Kinobaza own provider-block / ${known(providers, row.provider?.key, 'Platform unresolved')}: audio ${localizationState(block.audio)}, subtitles ${localizationState(block.subtitles)}; territory unknown; completeness unknown; not offer enrichment.`);
    }
    if (rows.length > 12) lines.push(`Omitted rows: ${count(rows.length - 12)}; inspect the page for remaining unknowns/conflicts.`);
    lines.push(`Unmapped observations: ${count(result?.unmapped?.length)} (no canonical draft selection).`);
  }
  lines.push(`Draft: ${draft.present === true ? 'present' : 'not present'}; confirmed ${draft.confirmed === true ? 'yes' : 'no'}; edited ${draft.edited === true ? 'yes' : 'no'}; latest selection cancelled ${draft.selectionCancelled === true ? 'yes' : 'no'}; cleared ${draft.cleared === true ? 'yes' : 'no'}. Contents excluded.`,
    'Separate source rows; C/D deferred; unknown is not absent. No verified/best offer or account entitlement.',
    'TMDb and Kinobaza JustWatch sections share lineage; other upstream independence not established.');
  const text = lines.join('\n');
  if (text.length <= 12_000) return text;
  const footer = lines.slice(-2).join('\n');
  const prefix = text.slice(0, 12_000 - footer.length - 100);
  return prefix.slice(0, prefix.lastIndexOf('\n')) + '\nSummary truncated; inspect page for remaining diagnostics.\n' + footer;
}

export async function writeShortReport(text, navigator) {
  try {
    if (typeof text !== 'string' || text.length > 12_000 || typeof navigator?.clipboard?.writeText !== 'function') return 'fallback';
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch { return 'fallback'; } // Never surface browser exception text or falsely report success.
}

// Search/preview failures are reportable without inventing a selected film/offer.
export function buildWorkflowReport({ workflow, status, mode, film, assisted = false } = {}) {
  const allowed = new Set(['results', 'no-results-for-query', 'invalid-search-response', 'preview', 'confirmed', 'identity-unresolved-or-conflicting',
    'missing-token-no-request', 'invalid-token-no-request', 'api-auth-error', 'api-access-denied', 'title-not-returned', 'quota-or-rate-limit',
    'api-http-error', 'api-error-object-withheld', 'redirect-not-followed', 'invalid-content-type', 'response-too-large', 'unsafe-response-withheld', 'timeout-no-retry',
    'invalid-or-network-response-no-retry', 'action-failed-no-retry', 'search-cap', 'candidate-unavailable-or-preview-cap', 'same-query-no-retry']);
  const c = workflow?.counters, e = workflow?.phaseElapsedMs;
  const selected = status === 'confirmed' && film?.dynamic === true && Number.isSafeInteger(film.tmdbId) && film.id === `tmdb:${film.tmdbId}`;
  return ['MW-FUT-01-M3.1 — short report', mode === 'synthetic' ? 'SYNTHETIC ONLY — authored, no live validation.' : 'Source actions only — not independent identity/availability validation.',
    'Commit: unknown (runtime provenance not attested).', `Last action: ${allowed.has(status) ? status : 'unresolved status'}.`,
    selected ? `User-confirmed TMDb ID: ${film.tmdbId}; IMDb crosswalk ${/^tt\d{1,20}$/.test(film.imdbId ?? '') ? 'reported-match' : 'unknown'}.` : 'Selected identity: not confirmed. No film/offer match asserted.',
    `HTTP phases: search ${count(c?.search)}/2; preview ${count(c?.preview)}/2; discovery ${count(c?.discovery)}/2; case cap${assisted || workflow?.cap === 7 ? 7 : 6}.`,
    `Phase elapsed ms: search ${count(e?.search)}; preview ${count(e?.preview)}; discovery ${count(e?.discovery)}. Not benchmark/cost.`,
    assisted ? `Kinobaza: assisted outcome/accounting unknown; HTTP ${count(c?.kinobaza)}/1; no retry. Prior source results may remain on page.` : 'Kinobaza: not evaluated — dynamic M3.1 scope, not a resolver failure.',
    'Last action outcome incomplete. Unknown is not unavailable. No draft values, queries, source bodies, URLs or credentials.'].join('\n');
}
