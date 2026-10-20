import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { admitKinobazaURL, fetchAssistedKinobaza } from '../assisted-kinobaza.mjs';
import { createFilmWorkflows } from '../film-workflow.mjs';
import { prepareDraft } from '../public/discovery-client.mjs';
import { buildShortReport, buildWorkflowReport } from '../public/discovery-report.mjs';
import { mockTransport } from './film-workflow.fixture.mjs';
import { CARD, markup } from './assisted-kinobaza.fixture.mjs';
import { titleBoundaryCases } from './assisted-title-boundaries.fixture.mjs';
const film = { dynamic: true, id: 'tmdb:999900001', tmdbId: 999900001, imdbId: 'tt999900001', identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001, titleAliases: [], directorAliases: ['Authored director'], directorCount: 1 };
const response = html => new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });

for (const c of titleBoundaryCases) test(`metadata boundary contract: ${c.name}`, async () => {
  let calls = 0;
  const r = await fetchAssistedKinobaza(CARD, film, async (url, init) => {
    calls++; assert.equal(url, CARD); assert.equal(init.redirect, 'manual'); return response(c.html);
  });
  assert.equal(r.identity.status, c.status); assert.equal(r.identity.reason, c.reason); assert.equal(calls, 1);
  if (c.status !== 'matched') { assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined); }
});

// Boundary probes are authored, not reconstructed owner HTML or evidence of coverage.
for (const [name, transform, expected, count, reason = 'source-original-title-unestablished'] of [
  ['single exact original H2', h => h, 'matched', 1],
  ['nested formatting preserves title text', h => h.replace('<h2>Authored original</h2>', '<h2><span>Authored original</span></h2>'), 'matched', 1],
  ['two agreeing H2s conservatively withheld', h => h.replace('<h2>Authored original</h2>', '<h2>Authored original</h2><h2>Authored original</h2>'), 'unresolved', 2, 'source-original-title-scope-unestablished'],
  ['original plus matching localized H2 conservatively withheld', h => h.replace('<h2>Authored original</h2>', '<h2>Authored original</h2><h2>Вигаданий фільм</h2>'), 'unresolved', 2, 'source-original-title-scope-unestablished'],
  ['unestablished title annotation is not stripped', h => h.replace('<h2>Authored original</h2>', '<h2>Authored original (alias)</h2>'), 'unresolved', 1],
  ['matching H2 beyond accordion cannot corroborate', h => h.replace('<h2>Authored original</h2>', '<h2>Unestablished original</h2>') + '<h2>Authored original</h2>', 'unresolved', 1],
]) test(`original-title boundary audit: ${name}`, async () => {
  const r = await fetchAssistedKinobaza(CARD, film, async () => response(transform(markup())));
  assert.equal(r.identity.status, expected); assert.equal(r.identity.observed.originalTitleCount, count);
  if (expected === 'unresolved') { assert.equal(r.identity.reason, reason); assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined); }
});

for (const [name, transform, issue] of [
  ['no Ukrainian section', h => h.replaceAll('collapseUA', 'collapsePL').replace('Доступно в Україні', 'Доступно в Польщі'), 'missing-explicit-ukraine-section'],
  ['unsupported direct accordion child', h => h.replace('<div id="availabilityAccordion">', '<div id="availabilityAccordion"><p>Authored unsupported child</p>'), 'unsupported-accordion-items'],
  ['ambiguous territory control', h => h.replace('Доступно в Україні</button>', 'Доступно в Україні</button><button>Authored other control</button>'), 'ambiguous-territory-control'],
]) test(`matched identity versus extraction refusal: ${name}`, async () => {
  const h = harness({ html: transform(markup()) }); await h.setup(); const r = await h.read(), data = r.payload.result;
  assert.equal(data.assistedContribution.identity, 'matched'); assert.equal(data.assistedContribution.status, 'unsupported-markup');
  assert.ok(data.assistedContribution.extractionIssues.includes(issue)); assert.equal(data.assistedContribution.candidates, 0);
  data.accounting = r.payload.workflow;
  const report = buildShortReport({ filmId: film.id, mode: 'live', result: data });
  assert.ok(report.includes(`Assisted extraction diagnostics: ${issue}`)); assert.match(report, /not evidence of absent offers/);
  assert.doesNotMatch(report, /https?:|author-tmdb|author-motn|Authored unsupported|Authored other/);
  assert.equal(h.calls.length, 5); assert.equal((await h.read()).status, 400);
});

