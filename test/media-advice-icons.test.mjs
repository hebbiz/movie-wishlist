import test from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_SERVICE_ICON_SOURCES, MEDIA_SERVICE_ICON_TIMEOUT_MS, preloadMediaServiceIcons, watchMediaServiceIcon } from '../src/media-advice/media-advice-icons.mjs';

function iconControl() {
  const listeners = {}, timers = new Map(), cleared = [];
  let next = 0;
  const button = { dataset: {} }, slot = { hidden: false };
  const icon = { hidden: false, naturalWidth: 0, addEventListener(name, callback) { listeners[name] = callback; } };
  const view = { setTimeout(callback, ms) { const id = ++next; timers.set(id, { callback, ms }); return id; }, clearTimeout(id) { cleared.push(id); timers.delete(id); } };
  watchMediaServiceIcon({ button, slot, icon, view });
  return { button, slot, icon, listeners, timers, cleared };
}

test('search warming starts only six allowlisted local SVG preloads, once per document', () => {
  const links = [], doc = { head: { append(link) { links.push(link); } }, createElement: tag => ({ tag }) };
  preloadMediaServiceIcons(doc); preloadMediaServiceIcons(doc);
  assert.equal(links.length, 6);
  assert.deepEqual(links.map(link => link.href), Object.values(MEDIA_SERVICE_ICON_SOURCES));
  assert.ok(links.every(link => link.tag === 'link' && link.rel === 'preload' && link.as === 'image' && /^\/assets\/icons\/media\/[a-z]+\.svg$/.test(link.href)));
  const other = [], anotherDoc = { head: { append(link) { other.push(link); } }, createElement: tag => ({ tag }) };
  preloadMediaServiceIcons(anotherDoc); assert.equal(other.length, 6);
});

test('optional warm failure or absent head cannot interrupt discovery', () => {
  assert.doesNotThrow(() => preloadMediaServiceIcons({}));
  assert.doesNotThrow(() => preloadMediaServiceIcons({ head: { append() { throw Error('authored DOM failure'); } }, createElement: tag => ({ tag }) }));
});

test('pending slot becomes loaded only for a usable image and cancels its bounded fallback', () => {
  const state = iconControl();
  assert.equal(state.button.dataset.iconState, 'pending');
  assert.equal(state.timers.size, 1);
  assert.equal([...state.timers.values()][0].ms, MEDIA_SERVICE_ICON_TIMEOUT_MS);
  assert.equal(MEDIA_SERVICE_ICON_TIMEOUT_MS, 5000);
  state.icon.naturalWidth = 28; state.listeners.load();
  assert.equal(state.button.dataset.iconState, 'loaded');
  assert.equal(state.icon.hidden, false); assert.equal(state.slot.hidden, false);
  assert.equal(state.timers.size, 0); assert.equal(state.cleared.length, 1);
});

for (const failure of ['error', 'empty-load', 'timeout']) test(`${failure} shows terminal name fallback and ignores a later successful image`, () => {
  const state = iconControl();
  if (failure === 'error') state.listeners.error();
  if (failure === 'empty-load') state.listeners.load();
  if (failure === 'timeout') [...state.timers.values()][0].callback();
  assert.equal(state.button.dataset.iconState, 'failed');
  assert.equal(state.icon.hidden, true); assert.equal(state.slot.hidden, true);
  assert.equal(state.timers.size, 0);
  state.icon.naturalWidth = 28; state.listeners.load();
  assert.equal(state.button.dataset.iconState, 'failed');
  assert.equal(state.icon.hidden, true); assert.equal(state.slot.hidden, true);
});

test('an error after a previously loaded icon still reveals the name fallback', () => {
  const state = iconControl(); state.icon.naturalWidth = 28; state.listeners.load(); state.listeners.error();
  assert.equal(state.button.dataset.iconState, 'failed');
  assert.equal(state.icon.hidden, true); assert.equal(state.slot.hidden, true);
});
