// Direct fixed-film / supported-pointer explanations only. No fetch, joins or mutation.
import { classifyLink, mapProvider } from './discovery.mjs';
import { MOTN_FILMS } from './motn.mjs';

const value = f => f?.state === 'reported' ? f.value : undefined;
const answer = (outcome, reason, extra = {}) => ({ outcome, reason, ...extra });
const insufficient = reason => answer('insufficient-evidence', reason);
const conflict = reason => answer('conflicting', reason);

function filmAssociation(source, expected) {
  const refs = { source: source.source, evidenceRefs: [`sources.${source.source}.evidence`] };
  const done = a => ({ ...a, ...refs });
  if (source.identity === 'mismatch') return done(conflict('stable-id-conflict'));
  if (source.identity !== 'matched') return done(insufficient('source-identity-unresolved'));
  const e = source.evidence;
  if (source.source === 'kinobaza') return done(e?.status === 'matched'
    ? answer('compatible', 'structural-film-gate', { basis: 'title/year/director gate; not a stable-ID crosswalk' })
    : insufficient('source-identity-unresolved'));
  const tmdb = source.source === 'tmdb';
  const ids = tmdb ? [e?.details?.tmdbId, e?.providers?.tmdbId] : [e?.tmdbId];
  const imdbs = tmdb ? [e?.details?.detailsImdb, e?.details?.externalImdb] : [e?.imdbId];
  for (const f of ids) {
    const v = value(f);
    if (v !== undefined && ![String(expected.tmdbId), `movie/${expected.tmdbId}`].includes(String(v))) return done(conflict('stable-id-conflict'));
    if (f?.state === 'invalid') return done(insufficient('source-identity-unresolved'));
  }
  for (const f of imdbs) {
    const v = value(f);
    if (v !== undefined && v !== expected.imdbId) return done(conflict('stable-id-conflict'));
    if (f?.state === 'invalid') return done(insufficient('source-identity-unresolved'));
  }
  if (tmdb ? value(e?.details?.tmdbId) !== Number(expected.tmdbId) : value(e?.imdbId) !== expected.imdbId) return done(insufficient('source-identity-unresolved'));
  return done(answer('compatible', tmdb ? 'tmdb-primary-gate' : 'imdb-film-gate', {
    crosswalk: imdbs.some(f => value(f) === expected.imdbId) ? 'reported-match' : 'unknown',
    yearVariance: !tmdb && value(e?.year) !== undefined && value(e.year) !== expected.year,
  }));
}

// Narrower than navigation: an accepted href can still lack a comparable region/key.
export function supportedPointer(row) {
  const checked = classifyLink(row.link?.href, row.provider);
  if (row.link?.kind !== 'exact-card-unverified' || checked.kind !== 'exact-card-unverified') return insufficient('no-supported-direct-pointer');
  const u = new URL(row.link.href);
  // Never equate parser-normalized paths/explicit ports or unknown fragments.
  const authority = /^https:\/\/([^/]+)\//i.exec(row.link.href)?.[1];
  if (!authority || authority.includes(':') || /(?:%2f|%5c|%2e|\/\.\.?\/)/i.test(row.link.href.split('?')[0]) || u.hash) return insufficient('pointer-qualifiers-unresolved');
  const keys = new Set();
  for (const pair of u.search.slice(1).split('&').filter(Boolean)) {
    let key;
    try { key = decodeURIComponent(pair.split('=')[0].replaceAll('+', ' ')); } catch { return insufficient('pointer-qualifiers-unresolved'); }
    if (row.provider.key === 'apple' && key === 'at') continue; // Comparison only; original URL and R1 gate untouched.
    if (keys.has(key)) return insufficient('pointer-qualifiers-unresolved');
    keys.add(key);
  }
  if (keys.size) return insufficient('pointer-qualifiers-unresolved');
  const path = u.pathname; let match, namespace, nativeId, route;
  if (row.provider.key === 'apple' && u.hostname === 'tv.apple.com' && (match = /^\/([a-z]{2})\/movie\/[^/]+\/(umc\.cmc\.[a-z0-9]+)$/i.exec(path))) {
    namespace = 'apple-tv-card'; nativeId = match[2]; route = `route:${match[1].toLowerCase()}`;
  } else if (row.provider.key === 'apple' && u.hostname === 'itunes.apple.com' && (match = /^\/ua\/movie\/id(\d+)$/.exec(path))) {
    namespace = 'itunes-movie'; nativeId = match[1]; route = 'route:ua';
  } else if (row.provider.key === 'megogo' && (match = /^\/ua\/view\/(\d+)(?:-[^/]+\.html)?$/.exec(path))) {
    namespace = 'megogo-view'; nativeId = match[1]; route = 'route:ua';
  } else if (row.provider.key === 'rakuten') {
    namespace = 'rakuten-card-path'; nativeId = path; route = 'route:ua'; // Path pointer, not an invented native ID.
  } else if (row.provider.key === 'prime' && (match = /^\/detail\/([a-z0-9]+)\/?$/i.exec(path))) {
    namespace = 'prime-detail'; nativeId = match[1];
  } else if (row.provider.key === 'prime' && (match = /^\/detail\/([a-z0-9]+)\/ref=atv_[a-z0-9_]+$/i.exec(path))) {
    namespace = 'prime-detail'; nativeId = match[1]; // Accepted literal referral route only; no destination rewrite.
  } else if (row.provider.key === 'netflix' && (match = /^\/title\/(\d+)\/?$/.exec(path))) {
    namespace = 'netflix-title'; nativeId = match[1];
  } else return insufficient('regional-pointer-unresolved'); // Prefix language/market semantics not established.
  if (!route) {
    if (row.country !== 'UA') return insufficient('regional-pointer-unresolved');
    route = 'source-market:UA'; // Source context, never entitlement or inferred URL geography.
  }
  return answer('compatible', 'supported-pointer', { namespace, ...(namespace === 'rakuten-card-path' ? { pathPointer: nativeId } : { nativeId }), route,
    key: JSON.stringify([row.provider.key, namespace, route, nativeId]),
    comparisonScope: JSON.stringify([row.provider.key, namespace, route]), destination: 'unverified' });
}

