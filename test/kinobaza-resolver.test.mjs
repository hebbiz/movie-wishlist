import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver, resolverQueries, admittedCandidates, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { discoverMedia } from '../netlify/lib/media-advice-service.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { detailsData, providersData, motnData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { safeMediaReport } from '../assets/media-advice-report.mjs';
import { readFile } from 'node:fs/promises';
const film = { id: 'authored', tmdbId: IDS[0], imdbId: `tt${IDS[0]}`, title: 'Вигаданий фільм', identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001, titleAliases: ['Вигаданий фільм','Authored original'], directorCount: 1, directorAliases: ['Authored director'] };
const urls = ['https://kinobazaua.com/titles/authored-card', 'https://kinobazaua.com/titles/authored-second', 'https://kinobazaua.com/titles/unexamined'];
function mock({ emptyFirst = false, status, mismatch = false, sameConfirmed = false, unsupported = false } = {}) {
  let search = 0; const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    if (url === 'https://api.tavily.com/search') {
      search++; assert.equal(init.headers.Authorization, 'Bearer AUTHORED_TAVILY_KEY');
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), { query: resolverQueries(film)[emptyFirst && search > 1 ? 1 : 0],
        search_depth: 'basic', topic: 'general', max_results: 5, auto_parameters: false,
        include_answer: false, include_raw_content: false, include_images: false,
        include_favicon: false, include_usage: false, include_domains: ['kinobazaua.com'], include_domains_mode: 'restrict' });
      if (status) return new Response('', { status });
      return Response.json({ results: emptyFirst && search === 1 ? [] : urls.map(url => ({ url, title: 'Untrusted snippet is not evidence', content: 'NO IDENTITY PROOF', score: 1 })) });
    }
    assert.ok(urls.includes(url)); assert.equal(init.headers.Authorization, undefined); assert.equal(init.body, undefined);
    const second = url === urls[1];
    return new Response(markup({ url, title: mismatch || second && !sameConfirmed ? 'Wrong film' : undefined, ...(unsupported ? { blocks: '' } : {}) }), { headers: { 'content-type': 'text/html' } });
  };
  return { calls, fetchImpl };
}
const run = async (m, extra = {}) => {
  const reserved = [], calls = [];
  const out = await createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY', ...extra })(film, { reserve: async s => { assert.ok(!reserved.includes(s)); reserved.push(s); }, fetchImpl: m.fetchImpl, calls });
  return { out, reserved, calls };
};
test('strict exact URL admission, no slug inference, query/search/alternate host/encoding/ports refused', () => {
  const bad = ['http://kinobazaua.com/titles/x','https://www.kinobazaua.com/titles/x','https://kinobaza.com.ua/titles/x','https://kinobazaua.com:443/titles/x','https://a@kinobazaua.com/titles/x','https://kinobazaua.com/titles/x?y=z','https://kinobazaua.com/titles/x#z','https://kinobazaua.com/titles/x/photos','https://kinobazaua.com/titles/%2e%2e/x','https://kinobazaua.com/titles/x%2fy','https://evil.example/titles/x','/titles/x'];
  assert.deepEqual(admittedCandidates([...bad, urls[0], urls[0]].map(url => ({ url }))), [urls[0]]);
  assert.equal(resolverQueries(film).length, 2); assert.ok(resolverQueries(film).every(q => q.includes('site:kinobazaua.com/titles/')));
});
test('one query, at most two sequential distinct card GETs, withheld mismatch, bounded non-exhaustive', async () => {
  const m = mock(); const { out, reserved } = await run(m);
  assert.equal(m.calls.length, 3); assert.deepEqual(reserved, ['search-1','kinobaza-1','kinobaza-2']);
  assert.equal(out.result.identity.status, 'matched'); assert.equal(out.resolver.cards[1].identity, 'mismatch');
  assert.equal(out.resolver.unexamined, 1); assert.equal(out.status, 'one-confirmed-bounded-not-exhaustive');
  assert.ok(!m.calls.some(u => u.includes('apple') || u.includes('justwatch')));
});
test('empty admitted result permits one alternative; auth/rate/transport error never retry', async () => {
  const empty = mock({ emptyFirst: true }); const ok = await run(empty);
  assert.equal(ok.out.resolver.searchCalls, 2); assert.equal(empty.calls.length, 4);
  for (const status of [301,401,403,429,432,433,500,503]) {
    const m = mock({ status }); const { out } = await run(m); assert.equal(m.calls.length, 1); assert.equal(out.result, null);
  }
  let calls = 0;
  const failed = await run({ fetchImpl: async () => { calls++; throw Error('do not echo error'); } });
  assert.equal(calls, 1); assert.equal(failed.out.status, 'search-transport-or-json-error');
});
test('multiple confirmed cards are choices; unresolved/mismatch cannot become selected claims', async () => {
  const { out } = await run(mock({ sameConfirmed: true }));
  assert.equal(out.status, 'multiple-confirmed-cards-choose'); assert.equal(out.result, null); assert.equal(out.choices.length, 2);
  const mismatch = await run(mock({ mismatch: true })); assert.equal(mismatch.out.result, null); assert.equal(mismatch.out.choices.length, 0);
});
test('redirect/403/429/CAPTCHA/malformed HTML do not trigger retries/destination requests', async () => {
  for (const kind of ['redirect', '403', '429', 'captcha', 'malformed']) {
    const m = mock(); const original = m.fetchImpl;
    m.fetchImpl = async (url, init) => {
      if (url === 'https://api.tavily.com/search') return original(url, init);
      m.calls.push(url);
      return kind === 'redirect' ? new Response('', { status: 301, headers: { location: 'https://evil.example/' } }) : ['403','429'].includes(kind) ? new Response('', { status: Number(kind) }) : new Response(kind === 'captcha' ? 'captcha' : '<invalid', { headers: { 'content-type': 'text/html' } });
    };
    const { out } = await run(m); assert.equal(m.calls.length, 3); assert.equal(out.result, null); assert.equal(out.choices.length, 0);
  }
});
test('bounded Web Search invalid body/size and abort stop without retaining snippet/body', async () => {
  for (const response of [new Response('bad', { headers: { 'content-type':'application/json' } }), new Response('{}', { headers: { 'content-type':'application/json', 'content-length': String(600 * 1024) } }), Response.json({ results: [{ url: urls[0] }], content: 'AUTHORED_TAVILY_KEY' })]) {
    const out = await tavilySearch('AUTHORED_TAVILY_KEY', async () => response).search('authored');
    assert.notEqual(out.status, 'ok'); assert.deepEqual(out.urls, []);
  }
  const out = await tavilySearch('AUTHORED_TAVILY_KEY', async () => new Promise(() => {})).search('authored', { signal: AbortSignal.abort() });
  assert.equal(out.status, 'search-timeout-no-retry');
});
test('full action max8 attempts; baseline independence and candidate selection do not refetch', async () => {
  const m = mock({ emptyFirst: true, sameConfirmed: true }), reserved = [];
  const fetchImpl = async (url, init) => {
    if (url === 'https://api.tavily.com/search' || url.startsWith('https://kinobazaua.com/')) return m.fetchImpl(url, init);
    m.calls.push(url);
    return Response.json(url.includes('/find/') ? { movie_results: [{ id: IDS[0], title: 'Вигаданий фільм', original_title: 'Authored original' }] } : url.includes('/watch/providers') ? providersData(IDS[0]) : url.includes('movieofthenight') ? motnData(IDS[0]) : detailsData(IDS[0]));
  };
  const result = await discoverMedia({ imdbId: film.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY', reserve: async s => reserved.push(s), fetchImpl, resolver: createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' }) });
  assert.equal(reserved.length, 8); assert.equal(new Set(reserved).size, 8); assert.equal(m.calls.length, 8);
  assert.equal(result.metrics.requestsMade, 8); assert.equal(result.metrics.requestBudget, 8);
  assert.equal(result.cardChoices.length, 2); assert.ok(result.rows.every(r => !r.id.startsWith('kinobaza')));
  assert.ok(result.cardChoices.every(c => c.rows.every(r => r.id.startsWith(c.id + ':kinobaza:'))));
  assert.equal(result.stages, undefined); assert.doesNotMatch(JSON.stringify(result), /Untrusted snippet|NO IDENTITY PROOF|AUTHORED_TAVILY_KEY/);
});

