// Authored source rows and a minimal DOM. No source/platform HTTP or database
// writes: UI behavior and the ordinary form save/readback projection are real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMediaAdvice, transferFor, makePreview, applyPreview, linkChoicesFor, otherPlatformLabels } from '../assets/media-advice.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { safeMediaReport } from '../assets/media-advice-report.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';

const filmId = 'imdb:tt21103218';
const href = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored?at=Exact%2fValue#Anchor';
function subscription(id = 'kinobaza:subscription', url = href) {
  return { id, filmId, identityStatus: 'matched', provider: { key: 'appletvplus', sourceName: 'Apple TV+' },
    country: null, access: { state: 'reported', value: 'subscription' }, audio: { state: 'unknown' }, subtitles: { state: 'unknown' },
    conflicts: [], link: { href: url }, linkAudit: { blockAssociation: 'associated' }, provenance: { source: 'Kinobaza HTML' },
    kinobazaLocalization: { blockId: 'kinobaza:block:0', provider: 'Apple TV+', href: url, territory: null, issues: [],
      audio: { state: 'unknown', evidence: [] }, subtitles: { state: 'reported-positive', language: 'uk', evidence: [{ label: 'укр. субтитри', literal: 'укр. субтитри', state: 'positive' }] } } };
}
function store(url = href) {
  return { id: 'motn:store', filmId, identityStatus: 'matched', provider: { key: 'apple', sourceName: 'Apple TV Store' },
    country: 'UA', access: { state: 'reported', value: 'buy' }, audio: { state: 'reported', ukrainian: [{ language: 'uk' }] },
    subtitles: { state: 'unknown' }, link: { href: url }, conflicts: [] };
}

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
async function harness(t, result, diagnostics = false) {
  const entry = new Element('button'), body = new Element('body');
  const state = { output: null, calls: 0, opens: [] };
  const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics };
  const doc = { body, activeElement: entry, createElement: tag => new Element(tag), createTextNode: text => new Element('text', text),
    defaultView: { scrollY: 0, scrollTo() {}, requestAnimationFrame(callback) { callback(); }, navigator: {}, open(...args) { state.opens.push(args); } } };
  const control = createMediaAdvice({ document: doc, entry, context: () => ({ userId: 'u', groupId: 'g', imdbId: 'tt21103218', formSession: 's', title: 'Authored film' }),
    capability: async () => capabilities, discover: async () => { state.calls++; return diagnostics ? { ...result, capabilities } : productMediaResult(result, capabilities); },
    readForm: () => ({ recommended_medium: 'DVD', purchase_url: '' }), writeForm: fields => state.output = fields });
  t.after(() => control.invalidate());
  await entry.click(); await new Promise(resolve => setTimeout(resolve, 0));
  const button = text => control.dialog.querySelectorAll('button').find(element => element.textContent === text);
  return { control, state, button, entry };
}

test('subscription and Store are separate canonical groups even with the same href; languages never cross groups', () => {
  const rows = [subscription(), store()], before = JSON.stringify(rows), groups = presentMediaGroups(rows, { filmId });
  assert.equal(groups.length, 2);
  const plus = groups.find(info => info.group.key === 'appletvplus'), shop = groups.find(info => info.group.key === 'apple');
  assert.equal(plus.group.title, 'Apple TV+'); assert.equal(plus.access, 'Передплата');
  assert.deepEqual([plus.comparison.audio.symbol, plus.comparison.subtitles.symbol], ['?', '+']);
  assert.deepEqual([shop.comparison.audio.symbol, shop.comparison.subtitles.symbol], ['+', '?']);
  assert.equal(plus.group.rows.length, 1); assert.equal(shop.group.rows.length, 1);
  assert.equal(transferFor(plus.transferRow).medium, 'Apple TV+');
  assert.equal(transferFor(shop.transferRow).medium, 'Apple TV / iTunes');
  assert.equal(JSON.stringify(rows), before);
});

test('Apple TV+ uses ordinary distinct link choices, never Store single-link preference or new semantic equivalence', () => {
  const rows = [subscription(), subscription('kinobaza:same'), subscription('motn:different', href.replace('umc.cmc.authored', 'umc.cmc.different'))];
  const plus = presentMediaGroups(rows, { filmId })[0], before = JSON.stringify(rows);
  const choices = linkChoicesFor(plus);
  assert.equal(choices.length, 2); assert.equal(plus.group.rows.length, 3);
  assert.equal(choices[0].href, href); assert.equal(choices[1].href, rows[2].link.href);
  for (const choice of choices) assert.equal(makePreview(choice.row, { recommended_medium: 'DVD', purchase_url: '' }).after.purchase_url, choice.href);
  assert.equal(JSON.stringify(rows), before);
});

