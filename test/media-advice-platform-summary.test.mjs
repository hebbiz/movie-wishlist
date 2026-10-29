// Authored server-projected rows, not live HTML or a claim about real offers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMediaRows, presentMediaGroup, presentMediaGroups, summarizeMediaGroups } from '../assets/media-advice-presentation.mjs';
import { makePreview } from '../assets/media-advice.mjs';

const filmId = 'imdb:tt1234567';
const services = {
  apple: ['itunes', 'https://itunes.apple.com/ua/movie/id123?at=&at=Authored%2fOnly#Anchor'],
  prime: ['amazon prime', 'https://www.primevideo.com/detail/AUTHORED123/ref=atv_authored_1?exact=%2f#Anchor'],
  hbo: ['HBO Max', 'https://click.justwatch.com/a?provider=hbo&exact=AUTHOR%2fONLY#Anchor'],
  netflix: ['netflix', 'https://www.netflix.com/ua/title/123456?exact=AUTHOR%2fONLY#Anchor'],
  rakuten: ['rakuten', 'https://rakuten.tv/ua/movies/authored?exact=AUTHOR%2fONLY#Anchor'],
  megogo: ['megogo', 'https://megogo.net/ua/view/123-authored.html?exact=AUTHOR%2fONLY#Anchor'],
};
const unknown = () => ({ state: 'unknown', language: 'uk', evidence: [] });
function sign(state, key = 'audio', format) {
  const label = `${key === 'audio' ? 'Укр. звук' : 'Укр. субтитри'}${format ? ` (${format})` : ''}`;
  const evidence = state === 'unknown' ? [] : (state === 'conflicting' ? ['positive', 'negative'] : [state === 'reported-positive' ? 'positive' : 'negative'])
    .map(value => ({ label, literal: value === 'positive' ? '+' : '−', state: value, ...(format ? { [key === 'audio' ? 'formatLiteral' : 'typeLiteral']: format } : {}) }));
  return { state, language: 'uk', evidence };
}
const row = (id, key, extra = {}) => ({ id, filmId, provider: { key, sourceName: services[key][0] }, identityStatus: 'matched', country: 'UA', conflicts: [], audio: unknown(), subtitles: unknown(), ...extra });
function block(key = 'rakuten', extra = {}, fields = {}) {
  const [provider, href] = services[key];
  return row('kinobaza:block-row', key, { country: null, kind: 'candidate-link', link: { href },
    provenance: { source: 'Kinobaza HTML' }, linkAudit: { blockAssociation: 'associated' },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider, href, territory: null, issues: [],
      audio: sign('reported-positive'), subtitles: sign('reported-positive', 'subtitles'), ...fields }, ...extra });
}
const view = (rows, options) => presentMediaGroups(rows, options)[0];

test('all six supported services interpret their own admitted matched block without a separate UA pointer', async t => {
  for (const key of Object.keys(services)) await t.test(key, () => {
    const original = block(key), before = JSON.stringify(original), info = view([original], { filmId });
    assert.equal(info.group.key, key); assert.equal(info.inferred, true); assert.equal(info.inferredAudio, true); assert.equal(info.inferredSubtitles, true);
    assert.deepEqual(info.kinobaza, { applied: true, audio: 'reported-positive', subtitles: 'reported-positive', basis: 'matched-provider-block-app-ua-interpretation' });
    assert.equal(info.band, 'ua-audio'); assert.equal(info.audio, 'Українське аудіо — за даними Кінобази');
    assert.equal(info.languageSummary, 'Українське аудіо та субтитри — за даними Кінобази');
    assert.equal(info.territory, 'Український регіон — за правилом застосунку');
    assert.ok(info.warnings.includes('Це правило інтерпретації, не перевірка доступності на платформі.'));
    assert.strictEqual(info.transferRow, original); assert.equal(original.country, null); assert.equal(original.audio.state, 'unknown');
    const preview = makePreview(info.transferRow, { recommended_medium: 'DVD', purchase_url: '' });
    assert.equal(preview.after.purchase_url, services[key][1]); assert.equal(preview.rowId, original.id);
    assert.equal(JSON.stringify(original), before);
    assert.match(summarizeMediaGroups([info]), /Кінобаз/);
  });
});

