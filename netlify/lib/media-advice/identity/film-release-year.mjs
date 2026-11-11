// Only contextual events from the validated server Details projection. A late
// reissue, streaming/physical release, or an arbitrary nearby year is not proof.
export function initialReleaseEvidence(film) {
  const context = film?.identityContext;
  if (!Number.isSafeInteger(film?.tmdbId) || film.tmdbId < 1 || context?.tmdbId !== film.tmdbId ||
      !Array.isArray(context.releaseEvidence) || context.releaseEvidence.length > 240) return [];
  const events = context.releaseEvidence.filter(e => e && [1,2,3].includes(e.type) &&
    /^[A-Z]{2}$/.test(e.country ?? '') && Number.isInteger(e.year) && e.year >= 1000 &&
    e.year <= film.year && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(e.date) &&
    Number(e.date.slice(0,4)) === e.year && Number.isFinite(Date.parse(e.date)));
  const firstYear = Math.min(...events.map(e => e.year));
  return events.filter(e => e.year === firstYear);
}
export function releaseYearEvidence(film, sourceYear) {
  return initialReleaseEvidence(film).filter(e => e.year === sourceYear);
}
