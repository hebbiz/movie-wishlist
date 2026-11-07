// Authored source rows and a minimal DOM. No source/platform HTTP or database
// writes: UI behavior and the ordinary form save/readback projection are real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMediaAdvice, transferFor, makePreview, applyPreview, linkChoicesFor, otherPlatformLabels } from '../assets/media-advice.mjs';
import { presentMediaGroups, presentMediaGroup } from '../assets/media-advice-presentation.mjs';
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

test('subscription and Store share the existing Apple display group even with the same href; selected records keep their own evidence', () => {
  const rows = [subscription(), store()], before = JSON.stringify(rows), groups = presentMediaGroups(rows, { filmId });
  assert.equal(groups.length, 1);
  const plus = presentMediaGroup(groups[0].group, { filmId, selectedRow: rows[0] });
  const shop = presentMediaGroup(groups[0].group, { filmId, selectedRow: rows[1] });
  assert.equal(plus.group.title, 'Apple TV / iTunes'); assert.equal(plus.access, 'Передплата');
  assert.equal(shop.access, 'Купівля');
  assert.deepEqual([plus.comparison.audio.symbol, plus.comparison.subtitles.symbol], ['?', '+']);
  assert.deepEqual([shop.comparison.audio.symbol, shop.comparison.subtitles.symbol], ['+', '?']);
  assert.equal(plus.group.rows.length, 2); assert.equal(shop.group.rows.length, 2);
  assert.equal(plus.transferRow, rows[0]); assert.equal(shop.transferRow, rows[1]);
  assert.equal(transferFor(plus.transferRow).medium, 'Apple TV / iTunes');
  assert.equal(transferFor(shop.transferRow).medium, 'Apple TV / iTunes');
  assert.equal(JSON.stringify(rows), before);
});

test('Apple TV+ keeps opaque and distinct card links without the Store single-link preference', () => {
  const rows = [subscription(), subscription('kinobaza:same'), subscription('motn:different', href.replace('umc.cmc.authored', 'umc.cmc.different'))];
  const plus = presentMediaGroups(rows, { filmId })[0], before = JSON.stringify(rows);
  const choices = linkChoicesFor(plus);
  assert.equal(choices.length, 2); assert.equal(plus.group.rows.length, 3);
  assert.equal(choices[0].href, href); assert.equal(choices[1].href, rows[2].link.href);
  for (const choice of choices) assert.equal(makePreview(choice.row, { recommended_medium: 'DVD', purchase_url: '' }).after.purchase_url, choice.href);
  assert.equal(JSON.stringify(rows), before);
});

test('same declared Plus card groups navigation only and keeps unknown MOTN, Store and caption rows isolated', async t => {
  for (const diagnostics of [false, true]) await t.test(diagnostics ? 'diagnostic' : 'ordinary Beta', async t => {
    const target = 'https://tv.apple.com/ua/movie/%D0%B0%D0%B2%D1%82%D0%BE%D0%B1%D1%83%D1%81/umc.cmc.authored?at=AUTHORED&ct=CAMPAIGN';
    const wrapped = value => `https://click.justwatch.com/a?cx=${value}&r=${encodeURIComponent(target)}&uct_country=ua`;
    const kino = subscription('kinobaza:caption', wrapped('TOP'));
    const regional = subscription('kinobaza:regional', wrapped('REGIONAL'));
    regional.country = 'UA'; delete regional.kinobazaLocalization; delete regional.linkAudit;
    const unknown = subscription('motn:unknown', target + '&offer=unestablished');
    unknown.country = 'UA'; unknown.provenance = { source: 'Movie of the Night' };
    delete unknown.kinobazaLocalization; delete unknown.linkAudit;
    const shop = store(target); shop.audio = { state: 'unknown' };
    const rows = [unknown, regional, kino, shop], snapshot = JSON.stringify(rows);
    const { control, state, button, entry } = await harness(t, { film: { id: filmId, imdbId: 'tt21103218' }, rows, unmapped: [] }, diagnostics);
    const row = () => control.dialog.querySelector('.media-advice-row');
    assert.equal(row().dataset.rowId, kino.id);
    const choose = async prefix => {
      const selector = control.dialog.querySelector('.media-advice-link-select'), options = selector.querySelectorAll('option');
      assert.equal(options.length, 3, 'two proven same-card Kino links collapse, not the unknown MOTN or separate Store product');
      assert.equal(new Set(options.map(option => option.textContent)).size, 3, 'remaining labels are distinguishable');
      const option = options.find(option => option.textContent.includes(prefix)); assert.ok(option);
      selector.value = option.value; for (const callback of selector.listeners.change) await callback({ target: selector });
    };
    for (const [label, expected] of [['Movie of the Night', unknown], ['Apple TV Store', shop], ['Кінобаза', kino], ['Apple TV Store', shop], ['Кінобаза', kino]]) {
      // Store is also MOTN; select the subscription by its full product/access label.
      await choose(label === 'Movie of the Night' ? 'Apple TV+ · Передплата · Movie of the Night' : label);
      assert.equal(row().dataset.rowId, expected.id);
      assert.deepEqual(row().querySelectorAll('.media-advice-symbol').map(element => element.textContent), expected === kino ? ['◐', '?', '+'] : ['●', '?', '?']);
    }
    await button('Відкрити посилання').click(); assert.deepEqual(state.opens, [[kino.link.href, '_blank', 'noopener,noreferrer']]);
    await button('Обрати').click(); const preview = control.dialog.querySelector('.media-advice-preview').textContent;
    assert.ok(preview.includes(kino.link.href)); assert.match(preview, /Українські субтитри: джерело повідомляє наявність/);
    await button('Перенести в картку').click();
    assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: kino.link.href });
    await entry.click(); assert.equal(state.calls, 1); assert.equal(row().dataset.rowId, kino.id);
    if (diagnostics) {
      await button('Діагностичний звіт').click();
      assert.equal(control.dialog.querySelectorAll('pre').length, 4, 'grouping removes no source records from diagnostics');
      for (const original of rows) assert.ok(control.dialog.textContent.includes(original.link.href));
    } else assert.equal(button('Діагностичний звіт'), undefined);
    assert.equal(JSON.stringify(rows), snapshot);
  });
});

