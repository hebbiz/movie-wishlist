import test from 'node:test';
import assert from 'node:assert/strict';
import { FILMS, selectRequest } from '../config.mjs';
import { runDiscovery, composeDiscovery } from '../discovery.mjs';
import { extractHtml } from '../html-source.mjs';
import { linkPresentation, groupProviderRows, providerSummary, prepareDraft } from '../public/discovery-client.mjs';
import { localizedMarkup, paragraphBlock } from './kinobaza-localization.fixture.mjs';

const config = selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' });
async function projected(markup) {
  const base = await runDiscovery(config, { fetchImpl: () => assert.fail('No network') });
  base.stages.kinobaza.result = await extractHtml(markup, FILMS.coherence);
  return composeDiscovery(FILMS.coherence, base.stages, { synthetic: true, metrics: base.metrics });
}

test('regression: unsafe extracted href stays unsafe after sanitization, never becomes source-not-reported', async () => {
  for (const href of ['javascript:alert(1)', 'https://user:password@example.com/fictional']) {
    const result = await projected(localizedMarkup(paragraphBlock('megogo', '(укр. аудіо)', href)));
    const candidate = result.stages.kinobaza.result.candidates.find(c => c.provider === 'megogo');
    assert.equal(candidate.href, null); assert.match(candidate.issue, /unsafe/);
    const row = result.rows.find(r => r.kinobazaLocalization);
    assert.equal(row.link.kind, 'unsafe'); assert.equal(row.link.transferable, false);
    assert.equal(row.linkAudit.extraction.hrefValue, 'reported-but-withheld');
    assert.equal(row.linkAudit.blockAssociation, 'associated');
    assert.equal(prepareDraft(result, row).fields.purchase_url, '');
    assert.match(linkPresentation(row.link).summary, /unsafe/);
    assert.doesNotMatch(JSON.stringify(row), /user:password|javascript:alert/);
  }
});

test('authored Prime/iTunes/MEGOGO link audit: exact source href survives mapping/association; unsupported shape is not missing', async () => {
  const cases = [
    ['amazon prime', 'prime', 'https://www.primevideo.com/detail/SYNTHETIC000', 'exact-card-unverified'],
    ['amazon prime', 'prime', 'https://www.primevideo.com/unsupported/fictional', 'unknown'],
    ['itunes', 'apple', 'https://tv.apple.com/ua/movie/fictional/umc.cmc.fictional000', 'exact-card-unverified'],
    ['itunes', 'apple', 'https://itunes.apple.com/ua/movie/fictional/id999999', 'unknown'],
    ['megogo', 'megogo', 'https://megogo.net/ua/view/999999-fictional.html?ref=%2F&amp;x=1', 'exact-card-unverified'],
    ['megogo', 'megogo', 'https://megogo.net/fictional-card', 'unknown'],
  ];
  for (const [provider, key, href, kind] of cases) {
    const result = await projected(localizedMarkup(paragraphBlock(provider, '(укр. аудіо)', href)));
    const row = result.rows.find(r => r.kinobazaLocalization && r.provider.key === key);
    assert.equal(row.link.href, href.replace('&amp;', '&')); assert.equal(row.rawHref, href);
    assert.equal(row.link.kind, kind); assert.equal(row.linkAudit.extraction.hrefValue, 'reported');
    assert.equal(row.linkAudit.providerMapping, 'mapped'); assert.equal(row.linkAudit.blockAssociation, 'associated');
    assert.equal(row.country, null); assert.equal(row.access.state, 'unknown');
    const draft = prepareDraft(result, row);
    assert.equal(draft.fields.purchase_url, kind === 'unknown' ? '' : row.link.href);
    assert.equal(draft.sidecar.rowId, row.id); assert.equal(draft.fields.audio, undefined);
    if (kind === 'unknown') { assert.match(linkPresentation(row.link).summary, /unsupported kind/); assert.equal(linkPresentation(row.link).canOpen, false); }
  }
});

