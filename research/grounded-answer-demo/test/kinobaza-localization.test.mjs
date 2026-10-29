import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractHtml, fetchHtmlCandidates, htmlScenario, canonicalKinobazaURL, canonicalRedirectTarget } from '../html-source.mjs';
import { FILMS, selectRequest } from '../config.mjs';
import { runDiscovery, authoredDiscoveryData, composeDiscovery } from '../discovery.mjs';
import { prepareDraft, compactFields } from '../public/discovery-client.mjs';
import { localizedMarkup, tableBlock, paragraphBlock, badge, generalBadge, authoredDuneLanguageMarkup } from './kinobaza-localization.fixture.mjs';

const parse = (body, film = 'coherence') => extractHtml(body, FILMS[film]);
const selection = film => htmlScenario(FILMS[film], { discovery: 'digital-ua' });
const html = body => new Response(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
// Authored structural cases, not retained or reconstructed public page HTML.
const providerLink = (provider, href = 'https://example.com/authored-country') => `<a title="Дивитись / Купити на ${provider}" href="${href}"><img alt="${provider}"></a>`;
const countrySection = (code, label, anchors = providerLink('Apple TV Store')) => `<div class="accordion-item"><h2 class="accordion-header"><button data-bs-target="#collapse${code}">${label}</button></h2><div id="collapse${code}" data-bs-parent="#availabilityAccordion">${anchors}</div></div>`;
const countryMarkup = (blocks, sections, general = true) => `<!doctype html><html><body><h1>Coherence (2013)</h1><h2>Coherence</h2><table><tr><td>Режисер:</td><td>James Ward Byrkit</td></tr></table>${general ? generalBadge : ''}${blocks}<div id="availabilityAccordion">${sections}</div></body></html>`;
const compose = (result, film = 'coherence') => composeDiscovery(FILMS[film], { tmdb: { result: null }, motn: { result: null }, kinobaza: { result, status: result.status } });

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

test('authored Dune 2024 Apple/Rakuten tables and MEGOGO paragraph remain separate without a UA country pointer', async () => {
  const body = authoredDuneLanguageMarkup().replaceAll('collapseUA', 'collapseCZ').replace('Доступно в Україні', 'Доступно в Чехії');
  const r = await parse(body, 'dune-part-two');
  assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'partial');
  assert.ok(r.issues.includes('missing-explicit-ukraine-section')); assert.ok(r.availabilitySignals.every(signal => signal.territory.code !== 'UA'));
  assert.equal(r.localization.film.ukrainianAudio.state, 'reported-positive');
  const projection = compose(r, 'dune-part-two');
  assert.deepEqual(projection.rows.map(row => row.provider.key), ['apple', 'rakuten', 'megogo']);
  const [apple, rakuten, megogo] = projection.rows;
  assert.equal(apple.kinobazaLocalization.audio.state, 'reported-positive'); assert.equal(apple.kinobazaLocalization.subtitles.state, 'reported-negative');
  assert.deepEqual(apple.kinobazaLocalization.audio.evidence.map(item => item.formatLiteral), ['стерео', 'dolby']);
  assert.deepEqual(apple.kinobazaLocalization.subtitles.evidence.map(item => item.label), ['Укр. субтитри']);
  for (const row of [rakuten, megogo]) {
    assert.equal(row.kinobazaLocalization.audio.state, 'reported-positive'); assert.equal(row.kinobazaLocalization.subtitles.state, 'reported-positive');
  }
  assert.deepEqual(megogo.kinobazaLocalization.audio.evidence.map(item => item.label), ['укр. аудіо']);
  assert.ok(projection.rows.every(row => row.country === null && row.access.state === 'unknown' && row.availability.state === 'unknown' && row.audio.state === 'unknown' && row.subtitles.state === 'unknown' && !row.countrySignal));
  for (const row of projection.rows) {
    const block = row.kinobazaLocalization, candidate = r.candidates.find(candidate => candidate.blockId === block.blockId);
    assert.equal(candidate.href, block.href); assert.equal(candidate.provider, block.provider); assert.equal(block.territory, null);
    assert.equal(block.audio.completeness, 'unknown'); assert.equal(block.subtitles.completeness, 'unknown');
  }
});

