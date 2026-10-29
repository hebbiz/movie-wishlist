import { safeSearchDiagnostic, safeIdentityDiagnostic, safeExtractionDiagnostic, resolverStatuses } from '../shared/media-advice-diagnostics.mjs';
import { groupMediaRows, presentMediaGroups } from './media-advice-presentation.mjs';
const identities = new Set(['matched', 'mismatch', 'unresolved']);
const platforms = new Set(['apple','prime','netflix','hbo','rakuten','megogo']);
const accessKinds = new Set(['rent','rental','buy','purchase','subscription','flatrate','addon','free','ad-supported']);
const fieldStates = new Set(['unknown','reported','not-reported','invalid','missing','null','reported-empty']);
const conflictFields = new Set(['audio','subtitles','quality','price','localization','provider','identity','access','territory','link','package','cut','version']);
const conflictTypes = new Set(['conflicting-block-labels','provider-id-conflict','source-identity-conflict']);
const comparisonFields = new Set(['quality','price']);
const comparisonOutcomes = new Set(['non-comparable','possible-discrepancy']);
const comparisonReasons = new Set(['package-scope-unresolved','version-scope-unresolved','package-differs','version-differs','same-declared-card-offer-scope-unknown','card-pointer-equivalence-unestablished']);
const blockIssues = new Set(['provider-block-count-limit','ambiguous-provider-block','unsupported-provider-block','block-field-count-limit','conflicting-block-labels','possible-block-conflict-scope-unestablished']);
const sourceLabels = new Map([['Kinobaza HTML','kinobaza'], ['Movie of the Night','motn'], ['TMDB / JustWatch','tmdb'], ['TMDb / JustWatch','tmdb']]);
const stages = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title', 'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2'];
const knownReasons = new Set(['source-canonical-conflict','source-stable-id-conflict','source-canonical-ambiguous','malformed-source-stable-id','source-identity-structure-incomplete','source-original-title-unestablished','source-original-title-scope-unestablished','source-title-conflict','source-title-year-missing','selected-year-missing','source-year-conflict-without-stable-crosswalk','source-or-selected-director-missing','director-scope-unestablished','director-alias-unestablished','explicit-stable-and-structural-match','explicit-title-year-director-match']);
const count = n => Number.isSafeInteger(n) && n >= 0 && n < 10000 ? n : 'unknown';
const loc = s => ['reported-positive','reported-negative','conflicting'].includes(s) ? s : 'unknown';
const fieldState = field => fieldStates.has(field?.state) ? field.state : 'unknown';
function rowSource(row) {
  const rowId = typeof row?.id === 'string' ? row.id : '';
  const source = ['tmdb','motn','kinobaza'].find(source => rowId.startsWith(source + ':') || rowId.includes(':' + source + ':'));
  if (source) return source;
  return sourceLabels.get(row?.provenance?.source) ?? 'unknown';
}
function variantReferences(rows) {
  const references = new Map();
  for (const [groupIndex, group] of groupMediaRows(rows).entries()) {
    const platform = platforms.has(group.key) ? group.key : `unmapped-group-${count(groupIndex + 1)}`;
    for (const [index, row] of group.rows.entries()) references.set(row, `${platform}/variant-${count(index + 1)}`);
  }
  return references;
}
function rowDiagnostics(row, reference, source) {
  const access = row.access?.state === 'reported' && accessKinds.has(row.access.value) ? row.access.value : 'unknown';
  const conflicts = Array.isArray(row.conflicts) ? row.conflicts : [];
  const conflictLabels = conflicts.slice(0, 4).map(conflict => `${conflictFields.has(conflict?.field) ? conflict.field : 'unknown-field'}:${conflictTypes.has(conflict?.type) ? conflict.type : 'unverified-flag'}`);
  const comparisons = Array.isArray(row.comparisons) ? row.comparisons : [];
  const comparisonLabels = comparisons.slice(0, 4).map(comparison => `${comparisonFields.has(comparison?.field) ? comparison.field : 'unknown-field'}:${comparisonOutcomes.has(comparison?.outcome) ? comparison.outcome : 'unknown'}:${comparisonReasons.has(comparison?.reason) ? comparison.reason : 'unknown'}`);
  const issues = [...new Set((Array.isArray(row.kinobazaLocalization?.issues) ? row.kinobazaLocalization.issues : []).filter(issue => blockIssues.has(issue)))].slice(0, 8);
  return `Variant ${reference ?? 'unknown'}: source ${source}; access ${access}; quality ${fieldState(row.quality)}; price ${fieldState(row.price)} (amount ${fieldState(row.price?.amount)}, currency ${fieldState(row.price?.currency)}); conflicts ${count(conflicts.length)} [${conflictLabels.join(', ')}]; provider conflict ${row.providerConflict === true ? 'yes' : 'no'}; block issues [${issues.join(', ')}]; comparisons ${count(comparisons.length)} [${comparisonLabels.join(', ')}]; comparisons omitted ${count(row.comparisonsOmitted)}.`;
}
const sourceStatuses = new Set([...resolverStatuses, 'ok','partial','unresolved','identity-mismatch','identity-unresolved',
  'invalid-response','invalid-response-or-id','invalid-results','invalid-UA','missing-token-no-request','invalid-token-no-request',
  'missing-key-no-request','invalid-key-no-request','redirect-not-followed','api-auth-error','api-access-denied','title-not-returned',
  'quota-or-rate-limit','api-http-error','invalid-content-type','response-too-large','unsafe-response-withheld','timeout-no-retry',
  'invalid-or-network-response-no-retry','no-ua-options','not-evaluated-crosswalk-unresolved','not-evaluated-resolver-deferred',
  'not-requested','deadline-no-retry','stage-failed-no-retry','disabled-no-request','parser-unavailable','access-blocked-no-retry',
  'http-error-no-retry','unsupported-content-type','empty-response','challenge-unsupported-no-retry','timeout-or-cancelled-no-retry',
  'network-or-decoding-error-no-retry','canonical-redirect-refused','redirect-loop-or-second-hop-refused']);
