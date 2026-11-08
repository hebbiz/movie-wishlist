// An authored minimal DOM exercises the real controller; no browser/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdvice } from '../assets/media-advice.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { FILMS } from '../research/grounded-answer-demo/config.mjs';
import { extractHtml } from '../research/grounded-answer-demo/html-source.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { localizedMarkup, netflixCatalogueBlock, netflixAudioCatalogueBlock, paragraphBlock } from '../research/grounded-answer-demo/test/kinobaza-localization.fixture.mjs';
import { recommendationCarousel } from '../research/grounded-answer-demo/test/recommendation-markup.fixture.mjs';

class Element {
  constructor(tag = 'div', text = '') { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.listeners = {}; this.dataset = {}; this.hidden = false; this.open = false; this.isConnected = true; this.classList = { add: (...names) => { this.className = [...new Set([...(this.className?.split(' ') ?? []), ...names])].join(' '); } }; this.textContent = text; }
  set textContent(value) { this._text = String(value); this.children = []; } get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...items) { for (const item of items) if (item && typeof item === 'object') { item.parent = this; this.children.push(item); } }
  replaceChildren(...items) { this.textContent = ''; this.append(...items); }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; } addEventListener(key, callback) { (this.listeners[key] ??= []).push(callback); }
  async click() { for (const callback of this.listeners.click ?? []) await callback({}); } focus() {} closest(selector) { return selector.startsWith('.') && this.className?.split(' ').includes(selector.slice(1)) ? this : this.parent?.closest(selector) ?? null; }
  showModal() { this.open = true; } close() { this.open = false; for (const callback of this.listeners.close ?? []) callback({}); }
  contains(element) { return element === this || this.children.some(child => child.contains?.(element)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const matches = element => selector.startsWith('.') ? element.className?.split(' ').includes(selector.slice(1)) : element.tagName === selector.toUpperCase();
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...(child.querySelectorAll?.(selector) ?? [])]);
  }
}
const filmId = 'imdb:tt1234567';
const services = {
  apple: ['itunes', 'Apple TV / iTunes', 'https://itunes.apple.com/ua/movie/id123?at=AUTHORED%2fONLY#Anchor'],
  prime: ['amazon prime', 'Prime Video', 'https://www.primevideo.com/detail/AUTHORED?exact=%2f#Anchor'],
  hbo: ['HBO Max', 'HBO Max', 'https://click.justwatch.com/a?exact=AUTHORED%2fONLY#Anchor'],
  netflix: ['netflix', 'Netflix', 'https://www.netflix.com/ua/title/123456?exact=%2f#Anchor'],
  rakuten: ['rakuten', 'Rakuten TV', 'https://rakuten.tv/ua/movies/authored?exact=%2f#Anchor'],
  megogo: ['megogo', 'Megogo', 'https://megogo.net/ua/view/123-authored.html?exact=%2f#Anchor'],
};
function ownBlock(key, audio = 'reported-positive', subtitles = 'reported-positive') {
  const [sourceName, , href] = services[key];
  return { id: `kinobaza:${key}`, filmId, identityStatus: 'matched', provider: { key, sourceName }, country: null, kind: 'candidate-link',
    audio: { state: 'unknown' }, subtitles: { state: 'unknown' }, conflicts: [], link: { href },
    linkAudit: { blockAssociation: 'associated' }, provenance: { source: 'Kinobaza HTML' },
    price: { state: 'reported', amount: { state: 'reported', value: 'PRICE_SENTINEL' }, currency: { state: 'reported', value: 'USD' } },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: sourceName, href, territory: null, issues: [],
      audio: { state: audio, language: 'uk', evidence: [{ label: 'Укр. звук (стерео)', literal: audio === 'reported-positive' ? '+' : '−', state: audio === 'reported-positive' ? 'positive' : 'negative', formatLiteral: 'стерео' }] },
      subtitles: { state: subtitles, language: 'uk', evidence: [] } } };
}
async function harness(t, rows, extra = {}, capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: true }, form = { recommended_medium: 'DVD', purchase_url: '' }, controllerOptions = {}) {
  const entry = new Element('button'), body = new Element('body'), state = { output: null, calls: 0, opens: [], capabilities };
  const doc = { body, activeElement: entry, createElement: tag => new Element(tag), createTextNode: text => new Element('text', text),
    defaultView: { scrollY: 0, scrollTo() {}, requestAnimationFrame(callback) { callback(); }, navigator: {}, open(...args) { state.opens.push(args); } } };
  const control = createMediaAdvice({ document: doc, entry, context: () => ({ userId: 'u', groupId: 'g', imdbId: 'tt1234567', formSession: 's', title: 'Authored film' }),
    capability: async () => state.capabilities, discover: async () => { state.calls++; return { rows, film: { id: filmId, imdbId: 'tt1234567' }, ...extra }; },
    readForm: () => ({ ...form }), writeForm: fields => state.output = fields, ...controllerOptions });
  t.after(() => control.invalidate());
  await entry.click(); await new Promise(resolve => setTimeout(resolve, 0));
  const button = text => control.dialog.querySelectorAll('button').find(element => element.textContent === text);
  return { control, state, button, doc, entry };
}

