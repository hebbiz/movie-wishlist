// Browser-safe content-free projection. A reason prefix is not an allowlist:
// only exact application-owned labels can cross into copied diagnostics.
const statuses = new Set(['not-requested', 'ok', 'confirmed', 'unresolved']);
const reasons = new Set([
  'not-requested', 'trusted-person-projection-invalid', 'tmdb-person-response-invalid', 'tmdb-person-id-conflict', 'tmdb-person-external-ids-invalid',
  'tmdb-person-names-invalid', 'tmdb-person-birthday-invalid', 'tmdb-person-imdb-conflict-or-invalid', 'trusted-tmdb-person-projection',
  'profile-url-rejected', 'source-director-alias-invalid', 'profile-html-size-limit', 'profile-parser-unavailable',
  'profile-canonical-conflict-or-ambiguous', 'profile-heading-ambiguous', 'profile-header-scope-unestablished', 'profile-name-scope-unestablished',
  'profile-facts-ambiguous', 'profile-source-alias-conflict', 'profile-latin-name-unestablished', 'profile-birthday-invalid',
  'profile-director-role-unestablished', 'profile-html-error-limit', 'profile-html-parse-errors', 'profile-semantic-limit', 'profile-semantic-invalid',
  'profile-semantic-ownership-conflict', 'profile-semantic-name-conflict', 'profile-person-id-shape-invalid', 'profile-birthday-conflict',
  'profile-semantic-ambiguous', 'profile-person-id-conflict', 'scoped-profile-evidence', 'profile-parser-or-structure-limit', 'profile-not-established',
  'tmdb-person-not-established', 'director-person-id-conflict', 'director-person-birthday-conflict', 'director-profile-scope-unestablished',
  'director-person-evidence-insufficient', 'confirmed-shared-person-id', 'confirmed-person-profile-facts',
  'director-reservation-unavailable', 'director-tmdb-redirect-not-followed', 'director-tmdb-api-auth-error', 'director-tmdb-api-access-denied',
  'director-tmdb-title-not-returned', 'director-tmdb-quota-or-rate-limit', 'director-tmdb-api-http-error', 'director-tmdb-invalid-content-type',
  'director-tmdb-response-too-large', 'director-tmdb-invalid-response', 'director-tmdb-unsafe-response-withheld', 'director-tmdb-timeout-no-retry',
  'director-tmdb-invalid-or-network-response-no-retry', 'director-deadline-bounded', 'director-profile-redirect-refused', 'director-profile-auth-error',
  'director-profile-access-denied', 'director-profile-not-returned', 'director-profile-quota-or-rate-limit', 'director-profile-http-error',
  'director-profile-invalid-content', 'director-profile-response-too-large', 'director-profile-challenge-refused', 'director-profile-timeout-no-retry',
  'director-profile-network-or-decoding-error', 'director-unsafe-source-content-withheld', 'director-profile-not-enabled-for-budget',
  'director-profile-trusted-single-person-required', 'director-profile-missing-tmdb-credential', 'director-profile-ledger-required',
  'director-profile-pointer-rejected', 'director-profile-pair-unavailable', 'director-profile-verification-error', 'director-profile-candidates-ambiguous',
]);
const bases = new Set(['shared-person-id', 'exact-name-birthdate-role']);
const stageNames = new Set(['tmdb-person', 'kinobaza-person']);
const attemptStates = new Set(['reservation-pending', 'reservation-outcome-unknown', 'reservation-denied', 'reserved-deadline-no-dispatch',
  'attempt-reserved', 'dispatched', 'response-received', 'transport-outcome-unknown']);
const accounting = new Set(['no-extra-attempts', 'reservation-may-have-committed-no-retry', 'reserved-attempts-spent-no-retry']);
const counts = ['sourceAttempts', 'reservationRequests', 'reservationsAcknowledged', 'tmdbPersonCalls', 'kinobazaPersonCalls'];
const comparisons = ['stableIdConflict', 'stableIdMatch', 'birthdayConflict', 'birthdayMatch', 'latinNameMatch', 'nativeAliasMatch'];
const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 2 ? n : null;
const cardCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 3 ? n : null;
const selectionBases = new Set(['scoped-film-id', 'selected-year', 'contextual-release-year', 'ambiguous-top-profiles', 'no-eligible-card']);

export function safeDirectorProfileDiagnostic(d) {
  return { status: statuses.has(d?.status) ? d.status : 'unknown', reason: reasons.has(d?.reason) ? d.reason : 'unknown',
    basis: bases.has(d?.basis) ? d.basis : null,
    ...(d?.selection ? {selection: {
      eligibleCards: cardCount(d.selection.eligibleCards), unverifiedCards: cardCount(d.selection.unverifiedCards),
      selectedCards: Array.isArray(d.selection.selectedCards) ? [...new Set(d.selection.selectedCards.filter(n => n === 1 || n === 2 || n === 3))].slice(0,3) : [],
      basis: selectionBases.has(d.selection.basis) ? d.selection.basis : 'unknown',
    }} : {}),
    ...Object.fromEntries(counts.map(key => [key, count(d?.[key])])),
    attempts: (Array.isArray(d?.attempts) ? d.attempts : []).slice(0, 2).map(a => ({
      stage: stageNames.has(a?.stage) ? a.stage : 'unknown', status: attemptStates.has(a?.status) ? a.status : 'unknown',
      httpStatus: Number.isInteger(a?.httpStatus) && a.httpStatus >= 100 && a.httpStatus <= 599 ? a.httpStatus : null,
    })),
    accounting: accounting.has(d?.accounting) ? d.accounting : 'unknown',
    comparisons: Object.fromEntries(comparisons.map(key => [key, typeof d?.comparisons?.[key] === 'boolean' ? d.comparisons[key] : null])),
  };
}
