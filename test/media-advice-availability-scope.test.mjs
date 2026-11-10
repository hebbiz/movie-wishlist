// Authored source projections: no live source, platform or database requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMediaRows, presentMediaGroup, presentMediaGroups, summarizeMediaGroups } from '../assets/media-advice-presentation.mjs';
import { makePreview, transferFor } from '../assets/media-advice.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';

const filmId = 'imdb:tt1905041';
const services = {
  apple: ['itunes', 'https://itunes.apple.com/ua/movie/id123456?at=AUTHORED%2fExact#Original'],
  appletvplus: ['Apple TV+', 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored?at=AUTHORED%2fExact#Original'],
  rakuten: ['rakuten', 'https://rakuten.tv/ua/movies/authored?at=AUTHORED%2fExact#Original'],
  netflix: ['netflix', 'https://www.netflix.com/ua/title/123456?at=AUTHORED%2fExact#Original'],
  hbo: ['HBO Max', 'https://click.justwatch.com/a?provider=hbo&at=AUTHORED%2fExact#Original'],
  prime: ['amazon prime', 'https://www.primevideo.com/detail/AUTHORED123?at=AUTHORED%2fExact#Original'],
  megogo: ['megogo', 'https://megogo.net/ua/view/123-authored.html?at=AUTHORED%2fExact#Original'],
};
const unknown = () => ({ state: 'unknown' });
const positive = () => ({ state: 'reported', ukrainian: [{ language: 'uk' }] });
function row(id, key = 'apple', extra = {}) {
  return { id, filmId, provider: { key, sourceName: services[key][0] }, identityStatus: 'matched', country: 'UA',
    access: { state: 'reported', value: key === 'appletvplus' ? 'subscription' : 'rental' },
    availability: { state: 'source-reported', value: 'available' }, audio: unknown(), subtitles: unknown(),
    conflicts: [], link: { href: services[key][1] }, ...extra };
}
function selectedPointer(key = 'apple', extra = {}) {
  return row('kinobaza:selected', key, { country: null, access: unknown(), availability: unknown(),
    provenance: { source: 'Kinobaza HTML', upstream: 'not-established' },
    territoryBasis: 'Outside territory section', ...extra });
}
function regional(key = 'apple', extra = {}) {
  const [provider, href] = services[key];
  return row('kinobaza:regional', key, { kind: 'candidate-link', availability: unknown(),
    provenance: { source: 'Kinobaza HTML', upstream: 'JustWatch section (shared with TMDb)' },
    territoryBasis: 'Explicit Ukrainian section; not entitlement',
    countrySignal: { state: 'source-section-claim', value: 'available', provider, href, territory: { code: 'UA' } },
    ...extra });
}
function caption(key = 'apple', extra = {}) {
  const [provider, href] = services[key];
  return selectedPointer(key, { linkAudit: { blockAssociation: 'associated' },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider, href, territory: null, issues: [],
      audio: { state: 'unknown', evidence: [] },
      subtitles: { state: 'reported-positive', language: 'uk', evidence: [{ label: 'укр. субтитри', literal: '+', state: 'positive' }] } },
    ...extra });
}
const appleGroup = rows => groupMediaRows(rows).find(group => group.key === 'apple');
const viewSelected = (rows, selectedRow, options = { filmId }) => presentMediaGroup(appleGroup(rows), { ...options, selectedRow });

test('Fast 6 control: preferred unknown-country Apple pointer retains independent same-product UA availability only', () => {
  const selected = selectedPointer();
  const rental = row('tmdb:rental', 'apple', { link: { href: null }, audio: positive() });
  const purchase = row('motn:purchase', 'apple', { access: { state: 'reported', value: 'buy' }, subtitles: positive() });
  const rows = [selected, rental, purchase], before = JSON.stringify(rows);
  for (const peerRows of [[selected, rental], [selected, purchase], rows]) {
    const info = viewSelected(peerRows, selected);
    assert.equal(info.comparison.availability.symbol, '●');
    assert.match(info.comparison.availability.label, /джерел|Джерел/);
    assert.match(info.comparison.availability.label, /не підтверджує обрану пропозицію/);
    assert.match(info.comparison.availability.label, /фактичну доступність не перевірено/);
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
    assert.equal(info.transferRow, selected); assert.equal(info.access, 'Тип доступу невідомий');
    const preview = makePreview(info.transferRow, { recommended_medium: 'DVD', purchase_url: '' });
    assert.equal(preview.after.purchase_url, selected.link.href);
    assert.equal(preview.after.recommended_medium, 'Apple TV / iTunes');
    assert.equal(transferFor(info.transferRow).url, selected.link.href);
  }
  assert.equal(JSON.stringify(rows), before, 'service availability does not mutate or join source offer fields');
});