test('global availability allows advice without a group or editing rights, but cannot transfer', async t => {
  const h = await harness(t, [ownBlock('apple')], {}, true, undefined, {
    context: () => ({ userId: 'u', imdbId: 'tt1234567', formSession: 's' }),
    cachedAvailability: true, canApply: () => false,
  });
  assert.equal(h.control.dialog.open, true); assert.equal(h.state.calls, 1);
  assert.equal(h.control.dialog.querySelectorAll('.media-advice-row').length, 1);
  assert.equal(h.button('Обрати').disabled, true);
  await h.button('Обрати').click();
  assert.equal(h.control.dialog.querySelector('.media-advice-preview'), null);
  await h.button('Відкрити посилання').click(); assert.equal(h.state.opens.length, 1);
  assert.equal(h.state.output, null);
});

test('transfer rechecks write rights without removing globally available read-only advice', async t => {
  let canApply = true;
  const h = await harness(t, [ownBlock('apple')], {}, true, undefined, { cachedAvailability: true, canApply: () => canApply, validateApply: async () => false });
  await h.button('Обрати').click(); canApply = false;
  await h.button('Перенести в картку').click();
  assert.equal(h.state.output, null); assert.equal(h.control.dialog.open, true);
  assert.equal(h.entry.hidden, false);
  assert.equal(h.control.dialog.querySelector('.media-advice-preview'), null);
  assert.equal(h.control.dialog.querySelectorAll('.media-advice-row').length, 1);
});

test('editing-role changes preserve a one-shot result and reject a late previously authorized apply', async t => {
  let editable = true, resolveApply;
  const pendingApply = new Promise(resolve => { resolveApply = resolve; });
  const h = await harness(t, [ownBlock('apple')], {}, true, undefined,
    { cachedAvailability: true, canApply: () => editable, validateApply: () => pendingApply });
  await h.button('Обрати').click();
  const applying = h.button('Перенести в картку').click();
  editable = false; h.control.editingAccessChanged();
  assert.equal(h.button('Обрати').disabled, true);
  assert.equal(h.control.dialog.querySelector('.media-advice-preview'), null);
  resolveApply({ mykola_media_advice: true }); await applying;
  assert.equal(h.state.output, null);
  await h.button('← До картки').click(); await h.entry.click();
  assert.equal(h.state.calls, 1); assert.equal(h.button('Обрати').disabled, true);
  editable = true; h.control.editingAccessChanged();
  assert.equal(h.button('Обрати').disabled, false);
  assert.equal(h.state.calls, 1);
});

test('cached basic availability preserves a fresh-result diagnostic affordance but does not reveal it before a fresh check', async t => {
  let resolveCheck, checks = 0;
  const pending = new Promise(resolve => { resolveCheck = resolve; });
  const h = await harness(t, [ownBlock('apple')], { capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: true } }, true, undefined,
    { cachedAvailability: true, validateDiagnostics: () => { checks++; return pending; } });
  await h.control.refresh(); assert.ok(h.button('Діагностичний звіт'));
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  const first = h.button('Діагностичний звіт').click(), second = h.button('Діагностичний звіт').click();
  await Promise.resolve(); assert.equal(checks, 1);
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  resolveCheck({ mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  await Promise.all([first, second]);
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  assert.equal(h.control.dialog.querySelectorAll('pre').length, 0);
  assert.equal(h.button('Діагностичний звіт'), undefined);
  assert.equal(h.control.dialog.querySelectorAll('.media-advice-row').length, 1);
});

test('diagnostic copy revalidates and clears revoked private DOM; stale report checks cannot revive a closed context', async t => {
  let allowed = true, checks = 0, copies = 0;
  const h = await harness(t, [ownBlock('apple')], { capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: true } }, true, undefined,
    { cachedAvailability: true, validateDiagnostics: async () => { checks++; return { mykola_media_advice: true, mykola_media_advice_diagnostics: allowed }; } });
  h.doc.defaultView.navigator.clipboard = { writeText: async () => { copies++; } };
  await h.button('Діагностичний звіт').click(); assert.equal(h.control.dialog.querySelectorAll('textarea').length, 1);
  allowed = false; await h.button('Скопіювати короткий звіт').click();
  assert.equal(checks, 2); assert.equal(copies, 0);
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  assert.equal(h.control.dialog.querySelectorAll('pre').length, 0);
  let finish;
  const old = await harness(t, [ownBlock('apple')], { capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: true } }, true, undefined,
    { cachedAvailability: true, validateDiagnostics: () => new Promise(resolve => { finish = resolve; }) });
  const showing = old.button('Діагностичний звіт').click(); await Promise.resolve();
  old.control.invalidate(); finish({ mykola_media_advice: true, mykola_media_advice_diagnostics: true }); await showing;
  assert.equal(old.control.dialog.querySelectorAll('textarea').length, 0);
  assert.equal(old.control.dialog.children.length, 0);
});

