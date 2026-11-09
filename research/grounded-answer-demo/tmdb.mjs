// Isolated fixed-ID, non-LLM probe. No production key reuse or destination fetch.
import { HELD_OUT_FILMS } from './held-out.mjs';
import { TMDB_TIMEOUT_MS, TMDB_LIMIT_BYTES, readTmdbJson, projectTmdbIdentityFor, projectTmdbProvidersFor } from '../../netlify/lib/media-source-tmdb.mjs';
export { TMDB_TIMEOUT_MS, TMDB_LIMIT_BYTES, readTmdbJson, projectTmdbIdentityFor, projectTmdbProvidersFor };
export const TMDB_FILMS = Object.freeze({
  coherence: Object.freeze({ tmdbId: 220289, imdbId: 'tt2866360' }),
  'dune-part-two': Object.freeze({ tmdbId: 693134, imdbId: 'tt15239678' }),
  ...Object.fromEntries(Object.entries(HELD_OUT_FILMS).map(([id, f]) => [id, Object.freeze({ tmdbId: f.tmdbId, imdbId: f.imdbId })])),
});
const APPEND = 'external_ids,alternative_titles,credits,release_dates,translations';
export function tmdbScenario(film, { discovery, amazonRegion, urlSource } = {}) {
  if (!Object.hasOwn(TMDB_FILMS, film.id) || discovery !== 'digital-ua' || amazonRegion !== undefined || urlSource !== undefined) {
    throw new Error('tmdb-data requires digital-ua, Coherence/Dune, and unset DEMO_AMAZON_REGION and DEMO_URL_SOURCE.');
  }
  const ids = TMDB_FILMS[film.id];
  const sourceURL = `https://api.themoviedb.org/3/movie/${ids.tmdbId}?language=uk-UA&append_to_response=${APPEND}`;
  const providersURL = `https://api.themoviedb.org/3/movie/${ids.tmdbId}/watch/providers`;
  return Object.freeze({ film, ...ids, discovery, amazonRegion: null, retrieval: 'tmdb-data', country: 'UA', locale: 'uk-UA',
    sourceURL, providersURL, prompt: null,
    operation: 'A: fixed Details GET with five appended metadata resources. B: Watch Providers GET only if identity passes; inspect results.UA only. Maximum two serial HTTP requests per session; no fallback, retry, LLM, country lookup, logos, destinations or storage. Catalogue languages are not provider tracks. Live readiness is conditional on applicable current terms review.' });
}

const safeText = (v, max = 500) => typeof v === 'string' && v.length <= max && !/[\p{C}]/u.test(v);
export function projectTmdbIdentity(data, filmId, receivedAt = new Date().toISOString()) {
  const expected = Object.hasOwn(TMDB_FILMS, filmId) ? TMDB_FILMS[filmId] : undefined;
  if (!expected) throw new Error('Fixed TMDb film required.');
  return projectTmdbIdentityFor(data, expected, receivedAt);
}
export function projectTmdbProviders(data, filmId, receivedAt = new Date().toISOString()) {
  const expected = Object.hasOwn(TMDB_FILMS, filmId) ? TMDB_FILMS[filmId] : undefined;
  if (!expected) throw new Error('Fixed TMDb film required.');
  return projectTmdbProvidersFor(data, expected, receivedAt);
}
export async function fetchTmdb(selection, token, fetchImpl = globalThis.fetch, { timeoutMs = TMDB_TIMEOUT_MS, maxBytes = TMDB_LIMIT_BYTES } = {}) {
  const verified = tmdbScenario(selection.film, { discovery: selection.discovery, amazonRegion: selection.amazonRegion ?? undefined, urlSource: selection.urlSource });
  if (selection.retrieval !== 'tmdb-data' || selection.country !== 'UA' || selection.sourceURL !== verified.sourceURL || selection.providersURL !== verified.providersURL || selection.locale !== verified.locale) throw new Error('Fixed TMDb request required.');
  const base = { source: 'TMDB', country: 'UA', locale: 'uk-UA', requestsMade: 0, providers: { status: 'not-requested', reason: 'A did not pass identity.' } };
  if (!token || !safeText(token, 4096) || /\s/u.test(token)) return { ...base, identity: { status: !token ? 'missing-token-no-request' : 'invalid-token-no-request' } };
  const a = await readTmdbJson(verified.sourceURL, token, fetchImpl, { timeoutMs, maxBytes });
  const receivedAt = new Date().toISOString();
  const identity = a.status === 'ok' ? { ...projectTmdbIdentity(a.data, selection.film.id, receivedAt), httpStatus: a.httpStatus } : { ...a, receivedAt, source: 'TMDB' };
  if (identity.identity?.status !== 'matched') return { ...base, requestsMade: 1, identity };
  const b = await readTmdbJson(verified.providersURL, token, fetchImpl, { timeoutMs, maxBytes });
  const providersAt = new Date().toISOString();
  const providers = b.status === 'ok' ? { ...projectTmdbProviders(b.data, selection.film.id, providersAt), httpStatus: b.httpStatus } : { ...b, receivedAt: providersAt, source: 'TMDB / JustWatch', country: 'UA' };
  return { ...base, requestsMade: 2, identity, providers };
}

// Authored mock only. No real localized titles, providers or watch links asserted.
export function syntheticTmdb(filmId) {
  const f = Object.hasOwn(TMDB_FILMS, filmId) ? TMDB_FILMS[filmId] : undefined; if (!f) throw new Error('Fixed TMDb film required.');
  return { details: { id: f.tmdbId, imdb_id: f.imdbId, title: 'SYNTHETIC requested title', original_title: 'SYNTHETIC original title', release_date: '2000-01-01', original_language: 'en', spoken_languages: [{ iso_639_1: 'en' }],
    external_ids: { imdb_id: f.imdbId },
    alternative_titles: { titles: [{ iso_3166_1: 'UA', title: 'SYNTHETIC country alias', type: '' }] },
    credits: { crew: [{ id: 999999, job: 'Director', name: 'SYNTHETIC director', original_name: 'SYNTHETIC director' }] },
    release_dates: { results: [{ iso_3166_1: 'UA', release_dates: [{ release_date: '2000-02-01T00:00:00Z', type: 4, iso_639_1: '' }] }] },
    translations: { translations: [{ iso_639_1: 'uk', iso_3166_1: 'UA', data: { title: 'ВИГАДАНА назва', overview: 'SYNTHETIC prose not displayed', tagline: '' } }] } },
    providers: { id: f.tmdbId, results: { UA: { flatrate: [{ provider_id: 999999, provider_name: 'SYNTHETIC service', logo_path: '/not-fetched.png', display_priority: 10 }], rent: [], buy: [{ provider_id: 999999, provider_name: 'SYNTHETIC service' }] }, GB: { rent: [{ provider_name: 'SYNTHETIC foreign must not display' }] } } } };
}
export function projectSyntheticTmdb(filmId) {
  const data = syntheticTmdb(filmId);
  return { source: 'TMDB', country: 'UA', locale: 'uk-UA', requestsMade: 0,
    identity: projectTmdbIdentity(data.details, filmId), providers: projectTmdbProviders(data.providers, filmId) };
}
