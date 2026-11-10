// Authored offline HTTP responses only. Never contacts any source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { predictedControlManifest, frozenSearchFactory, safeControlURL, createControlTransport,
  runPredictedControlSeries, loadPredictedControlBaseline, PREDICTED_CONTROL_BASELINE } from '../scripts/m4-predicted-controls.mjs';
import { resolverQueries, resolverReserveQuery } from '../netlify/lib/kinobaza-resolver.mjs';
import { extractHtml } from '../netlify/lib/kinobaza-html.mjs';
import { markup } from './assisted-kinobaza.fixture.mjs';
const key = 'AUTHORED-TMDB-KEY-NEVER-REPORT';
const card = 'https://kinobazaua.com/titles/authored-original', wrong = 'https://kinobazaua.com/titles/authored-wrong';
const requested = { title: 'Authored original', year: 2004, imdbId: 'tt0290002' };
const film = { identityTitle: 'Авторський переклад', originalTitle: 'Authored original', year: 2004, imdbId: requested.imdbId,
  tmdbId: 990001, directorCount: 1, directorAliases: ['Authored director'], directorPeople: [{ namespace: 'tmdb:person', personId: 990002, names: ['Authored director'] }], titleAliases: ['Авторський переклад', 'Authored original'] };
const trace = (query = resolverQueries(film)[0], urls = [card], extra = {}) => ({ query, requestId: 'authored-request-id', searchDepth: 'basic', exactMatch: false,
  candidates: urls.map((url, index) => ({ index: index + 1, admitted: true, safeAdmittedURL: url })), ...extra });
const saved = searches => ({ cases: [{ requested: { ...requested }, baseline: { film: { imdbId: requested.imdbId }, readCards: [] }, searchWireTraces: searches ?? [trace()] }] });
const freshState = () => ({ actual: { tmdb: 0, cards: 0, tmdbPerson: 0, kinobazaPerson: 0, total: 0 }, ramReuses: 0, frozenSearchTransports: 0, requests: [] });
const context = () => ({ findURL: 'https://api.themoviedb.org/3/find/tt0290002?external_source=imdb_id&language=uk-UA', detailsURL: null, film, allowedCards: new Set([card]) });
const get = () => ({ method: 'GET', redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(1000), headers: { Accept: 'text/html' } });