test('subscription mixed, missing and conflicting data remains unknown/conflicting without borrowing Store evidence', () => {
  const positive = subscription(), negative = subscription('kinobaza:negative');
  negative.kinobazaLocalization.subtitles = { state: 'reported-negative', evidence: [{ label: 'укр. субтитри', literal: '−', state: 'negative' }] };
  const rows = [positive, negative, store()];
  const plus = presentMediaGroups(rows, { filmId }).find(info => info.group.key === 'appletvplus');
  assert.equal(plus.comparison.audio.symbol, '?'); assert.equal(plus.comparison.subtitles.symbol, '±');
  const missing = subscription(); missing.link.href = null; missing.kinobazaLocalization.href = null;
  const absent = presentMediaGroups([missing, store()], { filmId }).find(info => info.group.key === 'appletvplus');
  assert.deepEqual([absent.comparison.audio.symbol, absent.comparison.subtitles.symbol], ['?', '?']);
  assert.equal(linkChoicesFor(absent).length, 0);
  assert.equal(transferFor({ ...positive, providerConflict: true }), null);
  assert.equal(transferFor({ ...positive, identityStatus: 'unresolved' }), null);
  assert.equal(transferFor(subscription('unsafe', 'javascript:alert(1)')).url, null);
  assert.equal(transferFor(subscription('itunes-store-is-not-subscription', 'https://itunes.apple.com/ua/movie/id123')).url, null);
});

test('ordinary and diagnostic users see subscription/subtitles, distinct accessible emblem and exact URL preview→apply with no automatic Save', async t => {
  for (const diagnostics of [false, true]) await t.test(diagnostics ? 'diagnostic' : 'ordinary Beta', async t => {
    const original = subscription(), result = { film: { id: filmId, imdbId: 'tt21103218', title: 'The Lost Bus', year: 2025 }, rows: [original], unmapped: [] };
    const { control, state, button, entry } = await harness(t, result, diagnostics);
    const row = control.dialog.querySelector('.media-advice-row'), service = row.querySelector('button');
    assert.equal(row.dataset.providerKey, 'appletvplus'); assert.equal(service.attributes['aria-label'], 'Apple TV+');
    assert.deepEqual(row.querySelectorAll('.media-advice-symbol').map(e => e.textContent), ['◐', '?', '+']);
    assert.equal(service.querySelector('.media-advice-icon-slot').textContent, '+');
    assert.equal(service.querySelector('img').src, '/assets/icons/media/appletv.svg');
    assert.match(control.dialog.querySelector('.media-advice-actions').textContent, /Тип доступу: Передплата/);
    assert.equal(control.dialog.querySelectorAll('select').length, 0);
    if (diagnostics) {
      await button('Діагностичний звіт').click();
      assert.match(control.dialog.querySelector('textarea').value, /Variant appletvplus\/variant-1: source kinobaza; access subscription/);
      assert.match(control.dialog.querySelector('textarea').value, /M4 Kinobaza interpretation\/appletvplus.*subtitles reported-positive/);
      await button('← До порад').click();
    } else {
      assert.equal(button('Діагностичний звіт'), undefined); assert.equal(control.dialog.querySelectorAll('pre').length, 0);
    }
    await button('Відкрити посилання').click(); assert.deepEqual(state.opens, [[href, '_blank', 'noopener,noreferrer']]);
    await button('Обрати').click();
    assert.match(control.dialog.querySelector('.media-advice-preview').textContent, /→ Apple TV\+/);
    assert.match(control.dialog.querySelector('.media-advice-preview').textContent, /Тип доступу: Передплата/);
    assert.ok(control.dialog.querySelector('.media-advice-preview').textContent.includes(href)); assert.equal(state.output, null);
    await button('Перенести в картку').click();
    assert.deepEqual(state.output, { recommended_medium: 'Apple TV+', purchase_url: href });
    await entry.click(); assert.equal(state.calls, 1, 'reopening does not repeat discovery');
    const icon = control.dialog.querySelector('.media-advice-service-select').querySelector('img');
    for (const callback of icon.listeners.error) callback();
    assert.equal(control.dialog.querySelector('.media-advice-service-name').textContent, 'Apple TV+');
    assert.equal(control.dialog.querySelector('.media-advice-service-select').dataset.iconState, 'failed');
  });
});

