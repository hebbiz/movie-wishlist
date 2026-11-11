// Authored metadata/HTML and fictional IDs only. Named-film scenarios below
// exercise policy, not live catalogue/release/person evidence or availability.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverQueries, resolverRefusalQuery } from '../netlify/lib/kinobaza-resolver.mjs';
import { fetchAssistedKinobaza, linkedDirectorProfile } from '../netlify/lib/kinobaza-card.mjs';
import { extractHtml } from '../netlify/lib/kinobaza-html.mjs';
import { markup, CARD } from './assisted-kinobaza.fixture.mjs';
import { initialReleaseEvidence } from '../netlify/lib/media-advice/identity/film-release-year.mjs';
import { projectFilmIdentityContext } from '../netlify/lib/media-advice/identity/film-identity-context.mjs';

const PERSON = 999999;
const PROFILE = 'https://kinobazaua.com/persons/authored-director';
const sourceAlias = 'Авторський режисер';
const film = { id: 'authored-context-film', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: [], directorCount: 1, directorAliases: ['Authored director'],
  directorPeople: [{ namespace: 'tmdb:person', personId: PERSON, names: ['Authored director'] }] };
const release = (year, type = 1, country = 'CA') => ({ date: `${year}-09-09T00:00:00.000Z`, year, type, country, language: 'en' });
const context = (selected, { titles = [], releases = [] } = {}) => ({ ...selected,
  identityContext: { tmdbId: selected.tmdbId, titleEvidence: titles, releaseEvidence: releases } });
const linked = href => `<a href="${href}">${sourceAlias}</a>`;
const proof = (change = {}) => ({ status: 'confirmed', aliases: [sourceAlias], provenance: {
  namespace: 'tmdb:person', personId: PERSON, scope: 'kinobaza-director-identity', sourceURL: PROFILE,
  ...change,
} });
const idRow = id => `<tr><td>IMDb:</td><td>${id}</td></tr>`;

async function card({ selected = film, html = markup(), verifyDirector } = {}) {
  let requests = 0;
  const result = await fetchAssistedKinobaza(CARD, selected, async (url, init) => {
    requests++; assert.equal(url, CARD); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }, { verifyDirector });
  assert.equal(requests, 1);
  if (result.identity?.status !== 'matched') {
    assert.deepEqual(result.candidates, []);
    assert.equal(result.localization, undefined);
  }
  return result;
}
async function pointer(html) {
  let result;
  await extractHtml(html, film, { identityCheck: all => {
    result = linkedDirectorProfile(all); return { status: 'unresolved' };
  } });
  return result;
}

test('contextual queries prefer explicitly English translation and retain localized name and Latin director for disambiguation', () => {
  const selected = context({ ...film, originalTitle: 'Authored German title', identityTitle: 'Вигадана локалізована назва', year: 2008,
    directorPeople: [{ namespace: 'tmdb:person', personId: PERSON, names: ['Авторський режисер', 'Authored director'] }] }, {
    titles: [
      { source: 'original', title: 'Authored German title' },
      { source: 'translation', title: 'Authored English title', language: 'en', country: 'GB' },
    ], releases: [release(2008, 3), release(2006, 1)],
  });
  const queries = resolverQueries(selected);
  assert.deepEqual(queries, [
    '"Authored English title" 2006 site:kinobazaua.com/titles/',
    '"Authored English title" "Вигадана локалізована назва" "Authored director" 2008 site:kinobazaua.com/titles/',
  ]);
  assert.equal(resolverRefusalQuery(selected), queries[1]);
});

