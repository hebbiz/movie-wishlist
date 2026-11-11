// Authored film/person records and transports only. These are not captured
// source pages, real person evidence, availability claims or live requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { selectDirectorCandidates } from '../netlify/lib/director-candidate-selection.mjs';
import { safeMediaReport } from '../src/media-advice/media-advice-report.mjs';
import { markup } from './assisted-kinobaza.fixture.mjs';

const SEARCH = 'https://api.tavily.com/search';
const PERSON = 999999;
const TMDB_PERSON = `https://api.themoviedb.org/3/person/${PERSON}?language=en-US&append_to_response=external_ids`;
const TMDB_KEY = 'AUTHORED_PRIVATE_PERSON_KEY';
const SEARCH_KEY = 'AUTHORED_PRIVATE_SEARCH_KEY';
const ALIAS = 'Авторський режисер';
const LATIN = 'Authored Director';
const URLS = ['https://kinobazaua.com/titles/authored-first', 'https://kinobazaua.com/titles/authored-second'];
const PROFILES = ['https://kinobazaua.com/persons/authored-first-person', 'https://kinobazaua.com/persons/authored-second-person'];
const FILM = { id: 'authored-director-allocation', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2008,
  titleAliases: ['Вигаданий фільм', 'Authored original'], directorCount: 1,
  directorAliases: [LATIN], directorPeople: [{ namespace: 'tmdb:person', personId: PERSON, names: [LATIN] }],
  identityContext: { tmdbId: 999900001, titleEvidence: [{ source: 'original', title: 'Authored original' }],
    releaseEvidence: [{ date: '2006-09-09T00:00:00.000Z', year: 2006, type: 1, country: 'CA', language: 'en' }] } };
const personData = { id: PERSON, name: LATIN, also_known_as: [], birthday: '1967-05-20', imdb_id: 'nm9999991', external_ids: { imdb_id: 'nm9999991' } };
const linked = profile => `<a href="${profile}">${ALIAS}</a>`;
const sharedId = `<tr><td>IMDb:</td><td>${FILM.imdbId}</td></tr>`;
const conflictingId = '<tr><td>IMDb:</td><td>tt999900002</td></tr>';
const personPage = (url, { birthday = '20 травня 1967' } = {}) => `<!doctype html><html><head><link rel="canonical" href="${url}"></head><body><div class="col-8"><h1 class="h2">${ALIAS}</h1><h2 class="h3 text-muted">${LATIN}</h2><p>Дата народження: ${birthday}</p><p>Ролі: режисер</p></div></body></html>`;

