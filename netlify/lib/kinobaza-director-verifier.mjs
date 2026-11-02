// Invocation-local, bounded verification of a card's already admitted director
// pointer. No search, redirects, retries, persistence or global alias registry.
import { readTmdbJson } from '../../research/grounded-answer-demo/tmdb.mjs';
import { admitDirectorProfileURL, projectTmdbPerson, inspectDirectorProfile, compareDirectorProfile } from './director-profile.mjs';

const TIMEOUT_MS = 5_000;
const HTML_BYTES = 2 * 1024 * 1024;
const normalize = s => typeof s === 'string' ? s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA') : '';
const safeText = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 500 && !/[\p{C}]/u.test(s);
const safeKey = s => typeof s === 'string' && s.length > 0 && s.length <= 4096 && !/[\s\p{C}]/u.test(s);
const validID = n => Number.isSafeInteger(n) && n > 0;
const stages = new Set(['tmdb-person', 'kinobaza-person']);
const transportReasons = new Set(['redirect-not-followed', 'api-auth-error', 'api-access-denied', 'title-not-returned', 'quota-or-rate-limit', 'api-http-error',
  'invalid-content-type', 'response-too-large', 'invalid-response', 'unsafe-response-withheld', 'timeout-no-retry', 'invalid-or-network-response-no-retry']);
const unresolved = reason => ({ status: 'unresolved', reason, aliases: [] });

function wait(promise, signal) {
  if (signal.aborted) return Promise.reject(Error('director-deadline'));
  let onAbort;
  const aborted = new Promise((_, reject) => { onAbort = () => reject(Error('director-deadline')); signal.addEventListener('abort', onAbort, { once: true }); });
  return Promise.race([promise, aborted]).finally(() => signal.removeEventListener('abort', onAbort));
}
async function readProfile(url, send, signal) {
  let reader;
  try {
    const response = await wait(send(url, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html' }, signal }), signal);
    const stop = status => { void response.body?.cancel().catch(() => {}); return { status }; };
    if (response.status >= 300 && response.status < 400) return stop('profile-redirect-refused');
    if (!response.ok) return stop(({ 401: 'profile-auth-error', 403: 'profile-access-denied', 404: 'profile-not-returned', 429: 'profile-quota-or-rate-limit' })[response.status] ?? 'profile-http-error');
    const type = response.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || /charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type) || !response.body) return stop('profile-invalid-content');
    if (Number(response.headers.get('content-length')) > HTML_BYTES) return stop('profile-response-too-large');
    reader = response.body.getReader(); const chunks = []; let bytes = 0;
    for (;;) {
      const part = await wait(reader.read(), signal); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > HTML_BYTES) { void reader.cancel().catch(() => {}); return { status: 'profile-response-too-large' }; }
      chunks.push(part.value);
    }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
    if (/captcha|cf-chl-|challenge-platform/i.test(html)) return { status: 'profile-challenge-refused' };
    return { status: 'ok', html };
  } catch {
    if (reader) void reader.cancel().catch(() => {});
    return { status: signal.aborted ? 'profile-timeout-no-retry' : 'profile-network-or-decoding-error' };
  }
}