test('closing and reopening advice never resumes a protected report without a new diagnostic check', async t => {
  let allowed = true, checks = 0;
  const h = await harness(t, [ownBlock('apple')], { capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: true } }, true, undefined,
    { cachedAvailability: true, validateDiagnostics: async () => { checks++; return { mykola_media_advice: true, mykola_media_advice_diagnostics: allowed }; } });
  await h.button('Діагностичний звіт').click();
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 1);
  await h.button('← До картки').click();
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  allowed = false; await h.entry.click();
  assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  assert.equal(h.control.dialog.querySelector('.media-advice-chat').hidden, false);
  await h.button('Діагностичний звіт').click();
  assert.equal(checks, 2); assert.equal(h.control.dialog.querySelectorAll('textarea').length, 0);
  assert.equal(h.state.calls, 1);
});

test('ordinary Beta and legacy basic capability show advice and transfer without diagnostic bubble, report or source detail DOM', async t => {
  for (const capabilities of [true, { mykola_media_advice: true, mykola_media_advice_diagnostics: false }]) {
    const original = ownBlock('apple'), { control, state, button } = await harness(t, [original], {}, capabilities);
    assert.equal(control.dialog.querySelector('.media-advice-beta').textContent, 'Beta');
    assert.match(control.dialog.querySelector('.media-advice-attribution').textContent, /Поради Миколи щодо носіїв доступні в режимі бета-тестування для українського регіону/);
    assert.equal(button('Діагностичний звіт'), undefined);
    assert.equal(control.dialog.querySelectorAll('textarea').length, 0);
    assert.equal(control.dialog.querySelectorAll('pre').length, 0);
    await button('Обрати').click(); await button('Перенести в картку').click();
    assert.equal(state.output.purchase_url, original.link.href); assert.equal(state.calls, 1);
  }
});

test('fresh finish capability denies stale diagnostics or feature access despite successful initial authorization', async t => {
  const ordinary = await harness(t, [ownBlock('apple')], { capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: false } });
  assert.equal(ordinary.button('Діагностичний звіт'), undefined);
  assert.equal(ordinary.control.dialog.querySelectorAll('.media-advice-row').length, 1);
  const denied = await harness(t, [ownBlock('apple')], { capabilities: { mykola_media_advice: false, mykola_media_advice_diagnostics: false } });
  assert.equal(denied.control.dialog.open, false); assert.equal(denied.control.dialog.children.length, 0);
  assert.equal(denied.state.output, null); assert.equal(denied.state.calls, 1);
});

test('usable partial or failed sources have one inline caveat, with details and no extra failure bubble', async t => {
  for (const status of ['ok', 'partial', 'error', 'stage-failed-no-retry', 'unavailable', 'timeout', 'blocked', 'unsupported-markup']) {
    const sources = [{ source: 'kinobaza', status, identity: 'matched' }], before = JSON.stringify(sources);
    const { control, state, button } = await harness(t, [ownBlock('apple')], { sources });
    const answer = control.dialog.querySelector('.media-advice-answer').textContent;
    const incomplete = status !== 'ok';
    assert.equal(answer.includes('Деякі дані неповні, тож перевір умови на платформі.'), incomplete, status);
    assert.equal(answer.includes('Інформація не завжди точна, тож варто перевіряти.'), !incomplete, status);
    assert.doesNotMatch(control.dialog.textContent, /Частина відомостей неповна або не надійшла/);
    assert.equal(control.dialog.querySelectorAll('.mykola-bubble').length, 3, 'answer, comparison and authorized report only');
    assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 1);
    await button('Діагностичний звіт').click();
    const reportStatus = ['ok', 'partial', 'stage-failed-no-retry', 'unsupported-markup'].includes(status) ? status : 'unknown';
    assert.ok(control.dialog.querySelector('textarea').value.includes(`kinobaza: identity matched; status ${reportStatus};`), `${status}: report keeps its existing status allowlist`);
    assert.equal(JSON.stringify(sources), before); assert.equal(state.calls, 1); assert.equal(state.output, null);
  }
});

