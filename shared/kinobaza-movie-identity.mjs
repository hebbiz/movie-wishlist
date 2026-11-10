// Optional semantic film IDs. Never JSON-LD expansion, remote context fetching,
// arbitrary recursive object mining, URL discovery or a substitute for titles.
const attr = (node, key) => node.attrs?.find(a => a.name === key)?.value;
const normalize = value => typeof value === 'string' ? value.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA') : '';
const text = node => (node.childNodes ?? []).map(child => child.nodeName === '#text' ? child.value :
  ['script', 'style', 'template', 'noscript', 'iframe'].includes(child.tagName) ? '' : text(child)).join(' ').replace(/\s+/gu, ' ').trim();
const excluded = node => { for (let p = node; p; p = p.parentNode) if (['nav', 'aside', 'footer', 'template', 'noscript', 'iframe'].includes(p.tagName)) return true; return false; };
const contexts = new Set(['https://schema.org', 'http://schema.org', 'https://schema.org/', 'http://schema.org/']);
const movieTypes = new Set(['Movie', 'https://schema.org/Movie', 'http://schema.org/Movie']);
const safeString = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\p{C}<>]/u.test(value);
const safeCard = value => typeof value === 'string' && value.length <= 512 && /^https:\/\/kinobazaua\.com\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

// JSON.parse silently overwrites duplicate keys. Validate the bounded JSON
// grammar first; escaped duplicates are duplicates too. No eval or I/O.
export function parseBoundedMovieJSON(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 128 * 1024) throw Error('json-size');
  let index = 0, visited = 0;
  const whitespace = () => { while (index < raw.length && /[\x20\t\r\n]/.test(raw[index])) index++; };
  const string = () => {
    const start = index++;
    while (index < raw.length) {
      if (raw[index] === '\\') { index += 2; continue; }
      if (raw[index++] === '"') return JSON.parse(raw.slice(start, index));
    }
    throw Error('json-string');
  };
  const value = depth => {
    if (depth > 32 || ++visited > 20000) throw Error('json-limit');
    whitespace();
    if (raw[index] === '{') {
      index++; whitespace(); const keys = new Set();
      if (raw[index] === '}') { index++; return; }
      for (;;) {
        whitespace(); if (raw[index] !== '"') throw Error('json-key');
        const key = string(); if (keys.has(key)) throw Error('json-duplicate-key'); keys.add(key);
        whitespace(); if (raw[index++] !== ':') throw Error('json-colon'); value(depth + 1); whitespace();
        if (raw[index] === '}') { index++; return; }
        if (raw[index++] !== ',') throw Error('json-object');
      }
    }
    if (raw[index] === '[') {
      index++; whitespace(); if (raw[index] === ']') { index++; return; }
      for (;;) { value(depth + 1); whitespace(); if (raw[index] === ']') { index++; return; } if (raw[index++] !== ',') throw Error('json-array'); }
    }
    if (raw[index] === '"') { string(); return; }
    const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(index));
    if (!literal) throw Error('json-value'); index += literal[0].length;
  };
  value(0); whitespace(); if (index !== raw.length) throw Error('json-trailing');
  return JSON.parse(raw);
}

export function parseMovieSameAsID(value) {
  if (!safeString(value)) return null;
  let match = /^https:\/\/(?:www\.)?imdb\.com\/title\/(tt\d{1,20})\/?$/.exec(value);
  if (match) return { namespace: 'imdb', id: match[1] };
  match = /^https:\/\/(?:www\.)?themoviedb\.org\/movie\/([1-9]\d{0,9})(?:-[a-z0-9-]+)?\/?$/.exec(value);
  return match ? { namespace: 'tmdb', id: match[1] } : null;
}
const knownIDHost = value => {
  try { return ['imdb.com', 'www.imdb.com', 'themoviedb.org', 'www.themoviedb.org'].includes(new URL(value).hostname); }
  catch { return false; }
};