test('own-block association requires literal href, mapped source provider, block ID and parser association', () => {
  const original = block('apple'), source = original.kinobazaLocalization;
  for (const changed of [
    { kinobazaLocalization: { ...source, provider: 'netflix' } },
    { kinobazaLocalization: { ...source, href: source.href.replace('%2f', '%2F') } },
    { kinobazaLocalization: { ...source, blockId: 'kinobaza:block:unestablished' } },
    { kinobazaLocalization: { ...source, blockId: undefined } },
    { linkAudit: { blockAssociation: 'unresolved' } }, { linkAudit: undefined },
    { provider: { key: 'apple' } }, { id: 'motn:borrowed-block', provenance: { source: 'Movie of the Night' } },
  ]) {
    const info = view([{ ...original, ...changed }], { filmId });
    assert.equal(info.inferred, false); assert.equal(info.kinobaza.applied, false);
  }
  const normalized = view([{ ...original, kinobazaLocalization: { ...source, provider: '  ITUNES  ' } }], { filmId });
  assert.equal(normalized.kinobaza.applied, true, 'existing NFC/trim/case normalization is sufficient');
  const opaque = 'https://click.justwatch.com/a?opaque=Authored%2fOnly#Anchor';
  const wrongOpaqueBlock = { ...original, link: { href: opaque }, kinobazaLocalization: { ...source, provider: 'netflix', href: opaque } };
  assert.equal(view([wrongOpaqueBlock], { filmId }).kinobaza.applied, false, 'an admitted opaque URL cannot substitute for the original mapped provider name');
});

test('missing or unadmitted source URLs cannot establish the interpretation or be silently transferred', () => {
  for (const href of [null, '/relative', 'http://itunes.apple.com/ua/movie/id123', 'https://click.justwatch.com.evil.example/a', 'https://itunes.apple.com/search?q=authored']) {
    const original = block('apple'), changed = { ...original, link: { href }, kinobazaLocalization: { ...original.kinobazaLocalization, href } };
    const info = view([changed], { filmId }); assert.equal(info.inferred, false); assert.equal(info.kinobaza.applied, false);
    assert.equal(makePreview(info.transferRow, { recommended_medium: 'DVD', purchase_url: 'https://manual.example/' }), null);
  }
});

test('unresolved identity, conflicting provider and known foreign block observations cannot establish the policy', () => {
  for (const changed of [{ identityStatus: 'unresolved' }, { identityStatus: 'mismatch' }, { providerConflict: true }, { country: 'PL' }]) {
    const info = view([block('rakuten', changed)], { filmId });
    assert.equal(info.inferred, false); assert.equal(info.kinobaza.applied, false);
  }
  const original = block('rakuten');
  for (const fields of [{ territory: { code: 'PL' } }, { issues: { unsafe: true } }, { issues: null }]) {
    const info = view([{ ...original, kinobazaLocalization: { ...original.kinobazaLocalization, ...fields } }], { filmId });
    assert.equal(info.kinobaza.applied, false, 'a foreign block or malformed issue boundary is not interpreted');
  }
  for (const issue of ['ambiguous-provider-block', 'unsupported-provider-block', 'block-field-count-limit', 'provider-block-count-limit']) {
    const info = view([{ ...original, kinobazaLocalization: { ...original.kinobazaLocalization, issues: [issue] } }], { filmId });
    assert.equal(info.kinobaza.applied, false);
  }
});