test('missing viewing boundary stops original-title establishment before extraction, not evidence of absent offers', async () => {
  const r = await fetchAssistedKinobaza(CARD, film, async () => response(markup().replace('id="availabilityAccordion"', 'id="unsupported-viewing"')));
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'source-identity-structure-incomplete');
  assert.deepEqual(r.candidates, []);
});

// Author-written spelling/grouping cases, not live pages or person aliases.
for (const [name, expectedAliases, observed, directorCount, stable, status, reason] of [
  ['exact returned alias', ['Denis Villeneuve'], 'Denis Villeneuve', 1, 'tt999900001', 'matched', 'explicit-stable-and-structural-match'],
  ['exact supplied alias, not guessed transliteration', ['Denis Villeneuve', 'Дені Вільнев'], 'Дені Вільнев', 1, 'tt999900001', 'matched', 'explicit-stable-and-structural-match'],
  ['Latin diacritic is unestablished', ['Denis Villeneuve'], 'Dénis Villeneuve', 1, 'tt999900001', 'unresolved', 'director-alias-unestablished'],
  ['Cyrillic spelling is unestablished', ['Дені Вільнев'], 'Дені Вільньов', 1, 'tt999900001', 'unresolved', 'director-alias-unestablished'],
  ['cross-script spelling is unestablished', ['Denis Villeneuve'], 'Дені Вільньов', 1, 'tt999900001', 'unresolved', 'director-alias-unestablished'],
  ['different Latin name is not person-ID evidence', ['Denis Villeneuve'], 'Other director', 1, 'tt999900001', 'unresolved', 'director-alias-unestablished'],
  ['missing aliases', [], 'Denis Villeneuve', 1, 'tt999900001', 'unresolved', 'source-or-selected-director-missing'],
  ['combined names are not split', ['Author One', 'Author Two'], 'Author One / Author Two', 2, 'tt999900001', 'unresolved', 'director-scope-unestablished'],
  ['partial observed group is not a full match', ['Author One', 'Author Two'], 'Author One', 2, 'tt999900001', 'unresolved', 'director-scope-unestablished'],
  ['incomplete aliases with known multi-director scope', ['Author One'], 'Author One', 2, 'tt999900001', 'unresolved', 'director-scope-unestablished'],
  ['unknown director scope is not a full match', ['Author One'], 'Author One', null, 'tt999900001', 'unresolved', 'director-scope-unestablished'],
  ['stable-ID conflict overrides unknown spelling', ['Denis Villeneuve'], 'Dénis Villeneuve', 1, 'tt999900002', 'mismatch', 'source-stable-id-conflict'],
  ['stable-ID conflict overrides unknown multi-director scope', ['Author One'], 'Author One / Author Two', 2, 'tt999900002', 'mismatch', 'source-stable-id-conflict'],
]) test(`director evidence semantics: ${name}`, async () => {
  let calls = 0;
  const r = await fetchAssistedKinobaza(CARD, { ...film, directorAliases: expectedAliases, directorCount }, async url => {
    calls++; assert.equal(url, CARD);
    return response(markup({ director: observed, stable: `<tr><td>IMDb:</td><td>${stable}</td></tr>` }));
  });
  assert.equal(r.identity.status, status); assert.equal(r.identity.reason, reason); assert.equal(calls, 1);
  if (status !== 'matched') { assert.deepEqual(r.candidates, []); assert.equal(r.localization, undefined); }
});
test('separately formatted source director values do not prove a person conflict or complete group', async () => {
  const r = await fetchAssistedKinobaza(CARD, { ...film, directorCount: 1, directorAliases: ['Author One', 'Another supplied spelling'] }, async () => response(markup({
    director: 'Author One', stable: '<tr><td>Режисер:</td><td>Another supplied spelling</td></tr>',
  })));
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'director-scope-unestablished'); assert.deepEqual(r.candidates, []);
});
function harness({ html = markup(), reply, apiOptions = {}, ...options } = {}) {
  const transport = mockTransport(apiOptions), calls = [];
  const flows = createFilmWorkflows({ mode: 'live', tmdbToken: 'author-tmdb-key', motnKey: 'author-motn-key', ...options,
    fetchImpl: async (url, init) => {
      calls.push(url); if (url !== CARD) return transport.fetchImpl(url, init);
      assert.deepEqual(Object.keys(init.headers).sort(), ['Accept', 'User-Agent']); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'manual');
      return reply ? reply(init) : response(html);
    } });
  let state = flows.issue();
  const act = async (action, input = {}) => { const r = await flows.execute(state.id, action, state.actionToken, input); if (r.payload.workflow) state = r.payload.workflow; return r; };
  const setup = async () => { const a = await act('search', { query: 'Authored search' }); const b = await act('preview', { candidate: a.payload.candidates[0].ref }); await act('confirm', { preview: b.payload.preview.ref }); return act('discover'); };
  const read = async () => { const a = await act('admit-card', { sourceURL: CARD }); return a.status === 200 ? act('read-card', { card: a.payload.card.ref }) : a; };
  return { flows, calls, act, setup, read, state: () => state };
}

