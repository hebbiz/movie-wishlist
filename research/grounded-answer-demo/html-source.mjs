import { KINOBAZA_CARDS } from './url-context.mjs';
import { extractLocalization } from './kinobaza-localization.mjs';

export function canonicalKinobazaURL(filmId) {
  if (!Object.hasOwn(KINOBAZA_CARDS, filmId)) throw new Error('Fixed Kinobaza film required.');
  return `https://kinobazaua.com/titles/${filmId}`;
}
export function canonicalRedirectTarget(source, location, status) {
  if (![301, 308].includes(status) || typeof location !== 'string') return null;
  const entry = Object.entries(KINOBAZA_CARDS).find(([, url]) => source === url);
  // Exact spelling deliberately excludes credentials, query, fragments, ports,
  // encoded path tricks, downgrade, extra hosts and a second hop/loop.
  return entry && location === canonicalKinobazaURL(entry[0]) ? location : null;
}

export const HTML_LIMIT_BYTES = 2 * 1024 * 1024;
export const HTML_TIMEOUT_MS = 15_000;
export const HTML_OPERATION = 'One GET of the fixed Kinobaza card; initial HTML only; no redirects, retries, scripts, cookies, model or destination requests. Candidates are not availability or entitlement. Missing/ambiguous identity or markup stays unresolved.';

export function htmlScenario(film, { discovery, amazonRegion, urlSource } = {}) {
  if (discovery !== 'digital-ua' || amazonRegion !== undefined ||
      !Object.hasOwn(KINOBAZA_CARDS, film.id) || (urlSource !== undefined && urlSource !== 'kinobaza')) {
    throw new Error('kinobaza-html requires digital-ua, Dune/Coherence, no Amazon region and URL source unset or kinobaza.');
  }
  return Object.freeze({ film, discovery, amazonRegion: null, retrieval: 'kinobaza-html',
    urlSource: 'kinobaza', sourceURL: KINOBAZA_CARDS[film.id], prompt: null, operation: HTML_OPERATION });
}

const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const children = n => n.childNodes ?? [];
const clean = s => s.replace(/\s+/gu, ' ').trim();
function nodes(root) {
  const result = []; const stack = [[root, 0]];
  while (stack.length) {
    const [n, depth] = stack.pop();
    if (depth > 256 || result.length >= 100_000) throw new Error('markup-limit');
    result.push(n);
    if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(n.tagName)) {
      for (const c of children(n).toReversed()) stack.push([c, depth + 1]);
    }
  }
  return result;
}
const text = n => clean(nodes(n).filter(x => x.nodeName === '#text').map(x => x.value).join(' '));
const hasClass = (n, value) => (attr(n, 'class') ?? '').split(/\s+/).includes(value);
function excluded(n) {
  for (let p = n; p; p = p.parentNode) {
    if (['nav', 'aside', 'footer', 'script', 'style', 'template', 'noscript', 'iframe'].includes(p.tagName) ||
        /(?:^|[\s_-])(?:ad|ads|advertisement|trailer)(?:$|[\s_-])/i.test(`${attr(p, 'id') ?? ''} ${attr(p, 'class') ?? ''}`)) return true;
  }
  return false;
}
function identity(all, film) {
  const h1 = all.filter(n => n.tagName === 'h1' && !excluded(n));
  const headings = all.filter(n => n.tagName === 'h2' && !excluded(n)).map(text);
  const title = film.id === 'coherence' ? 'Coherence' : 'Dune: Part Two';
  const year = film.id === 'coherence' ? '2013' : '2024';
  const aliases = film.id === 'coherence' ? ['James Ward Byrkit', 'Джеймс Ворд Біркіт'] : ['Denis Villeneuve', 'Денні Вільньов'];
  const directors = new Set();
  // A labelled table cell or an adjacent inline label, not a whole-page name hit.
  for (const n of all) {
    if (excluded(n)) continue;
    if (n.tagName === 'tr') {
      const cells = children(n).filter(c => ['td', 'th'].includes(c.tagName));
      if (cells.length === 2 && text(cells[0]) === 'Режисер:') directors.add(text(cells[1]));
    }
    if ((n.nodeName === '#text' && clean(n.value) === 'Режисер:') ||
        (['span', 'strong', 'b'].includes(n.tagName) && text(n) === 'Режисер:')) {
      const siblings = children(n.parentNode); const i = siblings.indexOf(n);
      const next = siblings.slice(i + 1).find(c => c.tagName || (c.nodeName === '#text' && clean(c.value)));
      if (next?.tagName === 'a') directors.add(text(next));
    }
  }
  const observed = { heading: h1.map(text), originalTitles: headings.filter(h => h === title), directors: [...directors] };
  const matches = h1.length === 1 && new RegExp(`\\(\\s*${year}\\s*\\)`).test(text(h1[0])) &&
    observed.originalTitles.length === 1 && directors.size > 0 && [...directors].every(d => aliases.includes(d));
  return { status: matches ? 'matched' : 'unresolved', observed };
}