test('no-result source failures stay visible in the first answer without asserting unavailability', async t => {
  for (const status of ['partial', 'timeout', 'stage-failed-no-retry']) {
    const { control, state } = await harness(t, [], { sources: [{ source: 'kinobaza', status, identity: 'unresolved' }] });
    const answer = control.dialog.querySelector('.media-advice-answer').textContent;
    assert.match(answer, /^Не вдалося отримати повні дані від джерел\. Поки не знайшов підтверджених варіантів/);
    assert.match(answer, /Це не означає, що фільм недоступний/);
    assert.doesNotMatch(answer, /Деякі дані неповні, тож перевір умови на платформі/);
    assert.doesNotMatch(control.dialog.textContent, /Частина відомостей неповна або не надійшла/);
    assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 0);
    assert.equal(control.dialog.querySelectorAll('.mykola-bubble').length, 2, 'one honest answer and authorized report');
    assert.equal(state.calls, 1); assert.equal(state.output, null);
  }
});

test('diagnostics revocation clears existing report/copy/details and preserves ordinary result without repeating discovery', async t => {
  const { control, state, button } = await harness(t, [ownBlock('apple')]);
  await button('Діагностичний звіт').click();
  assert.equal(control.dialog.querySelectorAll('textarea').length, 1);
  assert.equal(control.dialog.querySelectorAll('pre').length, 1);
  state.capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: false };
  await control.refresh();
  assert.equal(control.dialog.open, true);
  assert.equal(control.dialog.querySelector('.media-advice-chat').hidden, false);
  assert.equal(control.dialog.querySelectorAll('textarea').length, 0);
  assert.equal(control.dialog.querySelectorAll('pre').length, 0);
  assert.equal(button('Діагностичний звіт'), undefined); assert.equal(button('Скопіювати короткий звіт'), undefined);
  assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 1);
  await button('Обрати').click(); await button('Перенести в картку').click();
  assert.equal(state.output.purchase_url, services.apple[2]); assert.equal(state.calls, 1);
});

test('unselected admitted Apple URLs remain local diagnostic text only; unsafe/refused URLs and copied report stay withheld', async t => {
  const first = ownBlock('apple'), second = { ...ownBlock('apple'), id: 'motn:alternative',
    link: { href: 'https://tv.apple.com/ua/movie/authored/umc.cmc.alternative?playableId=tvs.sbd.9001%3A456' } };
  const unsafe = { ...ownBlock('apple'), id: 'kinobaza:unsafe', link: { href: 'https://user:PRIVATE_SECRET@tv.apple.com/ua/movie/authored/umc.cmc.unsafe' } };
  const refused = { ...ownBlock('apple'), id: 'kinobaza:refused', identityStatus: 'unresolved', link: { href: 'https://itunes.apple.com/ua/movie/id987654' } };
  const rows = [first, second, unsafe, refused], before = JSON.stringify(rows);
  const { control, state, button } = await harness(t, rows);
  await button('Діагностичний звіт').click();
  const addresses = control.dialog.querySelectorAll('.media-advice-diagnostic-link');
  assert.equal(addresses.length, 2);
  assert.deepEqual(addresses.map(address => address.querySelector('p').textContent), [first.link.href, second.link.href]);
  assert.ok(addresses.every(address => address.tagName === 'DETAILS' && !address.open && !address.querySelector('a')));
  assert.equal(control.dialog.querySelectorAll('pre').length, rows.length);
  const report = control.dialog.querySelector('textarea').value;
  for (const row of rows) assert.ok(!report.includes(row.link.href));
  assert.ok(!control.dialog.textContent.includes('PRIVATE_SECRET'));
  assert.ok(!control.dialog.textContent.includes(refused.link.href));
  assert.equal(JSON.stringify(rows), before); assert.equal(state.calls, 1);
  assert.deepEqual(state.opens, []); assert.equal(state.output, null);
});

