import { parse } from 'parse5';
import { admitKinobazaURL } from '../../research/grounded-answer-demo/assisted-kinobaza.mjs';

const ORIGIN = 'https://kinobazaua.com';
const PREFIX = `${ORIGIN}/search?q=`;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const inert = new Set(['script', 'style', 'template', 'noscript', 'iframe']);
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;

// Only the observed public form endpoint is constructed. The query is a
// bounded trusted title, never a supplied URL, destination or generated slug.
export function kinobazaSearchURL(title) {
  if (typeof title !== 'string' || title.length > 500 || /[\p{C}]/u.test(title) || !title.trim()) return null;
  return PREFIX + encodeURIComponent(title.trim());
}

export function isKinobazaSearchURL(url) {
  if (typeof url !== 'string' || !url.startsWith(PREFIX)) return false;
  try { return kinobazaSearchURL(decodeURIComponent(url.slice(PREFIX.length))) === url; } catch { return false; }
}

function searchRequest(url, init) {
  if (!isKinobazaSearchURL(url) || init?.method !== 'GET' || init.redirect !== 'manual' || init.credentials !== 'omit' || init.body != null) return false;
  try { return [...new Headers(init.headers).keys()].every(name => ['accept', 'user-agent'].includes(name)); } catch { return false; }
}

function activeNodes(root) {
  const active = [], stack = [[root, 0, true]];
  let count = 0;
  while (stack.length) {
    const [node, depth, visible] = stack.pop();
    if (++count > 100_000 || depth > 256) throw Error('markup-limit');
    if (visible) active.push(node);
    const nextVisible = visible && !inert.has(node.tagName);
    for (const child of (node.childNodes ?? []).toReversed()) stack.push([child, depth + 1, nextVisible]);
    if (node.content) stack.push([node.content, depth + 1, false]);
  }
  return active;
}

function rejectionReason(href) {
  if (typeof href !== 'string') return 'non-string';
  if (href.length > 512) return 'invalid-url';
  try {
    const url = new URL(href, ORIGIN);
    return url.protocol !== 'https:' ? 'unsafe-scheme' : url.username || url.password ? 'credentials' :
      /^(?:https?:)?\/\/[^/]*:\d/.test(href) ? 'port' : url.hostname !== 'kinobazaua.com' ? 'foreign-host' :
      url.search || href.includes('?') ? 'query' : url.hash || href.includes('#') ? 'fragment' :
      !/^\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname) ? 'unsupported-path' : 'unsupported-spelling';
  } catch { return 'invalid-url'; }
}

export function kinobazaPublicSearch(fetchImpl = fetch, { secrets = [], onCandidateURLs } = {}) {
  const hidden = Array.isArray(secrets) ? secrets.filter(value => typeof value === 'string' && value.length) : [];
  const secretEcho = value => hidden.some(secret => value.includes(secret));
  return {
    accepts: searchRequest,
    async search(title, { signal } = {}) {
      const url = kinobazaSearchURL(title), fail = status => ({ status, urls: [] });
      if (!url) return fail('search-invalid-response');
      if (secretEcho(title)) return fail('unsafe-source-content-withheld');
      if (signal?.aborted) return fail('search-timeout-no-retry');
      const controller = new AbortController(), deadline = Date.now() + TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const aborted = new Promise((_, reject) => {
        if (combined.aborted) reject(Error());
        else combined.addEventListener('abort', () => reject(Error()), { once: true });
      });
      const bounded = promise => Promise.race([promise, aborted]);
      let reader;
      try {
        const response = await bounded(fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
          headers: { Accept: 'text/html', 'User-Agent': 'MovieWishlistResearchPoC/0.1 (public title search)' }, signal: combined }));
        const stop = status => { void response.body?.cancel().catch(() => {}); return fail(status); };
        if (response.status >= 300 && response.status < 400) return stop('search-redirect-refused');
        if (!response.ok) return stop(({ 401: 'search-auth-error', 403: 'search-access-denied', 429: 'search-rate-limit' })[response.status] ?? 'search-http-error');
        const type = response.headers.get('content-type') ?? '';
        if (!/^text\/html(?:\s*;|$)/i.test(type) || /charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type) || !response.body) return stop('search-invalid-response');
        if (Number(response.headers.get('content-length')) > MAX_BYTES) return stop('search-response-too-large');
        reader = response.body.getReader();
        const chunks = []; let bytes = 0;
        for (;;) {
          const part = await bounded(reader.read()); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > MAX_BYTES) { void reader.cancel().catch(() => {}); return fail('search-response-too-large'); }
          chunks.push(part.value);
        }
        const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
        if (secretEcho(html)) return fail('unsafe-source-content-withheld');
        if (/captcha|cf-chl-|challenge-platform/i.test(html)) return fail('search-access-denied');
        if (combined.aborted || Date.now() >= deadline) return fail('search-timeout-no-retry');
        let all;
        try { all = activeNodes(parse(html)); } catch { return fail('search-invalid-response'); }
        if (combined.aborted || Date.now() >= deadline) return fail('search-timeout-no-retry');
        const containers = all.filter(node => attr(node, 'id') === 'nav-titles');
        if (containers.length !== 1 || containers[0].tagName !== 'div') return fail('search-invalid-response');
        const inside = node => { for (let parent = node.parentNode; parent; parent = parent.parentNode) if (parent === containers[0]) return true; return false; };
        const anchors = all.filter(node => node.tagName === 'a' && inside(node));
        // The observed responsive results scope also contains genre/person
        // links (173 anchors for ten results), not just card pointers. Bound
        // this structural scan independently of the two-card network budget.
        if (anchors.length > 500) return fail('search-invalid-response');
        const urls = [], seen = new Set(), diagnostics = { returned: anchors.length, admitted: 0, rejected: 0, duplicates: 0, rejectionCategories: {} };
        for (const anchor of anchors) {
          const href = attr(anchor, 'href');
          if (typeof href === 'string' && secretEcho(href)) return fail('unsafe-source-content-withheld');
          const accepted = typeof href === 'string' && /^\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href) ? admitKinobazaURL(ORIGIN + href) : null;
          if (accepted) {
            if (seen.has(accepted)) diagnostics.duplicates++;
            else { seen.add(accepted); urls.push(accepted); diagnostics.admitted++; }
          } else {
            const reason = rejectionReason(href); diagnostics.rejected++;
            diagnostics.rejectionCategories[reason] = (diagnostics.rejectionCategories[reason] ?? 0) + 1;
          }
        }
        // Pass a copy after admission; mutation or failure cannot alter output.
        if (typeof onCandidateURLs === 'function') try { onCandidateURLs([...urls]); } catch {}
        return { status: 'ok', urls, diagnostics };
      } catch {
        if (reader) void reader.cancel().catch(() => {});
        return fail(combined.aborted || Date.now() >= deadline ? 'search-timeout-no-retry' : 'search-transport-or-json-error');
      } finally { clearTimeout(timer); }
    },
  };
}
