import { classifyLink } from '../shared/media-link-policy.mjs';

const platforms = new Set(['apple', 'netflix', 'hbo', 'prime', 'megogo', 'rakuten']);
const editionFields = ['cut', 'package', 'version'];

// Navigation comparison only. No destination fetch, URL replacement or offer
// join: all members and the representative are original source-row objects.
function strictURL(href) {
  const original = /^https:\/\/([^/?#]+)(\/[^?#]*)(\?[^#]*)?$/.exec(href);
  if (!original || original[1].includes(':') || /[%\\]/.test(original[2])) return null;
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.username || url.password || url.port || url.hash || url.pathname !== original[2] ||
      original[1].toLowerCase() !== url.hostname) return null;
  return { url, query: original[3]?.slice(1) ?? null };
}

function queryPairs(query) {
  if (query === null) return [];
  if (!query) return null; // Even an unclassified empty marker stays literal.
  const pairs = [], keys = new Set();
  for (const pair of query.split('&')) {
    const index = pair.indexOf('=');
    if (index < 1) return null;
    const key = pair.slice(0, index), value = pair.slice(index + 1);
    if (!/^[A-Za-z_][A-Za-z_\d]*$/.test(key) || keys.has(key)) return null;
    // Do not interpret encoded keys, malformed encoding or duplicate keys.
    try { decodeURIComponent(value.replaceAll('+', ' ')); } catch { return null; }
    keys.add(key); pairs.push([key, value]);
  }
  return pairs;
}

function directPointer(href, providerKey) {
  if (classifyLink(href, { key: providerKey }).kind !== 'exact-card-unverified') return null;
  const parsed = strictURL(href);
  if (!parsed) return null;
  const { url, query } = parsed, pairs = queryPairs(query);
  if (!pairs) return null;
  let namespace, country, card, match;
  if (providerKey === 'apple' && url.hostname === 'tv.apple.com' &&
      (match = /^\/([a-z]{2})\/movie\/[^/]+\/(umc\.cmc\.[a-z0-9]+)$/.exec(url.pathname))) {
    namespace = 'apple-tv-card'; country = match[1].toUpperCase(); card = match[2];
  } else if (providerKey === 'apple' && url.hostname === 'itunes.apple.com' &&
      (match = /^\/ua\/movie\/id(\d+)$/.exec(url.pathname))) {
    namespace = 'itunes-movie'; country = 'UA'; card = match[1];
  } else if (providerKey === 'rakuten' && ['rakuten.tv', 'www.rakuten.tv'].includes(url.hostname) &&
      /^\/ua\/movies\/[^/]+\/?$/.test(url.pathname)) {
    // An exact regional path, not a guessed Rakuten content ID. Different
    // hosts, slugs or trailing slashes are not silently declared equivalent.
    namespace = url.hostname; country = 'UA'; card = url.pathname;
  } else return null;

  const qualifiers = [];
  for (const [key, value] of pairs) {
    // Apple's documented affiliate/campaign/group/partner tokens do not select a movie.
    // Their original values remain in the chosen href and every source row.
    if (providerKey === 'apple' && ['at', 'ct', 'itscg', 'itsct'].includes(key)) continue;
    if (providerKey === 'apple' && key === 'playableId') {
      // Query transport may percent-encode the content ID. Decode this known
      // qualifier once, never recursively; absence or another ID remains distinct.
      const decoded = decodeURIComponent(value.replaceAll('+', ' '));
      if (!/^[A-Za-z\d._:-]{1,512}$/.test(decoded)) return null;
      qualifiers.push([key, 'content-id', decoded]); continue;
    }
    // No semantics are assigned to other parameters. Preserve their exact
    // raw values and order, so only documented tracking differences disappear.
    qualifiers.push([key, 'raw', value]);
  }
  return { country, key: JSON.stringify([providerKey, namespace, country, card, qualifiers]) };
}

function declaredPointer(href, providerKey) {
  const parsed = strictURL(href);
  if (!parsed || parsed.url.hostname !== 'click.justwatch.com' || parsed.url.pathname !== '/a') return null;
  const pairs = queryPairs(parsed.query);
  if (!pairs || pairs.length !== 3 || pairs.some(([key]) => !['cx', 'r', 'uct_country'].includes(key))) return null;
  const parameters = parsed.url.searchParams;
  if (!['cx', 'r', 'uct_country'].every(key => parameters.getAll(key).length === 1) ||
      parameters.get('uct_country')?.toUpperCase() !== 'UA') return null;
  const target = parameters.get('r'), pointer = directPointer(target, providerKey);
  // The embedded value is a declared target, never a verified redirect. It
  // must independently be an admitted card of this provider and this market.
  return pointer?.country === 'UA' ? pointer : null;
}

function semanticKey(row, href, providerKey) {
  const pointer = directPointer(href, providerKey) ?? declaredPointer(href, providerKey);
  if (!pointer || row.country && row.country !== pointer.country) return null;
  if (row.conflicts != null && !Array.isArray(row.conflicts) || row.conflicts?.some(conflict => editionFields.includes(conflict?.field))) return null;
  const editions = [];
  for (const field of editionFields) {
    const qualifier = row[field];
    if (qualifier == null || ['unknown', 'not-reported', 'missing', 'null'].includes(qualifier.state)) editions.push(null);
    else if (field === 'package' && typeof qualifier === 'object' && Object.keys(qualifier).length > 0 &&
        Object.keys(qualifier).every(key => ['id', 'name'].includes(key))) {
      // MOTN's existing projection keeps independent package ID/name fields.
      // Missing fields are unknown, not a new package; reported values stay
      // exact, without equating names and IDs or borrowing another row's data.
      const values = [];
      for (const key of ['id', 'name']) {
        const value = qualifier[key];
        if (value == null || ['unknown', 'not-reported', 'missing', 'null'].includes(value.state)) values.push(null);
        else if (value.state === 'reported' && (['string', 'boolean'].includes(typeof value.value) || typeof value.value === 'number' && Number.isFinite(value.value))) values.push(value.value);
        else return null;
      }
      editions.push(values.every(value => value === null) ? null : ['package-id-name', ...values]);
    }
    else if (qualifier.state === 'reported' && (['string', 'boolean'].includes(typeof qualifier.value) || typeof qualifier.value === 'number' && Number.isFinite(qualifier.value))) editions.push(qualifier.value);
    else return null;
  }
  return JSON.stringify([pointer.key, editions]);
}

export function groupLinkChoices(rows, { providerKey, preferredRow } = {}) {
  if (!platforms.has(providerKey)) return [];
  const literal = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.identityStatus !== 'matched' || row.providerConflict || row.provider?.key !== providerKey) continue;
    const link = classifyLink(row.link?.href, row.provider);
    if (!link.transferable) continue;
    let choice = literal.get(link.href);
    if (!choice) {
      choice = { row, href: link.href, members: [], equivalence: 'literal-url' };
      literal.set(link.href, choice);
    }
    choice.members.push(row);
    if (row === preferredRow) { choice.row = row; choice.href = link.href; }
  }

  const choices = [], comparable = new Map();
  for (const choice of literal.values()) {
    // Literal duplicates are one navigation action even when their claims
    // differ. Such differences must not bridge to another semantic group.
    const keys = choice.members.map(row => semanticKey(row, choice.href, providerKey));
    const key = keys[0] && keys.every(value => value === keys[0]) ? keys[0] : null;
    const existing = key ? comparable.get(key) : null;
    if (!existing) {
      choices.push(choice); if (key) comparable.set(key, choice); continue;
    }
    existing.members.push(...choice.members);
    existing.equivalence = 'same-admitted-card-pointer';
    if (choice.members.includes(preferredRow)) { existing.row = preferredRow; existing.href = preferredRow.link.href; }
  }
  return choices;
}