test('all six services have one accessible comparison with scoped symbols, no prices and exact original URL transfer only on apply', async t => {
  for (const key of Object.keys(services)) await t.test(key, async t => {
    const original = ownBlock(key), before = JSON.stringify(original), { control, state, button } = await harness(t, [original]);
    assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 1);
    assert.equal(control.dialog.querySelectorAll('.media-advice-variant-select').length, 0);
    const text = control.dialog.textContent;
    assert.equal(control.dialog.querySelectorAll('table').length, 1);
    const table = control.dialog.querySelector('table'), row = control.dialog.querySelector('.media-advice-row');
    assert.equal(table.querySelector('caption').textContent, 'Аудіо та субтитри — українською');
    assert.deepEqual(table.querySelector('thead').querySelectorAll('th').map(th => th.textContent), ['Сервіс', 'Доступ', 'Аудіо', 'Субтитри']);
    assert.deepEqual(row.children.map(cell => cell.tagName), ['TH', 'TD', 'TD', 'TD']);
    assert.equal(row.querySelector('th').attributes.scope, 'row');
    assert.equal(row.querySelector('th').querySelectorAll('.media-advice-symbol').length, 0, 'the service button never contains the availability symbol');
    assert.deepEqual(row.querySelectorAll('td').map(cell => cell.textContent), ['◐', '+', '+']);
    const symbols = row.querySelectorAll('.media-advice-symbol');
    assert.deepEqual(symbols.map(s => s.textContent), ['◐', '+', '+']);
    assert.match(symbols[0].attributes['aria-label'], /Кінобаз|неповн/);
    for (const symbol of symbols.slice(1)) assert.match(symbol.attributes['aria-label'], /Кінобаз.*правило застосунку/);
    assert.equal(control.dialog.querySelectorAll('.media-advice-legend').length, 1);
    const legend = control.dialog.querySelector('.media-advice-legend');
    assert.equal(legend.tagName, 'DETAILS'); assert.equal(legend.open, false);
    assert.equal(legend.querySelector('summary').textContent, 'Що означають позначки');
    assert.equal(control.dialog.querySelectorAll('.media-advice-comparison-caution').length, 0);
    const attribution = control.dialog.querySelector('.media-advice-attribution');
    assert.equal(attribution.open, false);
    assert.match(attribution.textContent, /перевіряйте на платформі/);
    assert.match(attribution.textContent, /різних пропозицій/);
    assert.match(attribution.textContent, /Брак інформації не означає відсутності доріжки/);
    assert.match(text, /за правилом застосунку, не як перевірку платформи/);
    assert.doesNotMatch(text, /PRICE_SENTINEL|USD|Ціна|Варіант перегляду/); assert.equal(state.output, null);
    await button('Відкрити посилання').click();
    assert.deepEqual(state.opens, [[services[key][2], '_blank', 'noopener,noreferrer']]);
    assert.equal(state.calls, 1); assert.equal(state.output, null);
    await button('Обрати').click(); assert.match(control.dialog.textContent, /Перевірте зміни/); assert.equal(state.output, null);
    await button('Перенести в картку').click();
    assert.deepEqual(state.output, { recommended_medium: services[key][1], purchase_url: services[key][2] });
    assert.equal(state.calls, 1); assert.equal(JSON.stringify(original), before);
    assert.equal(original.country, null); assert.equal(original.audio.state, 'unknown');
  });
});

test('source notes consolidate all limitations and retain exact attribution links and TMDb credit inside the closed section', async t => {
  const { control, state } = await harness(t, [ownBlock('apple')]);
  const section = control.dialog.querySelector('.media-advice-attribution');
  assert.equal(section.tagName, 'DETAILS'); assert.equal(section.open, false);
  assert.equal(section.querySelector('summary').textContent, 'Про джерела та обмеження');
  assert.equal(section.children.filter(child => child.tagName === 'P').length, 5);
  for (const meaning of [
    /неповними або застарілими/, /Доступність, умови перегляду й доріжки перевіряйте на платформі/,
    /Мовні дані та посилання можуть стосуватися різних пропозицій/,
    /Брак інформації не означає відсутності доріжки/,
    /підтвердженій картці Кінобази.*для України за правилом застосунку, не як перевірку платформи/,
    /«−» для окремого формату аудіо не виключає інших українських доріжок/,
    /Кінобаза й TMDb.*спільні дані JustWatch.*не незалежні підтвердження/,
    /Деякі посилання.*сторонній сервіс, що рахує переходи/,
  ]) assert.match(section.textContent, meaning);
  const footer = section.querySelector('footer'), nav = footer.querySelector('nav');
  assert.equal(footer.parent, section); assert.equal(nav.attributes['aria-label'], 'Джерела даних');
  const links = nav.querySelectorAll('a');
  assert.deepEqual(links.map(link => [link.textContent, link.href]), [
    ['TMDb', 'https://www.themoviedb.org/'], ['JustWatch', 'https://www.justwatch.com/'],
    ['Streaming Availability API by Movie of the Night', 'https://www.movieofthenight.com/about/api'], ['Кінобаза', 'https://kinobazaua.com/'],
  ]);
  assert.equal(section.querySelectorAll('a').length, 4, 'source links appear once, in the footer');
  assert.ok(links.every(link => link.target === '_blank' && link.rel === 'noopener noreferrer'));
  assert.equal(footer.querySelector('p').textContent, 'This product uses the TMDB API but is not endorsed or certified by TMDB.');
  const logo = footer.querySelector('img');
  assert.deepEqual([logo.src, logo.alt, logo.width], ['/research/grounded-answer-demo/public/tmdb-logo.svg', 'TMDB', 110]);
  assert.equal(state.calls, 1); assert.equal(state.output, null); assert.deepEqual(state.opens, []);
});

