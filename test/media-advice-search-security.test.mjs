import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { detailsData, providersData, motnData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';

// Authored transport/HTML only. This is not a historical source response or a
// claim that a live source has supplied these deliberately unrelated cards.
const user = '00000000-0000-4000-8000-000000000001';
const group = '00000000-0000-4000-8000-000000000002';
const form = '10000000-0000-4000-8000-000000000001';
const keys = {
  TMDB_READ_ACCESS_TOKEN: 'AUTHORED_SERVER_TMDB_KEY',
  MOTN_API_KEY: 'AUTHORED_SERVER_MOTN_KEY',
  TAVILY_API_KEY: 'AUTHORED_SERVER_TAVILY_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'AUTHORED_SERVER_SERVICE_KEY',
};
const wrongURLs = [
  'https://kinobazaua.com/titles/unrelated-authored-one',
  'https://kinobazaua.com/titles/unrelated-authored-two',
];
const requestIds = [
  'c2ea20c0-dba1-4ca2-b903-42d8863ac0a1',
  'c2ea20c0-dba1-4ca2-b903-42d8863ac0a2',
];
const baselineStages = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title'];
const resolverStages = ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2'];
const caps = diagnostics => ({ mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics });

async function discover({ start = true, finish = start, sourceCap = 8, finishAccess = true } = {}) {
  const operations = [], reservations = [], requests = [], searches = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: user,
      // The browser/Auth user metadata must never grant diagnostics.
      user_metadata: { mykola_media_advice_diagnostics: true } } } }) },
    rpc: async (name, args) => {
      assert.equal(name, 'media_advice_beta_global_action');
      assert.equal(args.p_user, user); assert.equal(Object.hasOwn(args, 'p_group'), false); assert.equal(Object.hasOwn(args, 'p_list'), false);
      assert.equal(args.p_imdb, `tt${IDS[0]}`); operations.push(args);
      if (args.p_op === 'reserve') {
        assert.ok([...baselineStages, ...resolverStages].includes(args.p_stage));
        assert.ok(!reservations.includes(args.p_stage), 'no reservation retry');
        assert.ok(reservations.length < sourceCap, 'no attempt beyond the server receipt cap');
        reservations.push(args.p_stage);
      }
      const diagnosticPermission = args.p_op === 'finish' ? finish : start;
      return { data: { id: form, cap: sourceCap, attempts: [...reservations], ...caps(diagnosticPermission),
        ...(args.p_op === 'finish' ? { mykola_media_advice: finishAccess } : {}) } };
    },
  };
  const fetchImpl = async (url, init) => {
    requests.push(url);
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    assert.ok(!/^https:\/\/kinobazaua\.com\/search(?:[/?]|$)/.test(url));
    if (url === 'https://api.tavily.com/search') {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, `Bearer ${keys.TAVILY_API_KEY}`);
      const sent = JSON.parse(init.body); searches.push(sent);
      // Tavily may return a simplified query. These strings are correlation
      // evidence, not an identity check or a new reason to stop the resolver.
      return Response.json({ query: 'Authored original 2001', request_id: requestIds[searches.length - 1],
        results: wrongURLs.map(url => ({ url, title: 'PRIVATE_SEARCH_TITLE', content: 'PRIVATE_SEARCH_SNIPPET', score: 1 })),
        answer: 'PRIVATE_GENERATED_ANSWER', raw_response: 'PRIVATE_RAW_RESPONSE' });
    }
    assert.equal(init.method, 'GET');
    if (wrongURLs.includes(url)) {
      assert.equal(init.headers.Authorization, undefined);
      const index = wrongURLs.indexOf(url) + 1;
      return new Response(markup({ url, title: `Wrong authored film ${index}`, original: `Wrong original ${index}` }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    assert.ok(['api.themoviedb.org', 'api.movieofthenight.com'].includes(new URL(url).hostname),
      'no platform, unapproved host or person profile is fetched');
    return Response.json(url.includes('/find/') ? { movie_results: [{ id: IDS[0], title: 'Вигаданий фільм', original_title: 'Authored original' }] }
      : url.includes('/watch/providers') ? providersData(IDS[0])
        : url.includes('movieofthenight') ? motnData(IDS[0]) : detailsData(IDS[0]));
  };
  const handler = createMediaAdviceHandler({ client, env: key => keys[key] ?? '', fetchImpl,
    resolver: createKinobazaResolver({ apiKey: keys.TAVILY_API_KEY }) });
  const response = await handler(new Request('https://app.example/.netlify/functions/media-advice', { method: 'POST',
    headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'discover', groupId: group, formSession: form, imdbId: `tt${IDS[0]}`,
      // Every request attempts to forge these. Only the server RPC can permit
      // capture, and only the final server RPC can permit returning diagnostics.
      diagnostics: true, mykola_media_advice_diagnostics: true,
      query: 'PRIVATE_BROWSER_QUERY', request_id: 'PRIVATE_BROWSER_REQUEST_ID',
      possibleIrrelevantSearch: { cards: [{ title: 'PRIVATE_BROWSER_CARD' }] }, sourceCap: 100 }) }));
  return { response, payload: await response.json(), operations, reservations, requests, searches };
}