test('one Apple group keeps a subscription and Store navigation choice even if exact URLs match', () => {
  const rows = [subscription(), store()], before = JSON.stringify(rows);
  const info = presentMediaGroups(rows, { filmId })[0], choices = linkChoicesFor(info);
  assert.equal(choices.length, 2, 'a shared destination string does not establish subscription/Store offer equivalence');
  assert.deepEqual(choices.map(choice => choice.row.provider.key).sort(), ['apple', 'appletvplus']);
  for (const choice of choices) {
    const selected = presentMediaGroup(info.group, { filmId, selectedRow: choice.row });
    const preview = makePreview(selected.transferRow, { recommended_medium: 'DVD', purchase_url: '' });
    assert.equal(selected.transferRow, choice.row);
    assert.equal(preview.after.recommended_medium, 'Apple TV / iTunes');
    assert.equal(preview.after.purchase_url, href);
    assert.equal(selected.access, choice.row.provider.key === 'appletvplus' ? 'Передплата' : 'Купівля');
  }
  assert.equal(JSON.stringify(rows), before);
});

test('selecting rental cannot inherit purchase or subscription tracks and access conditions', () => {
  const plus = subscription(), purchase = store(), rental = store(href.replace('authored', 'rental'));
  rental.id = 'motn:rental'; rental.access.value = 'rent'; rental.audio = { state: 'unknown' };
  rental.price = { state: 'reported', value: 3.99, currency: 'EUR' };
  purchase.price = { state: 'reported', value: 12.99, currency: 'EUR' };
  plus.price = { state: 'unknown' };
  const rows = [plus, purchase, rental], before = JSON.stringify(rows);
  const info = presentMediaGroups(rows, { filmId })[0];
  const selected = presentMediaGroup(info.group, { filmId, selectedRow: rental });
  assert.deepEqual([selected.comparison.audio.symbol, selected.comparison.subtitles.symbol], ['?', '?']);
  assert.equal(selected.access, 'Оренда'); assert.equal(selected.transferRow, rental);
  assert.equal(selected.transferRow.price.value, 3.99);
  const preview = makePreview(selected.transferRow, { recommended_medium: 'DVD', purchase_url: '' });
  assert.equal(preview.after.purchase_url, rental.link.href);
  assert.equal(info.group.rows.length, 3);
  assert.equal(JSON.stringify(rows), before);
});