test('strict original-spelling admission rejects SSRF/normalization/alternate-host tricks, no guessed repair', () => {
  assert.equal(admitKinobazaURL(CARD), CARD);
  for (const url of [null, '', CARD + '/', CARD + '/videos', CARD + '?x=1', CARD + '#a', CARD + '?', CARD + '#',
    CARD.replace('https:', 'http:'), CARD.replace('kinobazaua.com', 'www.kinobazaua.com'), CARD.replace('kinobazaua.com', 'kinobaza.com.ua'),
    CARD.replace('kinobazaua.com', 'kinobazaua.com.evil.invalid'), CARD.replace('kinobazaua.com', 'evil@kinobazaua.com'),
    CARD.replace('kinobazaua.com', 'kinobazaua.com:443'), CARD.replace('kinobazaua.com', '127.0.0.1'), CARD.replace('kinobazaua.com', '[::1]'),
    CARD.replace('/titles/', '/titles/../titles/'), CARD.replace('/titles/', '/titles/%2e%2e/'), CARD + '%2Fextra', CARD + '%252f', CARD + '\\x',
    CARD.replace('/titles/', '//titles/'), CARD + '\n', ' ' + CARD, CARD.replace('https:', 'HTTPS:'), CARD.replace('authored-card', '.hidden')]) assert.equal(admitKinobazaURL(url), null, String(url));
});
test('admit zero GETs -> opaque run reference -> one independent GET; source claims and original rows/draft remain separate', async () => {
  const h = harness(); const before = (await h.setup()).payload.result;
  const original = before.rows.find(r => r.id.startsWith('motn:')), draft = prepareDraft(before, original, true);
  const a = await h.act('admit-card', { sourceURL: CARD }); assert.equal(h.calls.length, 4); assert.equal(a.payload.card.sourceURL, CARD); assert.match(a.payload.card.ref, /^[a-f0-9]{64}$/);
  assert.equal((await h.act('read-card', { card: CARD })).status, 400); assert.equal(h.calls.length, 4);
  const r = await h.act('read-card', { card: a.payload.card.ref }); const data = r.payload.result; data.accounting = r.payload.workflow;
  assert.equal(data.assistedContribution.identity, 'matched'); assert.equal(h.calls.length, 5); assert.equal(data.assistedContribution.blocks, 1);
  assert.deepEqual(r.payload.workflow.counters, { search: 1, preview: 1, discovery: 2, kinobaza: 1 }); assert.equal(r.payload.workflow.cap, 7);
  assert.deepEqual(data.rows.filter(r => !r.id.startsWith('kinobaza:')), before.rows); assert.deepEqual(prepareDraft(data, data.rows.find(r => r.id === original.id), true), draft);
  const own = data.rows.find(r => r.kinobazaLocalization); assert.equal(own.country, null); assert.equal(own.kinobazaLocalization.audio.state, 'reported-positive');
  assert.equal(original.audio.completeness, 'not-established'); assert.ok(data.rows.every(r => r.provider.key !== 'netflix'));
  assert.equal(prepareDraft(data, own).fields.purchase_url, ''); assert.equal(prepareDraft(data, own, true).fields.purchase_url, own.link.href);
  assert.equal((await h.act('read-card', { card: a.payload.card.ref })).status, 400); assert.equal((await h.act('admit-card', { sourceURL: CARD })).status, 400); assert.equal(h.calls.length, 5);
  const report = buildShortReport({ filmId: film.id, mode: 'live', result: data });
  assert.match(report, /case cap7/); assert.match(report, /Kinobaza 1\/1/); assert.match(report, /localization blocks 1/);
  assert.doesNotMatch(report, /https?:|AUTHOR|author-tmdb|author-motn|actionToken|sourceURL|authored-card/);
});
for (const [name, html, status] of [
  ['structural match', markup(), 'matched'],
  ['title conflict', markup({ original: 'Different original', title: 'Different film' }), 'mismatch'],
  ['wrong year without stable evidence', markup({ year: 2009 }), 'mismatch'],
  ['year variance with explicit IMDb', markup({ year: 2002, stable: '<tr><td>IMDb:</td><td><a href="https://www.imdb.com/title/tt999900001/">IMDb</a></td></tr>' }), 'matched'],
  ['stable conflict', markup({ stable: '<tr><td>TMDb:</td><td><a href="https://www.themoviedb.org/movie/999900002">TMDb</a></td></tr>' }), 'mismatch'],
  ['literal stable conflict', markup({ stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' }), 'mismatch'],
  ['malformed explicit ID', markup({ stable: '<tr><td>IMDb:</td><td>not-an-id</td></tr>' }), 'unresolved'],
  ['stable conflict plus malformed evidence', markup({ stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr><tr><td>TMDb:</td><td>invalid</td></tr>' }), 'mismatch'],
  ['stable conflict plus missing canonical', markup({ stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' }).replace(/<link[^>]+>/, ''), 'mismatch'],
  ['repeated agreeing canonical', markup().replace('</head>', `<link rel="canonical" href="${CARD}"></head>`), 'unresolved'],
  ['canonical missing href', markup().replace(`href="${CARD}"`, ''), 'unresolved'],
  ['ID link and literal disagreement', markup({ stable: '<tr><td>IMDb:</td><td><a href="https://www.imdb.com/title/tt999900001/">tt999900002</a></td></tr>' }), 'mismatch'],
  ['excessive identity structures', markup({ stable: '<tr><td>IMDb:</td><td>tt999900001</td></tr>'.repeat(33) }), 'unresolved'],
  ['original title only outside card metadata', markup().replace('<h2>Authored original</h2>', '<h2>Wrong original</h2>') + '<h2>Authored original</h2>', 'unresolved'],
  ['empty original metadata', markup({ original: '' }), 'unresolved'],
  ['missing director', markup({ director: '' }), 'unresolved'],
  ['unestablished transliteration', markup({ director: 'Авторський режисер' }), 'unresolved'],
  ['unestablished director name', markup({ director: 'Other director' }), 'unresolved'],
  ['canonical conflict', markup({ url: CARD + '-other' }), 'mismatch'],
  ['multiple h1', markup().replace('</h1>', '</h1><h1>Other (2001)</h1>'), 'unresolved'],
]) test(`independent assisted identity: ${name}`, async () => {
  const h = harness({ html }); await h.setup(); const r = await h.read();
  assert.equal(r.payload.result.assistedContribution.identity, status); assert.equal(h.calls.length, 5);
  if (status !== 'matched') { assert.equal(r.payload.result.rows.length, 2); assert.equal(r.payload.result.filmLocalization, null); }
});

test('metadata-scope refusal keeps independent rows/draft, safe reason and consumed one-shot', async () => {
  for (const original of ['Other authored original', 'Authored original']) {
    const h = harness({ html: markup().replace('<h2>Authored original</h2>', `<h2>Authored original</h2><h2>${original}</h2>`) });
    const before = (await h.setup()).payload.result, row = before.rows.find(r => r.id.startsWith('motn:'));
    const draft = prepareDraft(before, row, true), r = await h.read(), data = r.payload.result;
    assert.equal(data.assistedContribution.identity, 'unresolved'); assert.equal(data.assistedContribution.reason, 'source-original-title-scope-unestablished');
    assert.deepEqual(data.rows, before.rows); assert.equal(data.filmLocalization, null); assert.equal(data.assistedContribution.blocks, 0);
    assert.deepEqual(prepareDraft(data, data.rows.find(r => r.id === row.id), true), draft);
    data.accounting = r.payload.workflow;
    const report = buildShortReport({ filmId: film.id, mode: 'live', result: data });
    assert.match(report, /reason source-original-title-scope-unestablished/);
    assert.doesNotMatch(report, /https?:|Other authored original|author-tmdb-key|author-motn-key/);
    assert.deepEqual(r.payload.workflow.counters, { search: 1, preview: 1, discovery: 2, kinobaza: 1 });
    assert.equal((await h.read()).status, 400); assert.equal(h.calls.length, 5); h.flows.dispose();
  }
});
test('missing selected metadata cannot be repaired by user/source names or film-level badge', async () => {
  const r = await fetchAssistedKinobaza(CARD, { ...film, year: null, directorAliases: [] }, async () => response(markup()));
  assert.equal(r.identity.status, 'unresolved'); assert.deepEqual(r.candidates, []);
});
test('partial TMDb Watch Providers does not block independent MOTN or later assisted source', async () => {
  const h = harness({ apiOptions: { response(phase, data) { return phase === 'providers' ? new Response('', { status: 503 }) : Response.json(data); } } });
  const before = (await h.setup()).payload.result; assert.equal(before.rows.length, 1); assert.equal(before.rows[0].id, 'motn:0');
  const r = await h.read(); assert.equal(r.payload.result.assistedContribution.identity, 'matched');
  assert.equal(r.payload.result.rows.find(row => row.id === 'motn:0').link.href, before.rows[0].link.href); assert.equal(h.calls.length, 5);
  assert.ok(r.payload.result.rows.some(row => row.id.startsWith('kinobaza:')));
});
for (const kind of ['unestablished-spelling', 'multiple-directors', 'incomplete-director-aliases', 'id-conflict']) test(`withheld claims and safe report use selected projection: ${kind}`, async () => {
  const h = harness({ html: markup({ director: kind === 'unestablished-spelling' || kind === 'id-conflict' ? 'Áuthored director' : 'Authored director',
    stable: `<tr><td>IMDb:</td><td>${kind === 'id-conflict' ? 'tt999900002' : 'tt999900001'}</td></tr>` }),
    apiOptions: { mutate(data, phase) { if (phase === 'preview' && ['multiple-directors', 'incomplete-director-aliases'].includes(kind)) data.credits.crew.push({ id: 999998, job: 'Director', ...(kind === 'multiple-directors' ? { name: 'Other authored director' } : {}) }); } },
  });
  const before = (await h.setup()).payload.result; const r = await h.read(), result = r.payload.result; result.accounting = r.payload.workflow;
  assert.equal(result.assistedContribution.identity, kind === 'id-conflict' ? 'mismatch' : 'unresolved');
  assert.equal(result.assistedContribution.reason, kind === 'id-conflict' ? 'source-stable-id-conflict' : kind === 'unestablished-spelling' ? 'director-alias-unestablished' : 'director-scope-unestablished');
  assert.deepEqual(result.rows, before.rows); assert.equal(result.filmLocalization, null); assert.equal(result.assistedContribution.blocks, 0);
  assert.equal(h.calls.length, 5); assert.equal(r.payload.workflow.uses.kinobaza, 1);
  const report = buildShortReport({ filmId: film.id, mode: 'live', result });
  assert.ok(report.includes(`reason ${result.assistedContribution.reason}`));
  assert.doesNotMatch(report, /source-director-conflict|https?:|Áuthored|author-tmdb-key|author-motn-key/);
  assert.equal((await h.read()).status, 400); assert.equal(h.calls.length, 5);
});
for (const kind of ['redirect', '403', '429', 'timeout', 'oversize', 'stream-size', 'invalid-type', 'malformed', 'challenge', 'secret']) test(`one bounded failed assisted attempt: ${kind}, no retries or fallback`, async () => {
  const h = harness({ timeoutMs: 15, maxBytes: 4096, reply() {
    if (kind === 'timeout') return new Promise(() => {});
    if (kind === 'redirect') return new Response('', { status: 301, headers: { location: CARD + '-other' } });
    if (['403', '429'].includes(kind)) return new Response('PRIVATE', { status: Number(kind) });
    if (kind === 'oversize') return new Response('', { headers: { 'content-type': 'text/html', 'content-length': '9999999' } });
    if (kind === 'stream-size') return response('x'.repeat(4097));
    if (kind === 'invalid-type') return Response.json({ private: 'not-html' });
    if (kind === 'challenge') return response('<h1>CAPTCHA</h1>');
    if (kind === 'secret') return response(markup({ title: 'author-tmdb-key' }));
    return response(markup().replace('<h1>', '<h1 id="x" id="y">'));
  } });
  await h.setup(); const r = await h.read(); assert.equal(r.status, 200); assert.equal(h.calls.length, 5); assert.equal(r.payload.workflow.counters.kinobaza, 1);
  assert.equal(r.payload.result.rows.length, 2); assert.notEqual(r.payload.result.assistedContribution.identity, 'matched');
  assert.equal((await h.read()).status, 400); assert.equal(h.calls.length, 5); assert.doesNotMatch(JSON.stringify(r.payload), /PRIVATE|author-tmdb-key|author-motn-key/);
});
test('invalid admission zero GET; replaced refs/other page refs/new-film refs never usable', async () => {
  const h = harness(); await h.setup(); const a = await h.act('admit-card', { sourceURL: CARD });
  assert.equal((await h.act('admit-card', { sourceURL: CARD + '?query' })).status, 400);
  assert.equal((await h.act('read-card', { card: a.payload.card.ref })).status, 400); assert.equal(h.calls.length, 4);
  const other = h.flows.issue(); assert.equal((await h.flows.execute(other.id, 'read-card', other.actionToken, { card: a.payload.card.ref })).status, 400);
  await h.act('new-case'); assert.equal((await h.act('read-card', { card: a.payload.card.ref })).status, 400); assert.equal(h.calls.length, 4); h.flows.dispose();
});
test('explicit second search/preview plus assisted source enforce seven maximum without rerunning TMDb/MOTN', async () => {
  const h = harness(); const a = await h.act('search', { query: 'First authored' });
  await h.act('preview', { candidate: a.payload.candidates[1].ref });
  const b = await h.act('search', { query: 'Second authored' }); const c = await h.act('preview', { candidate: b.payload.candidates[0].ref });
  await h.act('confirm', { preview: c.payload.preview.ref }); await h.act('discover'); const r = await h.read();
  assert.equal(h.calls.length, 7); assert.equal(r.payload.result.metrics.requestsMade, 7); assert.equal(r.payload.result.metrics.requestBudget, 7);
  assert.deepEqual(r.payload.workflow.counters, { search: 2, preview: 2, discovery: 2, kinobaza: 1 });
  assert.equal((await h.read()).status, 400); assert.equal(h.calls.length, 7);
});
test('late assisted result cannot resurrect invalidated identity, rows/report or consume an extra GET', async () => {
  let release; const h = harness({ reply: () => new Promise(resolve => { release = () => resolve(response(markup())); }) });
  await h.setup(); const a = await h.act('admit-card', { sourceURL: CARD }); const pending = h.act('read-card', { card: a.payload.card.ref });
  await new Promise(r => setImmediate(r)); h.flows.invalidate(h.state().id); release(); const r = await pending;
  assert.equal(r.status, 409); assert.equal(r.payload.result, undefined); assert.equal(h.calls.length, 5);
});
test('synthetic assisted path is explicitly authored and makes zero source requests', async () => {
  const h = harness({ mode: 'synthetic', fetchImpl: undefined }); await h.setup(); const r = await h.read();
  assert.equal(r.payload.result.synthetic, true); assert.equal(r.payload.result.assistedContribution.identity, 'matched');
  assert.equal(Object.values(r.payload.workflow.counters).reduce((a, b) => a + b, 0), 0); assert.equal(h.calls.length, 0);
});
test('assisted modules have no persistence, logging, execution, redirect follow or destination-fetch hooks', async () => {
  const source = await readFile(new URL('../assisted-kinobaza.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /console\.|localStorage|sessionStorage|writeFile|appendFile|eval\(|redirect: 'follow'|generateContent|googleSearch/);
});
test('lost local assisted response does not falsely claim source was not evaluated or zero GETs', () => {
  const report = buildWorkflowReport({ assisted: true, status: 'action-failed-no-retry' });
  assert.match(report, /Kinobaza: assisted outcome\/accounting unknown; HTTP unknown\/1/); assert.match(report, /case cap7/);
  assert.doesNotMatch(report, /not evaluated|HTTP 0\/1|https?:/);
});
