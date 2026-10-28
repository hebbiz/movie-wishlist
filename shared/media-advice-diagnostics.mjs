// Content-free allowlists shared by the resolver and the copied report.
export const searchStatuses = new Set(['ok', 'missing-or-invalid-search-key', 'search-timeout-no-retry', 'search-redirect-refused', 'search-auth-error', 'search-access-denied', 'search-rate-limit', 'search-quota-error', 'search-http-error', 'search-invalid-response', 'search-response-too-large', 'unsafe-source-content-withheld', 'search-transport-or-json-error']);
export const resolverStatuses = new Set([...searchStatuses, 'partial', 'unresolved', 'not-evaluated-missing-search-key', 'not-evaluated-no-established-title', 'resolver-deadline-bounded', 'no-admitted-search-candidates', 'multiple-confirmed-cards-choose', 'one-confirmed-bounded-not-exhaustive', 'bounded-unresolved', 'no-confirmed-card', 'unsupported-markup']);
export const rejectionCategories = ['non-string', 'invalid-url', 'unsafe-scheme', 'credentials', 'port', 'foreign-host', 'query', 'fragment', 'unsupported-path', 'unsupported-spelling'];
export const identityGates = ['structure-limit', 'canonical-conflict', 'stable-id-conflict', 'stable-id-shape', 'canonical-count', 'metadata-structure', 'heading-format', 'heading-alias', 'original-scope', 'original-alias', 'selected-year', 'year-crosswalk', 'director-presence', 'director-scope', 'director-alias'];
export const identityCounts = ['headingCount', 'originalTitleCount', 'directorCount', 'canonicalCount', 'stableIdCount'];
export const identityFlags = ['canonicalMatch', 'stableIdMatch', 'stableIdConflict', 'headingAliasMatch', 'originalAliasMatch', 'yearEqual', 'directorAliasMatch'];
export const safeCount = n => Number.isSafeInteger(n) && n >= 0 && n < 10000 ? n : null;
const extractionStatuses = new Set(['ok','partial','unresolved','unsupported-markup','parser-unavailable','identity-mismatch','identity-unresolved','redirect-not-followed','access-blocked-no-retry','http-error-no-retry','unsupported-content-type','response-too-large','empty-response','challenge-unsupported-no-retry','timeout-or-cancelled-no-retry','network-or-decoding-error-no-retry']);
const extractionIssues = new Set(['html-size-limit','html-parse-errors','missing-or-duplicate-availabilityAccordion','unsupported-accordion-items','ambiguous-territory-heading','ambiguous-territory-control','unsupported-or-conflicting-territory','ambiguous-territory-panel','missing-explicit-ukraine-section','candidate-count-limit','unresolved-parser-or-structure','conflicting-provider-label','missing-href','unsafe-url-or-label','not-an-absolute-provider-url','unsafe-url-scheme','unsafe-or-invalid-url','provider-block-count-limit','ambiguous-provider-block','unsupported-provider-block','block-field-count-limit','conflicting-block-labels','possible-block-conflict-scope-unestablished']);
export function safeExtractionDiagnostic(d) {
  return { status: extractionStatuses.has(d?.status) ? d.status : 'unknown',
    issues: [...new Set((Array.isArray(d?.issues) ? d.issues : []).filter(s=>extractionIssues.has(s)))].slice(0,32),
    candidateCount: safeCount(d?.candidateCount), foreignCandidateCount: safeCount(d?.foreignCandidateCount),
    blockCount: safeCount(d?.blockCount),
    filmAudioState: ['reported-positive','reported-negative','conflicting'].includes(d?.filmAudioState) ? d.filmAudioState : 'unknown' };
}
export function safeSearchDiagnostic(status, d) {
  const known = searchStatuses.has(status) ? status : 'unknown';
  const counts = Object.fromEntries(['returned', 'admitted', 'rejected', 'duplicates'].map(k => [k, safeCount(d?.[k])]));
  const consistent = Object.values(counts).every(n => n !== null) && counts.returned === counts.admitted + counts.rejected + counts.duplicates;
  return { status: known, outcome: known !== 'ok' ? 'provider-error' : consistent ? counts.returned === 0 ? 'empty-response' : counts.admitted === 0 ? 'all-rejected' : 'candidates-admitted' : 'unknown',
    ...Object.fromEntries(Object.entries(counts).map(([k,v]) => [k, consistent ? v : null])),
    rejectionCategories: Object.fromEntries(rejectionCategories.filter(k => safeCount(d?.rejectionCategories?.[k]) > 0).map(k => [k, d.rejectionCategories[k]])) };
}
export function safeIdentityDiagnostic(d) {
  return { failedGate: identityGates.includes(d?.failedGate) ? d.failedGate : null,
    counts: Object.fromEntries(identityCounts.map(k => [k, safeCount(d?.counts?.[k])])),
    comparisons: Object.fromEntries(identityFlags.map(k => [k, typeof d?.comparisons?.[k] === 'boolean' ? d.comparisons[k] : null])),
    gates: Object.fromEntries(identityGates.map(k => [k, ['pass','fail','unresolved','not-evaluated'].includes(d?.gates?.[k]) ? d.gates[k] : 'not-evaluated'])) };
}
