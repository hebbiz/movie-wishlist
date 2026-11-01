// Allocate one profile pair only after the bounded card reads. These already
// checked film facts order work; they never prove director identity or bypass
// any film/profile gate. Search position, snippet and slug are not evidence.
const normalize = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA');
const key = candidate => `${candidate.pointer.sourceURL}\u0000${normalize(candidate.pointer.sourceAlias)}`;
const strength = candidate => {
  const identity = candidate.identity, d = identity?.diagnostics;
  if (identity?.status !== 'unresolved' || identity.reason !== 'director-alias-unestablished' ||
      d?.comparisons?.stableIdConflict !== false || d.comparisons.canonicalMatch !== true ||
      d.comparisons.headingAliasMatch !== true || d.comparisons.originalAliasMatch !== true ||
      d.gates?.['year-crosswalk'] !== 'pass') return 0;
  return d.comparisons.stableIdMatch === true ? 3 : d.comparisons.yearEqual === true ? 2 : 1;
};
const bases = { 3: 'scoped-film-id', 2: 'selected-year', 1: 'contextual-release-year' };

export function selectDirectorCandidates(candidates) {
  const eligible = candidates.filter(candidate => strength(candidate) > 0);
  const best = Math.max(0, ...eligible.map(strength));
  const top = eligible.filter(candidate => strength(candidate) === best);
  const keys = new Set(top.map(key));
  // Equally supported different people cannot be ranked by convenience. A
  // second profile needs another reserved GET, which this pair cannot supply.
  const ambiguous = keys.size > 1;
  const selected = !ambiguous && top.length ? [top[0], ...eligible.filter(candidate => candidate !== top[0] && key(candidate) === key(top[0]))] : [];
  return { selected, diagnostic: {
    eligibleCards: eligible.length,
    selectedCards: selected.map(candidate => candidate.index + 1),
    unverifiedCards: eligible.length - selected.length,
    basis: ambiguous ? 'ambiguous-top-profiles' : bases[best] ?? 'no-eligible-card',
  }, ambiguous };
}