test('two contextual search slots cover the confirmed premiere and primary years without accepting unrelated release contexts', () => {
  const selected = { ...film, year: 2008 };
  for (const releases of [[release(2006, 1), release(2008, 3)], [release(2008, 3), release(2006, 1)]]) {
    const queries = resolverQueries(context(selected, { releases }));
    assert.equal(queries.length, 2);
    assert.match(queries[0], / 2006 site:kinobazaua\.com\/titles\/$/);
    assert.match(queries[1], / 2008 site:kinobazaua\.com\/titles\/$/);
    assert.equal(resolverRefusalQuery(context(selected, { releases })), queries[1]);
  }
  for (const releases of [[release(2008)], [release(2006, 4)], [release(2006, 5)], [release(2006, 6)],
    [release(2006, 1, '')], [release(2010, 1)], [{ ...release(2006), date: '2007-09-09' }]]) {
    const queries = resolverQueries(context(selected, { releases }));
    assert.ok(queries.every(query => / 2008 site:kinobazaua\.com\/titles\/$/.test(query)));
    assert.ok(queries.every(query => !/ 2006 | 2010 /.test(query)));
  }
  const bounded = resolverQueries(context({ ...selected, originalTitle: 'X'.repeat(500), identityTitle: 'Y'.repeat(500) }, { releases: [release(2006)] }));
  assert.ok(bounded.every(query => query.length <= 550));
  assert.match(bounded[1], / 2008 site:kinobazaua\.com\/titles\/$/);
});

test('country-only alternatives/translations never imply English and unmatched parent context cannot influence query text/year', () => {
  const selected = context(film, { titles: [
    { source: 'alternative', title: 'Authored US alternative', country: 'US' },
    { source: 'translation', title: 'Authored GB country-only translation', country: 'GB' },
    { source: 'translation', title: 'Authored French title', language: 'fr', country: 'FR' },
  ] });
  assert.equal(resolverQueries(selected)[0], '"Authored original" 2001 site:kinobazaua.com/titles/');
  const wrongParent = { ...selected, identityContext: { ...selected.identityContext, tmdbId: film.tmdbId + 1,
    titleEvidence: [{ source: 'translation', title: 'Wrong parent English', language: 'en' }], releaseEvidence: [release(1999)] } };
  assert.deepEqual(resolverQueries(wrongParent), resolverQueries(film));
  const projection = { identity: { status: 'matched', tmdbId: { state: 'reported', value: film.tmdbId } },
    metadata: { translations: { state: 'invalid', items: [{ title: { state: 'reported', value: 'Invalid resource English' }, language: { state: 'reported', value: 'en' } }] } } };
  const invalid = { ...film, identityContext: projectFilmIdentityContext(projection) };
  assert.equal(resolverQueries(invalid)[0], resolverQueries(film)[0]);
});

test('query names remain escaped/bounded and ambiguous director scope supplies no flat-list director', () => {
  const selected = context({ ...film, originalTitle: 'Quoted "title" \\ name', directorCount: 2,
    directorAliases: ['One', 'Two'], directorPeople: [film.directorPeople[0], { ...film.directorPeople[0], personId: PERSON + 1, names: ['Another director'] }] });
  const queries = resolverQueries(selected);
  assert.ok(queries.every(query => !query.includes('\\') && query.endsWith('site:kinobazaua.com/titles/')));
  assert.ok(queries.every(query => !query.includes('Authored director') && !query.includes('Another director')));
  const long = context({ ...film, originalTitle: 'X'.repeat(500), identityTitle: 'Y'.repeat(500),
    directorPeople: [{ ...film.directorPeople[0], names: ['A'.repeat(500)] }] });
  assert.equal(resolverQueries(long).length, 2);
  assert.ok(resolverQueries(long).every(query => query.length <= 550));
  assert.deepEqual(resolverQueries(film), ['"Authored original" 2001 site:kinobazaua.com/titles/', '"Вигаданий фільм" 2001 site:kinobazaua.com/titles/']);
});