async function run({ cards = [{}, {}], profiles = {}, sourceCap = 10, signal } = {}) {
  const reserved = [], requests = [];
  // The four independent baseline stages already spent their attempts. This
  // resolver still has both search/card slots and exactly one person pair.
  const calls = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn'].map(stage => ({ stage, status: 'response-received' }));
  const out = await createKinobazaResolver({ apiKey: SEARCH_KEY })(FILM, {
    sourceCap, tmdbToken: TMDB_KEY, calls, signal,
    reserve: async stage => { assert.ok(!reserved.includes(stage)); reserved.push(stage); },
    fetchImpl: async (url, init) => {
      assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      requests.push(url);
      if (url === SEARCH) {
        assert.equal(init.method, 'POST'); assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${SEARCH_KEY}`);
        assert.equal(reserved.at(-1), `search-${requests.filter(u => u === SEARCH).length}`);
        return Response.json({ results: URLS.map(url => ({ url, content: 'PRIVATE_UNTRUSTED_SNIPPET', score: 1 })) });
      }
      if (url === TMDB_PERSON) {
        assert.equal(reserved.at(-1), 'tmdb-person'); assert.equal(init.method, 'GET');
        assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${TMDB_KEY}`);
        return Response.json(personData);
      }
      assert.equal(new Headers(init.headers).has('authorization'), false);
      assert.equal(new Headers(init.headers).has('cookie'), false);
      if (PROFILES.includes(url)) {
        assert.equal(reserved.at(-1), 'kinobaza-person');
        assert.ok(Object.hasOwn(profiles, url), 'only the explicitly selected authored profile may be read');
        return new Response(personPage(url, profiles[url]), { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      assert.ok(URLS.includes(url), 'no source /search, generated pointer, redirect or destination call');
      const index = URLS.indexOf(url), config = cards[index];
      assert.equal(reserved.at(-1), `kinobaza-${index + 1}`);
      return new Response(markup({ url, year: FILM.year, director: linked(config.profile ?? PROFILES[index]), ...config }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  assert.ok(calls.length <= sourceCap, 'the trusted cap includes all baseline and resolver attempts');
  assert.ok(out.resolver.searchCalls <= 2); assert.equal(out.resolver.cardCalls, 2);
  assert.deepEqual(requests.filter(url => URLS.includes(url)), URLS, 'each of the two selected cards is fetched exactly once');
  assert.ok(requests.every(url => !url.startsWith('https://kinobazaua.com/search')));
  assert.doesNotMatch(JSON.stringify({ resolver: out.resolver, calls }), /AUTHORED_PRIVATE|PRIVATE_UNTRUSTED_SNIPPET|<html|1967|nm9999991|sourceAlias|also_known_as/);
  assert.doesNotMatch(safeMediaReport({ resolver: out.resolver }), /https?:|AUTHORED_PRIVATE|PRIVATE_UNTRUSTED_SNIPPET/);
  return { out, reserved, requests, calls };
}

const profileRequests = result => result.requests.filter(url => url === TMDB_PERSON || PROFILES.includes(url));
const assertDeferred = result => assert.ok(result.requests.indexOf(TMDB_PERSON) > result.requests.indexOf(URLS[1]),
  'read and gate both bounded cards before allocating the sole person pair');

test('a first release-year candidate cannot consume the pair before a stronger second exact-year candidate is read', async () => {
  const result = await run({ cards: [{ year: 2006 }, {}], profiles: { [PROFILES[1]]: {} } });
  assertDeferred(result);
  assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[1]]);
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2', 'tmdb-person', 'kinobaza-person']);
  assert.equal(result.calls.length, 10); assert.equal(result.out.resolver.searchCalls, 2);
  assert.equal(result.out.result.sourceURL, URLS[1]); assert.equal(result.out.result.identity.status, 'matched');
  assert.ok(result.out.result.candidates.length > 0);
  assert.equal(result.out.resolver.cards[0].identity, 'unresolved');
  assert.equal(result.out.resolver.cards[0].reason, 'director-alias-unestablished');
  assert.equal(result.out.resolver.cards[0].candidates, 0);
  assert.equal(result.out.resolver.cards[1].identity, 'matched');
});

test('equally strong cards with different linked people remain ambiguous without spending a speculative person pair', async () => {
  const result = await run();
  assert.deepEqual(profileRequests(result), []); assert.equal(result.calls.length, 8);
  assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.equal(result.out.resolver.directorProfile.reason, 'director-profile-candidates-ambiguous');
  assert.equal(result.out.resolver.directorProfile.sourceAttempts, 0);
  assert.ok(result.out.resolver.cards.every(card => card.identity === 'unresolved' && card.candidates === 0));
});

test('a stronger selected candidate with conflicting profile facts cannot trigger another pair for a weaker card', async () => {
  const result = await run({ cards: [{}, { year: 2006 }], profiles: { [PROFILES[0]]: { birthday: '26 травня 1967' } } });
  assertDeferred(result); assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[0]]);
  assert.equal(result.calls.length, 10); assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.equal(result.out.resolver.directorProfile.reason, 'director-person-birthday-conflict');
  assert.ok(result.out.resolver.cards.every(card => card.identity === 'unresolved' && card.candidates === 0));
});

test('cards linked to the same person and exact normalized alias share proof without collapsing multiple confirmed cards', async () => {
  const result = await run({ cards: [{}, { profile: PROFILES[0] }], profiles: { [PROFILES[0]]: {} } });
  assertDeferred(result); assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[0]]);
  assert.equal(result.calls.length, 10); assert.equal(result.out.status, 'multiple-confirmed-cards-choose');
  assert.equal(result.out.result, null); assert.deepEqual(result.out.choices.map(card => card.sourceURL), URLS);
  assert.ok(result.out.choices.every(card => card.identity.status === 'matched' && card.candidates.length > 0));
});

test('an already matched first card does not hide a sole eligible linked-director second card', async () => {
  const result = await run({ cards: [{ director: LATIN }, {}], profiles: { [PROFILES[1]]: {} } });
  assertDeferred(result); assert.equal(result.out.resolver.searchCalls, 1);
  assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[1]]); assert.equal(result.calls.length, 9);
  assert.equal(result.out.status, 'multiple-confirmed-cards-choose'); assert.equal(result.out.choices.length, 2);
});

