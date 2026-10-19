// Isolated non-LLM composition. No source changes, raw archive or destination fetch.
import { tmdbScenario, fetchTmdb, projectTmdbIdentity, projectTmdbProviders, syntheticTmdb } from './tmdb.mjs';
import { motnScenario, fetchMotn, normalizeMotn, syntheticMotn } from './motn.mjs';
import { htmlScenario, fetchHtmlCandidates, extractHtml } from './html-source.mjs';
import { syntheticHtml } from './synthetic.mjs';

export const DISCOVERY_DEADLINE_MS = 65_000;
export const DISCOVERY_IDS = Object.freeze(['coherence', 'dune-part-two']);
export function discoveryScenario(film, { discovery, amazonRegion, urlSource, kinobaza = 'on' } = {}) {
  if (!DISCOVERY_IDS.includes(film.id) || discovery !== 'digital-ua' || amazonRegion !== undefined || urlSource !== undefined || !['on', 'off'].includes(kinobaza)) {
    throw new Error('ua-discovery requires digital-ua, fixed Coherence/Dune, DEMO_KINOBAZA=on|off, unset URL_SOURCE/AMAZON_REGION.');
  }
  return Object.freeze({ film, discovery, retrieval: 'ua-discovery', amazonRegion: null, sourceURL: null, prompt: null, kinobaza,
    country: 'UA', requestBudget: kinobaza === 'on' ? 4 : 3,
    operation: 'Fixed-ID TMDb (max 2 GETs), independent MOTN (1 GET), optional fixed Kinobaza (1 GET). No LLM, destination requests, retries or storage. Source identity gates remain independent; no cross-source offer merging. Local draft only, not production MW.' });
}

const providers = {
  apple: { name: 'Apple TV Store', medium: 'Apple TV / iTunes' }, rakuten: { name: 'Rakuten TV', medium: 'Rakuten TV' },
  hbo: { name: 'HBO Max', medium: 'HBO Max' }, netflix: { name: 'Netflix', medium: 'Netflix' },
  prime: { name: 'Prime Video', medium: 'Prime Video' }, megogo: { name: 'MEGOGO', medium: 'Megogo' },
};
const aliases = new Map([
  ['apple tv store', 'apple'], ['itunes', 'apple'], ['apple tv / itunes', 'apple'],
  ['rakuten tv', 'rakuten'], ['rakuten', 'rakuten'], ['hbo max', 'hbo'], ['netflix', 'netflix'],
  ['prime video', 'prime'], ['amazon prime video', 'prime'], ['megogo', 'megogo'],
]);
const val = f => f?.state === 'reported' ? f.value : undefined;
const unknown = note => ({ state: 'unknown', note });
// Projected shape only: no response values, redirect destinations or body archive.
export function tmdbShapeDiagnostics(details) {
  const fields = []; let omitted = 0;
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (['missing', 'null', 'invalid', 'reported-empty'].includes(node.state)) {
      if (fields.length < 32) fields.push({ path, state: node.state }); else omitted++;
    }
    for (const [key, child] of Object.entries(node)) if (child && typeof child === 'object') visit(child, `${path}.${key}`);
  };
  visit(details?.metadata, 'metadata');
  return { status: details?.status ?? 'unresolved', resources: details?.resources ?? {}, fields, omitted,
    note: 'Resource states and field states differ. Missing optional fields alone do not make A partial; missing/null/invalid resources or invalid metadata do. These paths describe this run only.' };
}
export function mapProvider(source, id, name, access) {
  let key = typeof name === 'string' ? aliases.get(name.trim().toLowerCase()) : undefined;
  // The exact Apple TV label is ambiguous on its own; only the known store ID
  // or apple rent/buy context makes this alias a Store, never a subscription.
  if (typeof name === 'string' && name.trim().toLowerCase() === 'apple tv' &&
      (source === 'tmdb' && id === 2 || source === 'motn' && id === 'apple' && ['rent', 'buy'].includes(access))) key = 'apple';
  if (!key) return null;
  if (source === 'tmdb' && (id === 2 && key !== 'apple' || key === 'apple' && id !== 2)) return null;
  if (source === 'motn') {
    const ids = { apple: 'apple', prime: 'prime', netflix: 'netflix' };
    if (ids[key] !== id || key === 'apple' && !['rent', 'buy'].includes(access)) return null;
  }
  return { key, ...providers[key], sourceId: id === undefined ? null : `${source}:provider:${id}`, sourceName: name };
}