export function movieSameAsEvidence(all, sourceURL) {
  const empty = (status, reason, extra = {}) => ({ status, reason, records: [], movieCount: 0, datePublished: null, ...extra });
  const active = all.filter(node => !excluded(node));
  const canonicals = active.filter(node => node.tagName === 'link' && (attr(node, 'rel') ?? '').split(/\s+/).includes('canonical')).map(node => attr(node, 'href'));
  if (!safeCard(sourceURL) || canonicals.length !== 1 || canonicals[0] !== sourceURL) return empty('unavailable', 'canonical-not-established');
  const h1 = active.filter(node => node.tagName === 'h1');
  const accordions = active.filter(node => attr(node, 'id') === 'availabilityAccordion');
  const heading = h1.length === 1 ? /^(.*?)\s*\(\s*\d{4}\s*\)\s*$/.exec(text(h1[0]))?.[1] : null;
  const h2 = h1.length === 1 && accordions.length === 1 ? active.filter(node => node.tagName === 'h2' &&
    node.sourceCodeLocation?.startOffset > h1[0].sourceCodeLocation?.startOffset &&
    node.sourceCodeLocation?.startOffset < accordions[0].sourceCodeLocation?.startOffset).map(text).filter(Boolean) : [];
  const scripts = active.filter(node => node.tagName === 'script' && attr(node, 'type')?.trim().toLowerCase() === 'application/ld+json');
  if (scripts.length > 8) return empty('unavailable', 'semantic-script-limit');
  const owned = [], errors = []; let bytes = 0, incomplete = false;
  for (const script of scripts) {
    const raw = (script.childNodes ?? []).filter(node => node.nodeName === '#text').map(node => node.value).join('');
    bytes += Buffer.byteLength(raw);
    if (bytes > 128 * 1024) { incomplete = true; break; }
    let data;
    try { data = parseBoundedMovieJSON(raw); }
    catch (error) {
      incomplete = true;
      // Unlike arbitrary syntax damage, duplicate keys are parseable JSON with
      // overwritten authority. We cannot choose the convenient final value or
      // reliably classify an overwritten @type/url as an unrelated document.
      if (error.message === 'json-duplicate-key') errors.push('semantic-json-duplicate-key');
      continue;
    }
    const roots = Array.isArray(data) ? data : [data];
    // Only document roots/arrays and their immediate @graph. Nested Person,
    // recommendations, mainEntity/review/actor objects cannot donate Movie IDs.
    for (const root of roots) {
      if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
      const top = [root, ...(Array.isArray(root['@graph']) ? root['@graph'] : [])];
      for (const node of top) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        if (!types.some(type => movieTypes.has(type))) continue;
        const ownURL = typeof node.url === 'string' ? node.url : node.url && typeof node.url === 'object' && !Array.isArray(node.url) &&
          Object.keys(node.url).length === 1 ? node.url['@id'] : null;
        if (ownURL !== sourceURL) continue;
        owned.push(node);
        const inheritedContext = root['@context'];
        const context = Object.hasOwn(node, '@context') ? node['@context'] : inheritedContext;
        if (!contexts.has(context)) errors.push('semantic-context-unsupported');
        if (types.some(type => !movieTypes.has(type))) errors.push('semantic-mixed-type');
        if (node['@id'] !== undefined && (!safeString(node['@id']) ||
            node['@id'] !== sourceURL && !node['@id'].startsWith(sourceURL + '#'))) errors.push('semantic-own-id-conflict');
        if (!safeString(node.name) || !(heading && normalize(node.name) === normalize(heading) || h2.length === 1 && normalize(node.name) === normalize(h2[0]))) errors.push('semantic-name-source-conflict');
      }
    }
  }
  if (owned.length > 1) return empty('ambiguous', 'semantic-owned-movie-ambiguous', { movieCount: owned.length });
  if (!owned.length) return empty(errors.length ? 'ambiguous' : 'unavailable', errors[0] ?? (incomplete ? 'semantic-json-unavailable' : 'no-owned-movie'));
  const node = owned[0], sameAs = node.sameAs === undefined ? [] : Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
  const records = [];
  if (sameAs.length > 32 || sameAs.some(value => !safeString(value))) errors.push('semantic-sameas-shape');
  else for (const address of sameAs) {
    const parsed = parseMovieSameAsID(address);
    if (parsed) records.push({ ...parsed, filmScope: true, provenance: 'jsonld-owned-movie-sameas' });
    else if (knownIDHost(address)) errors.push('semantic-movie-id-shape');
  }
  // Known owned-ID conflicts remain visible even when another JSON document is
  // broken. Incomplete optional JSON never supplies positive semantic proof.
  const conflict = ['imdb', 'tmdb'].some(namespace => new Set(records.filter(record => record.namespace === namespace).map(record => record.id)).size > 1);
  const rawDate = node.datePublished;
  const shapedDate = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(rawDate) && rawDate.length <= 64;
  const parsedDate = shapedDate ? new Date(rawDate.slice(0, 10) + 'T00:00:00Z') : null;
  const datePublished = shapedDate && Number.isFinite(Date.parse(rawDate)) && Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === rawDate.slice(0, 10) ? rawDate : null;
  if (conflict) return { status: 'conflict', reason: 'semantic-multiple-ids', records, movieCount: 1, datePublished };
  if (errors.length) return empty('ambiguous', errors[0], { records, movieCount: 1, datePublished });
  if (incomplete) return empty('unavailable', 'semantic-json-unavailable', { records: records.map(record => ({ ...record, filmScope: false })), movieCount: 1, datePublished });
  return { status: records.length ? 'available' : 'unavailable', reason: records.length ? 'owned-movie-sameas' : 'sameas-without-film-id', records, movieCount: 1, datePublished };
}
