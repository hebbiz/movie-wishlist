// Authored fixtures only: not archived source HTML or verified availability.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { movieSameAsEvidence, parseMovieSameAsID, parseBoundedMovieJSON } from '../shared/kinobaza-movie-identity.mjs';
import { assistedIdentity, fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { CARD, markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { safeIdentityDiagnostic } from '../shared/media-advice-diagnostics.mjs';

const film = { identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  imdbId: 'tt999900001', tmdbId: 999900001, directorCount: 1, directorAliases: ['Authored director'],
  directorPeople: [{ namespace: 'tmdb:person', personId: 999900001, names: ['Authored director'] }] };
const movie = (extra = {}) => ({ '@context': 'https://schema.org', '@type': 'Movie', '@id': CARD + '#movie', url: CARD,
  name: film.identityTitle, sameAs: ['https://www.imdb.com/title/' + film.imdbId + '/', 'https://www.themoviedb.org/movie/' + film.tmdbId], ...extra });
const script = data => `<script type="application/ld+json">${typeof data === 'string' ? data : JSON.stringify(data)}</script>`;
const source = (data = movie(), options = {}) => markup({ director: 'Unknown authored spelling', ...options }).replace('</head>', script(data) + (options.extraScripts ?? '') + '</head>');
const nodes = html => {
  const all = [], stack = [parse(html, { sourceCodeLocationInfo: true })];
  while (stack.length) { const node = stack.pop(); all.push(node); if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(node.tagName)) stack.push(...node.childNodes ?? []); }
  return all;
};
const noCrosswalk = () => ({ status: 'unresolved' });
const inspect = (data, options, selected = film) => assistedIdentity(nodes(source(data, options)), selected, CARD, { directorAliasLookup: noCrosswalk });

for (const [description, data] of [
  ['root Movie', movie()], ['root array', [movie()]],
  ['immediate graph', { '@context': 'https://schema.org', '@graph': [movie({ '@context': undefined })] }],
  ['typed url reference', movie({ url: { '@id': CARD } })],
]) test(`owned ${description} provides typed same-system IDs and exact title/year bypass`, () => {
  const result = inspect(data);
  assert.equal(result.status, 'matched'); assert.equal(result.reason, 'explicit-stable-title-year-match');
  assert.equal(result.diagnostics.strategy, 'stable-id-title-year'); assert.equal(result.diagnostics.comparisons.stableIdMatch, true);
  assert.equal(result.observed.stableIdCount, 2); assert.equal(result.diagnostics.gates['director-alias'], 'not-evaluated');
  const evidence = movieSameAsEvidence(nodes(source(data)), CARD);
  assert.equal(evidence.status, 'available');
  assert.deepEqual(evidence.records.map(record => record.provenance), ['jsonld-owned-movie-sameas', 'jsonld-owned-movie-sameas']);
});

for (const [description, data] of [
  ['missing ID', movie({ sameAs: undefined })], ['Wikipedia only', movie({ sameAs: 'https://uk.wikipedia.org/wiki/Authored' })],
  ['Person', movie({ '@type': 'Person' })], ['another Movie URL', movie({ url: CARD + '-other' })],
  ['nested recommendation', { '@context': 'https://schema.org', '@type': 'WebPage', recommendation: movie() }],
  ['nested director Movie', { '@context': 'https://schema.org', '@type': 'Person', subjectOf: movie() }],
  ['nested graph', { '@context': 'https://schema.org', '@graph': [{ '@graph': [movie()] }] }],
]) test(`${description} cannot donate IDs; old title/year/director route is preserved`, () => {
  assert.equal(inspect(data).reason, 'director-alias-unestablished');
  const baseline = inspect(data, { director: 'Authored director' });
  assert.equal(baseline.status, 'matched'); assert.equal(baseline.reason, 'explicit-title-year-director-match');
});

for (const tag of ['nav', 'aside', 'footer', 'template', 'noscript', 'iframe']) test(`${tag} JSON-LD cannot prove or conflict with the primary film`, () => {
  const html = markup({ director: 'Unknown authored spelling' }).replace('</body>', `<${tag}>${script(movie())}</${tag}></body>`);
  const result = assistedIdentity(nodes(html), film, CARD, { directorAliasLookup: noCrosswalk });
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-alias-unestablished');
});

for (const [description, data] of [
  ['two agreeing owned Movies', [movie(), movie()]],
  ['two conflicting owned Movies', { '@context': 'https://schema.org', '@graph': [movie(), movie({ sameAs: ['https://www.imdb.com/title/tt999900002/'] })] }],
  ['unsupported context', movie({ '@context': { '@vocab': 'https://attacker.invalid/' } })],
  ['conflicting own @id', movie({ '@id': CARD + '-other#movie' })],
  ['mixed Person/Movie type', movie({ '@type': ['Movie', 'Person'] })],
  ['name disagreement with source', movie({ name: 'Other Movie' })],
]) test(`${description} is critical ambiguity, not a convenient stable-ID match`, () => {
  const result = inspect(data, { director: 'Authored director' });
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'source-identity-structure-incomplete');
  assert.equal(result.diagnostics.movieSameAs.status, 'ambiguous');
});

