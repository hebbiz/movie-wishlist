import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { discoverMedia } from '../netlify/lib/media-advice-service.mjs';
import { createKinobazaResolver, resolverQueries, resolverRefusalQuery } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { projectFilmIdentityContext } from '../shared/film-identity-context.mjs';
import { projectDirectorPeople } from '../shared/director-alias-crosswalk.mjs';
import { detailsData, providersData, motnData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';
const user = '00000000-0000-4000-8000-000000000001', group = '00000000-0000-4000-8000-000000000002', form = '10000000-0000-4000-8000-000000000001';
const input = { action: 'discover', groupId: group, formSession: form, listId: null, imdbId: `tt${IDS[0]}` };
const request = (data = input, extra = {}) => new Request('https://app.example/.netlify/functions/media-advice', { method: 'POST', headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json', ...extra }, body: JSON.stringify(data) });
test('HTTP boundary verifies Auth, backend capability/context each action and final revocation; no client claims trusted', async () => {
  let allow = true, validAuth = true, calls = [], started = false, runCalls = 0;
  const client = { auth: { getUser: async () => validAuth ? { data: { user: { id: user, user_metadata: { mykola_media_advice: true } } } } : { error: true } },
    rpc: async (_, args) => {
      calls.push(args);
      if (!allow) return { error: true };
      if (args.p_op === 'start') { if (started) return { error: true }; started = true; }
      return { data: { ...(args.p_op === 'capability' ? {} : { id: form }), mykola_media_advice: true, mykola_media_advice_diagnostics: false } };
    } };
  const handler = createMediaAdviceHandler({ client, env: () => '', run: async args => { runCalls++; await args.reserve('tmdb-find'); return { rows: [] }; } });
  assert.equal((await handler(request(input, { origin: 'https://foreign.example' }))).status, 403);
  validAuth = false; assert.equal((await handler(request())).status, 401); validAuth = true;
  allow = false; assert.equal((await handler(request({ ...input, mykola_media_advice: true, userId: user, role: 'owner', counters: { all: 0 } }))).status, 403);
  assert.equal(runCalls, 0); allow = true;
  assert.equal((await handler(request())).status, 200); assert.equal(runCalls, 1);
  assert.equal((await handler(request())).status, 403); assert.equal(runCalls, 1);
  assert.ok(calls.every(c => c.p_user === user && c.p_group === group && c.p_imdb === input.imdbId));
  started = false;
  const revoke = createMediaAdviceHandler({ client, env: () => '', run: async () => { allow = false; return { rows: [{ secret: 'must-not-return' }] }; } });
  const denied = await revoke(request()); assert.equal(denied.status, 403); assert.doesNotMatch(await denied.text(), /must-not-return/);
});
function sourceFixture(change = () => {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    calls.push(url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    let stage = url.includes('/find/') ? 'find' : url.includes('/watch/providers') ? 'providers' : url.includes('movieofthenight') ? 'motn' : 'details';
    const data = stage === 'find' ? { movie_results: [{ id: IDS[0], title: 'Authored film', original_title: 'Authored original' }] } : stage === 'details' ? detailsData(IDS[0]) : stage === 'providers' ? providersData(IDS[0]) : motnData(IDS[0]);
    const override = change(data, stage);
    return override ?? Response.json(data);
  } };
}
test('four bounded source requests; independent failures/gates, no key leakage or destinations', async () => {
  for (const fail of ['none', 'details', 'providers', 'motn', 'conflict']) {
    const mock = sourceFixture((data, phase) => {
      if (fail === phase) return new Response('', { status: 403 });
      if (fail === 'conflict' && phase === 'details') data.imdb_id = 'tt9999999';
    });
    const reserved = [];
    const result = await discoverMedia({ imdbId: input.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY', reserve: async stage => reserved.push(stage), fetchImpl: mock.fetchImpl });
    assert.equal(mock.calls.length, 4); assert.equal(reserved.length, 4); assert.equal(new Set(reserved).size, 4);
    assert.ok(mock.calls.every(u => /^https:\/\/(api.themoviedb.org|api.movieofthenight.com)\//.test(u)));
    assert.equal(result.stages, undefined); assert.doesNotMatch(JSON.stringify(result), /AUTHORED_(TMDB|MOTN)_KEY/);
    if (fail === 'providers') assert.ok(result.rows.some(r => r.provenance.source === 'Movie of the Night'));
    if (fail === 'details' || fail === 'conflict') assert.equal(result.sources.find(r => r.source === 'motn').status, 'identity-unresolved'); // independent attempted result, insufficient director evidence
    if (fail === 'conflict') assert.ok(!result.rows.some(r => r.id.startsWith('tmdb:')));
  }
});
test('no unverified IMDb→TMDb crosswalk means no MOTN; unreadable response is not absence', async () => {
  const mock = sourceFixture((data, phase) => phase === 'find' ? Response.json({ movie_results: [{ id: IDS[0] }, { id: IDS[1] }] }) : null);
  const result = await discoverMedia({ imdbId: input.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY', reserve: async () => {}, fetchImpl: mock.fetchImpl });
  assert.equal(mock.calls.length, 1); assert.equal(result.rows.length, 0);
  assert.match(result.sources.find(s => s.source === 'motn').status, /not-evaluated/);
});
test('unexpected source secret echo is withheld; bounded request rejects oversize and ignores client source data', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: user } } }) }, rpc: async () => ({ data: { id: form, attempts: [] } }) };
  for (const key of ['MOTN_API_KEY', 'TAVILY_API_KEY']) {
    const handler = createMediaAdviceHandler({ client, env: k => k === key ? 'AUTHORED_SECRET' : '', run: async () => ({ rows: [{ text: 'AUTHORED_SECRET' }] }) });
    const r = await handler(request()); assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /AUTHORED_SECRET/);
  }
  const handler = createMediaAdviceHandler({ client, env: () => '', run: async () => ({ rows: [] }) });
  assert.equal((await handler(request({ ...input, arbitrary: 'x'.repeat(5000) }))).status, 400);
});
test('unmapped Plex/MUBI literal claims retained read-only, no invented medium or track propagation', async () => {
  const mock = sourceFixture((data, stage) => {
    if (stage === 'providers') data.results.UA.rent = [{ provider_id: 999999, provider_name: 'Plex' }];
    if (stage === 'motn') data.streamingOptions.ua[0].service = { id: 'mubi', name: 'MUBI' };
  });
  const result = await discoverMedia({ imdbId: input.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY', reserve: async () => {}, fetchImpl: mock.fetchImpl });
  assert.ok(result.unmapped.find(r => r.name === 'Plex').observations.length);
  assert.ok(result.unmapped.find(r => r.name === 'MUBI').observations.length);
  assert.ok(result.unmapped.every(r => !r.provider?.medium));
});

test('only the durable start receipt selects source cap; browser cap and identity context are ignored', async () => {
  for (const cap of [8, 10, undefined]) {
    const operations = []; let runArgs;
    const client = { auth: { getUser: async () => ({ data: { user: { id: user, user_metadata: { sourceCap: 100 } } } }) },
      rpc: async (_, args) => { operations.push(args); return { data: { id: form, ...(cap === undefined ? {} : { cap }), attempts: [],
        mykola_media_advice: true, mykola_media_advice_diagnostics: true } }; } };
    const handler = createMediaAdviceHandler({ client, env: key => key === 'TMDB_READ_ACCESS_TOKEN' ? 'AUTHORED_SERVER_TMDB_KEY' : '',
      run: async args => { runArgs = args; return { rows: [] }; } });
    const response = await handler(request({ ...input, sourceCap: 100, cap: 100, counters: { remaining: 100 },
      identityContext: { tmdbId: 123, titleEvidence: [{ title: 'Browser invented alias' }] }, tmdbToken: 'BROWSER_FAKE_KEY' }));
    assert.equal(response.status, 200);
    assert.equal(runArgs.sourceCap, cap ?? 8);
    assert.equal(runArgs.tmdbToken, 'AUTHORED_SERVER_TMDB_KEY');
    assert.equal(runArgs.identityContext, undefined);
    assert.doesNotMatch(JSON.stringify(operations), /sourceCap|"cap"|counters|identityContext|Browser|FAKE_KEY/);
    assert.doesNotMatch(await response.text(), /AUTHORED_SERVER_TMDB_KEY|BROWSER_FAKE_KEY/);
    assert.deepEqual(operations.map(args => args.p_op), ['start', 'finish']);
  }
});

test('unsupported or malformed server source cap fails closed before source work and is finished once', async () => {
  for (const cap of [0, 9, 11, 100, '10', null]) {
    const operations = [];
    const client = { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: async (_, args) => { operations.push(args.p_op); return { data: { id: form, cap, mykola_media_advice: true } }; } };
    const response = await createMediaAdviceHandler({ client, env: () => '',
      run: async () => assert.fail('unknown ledger budget must dispatch no source') })(request({ ...input, sourceCap: 10 }));
    assert.equal(response.status, 403);
    assert.deepEqual(operations, ['start', 'finish']);
  }
});

test('matched server Details propagate contextual title/release metadata and source cap to the resolver without extra GETs', async () => {
  for (const sourceCap of [8, 10]) {
    const mock = sourceFixture((data, stage) => {
      if (stage !== 'details') return;
      data.translations.translations = [
        { iso_639_1: 'de', iso_3166_1: 'DE', data: { title: 'Authored German translation' } },
        { iso_3166_1: 'UA', data: { title: 'Country-only translation' } },
      ];
      data.release_dates.results = [{ iso_3166_1: 'CA', release_dates: [
        { release_date: '1999-09-09T00:00:00.000Z', type: 1, iso_639_1: 'de' },
        { release_date: '2001-04-31T00:00:00.000Z', type: 3, iso_639_1: '' },
      ] }];
    });
    const reserved = []; let observedFilm, observedOptions;
    const result = await discoverMedia({ imdbId: input.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY', sourceCap,
      reserve: async stage => reserved.push(stage), fetchImpl: mock.fetchImpl,
      resolver: async (film, options) => { observedFilm = structuredClone(film); observedOptions = options; return { status: 'not-evaluated-authored', result: null }; } });
    assert.equal(mock.calls.length, 4); assert.equal(reserved.length, 4);
    assert.equal(observedOptions.sourceCap, sourceCap); assert.equal(observedOptions.tmdbToken, 'AUTHORED_TMDB_KEY');
    assert.equal(result.metrics.requestBudget, sourceCap);
    assert.deepEqual(observedFilm.identityContext, { tmdbId: IDS[0], titleEvidence: [
      { title: 'Authored original', source: 'original' }, { title: 'Вигаданий фільм', source: 'requested' },
      { title: 'Authored German translation', source: 'translation', language: 'de', country: 'DE' },
      { title: 'Country-only translation', source: 'translation', country: 'UA' },
      { title: 'Авторський alias', source: 'alternative', country: 'UA' },
    ], releaseEvidence: [{ date: '1999-09-09T00:00:00.000Z', year: 1999, type: 1, country: 'CA', language: 'de' }] });
    assert.ok(observedFilm.titleAliases.includes('Authored German translation'));
    assert.ok(observedFilm.titleAliases.includes('Country-only translation'));
    assert.equal(observedFilm.year, 2001, 'release context must not replace the selected release year');
    assert.doesNotMatch(JSON.stringify(result), /AUTHORED_TMDB_KEY|AUTHORED_MOTN_KEY/);
  }
});

test('Details stable-ID conflict withholds context/resolver, and unsupported service caps dispatch no requests', async () => {
  const mock = sourceFixture((data, stage) => { if (stage === 'details') data.translations.id = IDS[1]; });
  const result = await discoverMedia({ imdbId: input.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY',
    reserve: async () => {}, fetchImpl: mock.fetchImpl, resolver: async () => assert.fail('unmatched parent metadata must not reach resolver') });
  assert.equal(result.film.identityContext, undefined);
  assert.equal(mock.calls.length, 4);
  for (const sourceCap of [0, 9, 11, '10', null]) await assert.rejects(discoverMedia({ imdbId: input.imdbId, sourceCap,
    fetchImpl: async () => assert.fail('invalid service cap cannot dispatch') }), /invalid-source-cap/);
});

test('actual handler/service/resolver preserves two searches/cards at cap8 and uses only the server-authorized cap10 pair for linked person proof', async () => {
  // Authored film/person/HTML only, not a source archive or availability proof.
  const first = 'https://kinobazaua.com/titles/authored-wrong';
  const second = 'https://kinobazaua.com/titles/authored-original-2001';
  const profileURL = 'https://kinobazaua.com/persons/authored-director';
  const tmdbPersonURL = 'https://api.themoviedb.org/3/person/999999?language=en-US&append_to_response=external_ids';
  const alias = 'Авторський режисер';
  const profile = `<!doctype html><html><head><link rel="canonical" href="${profileURL}"></head><body><div class="col-8"><h1 class="h2">${alias}</h1><h2 class="h3 text-muted">Authored director</h2><p>Дата народження: 20 травня 1967</p><p>Ролі: режисер</p></div><p>PRIVATE_UNRELATED_PROFILE_BODY</p></body></html>`;
  const keys = { TMDB_READ_ACCESS_TOKEN: 'AUTHORED_TMDB_KEY', MOTN_API_KEY: 'AUTHORED_MOTN_KEY', TAVILY_API_KEY: 'AUTHORED_TAVILY_KEY' };
  const projected = projectTmdbIdentityFor(detailsData(IDS[0]), { tmdbId: IDS[0], imdbId: input.imdbId });
  const queryFilm = { tmdbId: IDS[0], identityTitle: projected.metadata.requestedTitle.value, originalTitle: projected.metadata.originalTitle.value,
    year: 2001, directorCount: 1, directorPeople: projectDirectorPeople(projected.metadata.directors),
    identityContext: projectFilmIdentityContext(projected), titleAliases: [] };
  const baselineStages = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title'];
  const resolverStages = ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2'];
  for (const sourceCap of [8, 10]) for (const diagnostics of [false, true]) {
    const sent = [], reserved = [], operations = []; let searches = 0;
    const allowed = new Set([...baselineStages, ...resolverStages, ...(sourceCap === 10 ? ['tmdb-person', 'kinobaza-person'] : [])]);
    const client = { auth: { getUser: async () => ({ data: { user: { id: user } } }) }, rpc: async (name, args) => {
      assert.equal(name, 'media_advice_beta_action'); operations.push(args);
      assert.equal(args.p_user, user); assert.equal(args.p_group, group); assert.equal(args.p_imdb, input.imdbId);
      if (args.p_op === 'reserve') {
        assert.ok(allowed.has(args.p_stage)); assert.ok(!reserved.includes(args.p_stage));
        assert.ok(reserved.length < sourceCap, 'the mocked durable ledger never admits an extra attempt'); reserved.push(args.p_stage);
      }
      return { data: { id: form, cap: sourceCap, attempts: [...reserved], mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics } };
    } };
    const fetchImpl = async (url, init) => {
      sent.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      assert.ok(!/^https:\/\/kinobazaua\.com\/search/.test(url));
      if (url === 'https://api.tavily.com/search') {
        searches++; assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, `Bearer ${keys.TAVILY_API_KEY}`);
        assert.equal(JSON.parse(init.body).query, searches === 1 ? resolverQueries(queryFilm)[0] : resolverRefusalQuery(queryFilm));
        return Response.json({ results: [{ url: searches === 1 ? first : second, content: 'PRIVATE_SEARCH_SNIPPET' }] });
      }
      assert.equal(init.method, 'GET');
      if (url === first || url === second) {
        assert.equal(init.headers.Authorization, undefined);
        return new Response(markup({ url, ...(url === first ? { title: 'Wrong authored title' } : { director: `<a href="/persons/authored-director">${alias}</a>` }) }),
          { headers: { 'content-type': 'text/html' } });
      }
      if (url === tmdbPersonURL) {
        assert.equal(sourceCap, 10); assert.equal(init.headers.Authorization, `Bearer ${keys.TMDB_READ_ACCESS_TOKEN}`);
        return Response.json({ id: 999999, name: 'Authored director', also_known_as: [], birthday: '1967-05-20', imdb_id: 'nm9999999', external_ids: { imdb_id: 'nm9999999' }, biography: 'PRIVATE_PERSON_BIOGRAPHY' });
      }
      if (url === profileURL) {
        assert.equal(sourceCap, 10); assert.equal(new Headers(init.headers).has('authorization'), false); assert.equal(new Headers(init.headers).has('cookie'), false);
        return new Response(profile, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      assert.ok(['api.themoviedb.org', 'api.movieofthenight.com'].includes(new URL(url).hostname), 'no unknown profile or destination is fetched');
      return Response.json(url.includes('/find/') ? { movie_results: [{ id: IDS[0], title: 'Вигаданий фільм', original_title: 'Authored original' }] }
        : url.includes('/watch/providers') ? providersData(IDS[0]) : url.includes('movieofthenight') ? motnData(IDS[0]) : detailsData(IDS[0]));
    };
    const response = await createMediaAdviceHandler({ client, env: key => keys[key] ?? '', fetchImpl,
      resolver: createKinobazaResolver({ apiKey: keys.TAVILY_API_KEY }) })(request({ ...input, sourceCap: 100, cap: 100, diagnostics: true }));
    assert.equal(response.status, 200); const payload = await response.json();
    assert.equal(searches, 2); assert.equal(sent.length, sourceCap); assert.equal(reserved.length, sourceCap);
    assert.deepEqual(new Set(reserved), allowed); assert.deepEqual(reserved.slice(4, 8), resolverStages);
    assert.deepEqual(sent.filter(url => [first, second].includes(url)), [first, second]);
    assert.equal(sent.includes(profileURL), sourceCap === 10); assert.equal(sent.includes(tmdbPersonURL), sourceCap === 10);
    assert.equal(payload.result.rows.some(row => row.id.startsWith('kinobaza:')), sourceCap === 10);
    assert.ok(payload.result.rows.some(row => row.id.startsWith('tmdb:'))); assert.ok(payload.result.rows.some(row => row.id.startsWith('motn:')));
    if (diagnostics) {
      assert.equal(payload.result.metrics.requestBudget, sourceCap); assert.equal(payload.result.metrics.requestsMade, sourceCap); assert.equal(payload.result.metrics.ledgerReservations, sourceCap);
      assert.equal(payload.result.resolver.searchCalls, 2); assert.equal(payload.result.resolver.cardCalls, 2);
      assert.deepEqual(payload.result.resolver.cards.map(card => card.identity), ['mismatch', sourceCap === 10 ? 'matched' : 'unresolved']);
      assert.equal(payload.result.resolver.directorProfile.sourceAttempts, sourceCap === 10 ? 2 : 0);
      if (sourceCap === 10) {
        assert.deepEqual(reserved.slice(8), ['tmdb-person', 'kinobaza-person']);
        assert.equal(payload.result.resolver.directorProfile.reason, 'confirmed-person-profile-facts');
        assert.equal(payload.result.resolver.directorProfile.basis, 'exact-name-birthdate-role');
        assert.equal(payload.result.resolver.directorProfile.tmdbPersonCalls, 1); assert.equal(payload.result.resolver.directorProfile.kinobazaPersonCalls, 1);
      }
    } else assert.doesNotMatch(JSON.stringify(payload), /resolver|directorProfile|directorAliasEvidence|directorPeople|identityContext|1967-05-20|profileURL|sourceURL|sourceAttempts|provenance.*person/);
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|AUTHORED_TMDB_KEY|AUTHORED_MOTN_KEY|AUTHORED_TAVILY_KEY|1967-05-20/);
    assert.doesNotMatch(JSON.stringify(operations), /https?:|PRIVATE_|sourceURL|identityContext|sourceCap/);
    assert.equal(operations[0].p_op, 'start'); assert.equal(operations.at(-1).p_op, 'finish');
  }
});