test('reviewed-source fence covers every current and rebound historical dependency before credentials or HTTP', async () => {
  const root = new URL('../', import.meta.url), entry = 'scripts/m4-predicted-controls.mjs';
  const source = await readFile(new URL(entry, root), 'utf8');
  const manifest = source.match(/const usedPaths = \[([\s\S]*?)\];/);
  assert.ok(manifest, 'The control must retain its explicit reviewed-source manifest.');
  const protectedPaths = [...manifest[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const historicalPaths = ['research/grounded-answer-demo/assisted-kinobaza.mjs', 'netlify/lib/kinobaza-director-verifier.mjs', 'netlify/lib/kinobaza-resolver.mjs'];
  const rebound = new Map([
    ['research/grounded-answer-demo/html-source.mjs', 'netlify/lib/kinobaza-html.mjs'],
    ['research/grounded-answer-demo/tmdb.mjs', 'netlify/lib/media-source-tmdb.mjs'],
  ]), visited = new Set();
  const visit = async (path, historical = false) => {
    const key = `${historical ? PREDICTED_CONTROL_BASELINE : 'current'}:${path}`;
    if (visited.has(key)) return;
    visited.add(key);
    if (!historical) {
      assert.ok(protectedPaths.some(protectedPath => path === protectedPath || path.startsWith(`${protectedPath}/`)), `${path} must be fenced before credentials`);
      assert.ok(!path.startsWith('research/'), `${path} is not a current executable dependency`);
    }
    const url = new URL(path, root);
    const body = historical ? execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git', ['show', `${PREDICTED_CONTROL_BASELINE}:${path}`],
      { cwd: fileURLToPath(root), encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','ignore'] }) : await readFile(url, 'utf8');
    for (const [, imported] of body.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      if (!imported.startsWith('.')) continue;
      const relative = fileURLToPath(new URL(imported, url)).slice(fileURLToPath(root).length).replaceAll('\\', '/');
      const pinned = historical && historicalPaths.includes(relative);
      await visit(historical ? rebound.get(relative) ?? relative : relative, pinned);
    }
  };
  await visit(entry);
  for (const path of historicalPaths) await visit(path, true);
  const fence = source.indexOf("throw Error('reviewed-source-dirty')");
  const credentials = source.indexOf('credentials = await readTmdbCredential(');
  assert.ok(fence > source.indexOf('const usedPaths = [') && credentials > fence,
    'Reject dirty executable dependencies before reading credentials or starting the control.');
});

test('all seven operators and pinned comparison loaders load no current demo or test modules', () => {
  const operators = ['cascade-comparison', 'control-diagnostic', 'director-person-diagnostic', 'fockers-control', 'practical-series', 'predicted-controls', 'url-diagnostics']
    .map(name => new URL(`../scripts/m4-${name}.mjs`, import.meta.url).href);
  const cascade = new URL('../scripts/m4-cascade-comparison.mjs', import.meta.url).href;
  const predicted = new URL('../scripts/m4-predicted-controls.mjs', import.meta.url).href;
  const script = `import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (resolved.url.startsWith('file:') && new URL(resolved.url).pathname.toLowerCase().split('/').some(part => part === 'research' || part === 'test')) throw Error('current-demo-or-test-dependency');
      return resolved;
    } });
    for (const operator of ${JSON.stringify(operators)}) await import(operator);
    const cascade = await import(${JSON.stringify(cascade)});
    for (const sha of [cascade.CASCADE_BASELINE_SHA, '21d1be24acf2b654254c38c9b252246ed8de1343']) {
      if (typeof await cascade.loadCascadeBaseline(sha) !== 'function') throw Error('missing-pinned-cascade');
    }
    const predicted = await import(${JSON.stringify(predicted)});
    if (typeof await predicted.loadPredictedControlBaseline() !== 'function') throw Error('missing-pinned-resolver');
    process.stdout.write('pinned-loaders-without-current-demo');`;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script],
    { encoding: 'utf8', windowsHide: true, timeout: 15000 }), 'pinned-loaders-without-current-demo');
});

