// Source-scoped row composition. Source adapters supply provenance URLs explicitly.
const providers = {
  apple: { name: 'Apple TV Store', medium: 'Apple TV / iTunes' }, rakuten: { name: 'Rakuten TV', medium: 'Rakuten TV' },
  appletvplus: { name: 'Apple TV+', medium: 'Apple TV / iTunes' },
  hbo: { name: 'HBO Max', medium: 'HBO Max' }, netflix: { name: 'Netflix', medium: 'Netflix' },
  prime: { name: 'Prime Video', medium: 'Prime Video' }, megogo: { name: 'MEGOGO', medium: 'Megogo' },
};
const aliases = new Map([
  ['apple tv store', 'apple'], ['itunes', 'apple'], ['apple tv / itunes', 'apple'],
  ['apple tv+', 'appletvplus'], ['apple tv plus', 'appletvplus'],
  ['rakuten tv', 'rakuten'], ['rakuten', 'rakuten'], ['hbo max', 'hbo'], ['netflix', 'netflix'],
  ['prime video', 'prime'], ['amazon prime video', 'prime'], ['amazon prime', 'prime'], ['megogo', 'megogo'],
]);
const val = f => f?.state === 'reported' ? f.value : undefined;
const unknown = note => ({ state: 'unknown', note });
// Projected shape only: no response values, redirect destinations or body archive.
export function tmdbShapeDiagnostics(details) {
  const fields = []; let omitted = 0;
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (['missing', 'null', 'invalid', 'reported-empty'].includes(node.state)) {
      if (fields.length < 32) fields.push({ path, state: node.state }); else omitted++;
    }
    for (const [key, child] of Object.entries(node)) if (child && typeof child === 'object') visit(child, `${path}.${key}`);
  };
  visit(details?.metadata, 'metadata');
  return { status: details?.status ?? 'unresolved', resources: details?.resources ?? {}, fields, omitted,
    note: 'Resource states and field states differ. Missing optional fields alone do not make A partial; missing/null/invalid resources or invalid metadata do. These paths describe this run only.' };
}
export function mapProvider(source, id, name, access) {
  let key = typeof name === 'string' ? aliases.get(name.trim().toLowerCase()) : undefined;
  // Apple TV is a shared brand, not an offer identity. Disambiguate only by
  // explicit source provider ID/access, never by a link's host or parameters.
  if (typeof name === 'string' && name.trim().toLowerCase() === 'apple tv') {
    if (source === 'tmdb' && id === 2 || source === 'motn' && id === 'apple' && ['rent', 'buy'].includes(access)) key = 'apple';
    if (access === 'subscription' && (source === 'tmdb' && id === 350 || source === 'motn' && id === 'apple' || source === 'kinobaza')) key = 'appletvplus';
  }
  if (!key) return null;
  if (source === 'tmdb' && (id === 2 && key !== 'apple' || key === 'apple' && (id !== 2 || access === 'subscription') ||
      id === 350 && key !== 'appletvplus' || key === 'appletvplus' && (id !== 350 || access !== 'subscription'))) return null;
  if (source === 'motn') {
    const ids = { apple: 'apple', appletvplus: 'apple', prime: 'prime', netflix: 'netflix' };
    if (ids[key] !== id || key === 'apple' && !['rent', 'buy'].includes(access) || key === 'appletvplus' && access !== 'subscription') return null;
  }
  if (source === 'kinobaza' && key === 'appletvplus' && access !== undefined && access !== 'subscription') return null;
  if (source === 'kinobaza' && key === 'apple' && access === 'subscription') return null;
  return { key, ...providers[key], sourceId: id === undefined ? null : `${source}:provider:${id}`, sourceName: name };
}

// Compare only explicit source IDs and recognized canonical labels. This is not
// an offer join: compatible aliases/access buckets stay distinct observations.
export function conflictingProviderIds(claims) {
  const platforms = new Map(), observations = new Map();
  for (const { source, id, name, access } of claims) {
    if (!(Number.isSafeInteger(id) && id > 0 || typeof id === 'string' && id.length > 0)) continue;
    const key = typeof name === 'string' ? aliases.get(name.trim().toLowerCase()) ?? mapProvider(source, id, name, access)?.key : undefined;
    if (!key) continue;
    const sourceId = `${source}:provider:${id}`;
    if (!platforms.has(sourceId)) platforms.set(sourceId, new Set());
    platforms.get(sourceId).add(key);
    if (!observations.has(sourceId)) observations.set(sourceId, []);
    observations.get(sourceId).push({ source, id, name, access });
  }
  return new Map([...platforms].filter(([id, keys]) => {
    if (keys.size < 2) return false;
    // MOTN legitimately reuses service ID apple for rent/buy and subscription.
    // Exempt only fully consistent, independently mapped observations. A Store
    // subscription or another platform with that same ID remains a conflict.
    const distinctAppleProducts = id === 'motn:provider:apple' && keys.size === 2 && keys.has('apple') && keys.has('appletvplus') &&
      observations.get(id).every(c => ['apple', 'appletvplus'].includes(mapProvider(c.source, c.id, c.name, c.access)?.key));
    return !distinctAppleProducts;
  }).map(([id, keys]) => [id, [...keys]]));
}