test('wrong explicit film IDs never lend their block languages to the selected film', () => {
  const selected = row('tmdb:selected', 'rakuten'), other = block('rakuten', { filmId: 'imdb:tt7654321' });
  const before = JSON.stringify([selected, other]);
  assert.deepEqual(presentMediaGroups([selected, other]), [], 'a mixed-film result without selected context is not presented');
  const scoped = view([selected, other], { filmId }); assert.equal(scoped.kinobaza.applied, false); assert.ok(!scoped.group.rows.includes(other));
  assert.deepEqual(presentMediaGroups([other], { filmId }), []);
  const accepted = view([block('rakuten'), other], { filmId });
  assert.equal(accepted.kinobaza.applied, true); assert.equal(accepted.group.rows.length, 1);
  assert.equal(JSON.stringify([selected, other]), before);
});

test('mixed explicit film IDs across separate platforms require an explicit selected-film context', () => {
  const selected = block('apple'), foreign = block('rakuten', { filmId: 'imdb:tt7654321' });
  const rows = [selected, foreign], before = JSON.stringify(rows);
  assert.deepEqual(presentMediaGroups(rows), [], 'separate provider groups cannot hide a conflicting film context');
  const scoped = presentMediaGroups(rows, { filmId });
  assert.equal(scoped.length, 1); assert.equal(scoped[0].group.key, 'apple');
  assert.strictEqual(scoped[0].transferRow, selected); assert.equal(scoped[0].kinobaza.applied, true);
  assert.deepEqual(scoped[0].group.rows, [selected]); assert.equal(JSON.stringify(rows), before);
});

test('direct group presentation scopes evidence and transfer without falling back to a foreign primary', () => {
  const selected = row('tmdb:selected', 'rakuten');
  const foreign = block('rakuten', { filmId: 'imdb:tt7654321', country: 'UA', audio: { state: 'reported', ukrainian: [{ language: 'uk' }] } });
  const group = groupMediaRows([foreign, selected])[0], before = JSON.stringify(group);
  assert.strictEqual(group.primary, foreign, 'authored foreign row is the stronger original primary');
  const scoped = presentMediaGroup(group, { filmId });
  assert.strictEqual(scoped.transferRow, selected); assert.equal(scoped.band, 'ua');
  assert.equal(scoped.kinobaza.applied, false); assert.match(scoped.audio, /невідомо/);
  assert.strictEqual(scoped.group, group); assert.equal(JSON.stringify(group), before);

  const foreignOnly = groupMediaRows([foreign])[0];
  const empty = presentMediaGroup(foreignOnly, { filmId });
  assert.equal(empty.transferRow, undefined); assert.equal(empty.band, 'withheld');
  assert.equal(empty.kinobaza.applied, false); assert.equal(empty.inferredAudio, false);
  assert.match(empty.audio, /невідомо/); assert.strictEqual(foreignOnly.primary, foreign);

  const currentBlock = block('rakuten', { id: 'kinobaza:current-film' });
  const accepted = presentMediaGroup(groupMediaRows([foreign, currentBlock])[0], { filmId });
  assert.strictEqual(accepted.transferRow, currentBlock); assert.equal(accepted.kinobaza.applied, true);
  assert.equal(accepted.kinobaza.audio, 'reported-positive'); assert.equal(accepted.kinobaza.subtitles, 'reported-positive');
});

