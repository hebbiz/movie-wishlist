// Explicit local research only. Frozen admitted Tavily pointers + fresh TMDb
// metadata/current HTML. No paid search, DB, platform visit or runtime session.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readTmdbCredential } from './m4-control-credentials.mjs';
import { readTmdbJson, projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { projectDirectorPeople } from '../shared/director-alias-crosswalk.mjs';
import { projectFilmIdentityContext } from '../shared/film-identity-context.mjs';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { admitKinobazaURL } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { admitDirectorProfileURL } from '../netlify/lib/director-profile.mjs';
import { predictedKinobazaURL } from '../netlify/lib/kinobaza-predicted-url.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';

export const PREDICTED_CONTROL_BASELINE = '7a9754d6431426a86ea9c3843a11c97f28210c4c';
const ROOT = new URL('../', import.meta.url);
const API = 'https://api.themoviedb.org/3', SEARCH = 'https://api.tavily.com/search';
const APPEND = 'external_ids,alternative_titles,credits,release_dates,translations';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 550 && !/[\p{C}<>]/u.test(value) ? value : null;
const keyOK = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\s\p{C}]/u.test(value);
const code = value => typeof value === 'string' && /^[a-z0-9-]{1,120}$/.test(value) ? value : 'unknown';
const reported = field => field?.state === 'reported' ? field.value : null;
const git = (...args) => execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git', args,
  { cwd: fileURLToPath(ROOT), encoding: 'utf8', maxBuffer: 512 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();

// Input is a hash-pinned, already sanitized local study, not an executable
// manifest or list of destinations to probe independently of the resolver.
export function predictedControlManifest(saved) {
  if (!saved || !Array.isArray(saved.cases) || saved.cases.length < 1 || saved.cases.length > 36) throw Error('invalid-study-manifest');
  const seen = new Set();
  return saved.cases.map(item => {
    const requested = item?.requested;
    if (!requested || !/^tt\d{7,10}$/.test(requested.imdbId ?? '') || seen.has(requested.imdbId) || !text(requested.title) ||
        !Number.isInteger(requested.year) || requested.year < 1000 || requested.year > 9999 ||
        item.baseline?.film?.imdbId !== requested.imdbId) throw Error('invalid-study-film');
    seen.add(requested.imdbId);
    const traces = item.searchWireTraces;
    if (!Array.isArray(traces) || traces.length > 3) throw Error('invalid-frozen-traces');
    const searches = traces.map(trace => {
      if (!text(trace?.query) || typeof trace.exactMatch !== 'boolean' || !['basic', 'advanced'].includes(trace.searchDepth) ||
          !Array.isArray(trace.candidates) || trace.candidates.length > 5) throw Error('invalid-frozen-search');
      const urls = trace.candidates.filter(candidate => candidate?.admitted === true).map(candidate => candidate.safeAdmittedURL);
      if (urls.some(url => !admitKinobazaURL(url))) throw Error('invalid-frozen-pointer');
      return { query: trace.query, exactMatch: trace.exactMatch, searchDepth: trace.searchDepth, urls,
        requestId: typeof trace.requestId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(trace.requestId) ? trace.requestId : null };
    });
    if (new Set(searches.map(search => JSON.stringify([search.query, search.exactMatch, search.searchDepth]))).size !== searches.length) throw Error('ambiguous-frozen-search');
    return { requested: { title: requested.title, year: requested.year, imdbId: requested.imdbId }, searches,
      prior: { status: code(item.baseline?.resolver?.status ?? item.baseline?.status),
        confirmed: (item.baseline?.readCards ?? []).filter(card => card.identity === 'matched').map(card => card.url).filter(admitKinobazaURL) } };
  });
}

// Compare candidate-only historical observations, not reconstructed Tavily
// response bodies. Query/mode changes are unknown, NEVER an invented empty hit.
export function frozenSearchFactory(traces, observations) {
  return (_unusedKey, send) => ({
    accepts: (url, init) => url === SEARCH && init?.method === 'POST' && init.redirect === 'manual' && init.credentials === 'omit',
    async search(query, { signal, exactMatch = false, searchDepth = 'basic' } = {}) {
      const trace = traces.find(item => item.query === query && item.exactMatch === exactMatch && item.searchDepth === searchDepth);
      observations.push({ query: text(query), exactMatch, searchDepth, requestId: trace?.requestId ?? null,
        state: trace ? 'frozen-admitted-pointers-only' : 'unknown-query-or-mode-not-recorded', urls: trace?.urls ?? null });
      // Exercise the resolver's ordinary logical search reservation/call path;
      // transport intercepts this fixed endpoint and cannot make a real POST.
      await send(SEARCH, { method: 'POST', redirect: 'manual', credentials: 'omit', signal,
        headers: { Accept: 'application/json' }, body: JSON.stringify({ query, exact_match: exactMatch, search_depth: searchDepth }) });
      if (!trace) return { status: 'search-invalid-response', urls: [] };
      const urls = [...new Set(trace.urls)];
      return { status: 'ok', urls, diagnostics: { returned: urls.length, admitted: urls.length, rejected: 0, duplicates: 0, rejectionCategories: {} },
        correlation: { query, requestId: trace.requestId, responseQuery: null } };
    },
  });
}

// Three specifically pinned executable modules; no ref/path from the report is
// executable. Remaining ordinary dependencies resolve to the working checkout.
export async function loadPredictedControlBaseline() {
  const paths = ['research/grounded-answer-demo/assisted-kinobaza.mjs', 'netlify/lib/kinobaza-director-verifier.mjs', 'netlify/lib/kinobaza-resolver.mjs'];
  const loaded = new Map();
  for (const path of paths) {
    const base = new URL(path, ROOT), original = git('show', `${PREDICTED_CONTROL_BASELINE}:${path}`);
    const source = original.replace(/from '([^']+)'/g, (whole, imported) => {
      if (!imported.startsWith('.')) return whole;
      const absolute = new URL(imported, base), relative = fileURLToPath(absolute).slice(fileURLToPath(ROOT).length).replaceAll('\\', '/');
      return `from '${loaded.get(relative) ?? absolute.href}'`;
    });
    loaded.set(path, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return (await import(loaded.get(paths[2]))).createKinobazaResolver;
}