test('pinned card callbacks make the former demo extractor exactly delegate to runtime extraction', async () => {
  const root = new URL('../', import.meta.url), sourcePath = 'research/grounded-answer-demo/html-source.mjs';
  // The last reviewed thin wrapper is historical test evidence only. Never
  // import a retired demo or reconstruct a missing body with current code.
  const demo = execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git',
    ['show', `f534dacba1b7377637fe4f00bf995e8145adcc8f:${sourcePath}`],
    { cwd: fileURLToPath(root), encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const wrapper = demo.match(/export function extractHtml\(html, film, options = \{\}\) \{([\s\S]*?)\r?\n\}/);
  assert.ok(wrapper, 'The explicit-callback delegation must remain inspectable.');
  const delegate = new Function('extractRuntimeHtml', 'identity', `return function(html, film, options = {}) {${wrapper[1]}}`)(extractHtml,
    () => assert.fail('An explicit historical callback must not execute the demo default gate.'));
  const html = markup(), context = { id: 'not-in-the-fixed-demo-catalogue' };
  for (const status of ['matched', 'unresolved', 'mismatch']) {
    for (const asynchronous of [false, true]) {
      let calls = 0;
      const identity = all => { calls++; assert.ok(Array.isArray(all) && all.length > 0); return { status, reason: 'authored-explicit-gate' }; };
      const identityCheck = asynchronous ? async all => identity(all) : identity;
      const expected = await extractHtml(html, context, { identityCheck });
      const observed = await delegate(html, context, { identityCheck });
      assert.deepEqual(observed, expected);
      assert.equal(calls, 2, 'Each path invokes the same explicit callback once.');
    }
  }
  for (const sha of ['5a9c3c38f892644d04988d9055e3463fc6b9b86b', '21d1be24acf2b654254c38c9b252246ed8de1343', PREDICTED_CONTROL_BASELINE]) {
    const pinned = execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git',
      ['show', `${sha}:research/grounded-answer-demo/assisted-kinobaza.mjs`],
      { cwd: fileURLToPath(root), encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','ignore'] });
    assert.equal([...pinned.matchAll(/\bextractHtml\s*\(\s*html\s*,\s*film\s*,/g)].length, 1, `${sha}: one bounded extraction path`);
    assert.match(pinned, /\bextractHtml\s*\(\s*html\s*,\s*film\s*,\s*\{\s*identityCheck:/,
      `${sha}: the pinned extraction path supplies its original independent identity gate`);
  }
});

test('bounded frozen manifest discards source prose and accepts only clean observed admitted card URLs', () => {
  const input = saved(); input.cases[0].secret = 'SOURCE_BODY_DO_NOT_COPY';
  const manifest = predictedControlManifest(input);
  assert.equal(manifest.length, 1); assert.deepEqual(manifest[0].searches[0].urls, [card]);
  assert.doesNotMatch(JSON.stringify(manifest), /SOURCE_BODY|secret/);
  for (const change of [
    s => { s.cases = Array(37).fill(s.cases[0]); }, s => { s.cases.push(s.cases[0]); },
    s => { s.cases[0].requested.imdbId = '../secret'; }, s => { s.cases[0].searchWireTraces[0].candidates[0].safeAdmittedURL = card + '?key=PRIVATE'; },
    s => { s.cases[0].searchWireTraces.push(s.cases[0].searchWireTraces[0]); },
  ]) { const invalid = saved(); change(invalid); assert.throws(() => predictedControlManifest(invalid)); }
});

test('frozen provider matches exact query AND mode; absent observations are unknown, not successful empty searches', async () => {
  const observations = [], traces = predictedControlManifest(saved())[0].searches, sends = [];
  const provider = frozenSearchFactory(traces, observations)('not-a-key', async (url, init) => { sends.push({ url, init }); return new Response('{}'); });
  const known = await provider.search(traces[0].query);
  assert.equal(known.status, 'ok'); assert.deepEqual(known.urls, [card]);
  const changed = await provider.search(traces[0].query, { exactMatch: true, searchDepth: 'advanced' });
  assert.equal(changed.status, 'search-invalid-response'); assert.equal(observations[1].urls, null);
  const otherQuery = await provider.search(traces[0].query + ' extra');
  assert.equal(otherQuery.status, 'search-invalid-response'); assert.equal(sends.length, 3);
  assert.ok(sends.every(send => send.url === 'https://api.tavily.com/search' && send.init.method === 'POST'));
});

test('control source transport never sends Tavily HTTP or permits unsafe movie/platform/source-search addresses', async () => {
  let live = 0; const broker = createControlTransport(key, async () => { live++; return new Response('ok'); });
  try {
    const state = freshState(), send = broker.forFilm(state, context());
    await send('https://api.tavily.com/search', { method: 'POST', redirect: 'manual', credentials: 'omit' });
    assert.equal(live, 0); assert.equal(state.frozenSearchTransports, 1);
    for (const url of [card + '?secret=PRIVATE', 'https://kinobazaua.com/search?q=x', 'https://www.netflix.com/title/1',
      'https://api.themoviedb.org/3/person/999?language=en-US', 'https://kinobazaua.com/titles/not-observed']) await assert.rejects(send(url, get()));
    await assert.rejects(send(card, { ...get(), headers: { authorization: 'Bearer ' + key } }));
    assert.equal(live, 0);
  } finally { broker.dispose(); }
});

test('current response cache reuses identical bytes, records digests not bodies, and never repeats uncertain outcomes', async () => {
  let live = 0; const broker = createControlTransport(key, async () => { live++; return new Response('SENSITIVE_SOURCE_HTML', { headers: { 'content-type': 'text/html' } }); });
  try {
    const state = freshState(), send = broker.forFilm(state, context());
    assert.equal(await (await send(card, get())).text(), 'SENSITIVE_SOURCE_HTML');
    assert.equal(await (await send(card, get())).text(), 'SENSITIVE_SOURCE_HTML');
    assert.equal(live, 1); assert.equal(state.actual.total, 1); assert.equal(state.ramReuses, 1);
    assert.match(state.requests[0].bodySHA256, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(state), /SENSITIVE_SOURCE_HTML|AUTHORED-TMDB-KEY/);
  } finally { broker.dispose(); }
  const failed = createControlTransport(key, async () => { live++; throw Error('PRIVATE ' + key); });
  try {
    const state = freshState(), send = failed.forFilm(state, context()), before = live;
    await assert.rejects(send(card, get())); await assert.rejects(send(card, get()));
    assert.equal(live - before, 1); assert.equal(state.actual.total, 1); assert.equal(state.requests[0].outcome, 'unavailable-no-repeat');
    assert.doesNotMatch(JSON.stringify(state), /PRIVATE|AUTHORED-TMDB-KEY/);
  } finally { failed.dispose(); }
});

test('key echo in source response is withheld without writing it to safe observations', async () => {
  const broker = createControlTransport(key, async () => Response.json({ accidental: key }));
  try {
    const state = freshState(), send = broker.forFilm(state, context());
    await assert.rejects(send(card, get())); assert.equal(broker.stopped, true);
    assert.doesNotMatch(JSON.stringify(state), /AUTHORED-TMDB-KEY|accidental/);
  } finally { broker.dispose(); }
});

test('link descriptors omit all query and fragment values', () => {
  const descriptor = safeControlURL('https://click.justwatch.com/a?token=PRIVATE_VALUE&r=PRIVATE_TARGET#PRIVATE_FRAGMENT');
  assert.deepEqual(descriptor.parameterNames, ['token', 'r']); assert.equal(descriptor.path, '/a');
  assert.doesNotMatch(JSON.stringify(descriptor), /PRIVATE/);
});

const details = () => ({ id: film.tmdbId, imdb_id: film.imdbId, title: film.identityTitle, original_title: film.originalTitle, release_date: '2004-12-01',
  external_ids: { imdb_id: film.imdbId }, alternative_titles: { titles: [] }, translations: { translations: [] }, release_dates: { results: [] },
  credits: { crew: [{ id: film.directorPeople[0].personId, job: 'Director', name: 'Authored director', original_name: 'Authored director' }] } });
function authoredFetch({ found = [film.tmdbId], director = 'Authored director', semantic = false, external = [] } = {}) {
  return async (url, init) => {
    external.push(url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
    assert.notEqual(url, 'https://api.tavily.com/search'); assert.doesNotMatch(url, /\/search|api_key|AUTHORED-TMDB/);
    if (url.includes('/find/')) return Response.json({ movie_results: found.map(id => ({ id })) });
    if (url.includes('/movie/990001?')) return Response.json(details());
    assert.ok([card, wrong].includes(url));
    let html = markup({ url, title: url === card ? film.identityTitle : 'Another Authored Film', original: url === card ? film.originalTitle : 'Another Original', year: 2004, director });
    if (semantic && url === card) html = html.replace('</head>', '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Movie', url: card, name: film.identityTitle,
      sameAs: ['https://www.imdb.com/title/' + film.imdbId + '/'] }) + '</script></head>');
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  };
}

const oldResolver = await loadPredictedControlBaseline();

test('pinned old runtime and current runtime share full fresh metadata/current HTML, account four baseline slots, and do not call paid search', async () => {
  assert.equal(PREDICTED_CONTROL_BASELINE, '7a9754d6431426a86ea9c3843a11c97f28210c4c');
  const external = [], manifest = predictedControlManifest(saved());
  const result = await runPredictedControlSeries({ tmdbToken: key, manifest, baselineCreateResolver: oldResolver, fetchImpl: authoredFetch({ external }) });
  assert.equal(result.casesCompleted, 1); assert.equal(result.actualHTTP.tmdb, 2); assert.equal(result.actualHTTP.cards, 1);
  assert.equal(result.actualHTTP.total, 3); assert.equal(result.actualHTTP.tavily, 0); assert.equal(result.tavilyCreditsNew, 0);
  assert.deepEqual(result.cases[0].before.confirmed, [card]); assert.deepEqual(result.cases[0].after.confirmed, [card]);
  assert.equal(result.cases[0].comparison.complete, true); assert.deepEqual(result.cases[0].comparison.lostConfirmed, []);
  assert.equal(result.cases[0].before.logicalCalls.slice(0, 4).map(call => call.stage).join(','), 'tmdb-find,tmdb-details,tmdb-providers,motn-title');
  assert.ok(result.cases[0].ramReuses > 0); assert.ok(result.cases[0].before.projection.rows > 0);
  assert.doesNotMatch(JSON.stringify(result), /AUTHORED-TMDB-KEY|Авторський переклад.*Bearer|<html>|at=AUTHOR/);
});

test('sameAs addition is evaluated against genuinely old gate code, not accidentally imported current assistedIdentity', async () => {
  const second = resolverQueries({ ...film, identityContext: { tmdbId: film.tmdbId, titleEvidence: [] } })[1];
  const searches = [trace(), trace(second, []), trace(resolverReserveQuery(film), [], { exactMatch: true, searchDepth: 'advanced' })];
  const result = await runPredictedControlSeries({ tmdbToken: key, manifest: predictedControlManifest(saved(searches)), baselineCreateResolver: oldResolver,
    fetchImpl: authoredFetch({ director: 'Unestablished Alias', semantic: true }) });
  assert.deepEqual(result.cases[0].before.confirmed, []); assert.deepEqual(result.cases[0].after.confirmed, [card]);
  assert.equal(result.cases[0].after.readCards[0].diagnostics.strategy, 'stable-id-title-year');
});

test('new predicted fallback reads only its runtime-generated pointer and preserves failure of historical wrong candidates', async () => {
  const second = resolverQueries({ ...film, identityContext: { tmdbId: film.tmdbId, titleEvidence: [] } })[1];
  const searches = [trace(resolverQueries(film)[0], [wrong]), trace(second, []), trace(resolverReserveQuery(film), [], { exactMatch: true, searchDepth: 'advanced' })];
  const result = await runPredictedControlSeries({ tmdbToken: key, manifest: predictedControlManifest(saved(searches)), baselineCreateResolver: oldResolver, fetchImpl: authoredFetch() });
  assert.deepEqual(result.cases[0].before.confirmed, []); assert.deepEqual(result.cases[0].after.confirmed, [card]);
  assert.equal(result.cases[0].after.predicted.status, 'matched'); assert.equal(result.actualHTTP.cards, 2);
});

test('unknown historical query remains an explicit comparison gap, not an invented empty Tavily result', async () => {
  const result = await runPredictedControlSeries({ tmdbToken: key, manifest: predictedControlManifest(saved([])), baselineCreateResolver: oldResolver, fetchImpl: authoredFetch() });
  assert.equal(result.cases[0].comparison.complete, false);
  assert.equal(result.cases[0].before.searches[0].state, 'unknown-query-or-mode-not-recorded');
  assert.equal(result.cases[0].before.searches[0].urls, null); assert.equal(result.actualHTTP.cards, 0);
});

test('ambiguous fresh TMDb find produces no card or person requests', async () => {
  const result = await runPredictedControlSeries({ tmdbToken: key, manifest: predictedControlManifest(saved()), baselineCreateResolver: oldResolver,
    fetchImpl: authoredFetch({ found: [990001, 990003] }) });
  assert.equal(result.cases[0].status, 'current-control-unresolved-no-repeat'); assert.equal(result.actualHTTP.total, 1); assert.equal(result.actualHTTP.cards, 0);
});
