// Isolated non-LLM composition. Source-scoped claims, no archive or destination fetch.
import { tmdbScenario, fetchTmdb, projectTmdbIdentity, projectTmdbProviders, syntheticTmdb } from './tmdb.mjs';
import { motnScenario, fetchMotn, normalizeMotn, syntheticMotn } from './motn.mjs';
import { htmlScenario, fetchHtmlCandidates, extractHtml, canonicalKinobazaURL, canonicalRedirectTarget } from './html-source.mjs';
import { syntheticHtml } from './synthetic.mjs';
import { HELD_OUT_FILMS, isHeldOut } from './held-out.mjs';

export const DISCOVERY_DEADLINE_MS = 65_000;
export const DISCOVERY_IDS = Object.freeze(['coherence', 'dune-part-two', ...Object.keys(HELD_OUT_FILMS)]);
export function discoveryScenario(film, { discovery, amazonRegion, urlSource, kinobaza = 'on' } = {}) {
  if (!DISCOVERY_IDS.includes(film.id) || discovery !== 'digital-ua' || amazonRegion !== undefined || urlSource !== undefined || !['on', 'off'].includes(kinobaza)) {
    throw new Error('ua-discovery requires digital-ua, a fixed catalogue film, DEMO_KINOBAZA=on|off, unset URL_SOURCE/AMAZON_REGION.');
  }
  const heldOut = isHeldOut(film.id);
  // The two Thing scenarios cannot enable Kinobaza, even under global "on".
  if (heldOut && !HELD_OUT_FILMS[film.id].kinobazaURL) kinobaza = 'off';
  const hop = !heldOut && kinobaza === 'on';
  return Object.freeze({ film, discovery, retrieval: 'ua-discovery', amazonRegion: null, sourceURL: null, prompt: null, kinobaza,
    country: 'UA', requestBudget: (kinobaza === 'on' ? 4 : 3) + Number(hop), baseRequestBudget: kinobaza === 'on' ? 4 : 3,
    ...(heldOut ? { heldOut: true, canonicalHop: false } : {}),
    operation: heldOut
      ? `Held-out fixed IDs: TMDb max2 GETs, independent MOTN max1; Kinobaza ${kinobaza === 'on' ? 'one direct canonical GET' : 'disabled for this scenario/configuration'}. No redirect follow, retries or fallback. Four held-out discoveries total max14 requests. A/B only, no offer/field merge, LLM, destinations or storage; memory-only draft.`
      : 'Fixed-ID TMDb (max 2 GETs), independent MOTN (1 GET), optional fixed Kinobaza (1 GET, plus at most one exact canonical host hop only after validated 301/308). Max4 without redirect, max5 only with canonical hop. No LLM, destination requests, retries or storage. Source identity gates remain independent; no cross-source offer merging. Local draft only, not production MW.' });
}

import { composeDiscovery as composeRuntimeDiscovery } from '../../netlify/lib/media-discovery-compose.mjs';
export { tmdbShapeDiagnostics, mapProvider, conflictingProviderIds, classifyLink } from '../../netlify/lib/media-discovery-compose.mjs';

// Preserve lazy fixed-scenario fallbacks only for retained demo callers.
export function composeDiscovery(film, stages, options = {}) {
  const sourceURLs = {
    get tmdb() { return options.sourceURLs?.tmdb ?? tmdbScenario(film, { discovery: 'digital-ua' }).providersURL; },
    get motn() { return options.sourceURLs?.motn ?? motnScenario(film, { discovery: 'digital-ua' }).sourceURL; },
    get kinobaza() { return htmlScenario(film, { discovery: 'digital-ua' }).sourceURL; },
    get kinobazaLocalization() { return { source: 'Kinobaza HTML', method: 'authored synthetic source blocks', sourceURL: sourceURLs.kinobaza, receivedAt: stages.kinobaza.receivedAt, upstream: 'not-established' }; },
  };
  return composeRuntimeDiscovery(film, stages, { ...options, sourceURLs });
}

export function authoredDiscoveryData(film) {
  const tmdb = syntheticTmdb(film.id), motn = syntheticMotn(film.id);
  tmdb.providers.results.UA = { rent: [{ provider_id: 2, provider_name: 'Apple TV Store' }], buy: [] };
  motn.streamingOptions.ua[0].service = { id: 'apple', name: 'Apple TV Store' };
  motn.streamingOptions.ua[0].link = 'https://tv.apple.com/ua/movie/synthetic/umc.cmc.syntheticonly';
  motn.streamingOptions.ua[1].service = { id: 'apple', name: 'Apple TV Store' };
  let html = syntheticHtml(film).replaceAll('Example UA', 'Apple TV Store').replace('https://example.com/redirect?x=%2F&amp;y=1', 'https://click.justwatch.com/a?synthetic=%2F&amp;x=1');
  return { tmdb, motn, html };
}

