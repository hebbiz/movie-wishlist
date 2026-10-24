import { admitKinobazaURL, fetchAssistedKinobaza } from '../../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { safeSearchDiagnostic, safeIdentityDiagnostic, resolverStatuses } from '../../shared/media-advice-diagnostics.mjs';
const ENDPOINT = 'https://api.tavily.com/search';
const text = s => typeof s === 'string' && s.length <= 500 && !/[\p{C}]/u.test(s) ? s.trim() : '';
export function resolverQueries(film) {
  const names = [...new Set([film.originalTitle, film.identityTitle, ...(film.titleAliases ?? [])].map(text).filter(Boolean))].slice(0, 2);
  const quote = s => '"' + s.replace(/["\\]/g, ' ') + '"';
  return names.map(name => [quote(name), Number.isInteger(film.year) ? film.year : '', 'site:kinobazaua.com/titles/'].filter(Boolean).join(' '));
}
export function admittedCandidates(items) {
  return candidateDiagnostics(items)?.urls ?? null;
}
export function candidateDiagnostics(items) {
  if (!Array.isArray(items) || items.length > 20) return null;
  const urls = [], seen = new Set(), diagnostics = { returned: items.length, admitted: 0, rejected: 0, duplicates: 0, rejectionCategories: {} };
  for (const item of items) {
    const accepted = admitKinobazaURL(item?.url);
    if (accepted) { if (seen.has(accepted)) diagnostics.duplicates++; else { seen.add(accepted); urls.push(accepted); diagnostics.admitted++; } continue; }
    let reason = 'invalid-url'; const original = item?.url;
    if (typeof original !== 'string') reason = 'non-string';
    else if (original.length <= 512) try {
      const u = new URL(original);
      reason = u.protocol !== 'https:' ? 'unsafe-scheme' : u.username || u.password ? 'credentials' :
        /^https:\/\/[^/]*:\d/.test(original) ? 'port' : u.hostname !== 'kinobazaua.com' ? 'foreign-host' :
        u.search || original.includes('?') ? 'query' : u.hash || original.includes('#') ? 'fragment' :
        !/^\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname) ? 'unsupported-path' : 'unsupported-spelling';
    } catch {}
    diagnostics.rejected++; diagnostics.rejectionCategories[reason] = (diagnostics.rejectionCategories[reason] ?? 0) + 1;
  }
  return { urls, diagnostics };
}
// Replaceable ordinary Web Search interface: candidate URLs only. Snippet/rank
// never enter identity, availability, localization, reports or draft.
export function tavilySearch(apiKey, fetchImpl = fetch, { onCandidateURLs } = {}) {
  return {
    accepts(url, init) {
      return url === ENDPOINT && init?.method === 'POST' && init.redirect === 'manual' && init.credentials === 'omit';
    },
    async search(query, { signal } = {}) {
      if (!apiKey || /\s/.test(apiKey)) return { status: 'missing-or-invalid-search-key', urls: [] };
      if (signal?.aborted) return { status: 'search-timeout-no-retry', urls: [] };
      const payload = { query, search_depth: 'basic', topic: 'general', max_results: 5,
        auto_parameters: false, include_answer: false, include_raw_content: false,
        include_images: false, include_favicon: false, include_usage: false,
        include_domains: ['kinobazaua.com'], include_domains_mode: 'restrict' };
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
      const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const aborted = new Promise((_, reject) => { if (combined.aborted) reject(Error()); else combined.addEventListener('abort', () => reject(Error()), { once: true }); });
      const bounded = p => Promise.race([p, aborted]); let reader;
      try {
        const r = await bounded(fetchImpl(ENDPOINT, { method: 'POST', redirect: 'manual', credentials: 'omit',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(payload), signal: combined }));
        const stop = status => { void r.body?.cancel().catch(() => {}); return { status, urls: [] }; };
        if (r.status >= 300 && r.status < 400) return stop('search-redirect-refused');
        if (!r.ok) return stop(({ 401: 'search-auth-error', 403: 'search-access-denied', 429: 'search-rate-limit',
          432: 'search-quota-error', 433: 'search-quota-error' })[r.status] ?? 'search-http-error');
        if (!/^application\/json(?:\s*;|$)/i.test(r.headers.get('content-type') ?? '') || !r.body) return stop('search-invalid-response');
        if (Number(r.headers.get('content-length')) > 512 * 1024) return stop('search-response-too-large');
        reader = r.body.getReader(); let bytes = 0; const chunks = [];
        for (;;) { const part = await bounded(reader.read()); if (part.done) break; bytes += part.value.byteLength; if (bytes > 512 * 1024) { void reader.cancel().catch(() => {}); return { status: 'search-response-too-large', urls: [] }; } chunks.push(part.value); }
        const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
        if (body.includes(apiKey)) return { status: 'unsafe-source-content-withheld', urls: [] };
        const data = JSON.parse(body);
        // Only results[].url crosses the provider boundary. Missing/malformed
        // results is not a successful empty search. Content/score are discarded.
        const valid = data && !Array.isArray(data) && Array.isArray(data.results) && data.results.length <= 5 &&
          data.results.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.url === 'string');
        const accepted = valid ? candidateDiagnostics(data.results) : null;
        // Trusted local opt-in hook only, not a browser/request option. It gets
        // URL strings alone in memory, never snippets/score or the response body.
        // Admission/output are already computed; hook failure cannot change them.
        if (accepted && typeof onCandidateURLs === 'function') {
          try { onCandidateURLs(data.results.map(item => item.url)); } catch {}
        }
        return accepted ? { status: 'ok', urls: accepted.urls, diagnostics: accepted.diagnostics } : { status: 'search-invalid-response', urls: [] };
      } catch { if (reader) void reader.cancel().catch(() => {}); return { status: combined.aborted ? 'search-timeout-no-retry' : 'search-transport-or-json-error', urls: [] }; }
      finally { clearTimeout(timer); }
    },
  };
}

