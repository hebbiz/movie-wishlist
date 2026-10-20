// Authored mechanisms only, never reconstruction of the owner's live responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRequest } from '../config.mjs';
import { runDiscovery, authoredDiscoveryData, classifyLink } from '../discovery.mjs';
import { describeDiscovery, supportedPointer } from '../matching.mjs';
import { buildShortReport } from '../public/discovery-report.mjs';
import { prepareDraft } from '../public/discovery-client.mjs';
import { syntheticTmdb, projectTmdbIdentity } from '../tmdb.mjs';
import { localizedMarkup, tableBlock } from './kinobaza-localization.fixture.mjs';

async function authored(mutate = () => {}) {
  const s = selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' });
  const data = authoredDiscoveryData(s.film); mutate(data);
  const result = await runDiscovery(s, { mode: 'live', tmdbToken: 'audit-offline-token', motnKey: 'audit-offline-key', fetchImpl: async (url, init) => {
    assert.equal(init.redirect, 'manual');
    if (url.includes('themoviedb')) return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
    if (url.includes('movieofthenight')) return Response.json(data.motn);
    assert.equal(url, 'https://kinobaza.com.ua/titles/coherence');
    return new Response(data.html, { headers: { 'content-type': 'text/html' } });
  } });
  result.matching = describeDiscovery(result); return result;
}
const report = r => buildShortReport({ filmId: r.film.id, mode: 'live', result: r });
const card = 'https://tv.apple.com/ua/movie/authored/umc.cmc.auditonly';

test('B missing/different cut and missing commercial access do not gate the same supported regional pointer', async () => {
  const r = await authored(), motn = r.rows.find(x => x.id === 'motn:0'), kino = r.rows.find(x => x.id.startsWith('kinobaza:'));
  motn.link = classifyLink(card, motn.provider); kino.link = classifyLink(card, kino.provider);
  r.rows = [motn, kino]; const before = JSON.stringify(r.rows);
  const m = describeDiscovery(r);
  assert.ok(m.rows.every(x => x.B.reason === 'same-supported-regional-pointer'));
  assert.ok(m.rows.every(x => x.scopeGaps.includes('version-unknown')));
  assert.equal(kino.country, 'UA'); assert.equal(kino.access.state, 'unknown');
  assert.equal(JSON.stringify(r.rows), before); // No offer merge or field propagation.
  motn.cut = { state: 'reported', value: 'authored cut one' }; kino.cut = { state: 'reported', value: 'authored cut two' };
  assert.ok(describeDiscovery(r).rows.every(x => x.B.outcome === 'compatible' && x.scopeGaps.includes('version-claims-differ-no-enrichment')));
});

test('B qualifier reasons distinguish unknown query/fragment/encoding from proved version; Apple at policy unchanged', async () => {
  const r = await authored(), row = r.rows.find(x => x.id === 'motn:0');
  for (const [href, code] of [
    [card + '?unclassified=SECRET_QUERY', 'query-key-unclassified'],
    [card + '?unclassified=1&unclassified=2', 'query-key-repeated'],
    [card + '?%FF=x', 'query-key-malformed'],
    [card + '#SECRET_FRAGMENT', 'fragment-unclassified'],
    [card.replace('/authored/', '/%2eauthored/'), 'path-encoding-unresolved'],
    [card.replace('tv.apple.com', 'tv.apple.com:443'), 'explicit-authority-unresolved'],
  ]) {
    row.link = classifyLink(href, row.provider);
    const pointer = supportedPointer(row);
    assert.equal(pointer.outcome, 'insufficient-evidence'); assert.deepEqual(pointer.detailCodes, [code]);
    assert.doesNotMatch(JSON.stringify(pointer), /SECRET_|unclassified=/);
  }
  row.link = classifyLink(card + '?at=&at=AUTHOR%2fTOKEN', row.provider);
  const href = row.link.href;
  assert.equal(supportedPointer(row).outcome, 'compatible');
  assert.equal(prepareDraft(r, row).fields.purchase_url, '');
  assert.equal(prepareDraft(r, row, true).fields.purchase_url, href); assert.equal(row.link.href, href);
  row.link = classifyLink('https://click.justwatch.com/authored', row.provider);
  assert.deepEqual(supportedPointer(row).detailCodes, ['opaque-tracking-destination-unknown']);
});

test('same card/access with two price/quality values gives only possible discrepancies, no confirmed offer conflict', async () => {
  const r = await authored(d => {
    const a = { ...d.motn.streamingOptions.ua[0], type: 'buy', link: card };
    d.motn.streamingOptions.ua = [a, { ...a, quality: 'hd', price: { amount: '9.99', currency: 'XXX' } }];
  });
  const rows = r.rows.filter(x => x.id.startsWith('motn:'));
  assert.equal(rows.length, 2); assert.ok(rows.every(x => x.conflicts.length === 0));
  assert.ok(rows.every(x => x.comparisons.length === 2 && x.comparisons.every(c => c.outcome === 'possible-discrepancy')));
  assert.deepEqual(rows.map(x => x.price.amount.value).sort(), ['1.23', '9.99']);
  assert.match(report(r), /possible-discrepancy:price:same-declared-card-offer-scope-unknown/);
  assert.doesNotMatch(report(r), /conflicts 2/);
});