export function safeControlURL(value) {
  if (typeof value !== 'string' || value.length > 16384 || /[\p{C}]/u.test(value)) return null;
  try {
    const url = new URL(value), names = [...new Set(url.searchParams.keys())];
    return { domain: url.hostname, path: url.pathname.slice(0, 512), parameterNames: names.filter(name => /^[a-zA-Z0-9_.-]{1,64}$/.test(name)).slice(0, 32),
      parameterNamesOmitted: names.some(name => !/^[a-zA-Z0-9_.-]{1,64}$/.test(name)) || names.length > 32,
      queryPresent: Boolean(url.search), fragmentPresent: Boolean(url.hash) };
  } catch { return null; }
}

function routeProjection(film, resolved) {
  const discovery = composeDiscovery(film, { tmdb: { result: null }, motn: { result: null }, kinobaza: resolved });
  return { rows: discovery.rows.length, groups: presentMediaGroups(discovery.rows, { filmId: film.id }).map(group => ({
    provider: group.group.key, availability: group.comparison.availability.symbol, audio: group.comparison.audio.symbol, subtitles: group.comparison.subtitles.symbol })),
    links: discovery.rows.map(row => ({ provider: row.provider.key, kind: code(row.link?.kind), transferable: row.link?.transferable === true,
      hasURL: typeof row.link?.href === 'string', address: safeControlURL(row.link?.href) })) };
}

function projectFilm(data, tmdbId, imdbId) {
  const projection = projectTmdbIdentityFor(data, { tmdbId, imdbId });
  if (projection.identity.status !== 'matched') return null;
  const metadata = projection.metadata, release = reported(metadata.releaseDate), directors = metadata.directors.items ?? [];
  const identityContext = projectFilmIdentityContext(projection);
  return { id: `imdb:${imdbId}`, imdbId, tmdbId, title: reported(metadata.requestedTitle), identityTitle: reported(metadata.requestedTitle),
    originalTitle: reported(metadata.originalTitle), year: /^\d{4}-\d{2}-\d{2}$/.test(release ?? '') ? Number(release.slice(0, 4)) : null,
    directorCount: metadata.directors.state === 'reported' ? directors.length : null, directorPeople: projectDirectorPeople(metadata.directors),
    directorAliases: directors.flatMap(director => [reported(director.name), reported(director.originalName)]).filter(Boolean), identityContext,
    titleAliases: [...new Set([reported(metadata.requestedTitle), reported(metadata.originalTitle), ...(identityContext?.titleEvidence ?? []).map(item => item.title)].filter(Boolean))] };
}