const territories = Object.freeze({
  UA: 'Доступно в Україні', PL: 'Доступно в Польщі', CZ: 'Доступно в Чехії', DE: 'Доступно в Німеччині',
});
function providerName(a) {
  const label = attr(a, 'title') ?? '';
  const explicit = /^Дивитись \/ Купити на (.+)$/.exec(label);
  if (explicit) {
    const image = nodes(a).find(n => n.tagName === 'img');
    if (image && attr(image, 'alt') !== explicit[1]) return { unsupported: true };
    return { name: explicit[1] };
  }
  const badges = [label, attr(a, 'aria-label') ?? '', text(a),
    ...nodes(a).filter(n => n.tagName === 'img').map(n => attr(n, 'alt') ?? '')];
  const matches = badges.map(s => /^(?:Доступно (?:в|у)|Купити в) (itunes|rakuten|megogo|netflix|prime video|amazon prime)(?: з українською аудіо доріжкою \/ субтитрами)?$/i.exec(clean(s))).filter(Boolean);
  if (new Set(matches.map(m => m[1].toLowerCase())).size > 1) return { unsupported: true };
  return matches.length ? { name: matches[0][1] } : null;
}
function candidate(a, territory, html, provider) {
  const href = attr(a, 'href');
  const loc = a.sourceCodeLocation?.attrs?.href;
  const spelling = loc ? html.slice(loc.startOffset, loc.endOffset) : '';
  const raw = /^href\s*=\s*(?:"([\s\S]*)"|'([\s\S]*)'|([^\s>]+))$/i.exec(spelling);
  const rawHref = raw ? (raw[1] ?? raw[2] ?? raw[3]) : null;
  const entry = { provider, territory, href: href ?? null, rawHref, hrefKind: 'missing', status: 'unresolved' };
  if (!href) return { ...entry, issue: 'missing-href' };
  if (href.length > 16384 || /[\\\s\p{C}]/u.test(href) || /[\p{C}]/u.test(provider)) return { ...entry, href: null, rawHref: null, issue: 'unsafe-url-or-label' };
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(href);
  if (!scheme) return { ...entry, hrefKind: 'relative', status: 'candidate', issue: 'not-an-absolute-provider-url' };
  if (!/^https?$/i.test(scheme[1])) return { ...entry, href: null, rawHref: null, issue: 'unsafe-url-scheme' };
  try {
    const url = new URL(href); // Validate only. Never serialize/resolve or fetch it.
    if (!url.hostname || url.username || url.password) throw new Error('unsafe');
    if (['justwatch.com', 'www.justwatch.com'].includes(url.hostname)) return null;
  } catch { return { ...entry, href: null, rawHref: null, issue: 'unsafe-or-invalid-url' }; }
  return { ...entry, hrefKind: 'absolute', status: 'candidate' };
}