test('a scoped shared film ID outranks a no-ID card while still requiring person proof for a different year', async () => {
  const result = await run({ cards: [{}, { year: 2006, stable: sharedId }], profiles: { [PROFILES[1]]: {} } });
  assertDeferred(result); assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[1]]);
  assert.equal(result.out.result.sourceURL, URLS[1]); assert.equal(result.out.result.identity.status, 'matched');
  assert.equal(result.out.resolver.cards[1].diagnostics.comparisons.stableIdMatch, true);
  assert.deepEqual(result.out.resolver.cards[1].diagnostics.years, { selected: 2008, source: 2006, delta: -2 });
});

test('stable-ID or title conflicts never become person candidates or leak withheld film claims', async () => {
  const result = await run({ cards: [{ stable: conflictingId }, { title: 'A different authored film', original: 'A different authored original' }] });
  assert.deepEqual(profileRequests(result), []); assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.deepEqual(result.out.resolver.cards.map(card => card.reason), ['source-stable-id-conflict', 'source-title-conflict']);
  assert.ok(result.out.resolver.cards.every(card => card.identity === 'mismatch' && card.candidates === 0));
});

test('legacy cap8 still reserves both search/card slots but cannot acquire the optional person pair', async () => {
  const result = await run({ sourceCap: 8, cards: [{ year: 2006 }, {}] });
  assert.equal(result.calls.length, 8); assert.deepEqual(profileRequests(result), []);
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2']);
  assert.equal(result.out.result, null); assert.ok(result.out.resolver.cards.every(card => card.identity === 'unresolved' && card.candidates === 0));
});

test('an exact-original selected-year unknown translation can use the existing deferred cap10 person pair', async () => {
  const result = await run({ cards: [{ title: 'Невідомий переклад назви' }, { stable: conflictingId }], profiles: { [PROFILES[0]]: {} } });
  assertDeferred(result);assert.equal(result.calls.length,10);
  assert.deepEqual(profileRequests(result),[TMDB_PERSON,PROFILES[0]]);
  assert.equal(result.out.result.sourceURL,URLS[0]);assert.equal(result.out.result.identity.status,'matched');
  assert.equal(result.out.result.identity.diagnostics.strategy,'original-year-director-translation');
  assert.equal(result.out.result.identity.diagnostics.comparisons.headingAliasMatch,false);
  assert.equal(result.out.result.identity.diagnostics.comparisons.originalAliasMatch,true);
  assert.equal(result.out.resolver.cards[1].reason,'source-stable-id-conflict');
});

test('unknown translation stays unconfirmed under cap8 or conflicting linked-person facts',async()=>{
  for(const [sourceCap,profiles] of [[8,{}],[10,{[PROFILES[0]]:{birthday:'26 травня 1967'}}]]){
    const result=await run({sourceCap,cards:[{title:'Невідомий переклад назви'},{stable:conflictingId}],profiles});
    assert.equal(result.out.result,null);assert.deepEqual(result.out.choices,[]);
    assert.equal(result.out.resolver.cards[0].identity,'unresolved');
    assert.equal(result.out.resolver.cards[0].reason,'director-alias-unestablished');
    assert.equal(result.calls.length,sourceCap);
  }
});

test('equally supported unknown translations linked to different people remain ambiguous without a speculative pair',async()=>{
  const result=await run({cards:[{title:'Невідомий переклад один'},{title:'Невідомий переклад два'}]});
  assert.deepEqual(profileRequests(result),[]);assert.equal(result.calls.length,8);
  assert.equal(result.out.result,null);assert.equal(result.out.resolver.directorProfile.reason,'director-profile-candidates-ambiguous');
});

test('a matching scoped film ID does not bypass person proof for an unknown translation',async()=>{
  const result=await run({cards:[{title:'Невідомий переклад назви',stable:sharedId},{stable:conflictingId}],profiles:{[PROFILES[0]]:{birthday:'26 травня 1967'}}});
  assertDeferred(result);assert.equal(result.calls.length,10);
  assert.deepEqual(profileRequests(result),[TMDB_PERSON,PROFILES[0]]);
  assert.equal(result.out.result,null);assert.deepEqual(result.out.choices,[]);
  assert.equal(result.out.resolver.cards[0].identity,'unresolved');
  assert.equal(result.out.resolver.cards[0].diagnostics.comparisons.stableIdMatch,true);
  assert.equal(result.out.resolver.directorProfile.reason,'director-person-birthday-conflict');
});

