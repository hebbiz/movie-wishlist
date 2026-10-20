import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver, resolverQueries, admittedCandidates, braveWebSearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { discoverMedia } from '../netlify/lib/media-advice-service.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { detailsData, providersData, motnData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';
const film = { id: 'authored', tmdbId: IDS[0], imdbId: `tt${IDS[0]}`, title: 'Вигаданий фільм', identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001, titleAliases: ['Вигаданий фільм','Authored original'], directorCount: 1, directorAliases: ['Authored director'] };
const urls = ['https://kinobazaua.com/titles/authored-card', 'https://kinobazaua.com/titles/authored-second', 'https://kinobazaua.com/titles/unexamined'];
function mock({ emptyFirst = false, status, mismatch = false, sameConfirmed = false, unsupported = false } = {}) {
  let search = 0; const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    if (url.startsWith('https://api.search.brave.com/')) {
      search++; assert.equal(init.headers['X-Subscription-Token'], 'AUTHORED_BRAVE_KEY');
      if (status) return new Response('', { status });
      return Response.json({ web: { results: emptyFirst && search === 1 ? [] : urls.map(url => ({ url, title: 'Untrusted snippet is not evidence', description: 'NO IDENTITY PROOF' })) } });
    }
    assert.ok(urls.includes(url)); assert.equal(init.headers['X-Subscription-Token'], undefined);
    const second = url === urls[1];
    return new Response(markup({ url, title: mismatch || second && !sameConfirmed ? 'Wrong film' : undefined, ...(unsupported ? { blocks: '' } : {}) }), { headers: { 'content-type': 'text/html' } });
  };
  return { calls, fetchImpl };
}
const run = async (m, extra = {}) => {
  const reserved = [], calls = [];
  const out = await createKinobazaResolver({ apiKey: 'AUTHORED_BRAVE_KEY', ...extra })(film, { reserve: async s => { assert.ok(!reserved.includes(s)); reserved.push(s); }, fetchImpl: m.fetchImpl, calls });
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
  for (const status of [301,401,403,429,500]) {
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
      if (url.startsWith('https://api.search.brave.com/')) return original(url, init);
      m.calls.push(url);
      return kind === 'redirect' ? new Response('', { status: 301, headers: { location: 'https://evil.example/' } }) : ['403','429'].includes(kind) ? new Response('', { status: Number(kind) }) : new Response(kind === 'captcha' ? 'captcha' : '<invalid', { headers: { 'content-type': 'text/html' } });
    };
    const { out } = await run(m); assert.equal(m.calls.length, 3); assert.equal(out.result, null); assert.equal(out.choices.length, 0);
  }
});
test('bounded Web Search invalid body/size and abort stop without retaining snippet/body', async () => {
  for (const response of [new Response('bad', { headers: { 'content-type':'application/json' } }), new Response('{}', { headers: { 'content-type':'application/json', 'content-length': String(600 * 1024) } }), Response.json({ web: { results: [{ url: urls[0] }], description: 'AUTHORED_BRAVE_KEY' } })]) {
    const out = await braveWebSearch('AUTHORED_BRAVE_KEY', async () => response).search('authored');
    assert.notEqual(out.status, 'ok'); assert.deepEqual(out.urls, []);
  }
  const out = await braveWebSearch('AUTHORED_BRAVE_KEY', async () => new Promise(() => {})).search('authored', { signal: AbortSignal.abort() });
  assert.equal(out.status, 'search-timeout-no-retry');
});
test('full action max8 attempts; baseline independence and candidate selection do not refetch', async () => {
  const m = mock({ emptyFirst: true, sameConfirmed: true }), reserved = [];
  const fetchImpl = async (url, init) => {
    if (url.includes('search.brave') || url.startsWith('https://kinobazaua.com/')) return m.fetchImpl(url, init);
    m.calls.push(url);
    return Response.json(url.includes('/find/') ? { movie_results: [{ id: IDS[0], title: 'Вигаданий фільм', original_title: 'Authored original' }] } : url.includes('/watch/providers') ? providersData(IDS[0]) : url.includes('movieofthenight') ? motnData(IDS[0]) : detailsData(IDS[0]));
  };
  const result = await discoverMedia({ imdbId: film.imdbId, tmdbToken: 'AUTHORED_TMDB_KEY', motnKey: 'AUTHORED_MOTN_KEY', reserve: async s => reserved.push(s), fetchImpl, resolver: createKinobazaResolver({ apiKey: 'AUTHORED_BRAVE_KEY' }) });
  assert.equal(reserved.length, 8); assert.equal(new Set(reserved).size, 8); assert.equal(m.calls.length, 8);
  assert.equal(result.metrics.requestsMade, 8); assert.equal(result.metrics.requestBudget, 8);
  assert.equal(result.cardChoices.length, 2); assert.ok(result.rows.every(r => !r.id.startsWith('kinobaza')));
  assert.ok(result.cardChoices.every(c => c.rows.every(r => r.id.startsWith(c.id + ':kinobaza:'))));
  assert.equal(result.stages, undefined); assert.doesNotMatch(JSON.stringify(result), /Untrusted snippet|NO IDENTITY PROOF|AUTHORED_BRAVE_KEY/);
});
