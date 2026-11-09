// Direct official API only. No SDK, LLM, destination fetch, cache or raw archive.
import { HELD_OUT_FILMS } from './held-out.mjs';
import { MOTN_SOURCE, MOTN_ATTRIBUTION, MOTN_TIMEOUT_MS, MOTN_LIMIT_BYTES, normalizeMotnFor, fetchMotnFor } from '../../netlify/lib/media-source-motn.mjs';
export { MOTN_SOURCE, MOTN_ATTRIBUTION, MOTN_TIMEOUT_MS, MOTN_LIMIT_BYTES, normalizeMotnFor, fetchMotnFor };
// Copied scalar identifiers only, not an import/dependency on PR #173. Provenance
// and the original page/search evidence (not an API crosswalk) are in the README.
export const MOTN_FILMS = Object.freeze({
  coherence: Object.freeze({ imdbId: 'tt2866360', tmdbId: '220289', title: 'Coherence', year: 2013, director: 'James Ward Byrkit' }),
  'dune-part-two': Object.freeze({ imdbId: 'tt15239678', tmdbId: '693134', title: 'Dune: Part Two', year: 2024, director: 'Denis Villeneuve' }),
  ...Object.fromEntries(Object.entries(HELD_OUT_FILMS).map(([id, f]) => [id, Object.freeze({
    imdbId: f.imdbId, tmdbId: String(f.tmdbId), title: f.identityTitle, year: f.year,
    director: f.director, titleAliases: f.titleAliases, directorAliases: f.directorAliases,
  })])),
});

export function motnScenario(film, { discovery, amazonRegion, urlSource } = {}) {
  if (!Object.hasOwn(MOTN_FILMS, film.id) || discovery !== 'digital-ua' || amazonRegion !== undefined || urlSource !== undefined) {
    throw new Error('motn-api requires digital-ua, Coherence/Dune, and unset DEMO_AMAZON_REGION and DEMO_URL_SOURCE.');
  }
  const identity = MOTN_FILMS[film.id];
  return Object.freeze({ film, discovery, amazonRegion: null, retrieval: 'motn-api', country: 'ua', prompt: null,
    sourceURL: `https://api.movieofthenight.com/v4/shows/${identity.imdbId}?country=ua`,
    operation: 'One GET of this fixed IMDb title with country=ua. Show only UA options. No LLM, country lookup, destinations, redirects or retries. Missing data is unknown; aggregator metadata is not account entitlement.' });
}

export function normalizeMotn(data, filmId, receivedAt = new Date().toISOString()) {
  const expected = Object.hasOwn(MOTN_FILMS, filmId) ? MOTN_FILMS[filmId] : undefined;
  if (!expected) throw new Error('Fixed Movie of the Night film required.');
  return normalizeMotnFor(data, expected, receivedAt);
}
export async function fetchMotn(selection, apiKey, fetchImpl = globalThis.fetch, { timeoutMs = MOTN_TIMEOUT_MS, maxBytes = MOTN_LIMIT_BYTES } = {}) {
  const verified = motnScenario(selection.film, { discovery: selection.discovery });
  if (selection.retrieval !== 'motn-api' || selection.country !== 'ua' || selection.sourceURL !== verified.sourceURL) throw new Error('Fixed UA API request required.');
  return fetchMotnFor(MOTN_FILMS[selection.film.id], apiKey, fetchImpl, { timeoutMs, maxBytes });
}
// Authored mock data only: example.com, invented services/prices/locales.
export function syntheticMotn(filmId) {
  const f = Object.hasOwn(MOTN_FILMS, filmId) ? MOTN_FILMS[filmId] : undefined;
  if (!f) throw new Error('Fixed synthetic film required.');
  return { showType: 'movie', imdbId: f.imdbId, tmdbId: `movie/${f.tmdbId}`, originalTitle: f.title,
    releaseYear: f.year, directors: [f.director], streamingOptions: {
      ua: [{ service: { id: 'example', name: 'SYNTHETIC Example service' }, type: 'rent',
        link: 'https://example.com/invented?x=%2F&y=1', audios: [{ language: 'ukr' }],
        subtitles: [{ locale: { language: 'eng' }, closedCaptions: true }], quality: 'uhd', price: { amount: '1.23', currency: 'XXX' } },
      { service: { id: 'example', name: 'SYNTHETIC Example service' }, type: 'buy', link: 'https://example.com/invented-buy', audios: [] }],
      gb: [{ service: { id: 'foreign', name: 'SYNTHETIC Foreign must not display' }, link: 'https://example.com/foreign' }],
    } };
}
