import { KINOBAZA_CARDS } from './url-context.mjs';
import { extractHtml as extractRuntimeHtml, HTML_LIMIT_BYTES, HTML_TIMEOUT_MS } from '../../netlify/lib/kinobaza-html.mjs';
export { HTML_LIMIT_BYTES, HTML_TIMEOUT_MS };

import { HELD_OUT_FILMS, isHeldOut } from './held-out.mjs';

const HTML_CARDS = Object.freeze({ ...KINOBAZA_CARDS,
  ...Object.fromEntries(Object.entries(HELD_OUT_FILMS).filter(([, f]) => f.kinobazaURL).map(([id, f]) => [id, f.kinobazaURL])),
});

export function canonicalKinobazaURL(filmId) {
  if (!Object.hasOwn(HTML_CARDS, filmId)) throw new Error('Fixed Kinobaza film required.');
  return isHeldOut(filmId) ? HTML_CARDS[filmId] : `https://kinobazaua.com/titles/${filmId}`;
}
export function canonicalRedirectTarget(source, location, status) {
  if (![301, 308].includes(status) || typeof location !== 'string') return null;
  const entry = Object.entries(KINOBAZA_CARDS).find(([, url]) => source === url);
  // Exact spelling deliberately excludes credentials, query, fragments, ports,
  // encoded path tricks, downgrade, extra hosts and a second hop/loop.
  return entry && location === canonicalKinobazaURL(entry[0]) ? location : null;
}

export const HTML_OPERATION = 'One GET of the fixed Kinobaza card; initial HTML only; no redirects, retries, scripts, cookies, model or destination requests. Candidates are not availability or entitlement. Missing/ambiguous identity or markup stays unresolved.';

export function htmlScenario(film, { discovery, amazonRegion, urlSource } = {}) {
  if (discovery !== 'digital-ua' || amazonRegion !== undefined ||
      !Object.hasOwn(HTML_CARDS, film.id) || (urlSource !== undefined && urlSource !== 'kinobaza')) {
    throw new Error('kinobaza-html requires digital-ua, Dune/Coherence, no Amazon region and URL source unset or kinobaza.');
  }
  return Object.freeze({ film, discovery, amazonRegion: null, retrieval: 'kinobaza-html',
    urlSource: 'kinobaza', sourceURL: HTML_CARDS[film.id], prompt: null, operation: HTML_OPERATION });
}

const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const children = n => n.childNodes ?? [];
const clean = s => s.replace(/\s+/gu, ' ').trim();
function nodes(root) {
  const result = []; const stack = [[root, 0]];
  while (stack.length) {
    const [n, depth] = stack.pop();
    if (depth > 256 || result.length >= 100_000) throw new Error('markup-limit');
    result.push(n);
    if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(n.tagName)) {
      for (const c of children(n).toReversed()) stack.push([c, depth + 1]);
    }
  }
  return result;
}
const text = n => clean(nodes(n).filter(x => x.nodeName === '#text').map(x => x.value).join(' '));
const hasClass = (n, value) => (attr(n, 'class') ?? '').split(/\s+/).includes(value);
function excluded(n) {
  for (let p = n; p; p = p.parentNode) {
    if (['nav', 'aside', 'footer', 'script', 'style', 'template', 'noscript', 'iframe'].includes(p.tagName) ||
        /(?:^|[\s_-])(?:ad|ads|advertisement|trailer)(?:$|[\s_-])/i.test(`${attr(p, 'id') ?? ''} ${attr(p, 'class') ?? ''}`)) return true;
  }
  return false;
}
function identity(all, film) {
  const h1 = all.filter(n => n.tagName === 'h1' && !excluded(n));
  const headings = all.filter(n => n.tagName === 'h2' && !excluded(n)).map(text);
  const entry = isHeldOut(film.id) ? HELD_OUT_FILMS[film.id] : null;
  if (entry && !entry.kinobazaURL || !entry && !Object.hasOwn(KINOBAZA_CARDS, film.id)) return { status: 'unresolved', observed: {} };
  const title = entry?.identityTitle ?? (film.id === 'coherence' ? 'Coherence' : 'Dune: Part Two');
  const year = entry?.year ?? (film.id === 'coherence' ? '2013' : '2024');
  const aliases = entry?.directorAliases ?? (film.id === 'coherence' ? ['James Ward Byrkit', 'Джеймс Ворд Біркіт'] : ['Denis Villeneuve', 'Денні Вільньов']);
  const directors = new Set();
  // A labelled table cell or an adjacent inline label, not a whole-page name hit.
  for (const n of all) {
    if (excluded(n)) continue;
    if (n.tagName === 'tr') {
      const cells = children(n).filter(c => ['td', 'th'].includes(c.tagName));
      if (cells.length === 2 && text(cells[0]) === 'Режисер:') directors.add(text(cells[1]));
    }
    if ((n.nodeName === '#text' && clean(n.value) === 'Режисер:') ||
        (['span', 'strong', 'b'].includes(n.tagName) && text(n) === 'Режисер:')) {
      const siblings = children(n.parentNode); const i = siblings.indexOf(n);
      const next = siblings.slice(i + 1).find(c => c.tagName || (c.nodeName === '#text' && clean(c.value)));
      if (next?.tagName === 'a') directors.add(text(next));
    }
  }
  const observed = { heading: h1.map(text), originalTitles: headings.filter(h => h === title), directors: [...directors] };
  // A supplied canonical is evidence, not a URL to follow or silently repair.
  const canonicals = entry ? all.filter(n => n.tagName === 'link' && attr(n, 'rel') === 'canonical').map(n => attr(n, 'href')) : [];
  if (canonicals.length > 1 || canonicals.some(url => url !== entry.kinobazaURL)) return { status: 'unresolved', observed, reason: 'conflicting-source-canonical' };
  const matches = h1.length === 1 && new RegExp(`\\(\\s*${year}\\s*\\)`).test(text(h1[0])) &&
    observed.originalTitles.length === 1 && directors.size > 0 && [...directors].every(d => aliases.includes(d));
  return { status: matches ? 'matched' : 'unresolved', observed };
}

