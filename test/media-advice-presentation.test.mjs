import test from 'node:test';
import assert from 'node:assert/strict';
import { rankMediaRows, presentMediaRow, summarizeMediaAdvice } from '../assets/media-advice-presentation.mjs';

// Authored projected rows only. No source request, offer merge or stored result.
const reported = (language = 'ukr') => ({ state: 'reported', ukrainian: [{ language }] });
const unknown = () => ({ state: 'unknown' });
const row = (id, extra = {}) => ({ id: `motn:${id}`, identityStatus: 'matched', provider: { key: 'apple' }, country: 'UA', audio: unknown(), subtitles: unknown(), conflicts: [], ...extra });

test('ranking follows same-row UA audio, then UA subtitles with unknown audio, UA, and supplemental evidence', () => {
  const supplemental = row('supplemental', { country: null, audio: reported() });
  const ua = row('ua');
  const subtitles = row('subtitles', { subtitles: reported() });
  const audio = row('audio', { audio: reported('uk') });
  assert.deepEqual(rankMediaRows([supplemental, ua, subtitles, audio]), [audio, subtitles, ua, supplemental]);
  assert.match(summarizeMediaAdvice([supplemental, ua, subtitles, audio]), /Україну та українське аудіо/);
});

test('equal evidence keeps input source order and does not use format, price, or provider preferences', () => {
  const first = row('first', { provider: { key: 'netflix' }, audio: reported(), quality: { state: 'reported', value: 'sd' } });
  const second = row('second', { audio: reported(), quality: { state: 'reported', value: 'uhd' }, price: { state: 'reported', amount: '1' } });
  const input = Object.freeze([Object.freeze(first), Object.freeze(second)]);
  assert.deepEqual(rankMediaRows(input), [first, second]);
  assert.match(summarizeMediaAdvice(input), /Netflix/);
});

test('provider block tracks, the general film badge, and matching provider names cannot promote a UA row', () => {
  const country = row('country', { id: 'kinobaza:country' });
  const block = row('block', { id: 'kinobaza:block', country: null, kinobazaLocalization: { audio: { state: 'reported-positive' }, subtitles: { state: 'reported-positive' } } });
  const subtitleOffer = row('subtitle', { provider: { key: 'prime' }, subtitles: reported() });
  const result = { rows: [block, country, subtitleOffer], filmLocalization: { ukrainianAudio: { state: 'reported-positive' } } };
  assert.deepEqual(rankMediaRows(result.rows), [subtitleOffer, country, block]);
  assert.equal(presentMediaRow(country).band, 'ua');
  assert.equal(presentMediaRow(block).band, 'supplemental');
  assert.match(presentMediaRow(block).audioLabel, /невідомо/);
  assert.equal(presentMediaRow(block).blockAudioLabel, 'Кінобаза вказує українське аудіо');
  assert.equal(presentMediaRow(block).blockSubtitlesLabel, 'Кінобаза вказує українські субтитри');
  assert.ok(presentMediaRow(block).warnings.includes('Для цієї пропозиції ще не перевірено.'));
  assert.match(summarizeMediaAdvice(result), /Prime Video.*українські субтитри/);
  assert.equal(country.audio.state, 'unknown');
});

test('source conflicts and unmatched or conflicting providers cannot become the recommended first choice', () => {
  const ordinary = row('ordinary', { provider: { key: 'megogo' } });
  for (const extra of [{ conflicts: [{ field: 'audio' }] }, { audio: { state: 'conflicting', ukrainian: [{ language: 'ukr' }] } }, { providerConflict: true }, { identityStatus: 'unresolved' }, { provider: { key: 'plex' } }]) {
    const conflicted = row('conflicted', { audio: reported(), ...extra });
    assert.equal(rankMediaRows([conflicted, ordinary])[0], ordinary);
    assert.equal(presentMediaRow(conflicted).band, 'withheld');
    assert.match(summarizeMediaAdvice([conflicted, ordinary]), /MEGOGO/);
  }
});

test('missing, empty and unlisted language metadata stay unknown, never negative', () => {
  for (const audio of [undefined, { state: 'not-reported' }, { state: 'invalid' }, { state: 'reported', ukrainian: [] }, { state: 'not-listed-completeness-unknown', returnedLocales: [] }, { state: 'not-listed-completeness-unknown', returnedLocales: [{ language: 'eng' }] }]) {
    const presented = presentMediaRow(row('unknown', { audio }));
    assert.equal(presented.band, 'ua');
    assert.doesNotMatch(presented.audioLabel, /відсут|немає|«−»/);
    assert.match(presented.audioLabel, /невідом|не зазначено/);
  }
});

