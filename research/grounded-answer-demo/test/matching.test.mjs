import test from 'node:test';
import assert from 'node:assert/strict';
import { runDiscovery, classifyLink, mapProvider } from '../discovery.mjs';
import { selectRequest } from '../config.mjs';
import { describeDiscovery } from '../matching.mjs';
import { prepareDraft } from '../public/discovery-client.mjs';

const reported = value => ({ state: 'reported', value });
const card = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored000';
async function fixture() {
  const result = await runDiscovery(selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' }), { fetchImpl: () => assert.fail('No external requests') });
  const motn = structuredClone(result.rows.find(r => r.id === 'motn:0'));
  const kino = structuredClone(result.rows.find(r => r.id.startsWith('kinobaza:')));
  motn.link = classifyLink(card, motn.provider); kino.link = classifyLink(card, kino.provider);
  kino.country = null; kino.cut = { state: 'unknown' }; kino.access = { state: 'unknown' };
  kino.kinobazaLocalization = { audio: { state: 'reported-positive' }, subtitles: { state: 'reported-negative' } };
  result.rows = [motn, kino];
  return result;
}
const rowMatch = (m, i = 0) => m.rows[i];

test('A: independent stable gates, structural Kinobaza basis and year variance are not a crosswalk invention', async () => {
  const r = await fixture(); r.sources.find(s => s.source === 'motn').evidence.year = reported(2014);
  const m = describeDiscovery(r);
  assert.ok(m.subjects.every(s => s.outcome === 'compatible'));
  assert.equal(m.subjects.find(s => s.source === 'motn').yearVariance, true);
  assert.equal(m.subjects.find(s => s.source === 'kinobaza').reason, 'structural-film-gate');
  for (const f of ['detailsImdb', 'externalImdb']) r.sources[0].evidence.details[f] = { state: 'missing' };
  assert.equal(describeDiscovery(r).subjects[0].crosswalk, 'unknown');
});

test('A: false matched flags cannot override supplied stable IDs, wrong film, malformed or missing gates', async () => {
  for (const field of ['imdbId', 'tmdbId']) {
    const r = await fixture(); r.sources[1].evidence[field] = reported(field === 'imdbId' ? 'tt99999999' : 'movie/99999999');
    const m = describeDiscovery(r); assert.equal(m.subjects[1].outcome, 'conflicting');
    assert.notEqual(m.rows[0].B.outcome, 'compatible'); assert.equal(m.subjects[0].outcome, 'compatible');
  }
  const r = await fixture(); r.sources[0].evidence.details.tmdbId = { state: 'invalid' };
  assert.equal(describeDiscovery(r).subjects[0].outcome, 'insufficient-evidence');
  r.rows[0].filmId = 'dune-part-two'; assert.equal(rowMatch(describeDiscovery(r)).A.reason, 'row-film-conflict');
  r.sources[2].evidence.status = 'unresolved'; assert.equal(describeDiscovery(r).subjects[2].outcome, 'insufficient-evidence');
});

test('A diagnostic: year-only and other structural refusals are not stable-ID conflicts', async () => {
  const r = await fixture(), kino = r.sources.find(s => s.source === 'kinobaza');
  for (const reason of ['source-year-conflict-without-stable-crosswalk', 'source-title-conflict', 'source-canonical-conflict']) {
    kino.identity = 'mismatch'; kino.evidence = { status: 'mismatch', reason };
    const a = describeDiscovery(r).subjects.find(s => s.source === 'kinobaza');
    assert.equal(a.outcome, 'conflicting'); assert.equal(a.reason, reason);
  }
  kino.evidence.reason = 'source-stable-id-conflict';
  assert.equal(describeDiscovery(r).subjects[2].reason, 'stable-id-conflict');
  kino.evidence.reason = 'unknown-source-reason';
  assert.equal(describeDiscovery(r).subjects[2].reason, 'source-identity-conflict');
  assert.equal(describeDiscovery(r).subjects[0].outcome, 'compatible');
});

test('B: same supported regional key links sources without moving territory/localization/access or changing draft', async () => {
  const r = await fixture(), snapshot = JSON.stringify(r), before = prepareDraft(r, r.rows[0]);
  const m = describeDiscovery(r);
  assert.ok(m.rows.every(e => e.B.reason === 'same-supported-regional-pointer'));
  assert.equal(m.rows[0].B.peer.source, 'kinobaza'); assert.equal(m.rows[1].B.peer.source, 'motn');
  assert.ok(m.rows[1].scopeGaps.includes('territory-unknown')); assert.ok(m.rows[1].scopeGaps.includes('access-unknown'));
  assert.deepEqual(prepareDraft(r, r.rows[0]), before); assert.equal(JSON.stringify(r), snapshot);
  assert.equal(r.rows[0].kinobazaLocalization, undefined); assert.equal(r.rows[1].country, null);
  assert.ok(m.rows.every(e => e.C === undefined && e.D === undefined));
});

test('B: native ID survives slug variation; rent/buy remain distinct rows, known version disagreement never enriches', async () => {
  const r = await fixture(); r.rows[1].link = classifyLink(card.replace('/authored/', '/another-title/'), r.rows[1].provider);
  r.rows[1].access = reported('buy'); r.rows[0].cut = reported('Final Cut'); r.rows[1].cut = reported('Theatrical');
  const m = describeDiscovery(r); assert.equal(m.rows[0].B.outcome, 'compatible');
  assert.ok(m.rows[0].scopeGaps.includes('version-claims-differ-no-enrichment'));
  assert.equal(r.rows[0].access.value, 'rent'); assert.equal(r.rows[1].access.value, 'buy');
});

test('B: region, namespace, unknown qualifier or locale semantics never create a false regional match', async () => {
  for (const href of [card.replace('/ua/', '/gb/'), 'https://itunes.apple.com/ua/movie/id999999', card + '?version=final', card + '?l=uk&l=uk', card + '#variant']) {
    const r = await fixture(); r.rows[1].link = classifyLink(href, r.rows[1].provider);
    assert.ok(describeDiscovery(r).rows.every(e => e.B.outcome !== 'compatible'), href);
  }
  const r = await fixture(); r.rows[1].country = 'GB';
  assert.equal(describeDiscovery(r).rows[0].B.reason, 'source-territory-differs');
});

test('B: distinct supported IDs conflict only with the specific same-card comparison, not independent identity', async () => {
  const r = await fixture(); r.rows[1].link = classifyLink(card.replace('authored000', 'authored999'), r.rows[1].provider);
  const m = describeDiscovery(r); assert.ok(m.rows.every(e => e.B.reason === 'different-supported-card-ids'));
  assert.ok(m.rows.every(e => e.A.outcome === 'compatible')); assert.equal(r.rows.length, 2);
});

test('B / R1: Apple affiliate at variants retain acknowledgement and exact href; ordinary URL has no extra gate', async () => {
  for (const href of [card + '?at', card + '?at=&at=x%2fY', card + '?%61t=x', 'https://itunes.apple.com/ua/movie/id999999?at=fictional']) {
    const r = await fixture(); const plain = href.split('?')[0];
    r.rows[0].link = classifyLink(href, r.rows[0].provider); r.rows[1].link = classifyLink(plain, r.rows[1].provider);
    assert.equal(describeDiscovery(r).rows[0].B.outcome, 'compatible');
    assert.equal(prepareDraft(r, r.rows[0], false).fields.purchase_url, '');
    assert.equal(prepareDraft(r, r.rows[0], true).fields.purchase_url, href);
    assert.equal(prepareDraft(r, r.rows[1], false).fields.purchase_url, plain);
  }
});

test('B: tracking/search/relative/unsafe/watch/unknown links remain non-card evidence without destination resolution', async () => {
  for (const href of ['https://click.justwatch.com/authored?url=https%3A%2F%2Ftv.apple.com', 'https://tv.apple.com/ua/search?q=authored', '/relative', 'javascript:alert(1)', 'https://user:pass@tv.apple.com/ua/movie/a/umc.cmc.authored000', 'https://tv.apple.com:444/ua/movie/a/umc.cmc.authored000', 'https://www.themoviedb.org/movie/99999/watch', 'https://example.com/authored', card.replace('tv.apple.com', 'tv.apple.com:443')]) {
    const r = await fixture(); r.rows[1].link = classifyLink(href, r.rows[1].provider);
    assert.notEqual(describeDiscovery(r).rows[1].B.outcome, 'compatible', href);
  }
});

test('B: provider aliases/namespaces and R2 quarantine survive; Apple subscriptions cannot become Store pointers', async () => {
  const r = await fixture(); r.unmapped.push({ sourceId: r.rows[0].provider.sourceId, reason: 'provider-id-conflict' });
  const m = describeDiscovery(r); assert.equal(m.rows[0].B.reason, 'provider-id-conflict');
  assert.equal(m.subjects[0].outcome, 'compatible');
  r.unmapped = []; r.rows[1].provider.sourceName = 'Apple TV+';
  assert.equal(describeDiscovery(r).rows[1].B.reason, 'provider-mapping-unresolved');
});

test('B: Prime/Netflix need explicit source market when route semantics are not established; no implicit UA', async () => {
  for (const [key, sourceId, name, href] of [['prime', 'prime', 'Prime Video', 'https://www.primevideo.com/detail/AUTHORED00'], ['netflix', 'netflix', 'Netflix', 'https://www.netflix.com/title/999999']]) {
    const r = await fixture(); r.rows[0].provider = mapProvider('motn', sourceId, name, 'rent'); r.rows[1].provider = mapProvider('kinobaza', undefined, name);
    for (const row of r.rows) row.link = classifyLink(href, row.provider);
    assert.notEqual(describeDiscovery(r).rows[1].B.outcome, 'compatible');
    r.rows[1].country = 'UA'; assert.equal(describeDiscovery(r).rows[1].B.outcome, 'compatible');
    assert.equal(r.rows[1].availability.state, 'unknown');
  }
});

test('B: MEGOGO numeric routes compare without rewriting; Rakuten exact path is not a fabricated native ID', async () => {
  for (const [name, links] of [['MEGOGO', ['https://megogo.net/ua/view/999999', 'https://megogo.net/ua/view/999999-authored.html']], ['Rakuten TV', ['https://www.rakuten.tv/ua/movies/authored', 'https://www.rakuten.tv/ua/movies/authored']]]) {
    const r = await fixture(); r.rows = [r.rows[1], structuredClone(r.rows[1])]; r.rows[1].id = 'kinobaza:999';
    for (const [i, row] of r.rows.entries()) { row.provider = mapProvider('kinobaza', undefined, name); row.link = classifyLink(links[i], row.provider); }
    const m = describeDiscovery(r); assert.ok(m.rows.every(e => e.B.outcome === 'compatible'));
    assert.equal(r.rows[0].link.href, links[0]); assert.equal(r.rows[1].link.href, links[1]);
    if (name === 'Rakuten TV') { assert.equal(m.rows[0].pointer.nativeId, undefined); assert.equal(m.rows[0].pointer.pathPointer, '/ua/movies/authored'); }
  }
});

test('A/B: a conflicting film row cannot lend a pointer or create graph/transitive enrichment; good rows survive', async () => {
  const r = await fixture(), wrong = structuredClone(r.rows[1]); wrong.id = 'kinobaza:999'; wrong.filmId = 'dune-part-two';
  r.rows.push(wrong); const m = describeDiscovery(r);
  assert.equal(m.rows[2].A.outcome, 'conflicting'); assert.notEqual(m.rows[2].B.outcome, 'compatible');
  assert.ok(m.rows.slice(0, 2).every(e => e.B.outcome === 'compatible' && e.B.peer.rowId !== wrong.id));
  assert.equal(m.edges, undefined); assert.equal(m.nodes, undefined); assert.equal(r.rows[0].kinobazaLocalization, undefined);
});

test('A/B: TMDb market/access signal stays linkless and related, never borrows a MOTN deep link', async () => {
  const r = await runDiscovery(selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' }), { fetchImpl: () => assert.fail('No network') });
  const tmdb = r.rows.find(x => x.id.startsWith('tmdb:')), before = JSON.stringify(tmdb);
  const m = describeDiscovery(r).rows.find(x => x.rowId === tmdb.id);
  assert.equal(m.A.outcome, 'compatible'); assert.equal(m.B.reason, 'no-supported-direct-pointer');
  assert.equal(tmdb.link.href, null); assert.equal(JSON.stringify(tmdb), before);
});

test('B: accepted Prime referral retains acknowledgement; Netflix locale prefixes do not invent regional equivalence', async () => {
  const r = await fixture(); r.rows[0].provider = mapProvider('motn', 'prime', 'Prime Video', 'rent');
  r.rows[1].provider = mapProvider('kinobaza', undefined, 'Prime Video'); r.rows[1].country = 'UA';
  const href = 'https://www.primevideo.com/detail/AUTHORED00/ref=atv_authored_1';
  r.rows[0].link = classifyLink(href, r.rows[0].provider);
  r.rows[1].link = classifyLink('https://www.primevideo.com/detail/AUTHORED00', r.rows[1].provider);
  assert.equal(describeDiscovery(r).rows[0].B.outcome, 'compatible');
  assert.equal(prepareDraft(r, r.rows[0], false).fields.purchase_url, ''); assert.equal(prepareDraft(r, r.rows[0], true).fields.purchase_url, href);
  for (const row of r.rows) { row.provider = mapProvider(row.id.startsWith('motn:') ? 'motn' : 'kinobaza', row.id.startsWith('motn:') ? 'netflix' : undefined, 'Netflix'); row.link = classifyLink('https://www.netflix.com/ua/title/999999', row.provider); }
  assert.ok(describeDiscovery(r).rows.every(e => e.B.outcome !== 'compatible'));
});