test('positive, negative, conflicting and missing language fields remain distinct per field', () => {
  const negativeAudio = view([block('apple', {}, { audio: sign('reported-negative') })], { filmId });
  assert.equal(negativeAudio.kinobaza.audio, 'reported-negative'); assert.equal(negativeAudio.inferredAudio, false);
  assert.equal(negativeAudio.kinobaza.subtitles, 'reported-positive'); assert.equal(negativeAudio.band, 'ua-subtitles');
  assert.equal(negativeAudio.audio, 'Українське аудіо: «−» для зазначених доріжок — за даними Кінобази');
  const conflicting = view([block('megogo', { conflicts: [{ field: 'audio', type: 'conflicting-block-labels' }] }, { audio: sign('conflicting') })], { filmId });
  assert.equal(conflicting.kinobaza.audio, 'conflicting'); assert.equal(conflicting.kinobaza.subtitles, 'reported-positive');
  assert.equal(conflicting.band, 'ua-subtitles'); assert.match(conflicting.audio, /суперечливі дані Кінобази/);
  const negativeBoth = view([block('netflix', {}, { audio: sign('reported-negative'), subtitles: sign('reported-negative', 'subtitles') })], { filmId });
  assert.equal(negativeBoth.inferred, true); assert.equal(negativeBoth.inferredAudio, false); assert.equal(negativeBoth.inferredSubtitles, false); assert.equal(negativeBoth.band, 'ua');
  assert.equal(negativeBoth.subtitles, 'Українські субтитри: позначено «−» Кінобазою');
  const subtitleOnly = view([block('hbo', {}, { audio: undefined })], { filmId });
  assert.equal(subtitleOnly.kinobaza.audio, 'unknown'); assert.equal(subtitleOnly.band, 'ua-subtitles'); assert.match(subtitleOnly.audio, /невідомо/);
  const missing = view([block('prime', {}, { audio: undefined, subtitles: unknown() })], { filmId });
  assert.equal(missing.inferred, false); assert.equal(missing.kinobaza.applied, false); assert.match(missing.audio, /невідомо/);
});

test('interpreted region without positive tracks is not attributed to source territory in the advice', () => {
  for (const fields of [
    { audio: sign('reported-negative'), subtitles: sign('reported-negative', 'subtitles') },
    { audio: sign('conflicting'), subtitles: unknown() },
  ]) {
    const original = block('rakuten', {}, fields), info = view([original], { filmId });
    assert.equal(original.country, null); assert.equal(info.inferred, true); assert.equal(info.band, 'ua');
    const summary = summarizeMediaGroups([info]);
    assert.doesNotMatch(summary, /джерело вказує Україну|є українські/);
    assert.match(summary, /правил|враховуємо|інтерпрет/);
    assert.ok(summary.split(/[.!?]+/u).filter(part => part.trim()).length <= 2);
  }
});

test('different named formats keep positive evidence without inventing a universal negative or a codec', () => {
  const formats = sign('reported-positive');
  formats.evidence = [...sign('reported-negative', 'audio', 'стерео').evidence, ...sign('reported-positive', 'audio', 'dolby').evidence];
  const original = block('apple', {}, { audio: formats, subtitles: unknown() }), before = JSON.stringify(original);
  const info = view([original], { filmId });
  assert.equal(info.kinobaza.audio, 'reported-positive'); assert.equal(info.band, 'ua-audio');
  assert.doesNotMatch(info.audio + (info.languageSummary ?? ''), /5\.1|7\.1|Atmos|Dolby Digital|всі доріжки/);
  assert.equal(JSON.stringify(original), before); assert.equal(original.kinobazaLocalization.audio.evidence[0].formatLiteral, 'стерео');
  const positive = block('rakuten', {}, { audio: sign('reported-positive', 'audio', 'dolby'), subtitles: unknown() });
  const negativeOtherFormat = block('rakuten', { id: 'kinobaza:other-format' }, { blockId: 'kinobaza:block:1', audio: sign('reported-negative', 'audio', 'стерео'), subtitles: unknown() });
  assert.equal(view([positive, negativeOtherFormat], { filmId }).kinobaza.audio, 'reported-positive');
});

test('contradictory signs for the same named field remain conflicting while the other language field can remain positive', () => {
  const positive = block('rakuten', {}, { audio: sign('reported-positive', 'audio', 'стерео') });
  const negative = block('rakuten', { id: 'kinobaza:negative' }, { blockId: 'kinobaza:block:1', audio: sign('reported-negative', 'audio', 'стерео') });
  const info = view([positive, negative], { filmId });
  assert.equal(info.kinobaza.audio, 'conflicting'); assert.equal(info.kinobaza.subtitles, 'reported-positive');
  assert.equal(info.inferredAudio, false); assert.equal(info.inferredSubtitles, true); assert.equal(info.band, 'ua-subtitles');
});

