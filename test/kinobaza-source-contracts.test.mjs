// Product contracts retained from the retired local pilot. These inputs are
// authored shapes, not saved pages, reconstructed owner HTML or live claims.
// Every accepted card goes through the real product identity gate; the parser
// still rejects missing callbacks and does not learn the fixed demo catalogue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHtml } from '../netlify/lib/kinobaza-html.mjs';
import { assistedIdentity, fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { composeDiscovery } from '../netlify/lib/media-discovery-compose.mjs';
import { authoredProductFilm, authoredProductHTML, authoredProductSourceURL, extractProductHTML } from './media-advice-group.fixture.mjs';
import { CARD, markup as assistedMarkup } from './assisted-kinobaza.fixture.mjs';
import { tableBlock, paragraphBlock, badge, generalBadge, netflixCatalogueBlock, netflixAudioCatalogueBlock } from './kinobaza-localization.fixture.mjs';
import { recommendationCarousel, quotedRecommendation } from './recommendation-markup.fixture.mjs';

const film = authoredProductFilm(), sourceURL = authoredProductSourceURL(film);
const markup = (blocks = '', id = 'coherence') => authoredProductHTML(authoredProductFilm(id), generalBadge + blocks);
const parse = (html, id = 'coherence') => extractProductHTML(html, authoredProductFilm(id));
const compose = (result, id = 'coherence') => composeDiscovery(authoredProductFilm(id), {
  tmdb: { result: null }, motn: { result: null }, kinobaza: { result, status: result.status },
});
const response = body => new Response(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
const afterViewing = body => markup().replace('</body>', body + '</body>');
const brokenImage = '<img alt="Authored "quoted" trailer" src="/authored.jpg">';
const providerLink = (provider, href = 'https://example.com/authored-country') => `<a title="Дивитись / Купити на ${provider}" href="${href}"><img alt="${provider}"></a>`;
const countrySection = (code, label, anchors = providerLink('Apple TV Store')) => `<div class="accordion-item"><h2 class="accordion-header"><button data-bs-target="#collapse${code}">${label}</button></h2><div id="collapse${code}" data-bs-parent="#availabilityAccordion">${anchors}</div></div>`;
const countryMarkup = (blocks, sections, general = true) => `<!doctype html><html><head><link rel="canonical" href="${sourceURL}"></head><body><h1>Coherence (2013)</h1><h2>Coherence</h2><table><tr><td>Режисер:</td><td>James Ward Byrkit</td></tr></table>${general ? generalBadge : ''}${blocks}<div id="availabilityAccordion">${sections}</div></body></html>`;

test('source parser still requires independent film identity; nested year and inline director remain supported', async () => {
  const missing = await extractHtml(markup(), film);
  assert.equal(missing.identity.status, 'unresolved'); assert.equal(missing.identity.reason, 'identity-check-required');
  assert.deepEqual(missing.candidates, []); assert.equal(missing.localization, undefined);
  const nested = markup().replace('(2013)', '(<a>2013</a>)')
    .replace('<table><tbody><tr><td>Режисер:</td><td>James Ward Byrkit</td></tr></tbody></table>', '<div>Режисер: <a>James Ward Byrkit</a></div>');
  assert.equal((await parse(nested)).identity.status, 'matched');
});

test('source blocks retain exact hrefs, independent film badge, literal format signs and no codec inference', async () => {
  const empty = await parse(markup());
  assert.equal(empty.localization.film.ukrainianAudio.state, 'reported-positive'); assert.deepEqual(empty.localization.blocks, []);
  const r = await parse(markup(tableBlock('itunes', [['Укр. звук (стерео)', '+'], ['Укр. звук (dolby)', '-'], ['Укр. субтитри (forced)', '+']]) + paragraphBlock('megogo', '(укр. субтитри)')));
  assert.equal(r.identity.status, 'matched');
  const [apple, megogo] = r.localization.blocks;
  assert.equal(apple.audio.state, 'reported-positive'); assert.deepEqual(apple.audio.evidence.map(e => e.formatLiteral), ['стерео', 'dolby']);
  assert.equal(apple.audio.evidence[1].state, 'negative'); assert.equal(apple.subtitles.evidence[0].typeLiteral, 'forced');
  assert.equal(megogo.audio.state, 'unknown'); assert.equal(megogo.subtitles.state, 'reported-positive');
  assert.equal(apple.href, 'https://example.com/fictional?x=%2F&y=1');
  assert.equal(apple.audio.completeness, 'unknown'); assert.equal(apple.territory, null);
  assert.doesNotMatch(JSON.stringify(apple), /Atmos|5\.1|codec|channels/);
});

test('bounded audio format captions remain own-service claims, not inferred subtitles, codecs or entitlement', async () => {
  const href = 'https://megogo.net/ua/view/900000-authored.html?exact=%2f&x=1';
  for (const [caption, audio, subtitles, format] of [
    ['(укр. аудіо)', 'reported-positive', 'unknown', null],
    ['(укр. субтитри)', 'unknown', 'reported-positive', null],
    ['(укр. аудіо, укр. субтитри)', 'reported-positive', 'reported-positive', null],
    ['(укр. аудіо [5.1])', 'reported-positive', 'unknown', '5.1'],
    ['(укр. аудіо [2.0])', 'reported-positive', 'unknown', '2.0'],
    ['(укр. аудіо [7.1], укр. субтитри)', 'reported-positive', 'reported-positive', '7.1'],
    ['(укр. субтитри, укр. аудіо [5.1])', 'reported-positive', 'reported-positive', '5.1'],
  ]) {
    const html = markup(paragraphBlock('megogo', caption, href.replace('&', '&amp;')))
      .replace('title="Доступно в megogo"', 'title="Доступно в megogo з українською аудіо доріжкою / субтитрами"');
    const r = await parse(html), block = r.localization.blocks[0];
    assert.equal(r.identity.status, 'matched'); assert.deepEqual(block.issues, []); assert.equal(block.href, href);
    assert.equal(block.audio.state, audio); assert.equal(block.subtitles.state, subtitles);
    assert.equal(block.audio.evidence[0]?.formatLiteral ?? null, format);
    if (audio === 'reported-positive') assert.deepEqual(block.audio.evidence[0], {
      label: 'укр. аудіо', literal: `укр. аудіо${format ? ` [${format}]` : ''}`, state: 'positive', ...(format ? { formatLiteral: format } : {}),
    });
    assert.equal(block.audio.completeness, 'unknown'); assert.equal(block.territory, null);
    assert.doesNotMatch(JSON.stringify(block.audio), /"(?:codec|channels|availability|entitlement)":/);
  }
  assert.equal((await parse(markup(paragraphBlock('amazon prime', '(укр. аудіо [5.1])')))).localization.blocks[0].audio.state, 'reported-positive');
});

test('caption parsing retains plain-span and no-neighbour boundaries and refuses unknown formats as a whole', async () => {
  const valid = await parse(markup(paragraphBlock('megogo', '<span>(укр. аудіо [5.1])</span>') + paragraphBlock('netflix', '(укр. субтитри)')));
  assert.deepEqual(valid.localization.blocks.map(b => [b.audio.state, b.subtitles.state]), [['reported-positive', 'unknown'], ['unknown', 'reported-positive']]);
  for (const block of [
    paragraphBlock('megogo', '(укр. аудіо [5.1])').replace('</p>', `${badge('netflix')}</p>`),
    paragraphBlock('megogo', '<span>(укр. аудіо [5.1])</span><span>(укр. субтитри)</span>'),
    paragraphBlock('megogo', '<span><b>(укр. аудіо [5.1])</b></span>'),
    paragraphBlock('megogo', '(укр. аудіо [5.1])<a href="https://example.com/another">Another offer</a>'),
    `<p class="mt-2">${badge('megogo')}</p><p>(укр. аудіо [5.1])</p>`,
  ]) assert.ok((await parse(markup(block))).localization.blocks.every(b => b.audio.state === 'unknown' && b.subtitles.state === 'unknown'));
  for (const caption of [
    '(укр. аудіо [])', '(укр. аудіо [0.1])', '(укр. аудіо [12.1])', '(укр. аудіо [5.10])',
    '(укр. аудіо [5.1.2])', '(укр. аудіо [Dolby])', '(укр. аудіо [5.1)', '(укр. аудіо [[5.1]])',
    '(укр. субтитри [5.1])', '(укр. аудіо [5.1], невідомо)', '(укр. аудіо [5.1], укр. субтитри [5.1])',
    '(укр. аудіо [5.1], укр. субтитри, укр. аудіо)', '(не укр. аудіо [5.1])',
    '(укр. аудіо [5.1]) extra', '(укр. аудіо [Bearer private])', '(' + 'x'.repeat(101) + ')',
  ]) {
    const block = (await parse(markup(paragraphBlock('megogo', caption)))).localization.blocks[0];
    assert.equal(block.audio.state, 'unknown', caption); assert.equal(block.subtitles.state, 'unknown', caption);
  }
});

test('table precedence retains negative, unknown, absent, empty and conflicting labels rather than positive captions', async () => {
  for (const provider of ['megogo', 'netflix', 'itunes']) for (const [rows, audio, subtitles] of [
    [[['Укр. звук', '-'], ['Укр. субтитри', '-']], 'reported-negative', 'reported-negative'],
    [[['Укр. звук', '?'], ['Укр. субтитри', '']], 'unknown', 'unknown'],
    [[['Мова оригіналу', 'українська']], 'unknown', 'unknown'],
    [[], 'unknown', 'unknown'],
    [[['Укр. субтитри', '+']], 'unknown', 'reported-positive'],
    [[['Укр. звук', '+'], ['Укр. звук', '-']], 'conflicting', 'unknown'],
  ]) {
    const html = markup(tableBlock(provider, rows).replace('</table>', '</table> (укр. аудіо [5.1], укр. субтитри)'));
    const own = (await parse(html)).localization.blocks[0];
    assert.equal(own.audio.state, audio); assert.equal(own.subtitles.state, subtitles);
    assert.ok(own.audio.evidence.every(e => e.label !== 'укр. аудіо'));
    assert.ok(own.subtitles.evidence.every(e => e.label !== 'укр. субтитри'));
  }
});

test('Netflix catalogue controls are navigation; only the exact film link and own caption supply source claims', async () => {
  for (const builder of [netflixCatalogueBlock, netflixAudioCatalogueBlock]) for (const [caption, audio, subtitles] of [
    ['', 'unknown', 'unknown'], ['(укр. субтитри)', 'unknown', 'reported-positive'],
    ['(укр. аудіо)', 'reported-positive', 'unknown'], ['(укр. аудіо, укр. субтитри)', 'reported-positive', 'reported-positive'],
  ]) {
    const href = 'https://www.netflix.com/title/900001234?authored=%2fEXACT&x=1';
    const r = await parse(markup(builder({ href: href.replace('&', '&amp;'), caption })));
    assert.equal(r.identity.status, 'matched');
    const block = r.localization.blocks[0], candidates = r.candidates.filter(c => c.provider === 'netflix');
    assert.equal(block.audio.state, audio); assert.equal(block.subtitles.state, subtitles); assert.deepEqual(block.issues, []);
    assert.equal(block.href, href); assert.equal(candidates.length, 1); assert.equal(candidates[0].href, href);
    assert.equal(candidates[0].blockId, block.blockId); assert.ok(!r.candidates.some(c => c.href?.includes('/online/')));
    const row = compose(r).rows.find(row => row.provider.key === 'netflix');
    assert.equal(row.link.href, href); assert.equal(row.country, null); assert.equal(row.availability.state, 'unknown');
    assert.equal(row.audio.state, 'unknown'); assert.equal(row.subtitles.state, 'unknown');
    assert.equal(row.kinobazaLocalization.audio.state, audio); assert.equal(row.kinobazaLocalization.subtitles.state, subtitles);
  }
  const direct = netflixCatalogueBlock().replace('<span>(укр. субтитри)</span>', ' (укр. субтитри) ');
  assert.equal((await parse(markup(direct))).localization.blocks[0].subtitles.state, 'reported-positive');
});

test('Netflix catalogue never replaces a missing or unsafe film URL, or transfers language to an adjacent service', async () => {
  for (const builder of [netflixCatalogueBlock, netflixAudioCatalogueBlock]) for (const href of [null, 'javascript:alert(1)']) {
    const r = await parse(markup(builder({ href })));
    const block = r.localization.blocks[0], candidates = r.candidates.filter(c => c.provider === 'netflix');
    assert.equal(block.href, null); assert.equal(block.subtitles.state, 'reported-positive');
    assert.equal(candidates.length, 1); assert.equal(candidates[0].href, null); assert.ok(!JSON.stringify(candidates).includes('/online/netflix'));
    const row = compose(r).rows.find(row => row.provider.key === 'netflix');
    assert.equal(row.link.href, null); assert.equal(row.link.transferable, false); assert.ok(!JSON.stringify(row).includes('javascript:alert'));
  }
  const html = markup(netflixCatalogueBlock() + paragraphBlock('megogo', '(укр. аудіо)', 'https://megogo.net/ua/view/900000-authored.html'));
  const r = await parse(html);
  assert.deepEqual(r.localization.blocks.map(b => [b.audio.state, b.subtitles.state]), [['unknown', 'reported-positive'], ['reported-positive', 'unknown']]);
  const refused = await parse(html.replace('Coherence (2013)', 'Coherence (2020)'));
  assert.notEqual(refused.identity.status, 'matched'); assert.deepEqual(refused.candidates, []); assert.equal(refused.localization, undefined);
  assert.deepEqual(compose(refused).rows, []);
});

test('changed Netflix catalogue semantics, labels, spans, providers or nested elements cannot lend caption claims', async () => {
  for (const builder of [netflixCatalogueBlock, netflixAudioCatalogueBlock]) {
    const base = builder(), catalogue = base.slice(base.indexOf('<a href="/online/netflix'));
    const examples = [
      builder({ catalogueHref: '/online/megogo' }), builder({ catalogueHref: '/online/netflix?authored=1' }),
      builder({ catalogueHref: 'https://kinobazaua.com/online/netflix' }),
      builder({ catalogueHref: 'https://other.example/online/netflix' }),
      base.replace('на Netflix', 'на MEGOGO'), base.replace('</p>', `${badge('megogo')}</p>`),
      base.replace('</span>', '</span><span>(укр. аудіо)</span>'), base.replace('<span>', '<span class="authored-unrecognized">'),
      base.replace('<span>', '<em>').replace('</span>', '</em>'),
      base.replace('<span>', '<span><b>').replace('</span>', '</b></span>'), base.replace('</p>', catalogue),
    ];
    if (builder === netflixAudioCatalogueBlock) examples.push(
      builder({ catalogueHref: '/online/netflix?netflix_audio=0' }),
      builder({ catalogueHref: '/online/netflix?netflix_audio=1&amp;extra=1' }),
      builder({ catalogueHref: '/online/netflix?netflix_audio=%31' }),
      base.replace('Інші з укр. аудіо →', 'Інші фільми →'),
      base.replace('Інші з укр. аудіо →', '<span>Інші з укр. аудіо →</span>'),
    ); else examples.push(base.replace('Інші фільми →', 'Інший сервіс →'));
    for (const [index, html] of examples.entries()) {
      const r = await parse(markup(html)), block = r.localization.blocks.find(b => b.provider === 'netflix');
      assert.ok(block, `case ${index}`); assert.equal(block.audio.state, 'unknown', `audio ${index}`);
      assert.equal(block.subtitles.state, 'unknown', `subtitles ${index}`);
      assert.ok(block.issues.some(issue => ['ambiguous-provider-block', 'unsupported-provider-block'].includes(issue)));
      assert.ok(!r.candidates.some(c => c.href?.includes('/online/')));
    }
  }
});

test('ambiguous provider blocks and duplicate source blocks never merge language or infer an offered track', async () => {
  for (const block of [
    `${badge('itunes')}<span>(укр. аудіо)</span>`, `<p class="mt-2">${badge('itunes')}${badge('megogo')}(укр. аудіо)</p>`,
    paragraphBlock('itunes', 'Original language Ukrainian (укр. аудіо)'),
    tableBlock().replace('<table>', `${badge('megogo')}<table>`), tableBlock().replace('alt="Доступно в itunes"', 'alt="Доступно в megogo"'),
    tableBlock().replace('<table>', '<script>throw new Error("NEVER EXECUTE")</script><table>'),
    tableBlock().replace('<table>', '<table><tr><td><table></table></td></tr>'),
    tableBlock('itunes', Array.from({ length: 65 }, () => ['Укр. звук', '+'])),
    paragraphBlock('itunes', '').replace('Доступно в itunes"', 'Купити в itunes з українською аудіо доріжкою / субтитрами"'),
  ]) assert.ok((await parse(markup(block))).localization.blocks.every(b => b.audio.state === 'unknown' && b.subtitles.state === 'unknown'));
  const r = await parse(markup(tableBlock('itunes', [['Укр. звук', '+']], 'https://example.com/one') + tableBlock('itunes', [['Укр. звук', '-']], 'https://example.com/two')));
  assert.equal(new Set(r.localization.blocks.map(b => b.blockId)).size, 2);
  assert.deepEqual(r.localization.blocks.map(b => b.audio.state), ['reported-positive', 'reported-negative']);
  assert.ok(r.localization.blocks.every(b => b.issues.includes('possible-block-conflict-scope-unestablished')));
  assert.deepEqual(compose(r).rows.filter(r => r.kinobazaLocalization).map(r => r.link.href), ['https://example.com/one', 'https://example.com/two']);
});

test('foreign-only and ambiguous country panels preserve independent blocks without lending UA availability', async () => {
  const sections = countrySection('PL', 'Доступно в Польщі') + countrySection('CZ', 'Доступно в Чехії') + countrySection('DE', 'Доступно в Німеччині');
  const body = countryMarkup(tableBlock('itunes') + paragraphBlock('megogo'), sections), r = await parse(body);
  assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'partial'); assert.deepEqual(r.issues, ['missing-explicit-ukraine-section']);
  assert.deepEqual(r.candidates.map(c => c.territory?.code ?? null), ['PL', 'CZ', 'DE', null, null]);
  assert.deepEqual(r.availabilitySignals.map(s => s.territory.code), ['PL', 'CZ', 'DE']);
  const projection = compose(r);
  assert.deepEqual(projection.rows.map(row => row.provider.key), ['apple', 'megogo']);
  assert.ok(projection.rows.every(row => row.country === null && row.availability.state === 'unknown' && row.access.state === 'unknown' && row.audio.state === 'unknown' && !row.countrySignal));
  const ambiguous = countrySection('UA', 'Доступно в Україні') + countrySection('PL', 'Доступно в Польщі').replace('id="collapsePL"', 'id="changedPL"');
  const partial = await parse(countryMarkup(tableBlock('itunes') + paragraphBlock('megogo'), ambiguous));
  assert.equal(partial.status, 'partial'); assert.deepEqual(partial.issues, ['ambiguous-territory-panel']);
  assert.deepEqual(partial.candidates.map(c => c.territory), [null, null]); assert.deepEqual(partial.availabilitySignals, []);
  assert.equal(partial.localization.blocks.length, 2); assert.equal(partial.localization.film.ukrainianAudio.state, 'reported-positive');
  const empty = await parse(countryMarkup('', ambiguous, false));
  assert.equal(empty.status, 'unsupported-markup'); assert.deepEqual(empty.candidates, []); assert.equal(empty.localization, undefined);
});

test('country and independent observations retain order and share a hard100-candidate cap, including country failure', async () => {
  const blocks = tableBlock('itunes') + paragraphBlock('rakuten') + paragraphBlock('megogo') + paragraphBlock('amazon prime');
  const sections = countrySection('UA', 'Доступно в Україні', ['Apple TV Store', 'Rakuten TV', 'Prime Video'].map(provider => providerLink(provider)).join(''));
  const r = await parse(countryMarkup(blocks, sections));
  assert.equal(r.status, 'ok'); assert.deepEqual(r.issues, []);
  assert.deepEqual(r.candidates.map(c => c.provider), ['Apple TV Store', 'Rakuten TV', 'Prime Video', 'itunes', 'rakuten', 'megogo', 'amazon prime']);
  assert.deepEqual(r.candidates.map(c => c.territory?.code ?? null), ['UA', 'UA', 'UA', null, null, null, null]);
  assert.deepEqual(compose(r).rows.map(row => row.provider.key), ['apple', 'rakuten', 'prime', 'apple', 'rakuten', 'megogo', 'prime']);
  const ua = countrySection('UA', 'Доступно в Україні');
  const atCap = await parse(countryMarkup(badge('itunes').repeat(99), ua));
  assert.equal(atCap.candidates.length, 100); assert.equal(atCap.status, 'ok');
  for (const [count, sections] of [[100, ua], [101, '<p>Unsupported authored child</p>']]) {
    const refused = await parse(countryMarkup(badge('itunes').repeat(count), sections));
    assert.equal(refused.identity.status, 'matched'); assert.equal(refused.status, 'unsupported-markup');
    assert.deepEqual(refused.issues, ['candidate-count-limit']); assert.deepEqual(refused.candidates, []); assert.equal(refused.localization, undefined);
  }
});

test('source href raw spelling, relative and unsafe forms, excluded elements and country ambiguity remain bounded', async () => {
  const normal = await parse(markup());
  assert.deepEqual(normal.candidates.map(c => c.territory?.code ?? null), ['UA', 'PL', null]);
  assert.equal(normal.candidates[0].href, 'https://example.com/redirect?x=%2F&y=1');
  assert.equal(normal.candidates[0].rawHref, 'https://example.com/redirect?x=%2F&amp;y=1');
  assert.equal(normal.candidates[2].href, '/relative?x=%2F&y=1');
  assert.ok(normal.candidates.every(c => !Object.hasOwn(c, 'availability')));
  for (const href of ['javascript:alert(1)', 'java&#x73;cript:alert(1)', 'data:text/html,bad', 'file:///C:/private', 'https://user:password@example.com/', 'https://example.com/white space']) {
    const r = await parse(markup().replace('https://example.com/redirect?x=%2F&amp;y=1', href));
    assert.equal(r.candidates[0].href, null); assert.equal(r.candidates[0].status, 'unresolved');
    assert.ok(!JSON.stringify(r).includes('user:password'));
  }
  const missing = await parse(markup().replace('href="https://example.com/redirect?x=%2F&amp;y=1"', ''));
  assert.equal(missing.candidates[0].issue, 'missing-href'); assert.equal(missing.candidates[0].href, null);
  const a = '<a title="Дивитись / Купити на Excluded" href="https://example.com/not-an-offer">Excluded</a>';
  const inert = markup().replace('<a href="https://www.justwatch.com/ua/">', `<nav>${a}</nav><aside>${a}</aside><div class="advertisement">${a}</div><div class="trailer">${a}</div><script>${a}</script><template>${a}</template><a href="https://www.justwatch.com/ua/">`);
  assert.equal((await parse(inert)).candidates.length, 3);
  for (const [body, issue] of [
    [markup().replace('Доступно в Україні', 'Український інтерфейс'), 'unsupported-or-conflicting-territory'],
    [markup().replace('data-bs-target="#collapseUA"', 'data-bs-target="#collapsePL"'), 'unsupported-or-conflicting-territory'],
    [markup().replace('id="collapseUA"', 'id="collapseXX"'), 'ambiguous-territory-panel'],
  ]) {
    const r = await parse(body);
    assert.equal(r.status, 'partial'); assert.equal(r.identity.status, 'matched');
    assert.deepEqual(r.issues, ['not-an-absolute-provider-url', issue]); assert.equal(r.candidates.length, 1);
    assert.equal(r.candidates[0].provider, 'Example Outside'); assert.deepEqual(r.availabilitySignals, []);
  }
});

test('located noncritical image and recommendation attribute recovery preserves exactly the independently gated claims', async () => {
  const expected = await parse(markup());
  for (const [content, code] of [[brokenImage, 'noncritical-image-markup-recovered'],
    [recommendationCarousel() + recommendationCarousel(), 'noncritical-recommendation-markup-recovered']]) {
    const r = await parse(afterViewing(content));
    assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'partial');
    assert.deepEqual(r.candidates, expected.candidates); assert.deepEqual(r.localization, expected.localization);
    assert.deepEqual(r.availabilitySignals, expected.availabilitySignals); assert.deepEqual(r.issues, [...expected.issues, code]);
    assert.ok(!JSON.stringify(r).includes('authored-other-film'));
  }
});

