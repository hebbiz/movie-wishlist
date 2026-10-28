// Reviewed person-level identity evidence only. No film keys, browser loading,
// network calls or runtime registration. Reviewed person profiles, not film
// title/year/slug similarity, establish each literal cross-source alias.
export const CONFIRMED_DIRECTOR_ALIASES = Object.freeze([Object.freeze({
  namespace: 'tmdb:person', personId: 137427, aliases: Object.freeze(['Денні Вільньов']),
  scope: 'kinobaza-director-identity',
  evidence: Object.freeze({
    source: 'Reviewed person profiles: exact English name Denis Villeneuve, full birth date 1967-10-03 and director role. Birthplace values differ; no shared external person ID observed.',
    reference: 'https://api.themoviedb.org/3/movie/335984/credits?language=uk-UA | https://api.themoviedb.org/3/person/137427?language=uk-UA&append_to_response=external_ids | https://kinobazaua.com/persons/denis-villeneuve',
    verifiedAt: '2026-10-23',
  }),
}), Object.freeze({
  namespace: 'tmdb:person', personId: 50767, aliases: Object.freeze(['Крейґ Ґіллеспі']),
  scope: 'kinobaza-director-identity',
  evidence: Object.freeze({
    source: 'Reviewed canonical person header: exact English name Craig Gillespie, full birth date 1967-09-01 and director role; trusted TMDb credits person50767 and matching person details. No shared external person ID observed on Kinobaza.',
    reference: 'https://api.themoviedb.org/3/movie/1081003?language=uk-UA&append_to_response=external_ids,alternative_titles,credits,release_dates,translations | https://api.themoviedb.org/3/person/50767?language=uk-UA&append_to_response=external_ids | https://kinobazaua.com/persons/craig-gillespie',
    verifiedAt: '2026-10-28',
  }),
})]);
const namespace = 'tmdb:person';
const scope = 'kinobaza-director-identity';
const validId = id => Number.isSafeInteger(id) && id > 0;
const text = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 500 && !/[\p{C}]/u.test(s);
// Exactly the existing identity normalization; never transliteration/fuzzy repair.
const normalize = s => s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA');
const value = f => f?.state === 'reported' ? f.value : null;

// Input is the already validated, server-received TMDb credits projection, not
// browser film JSON. Preserve person/name association even for multiple people;
// this module does not make a multi-director matching decision.
export function projectDirectorPeople(directors) {
  if (directors?.state !== 'reported' || !Array.isArray(directors.items)) return [];
  return directors.items.map(d => ({ namespace, personId: validId(value(d?.id)) ? value(d.id) : null,
    names: [...new Set([value(d?.name), value(d?.originalName)].filter(text))] }));
}

// Authored tests can build a separate lookup; production uses only the frozen
// reviewed registry below. Provenance is mandatory but not a legal/identity
// proof by itself: each real entry still requires independent evidence review.
export function createDirectorAliasLookup(records) {
  if (!Array.isArray(records) || records.length > 128) throw Error('invalid-director-crosswalk');
  const people = new Map(), ambiguous = new Set(), owners = new Map();
  for (const record of records) {
    const evidence = record?.evidence;
    if (record?.namespace !== namespace || !validId(record.personId) || record.scope !== scope ||
        !Array.isArray(record.aliases) || !record.aliases.length || record.aliases.length > 32 || !record.aliases.every(text) ||
        !text(evidence?.source) || !text(evidence?.reference) || !/^\d{4}-\d{2}-\d{2}$/.test(evidence?.verifiedAt ?? '') ||
        !Number.isFinite(Date.parse(evidence.verifiedAt)) || new Date(evidence.verifiedAt).toISOString().slice(0,10) !== evidence.verifiedAt) throw Error('invalid-director-crosswalk');
    const key = `${namespace}:${record.personId}`;
    if (people.has(key)) ambiguous.add(key); // Never choose a convenient duplicate.
    const aliases = [...new Map(record.aliases.map(name => [normalize(name), name])).values()];
    const provenance = Object.freeze({ namespace, personId: record.personId, scope,
      evidence: Object.freeze({ source: evidence.source, reference: evidence.reference, verifiedAt: evidence.verifiedAt }) });
    people.set(key, Object.freeze({ status: 'confirmed', aliases: Object.freeze(aliases), provenance }));
    for (const name of aliases) {
      const normal = normalize(name); if (!owners.has(normal)) owners.set(normal, new Set());
      owners.get(normal).add(key);
    }
  }
  // Shared spelling does not disambiguate different people. Conservatively
  // withhold those crosswalk records; ordinary source-provided aliases are intact.
  for (const ids of owners.values()) if (ids.size > 1) for (const key of ids) ambiguous.add(key);
  const absent = Object.freeze({ status: 'not-established', aliases: Object.freeze([]) });
  const conflict = Object.freeze({ status: 'ambiguous', aliases: Object.freeze([]) });
  return person => {
    if (person?.namespace !== namespace || !validId(person.personId)) return absent;
    const key = `${namespace}:${person.personId}`;
    return ambiguous.has(key) ? conflict : people.get(key) ?? absent;
  };
}
export const lookupDirectorAliases = createDirectorAliasLookup(CONFIRMED_DIRECTOR_ALIASES);
