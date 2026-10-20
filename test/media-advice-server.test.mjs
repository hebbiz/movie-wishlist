import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { discoverMedia } from '../netlify/lib/media-advice-service.mjs';
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
      return { data: args.p_op === 'capability' ? { mykola_media_advice: true } : { id: form } };
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
  const handler = createMediaAdviceHandler({ client, env: k => k === 'MOTN_API_KEY' ? 'AUTHORED_SECRET' : '', run: async () => ({ rows: [{ text: 'AUTHORED_SECRET' }] }) });
  const r = await handler(request()); assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /AUTHORED_SECRET/);
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