test('deadline expires during durable reservation: no later search/card dispatch or retry', async () => {
  for (const stop of ['search-1', 'kinobaza-1']) {
    const controller = new AbortController(), reserved = [], calls = [], m = mock();
    await createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' })(film, { signal: controller.signal, calls,
      reserve: async stage => { reserved.push(stage); if (stage === stop) controller.abort(); }, fetchImpl: m.fetchImpl });
    assert.deepEqual(reserved, stop === 'search-1' ? ['search-1'] : ['search-1', 'kinobaza-1']);
    assert.equal(m.calls.length, stop === 'search-1' ? 0 : 1);
    assert.equal(calls.some(c => c.stage === stop), false);
  }
});

test('Tavily failure leaves independently gated baseline rows; denied reservation dispatches nothing', async () => {
  const reserved = [], m = mock({ status: 429 });
  const result = await discoverMedia({ imdbId: film.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY',
    resolver: createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' }), reserve: async s => reserved.push(s),
    fetchImpl: async (url, init) => {
      if (url === 'https://api.tavily.com/search') return m.fetchImpl(url, init);
      return Response.json(url.includes('/find/') ? { movie_results: [{ id: IDS[0], title: film.title, original_title: film.originalTitle }] }
        : url.includes('/watch/providers') ? providersData(IDS[0]) : url.includes('movieofthenight') ? motnData(IDS[0]) : detailsData(IDS[0]));
    } });
  assert.equal(reserved.length, 5); assert.equal(m.calls.length, 1);
  assert.equal(result.sources.find(s => s.source === 'kinobaza').status, 'search-rate-limit');
  assert.ok(result.rows.some(r => r.id.startsWith('tmdb:')));
  assert.ok(result.rows.some(r => r.id.startsWith('motn:')));
  const refused = await createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' })(film, {
    reserve: async () => { throw Error('budget-denied'); }, calls: [],
    fetchImpl: async () => assert.fail('denied budget cannot dispatch or fall back'),
  });
  assert.equal(refused.resolver.searchCalls, 0); assert.equal(refused.resolver.cardCalls, 0);
  assert.equal(refused.result, null);
});