import { classifyLink } from '../../shared/media-link-policy.mjs';
export { classifyLink };

function rowBase(source, film, provider, index, provenance) {
  return { id: `${source}:${index}`, filmId: film.id, provider, country: 'UA', territoryBasis: 'source country context',
    kind: 'source-offer', access: unknown('Not reported'), package: unknown('Not reported'), cut: unknown('Not reported'),
    availability: { state: 'source-reported', value: 'available', note: 'Aggregator UA claim, not account entitlement.' },
    accountEntitlement: 'unknown', audio: unknown('No provider track evidence'), subtitles: unknown('No provider subtitle evidence'),
    quality: unknown('Not reported'), hdr10: unknown('Not reported'), dolbyVision: unknown('Not reported'), price: unknown('Not reported'),
    link: classifyLink(null), provenance, conflicts: [], comparisons: [], comparisonsOmitted: 0, choiceBasis: [], identityStatus: 'matched' };
}

export function composeDiscovery(film, stages, { synthetic = false, metrics = {}, sourceURLs } = {}) {
  const tmdbURL = () => sourceURLs?.tmdb;
  const motnURL = () => sourceURLs?.motn;
  const rows = [], unmapped = []; const add = r => { r.choiceBasis = [r.country === 'UA' ? `${r.availability.state}; UA source context` : 'Territory unknown',
    'Audio/subtitles/video/price remain source-scoped; unknown is not absent.']; rows.push(r); };
  const tmdb = stages.tmdb.result, motn = stages.motn.result, kino = stages.kinobaza.result;
  const tmdbIdentity = tmdb?.providers?.identity?.status === 'mismatch' ? 'mismatch' : tmdb?.identity?.identity?.status;
  const sources = [
    { source: 'tmdb', status: stages.tmdb.status, identity: tmdbIdentity ?? 'unresolved', evidence: { details: tmdb?.identity?.identity ?? null, providers: tmdb?.providers?.identity ?? null }, diagnostics: tmdbShapeDiagnostics(tmdb?.identity), elapsedMs: stages.tmdb.elapsedMs },
    { source: 'motn', status: stages.motn.status, identity: motn?.identity?.status ?? 'unresolved', evidence: motn?.identity ?? null, elapsedMs: stages.motn.elapsedMs },
    { source: 'kinobaza', status: stages.kinobaza.status, identity: kino?.identity?.status ?? 'unresolved', evidence: kino?.identity ?? null, elapsedMs: stages.kinobaza.elapsedMs },
  ];
  const providerClaims = [];
  if (tmdbIdentity === 'matched' && ['ok', 'partial'].includes(tmdb?.providers?.status)) {
    for (const b of tmdb.providers.buckets ?? []) for (const p of b.providers?.items ?? []) providerClaims.push({ source: 'tmdb', id: val(p.id), name: val(p.name), access: b.access });
  }
  if (motn?.identity?.status === 'matched') for (const o of motn.options ?? []) providerClaims.push({ source: 'motn', id: val(o.service.id), name: val(o.service.name), access: val(o.access) });
  const providerConflicts = conflictingProviderIds(providerClaims);
  if (tmdbIdentity === 'matched' && ['ok', 'partial'].includes(tmdb?.providers?.status)) {
    for (const b of tmdb.providers.buckets ?? []) for (const p of b.providers?.items ?? []) {
      const sourceId = `tmdb:provider:${val(p.id)}`;
      if (providerConflicts.has(sourceId)) {
        unmapped.push({ source: 'tmdb', id: val(p.id), name: val(p.name), sourceId, sourceBucket: b.name,
          reason: 'provider-id-conflict', conflictingPlatforms: providerConflicts.get(sourceId), observation: p,
          provenance: { source: 'TMDB / JustWatch', upstream: 'JustWatch', method: 'API results.UA', country: 'UA', sourceURL: tmdbURL(), receivedAt: tmdb.providers.receivedAt } });
        continue; // No canonical platform/access/availability row or draft medium.
      }
      const provider = mapProvider('tmdb', val(p.id), val(p.name), b.access);
      if (!provider) { unmapped.push({ source: 'tmdb', id: val(p.id) ?? null, name: val(p.name) ?? null, access: b.access,
        observation: p, sourceBucket: b.name, reason: 'provider-mapping-unresolved' }); continue; }
      const r = rowBase('tmdb', film, provider, rows.length, { source: 'TMDB / JustWatch', upstream: 'JustWatch', method: 'API results.UA',
        sourceURL: tmdbURL(), receivedAt: tmdb.providers.receivedAt, observationTime: null });
      r.access = { state: 'reported', value: b.access, sourceBucket: b.name };
      r.watchPage = val(tmdb.providers.watchLink) ?? null; // Not a provider URL.
      add(r);
    }
  }
  if (motn?.identity?.status === 'matched') for (const [i, o] of (motn.options ?? []).entries()) {
    const sourceId = `motn:provider:${val(o.service.id)}`;
    if (providerConflicts.has(sourceId)) {
      unmapped.push({ source: 'motn', id: val(o.service.id), name: val(o.service.name), sourceId,
        reason: 'provider-id-conflict', conflictingPlatforms: providerConflicts.get(sourceId), observation: o,
        provenance: { source: 'Movie of the Night', upstream: 'not-established', method: 'API streamingOptions.ua', country: 'UA', sourceURL: motnURL(), receivedAt: motn.receivedAt } });
      continue;
    }
    const provider = mapProvider('motn', val(o.service.id), val(o.service.name), val(o.access));
    if (!provider) { unmapped.push({ source: 'motn', id: val(o.service.id) ?? null, name: val(o.service.name) ?? null, access: o.access,
      observation: o, reason: 'provider-mapping-unresolved' }); continue; }
    const r = rowBase('motn', film, provider, i, { source: 'Movie of the Night', upstream: 'not-established', method: 'API streamingOptions.ua',
      sourceURL: motnURL(), receivedAt: motn.receivedAt, observationTime: null });
    r.access = { ...o.access }; r.package = { ...o.addon }; r.audio = o.ukrainianAudio; r.subtitles = o.ukrainianSubtitles;
    r.quality = o.quality; r.price = o.price; r.link = classifyLink(val(o.link), provider);
    add(r);
  }
  if (kino?.identity?.status === 'matched') for (const [i, c] of (kino.candidates ?? []).entries()) {
    if (c.territory && c.territory.code !== 'UA') continue;
    const provider = mapProvider('kinobaza', undefined, c.provider, c.access?.state === 'invalid' ? 'unsupported' : c.access?.value);
    if (!provider) { unmapped.push({ source: 'kinobaza', name: c.provider, territory: c.territory, observation: c,
      extractionIssue: c.issue ?? null, reason: 'provider-mapping-unresolved' }); continue; }
    const r = rowBase('kinobaza', film, provider, i, { source: 'Kinobaza HTML', upstream: c.territory ? 'JustWatch section (shared with TMDb)' : 'not-established',
      method: 'initial HTML href / source block', sourceURL: kino.sourceURL ?? sourceURLs?.kinobaza, receivedAt: kino.receivedAt ?? stages.kinobaza.receivedAt,
      receiptBasis: 'Local source-operation completion, not provider update time', observationTime: null });
    r.kind = 'candidate-link'; r.country = c.territory?.code ?? null;
    r.territoryBasis = c.territory ? 'Explicit Ukrainian section; not entitlement' : 'Outside territory section';
    r.availability = unknown('Link presence does not establish availability');
    if (c.access?.state === 'reported') r.access = { ...c.access };
    r.countrySignal = (kino.availabilitySignals ?? []).find(s => s.href === c.href && s.provider === c.provider && s.territory.code === c.territory?.code) ?? null;
    // Only a parser-issued block ID associates this source claim with this
    // candidate. No provider-name join to MOTN or to a country-section row.
    const block = (kino.localization?.blocks ?? []).find(b => b.blockId === c.blockId && b.href === c.href && b.provider === c.provider);
    if (block) {
      r.kinobazaLocalization = block;
      for (const field of ['audio', 'subtitles']) if (block[field]?.state === 'conflicting') {
        r.conflicts.push({ field, type: 'conflicting-block-labels', scope: 'one-source-block-not-universal-track-truth' });
      } // Other ambiguity/unsupported issues remain in block.issues, not proved conflicts.
    }
    const unsafeExtraction = ['unsafe-url-or-label', 'unsafe-url-scheme', 'unsafe-or-invalid-url'].includes(c.issue);
    // Sanitization deliberately removes unsafe hrefs. Do not reinterpret that
    // withheld value as evidence that the source never reported a link.
    r.link = unsafeExtraction ? { href: null, kind: 'unsafe', transferable: false } : classifyLink(c.href, provider); r.rawHref = c.rawHref;
    r.linkAudit = { extraction: { status: c.status, hrefKind: c.hrefKind, issue: c.issue ?? null,
      hrefValue: unsafeExtraction ? 'reported-but-withheld' : c.href ? 'reported' : 'not-reported-or-empty' },
      providerMapping: 'mapped', blockAssociation: c.blockId ? block ? 'associated' : 'unresolved' : 'not-a-provider-block',
      classification: r.link.kind, note: 'Demo URL policy, not a legal restriction or proof of missing source href. No destination resolution.' };
    add(r);
  }
  // Limited discrepancy diagnostics, not a C/D equivalence/applicability engine.
  // Same platform/access or even a card cannot establish a confirmed offer conflict.
  const compareScope = (a, b) => {
    for (const [field, code] of [['package', 'package'], ['cut', 'version']]) {
      const av = field === 'package' ? val(a.package?.id) ?? val(a.package?.name) : val(a.cut);
      const bv = field === 'package' ? val(b.package?.id) ?? val(b.package?.name) : val(b.cut);
      if (av !== bv) return { outcome: 'non-comparable', reason: av === undefined || bv === undefined ? `${code}-scope-unresolved` : `${code}-differs` };
    }
    return a.link.kind === 'exact-card-unverified' && b.link.kind === 'exact-card-unverified' && a.link.href && a.link.href === b.link.href
      ? { outcome: 'possible-discrepancy', reason: 'same-declared-card-offer-scope-unknown' }
      : { outcome: 'non-comparable', reason: 'card-pointer-equivalence-unestablished' };
  };
  const record = (row, entry) => { if (row.comparisons.length < 8) row.comparisons.push(entry); else row.comparisonsOmitted++; };
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (a.provider.key !== b.provider.key || a.country !== b.country || val(a.access) !== val(b.access) || val(a.access) === undefined) continue;
    const scope = compareScope(a, b);
    for (const field of ['quality', 'price']) {
      if (a[field]?.state !== 'reported' || b[field]?.state !== 'reported') continue;
      if (field === 'price' && (!val(a.price.amount) || !val(a.price.currency) || !val(b.price.amount) || !val(b.price.currency))) continue;
      if (field === 'quality' ? val(a.quality) === val(b.quality) : val(a.price.amount) === val(b.price.amount) && val(a.price.currency) === val(b.price.currency)) continue;
      record(a, { field, peer: b.id, ...scope }); record(b, { field, peer: a.id, ...scope });
    }
  }
  // Evidence bands, not numeric confidence or "best" claim. Stable within band.
  const band = r => r.country !== 'UA' ? 2 : r.kind === 'candidate-link' ? 1 : 0;
  rows.sort((a, b) => {
    const availability = band(a) - band(b); if (availability) return availability;
    for (const key of ['audio', 'subtitles']) { const presentA = Boolean(a[key]?.ukrainian?.length), presentB = Boolean(b[key]?.ukrainian?.length); if (presentA !== presentB) return presentA ? -1 : 1; }
    const formats = ['sd', 'hd', 'qhd', 'uhd'];
    const qa = formats.indexOf(val(a.quality)), qb = formats.indexOf(val(b.quality));
    // Only compare explicit formats. Price is informational because source
    // currency/quality reliability remains unresolved, not "cheapest" inference.
    return qa >= 0 && qb >= 0 && !a.conflicts.length && !b.conflicts.length && !a.comparisons.length && !b.comparisons.length ? qb - qa : 0;
  });
  const conflicts = sources.filter(s => s.identity === 'mismatch');
  return { synthetic, film, country: 'UA', identity: { status: conflicts.length ? 'conflict-no-common-identity' : 'independent-source-gates',
    conflicts: conflicts.map(s => s.source), note: 'No common identity or cross-source offer merge is asserted.' },
    rows, sources, unmapped, metrics, stages, filmLocalization: kino?.identity?.status === 'matched' && kino.localization ? { ...kino.localization.film,
      provenance: kino.localization.provenance ?? sourceURLs?.kinobazaLocalization } : null,
    limits: 'Not a best-option recommendation, account entitlement, full coverage or production transfer. Unknown is not negative. Historical owner controls do not replace source fields.' };
}
