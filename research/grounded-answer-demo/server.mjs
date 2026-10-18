import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { MODEL, MAX_OUTPUT_TOKENS, selectRequest, requestBody } from './config.mjs';
import { syntheticResponse } from './synthetic.mjs';
import { networkConfig } from './network.mjs';

const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/client.mjs', ['public/client.mjs', 'text/javascript; charset=utf-8']],
  ['/display.mjs', ['public/display.mjs', 'text/javascript; charset=utf-8']],
  ['/url-display.mjs', ['public/url-display.mjs', 'text/javascript; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
]);
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// Dependency injection is for offline tests; the executable uses only built-in fetch.
export function createDemo({ mode = 'synthetic', scenario = 'grounded', filmId, discovery, amazonRegion, retrieval, urlSource, apiKey = '', fetchImpl = globalThis.fetch, ...networkOptions } = {}) {
  const network = networkConfig(networkOptions);
  const selection = selectRequest({ filmId, discovery, amazonRegion, retrieval, urlSource });
  const { film } = selection; // Resolve once at startup, never from browser input.
  const options = { discovery: selection.discovery, amazonRegion, retrieval: selection.retrieval, urlSource: selection.urlSource };
  const body = requestBody(film.id, options);
  if (!['synthetic', 'live'].includes(mode)) throw new Error('DEMO_MODE must be synthetic or live.');
  const syntheticCases = ['grounded', 'empty', 'ungrounded', 'api-error', ...(selection.retrieval === 'url-context' ? ['retrieval-error', 'retrieval-paywall', 'retrieval-unsafe'] : [])];
  if (!syntheticCases.includes(scenario)) throw new Error('Unknown synthetic scenario.');
  // Tokens contain no content. Never retain prompts/responses in session state.
  const sessions = new Map();
  const server = createServer(async (req, res) => {
    const origin = `http://${network.bindAddress}:${server.address().port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', csp);
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
      if (req.method === 'GET' && req.url === '/session') {
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Local page only.' });
        const now = Date.now();
        for (const [token, expires] of sessions) if (expires < now) sessions.delete(token);
        if (sessions.size >= 100) return send(429, { error: 'Too many open pages. Restart the demo.' });
        const token = randomBytes(32).toString('hex');
        sessions.set(token, now + 30 * 60 * 1000);
        return send(200, { token, mode, model: MODEL, maxOutputTokens: MAX_OUTPUT_TOKENS, film, discovery: selection.discovery, amazonRegion: selection.amazonRegion, retrieval: selection.retrieval, urlSource: selection.urlSource ?? null, sourceURL: selection.sourceURL, prompt: selection.prompt });
      }
      if (req.method === 'POST' && req.url === '/answer') {
        req.resume(); // Request bodies are not used; clients cannot change the fixed prompt.
        if (req.headers.origin !== origin) return send(403, { error: 'Local page only.' });
        const token = req.headers['x-demo-session'];
        const expires = sessions.get(token);
        sessions.delete(token); // Consume synchronously, before any await, even on failure.
        if (!expires || expires < Date.now()) return send(409, { error: 'Request already used or session expired. Reload the page.' });
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
  const server = createDemo({ mode, filmId: process.env.DEMO_FILM, discovery: process.env.DEMO_DISCOVERY, amazonRegion: process.env.DEMO_AMAZON_REGION, retrieval: process.env.DEMO_RETRIEVAL, urlSource: process.env.DEMO_URL_SOURCE, scenario: process.env.DEMO_SYNTHETIC_SCENARIO || 'grounded', apiKey: process.env.GEMINI_API_KEY || '', ...networkOptions });
  server.on('error', () => { console.error('Demo could not listen. Check DEMO_PORT.'); process.exitCode = 1; });
  server.listen(port, network.bindAddress, () => console.log(`Local ${mode} demo: http://${network.bindAddress}:${port} — ${MODEL}, output limit ${MAX_OUTPUT_TOKENS}. No request until button click.`));
}
