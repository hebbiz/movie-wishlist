// Authored records/HTML/transports only. No live person evidence or sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectorVerifier } from '../netlify/lib/kinobaza-director-verifier.mjs';

const KEY = 'AUTHORED_PRIVATE_TMDB_TOKEN';
const URL = 'https://kinobazaua.com/persons/authored-director';
const TMDB = 'https://api.themoviedb.org/3/person/900001?language=en-US&append_to_response=external_ids';
const ALIAS = 'Авторський режисер';
const LATIN = 'Authored Director';
const FILM = { directorCount: 1, directorPeople: [{ namespace: 'tmdb:person', personId: 900001, names: [LATIN] }] };
const person = overrides => ({ id: 900001, name: LATIN, also_known_as: [], birthday: '1967-05-20', imdb_id: 'nm9000001', external_ids: { imdb_id: 'nm9000001' }, ...overrides });
const html = ({ birthday = '20 травня 1967', role = 'режисер', extra = '', json } = {}) => `<!doctype html><html><head><link rel="canonical" href="${URL}">${json ? `<script type="application/ld+json">${JSON.stringify(json)}</script>` : ''}</head><body><div class="col-8"><h1 class="h2">${ALIAS}</h1><h2 class="h3 text-muted">${LATIN}</h2><p>Дата народження: ${birthday}</p><p>Ролі: ${role}</p></div>${extra}</body></html>`;

function mock({ sourceCap = 10, film = FILM, tmdbToken = KEY, prior = [], reserve: reserveImpl, transport, tmdb = person(), page = html(), signal } = {}) {
  const calls = [...prior], reservations = [], requests = [];
  const reserve = async stage => { reservations.push(stage); if (reserveImpl) return reserveImpl(stage); };
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    assert.equal(reservations.at(-1), url === TMDB ? 'tmdb-person' : 'kinobaza-person', 'durable reservation must precede dispatch');
    assert.ok([TMDB, URL].includes(url)); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.ok(init.signal instanceof AbortSignal);
    const headers = new Headers(init.headers);
    if (url === URL) { assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false); }
    else assert.equal(headers.get('authorization'), `Bearer ${tmdbToken}`);
    if (transport) return transport(url, init);
    return url === TMDB ? Response.json(tmdb) : new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const controller = createDirectorVerifier({ film, tmdbToken, sourceCap, reserve, fetchImpl, calls, signal });
  return { ...controller, calls, reservations, requests };
}
const input = { sourceURL: URL, sourceAlias: ALIAS };

test('two bounded exact requests confirm the linked person without acquiring or changing film claims', async () => {
  const m = mock();
  const result = await m.verify(input);
  assert.equal(result.status, 'confirmed'); assert.deepEqual(result.aliases, [ALIAS]); assert.equal(result.provenance.personId, 900001);
  assert.deepEqual(m.requests.map(r => r.url), [TMDB, URL]); assert.deepEqual(m.reservations, ['tmdb-person', 'kinobaza-person']);
  assert.deepEqual(m.calls.map(c => c.stage), m.reservations); assert.ok(m.calls.every(c => c.status === 'response-received'));
  const diagnostic = m.diagnostic();
  assert.equal(diagnostic.sourceAttempts, 2); assert.equal(diagnostic.reservationsAcknowledged, 2); assert.equal(diagnostic.tmdbPersonCalls, 1); assert.equal(diagnostic.kinobazaPersonCalls, 1);
  assert.equal(diagnostic.accounting, 'reserved-attempts-spent-no-retry');
  assert.doesNotMatch(JSON.stringify(diagnostic), /Authored|Авторський|1967|nm9000001|https|AUTHORED_PRIVATE/);
});

test('cap8, invalid server cap, missing credential and untrusted/multi-person context make zero source reservations', async () => {
  for (const config of [
    { sourceCap: 8 }, { sourceCap: 11 }, { sourceCap: '10' }, { sourceCap: '12' },
    { tmdbToken: '' }, { tmdbToken: 'a b' }, { tmdbToken: 'x'.repeat(4097) },
    { film: {} }, { film: { ...FILM, directorCount: 2 } }, { film: { ...FILM, directorPeople: [...FILM.directorPeople, ...FILM.directorPeople] } },
    { film: { directorCount: 1, directorPeople: [{ ...FILM.directorPeople[0], personId: '900001' }] } },
  ]) {
    const m = mock(config); const result = await m.verify(input);
    assert.equal(result.status, 'unresolved'); assert.equal(m.requests.length, 0); assert.equal(m.reservations.length, 0);
  }
  const m = createDirectorVerifier({ film: FILM, tmdbToken: KEY, reserve: () => assert.fail('no durable cap') });
  assert.equal((await m.verify(input)).status, 'unresolved');
});

