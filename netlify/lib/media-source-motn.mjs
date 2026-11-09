// Generic MOTN transport/projection. No fixed-film catalogue or authored responses.
export const MOTN_SOURCE = 'Streaming Availability API by Movie of the Night';
export const MOTN_ATTRIBUTION = 'https://www.movieofthenight.com/about/api';
export const MOTN_TIMEOUT_MS = 20_000;
export const MOTN_LIMIT_BYTES = 2 * 1024 * 1024;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\p{C}]/u.test(v);
const field = value => value === undefined || value === null || value === '' ? { state: 'not-reported' } : { state: 'reported', value };
const invalid = () => ({ state: 'invalid', note: 'Unsupported or unsafe value withheld.' });
function stringField(value, max = 500) {
  if (value === undefined || value === null || value === '') return field();
  return text(value, max) ? field(value) : invalid();
}
function linkField(value) {
  const result = stringField(value, 16_384);
  if (result.state !== 'reported') return result;
  try {
    if (/[\\\s]/u.test(value)) return invalid();
    const url = new URL(value); // Validate only; do not serialize, resolve or fetch.
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return invalid();
    return result;
  } catch { return invalid(); }
}
function languageField(value, subtitles = false) {
  if (value === undefined || value === null) return { state: 'not-reported', completeness: 'not-established' };
  if (!Array.isArray(value) || value.length > 100) return invalid();
  const locales = [];
  for (const item of value) {
    const locale = subtitles ? item?.locale : item;
    if (!record(locale) || !text(locale.language, 20) || (locale.region !== undefined && !text(locale.region, 20)) ||
        (subtitles && item.closedCaptions !== undefined && typeof item.closedCaptions !== 'boolean')) return invalid();
    locales.push({ language: locale.language, ...(locale.region !== undefined ? { region: locale.region } : {}),
      ...(subtitles && item.closedCaptions !== undefined ? { closedCaptions: item.closedCaptions } : {}) });
  }
  // v4 documents ISO 639-2 (ukr); accept explicit ISO 639-1 uk as a labelled
  // provider variant too, never substrings, country codes, titles or original language.
  const ukrainian = locales.filter(l => ['ukr', 'uk'].includes(l.language.toLowerCase()));
  return { state: ukrainian.length ? 'reported' : 'not-listed-completeness-unknown',
    ukrainian, returnedLocales: locales, completeness: 'not-established' };
}
function priceField(value) {
  if (value === undefined || value === null) return field();
  if (!record(value)) return invalid();
  return { state: 'reported', amount: stringField(value.amount, 50), currency: stringField(value.currency, 10) };
}