const counts = () => ({ tmdb: 0, cards: 0, tmdbPerson: 0, kinobazaPerson: 0, total: 0 });
async function waitForSignal(promise, signal) {
  if (signal.aborted) throw Error('control-source-deadline');
  let onAbort;
  try { return await Promise.race([promise, new Promise((_, reject) => { onAbort = () => reject(Error('control-source-deadline')); signal.addEventListener('abort', onAbort, { once: true }); })]); }
  finally { signal.removeEventListener('abort', onAbort); }
}
const copyResponse = snapshot => {
  if (snapshot.failed) throw Error('cached-unknown-outcome-no-repeat');
  return new Response([204, 205, 304].includes(snapshot.status) ? null : Buffer.from(snapshot.bytes), { status: snapshot.status, headers: snapshot.headers });
};

// Exported for offline authored tests; no credentials or raw bytes enter report.
export function createControlTransport(tmdbToken, fetchImpl = fetch) {
  if (!keyOK(tmdbToken)) throw Error('invalid-local-key');
  const cache = new Map(), actual = counts(); let cacheBytes = 0, stopped = false;
  return {
    actual, get stopped() { return stopped; },
    dispose() { for (const snapshot of cache.values()) snapshot.bytes?.fill(0); cache.clear(); cacheBytes = 0; },
    forFilm(state, context) {
      return async (url, init) => {
        if (url === SEARCH && init.method === 'POST' && init.redirect === 'manual' && init.credentials === 'omit') {
          state.frozenSearchTransports++; return new Response('{}', { headers: { 'content-type': 'application/json' } });
        }
        const personURL = context.film?.directorCount === 1 && context.film.directorPeople?.length === 1 ? `${API}/person/${context.film.directorPeople[0].personId}?language=en-US&append_to_response=external_ids` : null;
        const type = url === context.findURL || url === context.detailsURL ? 'tmdb' : url === personURL ? 'tmdbPerson' :
          admitKinobazaURL(url) && context.allowedCards.has(url) ? 'cards' : admitDirectorProfileURL(url) ? 'kinobazaPerson' : null;
        const headers = new Headers(init.headers);
        if (!type || init.method !== 'GET' || init.redirect !== 'manual' || init.credentials !== 'omit' || init.signal?.aborted ||
            String(url).includes(tmdbToken) || init.body || headers.has('cookie') ||
            (type === 'tmdb' || type === 'tmdbPerson' ? headers.get('authorization') !== `Bearer ${tmdbToken}` : headers.has('authorization'))) throw Error('control-source-boundary');
        const request = { type, address: safeControlURL(url), ...(admitKinobazaURL(url) || admitDirectorProfileURL(url) ? { url } : {}) };
        const existing = cache.get(url);
        if (existing) { state.ramReuses++; state.requests.push({ ...request, cache: 'same-response-ram-reuse', httpStatus: existing.status ?? null, bodySHA256: existing.digest ?? null }); return copyResponse(existing); }
        const maxByType = { tmdb: 2, cards: 7, tmdbPerson: 1, kinobazaPerson: 3 };
        if (stopped || actual.total >= 36 * 14 || state.actual.total >= 14 || state.actual[type] >= maxByType[type] || cacheBytes >= 128 * 1024 * 1024) throw Error('control-actual-http-limit');
        state.actual[type]++; state.actual.total++; actual[type]++; actual.total++;
        const observation = { ...request, cache: 'new-current-http', outcome: 'dispatched' }; state.requests.push(observation);
        // Mark before dispatch: uncertain responses are cached failures, never
        // repeated by the other route or another film in this local series.
        const snapshot = { failed: true }; cache.set(url, snapshot);
        const started = performance.now(), signal = AbortSignal.any([AbortSignal.timeout(15_000), init.signal].filter(Boolean));
        let reader;
        try {
          const response = await waitForSignal(fetchImpl(url, { ...init, signal }), signal); observation.httpStatus = response.status;
          if ([401, 403, 429].includes(response.status) || response.status >= 500) stopped = true;
          if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) throw Error('control-body-limit');
          reader = response.body?.getReader(); const chunks = []; let size = 0;
          try {
            if (reader) for (;;) { const part = await waitForSignal(reader.read(), signal); if (part.done) break; size += part.value.byteLength; if (size > 2 * 1024 * 1024) throw Error('control-body-limit'); chunks.push(Buffer.from(part.value)); }
            const body = Buffer.concat(chunks, size);
            if (body.includes(Buffer.from(tmdbToken))) { body.fill(0); stopped = true; throw Error('unsafe-response-withheld'); }
            if ((type === 'cards' || type === 'kinobazaPerson') && /captcha|cf-chl-|challenge-platform/i.test(body.toString('utf8'))) { body.fill(0); stopped = true; throw Error('source-challenge-stop'); }
            if (cacheBytes + size > 128 * 1024 * 1024) { body.fill(0); stopped = true; throw Error('control-memory-limit'); }
            Object.assign(snapshot, { failed: false, status: response.status, headers: Object.fromEntries(['content-type', 'content-length'].map(name => [name, response.headers.get(name)]).filter(([, value]) => value !== null)), bytes: body, digest: sha256(body) });
            cacheBytes += size; observation.bodySHA256 = snapshot.digest; observation.bytes = size; observation.outcome = 'response-received';
          } finally { for (const chunk of chunks) chunk.fill(0); }
          return copyResponse(snapshot);
        } catch { observation.outcome = 'unavailable-no-repeat'; throw Error('current-source-unavailable-no-repeat'); }
        finally { observation.elapsedMs = Math.round(performance.now() - started); if (reader) void reader.cancel().catch(() => {}); }
      };
    },
  };
}