test('opposite same-format signs across two aggregate-positive blocks remain conflicting', () => {
  const firstAudio = sign('reported-positive', 'audio', 'стерео');
  firstAudio.evidence.push(...sign('reported-negative', 'audio', 'dolby').evidence);
  const secondAudio = sign('reported-positive', 'audio', 'dolby');
  secondAudio.evidence.push(...sign('reported-negative', 'audio', 'стерео').evidence);
  const first = block('apple', {}, { audio: firstAudio, subtitles: unknown() });
  const second = block('apple', { id: 'kinobaza:opposite-formats' }, { blockId: 'kinobaza:block:1', audio: secondAudio, subtitles: unknown() });
  const rows = [first, second], before = JSON.stringify(rows), info = view(rows, { filmId });
  assert.equal(first.kinobazaLocalization.audio.state, 'reported-positive');
  assert.equal(second.kinobazaLocalization.audio.state, 'reported-positive');
  assert.equal(info.kinobaza.audio, 'conflicting'); assert.equal(info.kinobaza.subtitles, 'unknown');
  assert.equal(info.inferredAudio, false); assert.equal(info.band, 'ua');
  assert.match(info.audio, /суперечливі дані Кінобази/); assert.equal(info.languageSummary, null);
  assert.equal(JSON.stringify(rows), before); assert.ok(info.group.rows.every(original => rows.includes(original)));
});

test('normal UA offer audio retains stronger evidence and does not acquire Kinobaza tracks or another source URL', () => {
  const direct = row('motn:direct', 'rakuten', { audio: { state: 'reported', ukrainian: [{ language: 'uk' }] }, link: { href: services.rakuten[1] } });
  const kino = block('rakuten', {}, { audio: unknown() }), before = JSON.stringify([direct, kino]);
  const info = view([direct, kino], { filmId });
  assert.equal(info.band, 'ua-audio'); assert.equal(info.kinobaza.audio, 'unknown'); assert.equal(info.kinobaza.subtitles, 'reported-positive');
  assert.doesNotMatch(summarizeMediaGroups([info]), /Кінобаза.*аудіо/);
  assert.ok([direct, kino].includes(info.transferRow)); assert.equal(JSON.stringify([direct, kino]), before);
});

test('comparison categories precede service preference while equal service preferences retain source order', () => {
  const direct = (key, language, suffix = '') => row(`motn:${key}${suffix}`, key, {
    audio: language === 'audio' ? { state: 'reported', ukrainian: [{ language: 'uk' }] } : unknown(),
    subtitles: language === 'subtitles' ? { state: 'reported', ukrainian: [{ language: 'uk' }] } : unknown(),
  });
  const languageFirst = presentMediaGroups([direct('apple'), direct('rakuten', 'subtitles'), direct('megogo', 'audio')], { filmId });
  assert.deepEqual(languageFirst.map(info => info.group.key), ['megogo', 'rakuten', 'apple']);
  assert.match(summarizeMediaGroups(languageFirst), /MEGOGO.*українське аудіо/);

  for (const language of ['audio', 'subtitles', undefined]) {
    const input = ['megogo', 'prime', 'hbo', 'netflix', 'rakuten', 'apple'].map(key => direct(key, language));
    const before = JSON.stringify(input);
    const groups = presentMediaGroups(input, { filmId });
    assert.deepEqual(groups.map(info => info.group.key), ['apple', 'rakuten', 'prime', 'hbo', 'netflix', 'megogo']);
    assert.equal(JSON.stringify(input), before);
    assert.ok(groups.every(info => input.includes(info.transferRow)), 'display preference never creates a synthetic transfer row');
    assert.match(summarizeMediaGroups(groups), /Apple TV/);
  }
  const tied = ['netflix', 'prime', 'hbo'].map(key => direct(key, 'audio'));
  assert.deepEqual(presentMediaGroups(tied, { filmId }).map(info => info.group.key), ['netflix', 'prime', 'hbo']);
});