test('Apple format-negative audio visibly retains a scoped minus while subtitles and other services retain their own signs', async t => {
  const rows = [ownBlock('apple', 'reported-negative'), ownBlock('rakuten'), ownBlock('megogo')];
  const { control, state } = await harness(t, rows);
  const cards = control.dialog.querySelectorAll('.media-advice-row'); assert.equal(cards.length, 3);
  const apple = cards.find(card => card.dataset.providerKey === 'apple');
  const symbols = apple.querySelectorAll('.media-advice-symbol');
  assert.deepEqual(symbols.map(s => s.textContent), ['◐', '−*', '+']);
  assert.match(symbols[1].attributes['aria-label'], /«−» лише для зазначених форматів.*інші українські доріжки й інші пропозиції не перевірено/);
  assert.match(control.dialog.querySelector('.media-advice-legend').textContent, /−\* — позначено відсутність лише в зазначених форматах/);
  assert.doesNotMatch(control.dialog.querySelector('.media-advice-actions').textContent, /Тип доступу:|Джерело:/);
  for (const key of ['rakuten', 'megogo']) assert.deepEqual(cards.find(card => card.dataset.providerKey === key).querySelectorAll('.media-advice-symbol').map(s => s.textContent), ['◐', '+', '+']);
  assert.equal(state.calls, 1); assert.equal(state.output, null);
});

test('selecting a different comparison service replaces only shared actions, without automatic open, discovery or form write', async t => {
  const apple = ownBlock('apple'), rakuten = ownBlock('rakuten');
  const { control, state, button } = await harness(t, [rakuten, apple]);
  const services = control.dialog.querySelectorAll('.media-advice-service-select');
  assert.equal(services[0].attributes['aria-label'], 'Apple TV / iTunes');
  assert.equal(services[0].attributes['aria-pressed'], 'true');
  await services[1].click();
  assert.equal(services[1].attributes['aria-pressed'], 'true');
  assert.equal(services[0].attributes['aria-pressed'], 'false');
  assert.equal(control.dialog.querySelectorAll('button').filter(b => b.textContent === 'Обрати').length, 1);
  assert.equal(control.dialog.querySelectorAll('button').filter(b => b.textContent === 'Відкрити посилання').length, 1);
  assert.deepEqual(state.opens, []); assert.equal(state.output, null); assert.equal(state.calls, 1);
  await button('Обрати').click(); await button('Перенести в картку').click();
  assert.deepEqual(state.output, { recommended_medium: 'Rakuten TV', purchase_url: rakuten.link.href });
});

test('unadmitted block signs remain unknown; unsafe links never open and medium-only transfer invents no URL', async t => {
  const row = ownBlock('apple', 'conflicting'); row.link.href = 'javascript:alert(1)';
  const { control, state, button } = await harness(t, [row]);
  assert.equal(button('Відкрити посилання'), undefined);
  const symbols = control.dialog.querySelector('.media-advice-row').querySelectorAll('.media-advice-symbol');
  assert.deepEqual(symbols.map(s => s.textContent), ['?', '?', '?'], 'unadmitted block cannot lend its language signs');
  await button('Обрати').click(); assert.equal(state.output, null);
  await button('Перенести в картку').click();
  assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: '' });
  assert.deepEqual(state.opens, []); assert.equal(state.calls, 1);
});

test('duplicate source rows with one admitted URL need no chooser or purchase/rental labels', async t => {
  const first = ownBlock('rakuten');
  const rows = [first, { ...first, id: 'motn:rent', access: { state: 'reported', value: 'rental' } }, { ...first, id: 'tmdb:buy', access: { state: 'reported', value: 'buy' } }, { ...first, id: 'kinobaza:another-record' }];
  const before = JSON.stringify(rows), { control, state, button } = await harness(t, rows);
  assert.equal(control.dialog.querySelectorAll('select').length, 0);
  assert.doesNotMatch(control.dialog.querySelector('.media-advice-actions').textContent, /Оренда|Купівля|Варіант|motn|tmdb/);
  await button('Відкрити посилання').click();
  assert.deepEqual(state.opens, [[first.link.href, '_blank', 'noopener,noreferrer']]);
  await button('Обрати').click(); assert.equal(state.output, null);
  await button('Перенести в картку').click();
  assert.deepEqual(state.output, { recommended_medium: 'Rakuten TV', purchase_url: first.link.href });
  assert.equal(JSON.stringify(rows), before); assert.equal(state.calls, 1);
});