test('Dune table presence prevents parenthetical fallback even when table fields are negative, unknown, missing or empty', async () => {
  for (const [rows, audio, subtitles] of [
    [[['Укр. звук', '-'], ['Укр. субтитри', '?']], 'reported-negative', 'unknown'],
    [[['Укр. звук', '?'], ['Укр. субтитри', '']], 'unknown', 'unknown'],
    [[['Мова оригіналу', 'українська']], 'unknown', 'unknown'],
    [[], 'unknown', 'unknown'],
  ]) {
    const block = tableBlock('itunes', rows).replace('</table>', '</table> (укр. аудіо, укр. субтитри)');
    const r = await parse(localizedMarkup(block, 'dune-part-two'), 'dune-part-two');
    const own = r.localization.blocks[0];
    assert.equal(own.audio.state, audio); assert.equal(own.subtitles.state, subtitles);
    assert.ok(own.audio.evidence.every(item => item.label !== 'укр. аудіо')); assert.ok(own.subtitles.evidence.every(item => item.label !== 'укр. субтитри'));
  }
  const noTable = await parse(localizedMarkup(paragraphBlock('itunes'), 'dune-part-two'), 'dune-part-two');
  assert.equal(noTable.localization.blocks[0].audio.state, 'reported-positive'); assert.equal(noTable.localization.blocks[0].subtitles.state, 'reported-positive');
});

test('Dune format-specific signs stay literal while contradictory signs for the same label stay conflicting', async () => {
  const r = await parse(authoredDuneLanguageMarkup({ appleRows: [
    ['Укр. звук (стерео)', '+'], ['Укр. звук (dolby)', '-'], ['Укр. субтитри (forced)', '-'], ['Укр. субтитри (SDH)', '+'],
  ] }), 'dune-part-two');
  const apple = r.localization.blocks[0];
  assert.equal(apple.audio.state, 'reported-positive'); assert.equal(apple.subtitles.state, 'reported-positive');
  assert.deepEqual(apple.audio.evidence.map(item => [item.formatLiteral, item.state]), [['стерео', 'positive'], ['dolby', 'negative']]);
  assert.deepEqual(apple.subtitles.evidence.map(item => [item.typeLiteral, item.state]), [['forced', 'negative'], ['SDH', 'positive']]);
  assert.ok(!apple.issues.includes('conflicting-block-labels')); assert.doesNotMatch(JSON.stringify(apple), /Atmos|5\.1|codec|channels/);
  const conflict = await parse(authoredDuneLanguageMarkup({ appleRows: [['Укр. звук', '+'], ['Укр. звук', '-'], ['Укр. субтитри', '+'], ['Укр. субтитри', '−']] }), 'dune-part-two');
  const projected = compose(conflict, 'dune-part-two').rows.find(row => row.provider.key === 'apple');
  assert.equal(projected.kinobazaLocalization.audio.state, 'conflicting'); assert.equal(projected.kinobazaLocalization.subtitles.state, 'conflicting');
  assert.deepEqual(projected.conflicts.map(item => [item.field, item.type]), [['audio', 'conflicting-block-labels'], ['subtitles', 'conflicting-block-labels']]);
  assert.equal(projected.audio.state, 'unknown'); assert.equal(projected.subtitles.state, 'unknown');
});

test('Dune block facts cannot cross services or attach to a country-only row of the same platform', async () => {
  const r = await parse(authoredDuneLanguageMarkup({
    rakutenRows: [['Укр. звук', '?']], megogoTokens: '', extraBlocks: paragraphBlock('netflix', ''),
  }).replaceAll('Example UA', 'Apple TV Store').replaceAll('Example Foreign', 'Rakuten TV'), 'dune-part-two');
  const projection = compose(r, 'dune-part-two'), countryApple = projection.rows.find(row => row.country === 'UA' && row.provider.key === 'apple');
  assert.ok(countryApple); assert.equal(countryApple.kinobazaLocalization, undefined);
  assert.equal(countryApple.audio.state, 'unknown'); assert.equal(countryApple.subtitles.state, 'unknown');
  const blocks = projection.rows.filter(row => row.kinobazaLocalization);
  assert.equal(blocks.find(row => row.provider.key === 'apple').kinobazaLocalization.audio.state, 'reported-positive');
  for (const provider of ['rakuten', 'megogo', 'netflix']) {
    const row = blocks.find(row => row.provider.key === provider);
    assert.ok(row); assert.equal(row.kinobazaLocalization.audio.state, 'unknown'); assert.equal(row.kinobazaLocalization.subtitles.state, 'unknown');
  }
  assert.ok(!projection.rows.some(row => row.country === 'PL')); assert.equal(projection.filmLocalization.ukrainianAudio.state, 'reported-positive');
});