test('critical, misplaced, duplicate, swallowed or over-limit attribute errors refuse before any identity evaluation', async () => {
  const carousel = recommendationCarousel(), append = afterViewing;
  const cases = [
    markup().replace('<h1>', `${brokenImage}<h1>`), markup().replace('<div id="collapseUA"', `${brokenImage}<div id="collapseUA"`),
    ...['h1', 'h2'].map(tag => append(`<${tag}>${brokenImage}</${tag}>`)),
    append(`<table><tbody><tr><td>${brokenImage}</td></tr></tbody></table>`),
    append(`<table>${brokenImage}<tbody><tr><td>Authored</td></tr></tbody></table>`),
    append(`<a title="Дивитись / Купити на Apple TV" href="https://example.com/">${brokenImage}</a>`),
    append('<img alt="Authored "broken" swallowed <h1> title">'),
    append('<img alt="one" alt="two">'), append('<img src="/x\u0000">'),
    append(brokenImage.repeat(12) + '<img alt="first" alt="second">'), append(brokenImage.repeat(257)),
    append(brokenImage).replace('</head>', '<link rel="canonical" href="first" href="second"></head>'),
    append(brokenImage).replace('data-bs-target="#collapseUA"', 'data-bs-target="#collapseUA" data-bs-target="#collapsePL"'),
    append(brokenImage).replace('id="collapseUA"', 'id="collapseUA" id="collapsePL"'),
    append(brokenImage).replace('href="https://example.com/redirect', 'href="first" href="https://example.com/redirect'),
    append(brokenImage).replace('</div><script>', '<script>'),
    append(brokenImage).replace('id="availabilityAccordion"', 'id="changed"'),
    append(`<div id="availabilityAccordion"></div>${brokenImage}`),
    append(quotedRecommendation), markup().replace('<h1>', `${carousel}<h1>`),
    markup().replace('<div id="collapseUA"', `${carousel}<div id="collapseUA"`),
    append(carousel.replace('scrolling-wrapper-flexbox"', 'unrecognized-wrapper"')),
    append(carousel.replace('scrolling-wrapper-flexbox__item me-1', 'other-item')),
    append(carousel.replace('</a>', '')), append(carousel.replace('</div></div>', '')),
    append(`<table><tbody><tr><td>${carousel}</td></tr></tbody></table>`),
    append(`<table>${carousel}<tbody><tr><td>Foster-parented</td></tr></tbody></table>`),
    ...['<h1>Other film (2020)</h1>', '<h2>Other title</h2>', '<table><tr><td>Director</td></tr></table>',
      '<link rel="canonical" href="https://example.com/other">', '<div id="availabilityAccordion"></div>',
      '<a title="Доступно в netflix" href="https://www.netflix.com/title/999999">Netflix</a>']
      .map(critical => append(recommendationCarousel(quotedRecommendation + critical))),
    append(carousel.replace('title="Authored "quoted" recommendation"', 'title="Authored "quoted <h1>swallowed</h1>"')),
    append(carousel.replace('<a href=', '<a data-x="one" data-x="two" href=')),
    append(carousel + '<img alt="duplicate" alt="duplicate">'), append(recommendationCarousel(quotedRecommendation.repeat(100))),
    append(carousel).replace('id="availabilityAccordion"', 'id="changed"'),
    append(recommendationCarousel('<svg><a href="/authored" title="Authored "quoted" recommendation"></a></svg>')),
  ];
  for (const [index, html] of cases.entries()) {
    let checks = 0;
    const r = await extractHtml(html, film, { identityCheck: all => { checks++; return assistedIdentity(all, film, sourceURL); } });
    assert.equal(r.status, 'unsupported-markup', `case ${index}`); assert.deepEqual(r.issues, ['html-parse-errors'], `case ${index}`);
    assert.equal(checks, 0, `case ${index}: invalid parsing cannot reach identity`); assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined);
  }
});

