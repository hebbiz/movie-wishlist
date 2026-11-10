import test from 'node:test';
import assert from 'node:assert/strict';
import { rankMediaRows, groupMediaRows, presentMediaRow, summarizeMediaAdvice } from '../assets/media-advice-presentation.mjs';
import { authoredGroupedMediaRows } from './media-advice-group.fixture.mjs';

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
  assert.equal(presentMediaRow(block).blockAudioLabel, 'Є згадка про українське аудіо');
  assert.equal(presentMediaRow(block).blockSubtitlesLabel, 'Є згадка про українські субтитри');
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
  assert.match(block.blockAudioLabel, /Зазначені українські аудіодоріжки позначені як відсутні/);
  assert.match(block.audioLabel, /невідомо/);
  const uncertain = presentMediaRow(row('uncertain', { kinobazaLocalization: { audio: { state: 'conflicting' }, subtitles: { state: 'unknown' } } }));
  assert.match(uncertain.blockAudioLabel, /Згадки про українське аудіо суперечливі/);
  assert.equal(uncertain.blockSubtitlesLabel, 'Не уточнено, чи є українські субтитри');
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

test('eight separate projected rows form three ordered platform cards with every original variant retained', () => {
  const rows = authoredGroupedMediaRows(), groups = groupMediaRows(rows);
  assert.deepEqual(groups.map(group => [group.key, group.title, group.rows.length, group.readOnly]), [
    ['prime', 'Prime Video', 2, false], ['hbo', 'HBO Max', 2, false], ['rakuten', 'Rakuten TV', 4, false],
  ]);
  assert.strictEqual(groups[0].primary, rows[0]); assert.strictEqual(groups[1].primary, rows[2]); assert.strictEqual(groups[2].primary, rows[4]);
  const retained = groups.flatMap(group => group.rows);
  assert.equal(retained.length, 8); assert.equal(new Set(retained).size, 8);
  for (const original of rows) assert.ok(retained.includes(original));
  assert.strictEqual(groups[0].rows[1], rows[1]); assert.equal(groups[0].rows[1].link.href, null);
  assert.deepEqual(groups[2].rows.slice(0, 2).map(option => option.access.value), ['rental', 'buy']);
  assert.equal(groups[2].rows[0].link.href, groups[2].rows[1].link.href);
  assert.notStrictEqual(groups[2].rows[0], groups[2].rows[1], 'shared URL is not offer equivalence');
});

test('grouping never lends unknown-territory block tracks or a conflicting option to another row', () => {
  const rows = authoredGroupedMediaRows(), group = groupMediaRows(rows).find(item => item.key === 'rakuten');
  assert.equal(presentMediaRow(group.primary).band, 'ua'); assert.equal(group.primary.audio.state, 'unknown');
  assert.equal(group.primary.subtitles.state, 'unknown'); assert.equal(group.primary.kinobazaLocalization, undefined);
  assert.strictEqual(group.rows[2], rows[6]); assert.equal(presentMediaRow(group.rows[2]).band, 'supplemental');
  assert.strictEqual(group.rows[3], rows[7]); assert.equal(presentMediaRow(group.rows[3]).band, 'withheld');
  assert.deepEqual(group.rows[3].conflicts, [{ field: 'audio', type: 'authored-conflict' }]);
});

test('conflicting provider mappings and unresolved identities remain separate read-only observations', () => {
  const canonical = row('canonical', { provider: { key: 'prime' } });
  const mappingConflict = row('mapping-conflict', { provider: { key: 'prime' }, providerConflict: true, audio: reported() });
  const identityUnknown = row('identity-unknown', { provider: { key: 'prime' }, identityStatus: 'unresolved' });
  const unknownProvider = row('unknown-provider', { provider: { key: 'plex', name: 'Prime Video' } });
  const groups = groupMediaRows([mappingConflict, identityUnknown, unknownProvider, canonical]);
  assert.equal(groups.length, 4); assert.equal(groups[0].key, 'prime'); assert.strictEqual(groups[0].primary, canonical);
  assert.deepEqual(groups[0].rows, [canonical]); assert.equal(new Set(groups.map(group => group.key)).size, 4);
  for (const group of groups.slice(1)) { assert.match(group.key, /^unresolved:/); assert.equal(group.readOnly, true); assert.equal(group.rows.length, 1); }
  assert.strictEqual(groups[1].primary, mappingConflict); assert.strictEqual(groups[2].primary, identityUnknown);
});

test('group ties and variant ties follow supplied order without mutating even frozen input rows', () => {
  const rows = [row('rakuten-first', { provider: { key: 'rakuten' } }), row('prime-first', { provider: { key: 'prime' } }), row('rakuten-next', { provider: { key: 'rakuten' } })];
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const before = JSON.stringify(rows); freeze(rows);
  const groups = groupMediaRows(rows);
  assert.deepEqual(groups.map(group => group.key), ['rakuten', 'prime']);
  assert.strictEqual(groups[0].rows[0], rows[0]); assert.strictEqual(groups[0].rows[1], rows[2]);
  assert.strictEqual(groups[1].primary, rows[1]); assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(groupMediaRows(undefined), []); assert.deepEqual(groupMediaRows([null, false]), []);
});

test('presenting a different group option does not replace the explanation of the original ranked evidence', () => {
  const rows = authoredGroupedMediaRows(), summary = summarizeMediaAdvice(rows), prime = groupMediaRows(rows)[0];
  assert.equal(presentMediaRow(prime.rows[1]).accessLabel, 'Купівля');
  assert.match(presentMediaRow(prime.rows[1]).audioLabel, /невідомо/);
  assert.equal(prime.rows[1].link.href, null);
  assert.equal(summarizeMediaAdvice(rows), summary); assert.strictEqual(prime.primary, rows[0]);
  assert.match(summary, /Prime Video.*Україну та українське аудіо/);
});

test('summary anchors the best original variant even when another option of that platform is presented', () => {
  const rows = authoredGroupedMediaRows(), prime = groupMediaRows(rows)[0], selected = prime.rows[1];
  const summary = summarizeMediaAdvice(rows, { variantName: first => {
    assert.strictEqual(first, prime.primary);
    return `варіант ${prime.rows.indexOf(first) + 1} (${presentMediaRow(first).accessLabel.toLowerCase()})`;
  } });
  assert.match(summary, /Prime Video, варіант 1 \(оренда\): джерело вказує Україну та українське аудіо/);
  assert.equal(summary.split(/[.!?]/).filter(sentence => sentence.trim()).length, 2);
  assert.equal(selected.access.value, 'purchase'); assert.equal(selected.link.href, null); assert.equal(selected.audio.state, 'unknown');
  assert.doesNotMatch(summary, /варіант 2|купівля/);
  const ordinary = summarizeMediaAdvice(rows);
  for (const variantName of [() => 'https://private.example/PRIVATE', () => 'варіант 1 (PRIVATE)', () => 'варіант 1\nPRIVATE', () => { throw Error('PRIVATE'); }]) {
    assert.equal(summarizeMediaAdvice(rows, { variantName }), ordinary);
  }
});
