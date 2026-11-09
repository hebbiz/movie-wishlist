// Authored HTML, identities and proof only; not live catalogue/person evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHtml } from '../research/grounded-answer-demo/html-source.mjs';
import { fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { markup, CARD } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';

const PROFILE = 'https://kinobazaua.com/persons/authored-director';
const ALIAS = 'Авторський режисер';
const FILM = { id: 'authored-context-film', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: [], directorCount: 1, directorAliases: ['Authored director'],
  directorPeople: [{ namespace: 'tmdb:person', personId: 999999, names: ['Authored director'] }] };
const linked = `<a href="${PROFILE}">${ALIAS}</a>`;
const proof = changes => ({ status: 'confirmed', aliases: [ALIAS], provenance: {
  namespace: 'tmdb:person', personId: 999999, scope: 'kinobaza-director-identity', sourceURL: PROFILE,
  ...changes,
} });

async function prepared({ html = markup({ director: linked }), selected = FILM, verify = async () => proof(), signal, registration } = {}) {
  let requests = 0, verifications = 0, deferred;
  const initial = await fetchAssistedKinobaza(CARD, selected, async (url, init) => {
    requests++; assert.equal(url, CARD); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }, { signal, verifyDirector: async pointer => { verifications++; return verify(pointer); },
    onDeferredDirector: entry => { deferred = entry; registration?.(entry); } });
  return { initial, deferred, requests: () => requests, verifications: () => verifications };
}

test('blocked extraction resumes once against the exact same validated DOM without another parse or GET', async () => {
  let firstTree, resume, checks = 0;
  const initial = await extractHtml(markup(), FILM, { identityCheck: all => {
    firstTree = all; checks++; return { status: 'unresolved', reason: 'authored-block' };
  }, onIdentityBlocked: continuation => { resume = continuation; } });
  assert.equal(initial.status, 'identity-unresolved');
  const resumed = await resume(all => {
    assert.equal(all, firstTree); checks++;
    return { status: 'matched', reason: 'authored-proof' };
  });
  assert.equal(resumed.identity.status, 'matched'); assert.ok(resumed.candidates.length > 0);
  const second = await resume(() => assert.fail('a continuation cannot rerun verification'));
  assert.equal(second.identity.status, 'unresolved'); assert.equal(checks, 2);
});

test('deferred person verification withholds first result and keeps original receipt metadata and exact card on resume', async () => {
  const m = await prepared({ verify: async pointer => {
    assert.deepEqual(pointer, { sourceURL: PROFILE, sourceAlias: ALIAS }); return proof();
  } });
  assert.equal(m.initial.identity.reason, 'director-alias-unestablished');
  assert.deepEqual(m.initial.candidates, []); assert.equal(m.initial.localization, undefined);
  assert.equal(m.verifications(), 0); assert.equal(m.requests(), 1);
  assert.deepEqual(Object.keys(m.deferred).sort(), ['dispose', 'identity', 'pointer', 'resume']);
  assert.doesNotMatch(JSON.stringify(m.initial), /persons\/authored-director|sourceAlias|resume|dispose/);
  const resumed = await m.deferred.resume();
  assert.equal(resumed.identity.status, 'matched'); assert.ok(resumed.candidates.length > 0);
  assert.equal(resumed.receivedAt, m.initial.receivedAt); assert.equal(resumed.bytes, m.initial.bytes);
  assert.equal(resumed.httpStatus, m.initial.httpStatus); assert.equal(resumed.sourceURL, CARD);
  assert.equal(resumed.localization.provenance.receivedAt, m.initial.receivedAt);
  assert.equal(m.verifications(), 1); assert.equal(m.requests(), 1);
  assert.equal(await m.deferred.resume(), resumed, 'repeated await reuses completed result, not verification');
  assert.equal(m.verifications(), 1); m.deferred.dispose();
});

test('deferred proof retains exact selected person, alias, profile and scope validation', async () => {
  for (const bad of [proof({ personId: 999998 }), proof({ namespace: 'imdb:person' }),
    proof({ scope: 'another-scope' }), proof({ sourceURL: PROFILE + '-other' }),
    { ...proof(), aliases: ['Similar but different spelling'] }, { ...proof(), status: 'unresolved' }, null]) {
    const m = await prepared({ verify: async () => bad });
    const resumed = await m.deferred.resume();
    assert.equal(resumed.identity.reason, 'director-alias-unestablished');
    assert.deepEqual(resumed.candidates, []); assert.equal(resumed.localization, undefined);
    assert.equal(m.requests(), 1); assert.equal(m.verifications(), 1);
  }
});

test('disposing an unused continuation releases it without person I/O or recovering withheld claims', async () => {
  const m = await prepared(); m.deferred.dispose(); m.deferred.dispose();
  assert.equal(await m.deferred.resume(), m.initial);
  assert.equal(m.verifications(), 0); assert.equal(m.requests(), 1);
});

test('handler abort after initial read prevents deferred I/O even though card read has already returned', async () => {
  const controller = new AbortController();
  const m = await prepared({ signal: controller.signal }); controller.abort();
  const resumed = await m.deferred.resume();
  assert.equal(resumed.status, 'timeout-or-cancelled-no-retry');
  assert.deepEqual(resumed.candidates, []); assert.equal(m.verifications(), 0); assert.equal(m.requests(), 1);
});

test('handler abort bounds an in-flight deferred verification and late proof cannot restore claims', async () => {
  const controller = new AbortController(); let complete, started;
  const ready = new Promise(resolve => { started = resolve; });
  const m = await prepared({ signal: controller.signal, verify: () => {
    started(); return new Promise(resolve => { complete = resolve; });
  } });
  const pending = m.deferred.resume(); await ready; controller.abort();
  const resumed = await pending;
  assert.equal(resumed.status, 'timeout-or-cancelled-no-retry'); assert.deepEqual(resumed.candidates, []);
  complete(proof()); await Promise.resolve(); await Promise.resolve();
  assert.equal(m.initial.identity.status, 'unresolved'); assert.equal(m.initial.localization, undefined);
  assert.equal(m.verifications(), 1); assert.equal(m.requests(), 1);
});

test('matched cards, prior film conflicts and absent/ambiguous pointers never register deferred verification', async () => {
  for (const html of [markup(), markup({ title: 'Different title', director: linked }),
    markup({ year: 2002, director: linked }), markup({ director: ALIAS }),
    markup({ director: linked + linked }),
    markup({ director: linked, stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' })]) {
    const m = await prepared({ html });
    assert.equal(m.deferred, undefined); assert.equal(m.verifications(), 0); assert.equal(m.requests(), 1);
  }
  let hooks = 0;
  for (const status of ['matched', 'mismatch']) await extractHtml(markup(), FILM, {
    identityCheck: () => ({ status }), onIdentityBlocked: () => { hooks++; },
  });
  assert.equal(hooks, 0);
});

test('registration failure is safe and default eager behavior remains available for existing callers', async () => {
  const m = await prepared({ registration: () => { throw Error('authored controller failure'); } });
  assert.equal(m.initial.identity.status, 'unresolved'); assert.equal(m.verifications(), 0);
  assert.equal(await m.deferred.resume(), m.initial);
  let verified = 0;
  const eager = await fetchAssistedKinobaza(CARD, FILM, async () => new Response(markup({ director: linked }), {
    headers: { 'content-type': 'text/html' },
  }), { verifyDirector: async () => { verified++; return proof(); } });
  assert.equal(eager.identity.status, 'matched'); assert.equal(verified, 1);
});