test('display-only other-platform notices collapse exact normalized names while retaining all original observations and safe text', async t => {
  const unmapped = [{ name: 'Apple TV', source: 'tmdb', access: 'subscription' }, { name: ' apple  tv ', source: 'motn', access: 'buy' },
    { name: 'APPLE TV', source: 'kinobaza', link: 'https://different.example/' }, { name: 'Apple TV Store', source: 'motn' },
    { name: '<img src=x onerror=alert(1)>', source: 'authored' }];
  const before = JSON.stringify(unmapped);
  assert.deepEqual(otherPlatformLabels(unmapped), ['Apple TV', 'Apple TV Store', '<img src=x onerror=alert(1)>']);
  const { control, button, state } = await harness(t, { film: { id: filmId, imdbId: 'tt21103218' }, rows: [], unmapped }, true);
  assert.equal(control.dialog.querySelectorAll('.media-advice-other').length, 3);
  assert.equal(control.dialog.querySelectorAll('img').length, 1, 'untrusted label remains literal text, not an image');
  await button('Діагностичний звіт').click();
  assert.equal(control.dialog.querySelectorAll('pre').length, unmapped.length, 'all source records remain diagnostic rows');
  assert.match(control.dialog.querySelector('textarea').value, /other-platform rows: 5/);
  assert.equal(JSON.stringify(unmapped), before); assert.equal(state.calls, 1);
});

test('ordinary form options, save payload projection and fillForm round trip preserve subscription separately from Store', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8'), app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const fields = Object.fromEntries(['title', 'year', 'imdb_url', 'recommended_medium', 'status', 'owned_medium', 'purchase_url', 'added_by'].map(id => [id, { value: '' }]));
  for (const id of ['recommended_medium', 'owned_medium']) {
    const select = new RegExp(`<select id="${id}">([\\s\\S]*?)<\\/select>`).exec(html)[1];
    const options = [...select.matchAll(/<option value="([^"]*)">/g)].map(match => match[1]);
    assert.ok(options.includes('Apple TV+')); assert.ok(options.includes('Apple TV / iTunes'));
    let selected = ''; Object.defineProperty(fields[id], 'value', { get: () => selected, set: next => selected = options.includes(next) ? next : '' });
  }
  const named = name => {
    const match = new RegExp(`^function ${name}\\([^)]*\\) \\{[\\s\\S]*?^\\}`, 'm').exec(app);
    assert.ok(match, `${name} exists`); return match[0];
  };
  const context = vm.createContext({ document: { getElementById: id => fields[id] }, setAddedByField() {}, updateFormVisibility() {} });
  vm.runInContext(['getMovieFormData', 'getMovieGroupListData', 'fillForm', 'isStreamingMedium', 'getPurchaseLabel'].map(named).join('\n'), context);
  for (const row of [subscription(), store()]) {
    const form = { recommended_medium: 'DVD', purchase_url: '' }, after = applyPreview(makePreview(row, form), form);
    fields.title.value = 'Authored movie'; fields.year.value = '2025'; fields.status.value = 'wishlist';
    for (const [key, value] of Object.entries(after)) fields[key].value = value;
    const saved = JSON.parse(vm.runInContext('JSON.stringify(getMovieGroupListData(getMovieFormData()))', context));
    assert.equal(saved.recommended_medium, after.recommended_medium); assert.equal(saved.purchase_url, href);
    context.persisted = { title: 'Authored movie', year: 2025, ...saved };
    vm.runInContext('fillForm(persisted)', context);
    assert.equal(fields.recommended_medium.value, after.recommended_medium); assert.equal(fields.purchase_url.value, href);
    assert.equal(vm.runInContext(`isStreamingMedium(${JSON.stringify(after.recommended_medium)})`, context), true);
    fields.owned_medium.value = after.recommended_medium;
    assert.equal(vm.runInContext('getPurchaseLabel({ owned_medium: document.getElementById("owned_medium").value })', context), row.provider.key === 'appletvplus' ? 'Дивитись на Apple TV+' : 'Дивитись на Apple TV');
  }
});

test('short diagnostics preserve each Apple offer/source without leaking unselected URLs', () => {
  const rows = [subscription(), store(), subscription('motn:other', href.replace('authored', 'alternative'))];
  const report = safeMediaReport({ rows, unmapped: [] });
  assert.match(report, /appletvplus\/variant-1/); assert.match(report, /appletvplus\/variant-2/); assert.match(report, /apple\/variant-1/);
  for (const row of rows) assert.ok(!report.includes(row.link.href));
});
