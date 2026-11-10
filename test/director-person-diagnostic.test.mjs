// Authored person records and HTML only: these tests are not source evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDirectorPersonDiagnostic } from '../scripts/m4-director-person-diagnostic.mjs';

const TMDB_KEY = 'AUTHORED_TMDB_PERSON_KEY';
const PERSON = 999999;
const ALIAS = 'Денні Вільньов';
const CREDITS = 'https://api.themoviedb.org/3/movie/335984/credits?language=uk-UA';
const PERSON_URL = `https://api.themoviedb.org/3/person/${PERSON}?language=uk-UA&append_to_response=external_ids`;
const KINO = 'https://kinobazaua.com/persons/denis-villeneuve';
const credits = () => ({ id: 335984, crew: [{ id: PERSON, job: 'Director', name: 'Authored director', original_name: 'Authored director' }] });
const person = () => ({ id: PERSON, name: 'Authored director', also_known_as: [ALIAS], imdb_id: 'nm9999999', external_ids: { imdb_id: 'nm9999999' } });
function profile({ name = ALIAS, imdb = 'nm9999999', sameAs, extra = '' } = {}) {
  return `<!doctype html><html><head><link rel="canonical" href="${KINO}"><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name, url: KINO, sameAs: sameAs ?? [`https://www.imdb.com/name/${imdb}/`] })}</script></head><body><h1>${name}</h1>${extra}</body></html>`;
}
const json = value => JSON.stringify(value);
function sourceMock({ creditsData, personData, html = profile(), stageStatus = {}, failStage, bodyErrorStage } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    assert.ok(init.signal instanceof AbortSignal, 'all HTTP waits have a deadline signal');
    const stage = url === CREDITS ? 'credits' : url === PERSON_URL ? 'person' : url === KINO ? 'kinobaza' : null;
    assert.ok(stage, 'no title card, Tavily, provider destination or other undeclared endpoint');
    if (stage === 'kinobaza') {
      const headers = new Headers(init.headers);
      assert.equal(headers.has('authorization'), false, 'TMDb credentials never reach Kinobaza');
      assert.equal(headers.has('cookie'), false);
    } else assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${TMDB_KEY}`);
    if (stage === failStage) throw new DOMException('PRIVATE_TIMEOUT_BODY', 'AbortError');
    if (stage === bodyErrorStage) return new Response(new ReadableStream({ start(controller) { controller.error(Error('PRIVATE_BODY_STREAM')); } }), { headers: { 'content-type': stage === 'kinobaza' ? 'text/html' : 'application/json' } });
    if (stageStatus[stage]) return new Response('PRIVATE_HTTP_ERROR', { status: stageStatus[stage], headers: { location: 'https://private.example/redirect' } });
    if (stage === 'credits') return Response.json(creditsData ?? credits());
    if (stage === 'person') return Response.json(personData ?? person());
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return { calls, fetchImpl };
}
async function run(options) {
  const mock = sourceMock(options);
  const out = await runDirectorPersonDiagnostic({ tmdbToken: TMDB_KEY, fetchImpl: mock.fetchImpl });
  assert.equal(out.execution, 'local-diagnostic'); assert.equal(out.buildSha, null);
  assert.equal(out.mode, 'director-person-check');
  assert.deepEqual(out.limits, { tmdb: 2, personPages: 1, total: 3 });
  assert.deepEqual(out.accounting, { priorAttempts: 22, cumulativeMax: 25 });
  assert.equal(out.counts.total, mock.calls.length);
  assert.ok(out.counts.tmdb <= 2 && out.counts.personPages <= 1 && out.counts.total <= 3);
  assert.doesNotMatch(json(out), /AUTHORED_TMDB_PERSON_KEY|PRIVATE_HTTP_ERROR|PRIVATE_TIMEOUT_BODY|PRIVATE_BODY_STREAM|private\.example/);
  return { ...mock, out };
}

test('missing/invalid TMDb credential dispatches zero source attempts and never requests a Tavily key', async () => {
  for (const tmdbToken of [undefined, '', 'key with spaces', { token: 'PRIVATE' }]) {
    const out = await runDirectorPersonDiagnostic({ tmdbToken, fetchImpl: () => assert.fail('invalid credential must not dispatch') });
    assert.deepEqual(out.counts, { tmdb: 0, personPages: 0, total: 0 });
    assert.doesNotMatch(json(out), /PRIVATE/);
  }
});

test('exact alias in validated TMDb person record confirms in two reads and skips the optional person page', async () => {
  for (const personData of [person(), { ...person(), name: ALIAS, also_known_as: [] }]) {
    const { out, calls } = await run({ personData });
    assert.deepEqual(out.counts, { tmdb: 2, personPages: 0, total: 2 });
    assert.deepEqual(calls.map(c => c.url), [CREDITS, PERSON_URL]);
    assert.equal(out.outcome, 'confirmed-tmdb-person-alias');
    assert.ok(json(out).includes(ALIAS), 'bounded alias evidence is available without raw body');
  }
});

test('a non-matching TMDb alias needs the third allowed person page and an exact external person ID crosswalk', async () => {
  const { out, calls } = await run({ personData: { ...person(), also_known_as: ['Different literal spelling'] } });
  assert.deepEqual(out.counts, { tmdb: 2, personPages: 1, total: 3 });
  assert.deepEqual(calls.map(c => c.url), [CREDITS, PERSON_URL, KINO]);
  assert.equal(out.outcome, 'confirmed-external-person-id');
});

test('same slug/name without a common external person ID is insufficient evidence', async () => {
  const { out } = await run({ personData: { ...person(), also_known_as: [] }, html: profile({ imdb: 'nm9999998' }) });
  assert.notEqual(out.outcome, 'confirmed-external-person-id');
  assert.notEqual(out.outcome, 'confirmed-tmdb-person-alias');
});

test('a name similarity or diacritic difference is not promoted to the exact requested alias', async () => {
  for (const alias of ['Дені Вільнев', 'Denis Villeneuve', 'Денні Вільньов / Other director']) {
    const { out } = await run({ personData: { ...person(), also_known_as: [alias] }, html: profile({ name: alias }) });
    assert.notEqual(out.outcome, 'confirmed-tmdb-person-alias');
    assert.notEqual(out.outcome, 'confirmed-external-person-id');
  }
});

test('wrong movie ID and ambiguous or malformed director credits stop before person details', async () => {
  for (const creditsData of [
    { ...credits(), id: 335985 }, { id: 335984, crew: [] },
    { id: 335984, crew: [{ id: PERSON, job: 'Director' }, { id: PERSON + 1, job: 'Director' }] },
    { id: 335984, crew: [{ id: '999999', job: 'Director' }] },
    { id: 335984, crew: [{ id: PERSON, job: 'Writer' }] },
  ]) {
    const { out } = await run({ creditsData });
    assert.deepEqual(out.counts, { tmdb: 1, personPages: 0, total: 1 });
    assert.ok(!String(out.outcome).startsWith('confirmed-'));
  }
});

test('returned person ID must equal the verified credits ID even when target name is present', async () => {
  for (const id of [PERSON + 1, String(PERSON), null]) {
    const { out } = await run({ personData: { ...person(), id } });
    assert.deepEqual(out.counts, { tmdb: 2, personPages: 0, total: 2 });
    assert.ok(!String(out.outcome).startsWith('confirmed-'));
  }
});

test('conflicting TMDb root/appended external IDs cannot establish a shared-person confirmation', async () => {
  const { out } = await run({ personData: { ...person(), also_known_as: [], external_ids: { imdb_id: 'nm9999998' } } });
  assert.ok(!String(out.outcome).startsWith('confirmed-'));
});

test('HTTP auth/quota/server failures and redirects consume only actual attempts without retries or following Location', async () => {
  for (const stage of ['credits', 'person', 'kinobaza']) for (const status of [301, 302, 401, 403, 429, 500]) {
    const { out, calls } = await run({ personData: { ...person(), also_known_as: [] }, stageStatus: { [stage]: status } });
    const spent = stage === 'credits' ? 1 : stage === 'person' ? 2 : 3;
    assert.equal(calls.length, spent); assert.equal(out.attempts.length, spent);
    assert.ok(!String(out.outcome).startsWith('confirmed-'));
  }
});

test('header/body transport failures are counted without secret/raw error leakage or a retry', async () => {
  for (const stage of ['credits', 'person', 'kinobaza']) for (const kind of ['failStage', 'bodyErrorStage']) {
    const { out, calls } = await run({ personData: { ...person(), also_known_as: [] }, [kind]: stage });
    assert.equal(calls.length, stage === 'credits' ? 1 : stage === 'person' ? 2 : 3);
    assert.ok(!String(out.outcome).startsWith('confirmed-'));
  }
});

test('person HTML scripts, images, links, and source text do not trigger requests or enter the safe report', async () => {
  const html = profile({ extra: '<script src="https://private.example/PRIVATE_SCRIPT"></script><img src="https://private.example/PRIVATE_IMAGE"><p>PRIVATE_SOURCE_BODY</p><a href="https://private.example/PRIVATE_LINK">PRIVATE_SNIPPET</a>' });
  const { out, calls } = await run({ personData: { ...person(), also_known_as: [] }, html });
  assert.equal(calls.length, 3); assert.equal(out.outcome, 'confirmed-external-person-id');
  assert.doesNotMatch(json(out), /PRIVATE_SCRIPT|PRIVATE_IMAGE|PRIVATE_SOURCE_BODY|PRIVATE_LINK|PRIVATE_SNIPPET/);
});

test('unbound/foreign/ambiguous Person objects or conflicting canonical cannot confirm profile ownership', async () => {
  const variants = [
    profile().replace(`"url":"${KINO}"`, '"url":"https://unrelated.example/person"'),
    profile().replace(`,"url":"${KINO}"`, ''),
    profile().replace(`"url":"${KINO}"`, `"url":"${KINO}","@id":"https://unrelated.example/person"`),
    profile().replace('</head>', '<script type="application/ld+json">'+json({'@type':'Person',name:'Other person',url:KINO})+'</script></head>'),
    profile().replace(`rel="canonical" href="${KINO}"`, 'rel="canonical" href="https://kinobazaua.com/persons/authored-other"'),
  ];
  for (const html of variants) {
    const {out}=await run({personData:{...person(),also_known_as:[]},html});
    assert.equal(out.outcome,'unresolved-profile-evidence-needs-review');
    assert.deepEqual(out.counts,{tmdb:2,personPages:1,total:3});
  }
});

test('plain page-wide IMDb links are reported without becoming profile-owned evidence', async () => {
  const html=profile().replace(/<script[^>]*>[\s\S]*?<\/script>/,'')+'<a href="https://www.imdb.com/name/nm9999999/">IMDb</a>';
  const {out}=await run({personData:{...person(),also_known_as:[]},html});
  assert.equal(out.outcome,'unresolved-profile-evidence-needs-review');
  assert.equal(out.evidence.kinobaza.links[0].id,'nm9999999');
  assert.equal(out.evidence.kinobaza.links[0].association,'unestablished-profile-ownership');
});

test('wrong appended person ID or error object cannot be bypassed by an otherwise matching alias', async () => {
  for (const external_ids of [{id:PERSON+1,imdb_id:'nm9999999'},{success:false},{status_code:7},'invalid-object']) {
    const {out}=await run({personData:{...person(),external_ids}});
    assert.equal(out.outcome,'person-external-id-conflict-or-invalid');
    assert.deepEqual(out.counts,{tmdb:2,personPages:0,total:2});
  }
});

test('missing optional alias list does not prevent independent common-IMDb proof, and oversized names are not echoed', async () => {
  for (const also_known_as of [undefined,null]) {
    const {out}=await run({personData:{...person(),also_known_as}});
    assert.equal(out.outcome,'confirmed-external-person-id');assert.equal(out.counts.total,3);
  }
  const oversized=' '.repeat(501)+ALIAS;
  const {out}=await run({personData:{...person(),name:oversized,also_known_as:[]}});
  assert.notEqual(out.outcome,'confirmed-tmdb-person-alias');
  assert.equal(out.evidence.person.name,null);assert.deepEqual(out.evidence.person.matchingAliases,[]);
  assert.ok(!json(out).includes(oversized));
});
