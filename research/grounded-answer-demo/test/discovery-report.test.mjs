import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDiscovery } from '../discovery.mjs';
import { selectRequest } from '../config.mjs';
import { describeDiscovery } from '../matching.mjs';
import { buildShortReport, writeShortReport } from '../public/discovery-report.mjs';
import { createDemo } from '../server.mjs';

const time = '2000-01-01T00:00:00.000Z'; // Authored clock, not a live execution timestamp.
async function result() {
  const r = await runDiscovery(selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' }), { fetchImpl: () => assert.fail('No external calls') });
  r.matching = describeDiscovery(r); return r;
}

test('short report: allowlisted authored content, unknown commit and source attribution; no secrets/URLs/raw/draft values', async () => {
  const r = await result();
  r.secret = r.headers = r.account = r.raw = r.stages = 'SECRET_SENTINEL';
  r.film = { ...r.film, title: 'SECRET_SENTINEL' }; r.sources[0].status = 'SECRET_SENTINEL';
  r.sources[0].evidence = 'SECRET_SENTINEL'; r.matching.rows[0].B.reason = 'SECRET_SENTINEL';
  for (const row of r.rows) {
    row.provenance.sourceURL = 'https://private.example/SECRET_SENTINEL?key=SECRET_SENTINEL';
    row.link.href = row.quality.value = 'SECRET_SENTINEL'; row.extra = 'SECRET_SENTINEL';
  }
  const text = buildShortReport({ filmId: 'coherence', mode: 'synthetic', receivedAt: time, result: r,
    draft: { present: true, confirmed: true, edited: true, selectionCancelled: true, contents: 'SECRET_SENTINEL' } });
  assert.match(text, /SYNTHETIC ONLY/); assert.match(text, /HTTP calls: 0\/5/);
  assert.match(text, /Commit: unknown/); assert.match(text, /Coherence \(2013\)/);
  assert.match(text, /TMDb.*JustWatch/); assert.match(text, /edited yes; latest selection cancelled yes/);
  assert.doesNotMatch(text, /SECRET_SENTINEL|https?:|sourceURL|Authorization|ACCESS_TOKEN|API_KEY/);
  assert.ok(text.length < 12_000);
});

test('report: missing/error values never become zero or a successful run; synthetic/live/unknown are distinct', async () => {
  const r = await result(); r.sources[0].status = 'A: partial; B: ok';
  const partial = buildShortReport({ filmId: 'coherence', mode: 'live', receivedAt: time, result: r });
  assert.match(partial, /A: partial; B: ok/); assert.match(partial, /LIVE source claims — not owner validation/);
  const failed = buildShortReport({ filmId: 'coherence', mode: 'live', receivedAt: 'SECRET', failed: true, result: r });
  assert.match(failed, /HTTP-call count unknown/); assert.match(failed, /Browser receipt: unknown/);
  assert.doesNotMatch(failed, /HTTP calls: 0|SECRET|identity matched/);
  assert.match(buildShortReport({}), /Mode unknown/);
});

test('report is bounded and explicit about omitted rows; copy does not mutate observations or manufacture C/D outcomes', async () => {
  const r = await result(); r.rows = Array.from({ length: 500 }, () => r.rows[0]);
  const before = JSON.stringify(r), text = buildShortReport({ filmId: 'coherence', mode: 'synthetic', receivedAt: time, result: r });
  assert.match(text, /Omitted rows: 488/); assert.ok(text.length < 12_000);
  assert.equal(JSON.stringify(r), before); assert.match(text, /C\/D deferred/);
});

test('clipboard: success awaits write; denial, unavailable or throwing getter use fallback without exception leakage or reads', async () => {
  let resolve, writes = 0, done = false;
  const pending = writeShortReport('AUTHORED summary', { clipboard: { writeText: text => { writes++; assert.equal(text, 'AUTHORED summary'); return new Promise(r => { resolve = r; }); }, readText: () => assert.fail('No clipboard read') } }).then(r => { done = true; return r; });
  await Promise.resolve(); assert.equal(done, false); resolve(); assert.equal(await pending, 'copied'); assert.equal(writes, 1);
  for (const n of [{}, { clipboard: { writeText: async () => { throw new Error('SECRET_EXCEPTION'); } } }, Object.defineProperty({}, 'clipboard', { get() { throw new Error('SECRET_GETTER'); } })]) {
    assert.equal(await writeShortReport('AUTHORED summary', n), 'fallback');
  }
  assert.equal(await writeShortReport('x'.repeat(12_001), { clipboard: { writeText: () => assert.fail('Oversize must not write') } }), 'fallback');
});

test('HTTP integration: existing request budget and one-shot remain; new authenticated asset and A/B projection are additive', async t => {
  let external = 0;
  const server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence', fetchImpl: () => { external++; assert.fail('No external call'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await (await fetch(origin + '/session')).json(); assert.equal(session.requestBudget, 5);
  const asset = await fetch(origin + '/discovery-report.mjs'); assert.equal(asset.status, 200); assert.equal(asset.headers.get('cache-control'), 'no-store');
  const headers = { Origin: origin, 'x-demo-session': session.token };
  const denied = await fetch(origin + '/answer', { method: 'POST', headers: { ...headers, Origin: 'https://foreign.example' } }); assert.equal(denied.status, 403);
  const response = await fetch(origin + '/answer', { method: 'POST', headers });
  const payload = await response.json(); assert.equal(response.status, 200); assert.equal(payload.result.matching.subjects.length, 3);
  assert.equal(payload.result.metrics.requestsMade, 0); assert.equal(payload.result.rows.length > 0, true);
  assert.equal((await fetch(origin + '/answer', { method: 'POST', headers })).status, 409); assert.equal(external, 0);
});

test('new matching/report modules have no transport/log/storage/eval dependencies', async () => {
  for (const file of ['../matching.mjs', '../public/discovery-report.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|console\.|localStorage|sessionStorage|indexedDB|writeFile|\beval\s*\(/);
  }
});