test('malformed post-viewing recommendation content cannot supply a missing film director', async () => {
  for (const label of ['Режисер:', '<span>Режисер:</span>', '<strong>Режисер:</strong>', '<b>Режисер:</b>']) {
    const html = markup().replace('<table><tbody><tr><td>Режисер:</td><td>James Ward Byrkit</td></tr></tbody></table>', '')
      .replace('</body>', `${recommendationCarousel(quotedRecommendation + `<div>${label}<a href="/persons/authored">James Ward Byrkit</a></div>`)}</body>`);
    let calls = 0;
    const r = await extractHtml(html, film, { identityCheck: all => { calls++; return assistedIdentity(all, film, sourceURL); } });
    assert.equal(calls, 0); assert.equal(r.status, 'unsupported-markup'); assert.deepEqual(r.issues, ['html-parse-errors']); assert.deepEqual(r.candidates, []);
  }
});

test('bounded card transport keeps one GET, manual redirects and no secrets, cookie, destination, raw archive or retry', async () => {
  const calls = [];
  const good = await fetchAssistedKinobaza(sourceURL, film, async (url, init) => { calls.push({ url, init }); return response(markup()); });
  assert.equal(good.identity.status, 'matched'); assert.equal(calls.length, 1); assert.equal(calls[0].url, sourceURL);
  assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.body, undefined);
  assert.doesNotMatch(JSON.stringify(calls[0].init.headers), /cookie|authorization|api-key/i); assert.ok(!Object.hasOwn(good, 'html'));
  await assert.rejects(() => fetchAssistedKinobaza('https://example.com', film, () => assert.fail('No arbitrary fetch')));
  for (const code of [301, 302, 307, 403, 429, 500]) {
    let count = 0;
    const r = await fetchAssistedKinobaza(sourceURL, film, async () => { count++; return new Response('PRIVATE_ERROR_BODY', { status: code, headers: { location: 'https://example.com/no-follow' } }); });
    assert.equal(count, 1); assert.equal(r.httpStatus, code); assert.match(r.status, code < 400 ? /redirect-not-followed/ : /no-retry/);
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_ERROR_BODY|example.com/);
  }
  for (const [reply, expected] of [
    [() => new Response('x', { headers: { 'content-type': 'text/html', 'content-length': '999' } }), 'response-too-large'],
    [() => response('x'.repeat(50)), 'response-too-large'],
    [() => new Response('x', { headers: { 'content-type': 'application/json' } }), 'unsupported-content-type'],
    [() => new Response('x', { headers: { 'content-type': 'text/html; charset=windows-1251' } }), 'unsupported-content-type'],
    [() => new Response(new Uint8Array([255]), { headers: { 'content-type': 'text/html' } }), 'network-or-decoding-error-no-retry'],
    [() => new Promise(() => {}), 'timeout-or-cancelled-no-retry'],
    [() => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/html' } }), 'timeout-or-cancelled-no-retry'],
    [() => response('cf-chl-PRIVATE_CHALLENGE'), 'challenge-unsupported-no-retry'],
  ]) {
    let count = 0;
    const r = await fetchAssistedKinobaza(sourceURL, film, async () => { count++; return reply(); }, { maxBytes: 32, timeoutMs: 30 });
    assert.equal(r.status, expected); assert.equal(count, 1); assert.deepEqual(r.candidates, []);
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_CHALLENGE/);
  }
});