async function runRoute(createResolver, cap, film, manifest, transport, metadataMs) {
  const observations = [], reads = [], reservations = [], calls = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title'].map(stage => ({ stage, status: 'baseline-slot-accounted-source-omitted-or-shared' }));
  const signal = AbortSignal.timeout(Math.max(1, 45_000 - metadataMs)), started = performance.now();
  const reserve = async stage => {
    const admitted = cap === 12 ? /^(?:search-[123]|kinobaza-[123]|tmdb-person|kinobaza-person)$/ : /^(?:search-[123]|kinobaza-[123]|tmdb-person|kinobaza-person|kinobaza-predicted|kinobaza-person-predicted)$/;
    if (signal.aborted || !admitted.test(stage) || reservations.includes(stage) || calls.length >= cap) throw Error('control-logical-reservation-boundary');
    reservations.push(stage);
  };
  const fetchImpl = async (url, init) => { if (admitKinobazaURL(url)) reads.push(url); return transport(url, init); };
  try {
    const resolved = await createResolver({ apiKey: 'frozen-admitted-pointer-replay-no-real-key', searchFactory: frozenSearchFactory(manifest.searches, observations) })(film,
      { reserve, fetchImpl, calls, signal, sourceCap: cap, tmdbToken: transport.tmdbToken, diagnostics: true });
    const unknown = observations.some(observation => observation.state.startsWith('unknown'));
    return { cap, status: code(resolved.status), comparisonComplete: !unknown, scope: 'frozen-query-matched-admitted-pointers-current-HTML-not-live-Tavily',
      elapsedMs: Math.round(performance.now() - started), timingScope: 'local-parse-plus-cache-misses-not-independent-route-latency',
      logicalCalls: calls.map(call => ({ stage: code(call.stage), status: code(call.status), httpStatus: call.httpStatus ?? null })), reservations,
      searches: observations, readCards: reads.map((url, index) => ({ url, ...resolved.resolver.cards[index] })),
      confirmed: resolved.resolver.cards.flatMap((card, index) => card.identity === 'matched' && reads[index] ? [reads[index]] : []),
      predicted: resolved.resolver.predicted ?? null, directorProfile: resolved.resolver.directorProfile,
      projection: routeProjection(film, resolved) };
  } catch { return { cap, status: signal.aborted ? 'control-route-deadline' : 'control-route-unavailable-no-repeat', comparisonComplete: false, searches: observations, readCards: reads.map(url => ({ url })), reservations, confirmed: [] }; }
}