test('Tavily response contract: empty differs from missing/malformed; only admitted exact URLs survive', async () => {
  for (const data of [null, [], {}, { results: null }, { results: {} }, { results: [null] },
    { results: [{ title: 'no URL' }] }, { results: [{ url: 42 }] },
    { results: Array.from({ length: 6 }, () => ({ url: urls[0] })) }]) {
    const out = await tavilySearch('AUTHORED_TAVILY_KEY', async () => Response.json(data)).search('authored');
    assert.deepEqual(out, { status: 'search-invalid-response', urls: [] });
  }
  const empty = await tavilySearch('AUTHORED_TAVILY_KEY', async () => Response.json({ results: [] })).search('authored');
  assert.deepEqual(empty, { status: 'ok', urls: [] });
  const out = await tavilySearch('AUTHORED_TAVILY_KEY', async () => Response.json({ results: [
    { url: urls[0], content: 'PRIVATE_SNIPPET', score: 1 }, { url: urls[0] },
    { url: 'https://foreign.example/titles/x' }, { url: 'javascript:alert(1)' },
    { url: urls[1] + '?tracking=PRIVATE' },
  ] })).search('authored');
  assert.deepEqual(out, { status: 'ok', urls: [urls[0]] });
  assert.doesNotMatch(JSON.stringify(out), /PRIVATE|score|content/);
});