export function createDirectorVerifier({ film, tmdbToken, sourceCap, reserve, fetchImpl = fetch, calls = [], signal } = {}) {
  const expected = film?.directorCount === 1 && Array.isArray(film.directorPeople) && film.directorPeople.length === 1 ? film.directorPeople[0] : null;
  const trustedPerson = expected?.namespace === 'tmdb:person' && validID(expected.personId) && Array.isArray(expected.names) && expected.names.length > 0 && expected.names.length <= 32 && expected.names.every(safeText) ? expected : null;
  const summary = { status: 'not-requested', reason: 'not-requested', sourceAttempts: 0, reservationRequests: 0, reservationsAcknowledged: 0, tmdbPersonCalls: 0, kinobazaPersonCalls: 0, attempts: [],
    accounting: 'no-extra-attempts' };
  const cache = new Map(); let pairUsed = false;
  const finish = result => {
    summary.status = result.status; summary.reason = result.reason;
    if (result.basis) summary.basis = result.basis;
    if (result.diagnostics) summary.comparisons = Object.fromEntries(['stableIdConflict', 'stableIdMatch', 'birthdayConflict', 'birthdayMatch', 'latinNameMatch', 'nativeAliasMatch'].filter(k => typeof result.diagnostics[k] === 'boolean').map(k => [k, result.diagnostics[k]]));
    return result;
  };
  async function dispatch(stage, target, url, init, stageSignal) {
    if (!stages.has(stage) || url !== target || init.method !== 'GET' || init.redirect !== 'manual' || init.credentials !== 'omit' || stageSignal.aborted || signal?.aborted ||
        !Array.isArray(calls) || calls.length >= sourceCap || calls.some(c => c.stage === stage)) throw Error('director-boundary');
    if (stage === 'kinobaza-person' && (!admitDirectorProfileURL(url) || new Headers(init.headers).has('authorization') || new Headers(init.headers).has('cookie'))) throw Error('director-boundary');
    const attempt = { stage, status: 'reservation-pending' }; summary.attempts.push(attempt); summary.reservationRequests++;
    try { await wait(Promise.resolve().then(() => reserve(stage)), stageSignal); }
    catch {
      attempt.status = stageSignal.aborted ? 'reservation-outcome-unknown' : 'reservation-denied';
      summary.accounting = stageSignal.aborted ? 'reservation-may-have-committed-no-retry' : summary.accounting;
      throw Error('director-reservation-unavailable');
    }
    summary.reservationsAcknowledged++; summary.accounting = 'reserved-attempts-spent-no-retry';
    const call = { stage, status: 'attempt-reserved' }; calls.push(call);
    if (stageSignal.aborted || signal?.aborted) { attempt.status = 'reserved-deadline-no-dispatch'; throw Error('director-deadline'); }
    summary.sourceAttempts++; summary[stage === 'tmdb-person' ? 'tmdbPersonCalls' : 'kinobazaPersonCalls']++;
    attempt.status = 'dispatched';
    try {
      const response = await wait(fetchImpl(url, { ...init, signal: AbortSignal.any([stageSignal, init.signal].filter(Boolean)) }), stageSignal);
      const status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
      call.status = attempt.status = 'response-received'; if (status !== null) call.httpStatus = attempt.httpStatus = status;
      return response;
    } catch {
      call.status = attempt.status = 'transport-outcome-unknown'; throw Error('director-transport');
    }
  }
  async function run(sourceURL, sourceAlias) {
    // English person names provide an exact cross-script comparison without
    // inventing a transliteration. The trusted credits person ID stays fixed.
    const tmdbURL = `https://api.themoviedb.org/3/person/${trustedPerson.personId}?language=en-US&append_to_response=external_ids`;
    const tmdbSignal = AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)].filter(Boolean));
    const tmdb = await readTmdbJson(tmdbURL, tmdbToken, (url, init) => dispatch('tmdb-person', tmdbURL, url, init, tmdbSignal), { timeoutMs: TIMEOUT_MS, maxBytes: 512 * 1024, signal: tmdbSignal });
    if (tmdb.status !== 'ok') return finish(unresolved(summary.attempts.at(-1)?.status === 'reservation-denied' || summary.attempts.at(-1)?.status === 'reservation-outcome-unknown' ? 'director-reservation-unavailable' : tmdbSignal.aborted ? 'director-tmdb-timeout-no-retry' : `director-tmdb-${transportReasons.has(tmdb.status) ? tmdb.status : 'invalid-response'}`));
    const projected = projectTmdbPerson(tmdb.data, trustedPerson);
    if (projected.status !== 'ok') return finish(unresolved(projected.reason));
    if (signal?.aborted) return finish(unresolved('director-deadline-bounded'));
    const profileSignal = AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)].filter(Boolean));
    const page = await readProfile(sourceURL, (url, init) => dispatch('kinobaza-person', sourceURL, url, init, profileSignal), profileSignal);
    if (page.status !== 'ok') return finish(unresolved(summary.attempts.at(-1)?.status === 'reservation-denied' || summary.attempts.at(-1)?.status === 'reservation-outcome-unknown' ? 'director-reservation-unavailable' : `director-${page.status}`));
    if (page.html.includes(tmdbToken)) return finish(unresolved('director-unsafe-source-content-withheld'));
    const inspected = await inspectDirectorProfile(page.html, sourceURL, sourceAlias);
    if (signal?.aborted) return finish(unresolved('director-deadline-bounded'));
    const result = compareDirectorProfile(inspected, projected);
    // The alias/provenance is server-internal. diagnostic() deliberately omits
    // source URLs, names, birth dates, profile bodies and credentials.
    if (JSON.stringify(result).includes(tmdbToken)) return finish(unresolved('director-unsafe-source-content-withheld'));
    return finish({ ...result, aliases: result.status === 'confirmed' ? result.aliases : [] });
  }
  function verify({ sourceURL, sourceAlias } = {}) {
    const decline = reason => Promise.resolve(finish(unresolved(reason)));
    // The durable session capability, not a browser option, enables the same
    // single pair for cap10/cap12. A reserve card does not grant a second pair.
    if (sourceCap !== 10 && sourceCap !== 12) return decline('director-profile-not-enabled-for-budget');
    if (!trustedPerson) return decline('director-profile-trusted-single-person-required');
    if (!safeKey(tmdbToken)) return decline('director-profile-missing-tmdb-credential');
    if (typeof reserve !== 'function' || !Array.isArray(calls)) return decline('director-profile-ledger-required');
    if (!admitDirectorProfileURL(sourceURL) || !safeText(sourceAlias) || sourceURL.includes(tmdbToken) || sourceAlias.includes(tmdbToken)) return decline('director-profile-pointer-rejected');
    if (signal?.aborted) return decline('director-deadline-bounded');
    const key = `${trustedPerson.personId}\u0000${sourceURL}\u0000${normalize(sourceAlias)}`;
    if (cache.has(key)) return cache.get(key);
    if (pairUsed || calls.some(c => stages.has(c.stage)) || calls.length > sourceCap - 2) return decline('director-profile-pair-unavailable');
    // Lock before the first await. Parallel candidates cannot reserve a second
    // pair; even a timeout/denied stage is not an opportunity for an app retry.
    pairUsed = true;
    const pending = run(sourceURL, sourceAlias).catch(() => finish(unresolved('director-profile-verification-error')));
    cache.set(key, pending); return pending;
  }
  return { verify, diagnostic: () => structuredClone(summary) };
}