test('a linked Kinobaza block is partial availability, never independent UA availability, even with missing tracks', () => {
  const kino = block('apple', {}, { audio: undefined, subtitles: unknown() }), before = JSON.stringify(kino);
  const partial = view([kino], { filmId });
  assert.equal(partial.comparison.availability.state, 'partial'); assert.equal(partial.comparison.availability.symbol, '◐');
  assert.match(partial.comparison.availability.label, /правилом застосунку.*доступність не перевірено/);
  assert.equal(partial.comparison.audio.state, 'unknown'); assert.equal(partial.comparison.audio.symbol, '?');
  assert.equal(partial.comparison.subtitles.state, 'unknown'); assert.equal(partial.comparison.subtitles.symbol, '?');
  assert.doesNotMatch(partial.comparison.audio.label, /джерело явно позначає відсутність/);
  assert.equal(JSON.stringify(kino), before);

  const direct = row('tmdb:ua', 'apple');
  const stronger = view([kino, direct], { filmId });
  assert.equal(stronger.comparison.availability.state, 'reported'); assert.equal(stronger.comparison.availability.symbol, '●');
  assert.doesNotMatch(stronger.comparison.availability.label, /Кінобаз/);
  assert.equal(stronger.comparison.audio.state, 'unknown', 'separate UA provider entry cannot invent a missing language');
  assert.equal(kino.country, null);
});

test('comparison languages preserve positive, explicitly negative, missing, conflicting and named-format-only states', () => {
  const positive = view([block('rakuten')], { filmId });
  for (const key of ['audio', 'subtitles']) {
    assert.equal(positive.comparison[key].state, 'reported'); assert.equal(positive.comparison[key].symbol, '+');
    assert.match(positive.comparison[key].label, /Кінобази/); assert.deepEqual(positive.comparison[key].sources, ['kinobaza-block']);
  }
  const negative = view([block('apple', {}, { audio: sign('reported-negative'), subtitles: sign('reported-negative', 'subtitles') })], { filmId });
  for (const key of ['audio', 'subtitles']) {
    assert.equal(negative.comparison[key].state, 'negative'); assert.equal(negative.comparison[key].symbol, '−');
    assert.match(negative.comparison[key].label, /у зазначеному записі.*не висновок про всі пропозиції/);
  }
  const formatNegative = view([block('apple', {}, { audio: sign('reported-negative', 'audio', 'dolby'), subtitles: undefined })], { filmId });
  assert.equal(formatNegative.comparison.audio.state, 'format-negative'); assert.equal(formatNegative.comparison.audio.symbol, '?');
  assert.match(formatNegative.comparison.audio.label, /формати.*інших українських доріжок невідома/);
  assert.equal(formatNegative.comparison.subtitles.state, 'unknown');
  const conflict = view([block('megogo', {}, { audio: sign('conflicting'), subtitles: unknown() })], { filmId });
  assert.equal(conflict.comparison.audio.state, 'conflicting'); assert.equal(conflict.comparison.audio.symbol, '±');
  assert.equal(conflict.comparison.subtitles.state, 'unknown'); assert.equal(conflict.band, 'ua');
  assert.match(conflict.comparison.audio.label, /не означає відсутність/);
});

test('independent positive tracks remain visible beside negative Kinobaza records without claiming offer equivalence', () => {
  const direct = row('motn:ua-positive', 'rakuten', { audio: { state: 'reported', ukrainian: [{ language: 'uk' }] }, link: { href: services.rakuten[1] } });
  const kino = block('rakuten', {}, { audio: sign('reported-negative'), subtitles: unknown() });
  const before = JSON.stringify([direct, kino]), info = view([direct, kino], { filmId });
  assert.equal(info.band, 'ua-audio', 'a known positive original variant remains in the audio category');
  assert.equal(info.comparison.audio.state, 'mixed'); assert.equal(info.comparison.audio.symbol, '±');
  assert.match(info.comparison.audio.label, /одному записі.*різні пропозиції/);
  assert.deepEqual(info.comparison.audio.sources, ['ua-row', 'kinobaza-block']);
  const summary = summarizeMediaGroups([info]);
  assert.match(summary, /один із записів повідомляє українське аудіо.*інші дані.*різняться/);
  assert.doesNotMatch(summary, /Кінобаз.*є українські/);
  assert.ok([direct, kino].includes(info.transferRow)); assert.equal(JSON.stringify([direct, kino]), before);
});