export async function runPredictedControlSeries({ tmdbToken, manifest, baselineCreateResolver, currentCreateResolver = createKinobazaResolver, fetchImpl = fetch, onCase } = {}) {
  if (!keyOK(tmdbToken) || !Array.isArray(manifest) || manifest.length < 1 || manifest.length > 36 || typeof baselineCreateResolver !== 'function') throw Error('invalid-control-series');
  const broker = createControlTransport(tmdbToken, fetchImpl), cases = [];
  try {
    for (const item of manifest) {
      const state = { requested: item.requested, actual: counts(), requests: [], ramReuses: 0, frozenSearchTransports: 0, status: 'started-current-control' };
      const context = { findURL: `${API}/find/${item.requested.imdbId}?external_source=imdb_id&language=uk-UA`, detailsURL: null, film: null, allowedCards: new Set(item.searches.flatMap(search => search.urls)) };
      const transport = broker.forFilm(state, context); transport.tmdbToken = tmdbToken;
      const metadataStart = performance.now();
      try {
        const signal = AbortSignal.timeout(45_000), found = await readTmdbJson(context.findURL, tmdbToken, transport, { signal });
        const candidates = found.data?.movie_results;
        if (found.status !== 'ok' || !Array.isArray(candidates) || candidates.length !== 1 || !Number.isSafeInteger(candidates[0]?.id) || candidates[0].id < 1) throw Error('fresh-find-unresolved');
        const tmdbId = candidates[0].id; context.detailsURL = `${API}/movie/${tmdbId}?language=uk-UA&append_to_response=${APPEND}`;
        const details = await readTmdbJson(context.detailsURL, tmdbToken, transport, { signal });
        const film = details.status === 'ok' ? projectFilm(details.data, tmdbId, item.requested.imdbId) : null;
        if (!film || !text(film.originalTitle) || !Number.isInteger(film.year)) throw Error('fresh-identity-unresolved');
        context.film = film; const prediction = predictedKinobazaURL(film.originalTitle); if (prediction) context.allowedCards.add(prediction);
        const metadataMs = Math.round(performance.now() - metadataStart);
        state.film = { imdbId: film.imdbId, tmdbId, title: film.identityTitle, originalTitle: film.originalTitle, year: film.year,
          requestedYear: item.requested.year, directorCount: film.directorCount, directorPeople: film.directorPeople,
          titleAliasCount: film.titleAliases.length, releaseEvidenceCount: film.identityContext.releaseEvidence?.length ?? 0 };
        state.metadataMs = metadataMs; state.prior = item.prior;
        state.before = await runRoute(baselineCreateResolver, 12, film, item, transport, metadataMs);
        state.after = await runRoute(currentCreateResolver, 14, film, item, transport, metadataMs);
        state.comparison = { complete: state.before.comparisonComplete && state.after.comparisonComplete,
          newConfirmed: state.after.confirmed.filter(url => !state.before.confirmed.includes(url)),
          lostConfirmed: state.before.confirmed.filter(url => !state.after.confirmed.includes(url)),
          sameCurrentBytesForSharedURLs: true, groundTruthIndependent: false,
          sourceClaimsNotPlatformEntitlement: true };
        state.status = 'completed-current-metadata-html-frozen-search-control';
      } catch { state.status = 'current-control-unresolved-no-repeat'; }
      cases.push(state); if (typeof onCase === 'function') await onCase(state, broker.actual);
      if (broker.stopped) break;
    }
    return { execution: 'local-diagnostic', historicalReconstruction: false, status: broker.stopped ? 'stopped-source-boundary-no-repeat' : 'completed-one-pass-current-controls',
      baselineSHA: PREDICTED_CONTROL_BASELINE, ledgerAttested: false, frozenSearchScope: 'admitted-URL-observations-only-not-complete-response-reconstruction',
      actualHTTP: { ...broker.actual, tavily: 0 }, tavilyCreditsNew: 0, casesCompleted: cases.length, cases,
      sourceDeadlineMs: 45_000, perCaseActualSafetyCap: 14,
      omittedSourceRequests: ['tmdb-providers', 'motn-title'], timingLimitation: 'Shared RAM responses and historical admitted pointers do not measure independent live Tavily or end-to-end route time.' };
  } finally { broker.dispose(); }
}