test('mixed, missing and conflicting Apple data is scoped to the selected variant, not other offers', () => {
  const positive = subscription(), negative = subscription('kinobaza:negative');
  negative.kinobazaLocalization.subtitles = { state: 'reported-negative', evidence: [{ label: 'укр. субтитри', literal: '−', state: 'negative' }] };
  const rows = [positive, negative, store()];
  const merged = presentMediaGroups(rows, { filmId })[0];
  const plus = presentMediaGroup(merged.group, { filmId, selectedRow: positive });
  const minus = presentMediaGroup(merged.group, { filmId, selectedRow: negative });
  assert.equal(plus.comparison.audio.symbol, '?'); assert.equal(plus.comparison.subtitles.symbol, '+');
  assert.deepEqual([minus.comparison.audio.symbol, minus.comparison.subtitles.symbol], ['?', '−']);
  const conflict = subscription('kinobaza:conflict'); conflict.kinobazaLocalization.subtitles.state = 'conflicting';
  const conflictGroup = presentMediaGroups([conflict, store()], { filmId })[0];
  const ownConflict = presentMediaGroup(conflictGroup.group, { filmId, selectedRow: conflict });
  assert.deepEqual([ownConflict.comparison.audio.symbol, ownConflict.comparison.subtitles.symbol], ['?', '±']);
  const missing = subscription(); missing.link.href = null; missing.kinobazaLocalization.href = null;
  const missingGroup = presentMediaGroups([missing, store()], { filmId })[0];
  const absent = presentMediaGroup(missingGroup.group, { filmId, selectedRow: missing });
  assert.deepEqual([absent.comparison.audio.symbol, absent.comparison.subtitles.symbol], ['?', '?']);
  assert.equal(transferFor(absent.transferRow).url, null, 'the missing variant does not borrow the Store link');
  const unknown = presentMediaGroup(merged.group, { filmId, selectedRow: subscription('not-in-group') });
  assert.deepEqual([unknown.comparison.audio.symbol, unknown.comparison.subtitles.symbol], ['?', '?']);
  assert.equal(unknown.band, 'withheld', 'an out-of-group selection has no authority');
  assert.equal(transferFor({ ...positive, providerConflict: true }), null);
  assert.equal(transferFor({ ...positive, identityStatus: 'unresolved' }), null);
  assert.equal(transferFor(subscription('unsafe', 'javascript:alert(1)')).url, null);
  assert.equal(transferFor(subscription('itunes-store-is-not-subscription', 'https://itunes.apple.com/ua/movie/id123')).url, null);
});

test('ordinary and diagnostic users see one accessible Apple service and selected subscription/subtitles; preview→apply keeps the existing medium', async t => {
  for (const diagnostics of [false, true]) await t.test(diagnostics ? 'diagnostic' : 'ordinary Beta', async t => {
    const original = subscription(), result = { film: { id: filmId, imdbId: 'tt21103218', title: 'The Lost Bus', year: 2025 }, rows: [original], unmapped: [] };
    const { control, state, button, entry } = await harness(t, result, diagnostics);
    const row = control.dialog.querySelector('.media-advice-row'), service = row.querySelector('button');
    assert.equal(row.dataset.providerKey, 'apple'); assert.equal(service.attributes['aria-label'], 'Apple TV / iTunes');
    assert.deepEqual(row.querySelectorAll('.media-advice-symbol').map(e => e.textContent), ['◐', '?', '+']);
    assert.equal(service.querySelector('.media-advice-icon-slot').textContent, '', 'subscription is not a separate branded service emblem');
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
    assert.match(control.dialog.querySelector('.media-advice-preview').textContent, /→ Apple TV \/ iTunes/);
    assert.match(control.dialog.querySelector('.media-advice-preview').textContent, /Тип доступу: Передплата/);
    assert.ok(control.dialog.querySelector('.media-advice-preview').textContent.includes(href)); assert.equal(state.output, null);
    await button('Перенести в картку').click();
    assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: href });
    await entry.click(); assert.equal(state.calls, 1, 'reopening does not repeat discovery');
    const icon = control.dialog.querySelector('.media-advice-service-select').querySelector('img');
    for (const callback of icon.listeners.error) callback();
    assert.equal(control.dialog.querySelector('.media-advice-service-name').textContent, 'Apple TV / iTunes');
    assert.equal(control.dialog.querySelector('.media-advice-service-select').dataset.iconState, 'failed');
  });
});