test('separate UA presence cannot lend country to foreign tracks or promote unsafe or refused Kinobaza blocks', () => {
  const ua = row('tmdb:ua-only', 'apple');
  for (const country of [null, 'PL']) {
    const foreign = row('motn:other-country', 'apple', { country, audio: { state: 'reported', ukrainian: [{ language: 'uk' }] } });
    const info = view([ua, foreign], { filmId });
    assert.equal(info.comparison.availability.state, 'reported'); assert.equal(info.comparison.audio.state, 'unknown');
    assert.equal(info.band, 'ua');
  }
  for (const mutation of [
    { identityStatus: 'unresolved' }, { identityStatus: 'mismatch' }, { providerConflict: true },
    { link: { href: 'javascript:alert(1)' } }, { link: { href: null } },
    { kinobazaLocalization: { ...block('apple').kinobazaLocalization, provider: 'netflix' } },
  ]) {
    const changed = { ...block('apple'), ...mutation }, info = view([changed], { filmId });
    assert.equal(info.comparison.availability.state, 'unknown');
    assert.equal(info.comparison.audio.state, 'unknown'); assert.equal(info.comparison.subtitles.state, 'unknown');
  }
  const foreignOnly = view([row('motn:foreign-only', 'apple', { country: 'PL' })], { filmId });
  assert.equal(foreignOnly.comparison.availability.state, 'foreign'); assert.equal(foreignOnly.comparison.availability.symbol, '◇');
  assert.match(foreignOnly.comparison.availability.label, /Україні невідома/);
});

test('an unbound matched localization field retains its scope-qualified conflict warning without promoting tracks or region', () => {
  const unbound = row('kinobaza:unbound-conflict', 'apple', {
    country: null, kind: 'candidate-link', link: { href: services.apple[1] }, provenance: { source: 'Kinobaza HTML' },
    kinobazaLocalization: { audio: { state: 'reported-positive' }, subtitles: { state: 'reported-negative' } },
    conflicts: [{ field: 'audio', type: 'conflicting-block-labels' }],
  });
  const before = JSON.stringify(unbound), info = view([unbound], { filmId });
  assert.equal(info.comparison.audio.state, 'conflicting'); assert.equal(info.comparison.audio.symbol, '±');
  assert.match(info.comparison.audio.label, /суперечливі дані з невстановленою країною або областю/);
  assert.deepEqual(info.comparison.audio.sources, ['unknown-scope']);
  assert.equal(info.comparison.subtitles.state, 'unknown'); assert.equal(info.comparison.subtitles.symbol, '?');
  assert.equal(info.comparison.availability.state, 'unknown'); assert.equal(info.band, 'withheld');
  assert.equal(info.kinobaza.applied, false); assert.equal(JSON.stringify(unbound), before);
  const uaOnly = row('tmdb:separate-ua', 'apple');
  const grouped = view([uaOnly, unbound], { filmId });
  assert.equal(grouped.comparison.availability.state, 'reported'); assert.equal(grouped.band, 'ua');
  assert.equal(grouped.comparison.audio.state, 'conflicting', 'separate UA entry does not establish the unbound language field');
  for (const extra of [{ identityStatus: 'unresolved' }, { identityStatus: 'mismatch' }, { providerConflict: true }, { country: 'PL' }]) {
    const excluded = view([{ ...unbound, ...extra }], { filmId });
    assert.equal(excluded.comparison.audio.state, 'unknown');
  }
});