function argumentsFor(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index], value = argv[index + 1];
    if (!['--input', '--input-sha256', '--expected-commit', '--output'].includes(name) || !value || options[name]) throw Error('invalid-control-arguments');
    options[name] = value;
  }
  if (Object.keys(options).length !== 4 || !/^[a-f0-9]{64}$/.test(options['--input-sha256']) || !/^[a-f0-9]{40}$/.test(options['--expected-commit']) ||
      !options['--output'].endsWith('.json') || resolve(options['--input']) === resolve(options['--output'])) throw Error('invalid-control-arguments');
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let credentials, checkpoint, output;
  try {
    const options = argumentsFor(process.argv.slice(2));
    if (git('rev-parse', 'HEAD') !== options['--expected-commit']) throw Error('reviewed-commit-mismatch');
    // The compared runtime is pinned to the reviewed commit, not just a HEAD
    // label above uncommitted code. Parallel docs/SQL work is not executed here.
    const usedPaths = ['netlify/lib/kinobaza-resolver.mjs', 'netlify/lib/kinobaza-director-verifier.mjs',
      'netlify/lib/kinobaza-predicted-url.mjs', 'netlify/lib/director-candidate-selection.mjs',
      'netlify/lib/director-profile.mjs', 'shared', 'research/grounded-answer-demo',
      'assets/media-advice-presentation.mjs', 'scripts/m4-predicted-controls.mjs', 'scripts/m4-control-credentials.mjs'];
    if (git('status', '--porcelain', '--untracked-files=all', '--', ...usedPaths)) throw Error('reviewed-source-dirty');
    const bytes = await readFile(options['--input']);
    if (bytes.length > 16 * 1024 * 1024 || sha256(bytes) !== options['--input-sha256']) throw Error('frozen-input-mismatch');
    const manifest = predictedControlManifest(JSON.parse(bytes.toString('utf8'))), baselineCreateResolver = await loadPredictedControlBaseline();
    output = options['--output'];
    checkpoint = { execution: 'local-diagnostic', historicalReconstruction: false, runId: randomUUID(), reviewedHEAD: options['--expected-commit'],
      baselineSHA: PREDICTED_CONTROL_BASELINE, inputSHA256: options['--input-sha256'], casesExpected: manifest.length, startedAt: new Date().toISOString(),
      status: 'fenced-before-credentials-and-http-do-not-rerun', actualHTTP: { ...counts(), tavily: 0 }, cases: [] };
    await writeFile(output, JSON.stringify(checkpoint, null, 2), { flag: 'wx', mode: 0o600 });
    credentials = await readTmdbCredential(process.stdin);
    const save = async value => {
      const serialized = JSON.stringify(value, null, 2);
      if (serialized.includes(credentials.tmdbToken) || serialized.length > 8 * 1024 * 1024) throw Error('unsafe-control-report-withheld');
      await writeFile(output, serialized, { mode: 0o600 });
    };
    const result = await runPredictedControlSeries({ tmdbToken: credentials.tmdbToken, manifest, baselineCreateResolver,
      onCase: async (item, actual) => { checkpoint.cases.push(item); checkpoint.actualHTTP = { ...actual, tavily: 0 }; checkpoint.status = 'series-in-progress-do-not-rerun'; await save(checkpoint);
        process.stdout.write(JSON.stringify({ case: checkpoint.cases.length, of: manifest.length, title: item.requested.title, status: item.status,
          before: item.before?.confirmed?.length ?? null, after: item.after?.confirmed?.length ?? null, actualHTTP: actual.total }) + '\n'); } });
    const final = { ...checkpoint, ...result, finishedAt: new Date().toISOString() }; await save(final);
    process.stdout.write(JSON.stringify({ status: final.status, casesCompleted: final.casesCompleted, actualHTTP: final.actualHTTP, tavilyCreditsNew: 0 }) + '\n');
  } catch {
    if (checkpoint && output) { checkpoint.status = 'control-incomplete-do-not-rerun-check-existing-report'; await writeFile(output, JSON.stringify(checkpoint, null, 2), { mode: 0o600 }).catch(() => {}); }
    process.stdout.write('{"status":"control-unavailable-do-not-rerun-check-existing-report"}\n'); process.exitCode = 1;
  } finally { if (credentials) credentials.tmdbToken = null; }
}
