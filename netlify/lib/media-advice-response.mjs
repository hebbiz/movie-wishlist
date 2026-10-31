// Product-only response for ordinary Beta users. Diagnostics are separately
// authorized by the final server RPC, never by browser input or UI visibility.
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const scalar = value => value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && value.length <= 16384;
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(object(value), key) && scalar(value[key])).map(key => [key, value[key]]));
const items = value => Array.isArray(value) ? value : [];
const territory = value => value === null ? null : pick(value, ['code', 'label']);
const qualifier = value => ({ ...pick(value, ['state', 'value']),
  ...(value?.id ? { id: pick(value.id, ['state', 'value']) } : {}),
  ...(value?.name ? { name: pick(value.name, ['state', 'value']) } : {}) });
function language(value) {
  const result = pick(value, ['state', 'language', 'completeness']);
  if (Array.isArray(value?.ukrainian)) result.ukrainian = value.ukrainian.map(locale => pick(locale, ['language', 'region', 'closedCaptions']));
  // Block labels/format states are required by the existing conflict and
  // format-negative rules; they are not borrowed from another offer.
  if (Array.isArray(value?.evidence)) result.evidence = value.evidence.map(e => pick(e, ['label', 'state', 'formatLiteral', 'typeLiteral']));
  return result;
}
function productRow(row) {
  const result = pick(row, ['id', 'filmId', 'identityStatus', 'providerConflict', 'country', 'kind', 'territoryBasis']);
  result.provider = pick(row?.provider, ['key', 'sourceName']);
  result.provenance = pick(row?.provenance, ['source', 'upstream']);
  result.link = pick(row?.link, ['href']);
  result.audio = language(row?.audio); result.subtitles = language(row?.subtitles);
  result.availability = pick(row?.availability, ['state', 'value']);
  result.access = qualifier(row?.access);
  for (const key of ['package', 'cut', 'version']) if (row?.[key]) result[key] = qualifier(row[key]);
  result.conflicts = items(row?.conflicts).map(conflict => pick(conflict, ['field', 'type', 'scope']));
  result.comparisons = items(row?.comparisons).map(comparison => pick(comparison, ['outcome']));
  if (row?.linkAudit) result.linkAudit = pick(row.linkAudit, ['blockAssociation']);
  if (row?.countrySignal) result.countrySignal = { ...pick(row.countrySignal, ['state', 'provider', 'href']), territory: territory(row.countrySignal.territory) };
  if (row?.kinobazaLocalization) {
    const block = row.kinobazaLocalization;
    result.kinobazaLocalization = { ...pick(block, ['blockId', 'provider', 'href']), territory: territory(block.territory),
      ...(block.issues === undefined ? {} : { issues: Array.isArray(block.issues) ? block.issues.filter(issue => typeof issue === 'string' && /^[a-z-]{1,100}$/.test(issue)) : null }),
      audio: language(block.audio), subtitles: language(block.subtitles) };
  }
  return result;
}
export function mediaCapabilities(receipt) {
  return { mykola_media_advice: receipt?.mykola_media_advice === true,
    mykola_media_advice_diagnostics: receipt?.mykola_media_advice === true && receipt?.mykola_media_advice_diagnostics === true };
}
export function productMediaResult(result, capabilities) {
  const card = value => ({ ...pick(value, ['id', 'status']), rows: items(value?.rows).map(productRow),
    unmapped: items(value?.unmapped).map(row => pick(row, ['name'])) });
  return { film: pick(result?.film, ['id', 'title', 'year', 'imdbId']),
    rows: items(result?.rows).map(productRow), unmapped: items(result?.unmapped).map(row => pick(row, ['name'])),
    // Only the product's partial-result notice needs these outcomes. Gate,
    // search/rejection diagnostics, run/build IDs and accounting are withheld.
    sources: items(result?.sources).map(source => ({ status: /error|failed|unavailable|timeout|blocked|unsupported|partial/i.test(source?.status ?? '') ? 'partial' : 'ok' })),
    cardChoices: items(result?.cardChoices).map(card), capabilities };
}
