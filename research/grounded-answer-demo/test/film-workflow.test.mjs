import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createFilmWorkflows, projectFilmSearch, detailsURL } from '../film-workflow.mjs';
import { createDemo } from '../server.mjs';
import { buildShortReport, buildWorkflowReport } from '../public/discovery-report.mjs';
import { prepareDraft } from '../public/discovery-client.mjs';
import { IDS, mockTransport, searchData } from './film-workflow.fixture.mjs';
function harness(options = {}, network = {}) {
  const transport = mockTransport(network), flows = createFilmWorkflows({ mode: 'live', tmdbToken: 'author-tmdb-key', motnKey: 'author-motn-key', fetchImpl: transport.fetchImpl, ...options });
  let workflow = flows.issue();
  const act = async (name, body = {}) => { const r = await flows.execute(workflow.id, name, workflow.actionToken, body); if (r.payload.workflow) workflow = r.payload.workflow; return r; };
  const select = async () => { const a = await act('search', { query: 'Authored only' }); const b = await act('preview', { candidate: a.payload.candidates[0].ref }); await act('confirm', { preview: b.payload.preview.ref }); return b.payload.preview; };
  return { ...transport, flows, act, select, state: () => workflow };
}
test('explicit search -> preview -> confirm -> independent discovery: four GETs, reuse Details, own literal properties and zero destinations', async () => {
  const h = harness(); const preview = await h.select(); assert.equal(h.calls.length, 2);
  assert.equal(preview.film.imdbId, `tt${IDS[0]}`); const r = await h.act('discover');
  assert.equal(r.status, 200); assert.deepEqual(r.payload.workflow.counters, { search: 1, preview: 1, discovery: 2 });
  assert.equal(h.calls.filter(x => x === detailsURL(IDS[0])).length, 1);
  const result = r.payload.result; assert.equal(result.dynamic, true); assert.equal(result.rows.length, 2);
  assert.equal(result.metrics.calls.length, 4); assert.ok(result.metrics.calls.every(c => !Object.hasOwn(c, 'url') && !Object.hasOwn(c, 'headers')));
  assert.equal(result.sources.find(s => s.source === 'kinobaza').status, 'disabled-no-request');
  assert.equal(result.rows.find(r => r.id.startsWith('motn:')).price.currency.value, 'UAH');
  const row = result.rows.find(r => r.id.startsWith('motn:')); const exact = row.link.href;
  assert.equal(prepareDraft(result, row).fields.purchase_url, '');
  const draft = prepareDraft(result, row, true); assert.equal(draft.fields.purchase_url, exact);
  assert.equal(draft.fields.imdb_url, `https://www.imdb.com/title/tt${IDS[0]}/`);
  assert.deepEqual(Object.keys(draft.fields), ['imdb_url', 'title', 'year', 'recommended_medium', 'purchase_url', 'status']);
  assert.equal((await h.act('discover')).status, 400); assert.equal(h.calls.length, 4);
});
test('two explicit changed searches/two different previews and one discovery enforce per-case six, no fan-out or repeat', async () => {
  const h = harness(); let a = await h.act('search', { query: 'Authored first' });
  const old = h.state().actionToken; const body = { candidate: a.payload.candidates[0].ref };
  const p = await h.act('preview', body);
  assert.equal((await h.flows.execute(h.state().id, 'preview', old, body)).status, 409);
  assert.equal((await h.act('preview', body)).status, 400);
  a = await h.act('search', { query: 'Explicit second', year: '2009' });
  assert.equal((await h.act('confirm', { preview: p.payload.preview.ref })).status, 400);
  const b = await h.act('preview', { candidate: a.payload.candidates[1].ref }); await h.act('confirm', { preview: b.payload.preview.ref });
  const r = await h.act('discover'); assert.deepEqual(r.payload.workflow.counters, { search: 2, preview: 2, discovery: 2 }); assert.equal(h.calls.length, 6);
  assert.equal((await h.act('search', { query: 'Third impossible' })).status, 400); assert.equal(h.calls.length, 6);
  await h.act('new-case'); assert.deepEqual(h.state().counters, { search: 0, preview: 0, discovery: 0 });
  assert.equal((await h.act('confirm', { preview: b.payload.preview.ref })).status, 400);
});
test('query encoding, movie-only first-page contract, max8 results and server-owned references; no IDs/URL overrides', async () => {
  const h = harness(); const a = await h.act('search', { query: 'Назва & /?foo=bar', year: '2011' });
  const u = new URL(h.calls[0]); assert.equal(u.origin, 'https://api.themoviedb.org'); assert.equal(u.searchParams.get('query'), 'Назва & /?foo=bar');
  assert.equal(u.searchParams.get('page'), '1'); assert.equal(u.searchParams.get('include_adult'), 'false'); assert.equal(u.searchParams.get('language'), 'uk-UA'); assert.equal(u.searchParams.get('year'), '2011');
  assert.equal((await h.act('preview', { candidate: String(IDS[0]) })).status, 400);
  assert.equal((await h.act('search', { query: 'Another', url: 'https://evil.invalid' })).status, 400); assert.equal(h.calls.length, 1);
  assert.equal(a.payload.candidates.length, 2);
  const d = searchData(); d.results = Array.from({ length: 20 }, (_, i) => ({ ...d.results[0], id: i + 1 })); assert.equal(projectFilmSearch(d).length, 8);
  assert.equal(projectFilmSearch({ results: 'not-list' }), null); assert.equal(projectFilmSearch({ results: [null, { id: 0, title: 'bad' }] }), null);
});
for (const type of ['root-id', 'external-imdb', 'nested-id', 'malformed-nested-id', 'invalid-imdb', 'api-error']) test(`preview identity refusal: ${type}, no follow-up crosswalk/discovery`, async () => {
  const h = harness({}, { mutate(d, phase) { if (phase !== 'preview') return;
    if (type === 'root-id') d.id = IDS[1]; if (type === 'external-imdb') d.external_ids.imdb_id = `tt${IDS[1]}`;
    if (type === 'nested-id') d.credits.id = IDS[1]; if (type === 'malformed-nested-id') d.credits.id = '999900001';
    if (type === 'invalid-imdb') d.imdb_id = 'not-imdb'; if (type === 'api-error') { d.success = false; d.status_code = 34; }
  } });
  const a = await h.act('search', { query: 'Authored' }); const p = await h.act('preview', { candidate: a.payload.candidates[0].ref });
  assert.equal(p.payload.preview, null); assert.equal((await h.act('discover')).status, 400); assert.equal(h.calls.length, 2);
});
test('missing IMDb is honest unknown and zero MOTN; valid root with missing optional resources can still give partial TMDb', async () => {
  const h = harness({}, { mutate(d, phase) { if (phase === 'preview') { delete d.imdb_id; delete d.external_ids; delete d.credits; } } });
  const p = await h.select(); assert.equal(p.crosswalk, 'unknown'); assert.equal(p.metadataStatus, 'partial');
  const r = await h.act('discover'); assert.equal(h.calls.length, 3);
  assert.deepEqual(r.payload.workflow.counters, { search: 1, preview: 1, discovery: 1 });
  const result = r.payload.result; assert.equal(result.sources.find(s => s.source === 'motn').status, 'not-evaluated-missing-crosswalk');
  assert.equal(result.matching.subjects.find(s => s.source === 'motn').outcome, 'not-evaluated');
  assert.equal(prepareDraft(result, result.rows[0]).fields.imdb_url, '');
});
for (const phase of ['providers', 'motn']) test(`independent ${phase} failure preserves good peer and source-scoped literal data`, async () => {
  const h = harness({}, { response(p, d) { return p === phase ? new Response('PRIVATE ERROR BODY', { status: 503 }) : Response.json(d); } });
  await h.select(); const r = await h.act('discover'); assert.equal(r.payload.result.rows.length, 1); assert.equal(h.calls.length, 4);
  assert.doesNotMatch(JSON.stringify(r.payload), /PRIVATE ERROR BODY/);
});
for (const phase of ['providers', 'motn']) test(`returned ${phase} stable-ID conflict quarantines only affected source`, async () => {
  const h = harness({}, { mutate(d, p) { if (p === phase) { if (p === 'providers') d.id = IDS[1]; else d.tmdbId = `movie/${IDS[1]}`; } } });
  await h.select(); const r = await h.act('discover'); assert.equal(r.payload.result.rows.length, 1);
  assert.equal(r.payload.result.identity.status, 'conflict-no-common-identity');
});
test('consistent stable IDs tolerate reported year variance; aliases do not become tracks/cut/field propagation', async () => {
  const h = harness({}, { mutate(d, p) { if (p === 'motn') { d.releaseYear = 2002; d.originalTitle = 'Авторський alias'; } } });
  await h.select(); const r = await h.act('discover'); const motn = r.payload.result.sources.find(s => s.source === 'motn');
  assert.equal(motn.identity, 'matched'); assert.equal(motn.evidence.warnings.length, 1);
  assert.ok(r.payload.result.rows.every(r => r.cut.state === 'unknown' && !r.audio.ukrainian?.length));
});
for (const kind of ['redirect', 'quota', 'bad-json', 'oversize', 'secret', 'timeout']) test(`bounded failure ${kind}: one attempted search; no retry/archive/content leak`, async () => {
  const h = harness({ timeoutMs: 15, maxBytes: 2048 }, { response(p, d) {
    if (kind === 'timeout') return new Promise(() => {});
    if (kind === 'redirect') return new Response('not kept', { status: 302, headers: { location: 'https://evil.invalid' } });
    if (kind === 'quota') return new Response('private', { status: 429 });
    if (kind === 'bad-json') return new Response('{private', { headers: { 'Content-Type': 'application/json' } });
    if (kind === 'oversize') return Response.json(d, { headers: { 'content-length': '99999' } });
    return Response.json({ ...d, echo: 'author-tmdb-key' });
  } });
  const r = await h.act('search', { query: 'Authored' }); assert.equal(h.calls.length, 1); assert.equal(r.payload.candidates.length, 0);
  assert.doesNotMatch(JSON.stringify(r.payload), /author-tmdb-key|evil\.invalid|private/);
  assert.equal((await h.act('search', { query: 'Authored' })).status, 400); assert.equal(h.calls.length, 1);
});
test('late preview cannot confirm after invalidation; counters persist, old tokens/candidates stay revoked', async () => {
  let release; const h = harness({}, { response(p, d) { return p === 'preview' ? new Promise(resolve => { release = () => resolve(Response.json(d)); }) : Response.json(d); } });
  const a = await h.act('search', { query: 'Authored' }); const pending = h.act('preview', { candidate: a.payload.candidates[0].ref });
  await new Promise(resolve => setImmediate(resolve)); const fresh = h.flows.invalidate(h.state().id); release();
  assert.equal((await pending).status, 409);
  assert.equal((await h.flows.execute(fresh.id, 'confirm', fresh.actionToken, { preview: 'old' })).status, 400);
  assert.deepEqual(fresh.counters, { search: 1, preview: 1, discovery: 0 });
});
test('synthetic zero network, bounded TTL/pages, missing credentials consume actions not fake calls', async () => {
  let clock = 0; const flows = createFilmWorkflows({ now: () => clock }); const p = flows.issue();
  clock = 30 * 60_000; assert.equal(flows.inspect(p.id), null);
  const h = harness({ mode: 'synthetic', fetchImpl: () => assert.fail('Synthetic network') }); await h.select();
  const r = await h.act('discover'); assert.deepEqual(r.payload.workflow.counters, { search: 0, preview: 0, discovery: 0 });
  const noKey = harness({ tmdbToken: '' }); const f = await noKey.act('search', { query: 'Authored' });
  assert.equal(f.payload.status, 'missing-token-no-request'); assert.equal(noKey.calls.length, 0); assert.equal(f.payload.workflow.uses.search, 1);
});
test('dynamic safe report: selected bounded title, phases, disabled not failed, no tokens/queries/URLs/draft contents', async () => {
  const h = harness(); await h.select(); const r = await h.act('discover'); const result = r.payload.result; result.accounting = r.payload.workflow;
  const text = buildShortReport({ filmId: result.film.id, result, mode: 'live', draft: { title: 'PRIVATE_MANUAL_VALUE' } });
  assert.match(text, /M3\.1/); assert.match(text, /search 1\/2; preview 1\/2; discovery 2\/2/); assert.match(text, /dynamic M3\.1 scope/);
  assert.doesNotMatch(text, /https?:|REFERRAL|PRIVATE_MANUAL|author-tmdb|author-motn|Authored only|actionToken/);
  assert.match(text, /Commit: unknown/);
});
test('HTTP auth/origin/Host/assets and opaque page controls; old fixed token invalidated, fixed controls remain', async t => {
  const address = '192.168.88.7', password = 'author-only-pass'; // Invented interface, loopback transport only.
  const auth = `Basic ${Buffer.from(`demo:${password}`).toString('base64')}`;
  const calls = []; const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', access: 'lan', bindIPv4: address, lanPassword: password,
    interfaces: { authored: [{ address, internal: false }] },
    fetchImpl: async url => { calls.push(url); throw Error('No network'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port, origin = `http://${address}:${port}`;
  const request = (path, headers = {}, body, method = 'GET') => new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${port}${path}`, { method, headers: { Host: `${address}:${port}`, ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    }); req.on('error', reject); req.end(body);
  });
  for (const path of ['/film-search.mjs', '/session', '/dynamic/search', '/dynamic/invalidate']) assert.equal((await request(path)).status, 401);
  const session = await (await request('/session', { Authorization: auth })).json();
  const headers = { Authorization: auth, Origin: origin, 'Content-Type': 'application/json', 'x-demo-workflow': session.dynamic.id, 'x-demo-action': session.dynamic.actionToken };
  for (const bad of [{ Authorization: 'Basic bad' }, { Host: 'evil.invalid' }, { Origin: 'https://evil.invalid' }]) {
    assert.equal((await request('/dynamic/search', { ...headers, ...bad }, '{"query":"Authored"}', 'POST')).status, bad.Authorization ? 401 : 403);
  }
  const good = await request('/dynamic/search', headers, '{"query":"Authored"}', 'POST'); assert.equal(good.status, 200);
  assert.equal((await request('/dynamic/preview', headers, 'x'.repeat(5000), 'POST')).status, 502);
  assert.equal((await request('/film-search.mjs', { Authorization: auth })).headers.get('cache-control'), 'no-store');
  assert.equal(calls.length, 0); assert.doesNotMatch(JSON.stringify(await good.json()), /author-only-pass|Authorization|GEMINI/);
});
test('HTTP dynamic route guards, one-shot and fixed-page advance with loopback mocks', async t => {
  const transport = mockTransport(); const server = createDemo({ mode: 'live', retrieval: 'ua-discovery', discovery: 'digital-ua', tmdbToken: 'author-tmdb-key', motnKey: 'author-motn-key', fetchImpl: transport.fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`; const session = await (await fetch(origin + '/session')).json();
  const headers = { Origin: origin, 'Content-Type': 'application/json', 'x-demo-workflow': session.dynamic.id, 'x-demo-action': session.dynamic.actionToken };
  assert.equal((await fetch(origin + '/dynamic/search', { method: 'POST', headers: { ...headers, Origin: 'https://evil.invalid' }, body: '{"query":"Authored"}' })).status, 403);
  const a = await fetch(origin + '/dynamic/search', { method: 'POST', headers, body: '{"query":"Authored"}' }); assert.equal(a.status, 200);
  assert.equal((await fetch(origin + '/answer', { method: 'POST', headers: { Origin: origin, 'x-demo-session': session.token } })).status, 409);
  assert.equal((await fetch(origin + '/dynamic/search', { method: 'POST', headers, body: '{"query":"Authored"}' })).status, 409);
  const renewed = await (await fetch(origin + '/session?film=dune-part-two', { headers: { 'x-demo-page': session.dynamic.id } })).json();
  assert.equal(renewed.film.id, 'dune-part-two'); assert.equal(renewed.films.length, 6); assert.equal(renewed.dynamic.counters.search, 1);
  assert.equal(transport.calls.length, 1); assert.equal((await fetch(origin + '/film-search.mjs')).status, 200);
});
test('new modules contain no response persistence, logs, source URLs/browser input fetch or LLM', async () => {
  for (const file of ['film-workflow.mjs', 'film-workflow-synthetic.mjs', 'public/film-search.mjs']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8'); assert.doesNotMatch(source, /console\.|localStorage|sessionStorage|writeFile|appendFile|eval\(|googleSearch|generateContent/);
  }
});
test('failed/unconfirmed preview short report is useful without exporting query/candidate/token/body or a false selected film', () => {
  const report = buildWorkflowReport({ status: 'identity-unresolved-or-conflicting', workflow: { id: 'PRIVATE', actionToken: 'SECRET', counters: { search: 1, preview: 1, discovery: 0 }, phaseElapsedMs: { search: 1, preview: 2, discovery: 0 } }, film: { title: 'PRIVATE QUERY', tmdbId: IDS[0] } });
  assert.match(report, /Selected identity: not confirmed/); assert.match(report, /identity-unresolved-or-conflicting/);
  assert.doesNotMatch(report, /PRIVATE|SECRET|https?:|999900001/);
  assert.doesNotMatch(buildWorkflowReport({ status: 'https://PRIVATE' }), /https?:|PRIVATE/);
});
test('dynamic R2 quarantines conflicting namespaced ID without blocking independent Apple Store claims', async () => {
  const h = harness({}, { mutate(d, p) { if (p === 'motn') d.streamingOptions.ua.push({ ...d.streamingOptions.ua[0], service: { id: 'apple', name: 'Netflix' } }); } });
  await h.select(); const r = await h.act('discover');
  assert.equal(r.payload.result.rows.length, 1); assert.equal(r.payload.result.rows[0].provenance.source, 'TMDB / JustWatch');
  assert.equal(r.payload.result.unmapped.length, 2); assert.ok(r.payload.result.unmapped.every(x => x.reason === 'provider-id-conflict'));
});
test('dynamic missing field/empty languages stay unknown, not tracks or repaired video/currency; titles are not cut evidence', async () => {
  const h = harness({}, { mutate(d, p) { if (p === 'motn') { delete d.streamingOptions.ua[0].quality; d.streamingOptions.ua[0].audios = []; } } });
  await h.select(); const r = await h.act('discover'); const row = r.payload.result.rows.find(r => r.id.startsWith('motn:'));
  assert.equal(row.audio.completeness, 'not-established'); assert.equal(row.quality.state, 'not-reported'); assert.equal(row.cut.state, 'unknown');
  assert.equal(row.price.currency.value, 'UAH'); assert.equal(row.dolbyVision.state, 'unknown');
  assert.match(JSON.stringify(prepareDraft(r.payload.result, row).sidecar.excluded), /audio|video|Price/);
});
test('projected page contexts are capped at100 and disposed/expired without background requests', () => {
  const flows = createFilmWorkflows({ fetchImpl: () => assert.fail('No background/source requests') });
  const pages = Array.from({ length: 100 }, () => flows.issue()); assert.ok(pages.every(Boolean)); assert.equal(flows.issue(), null);
  flows.dispose(); assert.ok(pages.every(p => flows.inspect(p.id) === null)); assert.ok(flows.issue()); flows.dispose();
});
