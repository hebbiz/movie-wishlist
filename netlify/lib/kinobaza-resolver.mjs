import { admitKinobazaURL, fetchAssistedKinobaza } from '../../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { safeSearchDiagnostic, safeIdentityDiagnostic, safeExtractionDiagnostic, resolverStatuses } from '../../shared/media-advice-diagnostics.mjs';
import { createHash } from 'node:crypto';
import { initialReleaseEvidence } from '../../shared/film-release-year.mjs';
import { createDirectorVerifier } from './kinobaza-director-verifier.mjs';
import { safeDirectorProfileDiagnostic } from '../../shared/director-profile-diagnostics.mjs';
import { selectDirectorCandidates } from './director-candidate-selection.mjs';
import { possibleIrrelevantSearch, safeSearchCorrelation } from '../../shared/media-search-relevance-diagnostic.mjs';
const ENDPOINT = 'https://api.tavily.com/search';
const text = s => typeof s === 'string' && s.length <= 500 && !/[\p{C}]/u.test(s) ? s.trim() : '';
const titleNames = film => {
  const seen = new Set();
  return [film.originalTitle, film.identityTitle, ...(film.titleAliases ?? [])].map(text).filter(name => {
    const key = name.normalize('NFC').replace(/\s+/gu, ' ').toLocaleLowerCase('uk-UA');
    if (!key || seen.has(key)) return false; seen.add(key); return true;
  });
};
export function resolverQueries(film) {
  const context = film.identityContext;
  if (Number.isSafeInteger(film.tmdbId) && film.tmdbId > 0 && context?.tmdbId === film.tmdbId && Array.isArray(context.titleEvidence)) {
    const entries = context.titleEvidence;
    const english = entries.find(e => e.source === 'translation' && e.language === 'en' && text(e.title));
    const primary = text(english?.title) || text(film.originalTitle) || text(film.identityTitle);
    if (!primary) return [];
    const other = [film.identityTitle,film.originalTitle,...titleNames(film)].map(text)
      .find(n => n && n.normalize('NFC').toLocaleLowerCase('uk-UA') !== primary.normalize('NFC').toLocaleLowerCase('uk-UA'));
    const firstYear = initialReleaseEvidence(film)[0]?.year ?? film.year;
    const quoted = s => '"' + s.replace(/["\\]/g,' ') + '"';
    const build = (parts, queryYear) => [...parts, Number.isInteger(queryYear) ? queryYear : '', 'site:kinobazaua.com/titles/'].filter(Boolean).join(' ');
    const first = build([quoted(primary)], firstYear);
    const person = film.directorCount === 1 && film.directorPeople?.length === 1 ? film.directorPeople[0] : null;
    const director = person?.names?.map(text).find(n => /^[\p{Script=Latin}\p{M} .,'’()-]+$/u.test(n));
    // A confirmed earlier premiere and the primary Details year are distinct
    // search contexts. Preserve both within the same two slots, including the
    // bounded-query fallback, rather than searching the premiere year twice.
    const second = build([quoted(primary),other ? quoted(other) : '',director ? quoted(director) : ''], film.year);
    return [first,second.length <= 550 ? second : build([other ? quoted(other) : primary.replace(/["\\]/g,' ')], film.year)];
  }
  const names = titleNames(film).slice(0, 2), clean = s => s.replace(/["\\]/g, ' ');
  const query = name => [name, Number.isInteger(film.year) ? film.year : '', 'site:kinobazaua.com/titles/'].filter(Boolean).join(' ');
  return names.length ? [query('"' + clean(names[0]) + '"'), query(names.length > 1 ? '"' + clean(names[1]) + '"' : clean(names[0]))] : [];
}
// A discovered but identity-refused card calls for disambiguation, not a
// transport retry. Combine two independently established names and an exact
// year token; this never supplies a slug, URL or identity evidence. Keep the
// existing alternate query for the successful zero-admitted-results path.
export function resolverRefusalQuery(film) {
  if (Number.isSafeInteger(film.tmdbId) && film.tmdbId > 0 && film.identityContext?.tmdbId === film.tmdbId) return resolverQueries(film)[1];
  const names = titleNames(film).slice(0, 2);
  if (names.length < 2) return resolverQueries(film)[1];
  const query = [...names.map(name => '"' + name.replace(/["\\]/g, ' ') + '"'),
    Number.isInteger(film.year) ? '"' + film.year + '"' : '', 'site:kinobazaua.com/titles/'].filter(Boolean).join(' ');
  // Do not double the previous single-title request bound or truncate an
  // established name. Long combinations retain the existing alternate query.
  const maximum = 500 + ['""', Number.isInteger(film.year) ? film.year : '', 'site:kinobazaua.com/titles/'].filter(Boolean).join(' ').length;
  return query.length <= maximum ? query : resolverQueries(film)[1];
}
// A separately budgeted reserve stage, not a replacement for either established
// query. Only the verified original title is an exact phrase; the selected year
// is context. Director evidence remains an identity gate, not reserve search text.
export function resolverReserveQuery(film) {
  const original = text(film.originalTitle);
  if (!original) return null;
  const clean = value => value.replace(/["\\]/g, ' ');
  return ['"' + clean(original) + '"', Number.isInteger(film.year) ? film.year : '', 'site:kinobazaua.com/titles/'].filter(Boolean).join(' ');
}
// Existing admitted pointers only: a matching slug changes read order, never
// supplies identity evidence or a generated URL. Ties retain search order.
export function rankedCandidates(urls, film) {
  const slugs = titleNames(film).filter(name => /^[\x20-\x7e]+$/.test(name))
    .map(name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
  const score = url => {
    const slug = url.slice('https://kinobazaua.com/titles/'.length);
    return slugs.some(title => Number.isInteger(film.year) && slug === `${title}-${film.year}`) ? 2 : slugs.includes(slug) ? 1 : 0;
  };
  return [...urls].sort((a, b) => score(b) - score(a));
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
    async search(query, { signal, diagnostics = false, diagnosticSecrets = [], exactMatch = false, searchDepth = 'basic' } = {}) {
      if (!apiKey || /\s/.test(apiKey)) return { status: 'missing-or-invalid-search-key', urls: [] };
      if (signal?.aborted) return { status: 'search-timeout-no-retry', urls: [] };
      const payload = { query, search_depth: searchDepth === 'advanced' ? 'advanced' : 'basic', topic: 'general', max_results: 5,
        auto_parameters: false, include_answer: false, include_raw_content: false,
        include_images: false, include_favicon: false, include_usage: false,
        include_domains: ['kinobazaua.com'], include_domains_mode: 'restrict', ...(exactMatch === true ? { exact_match: true } : {}) };
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
        // Only results[].url informs candidates; privileged bounded correlation
        // is observational only. Missing/malformed results is not a successful
        // empty search. Content/score are discarded.
        const valid = data && !Array.isArray(data) && Array.isArray(data.results) && data.results.length <= 5 &&
          data.results.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.url === 'string');
        const accepted = valid ? candidateDiagnostics(data.results) : null;
        // Trusted local opt-in hook only, not a browser/request option. It gets
        // URL strings alone in memory, never snippets/score or the response body.
        // Admission/output are already computed; hook failure cannot change them.
        if (accepted && typeof onCandidateURLs === 'function') {
          try { onCandidateURLs(data.results.map(item => item.url)); } catch {}
        }
        const correlation = diagnostics === true ? { correlation: safeSearchCorrelation({ query: payload.query,
          requestId: data?.request_id, responseQuery: data?.query }, { secrets: [apiKey, ...diagnosticSecrets] }) } : {};
        return accepted ? { status: 'ok', urls: accepted.urls, diagnostics: accepted.diagnostics, ...correlation } : { status: 'search-invalid-response', urls: [], ...correlation };
      } catch { if (reader) void reader.cancel().catch(() => {}); return { status: combined.aborted ? 'search-timeout-no-retry' : 'search-transport-or-json-error', urls: [] }; }
      finally { clearTimeout(timer); }
    },
  };
}

export function createKinobazaResolver({ apiKey, searchFactory = tavilySearch, onIdentityDiagnostic } = {}) {
  return async (film, { reserve, fetchImpl, calls, signal, sourceCap = 8, tmdbToken, diagnostics = false, diagnosticSecrets = [] }) => {
    const queries = resolverQueries(film), cards = [], deferred = [], urls = new Set(), examined = new Set();
    const capture = diagnostics === true, searchObservations = [], cardObservations = new Map(), readCards = [];
    const secrets = [apiKey, tmdbToken, ...diagnosticSecrets].filter(s => typeof s === 'string' && s);
    const observeIdentity = capture ? diagnostic => {
      if (readCards.includes(diagnostic.sourceURL)) cardObservations.set(diagnostic.sourceURL, {
        truncated: diagnostic.truncated,
        ...(diagnostic.sourceTitleCompleteness === undefined ? {} : { sourceTitleCompleteness: {
          h1: diagnostic.sourceTitleCompleteness?.h1 === true, h2: diagnostic.sourceTitleCompleteness?.h2 === true } }),
        sourceIdentity: { h1: diagnostic.sourceIdentity?.h1?.slice(0, 2), h2: diagnostic.sourceIdentity?.h2?.slice(0, 2) } });
      if (typeof onIdentityDiagnostic === 'function') onIdentityDiagnostic(diagnostic);
    } : onIdentityDiagnostic;
    const director = createDirectorVerifier({film,tmdbToken,sourceCap,reserve,fetchImpl,calls,signal});
    const summary = { searchCalls: 0, cardCalls: 0, candidates: 0, unexamined: 0, searches: [], cards: [] };
    const reserveEnabled = sourceCap === 12;
    let selection, alternateFailure, sourceFailure = false;
    const done = (status, result = null, choices = []) => {
      summary.candidates = urls.size; summary.unexamined = urls.size - examined.size;
      summary.directorProfile = safeDirectorProfileDiagnostic({...director.diagnostic(),
        ...(selection ? {selection:selection.diagnostic} : {}),
        ...(selection?.ambiguous ? {status:'unresolved',reason:'director-profile-candidates-ambiguous'} : {})});
      for (const pending of deferred) pending.dispose();
      if (capture) {
        const possible = possibleIrrelevantSearch({ film, searches: searchObservations,
          cards: cards.map((result, index) => ({ result, url: readCards[index] })).filter(card => typeof card.url === 'string'), observations: cardObservations }, { secrets });
        if (possible) summary.possibleIrrelevantSearch = possible;
      }
      summary.status = resolverStatuses.has(status) ? status : 'unknown'; return { status, result, choices, resolver: summary };
    };
    const cardSummary = (result, cardRef) => ({ identity: result.identity?.status ?? 'unresolved', reason: result.identity?.reason ?? null,
      extraction: result.status, candidates: result.candidates?.length ?? 0, diagnostics: safeIdentityDiagnostic(result.identity?.diagnostics), cardRef,
      extractionDiagnostic: safeExtractionDiagnostic({status:result.status,issues:result.issues,
        candidateCount:result.candidates?.length ?? 0, foreignCandidateCount:(result.candidates??[]).filter(c=>c.territory && c.territory.code!=='UA').length,
        blockCount:result.localization?.blocks?.length ?? 0,filmAudioState:result.localization?.film?.ukrainianAudio?.state}) });
    if (!apiKey) return done('not-evaluated-missing-search-key');
    if (!queries.length) return done('not-evaluated-no-established-title');
    let activeProvider, sentSearchQuery, reserveSearch = false;
    const searchFetch = async (url, init) => {
      const stage = reserveSearch ? 'search-3' : `search-${summary.searchCalls + 1}`;
      if (summary.searchCalls >= (reserveEnabled ? 3 : 2) || reserveSearch && !reserveEnabled || calls.some(call => call.stage === stage) ||
          calls.length >= sourceCap || signal?.aborted || activeProvider?.accepts?.(url, init) !== true) throw Error('search-boundary');
      await reserve(stage); if (signal?.aborted) throw Error('resolver-deadline');
      summary.searchCalls++; const call = { stage, status: 'attempt-reserved' }; calls.push(call);
      if (capture) { try { sentSearchQuery = JSON.parse(init.body)?.query; } catch { sentSearchQuery = null; } }
      try { const r = await fetchImpl(url, init); call.httpStatus = r.status; call.status = 'response-received'; return r; } catch { call.status = 'transport-outcome-unknown'; throw Error('search-transport'); }
    };
    const provider = searchFactory(apiKey, searchFetch); let nextQuery = 0;
    const searchNext = async (afterIdentityRefusal = false, exactReserve = false) => {
      activeProvider = provider;
      reserveSearch = exactReserve;
      const query = exactReserve ? resolverReserveQuery(film) : afterIdentityRefusal ? resolverRefusalQuery(film) : queries[nextQuery];
      if (!exactReserve) nextQuery++;
      sentSearchQuery = null;
      const found = await activeProvider.search(query, { signal, ...(exactReserve ? { exactMatch: true, searchDepth: 'advanced' } : {}), ...(capture ? { diagnostics: true, diagnosticSecrets: secrets } : {}) });
      if (capture) searchObservations.push(safeSearchCorrelation({ query: sentSearchQuery,
        requestId: found.correlation?.requestId, responseQuery: found.correlation?.responseQuery }, { secrets }));
      summary.searches.push({ ...safeSearchDiagnostic(found.status, found.diagnostics), provider: 'tavily', ...(exactReserve ? { mode: 'reserve-exact', exactMatch: true, searchDepth: 'advanced' } : {}) });
      if (found.status === 'ok') for (const url of (found.urls ?? []).map(admitKinobazaURL).filter(Boolean)) urls.add(url);
      else sourceFailure = true;
      return found;
    };
    while (!urls.size && nextQuery < queries.length) {
      if (signal?.aborted) return done('resolver-deadline-bounded');
      const { status } = await searchNext();
      if (status !== 'ok') return done(status); // No alternate for errors.
    }
    const readCard = async (url, stage) => {
      const priorCardCalls = summary.cardCalls;
      const cardFetch = async (target, init) => {
        if (target !== url || !admitKinobazaURL(target) || examined.has(url) || calls.length >= sourceCap || signal?.aborted || init.method !== 'GET' || init.redirect !== 'manual' || calls.some(c => c.stage === stage)) throw Error('card-boundary');
        await reserve(stage); if (signal?.aborted) throw Error('resolver-deadline');
        summary.cardCalls++; examined.add(url); const call = { stage, status: 'attempt-reserved' }; calls.push(call);
        if (capture) readCards[index] = url;
        try { const r = await fetchImpl(target, init); call.httpStatus = r.status; call.status = 'response-received'; return r; } catch { call.status = 'transport-outcome-unknown'; throw Error('card-transport'); }
      };
      const index = cards.length;
      const result = await fetchAssistedKinobaza(url, film, cardFetch, { signal, onIdentityDiagnostic: observeIdentity,
        ...(sourceCap === 10 || reserveEnabled ? {verifyDirector:director.verify,onDeferredDirector:pending => deferred.push({...pending,index})} : {}) });
      cards.push(result);
      summary.cards.push(cardSummary(result,
        // Public-pointer digest for comparing a known URL offline, never a
        // capability, HTML hash, source archive or claim that a request succeeded.
        summary.cardCalls > priorCardCalls ? createHash('sha256').update(url).digest('hex') : null));
      if (summary.cardCalls === priorCardCalls || !['ok', 'partial', 'unresolved', 'unsupported-markup', 'identity-mismatch', 'identity-unresolved'].includes(result.status)) sourceFailure = true;
      return { result, dispatched: summary.cardCalls > priorCardCalls };
    };
    for (let i = 0; i < 2; i++) {
      if (signal?.aborted) break;
      const url = rankedCandidates(urls, film).find(candidate => !examined.has(candidate));
      if (!url) break;
      const { result, dispatched } = await readCard(url, `kinobaza-${summary.cardCalls + 1}`);
      if (!dispatched) break; // A denied reservation is not a retry opportunity.
      if (i === 0 && ['mismatch', 'unresolved'].includes(result.identity?.status) && nextQuery < queries.length) {
        if (signal?.aborted) break;
        // A successful search whose first card fails identity can spend the
        // second slot on Tavily's verified two-title/year disambiguation (or
        // existing single-title alternative). Shared slot accounting with
        // empty results: never a third search, source /search or error retry.
        const { status } = await searchNext(true);
        if (status !== 'ok') {
          // A failed disambiguation cannot discard an already-read eligible
          // card. Finish its bounded proof, without retrying the search or
          // reading another card; retain the exact search error in diagnostics.
          if (deferred.length) { alternateFailure = status; break; }
          return done(status);
        }
      }
    }
    // Both bounded card reads retain their opportunities before the only person
    // pair is allocated. Resume the SAME validated DOM, never refetch a card or
    // infer proof from this ordering. Equal different profiles remain unresolved.
    const resumeDirectors = async pendingCards => {
      selection = selectDirectorCandidates(pendingCards);
      for (const pending of selection.selected) {
        if (signal?.aborted) break;
        const result = await pending.resume();
        cards[pending.index] = result;
        // Later reserve-card allocation must inspect the actual latest gate
        // outcome, not the stale pre-profile identity held by the continuation.
        pending.identity = result.identity;
        summary.cards[pending.index] = cardSummary(result, summary.cards[pending.index].cardRef);
      }
    };
    if (deferred.length) await resumeDirectors(deferred);
    // Reserve exact search is a last opportunity after the complete old path,
    // including its one optional linked-person proof. It never hides a retry
    // after a failed transport/reservation or changes a successful first pair.
    const personDiagnostic = director.diagnostic();
    const personSourceFailure = personDiagnostic.attempts.some(attempt => attempt.status !== 'response-received' ||
      !Number.isInteger(attempt.httpStatus) || attempt.httpStatus < 200 || attempt.httpStatus >= 300) ||
      /^director-(?:tmdb-|profile-(?:redirect|auth|access|not-returned|quota|http|invalid-content|response-too-large|challenge|timeout|network|verification)|reservation|deadline|unsafe)/.test(personDiagnostic.reason);
    if (reserveEnabled && !cards.some(card => card.identity?.status === 'matched') && !sourceFailure && !personSourceFailure &&
        !signal?.aborted && calls.length <= sourceCap - 2 && resolverReserveQuery(film)) {
      const found = await searchNext(false, true);
      if (found.status !== 'ok') return done(found.status);
      // The extra read must be justified by this exact search. A duplicate-only
      // or empty response does not authorize another old candidate/card read.
      const reserveURLs = (found.urls ?? []).map(admitKinobazaURL).filter(url => url && !examined.has(url));
      const url = rankedCandidates(reserveURLs, film)[0];
      if (url && calls.length < sourceCap && !signal?.aborted) {
        const deferredBefore = deferred.length;
        await readCard(url, 'kinobaza-3');
        // Exact search is not stronger film/person evidence. Reconsider all
        // still-unconfirmed eligible cards together, preserving an earlier tie
        // between different profiles rather than favoring the newest pointer.
        if (deferred.length > deferredBefore) await resumeDirectors(deferred);
      }
    }
    summary.unexamined = urls.size - examined.size;
    const confirmed = cards.filter(c => c.identity?.status === 'matched');
    if (confirmed.length > 1) return done('multiple-confirmed-cards-choose', null, confirmed);
    if (confirmed.length === 1) return done(alternateFailure ? 'partial' : summary.unexamined ? 'one-confirmed-bounded-not-exhaustive' : confirmed[0].status, confirmed[0]);
    return done(alternateFailure ?? (!urls.size ? 'no-admitted-search-candidates' : summary.unexamined ? 'bounded-unresolved' : 'no-confirmed-card'));
  };
}
