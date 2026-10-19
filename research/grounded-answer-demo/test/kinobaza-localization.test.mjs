import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractHtml, fetchHtmlCandidates, htmlScenario, canonicalKinobazaURL, canonicalRedirectTarget } from '../html-source.mjs';
import { FILMS, selectRequest } from '../config.mjs';
import { runDiscovery, authoredDiscoveryData } from '../discovery.mjs';
import { prepareDraft, compactFields } from '../public/discovery-client.mjs';
import { localizedMarkup, tableBlock, paragraphBlock, badge } from './kinobaza-localization.fixture.mjs';

const parse = (body, film = 'coherence') => extractHtml(body, FILMS[film]);
const selection = film => htmlScenario(FILMS[film], { discovery: 'digital-ua' });
const html = body => new Response(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } });

test('general film badge never supplies provider tracks; Coherence paragraph / Dune table are independently recognized structures', async () => {
  const general = await parse(localizedMarkup());
  assert.equal(general.localization.film.ukrainianAudio.state, 'reported-positive'); assert.equal(general.localization.blocks.length, 0);
  for (const [film, block] of [['coherence', paragraphBlock('amazon prime', '(укр. аудіо)')], ['dune-part-two', tableBlock()]]) {
    const r = await parse(localizedMarkup(block, film), film);
    assert.equal(r.identity.status, 'matched'); assert.equal(r.localization.blocks[0].audio.state, 'reported-positive');
    assert.equal(r.localization.blocks[0].territory, null); assert.equal(r.localization.blocks[0].audio.completeness, 'unknown');
  }
});

test('independent provider blocks retain exact hrefs, negative labels and literal stereo/generic Dolby without codec inference', async () => {
  const r = await parse(localizedMarkup(tableBlock('itunes', [['Укр. звук (стерео)', '+'], ['Укр. звук (dolby)', '-'], ['Укр. субтитри (forced)', '+']]) + paragraphBlock('megogo', '(укр. субтитри)')));
  const [apple, megogo] = r.localization.blocks;
  assert.equal(apple.audio.state, 'reported-positive'); assert.deepEqual(apple.audio.evidence.map(e => e.formatLiteral), ['стерео', 'dolby']);
  assert.equal(apple.audio.evidence[1].state, 'negative'); assert.equal(apple.subtitles.evidence[0].typeLiteral, 'forced');
  assert.equal(megogo.audio.state, 'unknown'); assert.equal(megogo.subtitles.state, 'reported-positive');
  assert.equal(apple.href, 'https://example.com/fictional?x=%2F&y=1');
  assert.doesNotMatch(JSON.stringify(apple), /Atmos|5\.1|codec|channels/);
});

test('missing/unknown signs and original language do not become offered audio; conflicting identical labels stay conflicting', async () => {
  const r = await parse(localizedMarkup(tableBlock('itunes', [['Мова оригіналу', 'українська'], ['Укр. звук', '?'], ['Укр. субтитри', '']])));
  assert.equal(r.localization.blocks[0].audio.state, 'unknown'); assert.equal(r.localization.blocks[0].subtitles.state, 'unknown');
  const conflict = await parse(localizedMarkup(tableBlock('itunes', [['Укр. звук', '+'], ['Укр. звук', '−']])));
  assert.equal(conflict.localization.blocks[0].audio.state, 'conflicting');
  assert.ok(conflict.localization.blocks[0].issues.includes('conflicting-block-labels'));
});

test('neighbour text, ambiguous boundaries, tooltip disjunctions and duplicate provider headers cannot supply properties', async () => {
  const examples = [
    `${badge('itunes')}<span>(укр. аудіо)</span>`,
    `<p class="mt-2">${badge('itunes')}${badge('megogo')}(укр. аудіо)</p>`,
    paragraphBlock('itunes', 'Original language Ukrainian (укр. аудіо)'),
    tableBlock().replace('<table>', `${badge('megogo')}<table>`),
    tableBlock().replace('alt="Доступно в itunes"', 'alt="Доступно в megogo"'),
    tableBlock().replace('<table>', '<script>throw new Error("NEVER EXECUTE")</script><table>'),
    tableBlock().replace('<table>', '<table><tr><td><table></table></td></tr>'),
    tableBlock('itunes', Array.from({ length: 65 }, () => ['Укр. звук', '+'])),
    paragraphBlock('itunes', '').replace('Доступно в itunes"', 'Купити в itunes з українською аудіо доріжкою / субтитрами"'),
  ];
  for (const block of examples) {
    const r = await parse(localizedMarkup(block));
    assert.ok(r.localization.blocks.every(b => b.audio.state === 'unknown' && b.subtitles.state === 'unknown'));
  }
});