test('search boundary is only exact Tavily POST; no alternate host/endpoint/query/redirect or secret in query', () => {
  const provider = tavilySearch('AUTHORED_TAVILY_KEY');
  const init = { method: 'POST', redirect: 'manual', credentials: 'omit' };
  assert.equal(provider.accepts('https://api.tavily.com/search', init), true);
  for (const url of ['http://api.tavily.com/search', 'https://api.tavily.com:443/search',
    'https://a@api.tavily.com/search', 'https://api.tavily.com/search?q=x',
    'https://api.tavily.com/search#x', 'https://api.tavily.com/extract',
    'https://api.tavily.com.evil.example/search', 'https://api.search.brave.com/res/v1/web/search']) {
    assert.equal(provider.accepts(url, init), false, url);
  }
  for (const change of [{ method: 'GET' }, { redirect: 'follow' }, { credentials: 'include' }])
    assert.equal(provider.accepts('https://api.tavily.com/search', { ...init, ...change }), false);
  assert.doesNotMatch(JSON.stringify(resolverQueries({ ...film, group: 'PRIVATE_GROUP', draft: 'PRIVATE_DRAFT',
    sourceResponse: 'PRIVATE_BODY', apiKey: 'AUTHORED_TAVILY_KEY' })), /PRIVATE|AUTHORED_TAVILY_KEY/);
});

test('empty twice exhausts alternatives; malformed response and missing key never cause fallback', async () => {
  const reserved = [], calls = [];
  const out = await createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' })(film, {
    reserve: async s => reserved.push(s), calls,
    fetchImpl: async url => { assert.equal(url, 'https://api.tavily.com/search'); return Response.json({ results: [] }); },
  });
  assert.equal(out.status, 'no-admitted-search-candidates');
  assert.deepEqual(reserved, ['search-1', 'search-2']); assert.equal(calls.length, 2);
  const invalid = await run({ fetchImpl: async url => { assert.equal(url, 'https://api.tavily.com/search'); return Response.json({ results: null }); } });
  assert.equal(invalid.out.status, 'search-invalid-response'); assert.equal(invalid.reserved.length, 1);
  const missing = await createKinobazaResolver()(film, { reserve: async () => assert.fail('no key: no reservation'),
    calls: [], fetchImpl: async () => assert.fail('no key: no fallback') });
  assert.equal(missing.status, 'not-evaluated-missing-search-key');
});

test('Tavily 15s header/body timeout spends one attempt, no retry/fallback and no error content', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const bodyWait of [false, true]) {
    let count = 0;
    const pending = run({ fetchImpl: async url => {
      count++; assert.equal(url, 'https://api.tavily.com/search');
      return bodyWait ? new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } }) : new Promise(() => {});
    } });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    t.mock.timers.tick(15_000);
    const result = await pending;
    assert.equal(result.out.status, 'search-timeout-no-retry');
    assert.equal(count, 1); assert.deepEqual(result.reserved, ['search-1']);
  }
});

test('Tavily rejects content type and streaming oversize; HTTP errors discard untrusted error bodies', async () => {
  const stream = () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array(512 * 1024 + 1)); c.close(); } });
  for (const response of [new Response('{}', { headers: { 'content-type': 'text/html' } }),
    new Response(stream(), { headers: { 'content-type': 'application/json' } })]) {
    const out = await tavilySearch('AUTHORED_TAVILY_KEY', async () => response).search('authored');
    assert.notEqual(out.status, 'ok'); assert.deepEqual(out.urls, []);
  }
  for (const [status, reason] of [[401,'search-auth-error'],[403,'search-access-denied'],[429,'search-rate-limit'],
    [432,'search-quota-error'],[433,'search-quota-error'],[500,'search-http-error'],[503,'search-http-error']]) {
    const out = await run({ fetchImpl: async url => {
      assert.equal(url, 'https://api.tavily.com/search'); return new Response('PRIVATE_ERROR AUTHORED_TAVILY_KEY', { status });
    } });
    assert.equal(out.out.status, reason); assert.deepEqual(out.reserved, ['search-1']);
    assert.doesNotMatch(JSON.stringify(out), /PRIVATE_ERROR|AUTHORED_TAVILY_KEY/);
  }
});