function sourceStatus(source, status) {
  if (sourceStatuses.has(status)) return status;
  const parts = source === 'tmdb' && typeof status === 'string' ? /^A: ([A-Za-z0-9-]+); B: ([A-Za-z0-9-]+)$/.exec(status) : null;
  return parts && sourceStatuses.has(parts[1]) && sourceStatuses.has(parts[2]) ? status : 'unknown';
}
const imdb = value => typeof value === 'string' && /^tt\d{7,10}$/.test(value) ? value : null;
function year(value) {
  const parsed = typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : value;
  return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 9999 ? String(parsed) : null;
}
function filmTitle(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\p{C}\u2028\u2029]/u.test(value)) return null;
  // Run identity is the only free-text exception. Withhold URI/credential-shaped
  // input instead of copying form values, source bodies or authorization data.
  if (/(?:[a-z][a-z\d+.-]*:\/\/|\bwww\.|\b(?:javascript|data|file):|https?%3a|%2f%2f)/i.test(value) ||
      /\b(?:bearer\s+\S+|(?:api[-_ ]?key|access[-_ ]?token|token|secret|password|authorization)\s*[=:]\s*\S+)/i.test(value) ||
      /\b(?:sk|tvly|sb_secret|sb_publishable)[-_][a-z\d_-]{6,}\b/i.test(value) ||
      /\beyJ[a-z\d_-]+\.[a-z\d_-]+\.[a-z\d_-]+\b/i.test(value) ||
      (value.match(/\b[a-z\d_+\/-]{32,}={0,2}\b/gi) ?? []).some(token => /[a-z]/.test(token) && /[A-Z]/.test(token) && /\d/.test(token))) return null;
  return value.replace(/\s+/gu, ' ').trim();
}
function reportFilm(result, filmContext) {
  const contextId = imdb(filmContext?.imdbId), filmId = imdb(result?.film?.imdbId), resultId = imdb(result?.imdbId);
  const suppliedContext = filmContext !== undefined && filmContext !== null;
  const unknown = { title: null, year: null, imdbId: null };
  if (filmId && resultId && filmId !== resultId || suppliedContext && (!contextId || [filmId, resultId].some(id => id && id !== contextId))) return unknown;
  const boundId = contextId ?? filmId ?? resultId;
  if (!boundId) return unknown;
  const boundFilm = filmId === boundId || !result?.film?.imdbId && resultId === boundId ? result?.film : null;
  return { title: filmTitle(boundFilm?.title) ?? filmTitle(contextId ? filmContext?.title : null),
    year: year(boundFilm?.year) ?? year(contextId ? filmContext?.year : null), imdbId: boundId };
}
// On-demand diagnostic view of already projected fields, not raw responses.
// URLs/IDs/unknown keys never enter it; the copied short report stays separate.
export function mediaSourceDetails(row) {
  const keys = new Set(['source','name','country','territory','code','access','reason','sourceBucket','conflictingPlatforms',
    'provenance','upstream','method','receivedAt','observationTime','audio','subtitles','ukrainianAudio','ukrainianSubtitles',
    'quality','price','amount','currency','kinobazaLocalization','conflicts','comparisons','comparisonsOmitted','extractionIssue',
    'observation','observations','state','value','note','language','region','closedCaptions','ukrainian','returnedLocales',
    'completeness','evidence','label','literal','formatLiteral','typeLiteral','provider','territoryBasis','binding','issues',
    'field','type','scope','outcome','service','addon']);
  const clean = (value, depth = 0) => {
    if (depth > 8) return '[bounded]';
    if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') return value === '' ? '' : filmTitle(value) ?? '[withheld]';
    if (Array.isArray(value)) return value.slice(0, 64).map(item => clean(item, depth + 1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => keys.has(key)).map(([key, v]) => [key, clean(v, depth + 1)]));
    return null;
  };
  return clean(row);
}
export function motnLanguageReport(f) {
  if (f?.state === 'not-reported') return 'not-reported (missing-or-null)';
  if (f?.state === 'invalid') return 'invalid-withheld';
  if (f?.state === 'reported' && f.ukrainian?.length > 0) return 'reported-uk (completeness unknown)';
  if (f?.state === 'not-listed-completeness-unknown' && Array.isArray(f.returnedLocales)) return f.returnedLocales.length ? 'uk-not-listed (completeness unknown)' : 'empty-list (completeness unknown)';
  return 'unknown';
}
const id = s => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : 'unknown';
export function safeMediaReport(result, { applied = false, filmContext, stale } = {}) {
  const rows = result?.rows ?? [];
  const references = variantReferences(rows);
  const film = reportFilm(result, filmContext);
  const rt = result?.runtime, attested = rt?.execution === 'netlify-function' && rt.buildProvenance === 'netlify-build-commit-ref-and-git-head' && /^[a-f0-9]{40}$/.test(rt.buildSha ?? '') && /^[a-f0-9]{24}$/.test(rt.deployId ?? '');
  const lines = ['MW-FUT-01 M4 — source claims, not entitlement.', attested ? `Commit: ${rt.buildSha} (server build stamp); deploy ${rt.deployId}.` : 'Commit: unknown (not runtime-attested).',
    `Execution: ${['netlify-function','local-diagnostic','unattested-runtime'].includes(rt?.execution) ? rt.execution : 'unknown'}; run ${id(rt?.runId)}.`,
    `Film: ${film.title === null ? 'unknown' : JSON.stringify(film.title)}; year ${film.year ?? 'unknown'}; IMDb ${film.imdbId ?? 'unknown'}.`,
    `Result freshness: ${stale === true ? 'stale (30-minute local age limit reached)' : stale === false ? 'within local 30-minute age limit; not a provider update guarantee' : 'unknown'}; no automatic source refresh.`,
    `Source HTTP attempts: ${count(result?.metrics?.requestsMade)}/${count(result?.metrics?.requestBudget)}. No automatic retry.`,
    `Durable ledger reservations: ${count(result?.metrics?.ledgerReservations)}; a lost reservation response does not authorize a retry.`,
    `Mapped source rows: ${count(rows.length)}; other-platform rows: ${count(result?.unmapped?.length)}.`];
  for (const source of ['tmdb','motn','kinobaza']) {
    const s = result?.sources?.find(s => s.source === source);
    lines.push(`${source}: identity ${identities.has(s?.identity) ? s.identity : 'unresolved'}; status ${sourceStatus(source, s?.status)}; source diagnostics below.`);
  }
  for (const stage of stages) lines.push(`${stage}: ${count(result?.metrics?.calls?.filter(c => c.stage === stage).length)} reserved.`);
  lines.push(`Kinobaza resolver: ${resolverStatuses.has(result?.resolver?.status) ? result.resolver.status : 'unknown'}.`);
  lines.push(`Kinobaza: search ${count(result?.resolver?.searchCalls)}; card GET ${count(result?.resolver?.cardCalls)}; unexamined ${count(result?.resolver?.unexamined)}.`);
  for (const [index, s] of (result?.resolver?.searches ?? []).slice(0,2).entries()) {
    const d = safeSearchDiagnostic(s.status, s);
    const provider = ['tavily','kinobaza-public-search'].includes(s.provider) ? s.provider : 'unknown';
    lines.push(`Search ${index + 1}: ${d.status}; ${d.outcome}; returned ${d.returned ?? 'unknown'}, admitted ${d.admitted ?? 'unknown'}, rejected ${d.rejected ?? 'unknown'}, duplicates ${d.duplicates ?? 'unknown'}; rejection categories ${JSON.stringify(d.rejectionCategories)}; provider ${provider}.`);
  }
  for (const card of result?.resolver?.cards?.slice(0,2) ?? []) {
    const d = safeIdentityDiagnostic(card.diagnostics);
    lines.push(`Card: ${identities.has(card.identity) ? card.identity : 'unresolved'}; reason ${knownReasons.has(card.reason) || card.reason === 'source-identity-structure-limit' ? card.reason : 'unknown'}; gate ${d.failedGate ?? 'none-or-unknown'}.`);
    if (card.reason === 'source-title-conflict') lines.push('Heading is not in known title aliases; not independent proof of a different film.');
    lines.push(`Identity structure ${JSON.stringify(d.counts)}; comparisons ${JSON.stringify(d.comparisons)}.`);
    const e = safeExtractionDiagnostic(card.extractionDiagnostic);
    const ref = typeof card.cardRef === 'string' && /^[a-f0-9]{64}$/.test(card.cardRef) ? card.cardRef : 'unknown';
    lines.push(`Extraction: ${e.status}; candidates ${e.candidateCount ?? 'unknown'}, foreign-context ${e.foreignCandidateCount ?? 'unknown'}, localization blocks ${e.blockCount ?? 'unknown'}, film audio ${e.filmAudioState}; issues ${JSON.stringify(e.issues)}; requested-card SHA256 ${ref}.`);
  }
  const kinoRows = Array.isArray(result?.rows) ? rows.filter(r=>r.id?.startsWith('kinobaza:') || r.id?.includes(':kinobaza:')).length : undefined;
  const kinoOther = Array.isArray(result?.unmapped) ? result.unmapped.filter(r=>r.source==='kinobaza').length : undefined;
  lines.push(`Kinobaza projection: mapped ${count(kinoRows)}; other platforms ${count(kinoOther)}; foreign-context candidates are not UA offers.`);
  lines.push(`Film-level UA audio badge: ${loc(result?.filmLocalization?.ukrainianAudio?.state)}; not provider tracks.`);
  for (const info of presentMediaGroups(rows, { filmId: result?.film?.id }).filter(info => info.kinobaza.applied)) {
    lines.push(`M4 Kinobaza interpretation/${platforms.has(info.group.key) ? info.group.key : 'unknown'}: UA by application rule matched-provider-block-app-ua-interpretation; audio ${loc(info.kinobaza.audio)}, subtitles ${loc(info.kinobaza.subtitles)}; not independently verified availability or offer binding.`);
  }
  for (const r of rows.slice(0, 24)) {
    const source = rowSource(r);
    const platform = platforms.has(r.provider?.key) ? r.provider.key : 'unmapped';
    const b = r.kinobazaLocalization;
    const language = source === 'motn' ? `MOTN audio ${motnLanguageReport(r.audio)}, subtitles ${motnLanguageReport(r.subtitles)}` : source === 'kinobaza' ? `Kinobaza provider-block audio ${loc(b?.audio?.state)}, subtitles ${loc(b?.subtitles?.state)}` : 'provider tracks not established by TMDb availability';
    lines.push(`${source}/${platform}: ${r.country === 'UA' ? 'UA source context' : 'territory unknown'}; ${language}; offer binding unverified.`);
    lines.push(rowDiagnostics(r, references.get(r), source));
    if (source === 'kinobaza' && b) for (const key of ['audio', 'subtitles']) {
      const field = b[key], evidence = Array.isArray(field?.evidence) ? field.evidence : [];
      const literals = evidence.slice(0, 8).map(e => {
        const label = typeof e?.label === 'string' && /^(?:Укр\. (?:звук|субтитри)(?: \([^()\r\n]{1,80}\))?|укр\. (?:аудіо|субтитри))$/u.test(e.label) ? filmTitle(e.label) : null;
        const literal = ['', '+', '-', '−', '?', 'укр. аудіо', 'укр. субтитри'].includes(e?.literal) ? e.literal : 'unknown';
        return { label: label ?? 'withheld', literal, state: ['positive','negative','unknown'].includes(e?.state) ? e.state : 'unknown' };
      });
      lines.push(`Kinobaza ${references.get(r) ?? 'unknown'} ${key} source values: ${loc(field?.state)}; evidence ${JSON.stringify(literals)}; omitted ${count(Math.max(0, evidence.length - literals.length))}.`);
    }
  }
  lines.push(applied ? 'Local form transfer performed; not saved by this feature.' : 'No attested transfer/save in this report.');
  return lines.join('\n');
}