// parse5 is lazy: existing Gemini modes still run without installing this parser.
export async function extractHtml(html, film) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > HTML_LIMIT_BYTES) return { status: 'unsupported-markup', candidates: [], issues: ['html-size-limit'] };
  let parse;
  try { ({ parse } = await import('parse5')); } catch { return { status: 'parser-unavailable', candidates: [], issues: ['Run npm ci --prefix research/grounded-answer-demo --ignore-scripts'] }; }
  try {
    const errors = [];
    const doc = parse(html, { sourceCodeLocationInfo: true, onParseError: e => { if (errors.length < 10) errors.push(e.code); } });
    // Recovery is fine for omitted doctype, not duplicate attributes / ambiguous tokenization.
    if (errors.some(e => e !== 'missing-doctype')) return { status: 'unsupported-markup', candidates: [], issues: ['html-parse-errors'] };
    const all = nodes(doc); const checked = identity(all, film);
    const fail = issue => ({ status: 'unsupported-markup', identity: checked, candidates: [], issues: [issue] });
    if (checked.status !== 'matched') return { status: 'identity-unresolved', identity: checked, candidates: [], issues: ['title-year-director-not-unambiguous'] };
    const accordions = all.filter(n => attr(n, 'id') === 'availabilityAccordion');
    if (accordions.length !== 1) return fail('missing-or-duplicate-availabilityAccordion');
    const accordion = accordions[0];
    const localization = extractLocalization({ accordion, h1: all.find(n => n.tagName === 'h1'), identifyProvider: providerName, isExcluded: excluded,
      makeCandidate: (anchor, territory, provider) => candidate(anchor, territory, html, provider) });
    const items = children(accordion).filter(n => n.tagName);
    if (!items.length || items.some(n => !hasClass(n, 'accordion-item'))) return fail('unsupported-accordion-items');
    const candidates = []; const issues = []; const panels = new Set();
    const add = (a, territory) => {
      if (excluded(a)) return;
      const provider = providerName(a);
      if (provider?.unsupported) { issues.push('conflicting-provider-label'); return; }
      if (!provider?.name || /^justwatch$/i.test(provider.name)) return;
      const entry = candidate(a, territory, html, provider.name);
      if (entry && localization.byAnchor.has(a)) entry.blockId = localization.byAnchor.get(a).blockId;
      if (entry) { candidates.push(entry); if (entry.issue) issues.push(entry.issue); }
    };
    for (const item of items) {
      const headings = nodes(item).filter(n => hasClass(n, 'accordion-header'));
      if (headings.length !== 1) return fail('ambiguous-territory-heading');
      const buttons = nodes(headings[0]).filter(n => n.tagName === 'button');
      if (buttons.length !== 1) return fail('ambiguous-territory-control');
      const [code] = Object.entries(territories).find(([, label]) => text(buttons[0]) === label) ?? [];
      const target = attr(buttons[0], 'data-bs-target');
      if (!code || target !== `#collapse${code}` || panels.has(code)) return fail('unsupported-or-conflicting-territory');
      const panel = all.filter(n => attr(n, 'id') === target.slice(1));
      if (panel.length !== 1 || panel[0].parentNode !== item || attr(panel[0], 'data-bs-parent') !== '#availabilityAccordion') return fail('ambiguous-territory-panel');
      panels.add(code);
      for (const a of nodes(panel[0]).filter(n => n.tagName === 'a')) add(a, { code, label: territories[code] });
    }
    if (!panels.has('UA')) return fail('missing-explicit-ukraine-section');
    const h1 = all.find(n => n.tagName === 'h1');
    for (const a of all.filter(n => n.tagName === 'a')) {
      const offset = a.sourceCodeLocation?.startOffset;
      // Only source-specific film badges between the title and country accordion.
      if (offset > h1.sourceCodeLocation.startOffset && offset < accordion.sourceCodeLocation.startOffset) add(a, null);
    }
    if (candidates.length > 100) return fail('candidate-count-limit');
    const availabilitySignals = candidates.filter(c => c.territory).map(c => ({ provider: c.provider, href: c.href, territory: c.territory,
      state: 'source-section-claim', value: 'available', access: 'unknown', upstream: 'JustWatch', basis: 'Explicit country heading/panel, not href presence or account entitlement.' }));
    return { status: candidates.length ? (issues.length || localization.issues.length ? 'partial' : 'ok') : 'unresolved', identity: checked, candidates,
      localization: { film: localization.film, blocks: localization.blocks }, availabilitySignals, issues: [...new Set([...issues, ...localization.issues])] };
  } catch { return { status: 'unsupported-markup', candidates: [], issues: ['unresolved-parser-or-structure'] }; }
}

