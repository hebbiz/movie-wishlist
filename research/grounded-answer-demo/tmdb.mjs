// Isolated fixed-ID, non-LLM probe. No production key reuse or destination fetch.
export const TMDB_TIMEOUT_MS = 20_000;
export const TMDB_LIMIT_BYTES = 2 * 1024 * 1024;
export const TMDB_FILMS = Object.freeze({
  coherence: Object.freeze({ tmdbId: 220289, imdbId: 'tt2866360' }),
  'dune-part-two': Object.freeze({ tmdbId: 693134, imdbId: 'tt15239678' }),
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

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeText = (v, max = 500) => typeof v === 'string' && v.length <= max && !/[\p{C}]/u.test(v);
const invalid = () => ({ state: 'invalid' });
const absent = v => ({ state: v === null ? 'null' : 'missing' });
function scalar(v, valid = v => safeText(v)) {
  if (v === undefined || v === null) return absent(v);
  if (!valid(v)) return invalid();
  return { state: v === '' ? 'reported-empty' : 'reported', value: v };
}
const id = v => scalar(v, v => Number.isSafeInteger(v) && v > 0);
function list(v, project, limit = 2000) {
  if (v === undefined || v === null) return absent(v);
  if (!Array.isArray(v) || v.length > limit) return invalid();
  return { state: v.length ? 'reported' : 'reported-empty', items: v.map(project) };
}
function presence(v) {
  return v === undefined || v === null ? absent(v) : !safeText(v, 100_000) ? invalid() : { state: v.trim() ? 'reported-nonempty' : 'reported-empty' };
}
function appended(data, name, expectedId, issues) {
  const v = data[name];
  if (v === undefined || v === null) { issues.push(`${name}: ${v === null ? 'null' : 'missing'}; no fallback request.`); return { state: v === null ? 'null' : 'missing' }; }
  // Appended objects inherit the validated parent movie context. The standalone
  // endpoint's id is not a required repeated field; validate it when supplied.
  if (!object(v) || (Object.hasOwn(v, 'id') && v.id !== expectedId) || v.success === false || Object.hasOwn(v, 'status_code')) {
    issues.push(`${name}: invalid object, supplied ID or API error; fields not evaluated.`); return invalid();
  }
  return { state: 'reported', data: v };
}
export function projectTmdbIdentity(data, filmId, receivedAt = new Date().toISOString()) {
  const expected = Object.hasOwn(TMDB_FILMS, filmId) ? TMDB_FILMS[filmId] : undefined;
  if (!expected) throw new Error('Fixed TMDb film required.');
  const base = { source: 'TMDB', receivedAt, issues: [] };
  if (!object(data)) return { ...base, status: 'invalid-response', identity: { status: 'unresolved' } };
  const issues = [];
  const sub = Object.fromEntries(APPEND.split(',').map(name => [name, appended(data, name, expected.tmdbId, issues)]));
  const ext = sub.external_ids.data;
  const imdbValid = v => typeof v === 'string' && /^tt\d+$/.test(v);
  const imdbValues = [data.imdb_id, object(data.external_ids) ? data.external_ids.imdb_id : undefined];
  const hasImdb = v => v !== undefined && v !== null && v !== '';
  const idConflict = (Number.isSafeInteger(data.id) && data.id > 0 && data.id !== expected.tmdbId) ||
    APPEND.split(',').some(name => object(data[name]) && Number.isSafeInteger(data[name].id) && data[name].id > 0 && data[name].id !== expected.tmdbId) ||
    imdbValues.some(v => imdbValid(v) && v !== expected.imdbId);
  const status = idConflict ? 'mismatch' : data.id !== expected.tmdbId || imdbValues.some(v => hasImdb(v) && !imdbValid(v)) ? 'unresolved' : 'matched';
  const identity = { status, tmdbId: id(data.id), detailsImdb: scalar(data.imdb_id, imdbValid), externalImdb: scalar(ext?.imdb_id, imdbValid),
    crosswalk: imdbValues.some(imdbValid) ? 'reported-match' : 'unknown',
    basis: 'Exact primary TMDb ID; all supplied stable IDs must agree. Missing IMDb is unknown. Dates/titles alone do not override IDs; no numeric confidence.' };
  if (status !== 'matched') identity.crosswalk = 'not-established';
  // No full overview/tagline/cast/social IDs or global raw response is retained.
  const alternatives = sub.alternative_titles.data;
  const credits = sub.credits.data;
  const dates = sub.release_dates.data;
  const translations = sub.translations.data;
  const metadata = {
    originalTitle: scalar(data.original_title), requestedTitle: scalar(data.title), releaseDate: scalar(data.release_date),
    originalLanguage: scalar(data.original_language),
    spokenLanguages: list(data.spoken_languages, l => object(l) ? { language: scalar(l.iso_639_1) } : invalid()),
    externalIds: { state: sub.external_ids.state },
    alternativeTitles: alternatives ? list(alternatives.titles, a => object(a) ? { country: scalar(a.iso_3166_1), title: scalar(a.title), type: scalar(a.type) } : invalid()) : { state: sub.alternative_titles.state },
    directors: credits ? list(credits.crew, c => c, 5000) : { state: sub.credits.state },
    releaseDates: dates ? list(dates.results, c => object(c) ? { country: scalar(c.iso_3166_1), dates: list(c.release_dates, d => object(d) ? {
      date: scalar(d.release_date), type: scalar(d.type, Number.isInteger), language: scalar(d.iso_639_1) } : invalid()) } : invalid()) : { state: sub.release_dates.state },
    translations: translations ? list(translations.translations, t => object(t) ? { language: scalar(t.iso_639_1), country: scalar(t.iso_3166_1),
      title: scalar(t.data?.title), overview: presence(t.data?.overview), tagline: presence(t.data?.tagline) } : invalid()) : { state: sub.translations.state },
  };
  if (metadata.directors.items) {
    if (metadata.directors.items.some(c => !object(c))) metadata.directors = invalid();
    else {
      metadata.directors.items = metadata.directors.items.filter(c => c.job === 'Director').map(c => ({ id: id(c.id), name: scalar(c.name), originalName: scalar(c.original_name) }));
      metadata.directors.state = metadata.directors.items.length ? 'reported' : 'reported-empty';
    }
  }
  const ukTitles = (metadata.translations.items ?? []).filter(t => t.language?.value === 'uk' && t.title?.state === 'reported' && t.title.value.trim());
  const localization = { ukrainianCatalogueTitle: ukTitles.length ? 'explicit-uk-title-reported' : 'not-established',
    titles: ukTitles.map(t => ({ title: t.title.value, country: t.country })),
    limits: 'Explicit uk translation labels catalogue text only. Requested locale/title can fall back; UA alias is a country tag. Original/spoken languages and release events do not prove provider dubbing/subtitles. No provider audio/video/price fields supplied by these endpoints.' };
  if (JSON.stringify(metadata).includes('"state":"invalid"')) issues.push('One or more metadata fields are invalid; not inferred or retried.');
  const resources = Object.fromEntries(APPEND.split(',').map(name => [name, { state: sub[name].state }]));
  return { ...base, status: status !== 'matched' ? `identity-${status}` : issues.length ? 'partial' : 'ok', identity, resources, metadata, localization, issues };
}

export function projectTmdbProviders(data, filmId, receivedAt = new Date().toISOString()) {
  const expected = Object.hasOwn(TMDB_FILMS, filmId) ? TMDB_FILMS[filmId] : undefined;
  if (!expected) throw new Error('Fixed TMDb film required.');
  const base = { source: 'TMDB / JustWatch', receivedAt, country: 'UA', buckets: [] };
  if (!object(data) || data.id !== expected.tmdbId) return { ...base, status: 'invalid-response-or-id',
    identity: { status: object(data) && Number.isSafeInteger(data.id) && data.id > 0 ? 'mismatch' : 'unresolved',
      tmdbId: id(data?.id), expectedTmdbId: expected.tmdbId } };
  if (!object(data.results)) return { ...base, status: 'invalid-results' };
  const ua = data.results.UA;
  if (ua === undefined || ua === null) return { ...base, status: 'ok', uaState: ua === null ? 'null' : 'missing' };
  if (!object(ua)) return { ...base, status: 'invalid-UA', uaState: 'invalid' };
  const watchLink = scalar(ua.link, v => {
    if (!safeText(v, 16_384) || /[\\\s]/u.test(v)) return false;
    try { const u = new URL(v); return u.protocol === 'https:' && ['www.themoviedb.org', 'themoviedb.org'].includes(u.hostname) && !u.username && !u.password; } catch { return false; }
  });
  const known = ['flatrate', 'rent', 'buy', 'ads'];
  const names = [...new Set([...known, ...Object.keys(ua).filter(k => k !== 'link')])];
  if (names.length > 50) return { ...base, status: 'invalid-UA', uaState: 'invalid' };
  const buckets = names.map(name => ({ name: safeText(name, 100) ? name : '(invalid bucket name)',
    access: known.includes(name) ? ({ flatrate: 'subscription', rent: 'rental', buy: 'purchase', ads: 'ad-supported' })[name] : 'unknown bucket — not remapped',
    providers: list(ua[name], p => object(p) ? { id: id(p.provider_id), name: scalar(p.provider_name), logoPath: scalar(p.logo_path),
      displayPriority: scalar(p.display_priority, v => Number.isInteger(v) && v >= 0) } : invalid(), 200) }));
  const invalidFields = JSON.stringify({ watchLink, buckets }).includes('"state":"invalid"');
  return { ...base, status: invalidFields ? 'partial' : 'ok', uaState: Object.keys(ua).length ? 'reported' : 'reported-empty', watchLink, buckets,
    limits: 'Country watch-page link is not a provider deep link. Source ordering is not confidence/quality. Missing UA/buckets do not mean unavailable; aggregate signals are not account entitlement. No offer audio/subtitle/quality/price inference.' };
}

// Bounded serial transport: exactly one attempt at each planned URL, at most two.
async function readJson(url, token, fetchImpl, { timeoutMs, maxBytes }) {
  const controller = new AbortController(); let reader;
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const bounded = p => Promise.race([p, aborted]);
  try {
    const response = await bounded(fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: controller.signal }));
    const stop = status => { void response.body?.cancel().catch(() => {}); return { status, httpStatus: response.status }; };
    if (response.status >= 300 && response.status < 400) return stop('redirect-not-followed');
    if (!response.ok) return stop(({ 401: 'api-auth-error', 403: 'api-access-denied', 404: 'title-not-returned', 429: 'quota-or-rate-limit' })[response.status] ?? 'api-http-error');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return stop('invalid-content-type');
    if (Number(response.headers.get('content-length')) > maxBytes) return stop('response-too-large');
    if (!response.body) return { status: 'invalid-response', httpStatus: response.status };
    reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await bounded(reader.read()); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); return { status: 'response-too-large', httpStatus: response.status }; }
      chunks.push(value);
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
    const data = JSON.parse(text);
    if (JSON.stringify(data).includes(token)) return { status: 'unsafe-response-withheld', httpStatus: response.status };
    return { status: 'ok', httpStatus: response.status, data };
  } catch {
    if (reader) void reader.cancel().catch(() => {});
    return { status: controller.signal.aborted ? 'timeout-no-retry' : 'invalid-or-network-response-no-retry' };
  } finally { clearTimeout(timer); }
}
export async function fetchTmdb(selection, token, fetchImpl = globalThis.fetch, { timeoutMs = TMDB_TIMEOUT_MS, maxBytes = TMDB_LIMIT_BYTES } = {}) {
  const verified = tmdbScenario(selection.film, { discovery: selection.discovery, amazonRegion: selection.amazonRegion ?? undefined, urlSource: selection.urlSource });
  if (selection.retrieval !== 'tmdb-data' || selection.country !== 'UA' || selection.sourceURL !== verified.sourceURL || selection.providersURL !== verified.providersURL || selection.locale !== verified.locale) throw new Error('Fixed TMDb request required.');
  const base = { source: 'TMDB', country: 'UA', locale: 'uk-UA', requestsMade: 0, providers: { status: 'not-requested', reason: 'A did not pass identity.' } };
  if (!token || !safeText(token, 4096) || /\s/u.test(token)) return { ...base, identity: { status: !token ? 'missing-token-no-request' : 'invalid-token-no-request' } };
  const a = await readJson(verified.sourceURL, token, fetchImpl, { timeoutMs, maxBytes });
  const receivedAt = new Date().toISOString();
  const identity = a.status === 'ok' ? { ...projectTmdbIdentity(a.data, selection.film.id, receivedAt), httpStatus: a.httpStatus } : { ...a, receivedAt, source: 'TMDB' };
  if (identity.identity?.status !== 'matched') return { ...base, requestsMade: 1, identity };
  const b = await readJson(verified.providersURL, token, fetchImpl, { timeoutMs, maxBytes });
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