test('missing href, unsupported label, unresolved mapping and unassociated block are distinct audit outcomes', async () => {
  const missing = await projected(localizedMarkup(paragraphBlock('megogo', '(укр. аудіо)', '')));
  const row = missing.rows.find(r => r.kinobazaLocalization);
  assert.equal(row.linkAudit.extraction.issue, 'missing-href'); assert.equal(row.link.kind, 'missing');
  assert.equal(row.linkAudit.extraction.hrefValue, 'not-reported-or-empty');
  const unsupported = await projected(localizedMarkup(paragraphBlock('unrecognized badge')));
  assert.equal(unsupported.stages.kinobaza.result.localization.blocks.length, 0);
  const mapping = await projected(localizedMarkup().replaceAll('Example UA', 'Apple TV+'));
  assert.ok(mapping.unmapped.some(m => m.name === 'Apple TV+' && m.reason === 'provider-mapping-unresolved'));
  assert.ok(mapping.rows.every(r => r.provider.name !== 'Apple TV+'));
  const plain = await projected(localizedMarkup().replaceAll('Example UA', 'Apple TV Store'));
  assert.equal(plain.rows.find(r => r.id.startsWith('kinobaza:')).linkAudit.blockAssociation, 'not-a-provider-block');
});

test('presentation grouping keeps row references/source/territory/access distinct, never creates a combined offer', async () => {
  const result = await projected(localizedMarkup(paragraphBlock('itunes')).replaceAll('Example UA', 'Apple TV Store'));
  const snapshot = JSON.stringify(result), grouped = groupProviderRows(result.rows), apple = grouped.groups.find(g => g.key === 'apple');
  assert.ok(apple.rows.some(r => r.country === 'UA')); assert.ok(apple.rows.some(r => r.country === null && r.kinobazaLocalization));
  assert.ok(apple.rows.every(r => result.rows.includes(r)));
  assert.equal(apple.audio, undefined); assert.equal(apple.country, undefined); assert.equal(apple.access, undefined);
  assert.equal(grouped.groups.flatMap(g => g.rows).length, result.rows.length); assert.equal(JSON.stringify(result), snapshot);
  const summary = providerSummary(apple.rows);
  for (const source of ['TMDB / JustWatch', 'Movie of the Night', 'Kinobaza HTML']) assert.ok(summary.includes(source));
  assert.match(summary, /separate row/); assert.doesNotMatch(summary, /best|verified|3\.99|Dolby/);
  const countryRow = apple.rows.find(r => r.country === 'UA' && r.id.startsWith('kinobaza:'));
  assert.equal(countryRow.kinobazaLocalization, undefined); assert.equal(countryRow.audio.state, 'unknown');
});

test('unknown mappings/prototype keys/Apple subscription labels never enter the Apple Store group', () => {
  const rows = ['Apple TV+', '__proto__'].map((name, i) => ({ id: i, provider: { key: i ? '__proto__' : 'apple', name } }));
  assert.deepEqual(groupProviderRows(rows), { groups: [], unmapped: rows });
});

test('link labels separate navigation and draft eligibility without widening accepted URL kinds', () => {
  for (const kind of ['missing', 'unsafe', 'unknown', 'relative', 'search', 'tmdb-watch-page']) {
    const p = linkPresentation({ kind, href: 'https://example.com/fictional', transferable: true });
    assert.equal(p.canOpen, false); assert.match(p.draft, /not eligible for transfer/);
    assert.match(p.summary, kind === 'missing' ? /not reported/ : kind === 'unsafe' ? /unsafe/ : /unsupported kind/);
  }
  for (const kind of ['exact-card-unverified', 'tracking-redirect']) {
    const p = linkPresentation({ kind, href: 'https://example.com/fictional', transferable: true });
    assert.equal(p.canOpen, true); assert.match(p.navigation, /explicit user-open/);
    assert.match(p.draft, kind === 'tracking-redirect' ? /acknowledgement required/ : /eligible candidate/);
  }
  assert.match(linkPresentation({ kind: 'exact-card-unverified', href: 'https://example.com/fictional', transferable: false }).summary, /not eligible for transfer/);
});
