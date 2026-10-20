// M3.1 + assisted M3.2: page-scoped projections, never raw bodies or cross-run cache.
import { randomBytes, createHash } from 'node:crypto';
import { readTmdbJson, projectTmdbIdentityFor, projectTmdbProvidersFor } from './tmdb.mjs';
import { fetchMotnFor } from './motn.mjs';
import { composeDiscovery } from './discovery.mjs';
import { describeDiscovery } from './matching.mjs';
import { admitKinobazaURL, fetchAssistedKinobaza } from './assisted-kinobaza.mjs';
import { authoredAssistedHtml } from './film-workflow-synthetic.mjs';
import { extractHtml } from './html-source.mjs';
import { assistedIdentity } from './assisted-kinobaza.mjs';
import { authoredFilmSearch, authoredFilmDetails, authoredFilmProviders, authoredFilmMotn } from './film-workflow-synthetic.mjs';

const nonce = () => randomBytes(32).toString('hex');
const validId = n => Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647;
const imdb = v => typeof v === 'string' && /^tt\d{1,20}$/.test(v);
const value = f => f?.state === 'reported' ? f.value : null;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const label = (s, max = 160) => typeof s === 'string' && s.trim() && s.length <= max && !/[\p{C}]/u.test(s) && !/https?:|[<>]/i.test(s) ? s.trim() : null;
const api = 'https://api.themoviedb.org/3';
export const DETAILS_APPEND = 'external_ids,alternative_titles,credits,release_dates,translations';
export const detailsURL = id => { if (!validId(id)) throw new Error('Invalid selected ID'); return `${api}/movie/${id}?language=uk-UA&append_to_response=${DETAILS_APPEND}`; };
const keyOK = s => typeof s === 'string' && s.length > 0 && s.length <= 4096 && !/[\s\p{C}]/u.test(s);
const empty = () => ({ search: 0, preview: 0, discovery: 0 });
export function projectFilmSearch(data) {
  if (!object(data) || data.success === false || Object.hasOwn(data, 'status_code') || !Array.isArray(data.results) || data.results.length > 100) return null;
  const seen = new Set(), results = [];
  for (const row of data.results.slice(0, 8)) {
    if (!object(row) || row.adult === true || !validId(row.id) || seen.has(row.id) || row.media_type && row.media_type !== 'movie') continue;
    const title = label(row.title), originalTitle = label(row.original_title);
    if (!title && !originalTitle) continue;
    seen.add(row.id);
    results.push({ tmdbId: row.id, title: title ?? originalTitle, originalTitle,
      year: typeof row.release_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.release_date) ? Number(row.release_date.slice(0, 4)) : null });
  }
  return data.results.length && !results.length ? null : results;
}