test('duplicate provider names remain distinct source blocks, with possible conflict, never a shared offer', async () => {
  const r = await parse(localizedMarkup(tableBlock('itunes', [['Укр. звук', '+']], 'https://example.com/one') + tableBlock('itunes', [['Укр. звук', '-']], 'https://example.com/two')));
  assert.equal(new Set(r.localization.blocks.map(b => b.blockId)).size, 2);
  assert.ok(r.localization.blocks.every(b => b.issues.includes('possible-block-conflict-scope-unestablished')));
  assert.deepEqual(r.localization.blocks.map(b => b.audio.state), ['reported-positive', 'reported-negative']);
});

test('country sections, foreign links and source blocks are independent observations; no general/country property leakage', async () => {
  const r = await parse(localizedMarkup(paragraphBlock('megogo')));
  assert.deepEqual(r.availabilitySignals.map(s => s.territory.code), ['UA', 'PL']);
  assert.ok(r.availabilitySignals.every(s => s.access === 'unknown' && s.upstream === 'JustWatch'));
  assert.ok(r.candidates.filter(c => c.territory).every(c => !c.blockId));
  assert.equal(r.candidates.find(c => c.provider === 'megogo').territory, null);
});

test('unsafe/relative/tracking/search hrefs remain candidates with original classification, never fetched or rebuilt', async () => {
  for (const href of ['https://click.justwatch.com/a?x=%2F&amp;y=1', '/relative?x=%2F', 'https://www.youtube.com/results?search_query=fictional', 'javascript:alert(1)']) {
    const r = await parse(localizedMarkup(paragraphBlock('megogo', '(укр. аудіо)', href)));
    const c = r.candidates.find(c => c.provider === 'megogo');
    assert.equal(c.href, href.startsWith('javascript:') ? null : href.replace('&amp;', '&'));
    assert.equal(r.localization.blocks[0].href, c.href);
  }
});

test('only exact permanent old-host → canonical-host same-title transition is allowed', () => {
  for (const film of ['coherence', 'dune-part-two']) {
    const source = selection(film).sourceURL, target = canonicalKinobazaURL(film);
    for (const code of [301, 308]) assert.equal(canonicalRedirectTarget(source, target, code), target);
    for (const bad of ['http://kinobazaua.com/titles/'+film, target+'/', target+'?x=1', target+'#x', target.replace('https://','https://user:pass@'), target.replace('kinobazaua.com','evil.example'), target.replace('/titles/', '/titles/../titles/'), 'https://kinobazaua.com/titles/other', '/titles/'+film]) assert.equal(canonicalRedirectTarget(source, bad, 301), null);
    assert.equal(canonicalRedirectTarget(target, target, 301), null); assert.equal(canonicalRedirectTarget(source, target, 302), null);
  }
});

test('optional canonical transport max2 requests, credentials omitted, no redirect/body archive or third hop', async () => {
  const calls = [], s = selection('coherence');
  const r = await fetchHtmlCandidates(s, async (url, init) => { calls.push({ url, init }); return calls.length === 1 ? new Response('PRIVATE_REDIRECT', { status: 301, headers: { Location: canonicalKinobazaURL('coherence'), 'Set-Cookie': 'PRIVATE_COOKIE' } }) : html(localizedMarkup(paragraphBlock())); }, { canonicalRedirect: true });
  assert.equal(calls.length, 2); assert.equal(r.requestsMade, 2); assert.equal(r.identity.status, 'matched'); assert.ok(r.receivedAt);
  assert.equal(r.sourceURL, canonicalKinobazaURL('coherence'));
  assert.ok(calls.every(c => c.init.redirect === 'manual' && c.init.credentials === 'omit' && !/cookie|authorization|api-key/i.test(JSON.stringify(c.init.headers))));
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_|<html|<script/);
  let count = 0; const loop = await fetchHtmlCandidates(s, async () => { count++; return new Response(null, { status: 301, headers: { Location: canonicalKinobazaURL('coherence') } }); }, { canonicalRedirect: true });
  assert.equal(count, 2); assert.equal(loop.status, 'redirect-loop-or-second-hop-refused');
});