test('authored The Fall year variance requires earliest contextual premiere plus an exact director', async () => {
  const selected = context({ ...film, originalTitle: 'The Fall', identityTitle: 'Вигадане Позамежжя', year: 2008 }, {
    releases: [release(2008, 3), release(2006, 1), release(2007, 2)],
  });
  const result = await card({ selected, html: markup({ title: selected.identityTitle, original: selected.originalTitle, year: 2006 }) });
  assert.equal(result.identity.status, 'matched');
  assert.equal(result.identity.reason, 'explicit-title-release-year-director-match');
  assert.equal(result.identity.diagnostics.strategy, 'title-release-year-director');
  assert.deepEqual(result.identity.diagnostics.years, { selected: 2008, source: 2006, delta: -2 });
  assert.deepEqual(result.identity.releaseYearEvidence, [release(2006, 1)]);
  assert.equal(result.identity.diagnostics.gates['director-alias'], 'pass');
  const unknown = await card({ selected, html: markup({ title: selected.identityTitle, original: selected.originalTitle, year: 2006, director: 'Unverified spelling' }) });
  assert.equal(unknown.identity.status, 'unresolved');
  assert.equal(unknown.identity.reason, 'director-alias-unestablished');
});

test('release context does not authorize a nearby year, later reissue, digital/physical/TV date or wrong-parent event', async () => {
  const cases = [
    { selected: context({ ...film, year: 2008 }, { releases: [release(2006), release(2007, 3)] }), year: 2007 },
    { selected: context({ ...film, year: 2008 }, { releases: [release(2006), release(2010, 3)] }), year: 2010 },
    ...[4, 5, 6].map(type => ({ selected: context({ ...film, year: 2008 }, { releases: [release(2006, type)] }), year: 2006 })),
    { selected: { ...context({ ...film, year: 2008 }, { releases: [release(2006)] }), identityContext: { tmdbId: film.tmdbId + 1, releaseEvidence: [release(2006)] } }, year: 2006 },
    { selected: { ...film, year: 2008 }, year: 2006 },
  ];
  for (const { selected, year } of cases) {
    const result = await card({ selected, html: markup({ year }) });
    assert.equal(result.identity.status, 'mismatch');
    assert.equal(result.identity.reason, 'source-year-conflict-without-stable-crosswalk');
  }
  assert.deepEqual(initialReleaseEvidence(context({ ...film, year: 2008 }, { releases: [release(2010), release(2006, 4)] })), []);
});

test('stable-ID and title conflicts retain priority over contextual release/director proof', async () => {
  const selected = context({ ...film, year: 2008 }, { releases: [release(2006)] });
  for (const [changes, expected] of [
    [{ stable: idRow('tt999900002'), title: 'Wrong title', year: 2006 }, 'source-stable-id-conflict'],
    [{ title: 'Wrong title', year: 2006 }, 'source-title-conflict'],
    [{ original: 'Wrong original', year: 2006 }, 'source-original-title-unestablished'],
  ]) {
    let verified = 0;
    const result = await card({ selected, html: markup({ director: linked(PROFILE), ...changes }), verifyDirector: async () => { verified++; return proof(); } });
    assert.equal(result.identity.reason, expected);
    assert.equal(verified, 0);
  }
});

test('linked director pointer is admitted only for the single bounded labelled metadata row and exact person URL', async () => {
  for (const href of [PROFILE, '/persons/authored-director']) {
    assert.deepEqual(await pointer(markup({ director: linked(href) })), { sourceURL: PROFILE, sourceAlias });
  }
  const base = markup({ director: linked(PROFILE) });
  const invalid = [
    ...['https://foreign.example/persons/authored-director', 'http://kinobazaua.com/persons/authored-director',
      PROFILE + '?secret=value', PROFILE + '#person', PROFILE + '/', PROFILE + '/photos',
      'https://kinobazaua.com:443/persons/authored-director', 'https://user@kinobazaua.com/persons/authored-director',
      '/persons/%61uthored-director', '/persons/../persons/authored-director'].map(href => markup({ director: linked(href) })),
    markup({ director: `${linked(PROFILE)} and Another name` }),
    markup({ director: `${linked(PROFILE)}${linked(PROFILE)}` }),
    base.replace('</table>', `<tr><td>Режисер:</td><td>${linked(PROFILE)}</td></tr></table>`),
    markup({ director: 'Authored director' }).replace('</body>', `<table><tr><td>Режисер:</td><td>${linked(PROFILE)}</td></tr></table></body>`),
    markup({ director: 'Authored director' }).replace('</body>', `<aside><table><tr><td>Режисер:</td><td>${linked(PROFILE)}</td></tr></table></aside></body>`),
    base.replace('<h1>', '<h1>Duplicate</h1><h1>'),
    base.replace('id="availabilityAccordion"', 'id="differentBoundary"'),
  ];
  for (const html of invalid) assert.equal(await pointer(html), null);
});