export function createKinobazaResolver({ apiKey, searchFactory = tavilySearch, onIdentityDiagnostic } = {}) {
  return async (film, { reserve, fetchImpl, calls, signal }) => {
    const queries = resolverQueries(film), cards = [];
    const summary = { searchCalls: 0, cardCalls: 0, candidates: 0, unexamined: 0, searches: [], cards: [] };
    const done = (status, result = null, choices = []) => { summary.status = resolverStatuses.has(status) ? status : 'unknown'; return { status, result, choices, resolver: summary }; };
    if (!apiKey) return done('not-evaluated-missing-search-key');
    if (!queries.length) return done('not-evaluated-no-established-title');
    const searchFetch = async (url, init) => {
      const stage = `search-${summary.searchCalls + 1}`;
      if (summary.searchCalls >= 2 || signal?.aborted || provider.accepts?.(url, init) !== true) throw Error('search-boundary');
      await reserve(stage); if (signal?.aborted) throw Error('resolver-deadline');
      summary.searchCalls++; const call = { stage, status: 'attempt-reserved' }; calls.push(call);
      try { const r = await fetchImpl(url, init); call.httpStatus = r.status; call.status = 'response-received'; return r; } catch { call.status = 'transport-outcome-unknown'; throw Error('search-transport'); }
    };
    const provider = searchFactory(apiKey, searchFetch); let urls = [];
    for (let i = 0; i < queries.length; i++) {
      if (signal?.aborted) return done('resolver-deadline-bounded');
      const found = await provider.search(queries[i], { signal });
      summary.searches.push(safeSearchDiagnostic(found.status, found.diagnostics));
      if (found.status !== 'ok') return done(found.status); // No alternate for errors.
      urls = [...new Set((found.urls ?? []).map(admitKinobazaURL).filter(Boolean))];
      if (urls.length) break; // Alternate only after empty admitted result.
    }
    summary.candidates = urls.length; summary.unexamined = Math.max(0, urls.length - 2);
    if (!urls.length) return done('no-admitted-search-candidates');
    for (const url of urls.slice(0, 2)) {
      if (signal?.aborted) { summary.unexamined += Math.min(2, urls.length) - cards.length; break; }
      const stage = `kinobaza-${summary.cardCalls + 1}`;
      const cardFetch = async (target, init) => {
        if (target !== url || !admitKinobazaURL(target) || signal?.aborted || init.method !== 'GET' || init.redirect !== 'manual' || calls.some(c => c.stage === stage)) throw Error('card-boundary');
        await reserve(stage); if (signal?.aborted) throw Error('resolver-deadline');
        summary.cardCalls++; const call = { stage, status: 'attempt-reserved' }; calls.push(call);
        try { const r = await fetchImpl(target, init); call.httpStatus = r.status; call.status = 'response-received'; return r; } catch { call.status = 'transport-outcome-unknown'; throw Error('card-transport'); }
      };
      const result = await fetchAssistedKinobaza(url, film, cardFetch, { signal, onIdentityDiagnostic });
      cards.push(result);
      summary.cards.push({ identity: result.identity?.status ?? 'unresolved', reason: result.identity?.reason ?? null, extraction: result.status, candidates: result.candidates?.length ?? 0,
        diagnostics: safeIdentityDiagnostic(result.identity?.diagnostics) });
    }
    const confirmed = cards.filter(c => c.identity?.status === 'matched');
    if (confirmed.length > 1) return done('multiple-confirmed-cards-choose', null, confirmed);
    if (confirmed.length === 1) return done(summary.unexamined ? 'one-confirmed-bounded-not-exhaustive' : confirmed[0].status, confirmed[0]);
    return done(summary.unexamined ? 'bounded-unresolved' : 'no-confirmed-card');
  };
}