function assertBounded(result, sourceCap) {
  assert.equal(result.searches.length, 2);
  assert.equal(result.requests.length, 8, 'diagnostic capture dispatches no additional requests');
  assert.ok(result.requests.length <= sourceCap);
  assert.deepEqual(result.reservations.slice(4), resolverStages);
  assert.deepEqual(new Set(result.reservations), new Set([...baselineStages, ...resolverStages]));
  assert.deepEqual(result.requests.filter(url => wrongURLs.includes(url)), wrongURLs);
  assert.equal(result.operations[0].p_op, 'start');
  assert.equal(result.operations.at(-1).p_op, 'finish');
  assert.doesNotMatch(JSON.stringify(result.operations), /https?:|query|request_id|possibleIrrelevantSearch|diagnostics|PRIVATE_/,
    'diagnostic details are never written to the durable ledger');
  assert.doesNotMatch(JSON.stringify(result.payload), /PRIVATE_|AUTHORED_SERVER_(TMDB|MOTN|TAVILY|SERVICE)_KEY/);
}

test('real server chain correlates unrelated read cards only under server diagnostics permission without spending extra attempts', async () => {
  for (const sourceCap of [8, 10]) {
    const result = await discover({ sourceCap });
    assert.equal(result.response.status, 200); assertBounded(result, sourceCap);
    const value = result.payload.result;
    assert.deepEqual(value.capabilities, caps(true));
    assert.equal(value.metrics.requestsMade, 8); assert.equal(value.metrics.ledgerReservations, 8);
    assert.equal(value.metrics.requestBudget, sourceCap);
    assert.equal(value.resolver.searchCalls, 2); assert.equal(value.resolver.cardCalls, 2);
    assert.deepEqual(value.resolver.cards.map(card => card.identity), ['mismatch', 'mismatch']);
    const possible = value.resolver.possibleIrrelevantSearch;
    assert.ok(possible, 'parsed unrelated titles with no confirmed card enable a possible-relevance diagnostic');
    assert.deepEqual(possible.film, { title: 'Вигаданий фільм', year: 2001, imdbId: `tt${IDS[0]}` });
    assert.equal(possible.searches.length, 2);
    for (let index = 0; index < 2; index++) {
      assert.equal(possible.searches[index].query, result.searches[index].query,
        'correlation records the actual request payload, not browser or response text');
      assert.equal(possible.searches[index].requestId, requestIds[index]);
      assert.equal(possible.searches[index].responseQuery, 'Authored original 2001');
      assert.notEqual(possible.searches[index].query, possible.searches[index].responseQuery,
        'a simplified response query is recorded, not rejected as an API failure');
      assert.equal(possible.cards[index].url, wrongURLs[index]);
      assert.match(possible.cards[index].title, new RegExp(`Wrong authored film ${index + 1}`));
      assert.equal(possible.cards[index].originalTitle, `Wrong original ${index + 1}`);
      assert.equal(possible.cards[index].reason, 'source-title-conflict');
      assert.equal(possible.cards[index].identity, 'mismatch');
      assert.equal(possible.cards[index].titleMismatch, true);
    }
    assert.ok(value.rows.some(row => row.id.startsWith('tmdb:')));
    assert.ok(value.rows.some(row => row.id.startsWith('motn:')));
    assert.ok(value.rows.every(row => !row.id.startsWith('kinobaza:')), 'unrelated source data remain withheld');
  }
});

test('ordinary Beta and diagnostic revocation withhold the new report despite forged browser flags while retaining product rows', async () => {
  const authorized = await discover();
  const expectedRows = productMediaResult(authorized.payload.result, caps(false)).rows;
  for (const permissions of [{ start: false, finish: false }, { start: true, finish: false }]) {
    const result = await discover(permissions);
    assert.equal(result.response.status, 200); assertBounded(result, 8);
    assert.deepEqual(result.payload.result.capabilities, caps(false));
    assert.deepEqual(result.payload.result.rows, expectedRows);
    assert.doesNotMatch(JSON.stringify(result.payload), /possibleIrrelevantSearch|responseQuery|requestId|Wrong authored|Wrong original|unrelated-authored|c2ea20c0|site:kinobazaua/);
    assert.equal(result.payload.result.resolver, undefined);
  }
});

test('late diagnostics permission cannot retroactively capture correlation from an ordinary Beta search', async () => {
  const result = await discover({ start: false, finish: true });
  assert.equal(result.response.status, 200); assertBounded(result, 8);
  assert.deepEqual(result.payload.result.capabilities, caps(true));
  assert.equal(result.payload.result.resolver?.possibleIrrelevantSearch, undefined);
  assert.doesNotMatch(JSON.stringify(result.payload), /responseQuery|requestId|Wrong authored|Wrong original|unrelated-authored|c2ea20c0|site:kinobazaua/);
  assert.ok(result.payload.result.rows.some(row => row.id.startsWith('tmdb:')));
  assert.ok(result.payload.result.rows.some(row => row.id.startsWith('motn:')));
});

test('final Beta access revocation suppresses all products and possible-search details', async () => {
  const result = await discover({ finishAccess: false });
  assert.equal(result.response.status, 403); assertBounded(result, 8);
  assert.doesNotMatch(JSON.stringify(result.payload), /rows|possibleIrrelevantSearch|requestId|Wrong authored|unrelated-authored|c2ea20c0/);
});