test('unadmitted pointer, unsafe alias or absent durable ledger cannot expand the network boundary', async () => {
  for (const sourceURL of [URL + '/', URL + '?token=PRIVATE', URL + '#x', URL.replace('https:', 'http:'), URL.replace('/persons/', '/titles/'), URL.replace('kinobazaua.com', 'user:pass@kinobazaua.com'), URL.replace('kinobazaua.com', 'foreign.example'), URL.replace('.com/', '.com:443/')]) {
    const m = mock(); assert.equal((await m.verify({ sourceURL, sourceAlias: ALIAS })).status, 'unresolved'); assert.equal(m.requests.length, 0);
  }
  for (const sourceAlias of ['', 'x'.repeat(501), 'private\u0000value', KEY]) {
    const m = mock(); assert.equal((await m.verify({ sourceURL: URL, sourceAlias })).status, 'unresolved'); assert.equal(m.requests.length, 0);
  }
  const m = createDirectorVerifier({ film: FILM, tmdbToken: KEY, sourceCap: 10, fetchImpl: () => assert.fail('missing ledger') });
  assert.equal((await m.verify(input)).status, 'unresolved');
});

test('same-profile concurrent calls share one Promise while different pointers cannot reserve another pair', async () => {
  const m = mock();
  const first = m.verify(input), second = m.verify(input);
  assert.equal(first, second); const different = await m.verify({ sourceURL: URL.replace('authored-director', 'other-person'), sourceAlias: ALIAS });
  assert.equal(different.status, 'unresolved'); assert.equal(different.reason, 'director-profile-pair-unavailable');
  assert.equal((await first).status, 'confirmed'); assert.equal((await m.verify(input)).status, 'confirmed'); assert.equal(m.requests.length, 2);
  const altered = await m.verify({ ...input, sourceAlias: 'Інший режисер' });
  assert.equal(altered.status, 'unresolved'); assert.equal(m.requests.length, 2);
});

test('a different invocation does not share profile cache or mutate a global alias registry', async () => {
  const a = mock(), b = mock();
  assert.equal((await a.verify(input)).status, 'confirmed'); assert.equal((await b.verify(input)).status, 'confirmed');
  assert.equal(a.requests.length, 2); assert.equal(b.requests.length, 2);
});

test('the pair retains second search/card headroom and cannot exceed the trusted cap10', async () => {
  const baseline = Array.from({ length: 8 }, (_, i) => ({ stage: `existing-${i + 1}`, status: 'response-received' }));
  const m = mock({ prior: baseline }); assert.equal((await m.verify(input)).status, 'confirmed'); assert.equal(m.calls.length, 10);
  for (const prior of [[...baseline, { stage: 'search-2' }], [{ stage: 'tmdb-person' }], [{ stage: 'kinobaza-person' }]]) {
    const n = mock({ prior }); assert.equal((await n.verify(input)).reason, 'director-profile-pair-unavailable'); assert.equal(n.requests.length, 0);
  }
});

test('reservation denial and lost reservation reply fail closed without transport or a second try', async () => {
  for (const stage of ['tmdb-person', 'kinobaza-person']) {
    const m = mock({ reserve: s => { if (s === stage) throw Error('PRIVATE_SQL_ERROR'); } });
    const result = await m.verify(input); assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-reservation-unavailable');
    assert.equal(m.requests.length, stage === 'tmdb-person' ? 0 : 1); assert.equal(m.calls.length, m.requests.length);
    assert.equal(m.diagnostic().attempts.at(-1).status, 'reservation-denied');
    await m.verify(input); assert.equal(m.requests.length, stage === 'tmdb-person' ? 0 : 1);
    assert.doesNotMatch(JSON.stringify(m.diagnostic()), /PRIVATE_SQL/);
  }
  const abort = new AbortController();
  const m = mock({ signal: abort.signal, reserve: () => { queueMicrotask(() => abort.abort()); return new Promise(() => {}); } });
  assert.equal((await m.verify(input)).status, 'unresolved'); assert.equal(m.requests.length, 0);
  assert.equal(m.diagnostic().accounting, 'reservation-may-have-committed-no-retry');
});

test('timeout after reservation consumes the attempt and suppresses late responses without retries', async () => {
  for (const stage of ['tmdb-person', 'kinobaza-person']) {
    const abort = new AbortController(); let late;
    const m = mock({ signal: abort.signal, transport: (url) => {
      if (url === TMDB && stage !== 'tmdb-person') return Response.json(person());
      queueMicrotask(() => abort.abort());
      return new Promise(resolve => { late = resolve; });
    } });
    const result = await m.verify(input); assert.equal(result.status, 'unresolved');
    assert.equal(m.requests.length, stage === 'tmdb-person' ? 1 : 2); assert.equal(m.calls.length, m.requests.length);
    assert.equal(m.diagnostic().attempts.at(-1).status, 'transport-outcome-unknown');
    late(new Response(html(), { headers: { 'content-type': 'text/html' } }));
    assert.equal((await m.verify(input)).status, 'unresolved');
    assert.doesNotMatch(JSON.stringify(m.diagnostic()), /AUTHORED_PRIVATE|1967/);
  }
});