export async function runDiscovery(selection, { mode = 'synthetic', tmdbToken = '', motnKey = '', fetchImpl = globalThis.fetch,
  deadlineMs = DISCOVERY_DEADLINE_MS, signal } = {}) {
  const { film, kinobaza } = selection;
  const verified = discoveryScenario(film, { discovery: selection.discovery, kinobaza });
  if (selection.retrieval !== 'ua-discovery' || selection.requestBudget !== verified.requestBudget || kinobaza !== verified.kinobaza) throw new Error('Fixed discovery configuration required.');
  if (!['synthetic', 'live'].includes(mode)) throw new Error('Explicit synthetic/live mode required.');
  const start = performance.now(), stages = {}; const controller = new AbortController();
  const allowHop = !isHeldOut(film.id) && kinobaza === 'on';
  const metrics = { requestsMade: 0, requestBudget: selection.requestBudget, elapsedMs: 0, calls: [] };
  const cancel = () => controller.abort(); if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const allowed = new Set([tmdbScenario(film, { discovery: 'digital-ua' }).sourceURL, tmdbScenario(film, { discovery: 'digital-ua' }).providersURL,
    motnScenario(film, { discovery: 'digital-ua' }).sourceURL, ...(kinobaza === 'on' ? [htmlScenario(film, { discovery: 'digital-ua' }).sourceURL, ...(allowHop ? [canonicalKinobazaURL(film.id)] : [])] : [])]);
  let approvedHop = null;
  const seen = new Set();
  const boundedFetch = async (url, init) => {
    if (controller.signal.aborted || !allowed.has(url) || seen.has(url) || seen.size >= selection.requestBudget) throw new Error('Budget/allowlist/deadline');
    if (allowHop && url === canonicalKinobazaURL(film.id) && approvedHop !== url) throw new Error('Unapproved canonical hop');
    seen.add(url); metrics.requestsMade++;
    const call = { stage: url.includes('themoviedb') ? 'tmdb' : url.includes('movieofthenight') ? 'motn' : 'kinobaza', method: 'GET' };
    metrics.calls.push(call);
    const signal = AbortSignal.any([controller.signal, init.signal]);
    // Propagate total cancellation through transport and body; never race away
    // from live work without aborting its request signal.
    const response = await fetchImpl(url, { ...init, signal });
    call.httpStatus = response.status;
    if (response.status >= 300 && response.status < 400) call.redirectLocation = response.headers.has('location') ? 'present-not-retained' : 'missing';
    if (allowHop) approvedHop = canonicalRedirectTarget(url, response.headers.get('location'), response.status) ?? approvedHop;
    return response;
  };
  const stage = async (name, work) => {
    const at = performance.now();
    try {
      const result = await work();
      const serialized = JSON.stringify(result);
      if ([tmdbToken, motnKey].some(secret => secret && (serialized.includes(secret) || serialized.includes(JSON.stringify(secret).slice(1, -1))))) throw new Error('Credential echo withheld.');
      const status = name === 'tmdb' ? `A: ${result.identity.status}; B: ${result.providers.status}` : result.status ?? 'partial';
      stages[name] = { status, result, receivedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - at) };
    }
    catch { stages[name] = { status: controller.signal.aborted ? 'deadline-no-retry' : 'stage-failed-no-retry', result: null, elapsedMs: Math.round(performance.now() - at) }; }
  };
  try {
    if (mode === 'synthetic') {
      const data = authoredDiscoveryData(film);
      await stage('tmdb', async () => ({ identity: projectTmdbIdentity(data.tmdb.details, film.id), providers: projectTmdbProviders(data.tmdb.providers, film.id), requestsMade: 0 }));
      await stage('motn', async () => normalizeMotn(data.motn, film.id));
      if (kinobaza === 'on') await stage('kinobaza', () => extractHtml(data.html, film));
    } else {
      // Independent sources: a TMDb outage/identity failure never suppresses
      // fixed-ID MOTN. Each projection enforces its own gate.
      await Promise.all([
        stage('tmdb', () => fetchTmdb(tmdbScenario(film, { discovery: 'digital-ua' }), tmdbToken, boundedFetch)),
        stage('motn', () => fetchMotn(motnScenario(film, { discovery: 'digital-ua' }), motnKey, boundedFetch)),
        ...(kinobaza === 'on' ? [stage('kinobaza', () => fetchHtmlCandidates(htmlScenario(film, { discovery: 'digital-ua' }), boundedFetch, { canonicalRedirect: allowHop }))] : []),
      ]);
    }
    stages.kinobaza ??= { status: 'disabled-no-request', result: null, elapsedMs: 0 };
    metrics.elapsedMs = Math.round(performance.now() - start);
    return composeDiscovery(film, stages, { synthetic: mode === 'synthetic', metrics });
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