export function normalizeMotnFor(data, expected, receivedAt = new Date().toISOString()) {
  if (!/^tt\d+$/.test(expected?.imdbId ?? '') || !/^[1-9]\d*$/.test(String(expected.tmdbId))) throw new Error('Validated IMDb crosswalk required.');
  const base = { source: MOTN_SOURCE, receivedAt, country: 'ua', options: [], issues: [] };
  if (!record(data)) return { ...base, status: 'invalid-response' };
  const title = data.originalTitle ?? data.title;
  const imdbValid = typeof data.imdbId === 'string' && /^tt\d+$/.test(data.imdbId);
  const hasTmdb = data.tmdbId !== undefined && data.tmdbId !== null && data.tmdbId !== '';
  const tmdbValid = (typeof data.tmdbId === 'string' && /^(?:(?:movie|tv)\/)?[1-9]\d*$/.test(data.tmdbId)) ||
    (Number.isSafeInteger(data.tmdbId) && data.tmdbId > 0);
  const tmdb = tmdbValid ? String(data.tmdbId) : undefined;
  const stableConflict = (imdbValid && data.imdbId !== expected.imdbId) ||
    (hasTmdb && tmdbValid && ![expected.tmdbId, `movie/${expected.tmdbId}`].includes(tmdb));
  const identityOK = !stableConflict && data.imdbId === expected.imdbId && data.showType === 'movie' &&
    (!hasTmdb || tmdbValid) &&
    (title === undefined || (expected.titleAliases ?? [expected.title]).includes(title)) &&
    (data.releaseYear === undefined || Number.isInteger(data.releaseYear)) &&
    (data.directors === undefined || (Array.isArray(data.directors) && data.directors.some(d => (expected.directorAliases ?? [expected.director]).includes(d))));
  const identityStatus = stableConflict || data.showType === 'series' ? 'mismatch' : identityOK ? 'matched' : 'unresolved';
  const identity = { status: identityStatus, imdbId: stringField(data.imdbId, 30),
    tmdbId: hasTmdb ? tmdbValid ? field(tmdb) : invalid() : field(),
    title: stringField(title), year: Number.isInteger(data.releaseYear) ? field(data.releaseYear) : field(),
    warnings: identityOK && data.releaseYear !== undefined && data.releaseYear !== expected.year
      ? ['Reported release year differs from the catalogue; exact IMDb matches and no supplied stable ID conflicts. The reason for the year difference is not established.'] : [],
    basis: 'Exact IMDb required; supplied stable-ID conflicts block options. Year alone cannot reject that match. Other ambiguous identity stays unresolved; not a cut or entitlement check.' };
  if (!identityOK) return { ...base, status: `identity-${identityStatus}`, identity, optionsState: 'withheld-identity' };
  if (!record(data.streamingOptions)) return { ...base, status: 'invalid-response', identity };
  const supplied = Object.hasOwn(data.streamingOptions, 'ua');
  const ua = supplied ? data.streamingOptions.ua : [];
  if (!Array.isArray(ua) || ua.length > 100) return { ...base, status: 'invalid-response', identity };
  const options = []; const issues = [];
  for (const [index, option] of ua.entries()) {
    if (!record(option) || (option.service !== undefined && !record(option.service))) {
      issues.push(`UA option ${index + 1}: unsupported shape; not displayed.`); continue;
    }
    const knownType = ['subscription', 'rent', 'buy', 'free', 'addon'].includes(option.type);
    const quality = option.quality === undefined || option.quality === null ? field() :
      ['sd', 'hd', 'qhd', 'uhd'].includes(option.quality) ? field(option.quality) : invalid();
    const row = { service: { id: stringField(option.service?.id, 80), name: stringField(option.service?.name) },
      access: { ...stringField(option.type, 80), ...(option.type && !knownType ? { note: 'Other/unknown provider access type; not remapped.' } : {}) },
      addon: { id: stringField(option.addon?.id, 80), name: stringField(option.addon?.name) },
      link: linkField(option.link), ukrainianAudio: languageField(option.audios),
      ukrainianSubtitles: languageField(option.subtitles, true), quality, price: priceField(option.price) };
    options.push(row);
    if ([row.service.id, row.service.name, row.access, row.link, row.ukrainianAudio, row.ukrainianSubtitles, row.quality,
      row.price, row.price.amount, row.price.currency].some(f => f?.state === 'invalid')) issues.push(`UA option ${index + 1}: invalid field withheld.`);
  }
  return { ...base, status: issues.length ? 'partial' : options.length ? 'ok' : 'no-ua-options', identity,
    uaField: supplied ? 'reported' : 'not-reported', optionsState: !supplied ? 'not-reported' : ua.length ? 'reported' : 'reported-empty', options, issues };
}

export async function fetchMotnFor(expected, apiKey, fetchImpl = globalThis.fetch, { timeoutMs = MOTN_TIMEOUT_MS, maxBytes = MOTN_LIMIT_BYTES, signal } = {}) {
  if (!/^tt\d+$/.test(expected?.imdbId ?? '') || !/^[1-9]\d*$/.test(String(expected.tmdbId))) throw new Error('Validated IMDb crosswalk required.');
  const sourceURL = `https://api.movieofthenight.com/v4/shows/${expected.imdbId}?country=ua`;
  const failure = (status, httpStatus) => ({ source: MOTN_SOURCE, receivedAt: new Date().toISOString(), country: 'ua', status,
    ...(httpStatus ? { httpStatus } : {}), options: [] });
  if (!apiKey) return failure('missing-key-no-request');
  if (!text(apiKey, 4096) || /\s/.test(apiKey)) return failure('invalid-key-no-request');
  const controller = new AbortController(); let reader;
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const aborted = new Promise((_, reject) => { if (combined.aborted) reject(new Error('aborted')); else combined.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const bounded = promise => Promise.race([promise, aborted]);
  try {
    const response = await bounded(fetchImpl(sourceURL, { method: 'GET', redirect: 'manual', credentials: 'omit',
      headers: { Accept: 'application/json', 'X-API-Key': apiKey }, signal: combined }));
    const stop = status => { void response.body?.cancel().catch(() => {}); return failure(status, response.status); };
    if (response.status >= 300 && response.status < 400) return stop('redirect-not-followed');
    if (!response.ok) return stop(({ 401: 'api-auth-error', 403: 'api-access-denied', 404: 'title-not-returned', 429: 'quota-or-rate-limit' })[response.status] ?? 'api-http-error');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return stop('invalid-content-type');
    if (Number(response.headers.get('content-length')) > maxBytes) return stop('response-too-large');
    if (!response.body) return failure('invalid-response', response.status);
    reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await bounded(reader.read()); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); return failure('response-too-large', response.status); }
      chunks.push(value);
    }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
    // Even an unexpected upstream echo must not send the credential to the browser.
    if (JSON.stringify(data).includes(apiKey)) return failure('unsafe-response-withheld', response.status);
    return { ...normalizeMotnFor(data, expected), httpStatus: response.status };
  } catch {
    if (reader) void reader.cancel().catch(() => {});
    return failure(controller.signal.aborted ? 'timeout-no-retry' : 'invalid-or-network-response-no-retry');
  } finally { clearTimeout(timer); }
}