// Retain the original authored title-scope probes as product contracts, now
// directly through fetchAssistedKinobaza rather than the demo workflow/server.
const selected = { id: 'tmdb:999900001', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: [], directorAliases: ['Authored director'], directorCount: 1 };
const original = '<h2>Authored original</h2>', scopeReason = 'source-original-title-scope-unestablished';
const conflict = '<tr><td>IMDb:</td><td>tt999900002</td></tr>';
const titleCases = [
  ['one supported candidate', assistedMarkup(), 'matched', 'explicit-title-year-director-match'],
  ['one nested H2 value', assistedMarkup().replace(original, '<h2><span>Authored</span> <em>original</em></h2>'), 'matched', 'explicit-title-year-director-match'],
  ['unsupported invented container with repeated headings', assistedMarkup().replace(original, '<section data-authored-role="film-metadata"><h2>Authored original</h2><h2>Authored original</h2></section>'), 'unresolved', scopeReason],
  ['repeated normalized title', assistedMarkup().replace(original, original + '<h2> AUTHORED   original </h2>'), 'unresolved', scopeReason],
  ['matching then conflicting H2', assistedMarkup().replace(original, original + '<h2>Other authored original</h2>'), 'unresolved', scopeReason],
  ['conflicting then matching H2', assistedMarkup().replace(original, '<h2>Other authored original</h2>' + original), 'unresolved', scopeReason],
  ['known aliases do not establish H2 roles', assistedMarkup().replace(original, original + '<h2>Вигаданий фільм</h2>'), 'unresolved', scopeReason],
  ['unknown recommendations heading inside metadata', assistedMarkup().replace(original, original + '<section><h2>Authored recommendations</h2></section>'), 'unresolved', scopeReason],
  ['unknown availability heading inside metadata', assistedMarkup().replace(original, original + '<section><h2>Authored availability</h2></section>'), 'unresolved', scopeReason],
  ['matching H2 after boundary cannot repair metadata', assistedMarkup({ original: 'Unestablished metadata title' }).replace('</body>', `<section>${original}</section></body>`), 'unresolved', 'source-original-title-unestablished'],
  ['H2 before H1 cannot repair metadata', assistedMarkup({ original: 'Unestablished metadata title' }).replace('<body>', '<body>' + original), 'unresolved', 'source-original-title-unestablished'],
  ['excluded navigation H2 cannot repair metadata', assistedMarkup({ original: 'Unestablished metadata title' }).replace('</h1>', '</h1><nav>' + original + '</nav>'), 'unresolved', 'source-original-title-unestablished'],
  ['unrelated H2 after boundary does not contaminate metadata', assistedMarkup().replace('</body>', '<h2>Other authored film</h2></body>'), 'matched', 'explicit-title-year-director-match'],
  ['availability headings remain outside title scope', assistedMarkup(), 'matched', 'explicit-title-year-director-match'],
  ['missing H2', assistedMarkup().replace(original, ''), 'unresolved', 'source-identity-structure-incomplete'],
  ['missing H1', assistedMarkup().replace(/<h1>[^<]*<\/h1>/, ''), 'unresolved', 'source-identity-structure-incomplete'],
  ['missing viewing boundary', assistedMarkup().replace('id="availabilityAccordion"', 'id="authored-other"'), 'unresolved', 'source-identity-structure-incomplete'],
  ['duplicate viewing boundaries', assistedMarkup().replace('</body>', '<div id="availabilityAccordion"></div></body>'), 'unresolved', 'source-identity-structure-incomplete'],
  ['viewing boundary before title', assistedMarkup().replace('<body>', '<body><div id="availabilityAccordion"></div>').replace('id="availabilityAccordion"><div class=', 'id="authored-other"><div class='), 'unresolved', 'source-identity-structure-incomplete'],
  ['neutral single-H2 nesting', assistedMarkup().replace(original, '<section><div>' + original + '</div></section>'), 'matched', 'explicit-title-year-director-match'],
  ['director before H2 within metadata interval', assistedMarkup().replace(original, '').replace('</table>', '</table>' + original), 'matched', 'explicit-title-year-director-match'],
  ['ID conflict overrides agreeing fields', assistedMarkup({ stable: conflict }), 'mismatch', 'source-stable-id-conflict'],
  ['ID conflict overrides competing H2', assistedMarkup({ stable: conflict }).replace(original, original + '<h2>Other original</h2>'), 'mismatch', 'source-stable-id-conflict'],
  ['matching ID does not erase unresolved H2 scope', assistedMarkup({ stable: '<tr><td>IMDb:</td><td>tt999900001</td></tr>' }).replace(original, original + '<h2>Other original</h2>'), 'unresolved', scopeReason],
  ['ID conflict overrides missing viewing boundary', assistedMarkup({ stable: conflict }).replace('id="availabilityAccordion"', 'id="authored-other"'), 'mismatch', 'source-stable-id-conflict'],
];
for (const [name, html, status, reason] of titleCases) test(`product metadata boundary: ${name}`, async () => {
  let calls = 0;
  const r = await fetchAssistedKinobaza(CARD, selected, async (url, init) => {
    calls++; assert.equal(url, CARD); assert.equal(init.redirect, 'manual'); return response(html);
  });
  assert.equal(r.identity.status, status); assert.equal(r.identity.reason, reason); assert.equal(calls, 1);
  if (status !== 'matched') { assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined); }
});