test('Dune duplicate platform blocks retain their own signs and IDs instead of merging into a universal track claim', async () => {
  const r = await parse(authoredDuneLanguageMarkup({ extraBlocks: tableBlock('itunes', [['Укр. звук', '-'], ['Укр. субтитри', '+']], 'https://example.com/authored-dune-other-apple') }), 'dune-part-two');
  const apple = compose(r, 'dune-part-two').rows.filter(row => row.provider.key === 'apple');
  assert.equal(apple.length, 2); assert.equal(new Set(apple.map(row => row.kinobazaLocalization.blockId)).size, 2);
  assert.deepEqual(apple.map(row => row.kinobazaLocalization.audio.state), ['reported-positive', 'reported-negative']);
  assert.deepEqual(apple.map(row => row.kinobazaLocalization.subtitles.state), ['reported-negative', 'reported-positive']);
  assert.ok(apple.every(row => row.kinobazaLocalization.issues.includes('possible-block-conflict-scope-unestablished')));
  assert.ok(apple.every(row => row.country === null && row.audio.state === 'unknown' && row.subtitles.state === 'unknown'));
});

test('recognized no-table blocks work for every mapped service without requiring a separate UA pointer', async () => {
  // HBO uses the already supported explicit provider title/image spelling;
  // no new badge label, fuzzy matcher or source-markup assumption is introduced.
  const hbo = paragraphBlock('HBO Max').replace('title="Доступно в HBO Max"', 'title="Дивитись / Купити на HBO Max"').replace('alt="Доступно в HBO Max"', 'alt="HBO Max"');
  const blocks = ['itunes', 'rakuten', 'megogo', 'netflix', 'prime video'].map(provider => paragraphBlock(provider)).join('') + hbo;
  const body = localizedMarkup(blocks, 'dune-part-two').replaceAll('collapseUA', 'collapseCZ').replace('Доступно в Україні', 'Доступно в Чехії');
  const r = await parse(body, 'dune-part-two'), rows = compose(r, 'dune-part-two').rows;
  assert.deepEqual(rows.map(row => row.provider.key), ['apple', 'rakuten', 'megogo', 'netflix', 'prime', 'hbo']);
  assert.ok(rows.every(row => row.country === null && row.availability.state === 'unknown' && row.kinobazaLocalization.audio.state === 'reported-positive' && row.kinobazaLocalization.subtitles.state === 'reported-positive'));
});

test('unmatched Dune identity withholds all authored provider/localization claims before composition', async () => {
  const r = await parse(authoredDuneLanguageMarkup().replace('(2024)', '(2025)'), 'dune-part-two');
  assert.equal(r.identity.status, 'unresolved'); assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined);
  const projection = compose(r, 'dune-part-two'); assert.deepEqual(projection.rows, []); assert.equal(projection.filmLocalization, null);
});

test('three valid foreign sections without UA preserve independent iTunes/MEGOGO blocks and the film badge', async () => {
  const appleHref = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authoronly?at=AUTHOR%2fONLY&amp;x=1';
  const megogoHref = 'https://megogo.net/ua/view/999999-authored.html';
  const body = countryMarkup(tableBlock('itunes', [['Укр. звук', '+'], ['Укр. субтитри', '-']], appleHref) + paragraphBlock('megogo', '(укр. аудіо, укр. субтитри)', megogoHref),
    countrySection('PL', 'Доступно в Польщі') + countrySection('CZ', 'Доступно в Чехії') + countrySection('DE', 'Доступно в Німеччині'));
  const r = await parse(body);
  assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'partial'); assert.deepEqual(r.issues, ['missing-explicit-ukraine-section']);
  assert.deepEqual(r.candidates.map(c => c.territory?.code ?? null), ['PL', 'CZ', 'DE', null, null]);
  assert.deepEqual(r.availabilitySignals.map(s => s.territory.code), ['PL', 'CZ', 'DE']);
  assert.equal(r.localization.film.ukrainianAudio.state, 'reported-positive'); assert.equal(r.localization.blocks.length, 2);
  for (const block of r.localization.blocks) {
    const candidate = r.candidates.find(c => c.blockId === block.blockId);
    assert.equal(candidate.href, block.href); assert.equal(candidate.provider, block.provider); assert.equal(block.territory, null);
  }
  assert.equal(r.candidates[3].rawHref, appleHref); assert.equal(r.candidates[3].href, appleHref.replace('&amp;', '&'));
  const projection = compose(r);
  assert.deepEqual(projection.rows.map(row => row.provider.key), ['apple', 'megogo']);
  assert.equal(projection.filmLocalization.ukrainianAudio.state, 'reported-positive');
  assert.ok(projection.rows.every(row => row.country === null && row.availability.state === 'unknown' && row.access.state === 'unknown' && row.audio.state === 'unknown'));
  assert.ok(projection.rows.every(row => row.kinobazaLocalization.audio.state === 'reported-positive' && !row.countrySignal));
  const refused = await parse(body.replace('Coherence (2013)', 'Coherence (2020)'));
  assert.equal(refused.identity.status, 'unresolved'); assert.deepEqual(refused.candidates, []); assert.equal(refused.localization, undefined);
});