export function describeDiscovery(result) {
  const expected = Object.hasOwn(MOTN_FILMS, result?.film?.id) ? MOTN_FILMS[result.film.id] : null;
  if (!expected) return { subjects: [], rows: [], limitation: 'fixed-film-unresolved' };
  const subjects = ['tmdb', 'motn', 'kinobaza'].map(source => filmAssociation(
    result.sources?.find(s => s.source === source) ?? { source, identity: 'unresolved' }, expected));
  const gates = new Map(subjects.map(s => [s.source, s]));
  const pointers = new Map(), firstProvider = new Map(), entries = [], rowIndex = new Map((result.rows ?? []).map(r => [r.id, r]));
  for (const row of result.rows ?? []) {
    const source = typeof row.id === 'string' ? row.id.split(':')[0] : '';
    let A = gates.get(source) ?? insufficient('source-identity-unresolved');
    if (row.filmId !== result.film.id) A = conflict('row-film-conflict');
    const entry = { rowId: row.id, source, A, B: insufficient('source-identity-unresolved'),
      scopeGaps: [row.country ? null : 'territory-unknown', value(row.access) ? null : 'access-unknown', value(row.cut) ? null : 'version-unknown'].filter(Boolean),
      limitation: 'no-offer-or-field-enrichment', evidenceRefs: ['row.link', 'row.provenance', 'source.identity'] };
    entries.push(entry);
    if (A.outcome !== 'compatible' || row.identityStatus !== 'matched') continue;
    const sourceId = row.provider?.sourceId;
    if (sourceId && result.unmapped?.some(u => u.reason === 'provider-id-conflict' && u.sourceId === sourceId)) { entry.B = conflict('provider-id-conflict'); continue; }
    const rawId = sourceId?.startsWith(`${source}:provider:`) ? sourceId.slice(`${source}:provider:`.length) : undefined;
    const mapped = mapProvider(source, source === 'tmdb' && rawId !== undefined ? Number(rawId) : rawId, row.provider?.sourceName, value(row.access));
    if (!mapped || mapped.key !== row.provider?.key) { entry.B = insufficient('provider-mapping-unresolved'); continue; }
    entry.pointer = supportedPointer(row); entry.B = { ...entry.pointer };
    if (entry.pointer.outcome !== 'compatible') continue;
    const ref = { rowId: row.id, source, country: row.country ?? null, pointer: entry.pointer };
    const bucket = pointers.get(entry.pointer.key) ?? { first: ref, second: null, otherSource: null, count: 0 };
    if (bucket.count === 1) bucket.second = ref;
    if (source !== bucket.first.source && !bucket.otherSource) bucket.otherSource = ref;
    bucket.count++; pointers.set(entry.pointer.key, bucket);
    const platform = firstProvider.get(row.provider.key) ?? { first: ref, second: null };
    if (ref.pointer.key !== platform.first.pointer.key && !platform.second) platform.second = ref;
    firstProvider.set(row.provider.key, platform);
    entry.providerKey = row.provider.key;
  }
  // Linear key lookup with one explicit comparison per row, not an all-pairs engine/graph.
  for (const entry of entries) {
    if (entry.pointer?.outcome !== 'compatible') continue;
    const bucket = pointers.get(entry.pointer.key);
    const ownRow = rowIndex.get(entry.rowId), platform = firstProvider.get(entry.providerKey);
    const peer = bucket.count > 1 ? entry.source === bucket.first.source && bucket.otherSource ? bucket.otherSource : bucket.first.rowId === entry.rowId ? bucket.second : bucket.first
      : platform.first.rowId === entry.rowId ? platform.second : platform.first;
    if (!peer || peer.rowId === entry.rowId) { entry.B = insufficient('no-comparable-card-peer'); continue; }
    const evidence = { peer: { rowId: peer.rowId, source: peer.source }, evidenceRefs: [entry.rowId + '.link', peer.rowId + '.link'] };
    const ownCut = value(ownRow.cut), peerCut = value(rowIndex.get(peer.rowId)?.cut);
    if (ownCut !== undefined && peerCut !== undefined && ownCut !== peerCut) entry.scopeGaps.push('version-claims-differ-no-enrichment');
    if (ownRow.country && peer.country && ownRow.country !== peer.country) entry.B = answer('insufficient-evidence', 'source-territory-differs', evidence);
    else if (peer.pointer.key === entry.pointer.key) entry.B = answer('compatible', 'same-supported-regional-pointer', evidence);
    else if (peer.pointer.comparisonScope === entry.pointer.comparisonScope && entry.pointer.nativeId !== undefined) entry.B = answer('conflicting', 'different-supported-card-ids', evidence);
    else entry.B = answer('insufficient-evidence', 'regional-pointer-unresolved', evidence);
  }
  return { subjects, rows: entries, limitation: 'direct-A-B-only; separate rows; C/D deferred; destination and entitlement unverified' };
}