test('the five-second stage deadline bounds a transport that ignores its AbortSignal', { timeout: 8_000 }, async () => {
  // Keep the test event loop alive while AbortSignal.timeout's unref'ed timer
  // guards a deliberately hung mock. This never changes production timeouts.
  const hold = setTimeout(() => {}, 7_000), started = Date.now();
  try {
    const m = mock({ transport: () => new Promise(() => {}) });
    const result = await m.verify(input);
    assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-tmdb-timeout-no-retry');
    assert.ok(Date.now() - started >= 4_500); assert.equal(m.requests.length, 1); assert.equal(m.reservations.length, 1);
    assert.equal(m.diagnostic().sourceAttempts, 1); assert.equal(m.diagnostic().accounting, 'reserved-attempts-spent-no-retry');
  } finally { clearTimeout(hold); }
});

test('HTTP errors and redirects at either source never follow Location or consume another pair', async () => {
  for (const target of [TMDB, URL]) for (const status of [301, 302, 401, 403, 404, 429, 500]) {
    const m = mock({ transport: url => url !== target ? Response.json(person()) : new Response('PRIVATE_ERROR_BODY', { status, headers: { location: 'https://private.example/PRIVATE_DESTINATION' } }) });
    assert.equal((await m.verify(input)).status, 'unresolved'); assert.equal(m.requests.length, target === TMDB ? 1 : 2);
    await m.verify(input); assert.equal(m.requests.length, target === TMDB ? 1 : 2);
    assert.doesNotMatch(JSON.stringify(m.diagnostic()), /PRIVATE|private\.example/);
  }
});

test('invalid person IDs, metadata conflicts and profile DOB/ID conflicts never yield an alias', async () => {
  for (const tmdb of [person({ id: 900002 }), person({ external_ids: { imdb_id: 'nm9000002' } }), person({ success: false })]) {
    const m = mock({ tmdb }); const result = await m.verify(input);
    assert.equal(result.status, 'unresolved'); assert.deepEqual(result.aliases, []); assert.equal(m.requests.length, 1);
  }
  for (const page of [html({ birthday: '26 травня 1967' }), html({ role: 'актор' }), html({ json: { '@type': 'Person', url: URL, name: ALIAS, sameAs: ['https://www.imdb.com/name/nm9000002/'] } })]) {
    const m = mock({ page }); const result = await m.verify(input);
    assert.equal(result.status, 'unresolved'); assert.deepEqual(result.aliases, []); assert.equal(m.requests.length, 2);
  }
});

test('secret echoes, raw content and error strings never enter diagnostics or returned evidence', async () => {
  for (const config of [{ tmdb: person({ name: KEY }) }, { page: html({ extra: `<p>${KEY}</p>` }) }, { transport: () => { throw Error('PRIVATE_TRANSPORT_SECRET'); } }]) {
    const m = mock(config); const result = await m.verify(input);
    assert.equal(result.status, 'unresolved'); assert.deepEqual(result.aliases, []);
    assert.doesNotMatch(JSON.stringify({ result, diagnostics: m.diagnostic(), calls: m.calls }), /AUTHORED_PRIVATE|PRIVATE_TRANSPORT|<html|also_known_as|1967|nm9000001/);
  }
});

test('profile body size/type/UTF-8/challenge refusals do not retry or expose source contents', async () => {
  for (const response of [
    () => new Response('PRIVATE_BODY', { headers: { 'content-type': 'application/json' } }),
    () => new Response('PRIVATE_BODY', { headers: { 'content-type': 'text/html; charset=windows-1251' } }),
    () => new Response('PRIVATE_BODY', { headers: { 'content-type': 'text/html', 'content-length': String(2 * 1024 * 1024 + 1) } }),
    () => new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'text/html' } }),
    () => new Response('cf-chl-PRIVATE_CHALLENGE', { headers: { 'content-type': 'text/html' } }),
  ]) {
    const m = mock({ transport: url => url === TMDB ? Response.json(person()) : response() });
    assert.equal((await m.verify(input)).status, 'unresolved'); assert.equal(m.requests.length, 2);
    assert.doesNotMatch(JSON.stringify(m.diagnostic()), /PRIVATE_BODY|PRIVATE_CHALLENGE/);
  }
});

test('an already aborted handler signal makes zero reservations and diagnostics cannot be externally mutated', async () => {
  const abort = new AbortController(); abort.abort();
  const m = mock({ signal: abort.signal }); assert.equal((await m.verify(input)).status, 'unresolved'); assert.equal(m.reservations.length, 0);
  const diagnostic = m.diagnostic(); diagnostic.sourceAttempts = 99; diagnostic.attempts.push({ PRIVATE: true });
  assert.equal(m.diagnostic().sourceAttempts, 0); assert.deepEqual(m.diagnostic().attempts, []);
});
