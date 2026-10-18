// One fixed public initial-HTML read. Source-specific research, not an offer model.
export const MEGOGO_URL = 'https://megogo.net/ua/view/22027436-dyuna-chastina-druga.html';
export const MEGOGO_IDS = Object.freeze({ nativeId: '22027436', tmdbId: 693134, imdbId: 'tt15239678' });
export const MEGOGO_TIMEOUT_MS = 20_000;
export const MEGOGO_LIMIT_BYTES = 2 * 1024 * 1024;
export function megogoScenario(film, { discovery, amazonRegion, urlSource } = {}) {
  if (film.id !== 'dune-part-two' || discovery !== 'digital-ua' || amazonRegion !== undefined || urlSource !== undefined) throw new Error('megogo-html requires Dune, digital-ua, unset DEMO_URL_SOURCE and DEMO_AMAZON_REGION.');
  return Object.freeze({ film, retrieval: 'megogo-html', discovery, amazonRegion: null, sourceURL: MEGOGO_URL, prompt: null,
    operation: 'One GET of the fixed MEGOGO Dune initial HTML; max 20s / 2 MiB. No API key, LLM, scripts, cookies, assets, redirects, retries or destination requests. Public-card characteristics are separate from account entitlement; /ua/ does not establish fetcher geography or viewing rights.' });
}
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safe = (v, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\p{C}]/u.test(v);
const clean = s => s.replace(/\s+/gu, ' ').trim();
const attr = (n, name) => n.attrs?.find(a => a.name === name)?.value;
const types = v => (Array.isArray(v) ? v : [v]).map(t => typeof t === 'string' ? t.replace(/^https?:\/\/schema.org\//, '') : '');
const values = v => v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
const fieldNames = ['access', 'package', 'audio', 'subtitles', 'resolution', 'hdr10', 'dolbyVision', 'price', 'region'];
const emptyFields = () => Object.fromEntries(fieldNames.map(k => [k, { state: 'unknown', observations: [], note: 'Not explicitly established in supported initial HTML.' }]));
function base() {
  return { source: 'MEGOGO public initial HTML', sourceURL: MEGOGO_URL, receivedAt: new Date().toISOString(),
    fetcherGeography: { state: 'unknown', basis: 'No egress geolocation performed; UI language, /ua/ and LAN IP do not establish country.' },
    identity: { status: 'unknown', observed: {} }, accountEntitlement: { state: 'unknown', note: 'No account/login/playback evidence requested.' },
    cardFields: emptyFields(), offers: [], issues: [] };
}
function add(fields, key, value, evidence) {
  const f = fields[key];
  if (JSON.stringify(value).length > 2000 || f.observations.length >= 50) { f.state = 'partial'; return; }
  f.observations.push({ value, evidence }); f.state = 'reported';
  // A single-value disagreement is retained, never silently replaced. Multiple
  // supported resolutions/tracks/access variants are not exclusive alternatives.
  if (['package', 'hdr10', 'dolbyVision'].includes(key) && new Set(f.observations.map(o => JSON.stringify(o.value))).size > 1) f.state = 'conflicting';
  if (['audio', 'subtitles'].includes(key)) {
    const tracks = f.observations.flatMap(o => o.value);
    if (tracks.some(a => a.presence === 'explicit-negative-claim' && tracks.some(b => b.presence === 'listed-claim' && a.locales.some(code => b.locales.includes(code))))) f.state = 'conflicting';
  }
  f.note = 'Literal public-card claim in this scope, not account entitlement or guaranteed UA offer.';
}
function unknown(fields, key, note) { if (!fields[key].observations.length) fields[key].note = note; }
function nativeId(url) {
  if (!safe(url, 16_384)) return undefined;
  try { const u = new URL(url); if (u.protocol !== 'https:' || !['megogo.net', 'www.megogo.net'].includes(u.hostname) || u.username || u.password) return undefined;
    return /^\/(?:[a-z]{2}\/)?view\/(\d+)(?:[-/.]|$)/.exec(u.pathname)?.[1]; } catch { return undefined; }
}
function walk(root) {
  const out = [], queue = [[root, 0]];
  while (queue.length) {
    const [n, depth] = queue.pop(); if (depth > 256 || out.length >= 100_000) throw new Error('markup-limit');
    out.push(n);
    if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(n.tagName)) for (const c of (n.childNodes ?? []).toReversed()) queue.push([c, depth + 1]);
  }
  return out;
}
function inert(n) {
  for (let p = n; p; p = p.parentNode) if (['nav', 'aside', 'footer', 'script', 'style', 'template', 'noscript', 'iframe'].includes(p.tagName) ||
    attr(p, 'hidden') !== undefined || attr(p, 'aria-hidden') === 'true' || /(?:^|[\s_-])(?:ads?|advertisement|trailer|related|recommendations)(?:$|[\s_-])/i.test(`${attr(p, 'class') ?? ''} ${attr(p, 'id') ?? ''}`)) return true;
  return false;
}
const text = n => clean(walk(n).filter(c => c.nodeName === '#text' && !inert(c)).map(c => c.value).join(' '));
const titles = new Set(['dune part two', 'дюна частина друга']);
const titleKey = v => typeof v === 'string' ? clean(v.toLowerCase().replace(/\s*\(\d{4}\)\s*$/, '').replace(/[.:—–-]/gu, ' ')) : '';
const labelKey = v => clean(v).toLowerCase().replace(/:$/, '');
const labels = new Map([
  ...['audio', 'audio tracks', 'аудіо', 'аудіодоріжки', 'аудиодорожки'].map(k => [k, 'audio']),
  ...['subtitles', 'субтитри', 'субтитры'].map(k => [k, 'subtitles']),
  ...['quality', 'resolution', 'якість', 'якість відео', 'качество'].map(k => [k, 'resolution']),
  ['hdr10', 'hdr10'], ['dolby vision', 'dolbyVision'],
  ...['access type', 'тип доступу', 'тип доступа'].map(k => [k, 'access']),
  ...['package', 'пакет', 'передплата', 'subscription package'].map(k => [k, 'package']),
  ...['price', 'ціна', 'цена'].map(k => [k, 'price']),
  ...['region', 'регіон', 'регіональні обмеження', 'regional restrictions'].map(k => [k, 'region']),
]);
const languageNames = new Map([
  ['uk', /\b(?:uk|ukr|Ukrainian)\b|українськ[а-яіїєґ]*|украинск[а-я]*/iu],
  ['en', /\b(?:en|eng|English)\b|англійськ[а-яіїєґ]*|английск[а-я]*/iu],
  ['ru', /\b(?:ru|rus|Russian)\b|російськ[а-яіїєґ]*|русск[а-я]*/iu],
  ['es', /\b(?:es|spa|Spanish)\b|іспанськ[а-яіїєґ]*/iu],
]);
function tracks(parts, subtitle) {
  return parts.map(part => {
    const locales = [...languageNames].filter(([, re]) => re.test(part)).map(([code]) => code);
    // Only a whole, explicit no-track clause. "English, not Atmos" is not
    // evidence that the English track is absent.
    const negative = /^(?:no (?:Ukrainian|English|Russian|Spanish) (?:audio|subtitles)|(?:Ukrainian|English|Russian|Spanish) (?:audio|subtitles) (?:absent|not available))\.?$/iu.test(part);
    const specific = locales.length === 1 && !negative;
    return { reportedText: part, locales, presence: negative ? 'explicit-negative-claim' : locales.length ? 'listed-claim' : 'unknown', association: specific ? 'single-language-clause' : 'unknown',
      codecs: !subtitle && specific ? [...new Set(part.match(/\b(?:AAC|PCM|Opus|Dolby Digital Plus|Dolby Digital|Dolby Atmos|DTS-HD|DTS)\b/gi) ?? [])] : [],
      channels: !subtitle && specific ? [...new Set(part.match(/\b[1-9]\.[01](?:\.[1-9])?\b/g) ?? [])] : [],
      subtitleTypes: subtitle && specific ? [...new Set((part.match(/\b(?:forced|standard|CC|SDH)\b|форсован[а-яіїєґ]*|звичайн[а-яіїєґ]*/giu) ?? []))] : [],
      note: specific ? 'Only explicit formats/types in this language clause; missing formats unknown, list completeness unknown.' : 'Language/format association unresolved; no codec/channels/type assigned.' };
  });
}
function labelled(fields, label, rawParts, evidence) {
  const key = labels.get(labelKey(label)); if (!key) return false;
  const parts = rawParts.filter(p => safe(p, 500)); if (!parts.length) return true;
  if (parts.some(p => /sign in to see|після входу|javascript required|увійдіть.*(?:побачити|перегляд)/iu.test(p))) { unknown(fields, key, 'Login/JS-only field; not fetched or inferred.'); return true; }
  const raw = parts.join('; ');
  if (key === 'audio' || key === 'subtitles') add(fields, key, tracks(parts, key === 'subtitles'), evidence);
  else if (key === 'price') {
    const m = /^(\d+(?:[.,]\d{1,2})?)\s+([A-Z]{3})$/.exec(raw), reverse = /^([A-Z]{3})\s+(\d+(?:[.,]\d{1,2})?)$/.exec(raw);
    if (m || reverse) add(fields, key, { amount: m ? m[1] : reverse[2], currency: m ? m[2] : reverse[1] }, evidence);
    else unknown(fields, key, 'No unambiguous explicit amount + ISO currency pair; price withheld.');
  } else if (key === 'hdr10' || key === 'dolbyVision') {
    if (/^(?:yes|так|є|present|true)$/iu.test(raw)) add(fields, key, true, evidence);
    else if (/^(?:no|ні|нет|absent|false)$/iu.test(raw)) add(fields, key, false, evidence);
    else unknown(fields, key, 'No explicit positive/negative value for this HDR field.');
  } else if (key === 'resolution') {
    const tokens = raw.split(/\s*[,;/|]\s*/);
    const matches = [...new Set(tokens.filter(t => /^(?:4K|UHD|Full HD|HD|SD|[1-9]\d{2,3}p)$/i.test(t)))];
    if (matches.length) add(fields, key, matches, evidence);
    else unknown(fields, key, 'No supported explicit resolution value.');
    if (tokens.some(t => /^HDR10$/i.test(t))) add(fields, 'hdr10', true, evidence);
    if (tokens.some(t => /^Dolby Vision$/i.test(t))) add(fields, 'dolbyVision', true, evidence);
  } else if (key === 'access') {
    const access = ({ subscription: 'subscription', передплата: 'subscription', rental: 'rental', rent: 'rental', оренда: 'rental', purchase: 'purchase', buy: 'purchase', купівля: 'purchase' })[raw.toLowerCase()];
    if (typeof access === 'string') add(fields, key, access, evidence); else unknown(fields, key, 'Unsupported explicit access label; not guessed from a price/button.');
  } else add(fields, key, raw, evidence);
  return true;
}
function properties(fields, value, locator, issues) {
  const list = values(value); if (list.length > 100) { issues.push('property-count-limit'); return; }
  for (const [i, p] of list.entries()) if (object(p) && types(p['@type']).includes('PropertyValue') && safe(p.name) && safe(p.value)) labelled(fields, p.name, [p.value], { kind: 'json-ld', locator: `${locator}.additionalProperty[${i}]` });
}
function offerProjection(offer, index, issues) {
  const fields = emptyFields(), locator = `Movie.offers[${index}]`;
  if (!object(offer) || !types(offer['@type']).includes('Offer')) { issues.push(`offer-${index + 1}:unsupported-shape`); return { status: 'unsupported', fields }; }
  properties(fields, offer.additionalProperty, locator, issues);
  const business = ({ 'http://purl.org/goodrelations/v1#LeaseOut': 'rental', 'http://purl.org/goodrelations/v1#Sell': 'purchase' })[offer.businessFunction];
  if (typeof business === 'string') add(fields, 'access', business, { kind: 'json-ld', locator: `${locator}.businessFunction` });
  if ((typeof offer.price === 'number' && Number.isFinite(offer.price) && offer.price >= 0 || typeof offer.price === 'string' && /^\d+(?:\.\d+)?$/.test(offer.price)) && typeof offer.priceCurrency === 'string' && /^[A-Z]{3}$/.test(offer.priceCurrency)) {
    add(fields, 'price', { amount: String(offer.price), currency: offer.priceCurrency }, { kind: 'json-ld', locator: `${locator}.price/priceCurrency` });
  } else if (offer.price !== undefined || offer.priceCurrency !== undefined) unknown(fields, 'price', 'Incomplete/invalid explicit amount + currency; no price inferred.');
  for (const name of ['eligibleRegion', 'ineligibleRegion']) {
    const regions = values(offer[name]);
    if (regions.length > 50) { issues.push('region-count-limit'); continue; }
    const reported = regions.map(r => typeof r === 'string' ? r : object(r) ? r.name : undefined).filter(r => safe(r, 100));
    if (reported.length) add(fields, 'region', { relation: name, values: reported }, { kind: 'json-ld', locator: `${locator}.${name}` });
  }
  return { status: 'public-metadata', fields };
}

export async function extractMegogo(html) {
  const result = base();
  if (typeof html !== 'string' || Buffer.byteLength(html) > MEGOGO_LIMIT_BYTES) return { ...result, status: 'unsupported-markup', issues: ['html-size-or-type-limit'] };
  let parse; try { ({ parse } = await import('parse5')); } catch { return { ...result, status: 'parser-unavailable', issues: ['Install isolated parse5 dependency.'] }; }
  try {
    const parseErrors = [];
    const doc = parse(html, { onParseError: e => { if (parseErrors.length < 20) parseErrors.push(e.code); } });
    if (parseErrors.some(e => e !== 'missing-doctype')) return { ...result, status: 'unsupported-markup', issues: ['ambiguous-html-tokenization'] };
    const all = walk(doc), visible = all.filter(n => !inert(n));
    const visibleText = clean(visible.filter(n => n.nodeName === '#text').map(n => n.value).join(' '));
    if (/verify (?:that )?you are human|підтвердіть,? що ви людина|captcha challenge/iu.test(visibleText)) return { ...result, status: 'captcha-no-retry', issues: ['Visible challenge; no bypass.'] };
    const geo = /(?:not available in your (?:region|country)|недоступн[а-яіїєґ]* (?:у|в) ваш(?:ому|ій) (?:регіоні|країні))/iu.exec(visibleText)?.[0];
    if (geo) add(result.cardFields, 'region', geo, { kind: 'visible-message', locator: 'page' });
    const movies = [];
    for (const [i, script] of all.filter(n => n.tagName === 'script' && attr(n, 'type')?.toLowerCase() === 'application/ld+json' && !['nav', 'aside', 'footer'].some(t => { for (let p = n.parentNode; p; p = p.parentNode) if (p.tagName === t) return true; return false; })).entries()) {
      try {
        const json = JSON.parse((script.childNodes ?? []).filter(c => c.nodeName === '#text').map(c => c.value).join(''));
        const roots = values(json); if (roots.length > 100) throw new Error('json-count');
        for (const root of roots) {
          if (!object(root)) continue;
          const contextOK = values(root['@context']).some(c => typeof c === 'string' && /^https?:\/\/schema.org\/?$/.test(c));
          if (!contextOK) { result.issues.push(`json-ld-${i + 1}:unsupported-context`); continue; }
          const graph = root['@graph'] === undefined ? [root] : values(root['@graph']); if (graph.length > 100) throw new Error('graph-count');
          for (const item of graph) if (object(item) && types(item['@type']).includes('Movie')) movies.push(item);
        }
      } catch { result.issues.push(`json-ld-${i + 1}:malformed-or-unsupported`); }
    }
    const canonical = all.filter(n => n.tagName === 'link' && attr(n, 'rel') === 'canonical').map(n => nativeId(attr(n, 'href'))).filter(Boolean);
    const main = visible.filter(n => n.tagName === 'main');
    const scope = main.length === 1 ? walk(main[0]).filter(n => !inert(n)) : [];
    const h1 = scope.filter(n => n.tagName === 'h1');
    const records = [];
    for (const n of scope) {
      if (n.tagName === 'dt') { const siblings = n.parentNode.childNodes ?? []; const next = siblings.slice(siblings.indexOf(n) + 1).find(c => c.tagName); if (next?.tagName === 'dd') records.push([text(n), next]); }
      if (n.tagName === 'tr') { const cells = (n.childNodes ?? []).filter(c => ['td', 'th'].includes(c.tagName)); if (cells.length === 2) records.push([text(cells[0]), cells[1]]); }
    }
    const candidate = movies.length === 1 ? movies[0] : undefined;
    const observedTitles = [...(candidate ? values(candidate.name).filter(v => safe(v)) : []), ...(h1.length === 1 ? [text(h1[0])] : [])];
    const years = [...(candidate && safe(candidate.datePublished) ? [/^\d{4}/.exec(candidate.datePublished)?.[0]].filter(Boolean) : []),
      ...records.filter(([k]) => /^(?:рік|year|год)$/iu.test(labelKey(k))).map(([, n]) => text(n)),
      ...(h1.length === 1 ? [/\((\d{4})\)\s*$/.exec(text(h1[0]))?.[1]].filter(Boolean) : [])];
    const native = [...canonical, ...(candidate ? values(candidate.url ?? candidate['@id']).map(nativeId).filter(Boolean) : [])];
    const stable = candidate ? values(candidate.sameAs).filter(v => typeof v === 'string') : [];
    const imdb = stable.flatMap(v => { try { const u = new URL(v); return ['www.imdb.com', 'imdb.com'].includes(u.hostname) ? [/^\/title\/(tt\d+)(?:\/|$)/.exec(u.pathname)?.[1]].filter(Boolean) : []; } catch { return []; } });
    const tmdb = stable.flatMap(v => { try { const u = new URL(v); return ['www.themoviedb.org', 'themoviedb.org'].includes(u.hostname) ? [/^\/movie\/(\d+)(?:[-/]|$)/.exec(u.pathname)?.[1]].filter(Boolean) : []; } catch { return []; } });
    const conflict = native.some(v => v !== MEGOGO_IDS.nativeId) || imdb.some(v => v !== MEGOGO_IDS.imdbId) || tmdb.some(v => v !== String(MEGOGO_IDS.tmdbId)) || (movies.length <= 1 && observedTitles.some(t => !titles.has(titleKey(t))));
    const nameOK = observedTitles.length > 0 && observedTitles.every(t => titles.has(titleKey(t)));
    const yearOK = years.length > 0 && years.every(y => y === '2024');
    const matched = !conflict && movies.length <= 1 && native.includes(MEGOGO_IDS.nativeId) && nameOK && (yearOK || imdb.includes(MEGOGO_IDS.imdbId));
    result.identity = { status: conflict ? 'mismatch' : matched ? 'matched' : 'unknown',
      observed: { titles: observedTitles.filter(t => safe(t)), years: years.filter(y => safe(y, 10)), nativeIds: [...new Set(native)], imdbIds: imdb, tmdbIds: tmdb },
      basis: 'Observed card native ID + title + year (or exact supplied IMDb). Supplied conflicting IDs block fields; configured IDs are not observations.' };
    if (!matched) return { ...result, status: conflict ? 'identity-mismatch' : 'unsupported-markup-or-identity', issues: [...result.issues, 'Offer characteristics not attributed to unresolved film.'] };
    properties(result.cardFields, candidate?.additionalProperty, 'Movie', result.issues);
    let recognized = Object.values(result.cardFields).some(f => f.observations.length > 0);
    // Visible labels are read only in a unique main containing the matching H1,
    // not arbitrary footer/navigation/recommendation text.
    if (h1.length === 1 && titles.has(titleKey(text(h1[0])))) for (const [label, n] of records) {
      const items = walk(n).filter(c => c.tagName === 'li' && !inert(c));
      const parts = items.length ? items.map(text) : text(n).split(/\s*;\s*/);
      if (labelled(result.cardFields, label, parts, { kind: 'visible-labelled-field', locator: labelKey(label) })) recognized = true;
    }
    const offers = values(candidate?.offers);
    if (offers.length > 100) result.issues.push('offer-count-limit');
    else result.offers = offers.map((offer, i) => offerProjection(offer, i, result.issues));
    if (!recognized && !offers.length) result.issues.push('No supported characteristic fields; may be missing, JS/login-only or unsupported markup. No follow-up.');
    result.status = geo ? 'geo-restricted-public-metadata' : result.issues.length ? 'partial' : recognized || offers.length ? 'ok' : 'unsupported-characteristic-markup';
    return result;
  } catch { return { ...base(), status: 'unsupported-markup', issues: ['Parser/structure limits; no guessed data.'] }; }
}

export async function fetchMegogo(selection, fetchImpl = globalThis.fetch, { timeoutMs = MEGOGO_TIMEOUT_MS, maxBytes = MEGOGO_LIMIT_BYTES } = {}) {
  const verified = megogoScenario(selection.film, { discovery: selection.discovery, amazonRegion: selection.amazonRegion ?? undefined, urlSource: selection.urlSource });
  if (selection.retrieval !== 'megogo-html' || selection.sourceURL !== verified.sourceURL) throw new Error('Fixed MEGOGO source required.');
  try { await import('parse5'); } catch { return { ...base(), status: 'parser-unavailable' }; }
  const controller = new AbortController(); let reader;
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
  const timer = setTimeout(() => controller.abort(), timeoutMs), bounded = promise => Promise.race([promise, aborted]);
  const fail = (status, httpStatus) => ({ ...base(), status, ...(httpStatus ? { httpStatus } : {}) });
  try {
    const response = await bounded(fetchImpl(MEGOGO_URL, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'MovieWishlistResearchPoC/0.1 (manual fixed-card experiment)' }, signal: controller.signal }));
    const stop = status => { void response.body?.cancel().catch(() => {}); return fail(status, response.status); };
    if (response.status >= 300 && response.status < 400) return stop('redirect-not-followed');
    if (!response.ok) return stop(({ 403: 'access-blocked-no-retry', 429: 'rate-limited-no-retry', 451: 'geo-or-legal-block-no-retry' })[response.status] ?? 'http-error-no-retry');
    const type = response.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || /charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type)) return stop('unsupported-content-type');
    if (Number(response.headers.get('content-length')) > maxBytes) return stop('response-too-large');
    if (!response.body) return fail('empty-response', response.status);
    reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) { const { done, value } = await bounded(reader.read()); if (done) break; size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); return fail('response-too-large', response.status); } chunks.push(value); }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
    return { ...await extractMegogo(html), httpStatus: response.status, bytes: size };
  } catch { if (reader) void reader.cancel().catch(() => {}); return fail(controller.signal.aborted ? 'timeout-no-retry' : 'network-or-decoding-error-no-retry'); }
  finally { clearTimeout(timer); }
}
