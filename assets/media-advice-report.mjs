import { safeSearchDiagnostic, safeIdentityDiagnostic, safeExtractionDiagnostic, resolverStatuses } from '../shared/media-advice-diagnostics.mjs';
const identities = new Set(['matched', 'mismatch', 'unresolved']);
const stages = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title', 'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2'];
const knownReasons = new Set(['source-canonical-conflict','source-stable-id-conflict','source-canonical-ambiguous','malformed-source-stable-id','source-identity-structure-incomplete','source-original-title-unestablished','source-original-title-scope-unestablished','source-title-conflict','source-title-year-missing','selected-year-missing','source-year-conflict-without-stable-crosswalk','source-or-selected-director-missing','director-scope-unestablished','director-alias-unestablished','explicit-stable-and-structural-match','explicit-title-year-director-match']);
const count = n => Number.isSafeInteger(n) && n >= 0 && n < 10000 ? n : 'unknown';
const loc = s => ['reported-positive','reported-negative','conflicting'].includes(s) ? s : 'unknown';
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
    lines.push(`${source}: identity ${identities.has(s?.identity) ? s.identity : 'unresolved'}; status ${sourceStatus(source, s?.status)}; source outcomes/details remain on page.`);
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
  for (const r of rows.slice(0, 24)) {
    const source = ['tmdb','motn','kinobaza'].find(s => r.id?.startsWith(s + ':') || r.id?.includes(':' + s + ':')) ?? 'unknown';
    const platform = ['apple','prime','netflix','hbo','rakuten','megogo'].includes(r.provider?.key) ? r.provider.key : 'unmapped';
    const b = r.kinobazaLocalization;
    const language = source === 'motn' ? `MOTN audio ${motnLanguageReport(r.audio)}, subtitles ${motnLanguageReport(r.subtitles)}` : source === 'kinobaza' ? `Kinobaza provider-block audio ${loc(b?.audio?.state)}, subtitles ${loc(b?.subtitles?.state)}` : 'provider tracks not established by TMDb availability';
    lines.push(`${source}/${platform}: ${r.country === 'UA' ? 'UA source context' : 'territory unknown'}; ${language}; offer binding unverified.`);
  }
  lines.push(applied ? 'Local form transfer performed; not saved by this feature.' : 'No attested transfer/save in this report.');
  return lines.join('\n');
}