test('combined budget5 only consumes fifth request for a canonical hop; no hop stays4; no source offer enrichment or draft import', async () => {
  const calls = [], data = authoredDiscoveryData(FILMS.coherence);
  const mock = async (url, init) => { calls.push({ url, init }); return Response.json(url.includes('movieofthenight') ? data.motn : url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details); };
  const config = selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' });
  await assert.rejects(() => runDiscovery({ ...config, requestBudget: 6 }, { fetchImpl: () => assert.fail('No request for invalid budget') }), /Fixed discovery/);
  const result = await runDiscovery(config, { mode: 'live', tmdbToken: 'offline-TMDB', motnKey: 'offline-MOTN', fetchImpl: async (url, init) => {
    if (url === selection('coherence').sourceURL) { calls.push({ url, init }); return new Response(null, { status: 301, headers: { Location: canonicalKinobazaURL('coherence') } }); }
    if (url === canonicalKinobazaURL('coherence')) { calls.push({ url, init }); return html(localizedMarkup(paragraphBlock('itunes', '(укр. аудіо)', 'https://tv.apple.com/ua/movie/fictional/umc.cmc.fictional'))); }
    return mock(url, init);
  } });
  assert.equal(result.metrics.requestBudget, 5); assert.equal(result.metrics.requestsMade, 5); assert.equal(calls.length, 5);
  const row = result.rows.find(r => r.kinobazaLocalization);
  assert.equal(row.country, null); assert.equal(row.availability.state, 'unknown'); assert.equal(row.audio.state, 'unknown');
  assert.ok(compactFields(row).known.includes('UA audio + (Kinobaza block)'));
  assert.equal(result.rows.find(r => r.id.startsWith('motn:')).kinobazaLocalization, undefined);
  const draft = prepareDraft(result, row); assert.equal(draft.fields.audio, undefined); assert.equal(draft.fields.purchase_url, row.link.href);
  assert.equal(draft.sidecar.kinobazaLocalization.audio.state, 'reported-positive');
  assert.equal(result.rows.find(r => r.id.startsWith('tmdb:')).countrySignal, undefined);
});

test('post-hop blocks, malformed content, size and timeout remain bounded without retry', async () => {
  for (const [reply, expected] of [
    [() => new Response('PRIVATE', { status: 403 }), 'access-blocked-no-retry'],
    [() => new Response('PRIVATE', { status: 429 }), 'access-blocked-no-retry'],
    [() => new Response('PRIVATE', { headers: { 'content-type': 'text/html', 'content-length': '9999999' } }), 'response-too-large'],
    [() => new Response('PRIVATE', { headers: { 'content-type': 'application/json' } }), 'unsupported-content-type'],
    [() => new Promise(() => {}), 'timeout-no-retry'],
  ]) {
    let calls = 0;
    const r = await fetchHtmlCandidates(selection('coherence'), async () => ++calls === 1 ? new Response(null, { status: 301, headers: { Location: canonicalKinobazaURL('coherence') } }) : reply(), { canonicalRedirect: true, timeoutMs: 30 });
    assert.equal(calls, 2); assert.equal(r.status, expected); assert.doesNotMatch(JSON.stringify(r), /PRIVATE/);
  }
});

test('new extractor has no network, execution, storage or logging hooks', async () => {
  const code = await readFile(new URL('../kinobaza-localization.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /\bfetch\s*\(|eval\s*\(|innerHTML|localStorage|sessionStorage|writeFile|console\./);
});