function translationCandidate({comparisons={},gates={},strategy='original-year-director-translation'}={}){
  return {index:0,pointer:{sourceURL:PROFILES[0],sourceAlias:ALIAS},identity:{status:'unresolved',reason:'director-alias-unestablished',diagnostics:{strategy,
    comparisons:{stableIdConflict:false,canonicalMatch:true,headingAliasMatch:false,originalAliasMatch:true,yearEqual:true,stableIdMatch:false,...comparisons},
    gates:{...Object.fromEntries(['structure-limit','canonical-conflict','stable-id-conflict','stable-id-shape','canonical-count','metadata-structure','heading-format',
      'original-scope','original-alias','selected-year','year-crosswalk','director-presence','director-scope'].map(gate=>[gate,'pass'])),'heading-alias':'not-evaluated','director-alias':'unresolved',...gates}}}};
}
test('only the explicit fully gated exact-original selected-year route may allocate a profile pair',()=>{
  const candidate=translationCandidate(),selected=selectDirectorCandidates([candidate]);
  assert.deepEqual(selected.selected,[candidate]);assert.equal(selected.diagnostic.basis,'selected-year');
  for(const overrides of [
    {strategy:null},{strategy:'title-year-director'},
    {comparisons:{yearEqual:false}},{comparisons:{yearEqual:null}},
    {comparisons:{originalAliasMatch:false}},{comparisons:{originalAliasMatch:null}},
    {comparisons:{headingAliasMatch:true}},{comparisons:{stableIdConflict:true}},
    {comparisons:{canonicalMatch:false}},
    ...['structure-limit','canonical-conflict','stable-id-conflict','stable-id-shape','canonical-count','metadata-structure','heading-format',
      'original-scope','original-alias','selected-year','year-crosswalk','director-presence','director-scope'].map(gate=>({gates:{[gate]:'fail'}})),
    {gates:{'heading-alias':'pass'}},{gates:{'heading-alias':'fail'}},
  ])assert.deepEqual(selectDirectorCandidates([translationCandidate(overrides)]).selected,[],JSON.stringify(overrides));
});

test('alternate-search auth failure or timeout retains an eligible first card and its bounded person proof without retries', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  for (const timeout of [false,true]) {
    const requests = [], reserved = [], calls = Array.from({length:4},(_,i)=>({stage:`baseline-${i}`}));
    let searches = 0, stalled;
    const ready = new Promise(resolve=>{stalled=resolve;});
    const pending = createKinobazaResolver({apiKey:SEARCH_KEY})(FILM,{
      sourceCap:10,tmdbToken:TMDB_KEY,calls,reserve:async stage=>reserved.push(stage),fetchImpl:async(url,init)=>{
        requests.push(url);
        if (url===SEARCH) {
          if (++searches===1) return Response.json({results:[{url:URLS[0]}]});
          if (timeout) {stalled();return new Promise(()=>{});}
          return new Response('PRIVATE_AUTH_ERROR',{status:401});
        }
        if (url===TMDB_PERSON) return Response.json(personData);
        if (url===PROFILES[0]) return new Response(personPage(url),{headers:{'content-type':'text/html'}});
        assert.equal(url,URLS[0]);assert.equal(init.redirect,'manual');
        return new Response(markup({url,year:FILM.year,director:linked(PROFILES[0])}),{headers:{'content-type':'text/html'}});
      },
    });
    if(timeout){await ready;t.mock.timers.tick(15_000);}
    const out = await pending;
    assert.equal(out.status,'partial');assert.equal(out.result.sourceURL,URLS[0]);assert.equal(out.result.identity.status,'matched');
    assert.equal(out.resolver.searches[1].status,timeout?'search-timeout-no-retry':'search-auth-error');
    assert.equal(out.resolver.searchCalls,2);assert.equal(out.resolver.cardCalls,1);
    assert.deepEqual(reserved,['search-1','kinobaza-1','search-2','tmdb-person','kinobaza-person']);
    assert.equal(calls.length,9);assert.deepEqual(requests,[SEARCH,URLS[0],SEARCH,TMDB_PERSON,PROFILES[0]]);
    assert.doesNotMatch(safeMediaReport({resolver:out.resolver}),/PRIVATE|https?:|1967/);
  }
});