test('mixed Apple selector changes only the selected offer evidence and preserves product selection through preview', async t => {
  for (const diagnostics of [false, true]) for (const selectedProduct of ['appletvplus', 'apple']) {
    await t.test(`${diagnostics ? 'diagnostic' : 'ordinary Beta'} / ${selectedProduct}`, async t => {
      const original = [subscription(), store()]; original[1].audio = { state: 'unknown' };
      const snapshot = JSON.stringify(original);
      const result = { film: { id: filmId, imdbId: 'tt21103218', title: 'Authored mixed Apple film', year: 2025 }, rows: original, unmapped: [] };
      const { control, state, button, entry } = await harness(t, result, diagnostics);
      assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 1);
      assert.equal(control.dialog.querySelector('.media-advice-row').dataset.providerKey, 'apple');
      async function choose(product) {
        const selector = control.dialog.querySelector('.media-advice-link-select');
        assert.equal(selector.attributes['aria-label'], 'Посилання сервісу Apple TV / iTunes');
        const options = selector.querySelectorAll('option');
        assert.equal(options.length, 2, 'shared exact href does not hide a distinct access product');
        const option = options.find(element => element.textContent.startsWith(product === 'appletvplus' ? 'Apple TV+ ·' : 'Apple TV Store ·'));
        assert.ok(option); selector.value = option.value;
        for (const callback of selector.listeners.change) await callback({ target: selector });
        const row = control.dialog.querySelector('.media-advice-row');
        assert.deepEqual(row.querySelectorAll('.media-advice-symbol').map(element => element.textContent), product === 'appletvplus' ? ['◐', '?', '+'] : ['●', '?', '?']);
        assert.match(control.dialog.querySelector('.media-advice-actions').textContent, product === 'appletvplus' ? /Тип доступу: Передплата · Apple TV\+/ : /Тип доступу: Купівля · Apple TV Store/);
        assert.equal(row.dataset.rowId, product === 'appletvplus' ? original[0].id : original[1].id);
        const answer = control.dialog.querySelector('.media-advice-answer').textContent;
        if (product === 'appletvplus') assert.match(answer, /є дані про українські субтитри/);
        else {
          assert.doesNotMatch(answer, /є дані про українські субтитри|є дані про українське аудіо/);
          assert.match(answer, /українські доріжки поки не підтверджені/);
        }
      }
      await choose('appletvplus'); await choose('apple'); await choose(selectedProduct);
      await button('Обрати').click();
      const preview = control.dialog.querySelector('.media-advice-preview');
      assert.match(preview.textContent, /→ Apple TV \/ iTunes/);
      assert.match(preview.textContent, selectedProduct === 'appletvplus' ? /Тип доступу: Передплата/ : /Тип доступу: Купівля/);
      assert.equal(state.output, null);
      await button('Скасувати вибір').click();
      await entry.click(); assert.equal(state.calls, 1);
      const selectedOption = control.dialog.querySelector('.media-advice-link-select').querySelectorAll('option').find(option => option.selected);
      assert.ok(selectedOption.textContent.startsWith(selectedProduct === 'appletvplus' ? 'Apple TV+ ·' : 'Apple TV Store ·'));
      await button('Обрати').click(); await button('Перенести в картку').click();
      assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: href });
      assert.equal(JSON.stringify(original), snapshot);
    });
  }
});

