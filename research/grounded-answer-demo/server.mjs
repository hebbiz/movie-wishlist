import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { MODEL, MAX_OUTPUT_TOKENS, FILMS, selectRequest, requestBody } from './config.mjs';
import { runDiscovery, DISCOVERY_IDS } from './discovery.mjs';
import { syntheticResponse, syntheticHtml } from './synthetic.mjs';
import { extractHtml, fetchHtmlCandidates, HTML_LIMIT_BYTES, HTML_TIMEOUT_MS } from './html-source.mjs';
import { networkConfig } from './network.mjs';
import { fetchMotn, normalizeMotn, syntheticMotn, MOTN_FILMS, MOTN_TIMEOUT_MS, MOTN_LIMIT_BYTES } from './motn.mjs';
import { fetchTmdb, projectSyntheticTmdb, TMDB_TIMEOUT_MS, TMDB_LIMIT_BYTES } from './tmdb.mjs';
import { extractMegogo, fetchMegogo, MEGOGO_IDS, MEGOGO_TIMEOUT_MS, MEGOGO_LIMIT_BYTES } from './megogo.mjs';
import { syntheticMegogo } from './megogo-synthetic.mjs';

const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/client.mjs', ['public/client.mjs', 'text/javascript; charset=utf-8']],
  ['/display.mjs', ['public/display.mjs', 'text/javascript; charset=utf-8']],
  ['/url-display.mjs', ['public/url-display.mjs', 'text/javascript; charset=utf-8']],
  ['/html-display.mjs', ['public/html-display.mjs', 'text/javascript; charset=utf-8']],
  ['/motn-display.mjs', ['public/motn-display.mjs', 'text/javascript; charset=utf-8']],
  ['/tmdb-display.mjs', ['public/tmdb-display.mjs', 'text/javascript; charset=utf-8']],
  ['/megogo-display.mjs', ['public/megogo-display.mjs', 'text/javascript; charset=utf-8']],
  ['/discovery-client.mjs', ['public/discovery-client.mjs', 'text/javascript; charset=utf-8']],
  ['/tmdb-logo.svg', ['public/tmdb-logo.svg', 'image/svg+xml']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
]);
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// Dependency injection is for offline tests; the executable uses only built-in fetch.
export function createDemo({ mode = 'synthetic', scenario = 'grounded', filmId, discovery, amazonRegion, retrieval, urlSource, kinobaza, apiKey = '', motnKey = '', tmdbToken = '', fetchImpl = globalThis.fetch, ...networkOptions } = {}) {
  const network = networkConfig(networkOptions);
  const selection = selectRequest({ filmId, discovery, amazonRegion, retrieval, urlSource, kinobaza });
  const { film } = selection; // Resolve once at startup, never from browser input.
  const options = { discovery: selection.discovery, amazonRegion, retrieval: selection.retrieval, urlSource: selection.urlSource };
  const htmlOnly = selection.retrieval === 'kinobaza-html';
  const motnOnly = selection.retrieval === 'motn-api';
  const tmdbOnly = selection.retrieval === 'tmdb-data';
  const megogoOnly = selection.retrieval === 'megogo-html';
  const composed = selection.retrieval === 'ua-discovery';
  const nonGemini = htmlOnly || motnOnly || tmdbOnly || megogoOnly || composed;
  const body = nonGemini ? null : requestBody(film.id, options);
  if (!['synthetic', 'live'].includes(mode)) throw new Error('DEMO_MODE must be synthetic or live.');
  const syntheticCases = nonGemini ? ['grounded'] : ['grounded', 'empty', 'ungrounded', 'api-error', ...(selection.retrieval === 'url-context' ? ['retrieval-error', 'retrieval-paywall', 'retrieval-unsafe'] : [])];
  if (!syntheticCases.includes(scenario)) throw new Error('Unknown synthetic scenario.');
  // Tokens contain no content. Never retain prompts/responses in session state.
  const sessions = new Map();
  const server = createServer(async (req, res) => {
    const origin = `http://${network.bindAddress}:${server.address().port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', tmdbOnly || composed ? csp.replace('img-src https:', "img-src 'self' https:") : csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    // Exact Host and Origin checks also reject DNS rebinding and cross-site POSTs.
    if (req.headers.host !== new URL(origin).host) return send(403, { error: 'Open the exact printed demo URL.' });
    if (req.headers.origin !== undefined && req.headers.origin !== origin) return send(403, { error: 'Same-origin requests only.' });
    if (!network.authorized(req.headers.authorization)) {
      req.resume();
      res.setHeader('WWW-Authenticate', 'Basic realm="MW-FUT-01 local demo", charset="UTF-8"');
      return send(401, { error: 'Authentication required.' });
    }
    try {
      if (req.method === 'GET' && assets.has(req.url)) {
        const [file, type] = assets.get(req.url);
        const content = await readFile(new URL(file, import.meta.url));
        res.writeHead(200, { 'Content-Type': type });
        return res.end(content);
      }
      if (req.method === 'GET' && (req.url === '/session' || composed && req.url.startsWith('/session?'))) {
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Local page only.' });
        let selectedFilm = film;
        if (composed && req.url !== '/session') {
          const params = new URL(req.url, origin).searchParams;
          if ([...params.keys()].length !== 1 || !DISCOVERY_IDS.includes(params.get('film'))) return send(400, { error: 'Choose one fixed film; no other overrides allowed.' });
          selectedFilm = FILMS[params.get('film')];
        }
        const now = Date.now();
        for (const [token, session] of sessions) if (session.expires < now) sessions.delete(token);
        if (sessions.size >= 100) return send(429, { error: 'Too many open pages. Restart the demo.' });
        const token = randomBytes(32).toString('hex');
        sessions.set(token, { expires: now + 30 * 60 * 1000, filmId: selectedFilm.id });
        const planned = composed ? ['tmdb-data', 'motn-api', ...(selection.kinobaza === 'on' ? ['kinobaza-html'] : [])].flatMap(retrieval => {
          const s = selectRequest({ retrieval, discovery: 'digital-ua', filmId: selectedFilm.id });
          return [s.sourceURL, ...(s.providersURL ? [s.providersURL] : [])];
        }) : [];
        if (composed) return send(200, { token, mode, model: null, prompt: null, discovery: 'digital-ua', retrieval: 'ua-discovery', film: selectedFilm, films: DISCOVERY_IDS.map(id => FILMS[id]),
          country: 'UA', kinobaza: selection.kinobaza, requestBudget: selection.requestBudget, operation: selection.operation,
          plannedRequests: planned,
          sources: ['TMDb', 'Movie of the Night', ...(selection.kinobaza === 'on' ? ['Kinobaza HTML'] : [])] });
        return send(200, { token, mode, model: nonGemini ? null : MODEL, maxOutputTokens: nonGemini ? null : MAX_OUTPUT_TOKENS, film, discovery: selection.discovery, amazonRegion: selection.amazonRegion, retrieval: selection.retrieval, urlSource: selection.urlSource ?? null, sourceURL: selection.sourceURL, prompt: selection.prompt,
          ...(htmlOnly ? { operation: selection.operation, htmlLimitBytes: HTML_LIMIT_BYTES, htmlTimeoutMs: HTML_TIMEOUT_MS } : {}),
          ...(megogoOnly ? { operation: selection.operation, expectedIds: MEGOGO_IDS, requestBudget: 1, htmlLimitBytes: MEGOGO_LIMIT_BYTES, htmlTimeoutMs: MEGOGO_TIMEOUT_MS, fetcherGeography: 'unknown' } : {}),
          ...(motnOnly ? { country: 'ua', imdbId: MOTN_FILMS[film.id].imdbId, operation: selection.operation, apiTimeoutMs: MOTN_TIMEOUT_MS, apiLimitBytes: MOTN_LIMIT_BYTES } : {}),
          ...(tmdbOnly ? { country: 'UA', locale: selection.locale, tmdbId: selection.tmdbId, imdbId: selection.imdbId, providersURL: selection.providersURL, requestBudget: 2, operation: selection.operation, apiTimeoutMs: TMDB_TIMEOUT_MS, apiLimitBytes: TMDB_LIMIT_BYTES } : {}) });
      }
      if (req.method === 'POST' && req.url === '/answer') {
        req.resume(); // Request bodies are not used; clients cannot change the fixed prompt.
        if (req.headers.origin !== origin) return send(403, { error: 'Local page only.' });
        const token = req.headers['x-demo-session'];
        const session = sessions.get(token);
        sessions.delete(token); // Consume synchronously, before any await, even on failure.
        if (!session || session.expires < Date.now()) return send(409, { error: 'Request already used or session expired. Reload the page.' });
        if (composed) {
          const chosen = selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: session.filmId, kinobaza: selection.kinobaza });
          const result = await runDiscovery(chosen, { mode, tmdbToken, motnKey, fetchImpl });
          return send(200, { mode, result });
        }
        if (megogoOnly) {
          const result = mode === 'synthetic' ? await extractMegogo(syntheticMegogo()) : await fetchMegogo(selection, fetchImpl);
          return send(200, { mode, result }); // Projection only; never raw HTML.
        }
        if (tmdbOnly) {
          const result = mode === 'synthetic' ? projectSyntheticTmdb(film.id) : await fetchTmdb(selection, tmdbToken, fetchImpl);
          return send(200, { mode, result }); // Metadata / UA projection only, no raw body.
        }
        if (motnOnly) {
          const result = mode === 'synthetic' ? normalizeMotn(syntheticMotn(film.id), film.id) : await fetchMotn(selection, motnKey, fetchImpl);
          return send(200, { mode, result }); // UA projection only, no global catalogue/raw body.
        }
        if (htmlOnly) {
          const result = mode === 'synthetic' ? await extractHtml(syntheticHtml(film), film) : await fetchHtmlCandidates(selection, fetchImpl);
          return send(200, { mode, result }); // No raw HTML, model or response archive.
        }
        if (mode === 'synthetic') {
          if (scenario === 'api-error') return send(502, { error: 'SYNTHETIC API error. No provider contacted.' });
          return send(200, { mode, response: syntheticResponse(scenario, film.id, options) });
        }
        if (!apiKey) return send(503, { error: 'GEMINI_API_KEY is missing on the server. No API request was made.' });
        // Exactly one attempt: no redirects, retries, SDK loops or follow-up calls.
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
          method: 'POST', redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
        });
        // Do not propagate/log provider error bodies (may contain request details).
        if (!response.ok) {
          await response.body?.cancel();
          return send(502, { error: `Gemini API returned HTTP ${response.status}. No retry was made.` });
        }
        return send(200, { mode, response: await response.json() });
      }
      send(404, { error: 'Not found.' });
    } catch {
      // Intentionally do not log exception objects, requests or response content.
      if (!res.headersSent) send(502, { error: 'Request failed, timed out or returned invalid JSON. No retry was made.' });
      else res.end();
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.env.DEMO_MODE || 'synthetic';
  const port = Number(process.env.DEMO_PORT || 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('DEMO_PORT must be 1024–65535.');
  const networkOptions = { access: process.env.DEMO_ACCESS, bindIPv4: process.env.DEMO_BIND_IPV4, lanPassword: process.env.DEMO_LAN_PASSWORD || '' };
  const network = networkConfig(networkOptions);
  const nonGemini = ['kinobaza-html', 'motn-api', 'tmdb-data', 'megogo-html', 'ua-discovery'].includes(process.env.DEMO_RETRIEVAL);
  const server = createDemo({ mode, filmId: process.env.DEMO_FILM, discovery: process.env.DEMO_DISCOVERY, amazonRegion: process.env.DEMO_AMAZON_REGION, retrieval: process.env.DEMO_RETRIEVAL, urlSource: process.env.DEMO_URL_SOURCE, kinobaza: process.env.DEMO_KINOBAZA, scenario: process.env.DEMO_SYNTHETIC_SCENARIO || 'grounded', apiKey: nonGemini ? '' : process.env.GEMINI_API_KEY || '', motnKey: ['motn-api', 'ua-discovery'].includes(process.env.DEMO_RETRIEVAL) ? process.env.MOTN_API_KEY || '' : '', tmdbToken: ['tmdb-data', 'ua-discovery'].includes(process.env.DEMO_RETRIEVAL) ? process.env.TMDB_READ_ACCESS_TOKEN || '' : '', ...networkOptions });
  server.on('error', () => { console.error('Demo could not listen. Check DEMO_PORT.'); process.exitCode = 1; });
  server.listen(port, network.bindAddress, () => console.log(`Local ${mode} demo: http://${network.bindAddress}:${port} — ${process.env.DEMO_RETRIEVAL === 'ua-discovery' ? 'UA discovery, max four requests/film, local draft only, no LLM' : ['kinobaza-html', 'megogo-html'].includes(process.env.DEMO_RETRIEVAL) ? 'HTML only, no API key' : process.env.DEMO_RETRIEVAL === 'motn-api' ? 'Movie of the Night v4, UA, no LLM' : process.env.DEMO_RETRIEVAL === 'tmdb-data' ? 'TMDB metadata / UA, max two requests, no LLM' : `${MODEL}, output limit ${MAX_OUTPUT_TOKENS}`}. No request until button click.`));
}
