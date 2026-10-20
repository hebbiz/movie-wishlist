import test from 'node:test';
import assert from 'node:assert/strict';
import { viewingSummary, viewingLocalization, viewingWarnings, viewingLink, viewingAccess, viewingSourceState, groupProviderRows, prepareDraft } from '../public/discovery-client.mjs';
import { MYKOLA_STATES, mykolaFixture } from './mykola.fixture.mjs';

for (const kind of MYKOLA_STATES) test(`Mykola authored ${kind}: short deterministic view without mutation, joins or new requests`, async () => {
  const { result, calls } = await mykolaFixture(kind), before = JSON.stringify(result), count = calls.length;
  const summary = viewingSummary(result); assert.equal(summary.length, 2);
  assert.equal(summary.join(' ').split(/[.!?]+/u).filter(x => x.trim()).length, 2);
  assert.doesNotMatch(summary.join(' '), /найкращ|verified|working|compatible|entitlement|benchmark/i);
  for (const row of result.rows) {
    assert.equal(typeof viewingAccess(row.access), 'string');
    assert.equal(viewingLocalization(row).length, 2); viewingWarnings(row); viewingLink(row.link);
    assert.ok(groupProviderRows(result.rows).groups.some(g => g.rows.includes(row)));
  }
  assert.equal(JSON.stringify(result), before); assert.equal(calls.length, count);
  if (kind === 'partial-source') {
    assert.match(summary[1], /неповні/); assert.ok(result.rows.some(r => r.id.startsWith('motn:')));
    assert.match(viewingSourceState(result.sources[0]), /недоступні/);
  }
  if (kind === 'candidates-only') {
    assert.ok(result.rows.every(r => r.kind === 'candidate-link'));
    assert.ok(result.rows.every(r => viewingLocalization(r).every(s => s.includes('невідомо'))));
  }
});
test('unbound localization stays source-labelled, independent of B, with exact affiliate URL and unchanged draft exclusions', async () => {
  const { result } = await mykolaFixture('unbound-localization');
  const kino = result.rows.find(r => r.kinobazaLocalization), motn = result.rows.find(r => r.id.startsWith('motn:'));
  assert.match(viewingLocalization(kino)[0], /Кінобаза вказує українське аудіо; для цієї пропозиції ще не перевірено/);
  assert.match(viewingLocalization(kino)[1], /«−» у цьому блоці, не висновок про всі/);
  assert.equal(kino.country, null); assert.equal(motn.kinobazaLocalization, undefined);
  assert.notEqual(result.matching.rows.find(r => r.rowId === kino.id).B.outcome, 'compatible');
  assert.equal(prepareDraft(result, kino).fields.purchase_url, '');
  assert.equal(prepareDraft(result, kino, true).fields.purchase_url, 'https://itunes.apple.com/ua/movie/id999999?at=AUTHORED%2fTOKEN&l=uk');
  assert.deepEqual(Object.keys(prepareDraft(result, motn).fields), ['imdb_url', 'title', 'year', 'recommended_medium', 'purchase_url', 'status']);
  assert.match(prepareDraft(result, motn).sidecar.excluded[0], /Price.*audio.*subtitles.*video/);
});
test('scoped conflict, possible discrepancy, non-comparable and literal price/video stay distinct', async () => {
  const { result } = await mykolaFixture('conflicting-properties');
  const kino = result.rows.find(r => r.kinobazaLocalization), motn = result.rows.filter(r => r.id.startsWith('motn:'));
  assert.match(viewingLocalization(kino)[0], /позначки.*суперечливі/);
  assert.ok(motn.every(r => !r.conflicts.length && viewingWarnings(r).join(' ').includes('можлива розбіжність')));
  assert.deepEqual(motn.map(r => r.price.currency.value).sort(), ['UAH', 'USD']);
  assert.deepEqual(motn.map(r => r.quality.value).sort(), ['hd', 'uhd']);
  assert.match(viewingWarnings({ comparisons: [{ outcome: 'non-comparable' }] }).join(' '), /не можна прямо порівнювати/);
});
test('unknown language lists, disabled source, unknown mappings and unsafe links never become negative/verified claims', () => {
  assert.match(viewingSourceState({ status: 'disabled-no-request' }), /вимкнено/);
  assert.ok(viewingLocalization({ id: 'motn:0', audio: { ukrainian: [] } }).every(x => x.includes('невідомо')));
  assert.match(viewingSummary({ rows: [], sources: [] })[1], /не означає.*недоступний/);
  assert.match(viewingLink({ kind: 'unsafe' }), /Небезпечну/);
  assert.match(viewingLink({ kind: 'missing' }), /не надало/);
  assert.match(viewingLink({ kind: 'search' }), /пошукове/);
  assert.equal(groupProviderRows([{ provider: { key: 'apple', name: 'Apple TV+' } }]).groups.length, 0);
});
