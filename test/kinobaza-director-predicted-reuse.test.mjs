// Authored person/card bindings only. No live identities, requests or storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectorVerifier } from '../netlify/lib/kinobaza-director-verifier.mjs';
import { safeDirectorProfileDiagnostic } from '../shared/media-advice/director-profile-diagnostics.mjs';

const KEY = 'AUTHORED_PRIVATE_REUSE_KEY';
const ID = 900001;
const LATIN = 'Authored Director';
const ALIAS = 'Авторський режисер';
const URL = 'https://kinobazaua.com/persons/authored-director';
const NEXT = 'https://kinobazaua.com/persons/authored-predicted-director';
const THIRD = 'https://kinobazaua.com/persons/other-authored-director';
const TMDB = `https://api.themoviedb.org/3/person/${ID}?language=en-US&append_to_response=external_ids`;
const FILM = () => ({ directorCount: 1, directorPeople: [{ namespace: 'tmdb:person', personId: ID, names: [LATIN] }] });
const PERSON = () => ({ id: ID, name: LATIN, also_known_as: [], birthday: '1967-05-20', imdb_id: 'nm9000001', external_ids: { imdb_id: 'nm9000001' } });
const input = (sourceURL = URL, sourceAlias = ALIAS) => ({ sourceURL, sourceAlias });
const page = (url, { alias = ALIAS, latin = LATIN, birthday = '20 травня 1967', sameAs, jsonBirthday } = {}) => `<!doctype html><html><head><link rel="canonical" href="${url}">${sameAs || jsonBirthday ? `<script type="application/ld+json">${JSON.stringify({ '@type': 'Person', url, name: alias, sameAs, birthDate: jsonBirthday })}</script>` : ''}</head><body><div class="col-8"><h1 class="h2">${alias}</h1><h2 class="h3 text-muted">${latin}</h2><p>Дата народження: ${birthday}</p><p>Ролі: режисер</p></div></body></html>`;