test('Apple availability is invariant to navigation within the same product while languages and conditions remain selected-row scoped', () => {
  const selected = caption();
  const rental = row('motn:rental', 'apple', { audio: positive() });
  const purchase = row('motn:purchase', 'apple', { access: { state: 'reported', value: 'buy' }, subtitles: positive() });
  const rows = [selected, rental, purchase], before = JSON.stringify(rows);
  for (const chosen of rows) {
    const info = viewSelected(rows, chosen);
    assert.equal(info.comparison.availability.symbol, '●');
    assert.equal(info.transferRow, chosen);
    assert.equal(makePreview(info.transferRow, { recommended_medium: 'DVD', purchase_url: '' }).after.purchase_url, chosen.link.href);
    if (chosen === selected) {
      assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '+']);
      assert.equal(info.access, 'Тип доступу невідомий');
    } else if (chosen === rental) {
      assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['+', '?']);
      assert.equal(info.access, 'Оренда');
    } else {
      assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '+']);
      assert.equal(info.access, 'Купівля');
    }
  }
  assert.equal(JSON.stringify(rows), before);
});

test('the first answer agrees with same-product UA service availability without changing the selected evidence band', () => {
  const selected = selectedPointer(), peer = row('tmdb:ua-rental'), rows = [selected, peer];
  const before = JSON.stringify(rows), info = viewSelected(rows, selected), answer = summarizeMediaGroups([info]);
  assert.equal(info.band, 'supplemental', 'service availability does not promote selected languages or change ranking');
  assert.equal(info.comparison.availability.symbol, '●');
  assert.match(answer, /джерело.*Україн/iu);
  assert.match(answer, /обран.*(?:пропозиц|посилан)|умови обраного/iu);
  assert.doesNotMatch(answer, /доступність в Україні поки не встановлена/);
  assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
  assert.equal(info.transferRow, selected); assert.equal(JSON.stringify(rows), before);

  for (const unrelated of [[], [row('motn:plus-only', 'appletvplus')], [row('tmdb:other-film', 'apple', { filmId: 'imdb:tt21103218' })]]) {
    const unknown = viewSelected([selected, ...unrelated], selected);
    assert.equal(unknown.comparison.availability.symbol, '?');
    assert.equal(unknown.band, 'supplemental');
    assert.match(summarizeMediaGroups([unknown]), /доступність в Україні поки не встановлена/);
  }
});

test('Store and Plus cannot lend availability or tracks to each other, even with an identical exact URL', () => {
  for (const [selectedKey, peerKey] of [['apple', 'appletvplus'], ['appletvplus', 'apple']]) {
    const selected = selectedPointer(selectedKey);
    const otherProduct = row('motn:other-product', peerKey, { link: selected.link, audio: positive(), subtitles: positive() });
    const rows = [selected, otherProduct], before = JSON.stringify(rows);
    const info = viewSelected(rows, selected);
    assert.equal(info.comparison.availability.symbol, '?');
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
    assert.equal(info.transferRow, selected); assert.equal(JSON.stringify(rows), before);
  }
});

test('validated explicit Kinobaza UA observations supply source availability by the same rule for every supported product', async t => {
  for (const key of Object.keys(services)) await t.test(key, () => {
    const source = regional(key), before = JSON.stringify(source);
    const info = presentMediaGroups([source], { filmId })[0];
    assert.equal(info.comparison.availability.symbol, '●');
    assert.match(info.comparison.availability.label, /не підтверджує обрану пропозицію/);
    assert.match(info.comparison.availability.label, /фактичну доступність не перевірено/);
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
    assert.equal(JSON.stringify(source), before);
  });
});