test('a literal Apple subscription link keeps its chosen Kino representative while switching Store and subscription repeatedly', async t => {
  for (const diagnostics of [false, true]) await t.test(diagnostics ? 'diagnostic' : 'ordinary Beta', async t => {
    const kino = subscription('kinobaza:captioned-subscription');
    const unknown = subscription('motn:unknown-subscription');
    unknown.country = 'UA'; unknown.provenance = { source: 'Movie of the Night' };
    delete unknown.kinobazaLocalization; delete unknown.linkAudit;
    const shop = store(); shop.audio = { state: 'unknown' };
    const rows = [kino, unknown, shop], snapshot = JSON.stringify(rows);
    const result = { film: { id: filmId, imdbId: 'tt21103218', title: 'Authored three-source Apple film', year: 2025 }, rows, unmapped: [] };
    const { control, state, button, entry } = await harness(t, result, diagnostics);
    const row = () => control.dialog.querySelector('.media-advice-row');
    assert.equal(row().dataset.rowId, kino.id, 'initial subtitle recommendation chooses the captioned Kino observation');
    assert.deepEqual(row().querySelectorAll('.media-advice-symbol').map(element => element.textContent), ['◐', '?', '+']);
    assert.equal(control.dialog.querySelectorAll('.media-advice-row').length, 1);
    for (const product of ['apple', 'appletvplus', 'apple', 'appletvplus']) {
      const selector = control.dialog.querySelector('.media-advice-link-select');
      const options = selector.querySelectorAll('option');
      assert.equal(options.length, 2, 'literal duplicate subscription links form one stable navigation choice');
      const plusOption = options.find(option => option.textContent.startsWith('Apple TV+ ·'));
      assert.match(plusOption.textContent, /Кінобаза/, 'changing another product cannot replace the Plus representative with the unknown MOTN row');
      const option = product === 'appletvplus' ? plusOption : options.find(option => option.textContent.startsWith('Apple TV Store ·'));
      selector.value = option.value;
      for (const callback of selector.listeners.change) await callback({ target: selector });
      assert.equal(row().dataset.rowId, product === 'appletvplus' ? kino.id : shop.id);
      assert.deepEqual(row().querySelectorAll('.media-advice-symbol').map(element => element.textContent), product === 'appletvplus' ? ['◐', '?', '+'] : ['●', '?', '?']);
      const actions = control.dialog.querySelector('.media-advice-actions').textContent;
      assert.match(actions, product === 'appletvplus' ? /Передплата · Apple TV\+\. Джерело: Кінобаза/ : /Купівля · Apple TV Store\. Джерело: Movie of the Night/);
      assert.equal(state.calls, 1);
    }
    await button('Обрати').click();
    const preview = control.dialog.querySelector('.media-advice-preview').textContent;
    assert.match(preview, /→ Apple TV \/ iTunes/);
    assert.match(preview, /Передплата · Apple TV\+\. Джерело: Кінобаза/);
    assert.match(preview, /Українські субтитри: джерело повідомляє наявність/);
    assert.ok(preview.includes(href)); assert.equal(state.output, null);
    await button('Перенести в картку').click();
    assert.deepEqual(state.output, { recommended_medium: 'Apple TV / iTunes', purchase_url: href });
    await entry.click(); assert.equal(state.calls, 1);
    assert.equal(row().dataset.rowId, kino.id);
    assert.equal(JSON.stringify(rows), snapshot);
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

test('ordinary form options, save payload projection and fillForm keep subscription and Store under the existing Apple medium', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8'), app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const fields = Object.fromEntries(['title', 'year', 'imdb_url', 'recommended_medium', 'status', 'owned_medium', 'purchase_url', 'added_by'].map(id => [id, { value: '' }]));
  for (const id of ['recommended_medium', 'owned_medium']) {
    const select = new RegExp(`<select id="${id}">([\\s\\S]*?)<\\/select>`).exec(html)[1];
    const options = [...select.matchAll(/<option value="([^"]*)">/g)].map(match => match[1]);
    assert.equal(options.includes('Apple TV+'), false, 'no new medium option is introduced');
    assert.equal(options.filter(value => value === 'Apple TV / iTunes').length, 1);
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
    assert.equal(after.recommended_medium, 'Apple TV / iTunes');
    fields.title.value = 'Authored movie'; fields.year.value = '2025'; fields.status.value = 'wishlist';
    for (const [key, value] of Object.entries(after)) fields[key].value = value;
    const saved = JSON.parse(vm.runInContext('JSON.stringify(getMovieGroupListData(getMovieFormData()))', context));
    assert.equal(saved.recommended_medium, after.recommended_medium); assert.equal(saved.purchase_url, href);
    context.persisted = { title: 'Authored movie', year: 2025, ...saved };
    vm.runInContext('fillForm(persisted)', context);
    assert.equal(fields.recommended_medium.value, after.recommended_medium); assert.equal(fields.purchase_url.value, href);
    assert.equal(vm.runInContext(`isStreamingMedium(${JSON.stringify(after.recommended_medium)})`, context), true);
    fields.owned_medium.value = after.recommended_medium;
    assert.equal(vm.runInContext('getPurchaseLabel({ owned_medium: document.getElementById("owned_medium").value })', context), 'Дивитись на Apple TV');
  }
});

test('short diagnostics preserve each Apple offer/source without leaking unselected URLs', () => {
  const rows = [subscription(), store(), subscription('motn:other', href.replace('authored', 'alternative'))];
  const report = safeMediaReport({ rows, unmapped: [] });
  assert.match(report, /appletvplus\/variant-1/); assert.match(report, /appletvplus\/variant-2/); assert.match(report, /apple\/variant-1/);
  for (const row of rows) assert.ok(!report.includes(row.link.href));
});
