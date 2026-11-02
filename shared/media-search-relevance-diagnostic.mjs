// A bounded, privileged observation, never a search/identity gate or body archive.
const identities = new Set(['matched', 'mismatch', 'unresolved']);
const reasons = new Set(['source-canonical-conflict','source-stable-id-conflict','source-canonical-ambiguous',
  'malformed-source-stable-id','source-identity-structure-limit','source-identity-structure-incomplete',
  'source-original-title-unestablished','source-original-title-scope-unestablished','source-title-conflict',
  'source-title-year-missing','selected-year-missing','source-year-conflict-without-stable-crosswalk',
  'source-year-conflict-terminal-roman-title','source-year-conflict-ukrainian-g-title',
  'source-or-selected-director-missing','director-scope-unestablished','director-alias-unestablished']);
function secretLike(value, secrets) {
  let decoded = value;
  for (let i = 0; i < 4; i++) {
    if (secrets.some(s => typeof s === 'string' && s && decoded.includes(s))) return true;
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
  }
  return /(?:\bbearer\s+\S+|\b(?:api[-_ ]?key|access[-_ ]?token|token|secret|password|authorization|credential)\s*[=:]\s*\S+|\b(?:sk|tvly|sb_secret|sb_publishable)[-_][a-z\d_-]{6,}|\beyJ[a-z\d_-]+\.[a-z\d_-]+\.[a-z\d_-]+\b)/i.test(decoded) ||
    (decoded.match(/\b[a-z\d_+\/-]{32,}={0,2}\b/gi) ?? []).some(token => /[a-z]/.test(token) && /[A-Z]/.test(token) && /\d/.test(token));
}
function safeText(value, maximum, secrets) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\p{C}<>\u2028\u2029]/u.test(value) ||
      /(?:[a-z][a-z\d+.-]*:\/\/|\bwww\.|\b(?:javascript|data|file):|https?%3a|%2f%2f)/i.test(value) || secretLike(value, secrets)) return null;
  return value; // Keep the actual query/heading spelling, not a rewritten equivalent.
}
export function safeSearchCorrelation(value, { secrets = [] } = {}) {
  const requestId = value?.requestId;
  return { query: safeText(value?.query, 600, secrets),
    requestId: typeof requestId === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId) && !secretLike(requestId, secrets) ? requestId : null,
    responseQuery: safeText(value?.responseQuery, 600, secrets) };
}
export function safeSearchCardURL(value, { secrets = [] } = {}) {
  return typeof value === 'string' && value.length <= 512 &&
    /^https:\/\/kinobazaua\.com\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !secretLike(value, secrets) && !/(?:^|[-/])(?:token|password|credential|api-key|secret)-[a-z\d]{16,}/i.test(value) ? value : null;
}
export function safePossibleIrrelevantSearch(value, { secrets = [] } = {}) {
  if (!value || !Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > 2 ||
      value.cards.some(card => card?.identity === 'matched')) return null;
  const cards = value.cards.map(card => {
    const title = safeText(card?.title, 500, secrets), originalTitle = safeText(card?.originalTitle, 500, secrets);
    return { title, originalTitle, url: safeSearchCardURL(card?.url, { secrets }),
      identity: identities.has(card?.identity) ? card.identity : 'unresolved',
      reason: reasons.has(card?.reason) ? card.reason : null,
      titleMismatch: card?.titleMismatch === true && title !== null && originalTitle !== null && card?.reason === 'source-title-conflict' ? true :
        card?.titleMismatch === false ? false : null };
  });
  if (!cards.some(card => card.titleMismatch === true)) return null;
  const film = value.film;
  return { film: { title: safeText(film?.title, 500, secrets),
      year: Number.isInteger(film?.year) && film.year >= 1000 && film.year <= 9999 ? film.year : null,
      imdbId: typeof film?.imdbId === 'string' && /^tt\d{7,10}$/.test(film.imdbId) ? film.imdbId : null },
    searches: (Array.isArray(value.searches) ? value.searches : []).slice(0, 2).map(search => safeSearchCorrelation(search, { secrets })), cards };
}
export function possibleIrrelevantSearch({ film, searches, cards, observations }, { secrets = [] } = {}) {
  if (!Array.isArray(cards) || !cards.length || cards.some(card => card?.result?.identity?.status === 'matched')) return null;
  return safePossibleIrrelevantSearch({ film: { title: film?.identityTitle ?? film?.originalTitle, year: film?.year, imdbId: film?.imdbId }, searches,
    cards: cards.map(({ result, url }) => {
      const observed = observations?.get(url), d = result?.identity?.diagnostics;
      const heading = observed?.truncated === false && observed.sourceIdentity?.h1?.length === 1 && d?.counts?.headingCount === 1 ? observed.sourceIdentity.h1[0] : null;
      const original = observed?.truncated === false && observed.sourceIdentity?.h2?.length === 1 && d?.counts?.originalTitleCount === 1 ? observed.sourceIdentity.h2[0] : null;
      const unique = heading !== null && original !== null;
      const titleMismatch = unique && result.identity?.reason === 'source-title-conflict' && d?.gates?.['heading-alias'] === 'fail' &&
        d?.comparisons?.headingAliasMatch === false && d?.comparisons?.originalAliasMatch === false;
      return { title: heading, originalTitle: original,
        url, identity: result?.identity?.status, reason: result?.identity?.reason, titleMismatch: titleMismatch ? true :
          d?.comparisons?.headingAliasMatch === true || d?.comparisons?.originalAliasMatch === true ? false : null };
    }) }, { secrets });
}