export async function fetchHtmlCandidates(selection, fetchImpl = globalThis.fetch, { timeoutMs = HTML_TIMEOUT_MS, maxBytes = HTML_LIMIT_BYTES, canonicalRedirect = false } = {}) {
  if (selection.retrieval !== 'kinobaza-html' || !Object.hasOwn(KINOBAZA_CARDS, selection.film.id) || selection.sourceURL !== KINOBAZA_CARDS[selection.film.id]) throw new Error('Fixed HTML source required.');
  try { await import('parse5'); } catch { return { status: 'parser-unavailable', candidates: [], issues: ['Install isolated parser before live GET.'] }; }
  const controller = new AbortController(); let reader;
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const bounded = promise => Promise.race([promise, aborted]);
  const failure = (status, httpStatus) => ({ status, ...(httpStatus ? { httpStatus } : {}), candidates: [] });
  try {
    const get = url => bounded(fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
      headers: { Accept: 'text/html', 'User-Agent': 'MovieWishlistResearchPoC/0.1 (manual fixed-card experiment)' }, signal: controller.signal }));
    let response = await get(selection.sourceURL), sourceURL = selection.sourceURL, requestsMade = 1;
    if (canonicalRedirect && response.status >= 300 && response.status < 400) {
      const target = canonicalRedirectTarget(sourceURL, response.headers.get('location'), response.status);
      void response.body?.cancel().catch(() => {});
      if (!target) return { ...failure('canonical-redirect-refused', response.status), requestsMade };
      sourceURL = target; requestsMade++; response = await get(target);
      if (response.status >= 300 && response.status < 400) { void response.body?.cancel().catch(() => {}); return { ...failure('redirect-loop-or-second-hop-refused', response.status), requestsMade }; }
    }
    if (response.status >= 300 && response.status < 400) { void response.body?.cancel().catch(() => {}); return failure('redirect-not-followed', response.status); }
    if (!response.ok) { void response.body?.cancel().catch(() => {}); return failure([403, 429].includes(response.status) ? 'access-blocked-no-retry' : 'http-error-no-retry', response.status); }
    const type = response.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || (/charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type))) { void response.body?.cancel().catch(() => {}); return failure('unsupported-content-type', response.status); }
    if (Number(response.headers.get('content-length')) > maxBytes) { void response.body?.cancel().catch(() => {}); return failure('response-too-large', response.status); }
    if (!response.body) return failure('empty-response', response.status);
    reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await bounded(reader.read());
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); return failure('response-too-large', response.status); }
      chunks.push(value);
    }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
    const extracted = await extractHtml(html, selection.film), receivedAt = new Date().toISOString();
    if (extracted.localization) extracted.localization.provenance = { source: 'Kinobaza HTML', method: 'initial HTML source blocks', sourceURL, receivedAt, upstream: 'not-established' };
    return { ...extracted, httpStatus: response.status, bytes: size, sourceURL, requestsMade, receivedAt };
  } catch { if (reader) void reader.cancel().catch(() => {}); return failure(controller.signal.aborted ? 'timeout-no-retry' : 'network-or-decoding-error-no-retry'); }
  finally { clearTimeout(timer); }
}