test('service name stays accessible while a usable emblem loads and falls back on error without changing actions', async t => {
  const original = ownBlock('apple'), { control, state, button } = await harness(t, [original]);
  const service = control.dialog.querySelector('.media-advice-service-select');
  const name = service.querySelector('.media-advice-service-name'), icon = service.querySelector('img'), slot = service.querySelector('.media-advice-icon-slot');
  assert.equal(service.attributes['aria-label'], 'Apple TV / iTunes'); assert.equal(service.attributes.title, 'Apple TV / iTunes');
  assert.equal(name.textContent, 'Apple TV / iTunes'); assert.equal(service.dataset.iconState, 'pending');
  icon.naturalWidth = 24; for (const callback of icon.listeners.load) callback();
  assert.equal(service.dataset.iconState, 'loaded'); assert.equal(icon.hidden, false);
  for (const callback of icon.listeners.error) callback();
  assert.equal(service.dataset.iconState, 'failed'); assert.equal(icon.hidden, true);
  assert.equal(slot.hidden, true, 'failed emblems leave no empty slot before the text fallback');
  for (const callback of icon.listeners.load) callback();
  assert.equal(service.dataset.iconState, 'failed', 'a late load cannot replace the established text fallback');
  assert.equal(name.textContent, 'Apple TV / iTunes'); assert.equal(service.attributes['aria-pressed'], 'true');
  await button('Обрати').click(); await button('Перенести в картку').click();
  assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: original.link.href });
  assert.equal(state.calls, 1); assert.deepEqual(state.opens, []);
});

test('a film-level audio badge remains in diagnostics without adding a separate Mykola bubble or provider track', async t => {
  const row = ownBlock('apple', 'unknown', 'unknown');
  row.kinobazaLocalization.audio = { state: 'unknown', evidence: [] };
  const { control, state, button } = await harness(t, [row], { filmLocalization: { ukrainianAudio: { state: 'reported-positive' } } });
  assert.doesNotMatch(control.dialog.textContent, /Є згадка про українське аудіо для фільму загалом/);
  const symbols = control.dialog.querySelector('.media-advice-row').querySelectorAll('.media-advice-symbol');
  assert.deepEqual(symbols.map(symbol => symbol.textContent), ['◐', '?', '?']);
  await button('Діагностичний звіт').click();
  assert.match(control.dialog.querySelector('textarea').value, /Film-level UA audio badge: reported-positive/);
  assert.equal(state.calls, 1); assert.equal(state.output, null); assert.deepEqual(state.opens, []);
});

// Authored HTML through the actual extractor, discovery and ordinary-user
// projection. These fictional film links are not captured Kinobaza responses.
const netflixFilmHref = 'https://www.netflix.com/title/900001234';
const megogoFilmHref = 'https://megogo.net/ua/view/900001235-authored.html?exact=%2f#Anchor';
async function netflixCaptionResult(href = netflixFilmHref, audioCatalogue = false) {
  const film = { ...FILMS.coherence, imdbId: 'tt1234567', year: 2013 };
  const block = audioCatalogue ? netflixAudioCatalogueBlock : netflixCatalogueBlock;
  const html = localizedMarkup(block({ href }) + paragraphBlock('megogo', '(укр. аудіо, укр. субтитри)', megogoFilmHref), 'coherence', false)
    .replace('</body>', `${audioCatalogue ? recommendationCarousel() : ''}</body>`);
  const extracted = await extractHtml(html, film);
  assert.equal(extracted.identity.status, 'matched');
  const result = composeDiscovery(film, { tmdb: { result: null }, motn: { result: null }, kinobaza: { result: extracted, status: extracted.status } });
  return { extracted, result: { ...result, rows: result.rows.filter(row => row.kinobazaLocalization), unmapped: [] } };
}