function mock({ sourceCap = 14, film = FILM(), person = PERSON(), prior = [], profile = {}, reserve: reserveImpl, transport, signal } = {}) {
  const calls = [...prior], reservations = [], requests = [];
  const reserve = async stage => { reservations.push(stage); await reserveImpl?.(stage); };
  const fetchImpl = async (url, init) => {
    requests.push(url);
    const stage = url === TMDB ? 'tmdb-person' : requests.filter(u => u !== TMDB).length === 1 ? 'kinobaza-person' : 'kinobaza-person-predicted';
    assert.equal(reservations.at(-1), stage, 'reserve the exact stage before HTTP');
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.ok(init.signal instanceof AbortSignal);
    assert.ok([TMDB, URL, NEXT, THIRD].includes(url), 'never synthesize or follow a different source URL');
    const headers = new Headers(init.headers);
    if (url === TMDB) assert.equal(headers.get('authorization'), `Bearer ${KEY}`);
    else { assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false); }
    if (transport) return transport(url, init);
    return url === TMDB ? Response.json(person) : new Response(page(url, profile[url]), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return { ...createDirectorVerifier({ film, tmdbToken: KEY, sourceCap, reserve, fetchImpl, calls, signal }), calls, reservations, requests };
}

test('cap14 keeps the original pair and only the explicit predicted phase can add one KB profile GET', async () => {
  const m = mock();
  assert.equal((await m.verify(input())).status, 'confirmed');
  assert.equal((await m.verify(input(NEXT), { predicted: true })).reason, 'director-profile-pair-unavailable');
  assert.equal(m.requests.length, 2, 'an extra option on the normal API grants no stage');
  const result = await m.verifyPredicted(input(NEXT));
  assert.equal(result.status, 'confirmed'); assert.equal(result.provenance.personId, ID); assert.equal(result.provenance.sourceURL, NEXT);
  assert.deepEqual(m.requests, [TMDB, URL, NEXT]);
  assert.deepEqual(m.reservations, ['tmdb-person', 'kinobaza-person', 'kinobaza-person-predicted']);
  assert.equal((await m.verifyPredicted(input(THIRD))).reason, 'director-profile-predicted-reuse-unavailable');
  assert.equal(m.requests.length, 3);
  const d = safeDirectorProfileDiagnostic(m.diagnostic());
  assert.equal(d.sourceAttempts, 3); assert.equal(d.tmdbPersonCalls, 1); assert.equal(d.kinobazaPersonCalls, 2);
  assert.deepEqual(d.attempts.map(a => a.stage), m.reservations);
  assert.doesNotMatch(JSON.stringify(d), /AUTHORED|Авторський|https|1967|nm9000001|900001/);
});

test('cap8/cap10/cap12 and malformed caps cannot enable a predicted-specific profile stage', async () => {
  for (const sourceCap of [8, 10, 12, '14', 13, 15]) {
    const m = mock({ sourceCap });
    assert.equal((await m.verifyPredicted(input())).status, 'unresolved');
    assert.deepEqual(m.reservations, []); assert.deepEqual(m.requests, []);
  }
  for (const sourceCap of [10, 12]) {
    const m = mock({ sourceCap });
    assert.equal((await m.verify(input())).status, 'confirmed');
    assert.equal((await m.verify(input(NEXT))).reason, 'director-profile-pair-unavailable');
    assert.deepEqual(m.requests, [TMDB, URL]);
  }
});

test('when the normal pair was not used, a predicted card may use that original pair, not a second pair', async () => {
  const m = mock();
  assert.equal((await m.verifyPredicted(input())).status, 'confirmed');
  assert.deepEqual(m.reservations, ['tmdb-person', 'kinobaza-person']);
  assert.equal((await m.verifyPredicted(input(NEXT))).status, 'confirmed');
  assert.deepEqual(m.reservations, ['tmdb-person', 'kinobaza-person', 'kinobaza-person-predicted']);
  assert.equal((await m.verifyPredicted(input(THIRD))).status, 'unresolved');
});

test('identical fixed-person URL/normalized-alias calls share the original Promise and proof across phases', async () => {
  const m = mock();
  const first = m.verify(input()), concurrent = m.verifyPredicted(input(URL, `  ${ALIAS}  `));
  assert.equal(first, concurrent); assert.equal((await first).status, 'confirmed');
  assert.equal(await m.verifyPredicted(input()), await first); assert.deepEqual(m.requests, [TMDB, URL]);
});

test('exact failures are reused without HTTP and alias changes never retry an already attempted profile URL', async () => {
  for (const kind of ['network', 'parse', 'birthday']) {
    const m = mock({ transport: url => {
      if (url === TMDB) return Response.json(PERSON());
      if (kind === 'network') throw Error('AUTHORED_PRIVATE_ERROR');
      return new Response(kind === 'parse' ? '<!doctype html><h1>Broken</h1>' : page(url, { birthday: '26 травня 1967' }), { headers: { 'content-type': 'text/html' } });
    } });
    const first = m.verify(input()), result = await first;
    assert.equal(result.status, 'unresolved'); assert.equal(m.verifyPredicted(input()), first);
    assert.equal((await m.verifyPredicted(input(URL, 'Інше написання'))).reason, 'director-profile-predicted-reuse-unavailable');
    assert.equal(m.requests.length, 2); assert.equal(m.reservations.length, 2);
    assert.doesNotMatch(JSON.stringify(m.diagnostic()), /AUTHORED_PRIVATE_ERROR/);
  }
});

test('failed or invalid TMDb projection cannot be retried or replaced by an extra profile request', async () => {
  for (const kind of ['network', 'auth', 'id', 'imdb', 'secret']) {
    const m = mock({ transport: () => {
      if (kind === 'network') throw Error('AUTHORED_PRIVATE_ERROR');
      if (kind === 'auth') return new Response('AUTHORED_PRIVATE_BODY', { status: 401 });
      return Response.json({ ...PERSON(), ...(kind === 'id' ? { id: ID + 1 } : kind === 'imdb' ? { external_ids: { imdb_id: 'nm9000002' } } : { name: KEY }) });
    } });
    assert.equal((await m.verify(input())).status, 'unresolved');
    assert.equal((await m.verifyPredicted(input(NEXT))).reason, 'director-profile-predicted-projection-unavailable');
    assert.deepEqual(m.requests, [TMDB]); assert.deepEqual(m.reservations, ['tmdb-person']);
  }
});

test('a stage from another verifier is not a reusable projection and does not authorize another TMDb GET', async () => {
  for (const prior of [[{ stage: 'tmdb-person' }], [{ stage: 'kinobaza-person' }], [{ stage: 'kinobaza-person-predicted' }]]) {
    const m = mock({ prior });
    assert.equal((await m.verifyPredicted(input(NEXT))).reason, 'director-profile-predicted-projection-unavailable');
    assert.deepEqual(m.requests, []); assert.deepEqual(m.reservations, []);
  }
});

test('a successful TMDb projection survives a first-profile failure, but the next profile must prove itself', async () => {
  const m = mock({ profile: { [URL]: { birthday: '26 травня 1967' } } });
  assert.equal((await m.verify(input())).reason, 'director-person-birthday-conflict');
  const result = await m.verifyPredicted(input(NEXT));
  assert.equal(result.status, 'confirmed'); assert.equal(result.provenance.sourceURL, NEXT); assert.deepEqual(result.aliases, [ALIAS]);
  assert.deepEqual(m.requests, [TMDB, URL, NEXT]);
});

test('an independently proven alternate profile returns only its own card-bound alias and provenance', async () => {
  const alternateAlias = 'Інше написання режисера';
  const m = mock({ profile: { [NEXT]: { alias: alternateAlias } } });
  assert.equal((await m.verify(input())).status, 'confirmed');
  const result = await m.verifyPredicted(input(NEXT, alternateAlias));
  assert.equal(result.status, 'confirmed'); assert.deepEqual(result.aliases, [alternateAlias]);
  assert.equal(result.provenance.sourceURL, NEXT); assert.equal(result.provenance.personId, ID);
  assert.deepEqual(m.requests, [TMDB, URL, NEXT]);
});

test('fixed-person reuse never transplants aliases/proof over different-person, birthday or native-alias conflicts', async () => {
  for (const profile of [
    { birthday: '26 травня 1967' },
    { sameAs: ['https://www.themoviedb.org/person/900002'] },
    { sameAs: ['https://www.imdb.com/name/nm9000002/'] },
    { alias: 'Тезка автора' },
    { latin: 'Different Authored Person' },
  ]) {
    const m = mock({ profile: { [NEXT]: profile } });
    assert.equal((await m.verify(input())).status, 'confirmed');
    const result = await m.verifyPredicted(input(NEXT));
    assert.equal(result.status, 'unresolved'); assert.deepEqual(result.aliases, []); assert.equal(result.provenance, undefined);
    assert.deepEqual(m.requests, [TMDB, URL, NEXT]);
  }
});

test('the credits person ID and expected names are snapshotted, with no global or cross-invocation cache', async () => {
  const film = FILM(), m = mock({ film });
  assert.equal((await m.verify(input())).status, 'confirmed');
  film.directorPeople[0].personId = ID + 1; film.directorPeople[0].names.splice(0, 1, 'Different Authored Person');
  const result = await m.verifyPredicted(input(NEXT));
  assert.equal(result.status, 'confirmed'); assert.equal(result.provenance.personId, ID);
  const other = mock(); assert.equal((await other.verify(input())).status, 'confirmed');
  assert.deepEqual(m.requests, [TMDB, URL, NEXT]); assert.deepEqual(other.requests, [TMDB, URL]);
});

test('one extra profile cannot exceed cap14 or spend another pair without the two required slots', async () => {
  const prior = Array.from({ length: 11 }, (_, i) => ({ stage: `baseline-${i}` }));
  const m = mock({ prior });
  assert.equal((await m.verify(input())).status, 'confirmed'); assert.equal(m.calls.length, 13);
  assert.equal((await m.verifyPredicted(input(NEXT))).status, 'confirmed'); assert.equal(m.calls.length, 14);
  assert.equal((await m.verifyPredicted(input(THIRD))).status, 'unresolved'); assert.equal(m.calls.length, 14);
  const short = mock({ prior: Array.from({ length: 13 }, (_, i) => ({ stage: `baseline-${i}` })) });
  assert.equal((await short.verifyPredicted(input())).reason, 'director-profile-pair-unavailable');
  assert.deepEqual(short.requests, []); assert.deepEqual(short.reservations, []);
});

test('parallel predicted candidates lock the sole extra KB slot before awaiting reservation', async () => {
  let release;
  const m = mock({ reserve: stage => stage === 'kinobaza-person-predicted' ? new Promise(resolve => { release = resolve; }) : undefined });
  await m.verify(input());
  const first = m.verifyPredicted(input(NEXT));
  assert.equal(m.verifyPredicted(input(NEXT)), first);
  assert.equal((await m.verifyPredicted(input(THIRD))).reason, 'director-profile-predicted-reuse-unavailable');
  while (!release) await Promise.resolve();
  release(); assert.equal((await first).status, 'confirmed'); assert.deepEqual(m.requests, [TMDB, URL, NEXT]);
});

test('denied/lost extra reservation or aborted extra transport never authorizes a retry', async () => {
  for (const kind of ['denied', 'lost', 'transport']) {
    const abort = new AbortController();
    const m = mock({ signal: abort.signal,
      reserve: stage => {
        if (stage !== 'kinobaza-person-predicted') return;
        if (kind === 'denied') throw Error('AUTHORED_PRIVATE_SQL');
        if (kind === 'lost') { queueMicrotask(() => abort.abort()); return new Promise(() => {}); }
      },
      transport: url => {
        if (url === TMDB) return Response.json(PERSON());
        if (url === NEXT && kind === 'transport') { queueMicrotask(() => abort.abort()); return new Promise(() => {}); }
        return new Response(page(url), { headers: { 'content-type': 'text/html' } });
      },
    });
    assert.equal((await m.verify(input())).status, 'confirmed');
    assert.equal((await m.verifyPredicted(input(NEXT))).status, 'unresolved');
    const attempts = m.requests.length;
    assert.equal((await m.verifyPredicted(input(NEXT))).status, 'unresolved'); assert.equal(m.requests.length, attempts);
    assert.equal(m.reservations.length, 3); assert.doesNotMatch(JSON.stringify(m.diagnostic()), /AUTHORED_PRIVATE|https/);
  }
});

test('predicted pointer admission and alias policy cannot be weakened by reusable TMDb data', async () => {
  const m = mock(); await m.verify(input());
  for (const pointer of [input(`${NEXT}?secret=PRIVATE`), input(`${NEXT}/`), input(NEXT.replace('/persons/', '/titles/')), input(NEXT, ''), input(NEXT, KEY)]) {
    assert.equal((await m.verifyPredicted(pointer)).reason, 'director-profile-pointer-rejected');
  }
  assert.deepEqual(m.requests, [TMDB, URL]); assert.equal((await m.verifyPredicted(input(NEXT))).status, 'confirmed');
});

test('knownConflict is synchronous and false until an exact pointer has settled with a proven person contradiction', { timeout: 2_000 }, async () => {
  let release;
  const m = mock({ transport: url => {
    if (url === TMDB) return Response.json(PERSON());
    return new Promise(resolve => { release = () => resolve(new Response(page(url, { birthday: '26 травня 1967' }), { headers: { 'content-type': 'text/html' } })); });
  } });
  assert.equal(m.knownConflict(input()), false);
  const pending = m.verify(input());
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(m.knownConflict(input()), false, 'an unresolved request is not a contradiction');
  release(); assert.equal((await pending).reason, 'director-person-birthday-conflict');
  assert.equal(m.knownConflict(input()), true); assert.equal(m.knownConflict(input(URL, `  ${ALIAS}  `)), true);
  assert.equal(m.knownConflict(input(NEXT)), false); assert.equal(m.knownConflict(input(URL, 'Інший режисер')), false);
  assert.equal(m.knownConflict(input(`${URL}?secret=PRIVATE`)), false); assert.equal(m.knownConflict(), false);
  assert.deepEqual(m.requests, [TMDB, URL]); assert.equal(mock().knownConflict(input()), false, 'no cross-invocation conflict memory');
});

test('only precise profile ID or birthday conflicts become known; source, alias, markup and API failures do not', async () => {
  const conflicts = [
    { options: { sameAs: ['https://www.themoviedb.org/person/900002'] }, reason: 'director-person-id-conflict' },
    { options: { sameAs: ['https://www.imdb.com/name/nm9000002/'] }, reason: 'director-person-id-conflict' },
    { options: { sameAs: ['https://www.imdb.com/name/nm9000001/', 'https://www.imdb.com/name/nm9000002/'] }, reason: 'profile-person-id-conflict' },
    { options: { birthday: '26 травня 1967' }, reason: 'director-person-birthday-conflict' },
    { options: { jsonBirthday: '1967-05-26' }, reason: 'profile-birthday-conflict' },
  ];
  for (const { options, reason } of conflicts) {
    const m = mock({ profile: { [URL]: options } });
    const result = await m.verify(input()); assert.equal(result.reason, reason);
    assert.equal(m.knownConflict(input()), true);
    result.reason = 'confirmed-person-profile-facts';
    assert.equal(m.knownConflict(input()), true, 'caller mutation cannot erase the settled contradiction');
  }
  for (const kind of ['confirmed', 'network', 'parse', 'alias', 'insufficient', 'tmdb-id', 'tmdb-dob']) {
    const m = mock({
      person: { ...PERSON(), ...(kind === 'tmdb-id' ? { id: ID + 1 } : kind === 'tmdb-dob' ? { birthday: 'not-a-date' } : {}) },
      transport: kind === 'network' ? () => { throw Error('AUTHORED_PRIVATE_ERROR'); } : undefined,
      profile: { [URL]: kind === 'alias' ? { alias: 'Тезка автора' } : kind === 'insufficient' ? { latin: 'Different Authored Person' } : {} },
    });
    if (kind === 'parse') {
      const parse = mock({ transport: url => url === TMDB ? Response.json(PERSON()) : new Response('<!doctype html><h1>Broken</h1>', { headers: { 'content-type': 'text/html' } }) });
      await parse.verify(input()); assert.equal(parse.knownConflict(input()), false); continue;
    }
    const result = await m.verify(input()); assert.equal(m.knownConflict(input()), false, kind);
    result.reason = 'director-person-id-conflict';
    assert.equal(m.knownConflict(input()), false, 'caller mutation cannot invent a settled contradiction');
    assert.equal(m.knownConflict(input(NEXT)), false);
  }
});