test('explicit UA availability accepts only a complete consistent country-signal envelope, not a country flag or similar text', async t => {
  const mutations = {
    'missing signal': source => { delete source.countrySignal; },
    'missing state': source => { delete source.countrySignal.state; },
    'unknown state': source => { source.countrySignal.state = 'unknown'; },
    'foreign signal territory': source => { source.countrySignal.territory.code = 'PL'; },
    'unknown signal territory': source => { source.countrySignal.territory = null; },
    'other href': source => { source.countrySignal.href += '&different=AUTHORED'; },
    'missing href': source => { delete source.countrySignal.href; },
    'other provider': source => { source.countrySignal.provider = 'netflix'; },
    'missing provider': source => { delete source.countrySignal.provider; },
    'wrong source': source => { source.provenance.source = 'Unknown source'; },
    'wrong upstream': source => { source.provenance.upstream = 'not-established'; },
    'unknown section basis': source => { source.territoryBasis = 'Outside territory section'; },
    'missing section basis': source => { delete source.territoryBasis; },
    'unknown source country': source => { source.country = null; },
    'foreign source country': source => { source.country = 'PL'; },
    'unresolved identity': source => { source.identityStatus = 'unresolved'; },
    'mismatched identity': source => { source.identityStatus = 'mismatch'; },
    'provider conflict': source => { source.providerConflict = true; },
  };
  for (const [name, change] of Object.entries(mutations)) await t.test(name, () => {
    const source = regional('rakuten'); change(source);
    const before = JSON.stringify(source), info = presentMediaGroups([source], { filmId })[0];
    assert.notEqual(info.comparison.availability.symbol, '●', name);
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
    assert.equal(JSON.stringify(source), before);
  });
  const normalized = regional('rakuten'); normalized.countrySignal.provider = '  RAKUTEN  ';
  assert.equal(presentMediaGroups([normalized], { filmId })[0].comparison.availability.symbol, '●');
});

test('ordinary Beta and authorized diagnostic projections retain the same explicit UA availability without privileged signal values', () => {
  const selected = caption(), ua = regional(), rows = [selected, ua], before = JSON.stringify(rows);
  const product = productMediaResult({ film: { id: filmId }, rows, unmapped: [] },
    { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  assert.equal(product.rows[1].countrySignal.value, undefined, 'ordinary product projection intentionally withholds optional diagnostic fields');
  for (const projected of [rows, product.rows]) {
    const chosen = projected.find(source => source.id === selected.id), info = viewSelected(projected, chosen);
    assert.equal(info.comparison.availability.symbol, '●');
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '+']);
    assert.equal(info.transferRow, chosen); assert.equal(info.transferRow.link.href, selected.link.href);
  }
  assert.equal(JSON.stringify(rows), before);
});

test('a selected Apple pointer can use its own-product validated UA Kinobaza section without borrowing caption tracks', () => {
  for (const key of ['apple', 'appletvplus']) {
    const selected = selectedPointer(key), countryRow = regional(key), before = JSON.stringify([selected, countryRow]);
    const info = viewSelected([selected, countryRow], selected);
    assert.equal(info.comparison.availability.symbol, '●');
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
    assert.equal(info.transferRow, selected); assert.equal(info.access, 'Тип доступу невідомий');
    assert.equal(JSON.stringify([selected, countryRow]), before);
  }
});

test('a top provider caption remains partial by application interpretation, not independent UA availability', () => {
  for (const key of Object.keys(services)) {
    const top = caption(key), before = JSON.stringify(top), info = presentMediaGroups([top], { filmId })[0];
    assert.equal(info.comparison.availability.symbol, '◐');
    assert.match(info.comparison.availability.label, /правилом застосунку/);
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '+']);
    assert.equal(JSON.stringify(top), before);
    const forgedCountry = { ...top, country: 'UA' };
    assert.notEqual(presentMediaGroups([forgedCountry], { filmId })[0].comparison.availability.symbol, '●');
  }
});