for (const sameAs of [
  ['https://www.imdb.com/title/tt999900002/'],
  ['https://www.imdb.com/title/tt999900001/', 'https://www.themoviedb.org/movie/999900002'],
  ['https://www.imdb.com/title/tt999900001/', 'https://www.imdb.com/title/tt999900002/'],
]) test(`owned ID conflict ${sameAs.join(', ')} cannot be bypassed by exact title/year/director`, () => {
  const result = inspect(movie({ sameAs }), { director: 'Authored director' });
  assert.equal(result.status, 'mismatch'); assert.equal(result.reason, 'source-stable-id-conflict');
  assert.equal(result.diagnostics.comparisons.stableIdConflict, true);
});

test('labelled and semantic IDs share conflict precedence without cross-namespace numeric comparison', () => {
  const label = '<tr><td>IMDb:</td><td>tt999900002</td></tr>';
  assert.equal(inspect(movie(), { stable: label }).reason, 'source-stable-id-conflict');
  const selected = { ...film, tmdbId: 999900002 };
  assert.equal(inspect(movie(), {}, selected).reason, 'source-stable-id-conflict');
  const none = { ...film, tmdbId: null };
  assert.equal(inspect(movie({ sameAs: ['https://www.themoviedb.org/movie/999900001'] }), {}, none).reason, 'director-alias-unestablished');
});

for (const bad of [
  'https://www.imdb.com/name/nm999900001/', 'http://www.imdb.com/title/tt999900001/',
  'https://www.themoviedb.org/person/999900001', 'https://www.themoviedb.org/movie/0',
  'https://www.imdb.com/title/tt999900001/?private=DO_NOT_PUBLISH',
  'https://www.imdb.com:443/title/tt999900001/', 'https://www.imdb.com/title/%74t999900001/',
]) test(`owned malformed known-ID URL is withheld: ${bad.split('?')[0]}`, () => {
  assert.equal(parseMovieSameAsID(bad), null);
  const result = inspect(movie({ sameAs: [bad] }), { director: 'Authored director' });
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'malformed-source-stable-id');
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PUBLISH|sameAs":\[/);
});

for (const sameAs of [{ '@id': 'https://www.imdb.com/title/tt999900001/' }, ['', ...Array(32).fill('https://example.invalid/')]]) test('sameAs ambiguous shape does not authorize a film', () => {
  const result = inspect(movie({ sameAs }), { director: 'Authored director' });
  assert.equal(result.reason, 'malformed-source-stable-id'); assert.notEqual(result.status, 'matched');
});

test('arbitrary broken optional JSON preserves old success but disables all positive sameAs proof', () => {
  const extraScripts = script('{"@type":"Organization",invalid');
  const unknown = inspect(movie(), { extraScripts });
  assert.equal(unknown.reason, 'director-alias-unestablished');
  assert.equal(unknown.diagnostics.comparisons.stableIdMatch, false);
  assert.equal(inspect(movie(), { extraScripts, director: 'Authored director' }).reason, 'explicit-title-year-director-match');
  const conflict = inspect(movie({ sameAs: ['https://www.imdb.com/title/tt999900002/'] }), { extraScripts, director: 'Authored director' });
  assert.equal(conflict.reason, 'source-stable-id-conflict');
});

test('duplicate JSON keys, including escaped keys in unrelated objects, fail closed without lax JSON.parse', () => {
  for (const raw of ['{"@context":"https://schema.org","@type":"Movie","url":"' + CARD + '","sameAs":[],"same\\u0041s":[]}',
    '{"@type":"Organization","url":"one","url":"two"}']) {
    assert.throws(() => parseBoundedMovieJSON(raw), /json-duplicate-key/);
    const result = inspect(movie(), { extraScripts: script(raw), director: 'Authored director' });
    assert.equal(result.status, 'unresolved'); assert.equal(result.diagnostics.movieSameAs.reason, 'semantic-json-duplicate-key');
  }
});

test('bounded JSON never fetches contexts and excessive optional data cannot donate proof', () => {
  assert.throws(() => parseBoundedMovieJSON('['.repeat(40) + ']'.repeat(40)), /json-limit/);
  const result = inspect(movie(), { extraScripts: Array(8).fill(script({ '@type': 'Organization' })).join('') });
  assert.equal(result.reason, 'director-alias-unestablished');
  assert.equal(result.diagnostics.movieSameAs.reason, 'semantic-script-limit');
});

test('same ID with another H1 year requires director and records variance; datePublished supplies no year', () => {
  const published = movie({ datePublished: '2017-07-19' });
  assert.equal(inspect(published).status, 'matched');
  assert.deepEqual(inspect(published).diagnostics.years, { selected: 2001, source: 2001, delta: 0 });
  assert.equal(inspect(published).diagnostics.movieSameAs.datePublished, '2017-07-19');
  assert.equal(inspect(published, { year: 2002 }).reason, 'director-alias-unestablished');
  const proven = inspect(published, { year: 2002, director: 'Authored director' });
  assert.equal(proven.status, 'matched'); assert.equal(proven.reason, 'explicit-stable-and-structural-match');
  assert.equal(proven.diagnostics.years.delta, 1);
  assert.equal(inspect(published, { year: 'missing' }).reason, 'source-title-year-missing');
});

