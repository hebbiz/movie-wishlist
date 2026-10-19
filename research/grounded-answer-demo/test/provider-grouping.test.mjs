import test from 'node:test';
import assert from 'node:assert/strict';
import { FILMS, selectRequest } from '../config.mjs';
import { runDiscovery, composeDiscovery, classifyLink, mapProvider, conflictingProviderIds } from '../discovery.mjs';
import { extractHtml } from '../html-source.mjs';
import { linkPresentation, groupProviderRows, providerSummary, prepareDraft } from '../public/discovery-client.mjs';
import { localizedMarkup, paragraphBlock, tableBlock } from './kinobaza-localization.fixture.mjs';

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

test('regression: provider-native ID/referral paths survive extraction, block binding and exact draft transfer', async () => {
  // Authored miniature blocks and fictional IDs, not copied source HTML/results.
  const cases = [
    ['prime', 'https://www.primevideo.com/detail/FICTIONAL123/ref=atv_demo_1', true,
      href => paragraphBlock('amazon prime', '(укр. аудіо)', href)],
    ['apple', 'https://itunes.apple.com/ua/movie/id999999?at=fictional123&l=uk', true,
      href => tableBlock('itunes', [['Укр. звук', '+'], ['Укр. субтитри', '-']], href.replaceAll('&', '&amp;'))],
    ['megogo', 'https://megogo.net/ua/view/999999', false,
      href => paragraphBlock('megogo', '(укр. аудіо, укр. субтитри)', href)],
  ];
  for (const [provider, href, acknowledgement, block] of cases) {
    const result = await projected(localizedMarkup(block(href)));
    const row = result.rows.find(r => r.provider.key === provider && r.kinobazaLocalization);
    assert.equal(row.link.href, href); assert.equal(row.kinobazaLocalization.href, href);
    assert.equal(row.link.kind, 'exact-card-unverified'); assert.equal(row.link.transferable, true);
    assert.equal(row.linkAudit.blockAssociation, 'associated'); assert.equal(row.linkAudit.extraction.hrefValue, 'reported');
    assert.equal(row.country, null); assert.equal(row.accountEntitlement, 'unknown');
    assert.equal(linkPresentation(row.link).canOpen, true);
    assert.match(linkPresentation(row.link).draft, acknowledgement ? /acknowledgement required/ : /eligible candidate/);
    assert.equal(prepareDraft(result, row).fields.purchase_url, acknowledgement ? '' : href);
    const confirmed = prepareDraft(result, row, true);
    assert.equal(confirmed.fields.purchase_url, href); assert.equal(confirmed.sidecar.linkPolicy.acknowledgementRequired, acknowledgement);
    assert.equal(confirmed.fields.audio, undefined); assert.equal(confirmed.fields.price, undefined);
    assert.equal(confirmed.sidecar.territory, 'unknown');
  }
});