test('handler → projection → report/ledger: no search snippets, envelope, key, unexamined URL or logs', async t => {
  const logged = [];
  for (const method of ['log','info','warn','error','debug']) t.mock.method(console, method, (...args) => logged.push(args));
  const rpc = [], reservations = [], sent = [], m = mock({ emptyFirst: true, sameConfirmed: true });
  const fetchImpl = async (url, init) => {
    sent.push({ url, init });
    if (url === 'https://api.tavily.com/search') {
      const response = await m.fetchImpl(url, init), data = await response.json();
      return Response.json({ ...data, answer: 'PRIVATE_ANSWER', query: 'PRIVATE_ENVELOPE', request_id: 'PRIVATE_REQUEST',
        results: data.results.map(r => ({ ...r, content: 'PRIVATE_SNIPPET', raw_content: 'PRIVATE_RAW', title: 'PRIVATE_TITLE' })) });
    }
    if (url.startsWith('https://kinobazaua.com/')) return m.fetchImpl(url, init);
    return Response.json(url.includes('/find/') ? { movie_results: [{ id: IDS[0], title: film.title, original_title: film.originalTitle }] }
      : url.includes('/watch/providers') ? providersData(IDS[0]) : url.includes('movieofthenight') ? motnData(IDS[0]) : detailsData(IDS[0]));
  };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'AUTHORED_USER' } } }) },
    rpc: async (_, args) => {
      rpc.push(args);
      if (args.p_op === 'reserve') reservations.push(args.p_stage);
      return { data: { id: 'AUTHORED_SESSION', attempts: reservations } };
    } };
  const result = await createMediaAdviceHandler({ client, env: k => k === 'TAVILY_API_KEY' ? 'AUTHORED_TAVILY_KEY' : k === 'TMDB_READ_ACCESS_TOKEN' ? 'AUTHORED_TMDB_KEY' : k === 'MOTN_API_KEY' ? 'AUTHORED_MOTN_KEY' : '',
    resolver: createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' }), fetchImpl,
  })(new Request('https://app.example/.netlify/functions/media-advice', { method: 'POST',
    headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'discover', groupId: '00000000-0000-4000-8000-000000000001',
      formSession: '00000000-0000-4000-8000-000000000002', imdbId: film.imdbId }),
  }));
  assert.equal(result.status, 200); const payload = await result.json();
  assert.equal(sent.length, 8); assert.equal(reservations.length, 8);
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|AUTHORED_TAVILY_KEY|Untrusted snippet|NO IDENTITY PROOF|\/titles\/unexamined/);
  assert.ok(payload.result.cardChoices.every(c => urls.slice(0,2).includes(c.sourceURL))); // transient checked-card provenance, not a search archive
  assert.doesNotMatch(JSON.stringify(rpc), /https?:|PRIVATE_|AUTHORED_TAVILY_KEY|sourceURL|content/);
  assert.doesNotMatch(safeMediaReport(payload.result), /https?:|PRIVATE_|AUTHORED_TAVILY_KEY/);
  assert.deepEqual(logged, []);
  assert.ok(sent.filter(r => r.url !== 'https://api.tavily.com/search').every(r => !JSON.stringify(r.init.headers).includes('AUTHORED_TAVILY_KEY')));
  const handler = await readFile(new URL('../netlify/functions/media-advice.mjs', import.meta.url), 'utf8');
  assert.match(handler, /apiKey: env\('TAVILY_API_KEY'\)/);
  assert.doesNotMatch(handler, /BRAVE_SEARCH_API_KEY|GEMINI_API_KEY/);
});