test('later ambiguous country panel rolls back earlier valid UA claims while preserving only independent blocks', async () => {
  const sections = countrySection('UA', 'Доступно в Україні') + countrySection('PL', 'Доступно в Польщі').replace('id="collapsePL"', 'id="changedPL"');
  const r = await parse(countryMarkup(tableBlock('itunes') + paragraphBlock('megogo'), sections));
  assert.equal(r.status, 'partial'); assert.deepEqual(r.issues, ['ambiguous-territory-panel']);
  assert.deepEqual(r.candidates.map(c => c.territory), [null, null]); assert.deepEqual(r.availabilitySignals, []);
  assert.equal(r.localization.blocks.length, 2); assert.equal(r.localization.film.ukrainianAudio.state, 'reported-positive');
  assert.ok(compose(r).rows.every(row => row.country === null && row.availability.state === 'unknown' && !row.countrySignal));
  const empty = await parse(countryMarkup('', sections, false));
  assert.equal(empty.status, 'unsupported-markup'); assert.deepEqual(empty.candidates, []); assert.equal(empty.localization, undefined);
});

test('successful UA parsing preserves seven separate Apple/Rakuten/MEGOGO/Prime observations and their order', async () => {
  const blocks = tableBlock('itunes') + paragraphBlock('rakuten') + paragraphBlock('megogo') + paragraphBlock('amazon prime');
  const sections = countrySection('UA', 'Доступно в Україні', ['Apple TV Store', 'Rakuten TV', 'Prime Video'].map(provider => providerLink(provider)).join(''));
  const r = await parse(countryMarkup(blocks, sections));
  assert.equal(r.status, 'ok'); assert.deepEqual(r.issues, []);
  assert.deepEqual(r.candidates.map(c => c.provider), ['Apple TV Store', 'Rakuten TV', 'Prime Video', 'itunes', 'rakuten', 'megogo', 'amazon prime']);
  assert.deepEqual(r.candidates.map(c => c.territory?.code ?? null), ['UA', 'UA', 'UA', null, null, null, null]);
  const projection = compose(r);
  assert.equal(projection.rows.length, 7); assert.equal(projection.unmapped.length, 0); assert.equal(r.localization.blocks.length, 4);
  assert.deepEqual(projection.rows.map(row => row.provider.key), ['apple', 'rakuten', 'prime', 'apple', 'rakuten', 'megogo', 'prime']);
  assert.ok(projection.rows.slice(0, 3).every(row => !row.kinobazaLocalization && row.audio.state === 'unknown'));
});

test('the 100-candidate cap applies across independent and country extraction and cannot be bypassed by country fallback', async () => {
  const ua = countrySection('UA', 'Доступно в Україні');
  const atCap = await parse(countryMarkup(badge('itunes').repeat(99), ua));
  assert.equal(atCap.candidates.length, 100); assert.equal(atCap.status, 'ok');
  for (const [count, sections] of [[100, ua], [101, '<p>Unsupported authored child</p>']]) {
    const r = await parse(countryMarkup(badge('itunes').repeat(count), sections));
    assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'unsupported-markup');
    assert.deepEqual(r.issues, ['candidate-count-limit']); assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined);
  }
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
