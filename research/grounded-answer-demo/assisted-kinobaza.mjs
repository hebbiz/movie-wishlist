// Owner-assisted source card, not a resolver. No URL rewriting or destinations.
import { extractHtml, HTML_LIMIT_BYTES, HTML_TIMEOUT_MS } from './html-source.mjs';

export function admitKinobazaURL(value) {
  // Validate original spelling BEFORE URL normalization (default ports/dot paths).
  if (typeof value !== 'string' || value.length > 512 ||
      !/^https:\/\/kinobazaua\.com\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return null;
  const u = new URL(value);
  return u.origin === 'https://kinobazaua.com' && !u.username && !u.password && !u.port && !u.search && !u.hash ? value : null;
}
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const normalize = s => typeof s === 'string' ? s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA') : '';
const text = n => (n.childNodes ?? []).map(c => c.nodeName === '#text' ? c.value : ['script', 'style', 'template', 'noscript', 'iframe'].includes(c.tagName) ? '' : text(c)).join(' ').replace(/\s+/gu, ' ').trim();
const excluded = n => { for (let p = n; p; p = p.parentNode) if (['nav', 'aside', 'footer', 'template', 'noscript', 'iframe'].includes(p.tagName)) return true; return false; };

export function assistedIdentity(all, film, sourceURL) {
  const active = all.filter(n => !excluded(n));
  const canonicals = active.filter(n => n.tagName === 'link' && (attr(n, 'rel') ?? '').split(/\s+/).includes('canonical')).map(n => attr(n, 'href'));
  const outcome = (status, reason) => ({ status, reason, basis: 'selected TMDb projection versus explicit source identity; no transliteration or user override',
    observed: { headingCount: headings.length, originalTitleCount: originals.length, directorCount: directors.size, canonicalCount: canonicals.length, stableIdCount: stable.length } });
  const headings = active.filter(n => n.tagName === 'h1').map(text);
  const headingNode = active.find(n => n.tagName === 'h1');
  const accordion = active.find(n => attr(n, 'id') === 'availabilityAccordion');
  const originals = active.filter(n => n.tagName === 'h2' && n.sourceCodeLocation?.startOffset > headingNode?.sourceCodeLocation?.startOffset &&
    n.sourceCodeLocation?.startOffset < accordion?.sourceCodeLocation?.startOffset).map(text).filter(Boolean);
  const directors = new Set(), stable = [];
  // IDs only in labelled film-metadata rows, not arbitrary recommendations/trailers.
  let identityRows = 0;
  for (const row of active.filter(n => n.tagName === 'tr')) {
    const cells = (row.childNodes ?? []).filter(n => ['td', 'th'].includes(n.tagName));
    if (cells.length !== 2) continue;
    const label = text(cells[0]);
    if (['Режисер:', 'IMDb:', 'TMDb:'].includes(label) && ++identityRows > 32) return outcome('unresolved', 'source-identity-structure-limit');
    if (label === 'Режисер:') directors.add(text(cells[1]));
    if (['IMDb:', 'TMDb:'].includes(label)) {
      const links = [], stack = [cells[1]];
      while (stack.length) { const n = stack.pop(); if (n.tagName === 'a') links.push(n); if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(n.tagName)) stack.push(...(n.childNodes ?? [])); }
      if (links.length > 20) return outcome('unresolved', 'source-identity-structure-limit');
      for (const a of links) {
        const href = attr(a, 'href') ?? '';
        const match = label === 'IMDb:' ? /^https:\/\/(?:www\.)?imdb\.com\/title\/(tt\d{1,20})\/?$/.exec(href) : /^https:\/\/(?:www\.)?themoviedb\.org\/movie\/(\d{1,10})(?:-[a-z0-9-]+)?\/?$/.exec(href);
        stable.push({ namespace: label === 'IMDb:' ? 'imdb' : 'tmdb', id: match?.[1] ?? null });
      }
      if (text(cells[1]) && (!links.length || (label === 'IMDb:' ? /^tt\d{1,20}$/ : /^\d{1,10}$/).test(text(cells[1])))) {
        const literal = text(cells[1]);
        stable.push({ namespace: label === 'IMDb:' ? 'imdb' : 'tmdb', id: (label === 'IMDb:' ? /^tt\d{1,20}$/ : /^\d{1,10}$/).test(literal) ? literal : null });
      }
    }
  }
  // Same inline source shape as the fixed extractor, without per-film aliases.
  for (const n of active) if ((n.nodeName === '#text' && text({ childNodes: [n] }) === 'Режисер:') || (['span', 'strong', 'b'].includes(n.tagName) && text(n) === 'Режисер:')) {
    const siblings = n.parentNode?.childNodes ?? [], next = siblings.slice(siblings.indexOf(n) + 1).find(c => c.tagName || c.nodeName === '#text' && c.value.trim());
    if (next?.tagName === 'a') directors.add(text(next));
  }
  directors.delete('');
  const expected = { tmdb: String(film.tmdbId), imdb: film.imdbId };
  if (canonicals.some(u => u && u !== sourceURL)) return outcome('mismatch', 'source-canonical-conflict');
  if (stable.some(s => s.id && expected[s.namespace] && s.id !== expected[s.namespace]) || ['tmdb', 'imdb'].some(ns => new Set(stable.filter(s => s.id && s.namespace === ns).map(s => s.id)).size > 1)) return outcome('mismatch', 'source-stable-id-conflict');
  if (stable.some(s => !s.id)) return outcome('unresolved', 'malformed-source-stable-id');
  if (canonicals.length > 1) return outcome('unresolved', 'source-canonical-ambiguous');
  if (headings.length !== 1 || !originals.length || canonicals.length !== 1 || canonicals[0] !== sourceURL) return outcome('unresolved', 'source-identity-structure-incomplete');
  const aliases = new Set([film.identityTitle, film.originalTitle, ...(film.titleAliases ?? [])].map(normalize).filter(Boolean));
  const heading = /^(.*?)\s*\(\s*(\d{4})\s*\)\s*$/.exec(headings[0]);
  if (!heading) return outcome('unresolved', 'source-title-year-missing');
  if (!aliases.has(normalize(heading[1]))) return outcome('mismatch', 'source-title-conflict');
  if (originals.filter(t => aliases.has(normalize(t))).length !== 1) return outcome('unresolved', 'source-original-title-unestablished');
  const stableMatch = stable.some(s => expected[s.namespace] && s.id === expected[s.namespace]);
  if (!film.year) return outcome('unresolved', 'selected-year-missing');
  if (Number(heading[2]) !== film.year && !stableMatch) return outcome('mismatch', 'source-year-conflict-without-stable-crosswalk');
  const directorAliases = new Set((film.directorAliases ?? []).map(normalize).filter(Boolean));
  if (!directors.size || !directorAliases.size) return outcome('unresolved', 'source-or-selected-director-missing');
  // Nonmatching localized spelling is not a proved different director. Do not
  // transliterate or assume the model's romanization. Multiple source values
  // require every value to be an alias actually supplied by selected metadata.
  if (![...directors].every(d => directorAliases.has(normalize(d)))) {
    const scripts = s => /\p{Script=Cyrillic}/u.test(s) ? 'cyrillic' : /\p{Script=Latin}/u.test(s) ? 'latin' : 'other';
    const unmatched = [...directors].filter(d => !directorAliases.has(normalize(d)));
    if (unmatched.some(d => [...directorAliases].some(a => scripts(a) === scripts(d) && scripts(d) !== 'other'))) return outcome('mismatch', 'source-director-conflict');
    return outcome('unresolved', 'director-alias-unestablished');
  }
  return outcome('matched', stableMatch ? 'explicit-stable-and-structural-match' : 'explicit-title-year-director-match');
}