test('sameAs does not bypass explicit title/original, sequel or canonical conflicts', () => {
  assert.equal(inspect(movie({ name: 'Other Latin Film' }), { title: 'Other Latin Film' }).reason, 'source-title-conflict');
  assert.equal(inspect(movie(), { original: 'Other Original' }).reason, 'source-original-title-unestablished');
  assert.equal(inspect(movie({ name: film.identityTitle + ' 2' }), { title: film.identityTitle + ' 2' }).reason, 'source-title-conflict');
  assert.equal(inspect(movie(), { url: CARD + '-other' }).reason, 'source-canonical-conflict');
});

test('Roman, Ukrainian г/ґ and unknown translations preserve exact year and director requirements', () => {
  for (const [expected, heading, original] of [
    ['Гладіатор II', 'Гладіатор ІІ', 'Gladiator II'], ['Конг', 'Конґ', 'Kong'], ['Відомий переклад', 'Інший переклад', 'Authored original'],
  ]) {
    const selected = { ...film, identityTitle: expected, originalTitle: original, titleAliases: [expected, original] };
    assert.equal(inspect(movie({ name: heading }), { title: heading, original }, selected).reason, 'director-alias-unestablished');
    assert.equal(inspect(movie({ name: heading }), { title: heading, original, director: 'Authored director' }, selected).status, 'matched');
    assert.notEqual(inspect(movie({ name: heading }), { title: heading, original, year: 2002, director: 'Authored director' }, selected).status, 'matched');
  }
});

test('semantic ID route distinguishes credited cardinality from ambiguous fields', () => {
  const selected = { ...film, directorCount: 2, directorPeople: [...film.directorPeople, { namespace: 'tmdb:person', personId: 999900002, names: ['Another Person'] }] };
  assert.equal(inspect(movie(), {}, selected).reason, 'explicit-stable-title-year-match');
  assert.equal(inspect(movie(), { stable: '<tr><td>Режисер:</td><td>Second Person</td></tr>' }).reason, 'director-scope-unestablished');
  assert.equal(inspect(movie(), { director: '<a href="https://kinobazaua.com/persons/person-one">Person One</a>, <a href="https://kinobazaua.com/persons/person-two">Person Two</a>' }).reason, 'explicit-stable-title-year-match');
});

test('server-known exact linked-person conflict blocks new semantic bypass, not ordinary spelling uncertainty', async () => {
  const pointer = { sourceURL: 'https://kinobazaua.com/persons/authored-director', sourceAlias: 'Unknown authored spelling' };
  const html = source(movie(), { director: '<a href="' + pointer.sourceURL + '">' + pointer.sourceAlias + '</a>' });
  let conflictChecks = 0;
  const directorConflictLookup = observed => { conflictChecks++; assert.deepEqual(observed, pointer); return true; };
  const result = assistedIdentity(nodes(html), film, CARD, { directorAliasLookup: noCrosswalk, directorConflictLookup });
  assert.equal(conflictChecks, 1); assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-known-person-conflict');
  assert.equal(result.diagnostics.failedGate, 'director-alias');
  for (const lookup of [undefined, () => false, () => ({ status: 'unresolved' })]) {
    const ordinary = assistedIdentity(nodes(html), film, CARD, { directorAliasLookup: noCrosswalk, directorConflictLookup: lookup });
    assert.equal(ordinary.reason, 'explicit-stable-title-year-match');
  }
  let requests = 0, personRequests = 0;
  const fetched = await fetchAssistedKinobaza(CARD, film, async () => { requests++; return new Response(html, { headers: { 'content-type': 'text/html' } }); },
    { directorAliasLookup: noCrosswalk, directorConflictLookup, verifyDirector: async () => { personRequests++; } });
  assert.equal(requests, 1); assert.equal(personRequests, 0); assert.equal(fetched.identity.reason, 'director-known-person-conflict');
  assert.deepEqual(fetched.candidates, []);
});

test('HTML through extraction retains precise film link and track values for semantic identity route', async () => {
  let requests = 0;
  const result = await fetchAssistedKinobaza(CARD, film, async (url, init) => {
    requests++; assert.equal(url, CARD); assert.equal(init.redirect, 'manual');
    return new Response(source(), { headers: { 'content-type': 'text/html' } });
  }, { directorAliasLookup: noCrosswalk });
  assert.equal(requests, 1); assert.equal(result.identity.reason, 'explicit-stable-title-year-match');
  assert.ok(result.candidates.some(candidate => candidate.href === 'https://tv.apple.com/ua/movie/authored/umc.cmc.authoronly?at=AUTHOR%2fONLY'));
  assert.ok(result.localization.blocks.length > 0);
  assert.doesNotMatch(JSON.stringify(safeIdentityDiagnostic(result.identity.diagnostics)), /https?:|tt999900001|999900001|DO_NOT_PUBLISH/);
});