test('different/unknown card or package scopes do not manufacture comparable commercial offers', async () => {
  for (const kind of ['different-card', 'missing-card', 'different-package', 'unknown-package']) {
    const r = await authored(d => {
      const a = { ...d.motn.streamingOptions.ua[0], type: 'buy', link: card };
      const b = { ...a, quality: 'hd', price: { amount: '9.99', currency: 'XXX' } };
      if (kind === 'different-card') b.link = card + 'different';
      if (kind === 'missing-card') { delete a.link; delete b.link; }
      if (kind === 'different-package') { a.addon = { id: 'one', name: 'one' }; b.addon = { id: 'two', name: 'two' }; }
      if (kind === 'unknown-package') a.addon = { id: 'one', name: 'one' };
      d.motn.streamingOptions.ua = [a, b];
    });
    const rows = r.rows.filter(x => x.id.startsWith('motn:'));
    assert.ok(rows.every(x => !x.conflicts.length && x.comparisons.every(c => c.outcome === 'non-comparable')));
    assert.match(report(r), /non-comparable/);
  }
});

test('TMDb multiline prose presence is valid without retaining content; malformed/bounds/ID gates remain', () => {
  for (const value of ['Authored first line\r\nSecond\tline', '\r\n\t ']) {
    const d = syntheticTmdb('coherence').details; d.translations.translations[0].data.overview = value;
    const r = projectTmdbIdentity(d, 'coherence');
    assert.equal(r.status, 'ok'); assert.equal(r.metadata.translations.items[0].overview.state, value.trim() ? 'reported-nonempty' : 'reported-empty');
    assert.doesNotMatch(JSON.stringify(r), /Authored first line|Second/);
  }
  for (const value of ['bad\u0000control', 'x'.repeat(100_001), {}]) {
    const d = syntheticTmdb('coherence').details; d.translations.translations[0].data.overview = value;
    assert.equal(projectTmdbIdentity(d, 'coherence').status, 'partial');
  }
  const d = syntheticTmdb('coherence').details; d.id = 1091;
  assert.equal(projectTmdbIdentity(d, 'coherence').identity.status, 'mismatch');
});

test('partial short report exports only known resource/field paths, not values; missing optional fields stay ok', async () => {
  const r = await authored(d => { delete d.tmdb.details.external_ids; d.tmdb.details.translations.translations = 'SECRET_INVALID'; });
  assert.equal(r.sources[0].diagnostics.status, 'partial');
  r.sources[0].diagnostics.fields.push({ path: 'metadata.SECRET_PATH', state: 'invalid' });
  const text = report(r);
  assert.match(text, /resource.external_ids:missing/); assert.match(text, /metadata.translations:invalid/);
  assert.doesNotMatch(text, /SECRET_|audit-offline|https?:/);
  const optional = await authored(d => { d.tmdb.details.translations = {}; });
  assert.equal(optional.sources[0].diagnostics.status, 'ok');
  assert.equal(optional.sources[0].diagnostics.resources.translations.state, 'reported');
  assert.doesNotMatch(report(optional), /TMDb A partial diagnostics/);
  r.sources[0].diagnostics.fields = []; r.sources[0].diagnostics.resources = {};
  assert.match(report(r), /partial-cause-not-in-summary/);
});

test('disabled Kinobaza is not evaluated, not failed identity; report has no invented localization', async () => {
  const r = await runDiscovery(selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'the-thing-1982' }), { fetchImpl: () => assert.fail('No source GET') });
  r.matching = describeDiscovery(r);
  assert.equal(r.matching.subjects[2].outcome, 'not-evaluated');
  const text = report(r);
  assert.match(text, /Kinobaza HTML: not evaluated — disabled by scenario/);
  assert.doesNotMatch(text, /Kinobaza HTML:.*identity unresolved/);
});

test('film-level and own-block localization are separate from offered fields; own contradictory labels remain conflicts', async () => {
  for (const conflicting of [false, true]) {
    const r = await authored(d => { d.html = localizedMarkup(tableBlock('itunes',
      [['Укр. звук', '+'], ...(conflicting ? [['Укр. звук', '-']] : []), ['Укр. субтитри', '-']], card), 'coherence', true); });
    assert.equal(r.filmLocalization.ukrainianAudio.state, 'reported-positive');
    const row = r.rows.find(x => x.kinobazaLocalization);
    assert.equal(row.audio.state, 'unknown'); assert.equal(row.accountEntitlement, 'unknown');
    const text = report(r);
    assert.match(text, /film-level localization: UA audio reported-positive; not provider tracks/);
    assert.match(text, /own provider-block.*completeness unknown; not offer enrichment/);
    if (conflicting) { assert.equal(row.conflicts[0].field, 'audio'); assert.match(text, /audio:conflicting-block-labels/); }
  }
});