test('a verified linked person can resolve exact alias spelling without weakening film gates or borrowing proof', async () => {
  let verifications = 0;
  const result = await card({ html: markup({ director: linked(PROFILE) }), verifyDirector: async pointer => {
    verifications++; assert.deepEqual(pointer, { sourceURL: PROFILE, sourceAlias }); return proof();
  } });
  assert.equal(verifications, 1);
  assert.equal(result.identity.status, 'matched');
  assert.equal(result.identity.directorAliasEvidence.personId, PERSON);
  assert.equal(result.identity.directorAliasEvidence.sourceURL, PROFILE);
  assert.ok(result.candidates.length > 0);
  for (const invalid of [proof({ personId: PERSON + 1 }), proof({ namespace: 'imdb:person' }), proof({ scope: 'another-scope' }),
    proof({ sourceURL: PROFILE + '-other' }), { ...proof(), aliases: ['Similar but different name'] },
    { ...proof(), aliases: [sourceAlias, 'Second alias'] }, { ...proof(), status: 'unresolved' }, null]) {
    const rejected = await card({ html: markup({ director: linked(PROFILE) }), verifyDirector: async () => invalid });
    assert.equal(rejected.identity.status, 'unresolved');
    assert.equal(rejected.identity.reason, 'director-alias-unestablished');
  }
});

test('profile verification never runs for already matched cards or prior ID/title/year/structural conflicts', async () => {
  const cases = [
    [film, markup()],
    [film, markup({ director: linked(PROFILE), stable: idRow('tt999900002') })],
    [film, markup({ director: linked(PROFILE), title: 'Different title' })],
    [film, markup({ director: linked(PROFILE), year: 2002 })],
    [film, markup({ director: linked(PROFILE), original: 'Different original' })],
    [{ ...film, directorCount: 2 }, markup({ director: linked(PROFILE) })],
    [film, markup({ director: '' })],
  ];
  for (const [selected, html] of cases) {
    let calls = 0;
    await card({ selected, html, verifyDirector: async () => { calls++; return proof(); } });
    assert.equal(calls, 0, 'proof I/O is forbidden before an eligible director-alias-only refusal');
  }
});

test('linked-person proof cannot establish a missing, invalid or wrong-namespace selected person ID', async () => {
  for (const [namespace, personId] of [['tmdb:person', null], ['tmdb:person', 0], ['tmdb:person', '999999'], ['imdb:person', PERSON]]) {
    const selected = { ...film, directorPeople: [{ namespace, personId, names: ['Authored director'] }] };
    const result = await card({ selected, html: markup({ director: linked(PROFILE) }),
      verifyDirector: async () => proof({ namespace, personId }) });
    assert.equal(result.identity.status, 'unresolved');
    assert.equal(result.identity.reason, 'director-alias-unestablished');
  }
});

test('missing/ambiguous linked profile and verifier failure keep exact-name mismatch unresolved with claims withheld', async () => {
  let calls = 0;
  const missing = await card({ html: markup({ director: sourceAlias }), verifyDirector: async () => { calls++; return proof(); } });
  assert.equal(missing.identity.reason, 'director-alias-unestablished'); assert.equal(calls, 0);
  const ambiguous = await card({ html: markup({ director: linked(PROFILE) + linked(PROFILE + '-other') }), verifyDirector: async () => { calls++; return proof(); } });
  assert.notEqual(ambiguous.identity.status, 'matched'); assert.equal(calls, 0);
  const failed = await card({ html: markup({ director: linked(PROFILE) }), verifyDirector: async () => { throw Error('No shared profile proof'); } });
  assert.equal(failed.identity.reason, 'director-alias-unestablished');
});