test('wrong-film or invalid peer rows cannot supply Apple service availability', () => {
  const selected = selectedPointer();
  for (const extra of [
    { filmId: 'imdb:tt21103218' }, { identityStatus: 'unresolved' }, { identityStatus: 'mismatch' },
    { providerConflict: true }, { provider: { key: 'unmapped', sourceName: 'Apple TV Store' } },
  ]) {
    const peer = row('tmdb:invalid-peer', 'apple', extra), rows = [selected, peer], before = JSON.stringify(rows);
    const info = viewSelected(rows, selected);
    assert.equal(info.comparison.availability.symbol, '?');
    assert.equal(info.transferRow, selected); assert.equal(JSON.stringify(rows), before);
  }
});

test('unknown or mixed film context cannot establish peer availability without a selected-film scope', () => {
  const unknown = selectedPointer(), peer = row('tmdb:ua');
  delete unknown.filmId; delete peer.filmId;
  assert.equal(viewSelected([unknown, peer], unknown, {}).comparison.availability.symbol, '?');
  const selected = selectedPointer(), otherFilm = row('tmdb:other-film', 'apple', { filmId: 'imdb:tt21103218' });
  assert.equal(viewSelected([selected, otherFilm], selected, {}).comparison.availability.symbol, '?');
  assert.deepEqual(presentMediaGroups([selected, otherFilm]), []);
  assert.equal(viewSelected([selected, row('tmdb:known-film')], selected, {}).comparison.availability.symbol, '●');
});

test('invalid and out-of-group selected rows cannot borrow an eligible peer source claim', () => {
  const selected = selectedPointer(), good = row('motn:ua'), group = appleGroup([selected, good]);
  for (const invalid of [selectedPointer(), { ...selected, identityStatus: 'unresolved' },
    { ...selected, identityStatus: 'mismatch' }, { ...selected, providerConflict: true }]) {
    // For invalid identity/provider cases, also cover the defensive in-group API.
    const invalidGroup = invalid.identityStatus === 'matched' && !invalid.providerConflict ? group : { ...group, rows: [...group.rows, invalid] };
    assert.equal(presentMediaGroup(invalidGroup, { filmId, selectedRow: invalid }).comparison.availability.symbol, '?');
  }
});

test('foreign-only same-product observations remain foreign and cannot gain UA from the other Apple product', () => {
  const selected = row('motn:foreign', 'apple', { country: 'PL' });
  const plusUA = row('motn:plus-ua', 'appletvplus');
  const before = JSON.stringify([selected, plusUA]), info = viewSelected([selected, plusUA], selected);
  assert.equal(info.comparison.availability.symbol, '◇');
  assert.match(info.comparison.availability.label, /Україні невідома/);
  assert.equal(info.transferRow, selected); assert.equal(JSON.stringify([selected, plusUA]), before);
});

test('explicit availability, country or identity conflicts cannot promote a peer UA claim, while unrelated language or price fields stay independent', () => {
  const selected = selectedPointer();
  for (const extra of [
    { availability: { state: 'conflicting' } }, { availability: { state: 'reported-negative' } },
    ...['availability', 'country', 'territory', 'provider', 'identity'].map(field => ({ conflicts: [{ field, type: 'authored-scope-conflict' }] })),
  ]) {
    const peer = row('motn:conflicted', 'apple', extra), rows = [selected, peer], before = JSON.stringify(rows);
    assert.notEqual(viewSelected(rows, selected).comparison.availability.symbol, '●');
    assert.equal(JSON.stringify(rows), before);
  }
  for (const field of ['audio', 'subtitles', 'price']) {
    const peer = row('motn:unrelated-conflict', 'apple', { conflicts: [{ field, type: 'authored-independent-field' }] });
    const info = viewSelected([selected, peer], selected);
    assert.equal(info.comparison.availability.symbol, '●');
    assert.deepEqual([info.comparison.audio.symbol, info.comparison.subtitles.symbol], ['?', '?']);
  }
});
