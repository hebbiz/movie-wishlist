import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntryAccessPreparation } from '../src/media-advice/media-advice-entry-access.mjs';
import { createMediaAdvice } from '../src/media-advice/media-advice.mjs';

const allowed = { mykola_media_advice: true, mykola_media_advice_diagnostics: true };
const context = { userId: 'user-a', groupId: 'group-a', imdbId: 'tt0290002', listId: 'list-a', formSession: 'form-a' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('entry hint is session-wide user availability, never stores movie/group grants, diagnostics or tokens', async () => {
  let clock = 0, calls = 0;
  const prep = createEntryAccessPreparation({ scope: () => context, now: () => clock,
    request: async c => { calls++; assert.deepEqual(c, { userId: context.userId }); return allowed; } });
  assert.equal(prep.peek(), false);
  assert.equal(await prep.prepare(context), true);
  assert.equal(prep.peek({ ...context, imdbId: 'tt0081505', listId: 'list-b', formSession: 'form-b' }), true, 'display eligibility is not a card authorization');
  assert.equal(await prep.prepare(context), true); assert.equal(calls, 1);
  assert.equal(typeof prep.peek(), 'boolean');
  assert.equal(prep.remainingMs(), Infinity);
  assert.equal(prep.peek({ ...context, groupId: 'other' }), true);
  assert.equal(prep.peek({ ...context, userId: 'other' }), false);
  clock = 300000; assert.equal(prep.peek(), true);
  await prep.prepare({ ...context, groupId: null }); assert.equal(calls, 1);
  prep.invalidate(); assert.equal(prep.peek(), false);
  await prep.prepare(context); assert.equal(calls, 2);
});

test('preparation needs only authenticated user, deduplicates in flight and refuses missing/foreign user', async () => {
  let calls = 0; const flight = deferred();
  const prep = createEntryAccessPreparation({ scope: () => context, request: () => { calls++; return flight.promise; } });
  for (const c of [null, { userId: '' }, { ...context, userId: 'other' }]) assert.equal(await prep.prepare(c), false);
  assert.equal(calls, 0);
  const first = prep.prepare({ userId: context.userId, groupId: context.groupId }), second = prep.prepare({ ...context, imdbId: '', formSession: null });
  assert.equal(first, second); await Promise.resolve(); assert.equal(calls, 1);
  flight.resolve(allowed); assert.equal(await first, true);
});

test('empty groups prepare before a film exists and reject caller-supplied movie/private fields', async () => {
  const scope = { userId: 'user-a', groupId: 'empty-group' };
  let sent;
  const prep = createEntryAccessPreparation({ scope: () => scope, request: async c => { sent = c; return allowed; } });
  assert.equal(await prep.prepare({ ...scope, imdbId: 'tt0290002', listId: 'anything', formSession: 'anything', mykola_media_advice_diagnostics: true }), true);
  assert.deepEqual(sent, { userId: scope.userId });
  assert.equal(prep.peek(scope), true);
  assert.equal(prep.peek({ ...scope, groupId: 'another' }), true);
  prep.invalidate(); assert.equal(prep.remainingMs(), 0);
});

test('old user/auth-session generations and errors cannot revive a display hint', async () => {
  for (const change of ['userId', 'auth-session']) {
    let current = { ...context }; const old = deferred(), fresh = deferred(); let calls = 0, signal;
    const prep = createEntryAccessPreparation({ scope: () => current, request: (c, s) => { signal ??= s; return ++calls === 1 ? old.promise : fresh.promise; } });
    const first = prep.prepare(context); await Promise.resolve();
    if (change === 'userId') current.userId = 'changed';
    prep.invalidate(); assert.equal(signal.aborted, true);
    const second = prep.prepare(current); await Promise.resolve(); fresh.resolve(allowed); await second;
    old.resolve(allowed); assert.equal(await first, false);
    assert.equal(prep.peek(current), true, change);
    assert.equal(await prep.prepare(current, { force: true }).then(() => true), true);
  }
  let fail = false;
  const prep = createEntryAccessPreparation({ scope: () => context, request: async () => { if (fail) throw Error('offline'); return allowed; } });
  await prep.prepare(context); fail = true;
  assert.equal(await prep.prepare(context, { force: true }), false); assert.equal(prep.peek(), false);
});

test('strict flag values and observed denial remove the hint; no private capability is cached', async () => {
  let value = allowed;
  const prep = createEntryAccessPreparation({ scope: () => context, request: async () => value });
  await prep.prepare(context);
  for (value of [true, {}, { mykola_media_advice: 'true' }, { mykola_media_advice: false, mykola_media_advice_diagnostics: true }]) {
    assert.equal(await prep.prepare(context, { force: true }), false); assert.equal(prep.peek(), false);
  }
});

test('a denied or failed init is fail-closed without probing again on every film; explicit retry recovers', async () => {
  for (const failure of [false, 'network']) {
    let calls = 0;
    const prep = createEntryAccessPreparation({ scope: () => context, request: async () => {
      calls++; if (calls > 1) return allowed;
      if (failure === 'network') throw Error('offline');
      return { mykola_media_advice: false };
    } });
    assert.equal(await prep.prepare(context), false);
    assert.equal(await prep.prepare({ ...context, groupId: 'another', imdbId: 'tt0081505' }), false);
    assert.equal(calls, 1);
    assert.equal(await prep.prepare(context, { force: true }), true);
    assert.equal(calls, 2);
  }
});

test('a forced new check advances the action revision but retains a valid hint; parallel callers share its new epoch', async () => {
  let requests = 0, finish;
  const prep = createEntryAccessPreparation({ scope: () => context, request: async () => {
    if (++requests === 1) return allowed;
    return new Promise(resolve => { finish = resolve; });
  } });
  await prep.prepare(context); const oldRevision = prep.revision();
  const fresh = prep.prepare(context, { force: true }), newRevision = prep.revision();
  assert.ok(newRevision > oldRevision);
  assert.equal(prep.peek(context), true);
  const coalesced = prep.prepare(context, { force: true });
  assert.equal(prep.revision(), newRevision); assert.equal(fresh, coalesced);
  await Promise.resolve(); finish(allowed); await fresh;
  assert.equal(prep.revision(), newRevision); assert.equal(prep.peek(context), true);
});

function control(capability, preparedEntry = () => true) {
  const element = () => ({ hidden: true, children: [], listeners: {}, setAttribute() {}, append(...items) { this.children.push(...items); },
    replaceChildren() { this.children = []; }, addEventListener(event, fn) { this.listeners[event] = fn; } });
  const entry = element(), body = element(), doc = { body, createElement: element };
  let calls = 0, current = { ...context };
  const instance = createMediaAdvice({ document: doc, entry, context: () => current,
    capability, preparedEntry, discover: async () => { calls++; }, readForm() {}, writeForm() {} });
  return { instance, entry, setContext: c => current = c, calls: () => calls };
}

test('warm hint shows entry synchronously but fresh exact denial wins, with no search/diagnostics', async () => {
  const check = deferred(); const h = control(() => check.promise);
  const pending = h.instance.refresh();
  assert.equal(h.entry.hidden, false, 'same synchronous card open can show prepared entry');
  assert.equal(h.calls(), 0); assert.equal(h.instance.dialog.children.length, 0);
  check.resolve(false); await pending;
  assert.equal(h.entry.hidden, true); assert.equal(h.calls(), 0);
});

test('concurrent display refreshes coalesce without allowing a click to reuse display authorization', async () => {
  const display = deferred(), click = deferred(); let checks = 0;
  const h = control(() => ++checks === 1 ? display.promise : click.promise);
  const first = h.instance.refresh(), second = h.instance.refresh();
  await Promise.resolve();
  assert.equal(checks, 1);
  const opening = h.entry.listeners.click(); assert.equal(checks, 2, 'click requires its own fresh server check');
  await h.instance.refresh(); assert.equal(checks, 2, 'background revalidation cannot supersede the pending click');
  click.resolve(false); await opening;
  display.resolve(allowed); await Promise.all([first, second]);
  assert.equal(h.entry.hidden, true); assert.equal(h.calls(), 0);
});

test('a synchronous failed display check does not strand the in-flight coalescer', async () => {
  let checks = 0;
  const h = control(() => { checks++; throw Error('local setup unavailable'); });
  await h.instance.refresh(); await h.instance.refresh();
  assert.equal(checks, 2); assert.equal(h.entry.hidden, true); assert.equal(h.calls(), 0);
});

test('prepared visibility cannot authorize click, nor survive stale exact-context responses', async () => {
  const check = deferred(); const h = control(() => check.promise);
  const pending = h.instance.refresh(); h.setContext({ ...context, imdbId: 'tt0081505' });
  check.resolve(allowed); await pending;
  assert.equal(h.entry.hidden, true); assert.equal(h.calls(), 0);
  const denied = control(async () => false);
  await denied.instance.refresh(); await denied.entry.listeners.click();
  assert.equal(denied.calls(), 0); assert.equal(denied.instance.dialog.children.length, 0);
});
