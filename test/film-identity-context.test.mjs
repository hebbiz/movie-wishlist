import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFilmIdentityContext } from '../shared/film-identity-context.mjs';
import { projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';

// Entirely authored metadata. No live film record or historical response implied.
const reported = value => ({ state: 'reported', value });
const items = value => ({ state: value.length ? 'reported' : 'reported-empty', items: value });
const absent = state => ({ state });
const projection = metadata => ({ identity: { status: 'matched', tmdbId: reported(910001) }, metadata });
const event = (date, type = 1, language = '') => ({ date: reported(date), type: reported(type), language: language ? reported(language) : { state: 'reported-empty', value: '' } });
const releases = (events, country = 'GB') => items([{ country: reported(country), dates: items(events) }]);

test('trusted original/requested/translation/alternative titles retain exact independent contexts', () => {
  const result = projectFilmIdentityContext(projection({
    originalTitle: reported('Authored original'), requestedTitle: reported('Вигадана назва'),
    translations: items([
      { title: reported('Translation'), language: reported('en'), country: reported('GB') },
      { title: reported('Country-only translation'), country: reported('UA') },
      { title: reported('No country inference'), language: reported('de') },
    ]),
    alternativeTitles: items([
      { title: reported('Authored festival title'), country: reported('CA'), type: reported('Festival title') },
      { title: reported('Country-only alias'), country: reported('UA'), type: { state: 'reported-empty', value: '' } },
    ]),
    originalLanguage: reported('en'), spokenLanguages: items([{ language: reported('uk') }]),
  }));
  assert.deepEqual(result, { tmdbId: 910001, titleEvidence: [
    { title: 'Authored original', source: 'original' },
    { title: 'Вигадана назва', source: 'requested' },
    { title: 'Translation', source: 'translation', language: 'en', country: 'GB' },
    { title: 'Country-only translation', source: 'translation', country: 'UA' },
    { title: 'No country inference', source: 'translation', language: 'de' },
    { title: 'Authored festival title', source: 'alternative', country: 'CA', type: 'Festival title' },
    { title: 'Country-only alias', source: 'alternative', country: 'UA' },
  ], releaseEvidence: [] });
});

test('release events retain type/country/language and calendar prefix across UTC rollover', () => {
  const result = projectFilmIdentityContext(projection({
    releaseDate: reported('2008-01-01'),
    releaseDates: items([
      { country: reported('CA'), dates: items([event('2006-09-09T00:00:00.000Z', 1, 'en'), event('2008-01-01', 3)]) },
      { country: reported('GB'), dates: items([event('2006-12-31T23:30:00-02:00', 2), event('2008-01-01T00:15:00+02:00', 4)]) },
    ]),
  }));
  assert.deepEqual(result.releaseEvidence, [
    { date: '2006-09-09T00:00:00.000Z', year: 2006, type: 1, country: 'CA', language: 'en' },
    { date: '2008-01-01', year: 2008, type: 3, country: 'CA' },
    { date: '2006-12-31T23:30:00-02:00', year: 2006, type: 2, country: 'GB' },
    { date: '2008-01-01T00:15:00+02:00', year: 2008, type: 4, country: 'GB' },
  ]);
  assert.equal(result.releaseEvidence.some(entry => entry.date === '2008-01-01' && entry.country === undefined), false);
});

test('invalid/null/empty typed fields and malformed list states cannot become evidence', () => {
  const result = projectFilmIdentityContext(projection({
    originalTitle: { state: 'invalid', value: 'Never use' },
    requestedTitle: { state: 'reported-empty', value: 'Never use' },
    translations: items([
      null, { title: 'Untyped' }, { state: 'invalid' },
      { title: reported(''), language: reported('en') },
      { title: reported('  '), country: reported('GB') },
      { title: reported('Control\ntext'), country: reported('GB') },
      { title: reported('Literal title'), language: reported('en-GB'), country: reported('gb') },
    ]),
    alternativeTitles: { state: 'missing', items: [{ title: reported('Hidden') }] },
    releaseDates: { state: 'invalid', items: [{ country: reported('GB'), dates: items([event('2006-09-09')]) }] },
  }));
  assert.deepEqual(result, { tmdbId: 910001, titleEvidence: [{ title: 'Literal title', source: 'translation' }], releaseEvidence: [] });
  for (const state of ['missing', 'null', 'invalid', 'reported-empty']) {
    assert.deepEqual(projectFilmIdentityContext(projection({ translations: { state, items: [{ title: reported('Hidden') }] }, releaseDates: { state } })),
      { tmdbId: 910001, titleEvidence: [], releaseEvidence: [] });
  }
});

test('unmatched, absent or untyped parent identity is withheld, including appended-ID conflict', () => {
  for (const value of [null, undefined, {}, [],
    { identity: { status: 'unresolved', tmdbId: reported(910001) } },
    { identity: { status: 'mismatch', tmdbId: reported(910001) } },
    { identity: { status: 'matched', tmdbId: 910001 } },
    { identity: { status: 'matched', tmdbId: reported('910001') } },
    { identity: { status: 'matched', tmdbId: reported(0) } },
    { identity: { status: 'matched', tmdbId: { state: 'invalid', value: 910001 } } },
  ]) assert.equal(projectFilmIdentityContext(value), null);
  const source = { id: 910001, title: 'Authored title', original_title: 'Authored original', external_ids: {},
    alternative_titles: { id: 910002, titles: [{ title: 'Wrong ownership', iso_3166_1: 'US' }] },
    credits: { crew: [] }, release_dates: { results: [] }, translations: { translations: [] } };
  const projected = projectTmdbIdentityFor(source, { tmdbId: 910001 });
  assert.equal(projected.identity.status, 'mismatch');
  assert.equal(projectFilmIdentityContext(projected), null);
});

test('validated appended resources inherit the exact parent and API-error resources are ignored', () => {
  const source = { id: 910001, title: 'Requested', original_title: 'Original', external_ids: {},
    alternative_titles: { titles: [{ title: 'Alternate', iso_3166_1: 'UA', type: 'festival' }] },
    credits: { crew: [] },
    release_dates: { results: [{ iso_3166_1: 'CA', release_dates: [{ release_date: '2006-09-09T00:00:00.000Z', type: 1, iso_639_1: 'en' }] }] },
    translations: { translations: [{ iso_639_1: 'uk', iso_3166_1: 'UA', data: { title: 'Переклад' } }] } };
  const good = projectFilmIdentityContext(projectTmdbIdentityFor(source, { tmdbId: 910001 }));
  assert.equal(good.tmdbId, 910001);
  assert.equal(good.titleEvidence.length, 4);
  assert.deepEqual(good.releaseEvidence, [{ date: '2006-09-09T00:00:00.000Z', year: 2006, type: 1, country: 'CA', language: 'en' }]);
  const invalidSource = { ...source, alternative_titles: { ...source.alternative_titles, success: false },
    release_dates: { ...source.release_dates, status_code: 34 }, translations: null };
  const invalid = projectTmdbIdentityFor(invalidSource, { tmdbId: 910001 });
  assert.equal(invalid.identity.status, 'matched');
  assert.deepEqual(projectFilmIdentityContext(invalid), { tmdbId: 910001, titleEvidence: [
    { title: 'Original', source: 'original' }, { title: 'Requested', source: 'requested' },
  ], releaseEvidence: [] });
});

test('real calendar validation rejects rollovers and unsafe/unknown release contexts', () => {
  const invalid = ['2006-02-29', '1900-02-29', '2000-02-30', '0000-01-01', '2006-00-10', '2006-13-01', '2006-01-00', '2006-04-31',
    '2006-1-01', '2006-01-01T24:00:00Z', '2006-01-01T12:60:00Z', '2006-01-01T12:00:60Z', '2006-01-01T00:00:00',
    '2006-01-01T00:00:00+15:00', '2006-01-01T00:00:00+14:01', '2006-01-01T00:00:00+01:60', '2006-01-01\n'];
  assert.deepEqual(projectFilmIdentityContext(projection({ releaseDates: releases(invalid.map(date => event(date))) })).releaseEvidence, []);
  assert.deepEqual(projectFilmIdentityContext(projection({ releaseDates: releases([event('2000-02-29'), event('2004-02-29'), event('2006-01-01T00:00:00+14:00')]) })).releaseEvidence.map(value => value.year), [2000, 2004, 2006]);
  for (const type of [0, 7, -1, 1.5, '1', null]) {
    assert.deepEqual(projectFilmIdentityContext(projection({ releaseDates: releases([event('2006-09-09', type)]) })).releaseEvidence, []);
  }
  for (const region of ['gb', 'GBR', '', 'G\n', 10]) {
    assert.deepEqual(projectFilmIdentityContext(projection({ releaseDates: releases([event('2006-09-09')], region) })).releaseEvidence, []);
  }
  for (const state of ['missing', 'null', 'invalid', 'reported-empty']) {
    const value = event('2006-09-09'); value.date = absent(state);
    assert.deepEqual(projectFilmIdentityContext(projection({ releaseDates: releases([value]) })).releaseEvidence, []);
  }
});

test('exact contextual deduplication preserves different countries, languages and types', () => {
  const translated = { title: reported('Shared'), language: reported('en'), country: reported('GB') };
  const result = projectFilmIdentityContext(projection({
    originalTitle: reported('Shared'), requestedTitle: reported('Shared'),
    translations: items([translated, translated, { ...translated, country: reported('US') }, { ...translated, language: reported('uk') }]),
    releaseDates: items([
      { country: reported('GB'), dates: items([event('2006-09-09', 1, 'en'), event('2006-09-09', 1, 'en'), event('2006-09-09', 3, 'en'), event('2006-09-09', 1, 'uk')]) },
      { country: reported('US'), dates: items([event('2006-09-09', 1, 'en')]) },
    ]),
  }));
  assert.equal(result.titleEvidence.length, 5);
  assert.equal(result.releaseEvidence.length, 4);
});

test('output and malformed input sizes remain bounded without requests or mutation', () => {
  const metadata = { originalTitle: reported('Original'), requestedTitle: reported('Requested'),
    translations: items(Array.from({ length: 1000 }, (_, index) => ({ title: reported(`Title ${index}`), language: reported('en') }))),
    releaseDates: releases(Array.from({ length: 1000 }, (_, index) => event(`${String(2000 + index)}-01-01`))),
  };
  const before = structuredClone(metadata);
  const result = projectFilmIdentityContext(projection(metadata));
  assert.equal(result.titleEvidence.length, 120);
  assert.equal(result.releaseEvidence.length, 240);
  assert.deepEqual(metadata, before);
  assert.deepEqual(projectFilmIdentityContext(projection({ translations: { state: 'reported', items: 'not-an-array' },
    alternativeTitles: items(Array.from({ length: 2001 }, () => ({ title: reported('Overlarge') }))),
    releaseDates: items(Array.from({ length: 251 }, () => ({ country: reported('GB'), dates: releases([event('2006-01-01')]) }))),
  })), { tmdbId: 910001, titleEvidence: [], releaseEvidence: [] });
});