export function createFilmWorkflows({ mode = 'synthetic', tmdbToken = '', motnKey = '', fetchImpl = globalThis.fetch,
  timeoutMs = 20_000, maxBytes = 2 * 1024 * 1024, now = Date.now } = {}) {
  const pages = new Map();
  const retire = p => { clearTimeout(p.expiryTimer); p.controller?.abort(); p.revision++; p.candidates.clear(); p.selected = null; p.snapshot = null; p.card = null; p.queries.clear(); p.inspected.clear(); p.calls = []; pages.delete(p.id); };
  const get = id => { const p = pages.get(id); if (!p || p.expires <= now()) { if (p) retire(p); return null; } return p; };
  const view = p => ({ id: p.id, actionToken: p.actionToken, counters: { ...p.counters }, uses: { ...p.uses }, cap: p.assisted ? 7 : 6,
    elapsedMs: p.start === null ? 0 : Math.round(performance.now() - p.start), phaseElapsedMs: { ...p.phaseElapsedMs } });
  const clear = p => { p.controller?.abort(); p.revision++; p.busy = false; p.candidates.clear(); p.selected = null; p.snapshot = null; p.card = null; p.confirmed = false; p.done = false; p.actionToken = nonce(); };
  const expire = () => { for (const [id] of pages) get(id); };
  function issue() {
    expire(); if (pages.size >= 100) return null;
    const p = { id: nonce(), actionToken: nonce(), expires: now() + 30 * 60_000, revision: 0, candidates: new Map(), counters: empty(), uses: empty(),
      phaseElapsedMs: empty(), calls: [], inspected: new Set(), queries: new Set(), selected: null, confirmed: false, done: false, busy: false, start: null };
    // One local cleanup timer, not polling/network/cache refresh. Purge metadata
    // even when no later request arrives to trigger lazy token cleanup.
    p.expiryTimer = setTimeout(() => retire(p), 30 * 60_000); p.expiryTimer.unref();
    pages.set(p.id, p); return view(p);
  }
  const inspect = id => { const p = get(id); return p ? view(p) : null; };
  const invalidate = id => { const p = get(id); if (!p) return null; clear(p); return view(p); };
  async function execute(id, action, token, input = {}) {
    const p = get(id);
    if (!p || p.busy || token !== p.actionToken || !['search', 'preview', 'confirm', 'discover', 'new-case', 'admit-card', 'read-card'].includes(action)) return { status: 409, payload: { status: 'expired-or-used-action' } };
    p.actionToken = nonce(); // Consume synchronously before validation/await.
    const fail = status => ({ status: 400, payload: { status, workflow: view(p) } });
    if (!object(input)) return fail('invalid-input');
    const fields = { search: ['query', 'year'], preview: ['candidate'], confirm: ['preview'], discover: [], 'new-case': [], 'admit-card': ['sourceURL'], 'read-card': ['card'] }[action];
    if (Object.keys(input).some(k => !fields.includes(k))) return fail('unsupported-input');
    if (action === 'new-case') {
      clear(p); p.assisted = false; p.counters = empty(); p.uses = empty(); p.phaseElapsedMs = empty(); p.calls = []; p.queries.clear(); p.inspected.clear(); p.start = null;
      return { status: 200, payload: { status: 'new-case', workflow: view(p) } };
    }
    if (action === 'confirm') {
      if (!p.selected || input.preview !== p.selected.ref || p.confirmed || p.done) return fail('preview-required');
      p.confirmed = true;
      return { status: 200, payload: { status: 'confirmed', film: p.selected.film, workflow: view(p) } };
    }
    if (action === 'admit-card' || action === 'read-card') {
      if (!p.snapshot || !p.confirmed || !p.done || p.uses.kinobaza >= 1) return fail('discovery-required-or-card-used');
      if (action === 'admit-card') {
        p.card = null; // A failed replacement cannot leave an older admitted URL usable.
        const sourceURL = admitKinobazaURL(input.sourceURL);
        if (!sourceURL) return fail('unsupported-kinobaza-url');
        p.assisted = true; p.counters.kinobaza ??= 0; p.uses.kinobaza ??= 0; p.phaseElapsedMs.kinobaza ??= 0;
        p.card = { ref: nonce(), sourceURL, filmId: p.selected.film.id };
        return { status: 200, payload: { status: 'card-admitted', card: { ...p.card }, workflow: view(p) } };
      }
      const card = p.card;
      if (!card || input.card !== card.ref || card.filmId !== p.selected.film.id || !admitKinobazaURL(card.sourceURL)) return fail('card-reference-unavailable');
      p.card = null; p.uses.kinobaza = 1; p.busy = true;
      const revision = p.revision, started = performance.now(), controller = new AbortController(); p.controller = controller;
      const snapshot = p.snapshot; let called = false;
      try {
        const boundedFetch = async (target, init) => {
          if (called || controller.signal.aborted || p.revision !== revision || target !== card.sourceURL || !admitKinobazaURL(target) ||
              Object.values(p.counters).reduce((a, b) => a + b, 0) >= 7 || init.method !== 'GET' || init.redirect !== 'manual' || init.credentials !== 'omit' ||
              Object.keys(init.headers).some(h => /authorization|cookie|key/i.test(h))) throw Error('Assisted request boundary');
          called = true; p.counters.kinobaza++; const call = { phase: 'kinobaza', stage: 'kinobaza', method: 'GET' }; p.calls.push(call);
          const r = await fetchImpl(target, init); call.httpStatus = r.status; return r;
        };
        let kino = mode === 'synthetic'
          ? await extractHtml(authoredAssistedHtml(snapshot.film, card.sourceURL), snapshot.film, { identityCheck: all => assistedIdentity(all, snapshot.film, card.sourceURL) })
          : await fetchAssistedKinobaza(card.sourceURL, snapshot.film, boundedFetch, { signal: controller.signal, timeoutMs: Math.min(timeoutMs, 15_000), maxBytes: Math.min(maxBytes, 2 * 1024 * 1024) });
        if (p.revision !== revision) return { status: 409, payload: { status: 'superseded' } };
        if ([tmdbToken, motnKey].filter(Boolean).some(s => JSON.stringify(kino).includes(s))) kino = { status: 'unsafe-response-withheld', candidates: [] };
        kino.sourceURL = card.sourceURL; kino.receivedAt ??= new Date().toISOString();
        if (kino.localization) kino.localization.provenance ??= { source: 'Kinobaza HTML', sourceURL: card.sourceURL, receivedAt: kino.receivedAt,
          method: 'authored synthetic assisted-card blocks; not a read page', upstream: 'not-established' };
        const elapsedMs = Math.round(performance.now() - started); p.phaseElapsedMs.kinobaza += elapsedMs;
        const stages = { ...snapshot.stages, kinobaza: { status: kino.status, result: kino, elapsedMs } };
        const result = composeDiscovery(snapshot.film, stages, { synthetic: mode === 'synthetic', sourceURLs: snapshot.sourceURLs,
          metrics: { requestsMade: Object.values(p.counters).reduce((a, b) => a + b, 0), requestBudget: 7, elapsedMs: Math.round(performance.now() - p.start), calls: p.calls.map(c => ({ ...c })) } });
        result.dynamic = true; result.assisted = true; result.matching = describeDiscovery(result, snapshot.expected);
        result.assistedContribution = { status: kino.status, identity: kino.identity?.status ?? 'unresolved', reason: kino.identity?.reason ?? kino.issues?.[0] ?? null,
          candidates: kino.identity?.status === 'matched' ? kino.candidates?.length ?? 0 : 0, rowsAdded: result.rows.filter(r => r.id.startsWith('kinobaza:')).length,
          blocks: kino.identity?.status === 'matched' ? kino.localization?.blocks?.length ?? 0 : 0 };
        return { status: 200, payload: { status: 'card-complete', result, workflow: view(p) } };
      } catch { return p.revision !== revision ? { status: 409, payload: { status: 'superseded' } } : { status: 502, payload: { status: 'action-failed-no-retry', workflow: view(p) } }; }
      finally { if (p.revision === revision) p.busy = false; }
    }
    let url, selected;
    if (action === 'search') {
      if (typeof input.query !== 'string' || input.query.trim().length < 2 || input.query.length > 160 || /[\p{C}]/u.test(input.query) ||
        input.year !== undefined && input.year !== '' && (typeof input.year !== 'string' || !/^\d{4}$/.test(input.year))) return fail('invalid-query-or-year');
      if (p.uses.search >= 2) return fail('search-cap');
      const hash = createHash('sha256').update(JSON.stringify([input.query.trim(), input.year ?? ''])).digest('hex');
      if (p.queries.has(hash)) return fail('same-query-no-retry');
      p.queries.add(hash); p.uses.search++; clear(p); p.start ??= performance.now();
      const u = new URL(`${api}/search/movie`); u.searchParams.set('query', input.query.trim()); u.searchParams.set('language', 'uk-UA');
      u.searchParams.set('include_adult', 'false'); u.searchParams.set('page', '1'); if (input.year) u.searchParams.set('year', input.year); url = u.href;
    } else if (action === 'preview') {
      selected = p.candidates.get(input.candidate);
      if (!selected || p.uses.preview >= 2 || p.inspected.has(selected.tmdbId)) return fail('candidate-unavailable-or-preview-cap');
      p.uses.preview++; p.inspected.add(selected.tmdbId); p.selected = null; p.confirmed = false; p.done = false;
      url = detailsURL(selected.tmdbId);
    } else {
      if (!p.selected || !p.confirmed || p.done || p.uses.discovery >= 1) return fail('confirmed-preview-required-or-discovery-used');
      p.done = true; p.uses.discovery++; selected = p.selected; url = `${api}/movie/${selected.film.tmdbId}/watch/providers`;
    }
    p.busy = true; const revision = p.revision, controller = new AbortController(); p.controller = controller;
    const started = performance.now(), allowed = new Set([url]);
    if (action === 'discover' && selected.film.imdbId) allowed.add(`https://api.movieofthenight.com/v4/shows/${selected.film.imdbId}?country=ua`);
    const seen = new Set();
    const boundedFetch = async (target, init) => {
      if (controller.signal.aborted || p.revision !== revision || !allowed.has(target) || seen.has(target) || Object.values(p.counters).reduce((a, b) => a + b, 0) >= 6 ||
        p.counters[action === 'discover' ? 'discovery' : action] >= 2 || init.redirect !== 'manual') throw new Error('Request boundary');
      seen.add(target); p.counters[action === 'discover' ? 'discovery' : action]++;
      const call = { phase: action === 'discover' ? 'discovery' : action, stage: target.startsWith(api) ? 'tmdb' : 'motn', method: 'GET' }; p.calls.push(call);
      const r = await fetchImpl(target, { ...init, signal: AbortSignal.any([controller.signal, init.signal]) }); call.httpStatus = r.status; return r;
    };
    const read = async target => {
      if (mode === 'synthetic') return { status: 'ok', data: action === 'search' ? authoredFilmSearch() : action === 'preview' ? authoredFilmDetails(selected.tmdbId) : authoredFilmProviders(selected.film.tmdbId) };
      if (!keyOK(tmdbToken)) return { status: tmdbToken ? 'invalid-token-no-request' : 'missing-token-no-request' };
      const r = await readTmdbJson(target, tmdbToken, boundedFetch, { timeoutMs, maxBytes, signal: controller.signal });
      if (r.data && [tmdbToken, motnKey].filter(Boolean).some(secret => JSON.stringify(r.data).includes(secret))) return { status: 'unsafe-response-withheld' };
      if (object(r.data) && (r.data.success === false || Object.hasOwn(r.data, 'status_code'))) return { status: 'api-error-object-withheld', httpStatus: r.httpStatus };
      return r;
    };
    try {
      let payload;
      if (action === 'search') {
        const r = await read(url), candidates = r.status === 'ok' ? projectFilmSearch(r.data) : null;
        if (p.revision !== revision) return { status: 409, payload: { status: 'superseded' } };
        for (const c of candidates ?? []) { const ref = nonce(); p.candidates.set(ref, c); }
        payload = { status: candidates ? candidates.length ? 'results' : 'no-results-for-query' : r.status === 'ok' ? 'invalid-search-response' : r.status,
          candidates: [...p.candidates].map(([ref, c]) => ({ ref, ...c })) };
      } else if (action === 'preview') {
        const r = await read(url);
        const projection = r.status === 'ok' ? projectTmdbIdentityFor(r.data, { tmdbId: selected.tmdbId }) : null;
        const subIds = r.data ? DETAILS_APPEND.split(',').some(k => object(r.data[k]) && Object.hasOwn(r.data[k], 'id') && r.data[k].id !== selected.tmdbId) : false;
        const ok = projection?.identity?.status === 'matched' && !subIds && r.data.success !== false && !Object.hasOwn(r.data, 'status_code');
        if (p.revision !== revision) return { status: 409, payload: { status: 'superseded' } };
        if (ok) {
          const title = label(value(projection.metadata.requestedTitle)) ?? label(value(projection.metadata.originalTitle)) ?? selected.title;
          const original = label(value(projection.metadata.originalTitle));
          const year = /^\d{4}-\d{2}-\d{2}$/.test(value(projection.metadata.releaseDate) ?? '') ? Number(value(projection.metadata.releaseDate).slice(0, 4)) : null;
          const directors = (projection.metadata.directors.items ?? []).flatMap(d => [label(value(d.name)), label(value(d.originalName))]).filter(Boolean).slice(0, 20);
          const imdbId = [value(projection.identity.detailsImdb), value(projection.identity.externalImdb)].find(imdb) ?? null;
          const aliases = [title, original, ...(projection.metadata.alternativeTitles.items ?? []).map(t => label(value(t.title)))].filter(Boolean).slice(0, 100);
          const film = Object.freeze({ dynamic: true, id: `tmdb:${selected.tmdbId}`, tmdbId: selected.tmdbId, imdbId, title: `${title}${year ? ` (${year})` : ''}`,
            identityTitle: title, originalTitle: original, year, director: directors[0] ?? 'Режисер не зазначений', titleAliases: aliases, directorAliases: directors });
          p.selected = { film, projection, ref: nonce() };
        }
        payload = { status: ok ? 'preview' : projection ? 'identity-unresolved-or-conflicting' : r.status, preview: ok ? { ref: p.selected.ref, film: p.selected.film,
          metadataStatus: projection.status, crosswalk: imdb(value(projection.identity.detailsImdb)) || imdb(value(projection.identity.externalImdb)) ? 'reported-match' : 'unknown',
          directors: p.selected.film.directorAliases, catalogueLanguagesNotTracks: true } : null };
      } else {
        const { film, projection } = selected;
        const expected = { ...film, tmdbId: String(film.tmdbId), title: film.originalTitle ?? film.identityTitle };
        const motnURL = film.imdbId ? `https://api.movieofthenight.com/v4/shows/${film.imdbId}?country=ua` : null;
        const timed = async fn => { const at = performance.now(); const result = await fn(); return { result, elapsedMs: Math.round(performance.now() - at) }; };
        const [bTimed, motnTimed] = await Promise.all([timed(() => read(url)), timed(() => film.imdbId
          ? mode === 'synthetic' ? authoredFilmMotn(expected) : fetchMotnFor(expected, motnKey, boundedFetch, { timeoutMs, maxBytes, signal: controller.signal })
          : { status: 'not-evaluated-missing-crosswalk', options: [] })]);
        const b = bTimed.result, motn = motnTimed.result;
        if (p.revision !== revision) return { status: 409, payload: { status: 'superseded' } };
        const cleanMotn = [tmdbToken, motnKey].filter(Boolean).some(secret => JSON.stringify(motn).includes(secret)) ? { status: 'unsafe-response-withheld', options: [] } : motn;
        const providers = b.status === 'ok' ? projectTmdbProvidersFor(b.data, film) : { status: b.status, receivedAt: new Date().toISOString() };
        const stages = { tmdb: { status: `A: ${projection.status}; B: ${providers.status}`, result: { identity: projection, providers }, elapsedMs: bTimed.elapsedMs, previewReused: true },
          motn: { status: cleanMotn.status, result: cleanMotn, elapsedMs: motnTimed.elapsedMs }, kinobaza: { status: 'disabled-no-request', result: null, elapsedMs: 0 } };
        const result = composeDiscovery(film, stages, { synthetic: mode === 'synthetic', sourceURLs: { tmdb: url, motn: motnURL },
          metrics: { requestsMade: Object.values(p.counters).reduce((a, b) => a + b, 0), requestBudget: 6, elapsedMs: Math.round(performance.now() - started), calls: p.calls.map(c => ({ ...c })) } });
        result.matching = describeDiscovery(result, expected); result.dynamic = true;
        p.snapshot = { film, stages, expected, sourceURLs: { tmdb: url, motn: motnURL } };
        payload = { status: 'complete', result };
      }
      p.phaseElapsedMs[action === 'discover' ? 'discovery' : action] += Math.round(performance.now() - started);
      return { status: 200, payload: { ...payload, workflow: view(p) } };
    } catch { return p.revision !== revision ? { status: 409, payload: { status: 'superseded' } } : { status: 502, payload: { status: 'action-failed-no-retry', workflow: view(p) } }; }
    finally { if (p.revision === revision) p.busy = false; }
  }
  return { issue, inspect, invalidate, execute, dispose() { for (const p of pages.values()) retire(p); } };
}