// Classification only, never resolve, serialize or follow the observed href.
export function classifyLink(href, provider) {
  const result = { href: typeof href === 'string' ? href : null, kind: 'unknown', transferable: false };
  if (!href) return { ...result, kind: 'missing' };
  if (typeof href !== 'string' || href.length > 16384 || /[\\\s\p{C}]/u.test(href)) return { ...result, href: null, kind: 'unsafe' };
  if (!/^[a-z][a-z\d+.-]*:/i.test(href)) return { ...result, kind: 'relative' };
  let u;
  try { u = new URL(href); } catch { return { ...result, href: null, kind: 'unsafe' }; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return { ...result, href: null, kind: 'unsafe' };
  const host = u.hostname.toLowerCase();
  if (['themoviedb.org', 'www.themoviedb.org'].includes(host)) return { ...result, kind: 'tmdb-watch-page' };
  if (/\/(?:search|results)(?:\/|$)/i.test(u.pathname) || ['q', 'query', 'search_query'].some(k => u.searchParams.has(k))) return { ...result, kind: 'search' };
  if (host === 'click.justwatch.com') return { ...result, kind: 'tracking-redirect', transferable: Boolean(provider) };
  const exact = {
    apple: host === 'tv.apple.com' && /^\/[a-z]{2}\/movie\/[^/]+\/umc\.cmc\.[a-z0-9]+$/i.test(u.pathname),
    prime: ['primevideo.com', 'www.primevideo.com'].includes(host) && /^\/(?:[^/]+\/)?detail\/[a-z0-9]+\/?$/i.test(u.pathname),
    netflix: ['netflix.com', 'www.netflix.com'].includes(host) && /^\/(?:[a-z]{2}\/)?title\/\d+\/?$/i.test(u.pathname),
    rakuten: ['rakuten.tv', 'www.rakuten.tv'].includes(host) && /^\/ua\/movies\/[^/]+\/?$/i.test(u.pathname),
    megogo: ['megogo.net', 'www.megogo.net'].includes(host) && /^\/ua\/view\/\d+-[^/]+\.html$/i.test(u.pathname),
  };
  return Object.hasOwn(exact, provider?.key) && exact[provider.key] ? { ...result, kind: 'exact-card-unverified', transferable: true } : result;
}

function rowBase(source, film, provider, index, provenance) {
  return { id: `${source}:${index}`, filmId: film.id, provider, country: 'UA', territoryBasis: 'source country context',
    kind: 'source-offer', access: unknown('Not reported'), package: unknown('Not reported'), cut: unknown('Not reported'),
    availability: { state: 'source-reported', value: 'available', note: 'Aggregator UA claim, not account entitlement.' },
    accountEntitlement: 'unknown', audio: unknown('No provider track evidence'), subtitles: unknown('No provider subtitle evidence'),
    quality: unknown('Not reported'), hdr10: unknown('Not reported'), dolbyVision: unknown('Not reported'), price: unknown('Not reported'),
    link: classifyLink(null), provenance, conflicts: [], choiceBasis: [], identityStatus: 'matched' };
}

export function composeDiscovery(film, stages, { synthetic = false, metrics = {} } = {}) {
  const rows = [], unmapped = []; const add = r => { r.choiceBasis = [r.country === 'UA' ? `${r.availability.state}; UA source context` : 'Territory unknown',
    'Audio/subtitles/video/price remain source-scoped; unknown is not absent.']; rows.push(r); };
  const tmdb = stages.tmdb.result, motn = stages.motn.result, kino = stages.kinobaza.result;
  const tmdbIdentity = tmdb?.providers?.identity?.status === 'mismatch' ? 'mismatch' : tmdb?.identity?.identity?.status;
  const sources = [
    { source: 'tmdb', status: stages.tmdb.status, identity: tmdbIdentity ?? 'unresolved', evidence: { details: tmdb?.identity?.identity ?? null, providers: tmdb?.providers?.identity ?? null }, diagnostics: tmdbShapeDiagnostics(tmdb?.identity), elapsedMs: stages.tmdb.elapsedMs },
    { source: 'motn', status: stages.motn.status, identity: motn?.identity?.status ?? 'unresolved', evidence: motn?.identity ?? null, elapsedMs: stages.motn.elapsedMs },
    { source: 'kinobaza', status: stages.kinobaza.status, identity: kino?.identity?.status ?? 'unresolved', evidence: kino?.identity ?? null, elapsedMs: stages.kinobaza.elapsedMs },
  ];
  if (tmdbIdentity === 'matched' && ['ok', 'partial'].includes(tmdb?.providers?.status)) {
    for (const b of tmdb.providers.buckets ?? []) for (const p of b.providers?.items ?? []) {
      const provider = mapProvider('tmdb', val(p.id), val(p.name));
      if (!provider) { unmapped.push({ source: 'tmdb', id: val(p.id) ?? null, name: val(p.name) ?? null }); continue; }
      const r = rowBase('tmdb', film, provider, rows.length, { source: 'TMDB / JustWatch', upstream: 'JustWatch', method: 'API results.UA',
        sourceURL: tmdbScenario(film, { discovery: 'digital-ua' }).providersURL, receivedAt: tmdb.providers.receivedAt, observationTime: null });
      r.access = { state: 'reported', value: b.access, sourceBucket: b.name };
      r.watchPage = val(tmdb.providers.watchLink) ?? null; // Not a provider URL.
      add(r);
    }
  }
  if (motn?.identity?.status === 'matched') for (const [i, o] of (motn.options ?? []).entries()) {
    const provider = mapProvider('motn', val(o.service.id), val(o.service.name), val(o.access));
    if (!provider) { unmapped.push({ source: 'motn', id: val(o.service.id) ?? null, name: val(o.service.name) ?? null }); continue; }
    const r = rowBase('motn', film, provider, i, { source: 'Movie of the Night', upstream: 'not-established', method: 'API streamingOptions.ua',
      sourceURL: motnScenario(film, { discovery: 'digital-ua' }).sourceURL, receivedAt: motn.receivedAt, observationTime: null });
    r.access = { ...o.access }; r.package = { ...o.addon }; r.audio = o.ukrainianAudio; r.subtitles = o.ukrainianSubtitles;
    r.quality = o.quality; r.price = o.price; r.link = classifyLink(val(o.link), provider);
    add(r);
  }
  if (kino?.identity?.status === 'matched') for (const [i, c] of (kino.candidates ?? []).entries()) {
    if (c.territory && c.territory.code !== 'UA') continue;
    const provider = mapProvider('kinobaza', undefined, c.provider);
    if (!provider) { unmapped.push({ source: 'kinobaza', name: c.provider }); continue; }
    const r = rowBase('kinobaza', film, provider, i, { source: 'Kinobaza HTML', upstream: c.territory ? 'JustWatch section (shared with TMDb)' : 'not-established',
      method: 'initial HTML href', sourceURL: htmlScenario(film, { discovery: 'digital-ua' }).sourceURL, receivedAt: stages.kinobaza.receivedAt,
      receiptBasis: 'Local source-operation completion, not provider update time', observationTime: null });
    r.kind = 'candidate-link'; r.country = c.territory?.code ?? null;
    r.territoryBasis = c.territory ? 'Explicit Ukrainian section; not entitlement' : 'Outside territory section';
    r.availability = unknown('Link presence does not establish availability');
    r.link = classifyLink(c.href, provider); r.rawHref = c.rawHref;
    add(r);
  }
  // No row/value merging. Comparable disagreements are retained with peer refs.
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (a.provider.key !== b.provider.key || a.country !== b.country || val(a.access) !== val(b.access) || val(a.access) === undefined) continue;
    if (val(a.package?.id) && val(b.package?.id) && val(a.package.id) !== val(b.package.id)) continue;
    for (const field of ['quality', 'price']) {
      if (a[field]?.state !== 'reported' || b[field]?.state !== 'reported') continue;
      if (field === 'price' && (!val(a.price.amount) || !val(a.price.currency) || !val(b.price.amount) || !val(b.price.currency))) continue;
      if (JSON.stringify(a[field]) === JSON.stringify(b[field])) continue;
      const type = a.link.href && a.link.href === b.link.href ? 'conflict' : 'possible-conflict-scope-unestablished';
      a.conflicts.push({ field, peer: b.id, type }); b.conflicts.push({ field, peer: a.id, type });
    }
  }
  // Evidence bands, not numeric confidence or "best" claim. Stable within band.
  const band = r => r.country !== 'UA' ? 2 : r.kind === 'candidate-link' ? 1 : 0;
  rows.sort((a, b) => {
    const availability = band(a) - band(b); if (availability) return availability;
    for (const key of ['audio', 'subtitles']) { const presentA = Boolean(a[key]?.ukrainian?.length), presentB = Boolean(b[key]?.ukrainian?.length); if (presentA !== presentB) return presentA ? -1 : 1; }
    const formats = ['sd', 'hd', 'qhd', 'uhd'];
    const qa = formats.indexOf(val(a.quality)), qb = formats.indexOf(val(b.quality));
    // Only compare explicit formats. Price is informational because source
    // currency/quality reliability remains unresolved, not "cheapest" inference.
    return qa >= 0 && qb >= 0 && !a.conflicts.length && !b.conflicts.length ? qb - qa : 0;
  });
  const conflicts = sources.filter(s => s.identity === 'mismatch');
  return { synthetic, film, country: 'UA', identity: { status: conflicts.length ? 'conflict-no-common-identity' : 'independent-source-gates',
    conflicts: conflicts.map(s => s.source), note: 'No common identity or cross-source offer merge is asserted.' },
    rows, sources, unmapped, metrics, stages,
    limits: 'Not a best-option recommendation, account entitlement, full coverage or production transfer. Unknown is not negative. Historical owner controls do not replace source fields.' };
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
  deadlineMs = DISCOVERY_DEADLINE_MS } = {}) {
  const { film, kinobaza } = selection;
  const verified = discoveryScenario(film, { discovery: selection.discovery, kinobaza });
  if (selection.retrieval !== 'ua-discovery' || selection.requestBudget !== verified.requestBudget) throw new Error('Fixed discovery configuration required.');
  if (!['synthetic', 'live'].includes(mode)) throw new Error('Explicit synthetic/live mode required.');
  const start = performance.now(), stages = {}; const controller = new AbortController();
  const metrics = { requestsMade: 0, requestBudget: selection.requestBudget, elapsedMs: 0, calls: [] };
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const allowed = new Set([tmdbScenario(film, { discovery: 'digital-ua' }).sourceURL, tmdbScenario(film, { discovery: 'digital-ua' }).providersURL,
    motnScenario(film, { discovery: 'digital-ua' }).sourceURL, ...(kinobaza === 'on' ? [htmlScenario(film, { discovery: 'digital-ua' }).sourceURL] : [])]);
  const seen = new Set();
  const boundedFetch = async (url, init) => {
    if (controller.signal.aborted || !allowed.has(url) || seen.has(url) || seen.size >= selection.requestBudget) throw new Error('Budget/allowlist/deadline');
    seen.add(url); metrics.requestsMade++;
    const call = { stage: url.includes('themoviedb') ? 'tmdb' : url.includes('movieofthenight') ? 'motn' : 'kinobaza', method: 'GET' };
    metrics.calls.push(call);
    const signal = AbortSignal.any([controller.signal, init.signal]);
    // Propagate total cancellation through transport and body; never race away
    // from live work without aborting its request signal.
    const response = await fetchImpl(url, { ...init, signal });
    call.httpStatus = response.status;
    if (response.status >= 300 && response.status < 400) call.redirectLocation = response.headers.has('location') ? 'present-not-retained' : 'missing';
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
        ...(kinobaza === 'on' ? [stage('kinobaza', () => fetchHtmlCandidates(htmlScenario(film, { discovery: 'digital-ua' }), boundedFetch))] : []),
      ]);
    }
    stages.kinobaza ??= { status: 'disabled-no-request', result: null, elapsedMs: 0 };
    metrics.elapsedMs = Math.round(performance.now() - start);
    return composeDiscovery(film, stages, { synthetic: mode === 'synthetic', metrics });
  } finally { clearTimeout(timer); }
}