test('provider-native shape additions keep scheme/host/path/provider and search/relative safety boundaries', () => {
  const provider = key => mapProvider('kinobaza', undefined, { prime: 'amazon prime', apple: 'itunes', megogo: 'megogo' }[key]);
  const positives = [
    ['prime', 'https://primevideo.com/detail/FICTIONAL123/ref=atv_demo_1'],
    ['apple', 'https://itunes.apple.com/ua/movie/id999999'],
    ['megogo', 'https://www.megogo.net/ua/view/999999'],
  ];
  for (const [key, href] of positives) assert.equal(classifyLink(href, provider(key)).kind, 'exact-card-unverified');
  const blocked = [
    ['prime', 'https://www.primevideo.com/detail/FICTIONAL123/ref=atv_demo_1/extra'],
    ['prime', 'https://www.primevideo.com/detail/FICTIONAL123/ref=https:%2F%2Fevil.example'],
    ['prime', 'https://www.primevideo.com/detail/FICTIONAL123/ref=unknown'],
    ['apple', 'https://itunes.apple.com/ua/album/id999999'],
    ['apple', 'https://itunes.apple.com/us/movie/id999999'],
    ['apple', 'https://itunes.apple.com/ua/movie/id999999/extra'],
    ['apple', 'https://itunes.apple.com.evil.example/ua/movie/id999999'],
    ['megogo', 'https://megogo.net/ua/view/999999/extra'],
    ['megogo', 'https://megogo.net/ua/view/not-a-number'],
    ['megogo', 'https://megogo.net/ua/view/%39%39%39'],
    ['megogo', 'https://megogo.net/ua/search/999999'],
    ['megogo', 'https://megogo.net/ua/view/999999?q=fictional'],
    ['megogo', '/ua/view/999999'],
    ['megogo', 'http://megogo.net/ua/view/999999'],
    ['megogo', 'https://user:secret@megogo.net/ua/view/999999'],
    ['megogo', 'https://megogo.net:444/ua/view/999999'],
    ['megogo', 'javascript:alert(1)'],
  ];
  for (const [key, href] of blocked) { const result = classifyLink(href, provider(key)); assert.equal(result.transferable, false, href); assert.equal(linkPresentation(result).canOpen, false, href); }
  for (const [key, href] of positives) {
    const other = provider(key === 'prime' ? 'apple' : 'prime');
    assert.equal(classifyLink(href, other).transferable, false);
  }
});

test('R1: Apple at presence gates both accepted routes; empty/repeated/decoded keys preserve the exact URL', async () => {
  const base = await runDiscovery(config, { fetchImpl: () => assert.fail('No network') });
  const original = base.rows.find(r => r.id.startsWith('motn:'));
  const apple = mapProvider('kinobaza', undefined, 'itunes');
  for (const route of ['https://itunes.apple.com/ua/movie/id999999', 'https://tv.apple.com/ua/movie/fictional/umc.cmc.fictional999']) {
    for (const [query, needsAck] of [
      ['', false], ['?l=uk&l=en', false], ['?attribution=x', false], ['?AT=x', false],
      ['?at=fictional%2fCode&l=uk', true], ['?at=', true], ['?at', true],
      ['?at=&at=second', true], ['?at=first&at=second', true], ['?%61t=encoded', true],
    ]) {
      const href = route + query, row = { ...original, link: classifyLink(href, apple) };
      const result = { ...base, rows: [row] };
      assert.equal(row.link.kind, 'exact-card-unverified'); assert.equal(row.link.href, href);
      assert.equal(linkPresentation(row.link).canOpen, true);
      assert.equal(prepareDraft(result, row, false).fields.purchase_url, needsAck ? '' : href, href);
      assert.equal(prepareDraft(result, row, true).fields.purchase_url, href);
      assert.equal(prepareDraft(result, row, false).sidecar.linkPolicy.acknowledgementRequired, needsAck);
    }
  }
});

test('R2: same TMDb ID with incompatible platform labels is withheld across access buckets; independent rows survive', async () => {
  const base = await runDiscovery(config, { fetchImpl: () => assert.fail('No network') });
  const reported = value => ({ state: 'reported', value });
  const provider = name => ({ id: reported(999999), name: reported(name) });
  const buckets = base.stages.tmdb.result.providers.buckets;
  buckets.find(b => b.name === 'rent').providers = { state: 'reported', items: [provider('Netflix'), { id: reported(2), name: reported('Apple TV Store') }] };
  buckets.find(b => b.name === 'buy').providers = { state: 'reported', items: [provider('Prime Video')] };
  const before = JSON.stringify(base.stages), result = composeDiscovery(base.film, base.stages, { synthetic: true, metrics: base.metrics });
  assert.equal(result.rows.filter(r => r.provider.sourceId === 'tmdb:provider:999999').length, 0);
  const unresolved = result.unmapped.filter(r => r.reason === 'provider-id-conflict');
  assert.equal(unresolved.length, 2); assert.ok(unresolved.every(r => r.sourceId === 'tmdb:provider:999999'));
  assert.deepEqual(unresolved.map(r => r.sourceBucket), ['rent', 'buy']);
  assert.ok(unresolved.every(r => r.provenance.source === 'TMDB / JustWatch' && r.provenance.receivedAt));
  assert.ok(unresolved.every(r => r.provider === undefined && r.availability === undefined));
  for (const item of unresolved) assert.throws(() => prepareDraft(result, item), /identity-gated row/);
  assert.ok(result.rows.some(r => r.provider.sourceId === 'tmdb:provider:2'));
  assert.ok(result.rows.some(r => r.id.startsWith('motn:')));
  assert.equal(JSON.stringify(base.stages), before);
});