test('unknown territory and a UA-looking URL cannot outrank explicit UA context', () => {
  const missing = row('missing', { country: undefined, audio: reported(), link: { href: 'https://tv.apple.com/ua/movie/authored' } });
  const ua = row('ua');
  assert.deepEqual(rankMediaRows([missing, ua]), [ua, missing]);
  assert.match(presentMediaRow(missing).territoryLabel, /не встановлено/);
  assert.match(summarizeMediaAdvice([missing]), /доступність в Україні не встановлено/);
  assert.equal(presentMediaRow(row('foreign', { country: 'DE' })).territoryLabel, 'Інша країна');
});

test('subtitles rank second without positive same-row audio, with distinct negative and unknown explanations', () => {
  const subtitle = row('subtitle', { subtitles: reported() });
  const negative = row('negative', { audio: { state: 'reported-negative', language: 'uk' }, subtitles: reported() });
  const ordinary = row('ordinary');
  const conflicting = row('conflicting', { audio: { state: 'conflicting' }, subtitles: reported() });
  assert.deepEqual(rankMediaRows([ordinary, negative, subtitle, conflicting]), [negative, subtitle, ordinary, conflicting]);
  assert.equal(presentMediaRow(negative).band, 'ua-subtitles');
  assert.equal(presentMediaRow(conflicting).band, 'withheld');
  assert.match(summarizeMediaAdvice([negative]), /а українське аудіо джерело позначає як відсутнє/);
  assert.match(summarizeMediaAdvice([subtitle]), /а українське аудіо не підтверджене/);
  const block = presentMediaRow(row('block', { kinobazaLocalization: { audio: { state: 'reported-negative' } } }));
  assert.match(block.blockAudioLabel, /зазначені українські аудіодоріжки як відсутні/);
  assert.match(block.audioLabel, /невідомо/);
  const uncertain = presentMediaRow(row('uncertain', { kinobazaLocalization: { audio: { state: 'conflicting' }, subtitles: { state: 'unknown' } } }));
  assert.match(uncertain.blockAudioLabel, /Дані Кінобази.*суперечливі/);
  assert.equal(uncertain.blockSubtitlesLabel, 'Кінобаза не уточнює, чи є українські субтитри');
});

test('presentation uses known source/platform labels and does not echo raw source descriptions', () => {
  const presented = presentMediaRow(row('known', { id: 'card-1:kinobaza:0', provider: { key: 'prime', name: 'PRIVATE_NAME' }, provenance: { source: 'PRIVATE_SOURCE' }, access: { state: 'reported', value: 'PRIVATE_ACCESS' } }));
  assert.equal(presented.title, 'Prime Video'); assert.equal(presented.sourceLabel, 'Кінобаза');
  assert.equal(presented.accessLabel, 'Тип доступу невідомий'); assert.doesNotMatch(JSON.stringify(presented), /PRIVATE/);
  assert.equal(presentMediaRow(row('motn')).sourceLabel, 'Movie of the Night');
  assert.equal(presentMediaRow(row('tmdb', { id: 'tmdb:0' })).sourceLabel, 'TMDb / JustWatch');
  const unknownProvider = presentMediaRow(row('unknown', { provider: { key: '__proto__' }, access: { state: 'reported', value: '__proto__' } }));
  assert.equal(unknownProvider.title, 'Інша платформа'); assert.equal(unknownProvider.accessLabel, 'Тип доступу невідомий');
});

test('empty, partial, or wholly refused results have concise unknown-not-unavailable summaries', () => {
  for (const result of [undefined, [], { rows: [], unmapped: [{ name: 'Authored other platform' }] }, [row('refused', { identityStatus: 'mismatch' })]]) {
    const summary = summarizeMediaAdvice(result);
    assert.match(summary, /не отримано узгоджених варіантів/);
    assert.match(summary, /не означає, що фільм недоступний/);
    assert.equal(summary.split(/[.!?]/).filter(sentence => sentence.trim()).length, 2);
  }
  assert.deepEqual(rankMediaRows(undefined), []);
  assert.deepEqual(rankMediaRows([null, false]), []);
});