test('Netflix caption reaches the same Beta table through ordinary and diagnostic projections without catalogue audio or link borrowing', async t => {
 for (const audioCatalogue of [false, true]) {
  const { extracted, result } = await netflixCaptionResult(netflixFilmHref, audioCatalogue);
  const netflixBlock = extracted.localization.blocks.find(block => block.provider === 'netflix');
  assert.equal(netflixBlock.audio.state, audioCatalogue ? 'reported-positive' : 'unknown'); assert.equal(netflixBlock.subtitles.state, 'reported-positive');
  const before = JSON.stringify(result);
  for (const diagnostics of [false, true]) await t.test(`${audioCatalogue ? 'audio-filtered catalogue' : 'Pursuit-shaped catalogue'} / ${diagnostics ? 'diagnostic user' : 'ordinary Beta user'}`, async t => {
    const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics };
    const response = diagnostics ? { ...result, capabilities } : productMediaResult(result, capabilities);
    const netflix = response.rows.find(row => row.provider.key === 'netflix');
    assert.equal(netflix.kinobazaLocalization.audio.state, audioCatalogue ? 'reported-positive' : 'unknown');
    assert.equal(netflix.kinobazaLocalization.subtitles.state, 'reported-positive');
    const { control, state, button } = await harness(t, response.rows, response, capabilities);
    const rows = control.dialog.querySelectorAll('.media-advice-row');
    assert.equal(rows.length, 2);
    const netflixRow = rows.find(row => row.dataset.providerKey === 'netflix');
    assert.deepEqual(netflixRow.querySelectorAll('.media-advice-symbol').map(symbol => symbol.textContent), ['◐', audioCatalogue ? '+' : '?', '+']);
    assert.deepEqual(rows.find(row => row.dataset.providerKey === 'megogo').querySelectorAll('.media-advice-symbol').map(symbol => symbol.textContent), ['◐', '+', '+']);
    assert.equal(state.output, null); assert.deepEqual(state.opens, []);
    if (diagnostics) {
      await button('Діагностичний звіт').click();
      assert.ok(control.dialog.querySelector('textarea').value.includes(`kinobaza/netflix: territory unknown; Kinobaza provider-block audio ${audioCatalogue ? 'reported-positive' : 'unknown'}, subtitles reported-positive`));
      assert.ok(control.dialog.querySelectorAll('pre').some(pre => pre.textContent.includes('"literal": "укр. субтитри"')));
      await button('← До порад').click();
    } else {
      assert.equal(button('Діагностичний звіт'), undefined);
      assert.equal(control.dialog.querySelectorAll('pre').length, 0); assert.equal(control.dialog.querySelectorAll('textarea').length, 0);
      assert.ok(netflix.kinobazaLocalization.subtitles.evidence.every(evidence => !Object.hasOwn(evidence, 'literal')));
    }
    await netflixRow.querySelector('button').click();
    await button('Відкрити посилання').click();
    assert.deepEqual(state.opens, [[netflixFilmHref, '_blank', 'noopener,noreferrer']]);
    await button('Обрати').click();
    assert.equal(state.output, null, 'preview does not update even the local form');
    assert.ok(control.dialog.querySelector('.media-advice-preview').textContent.includes(netflixFilmHref));
    assert.doesNotMatch(control.dialog.querySelector('.media-advice-preview').textContent, /\/online\/netflix/);
    await button('Перенести в картку').click();
    assert.deepEqual(state.output, { recommended_medium: 'Netflix', purchase_url: netflixFilmHref });
    assert.equal(state.calls, 1);
  });
  assert.equal(JSON.stringify(result), before, 'projection/render/apply do not change source records');
 }
});

test('Netflix catalogue never substitutes for missing or unsafe film URL; clearing an existing URL remains explicit', async t => {
  for (const href of [null, 'javascript:alert(1)']) await t.test(href === null ? 'missing' : 'unsafe', async t => {
    const { result } = await netflixCaptionResult(href);
    for (const diagnostics of [false, true]) {
      const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics };
      const response = diagnostics ? { ...result, capabilities } : productMediaResult(result, capabilities);
      const { control, state, button } = await harness(t, response.rows, response, capabilities, { recommended_medium: 'DVD', purchase_url: 'https://manual.example/kept' });
      const rows = control.dialog.querySelectorAll('.media-advice-row');
      const netflixRow = rows.find(row => row.dataset.providerKey === 'netflix');
      assert.deepEqual(netflixRow.querySelectorAll('.media-advice-symbol').map(symbol => symbol.textContent), ['?', '?', '?']);
      assert.deepEqual(rows.find(row => row.dataset.providerKey === 'megogo').querySelectorAll('.media-advice-symbol').map(symbol => symbol.textContent), ['◐', '+', '+']);
      await netflixRow.querySelector('button').click();
      assert.equal(button('Відкрити посилання'), undefined);
      assert.match(control.dialog.querySelector('.media-advice-actions').textContent, /Придатного посилання немає/);
      await button('Обрати').click();
      assert.match(control.dialog.querySelector('.media-advice-preview').textContent, /Явно очистити попереднє посилання/);
      assert.equal(state.output, null); await button('Перенести в картку').click(); assert.equal(state.output, null);
      await button('Обрати').click();
      const check = control.dialog.querySelector('.media-advice-preview').querySelector('input');
      check.checked = true; for (const callback of check.listeners.change) callback();
      await button('Перенести в картку').click();
      assert.deepEqual(state.output, { recommended_medium: 'Netflix', purchase_url: '' });
      assert.deepEqual(state.opens, []); assert.equal(state.calls, 1);
      assert.ok(!JSON.stringify(state.output).includes('/online/netflix'));
    }
  });
});