export async function fetchAssistedKinobaza(sourceURL, film, fetchImpl, { timeoutMs = HTML_TIMEOUT_MS, maxBytes = HTML_LIMIT_BYTES, signal } = {}) {
  if (!admitKinobazaURL(sourceURL)) throw new Error('Unadmitted source');
  const controller = new AbortController(); const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let reader; const timer = setTimeout(abort, timeoutMs);
  const aborted = new Promise((_, reject) => { if (controller.signal.aborted) reject(Error('aborted')); else controller.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }); });
  const bounded = p => Promise.race([p, aborted]);
  const fail = (status, httpStatus) => ({ status, ...(httpStatus ? { httpStatus } : {}), candidates: [], sourceURL });
  try {
    const r = await bounded(fetchImpl(sourceURL, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'MovieWishlistResearchPoC/0.1 (manual assisted-card experiment)' }, signal: controller.signal }));
    const stop = status => { void r.body?.cancel().catch(() => {}); return fail(status, r.status); };
    if (r.status >= 300 && r.status < 400) return stop('redirect-not-followed');
    if (!r.ok) return stop([403, 429].includes(r.status) ? 'access-blocked-no-retry' : 'http-error-no-retry');
    const type = r.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || /charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type)) return stop('unsupported-content-type');
    if (Number(r.headers.get('content-length')) > maxBytes) return stop('response-too-large');
    if (!r.body) return fail('empty-response', r.status);
    reader = r.body.getReader(); const chunks = []; let bytes = 0;
    while (true) { const part = await bounded(reader.read()); if (part.done) break; bytes += part.value.byteLength; if (bytes > maxBytes) { void reader.cancel().catch(() => {}); return fail('response-too-large', r.status); } chunks.push(part.value); }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
    if (/captcha|cf-chl-|challenge-platform/i.test(html)) return fail('challenge-unsupported-no-retry', r.status);
    const extracted = await extractHtml(html, film, { identityCheck: all => assistedIdentity(all, film, sourceURL) });
    const receivedAt = new Date().toISOString();
    if (extracted.localization) extracted.localization.provenance = { source: 'Kinobaza HTML', sourceURL, receivedAt, method: 'initial HTML source blocks; assisted card', upstream: 'not-established' };
    return { ...extracted, sourceURL, receivedAt, bytes, httpStatus: r.status, requestsMade: 1 };
  } catch { if (reader) void reader.cancel().catch(() => {}); return fail(controller.signal.aborted ? 'timeout-or-cancelled-no-retry' : 'network-or-decoding-error-no-retry'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