// The fixed-film default remains demo-only; product reads always supply identityCheck.
export function extractHtml(html, film, options = {}) {
  return extractRuntimeHtml(html, film, { ...options, identityCheck: options.identityCheck || (all => identity(all, film)) });
}

export async function fetchHtmlCandidates(selection, fetchImpl = globalThis.fetch, { timeoutMs = HTML_TIMEOUT_MS, maxBytes = HTML_LIMIT_BYTES, canonicalRedirect = false } = {}) {
  if (selection.retrieval !== 'kinobaza-html' || !Object.hasOwn(HTML_CARDS, selection.film.id) || selection.sourceURL !== HTML_CARDS[selection.film.id]) throw new Error('Fixed HTML source required.');
  try { await import('parse5'); } catch { return { status: 'parser-unavailable', candidates: [], issues: ['Install isolated parser before live GET.'] }; }
  const controller = new AbortController(); let reader;
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const bounded = promise => Promise.race([promise, aborted]);
  const failure = (status, httpStatus) => ({ status, ...(httpStatus ? { httpStatus } : {}), candidates: [] });
  try {
    const get = url => bounded(fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
      headers: { Accept: 'text/html', 'User-Agent': 'MovieWishlistResearchPoC/0.1 (manual fixed-card experiment)' }, signal: controller.signal }));
    let response = await get(selection.sourceURL), sourceURL = selection.sourceURL, requestsMade = 1;
    if (canonicalRedirect && response.status >= 300 && response.status < 400) {
      const target = canonicalRedirectTarget(sourceURL, response.headers.get('location'), response.status);
      void response.body?.cancel().catch(() => {});
      if (!target) return { ...failure('canonical-redirect-refused', response.status), requestsMade };
      sourceURL = target; requestsMade++; response = await get(target);
      if (response.status >= 300 && response.status < 400) { void response.body?.cancel().catch(() => {}); return { ...failure('redirect-loop-or-second-hop-refused', response.status), requestsMade }; }
    }
    if (response.status >= 300 && response.status < 400) { void response.body?.cancel().catch(() => {}); return failure('redirect-not-followed', response.status); }
    if (!response.ok) { void response.body?.cancel().catch(() => {}); return failure([403, 429].includes(response.status) ? 'access-blocked-no-retry' : 'http-error-no-retry', response.status); }
    const type = response.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || (/charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type))) { void response.body?.cancel().catch(() => {}); return failure('unsupported-content-type', response.status); }
    if (Number(response.headers.get('content-length')) > maxBytes) { void response.body?.cancel().catch(() => {}); return failure('response-too-large', response.status); }
    if (!response.body) return failure('empty-response', response.status);
    reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await bounded(reader.read());
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); return failure('response-too-large', response.status); }
      chunks.push(value);
    }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
    const extracted = await extractHtml(html, selection.film), receivedAt = new Date().toISOString();
    if (extracted.localization) extracted.localization.provenance = { source: 'Kinobaza HTML', method: 'initial HTML source blocks', sourceURL, receivedAt, upstream: 'not-established' };
    return { ...extracted, httpStatus: response.status, bytes: size, sourceURL, requestsMade, receivedAt };
  } catch { if (reader) void reader.cancel().catch(() => {}); return failure(controller.signal.aborted ? 'timeout-no-retry' : 'network-or-decoding-error-no-retry'); }
  finally { clearTimeout(timer); }
}