test('R2: compatible aliases and rent/buy remain separate valid observations, without invented IDs', async () => {
  const base = await runDiscovery(config, { fetchImpl: () => assert.fail('No network') });
  const reported = value => ({ state: 'reported', value });
  for (const bucket of base.stages.tmdb.result.providers.buckets.filter(b => ['rent', 'buy'].includes(b.name))) {
    bucket.providers = { state: 'reported', items: [{ id: reported(999999), name: reported(bucket.name === 'rent' ? 'Prime Video' : 'Amazon Prime Video') }] };
  }
  const result = composeDiscovery(base.film, base.stages, { synthetic: true, metrics: base.metrics });
  const rows = result.rows.filter(r => r.provider.sourceId === 'tmdb:provider:999999');
  assert.equal(rows.length, 2); assert.ok(rows.every(r => r.provider.key === 'prime'));
  assert.deepEqual(rows.map(r => r.access.sourceBucket), ['rent', 'buy']);
  assert.equal(result.unmapped.filter(r => r.reason === 'provider-id-conflict').length, 0);
});

test('R2: numeric IDs in different source namespaces never conflict; absent IDs are not invented', () => {
  const claims = [
    { source: 'tmdb', id: 999999, name: 'Netflix' },
    { source: 'motn', id: 999999, name: 'Prime Video' },
    { source: 'tmdb', name: 'Prime Video' },
    { source: 'tmdb', id: null, name: 'HBO Max' },
    { source: 'tmdb', id: '', name: 'MEGOGO' },
  ];
  assert.equal(conflictingProviderIds(claims).size, 0);
  const conflicts = conflictingProviderIds([...claims, { source: 'motn', id: 999999, name: 'HBO Max' }]);
  assert.deepEqual([...conflicts.keys()], ['motn:provider:999999']);
  assert.deepEqual(conflicts.get('motn:provider:999999'), ['prime', 'hbo']);
  assert.equal(conflicts.has('tmdb:provider:999999'), false);
});

test('R2: conflicting MOTN label/ID observations retain source projection but cannot supply platform or draft', async () => {
  const base = await runDiscovery(config, { fetchImpl: () => assert.fail('No network') });
  const original = base.stages.motn.result.options[0], reported = value => ({ state: 'reported', value });
  base.stages.motn.result.options = [
    { ...original, service: { id: reported('prime'), name: reported('Prime Video') } },
    { ...original, service: { id: reported('prime'), name: reported('Netflix') } },
    { ...original, service: { id: reported('apple'), name: reported('Apple TV Store') } },
  ];
  const result = composeDiscovery(base.film, base.stages, { synthetic: true, metrics: base.metrics });
  const conflicts = result.unmapped.filter(r => r.reason === 'provider-id-conflict');
  assert.equal(conflicts.length, 2); assert.ok(conflicts.every(r => r.sourceId === 'motn:provider:prime'));
  assert.ok(conflicts.every(r => r.observation.link.value === original.link.value && r.provenance.receivedAt));
  assert.equal(result.rows.filter(r => r.provider.sourceId === 'motn:provider:prime').length, 0);
  assert.ok(result.rows.some(r => r.provider.sourceId === 'motn:provider:apple'));
  assert.ok(result.rows.some(r => r.provider.sourceId === 'tmdb:provider:2'));
  for (const conflict of conflicts) assert.throws(() => prepareDraft(result, conflict), /identity-gated row/);
});
