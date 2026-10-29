// An authored minimal DOM exercises the real controller; no browser/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdvice } from '../assets/media-advice.mjs';

class Element {
  constructor(tag = 'div', text = '') { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.listeners = {}; this.dataset = {}; this.hidden = false; this.open = false; this.isConnected = true; this.classList = { add: () => {} }; this.textContent = text; }
  set textContent(value) { this._text = String(value); this.children = []; } get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...items) { for (const item of items) if (item && typeof item === 'object') { item.parent = this; this.children.push(item); } }
  replaceChildren(...items) { this.textContent = ''; this.append(...items); }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; } addEventListener(key, callback) { (this.listeners[key] ??= []).push(callback); }
  async click() { for (const callback of this.listeners.click ?? []) await callback({}); } focus() {} closest() { return null; }
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
async function harness(t, rows) {
  const entry = new Element('button'), body = new Element('body'), state = { output: null, calls: 0, opens: [] };
  const doc = { body, activeElement: entry, createElement: tag => new Element(tag), createTextNode: text => new Element('text', text),
    defaultView: { scrollY: 0, scrollTo() {}, requestAnimationFrame(callback) { callback(); }, navigator: {}, open(...args) { state.opens.push(args); } } };
  const control = createMediaAdvice({ document: doc, entry, context: () => ({ userId: 'u', groupId: 'g', imdbId: 'tt1234567', formSession: 's', title: 'Authored film' }),
    capability: async () => true, discover: async () => { state.calls++; return { rows, film: { id: filmId, imdbId: 'tt1234567' } }; },
    readForm: () => ({ recommended_medium: 'DVD', purchase_url: '' }), writeForm: fields => state.output = fields });
  t.after(() => control.invalidate());
  await entry.click(); await new Promise(resolve => setTimeout(resolve, 0));
  const button = text => control.dialog.querySelectorAll('button').find(element => element.textContent === text);
  return { control, state, button };
}

test('all six services have one accessible comparison with scoped symbols, no prices and exact original URL transfer only on apply', async t => {
  for (const key of Object.keys(services)) await t.test(key, async t => {
    const original = ownBlock(key), before = JSON.stringify(original), { control, state, button } = await harness(t, [original]);
    assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 1);
    assert.equal(control.dialog.querySelectorAll('.media-advice-variant-select').length, 0);
    const text = control.dialog.textContent;
    assert.equal(control.dialog.querySelectorAll('table').length, 1);
    const symbols = control.dialog.querySelector('.media-advice-row').querySelectorAll('.media-advice-symbol');
    assert.deepEqual(symbols.map(s => s.textContent), ['◐', '+', '+']);
    assert.match(symbols[0].attributes['aria-label'], /Кінобаз|неповн/);
    for (const symbol of symbols.slice(1)) assert.match(symbol.attributes['aria-label'], /Кінобаз.*правило застосунку/);
    assert.equal(control.dialog.querySelectorAll('.media-advice-legend').length, 1);
    assert.equal(control.dialog.querySelectorAll('.media-advice-comparison-caution').length, 1);
    assert.match(text, /не незалежна перевірка доступності/);
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

test('Apple format-negative audio stays unknown overall while subtitles and other services retain their own signs', async t => {
  const rows = [ownBlock('apple', 'reported-negative'), ownBlock('rakuten'), ownBlock('megogo')];
  const { control, state } = await harness(t, rows);
  const cards = control.dialog.querySelectorAll('.media-advice-row'); assert.equal(cards.length, 3);
  const apple = cards.find(card => card.dataset.providerKey === 'apple');
  const symbols = apple.querySelectorAll('.media-advice-symbol');
  assert.deepEqual(symbols.map(s => s.textContent), ['◐', '?', '+']);
  assert.match(symbols[1].attributes['aria-label'], /формати.*інших українських доріжок невідома/);
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

test('service name remains available until a usable emblem loads and falls back on error without changing actions', async t => {
  const original = ownBlock('apple'), { control, state, button } = await harness(t, [original]);
  const service = control.dialog.querySelector('.media-advice-service-select');
  const name = service.querySelector('.media-advice-service-name'), icon = service.querySelector('img');
  assert.equal(service.attributes['aria-label'], 'Apple TV / iTunes'); assert.equal(service.attributes.title, 'Apple TV / iTunes');
  assert.equal(name.textContent, 'Apple TV / iTunes'); assert.equal(service.dataset.iconState, 'pending');
  icon.naturalWidth = 24; for (const callback of icon.listeners.load) callback();
  assert.equal(service.dataset.iconState, 'loaded'); assert.equal(icon.hidden, false);
  for (const callback of icon.listeners.error) callback();
  assert.equal(service.dataset.iconState, 'failed'); assert.equal(icon.hidden, true);
  assert.equal(name.textContent, 'Apple TV / iTunes'); assert.equal(service.attributes['aria-pressed'], 'true');
  await button('Обрати').click(); await button('Перенести в картку').click();
  assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: original.link.href });
  assert.equal(state.calls, 1); assert.deepEqual(state.opens, []);
});
