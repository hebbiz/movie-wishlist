import { AVAILABILITY, CORE_FIELDS, STORES, safeUrl, storeUrl, validate } from './config.mjs';
import { assertionAttributions } from './attribution.mjs';

const known = value => typeof value === 'string' && value.trim() && value !== 'unknown';
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const lower = value => String(value).toLowerCase().replace(/\s+/g, ' ').trim();

export function parseResponse(raw, fixture) {
  const candidate = raw?.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('Invalid/incomplete API response: finishReason must be STOP');
  const parts = candidate.content?.parts;
  if (!Array.isArray(parts) || !parts.length) throw new Error('Invalid API response: missing text');
  const text = parts.filter(p => !p.thought).map(p => p.text || '').join('');
  let document;
  try { document = validate(JSON.parse(text)); } catch (error) {
    throw new Error(`Invalid API JSON/schema: ${error.message}`);
  }
  if (document.movieId !== fixture.id) throw new Error('API movieId does not match fixture');
  if (new Set(document.listings.map(l => l.id)).size !== document.listings.length) throw new Error('Duplicate listing id');
  for (const listing of document.listings) {
    if (!/^[a-z0-9-]+$/i.test(listing.id)) throw new Error('Invalid listing id');
    if (listing.kind !== STORES[listing.store].kind || !storeUrl(listing.store, listing.url)) throw new Error('Listing outside allowlist/kind');
    if (listing.claims.some(c => !/^[a-z0-9_.-]+$/i.test(c.field))) throw new Error('Invalid claim field');
  }
  return { document, text, parts, grounding: candidate.groundingMetadata || {} };
}

function reviewMatches(review, listing, field, reportedValue, now) {
  return review.listingId === listing.id && review.field === field &&
    review.value === reportedValue && review.sourceUrl === listing.url &&
    review.editionUrl === listing.url && ['page_content', 'api'].includes(review.sourceKind) &&
    typeof review.reviewer === 'string' && review.reviewer.trim() &&
    typeof review.excerpt === 'string' && lower(review.excerpt).includes(lower(reportedValue)) &&
    typeof review.evidenceNote === 'string' && review.evidenceNote.trim() &&
    validTime(review.checkedAt) && Date.parse(review.checkedAt) <= Date.parse(now) &&
    Date.parse(now) - Date.parse(review.checkedAt) <= 24 * 60 * 60 * 1000;
}

export function normalize(raw, fixture, { retrievedAt = new Date().toISOString(), validationAt = retrievedAt, mode = 'live', reviews = [] } = {}) {
  if (!Array.isArray(reviews)) throw new Error('Reviews must be an array');
  const { document, text, parts, grounding } = parseResponse(raw, fixture);
  const chunks = Array.isArray(grounding.groundingChunks) ? grounding.groundingChunks : [];
  const supports = Array.isArray(grounding.groundingSupports) ? grounding.groundingSupports : [];
  const attributions = assertionAttributions(parts, text, supports, chunks);
  const queries = Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries : null;
  const listings = document.listings.map((listing, listingIndex) => {
    const fields = [...new Set([...CORE_FIELDS, ...listing.claims.map(c => c.field)])];
    const claims = fields.map(field => {
      const assertions = listing.claims.filter(c => c.field === field);
      const values = [...new Set(assertions.map(c => c.value).filter(known))];
      const reportedValue = values[0] ?? null;
      const sourceUrls = [...new Set(assertions.flatMap(c => c.sourceUrls).filter(u => safeUrl(u)))];
      const matchingReviews = reviews.filter(r => reviewMatches(r, listing, field, reportedValue, validationAt));
      const citationRefs = [];
      const attributionRefs = [];
      listing.claims.forEach((assertion, assertionIndex) => {
        if (assertion.field !== field || !known(assertion.value)) return;
        for (const match of attributions.get(`${listingIndex}/${assertionIndex}`) || []) {
          for (const chunkIndex of match.chunkIndices) {
            const uri = chunks[chunkIndex]?.web?.uri;
            // No verified cross-edition/source join exists in this PoC.
            if (!safeUrl(uri) || uri !== listing.url || !assertion.sourceUrls.includes(uri)) continue;
            if (!citationRefs.includes(chunkIndex)) citationRefs.push(chunkIndex);
            attributionRefs.push({ assertionIndex, supportIndex: match.supportIndex, chunkIndex,
              partIndex: match.segment.partIndex, startByte: match.segment.startIndex, endByte: match.segment.endIndex });
          }
        }
      });
      const notes = assertions.map(c => c.note).filter(Boolean);
      const soldOutConflict = field === 'availability' && reportedValue === 'available' &&
        /sold\s*out|out\s*of\s*stock|unavailable/i.test([...notes, ...matchingReviews.map(r => r.excerpt)].join(' '));
      const conflict = values.length > 1 || assertions.some(c => c.conflict) || soldOutConflict;
      let confidence = known(reportedValue) && citationRefs.length ? 'likely' : 'unknown';
      if (matchingReviews.length && mode === 'live') confidence = 'confirmed';
      if (conflict) confidence = 'unknown';
      if (field === 'availability' && !AVAILABILITY.includes(reportedValue)) confidence = 'unknown';
      return {
        field, value: confidence === 'unknown' ? null : reportedValue, reportedValue,
        reportedValues: values, assertions, attributionRefs,
        confidence, conflict, sourceUrls: [...new Set([...sourceUrls, ...matchingReviews.map(r => r.sourceUrl)])], citationRefs,
        evidenceNote: [...notes, ...(conflict ? ['Conflicting assertions retained; no value selected.'] : []),
          ...(confidence === 'unknown' ? ['Missing or unsuitable field evidence.'] : []),
          ...(confidence === 'likely' ? ['Search grounding only; page not independently read.'] : [])].join(' '),
        retrievedAt, territory: { country: null, basis: 'unknown' },
        provenance: [
          ...citationRefs.map(chunkIndex => ({ kind: 'search_result', chunkIndex,
            url: chunks[chunkIndex].web.uri, independentlyRead: false })),
          ...matchingReviews.map(r => ({ kind: r.sourceKind, url: r.sourceUrl,
            independentlyRead: mode === 'live', reviewer: r.reviewer, checkedAt: r.checkedAt,
            excerpt: r.excerpt, evidenceNote: r.evidenceNote })),
        ],
        humanVerified: confidence === 'confirmed',
      };
    });
    const get = field => claims.find(c => c.field === field);
    const territoryReview = reviews.find(r => reviewMatches(r, listing, 'territory', 'UA', validationAt) &&
      r.territoryCountry === 'UA' && ['explicit_entitlement', 'provider_api'].includes(r.territoryBasis));
    const territoryConfirmed = mode === 'live' && territoryReview && get('territory').confidence === 'confirmed';
    if (listing.kind === 'streaming' && get('territory').reportedValue === 'UA' && !territoryConfirmed) {
      Object.assign(get('territory'), { value: null, confidence: 'unknown', humanVerified: false });
      get('territory').evidenceNote += ' URL locale/page language cannot establish territory.';
    }
    for (const claim of claims) claim.territory = {
      country: territoryConfirmed ? 'UA' : null,
      basis: territoryConfirmed ? territoryReview.territoryBasis : 'unknown',
      reported: get('territory').reportedValue,
    };
    // A localized URL/text or a model assertion never establishes UA entitlement.
    if (listing.kind === 'streaming' && !territoryConfirmed) {
      const availability = get('availability');
      availability.value = null;
      availability.confidence = 'unknown';
      availability.humanVerified = false;
      availability.evidenceNote += ' Ukraine entitlement not independently established.';
    }
    const cut = get('cut');
    const cutMismatch = Boolean(fixture.requestedCut && known(cut.reportedValue) &&
      lower(cut.reportedValue) !== lower(fixture.requestedCut));
    if (cutMismatch) {
      cut.conflict = true; cut.confidence = 'unknown'; cut.value = null; cut.humanVerified = false;
      cut.evidenceNote += ` Requested ${fixture.requestedCut}; reported cut differs.`;
    }
    const identity = get('movie_identity');
    // A year mismatch is informational; an explicitly different identifier is a conflict.
    const reportedImdb = identity.reportedValue?.match(/tt\d+/g) || [];
    const reportedTmdb = [...(identity.reportedValue || '').matchAll(/tmdb\s*[:#=]?\s*(\d+)/gi)].map(m => Number(m[1]));
    const identityMismatch = reportedImdb.some(id => id !== fixture.imdbId) || reportedTmdb.some(id => id !== fixture.tmdbId);
    if (identityMismatch) {
      identity.conflict = true; identity.confidence = 'unknown'; identity.value = null; identity.humanVerified = false;
      identity.evidenceNote += ' Reported film identifier conflicts with sourced fixture.';
    }
    const available = get('availability');
    const usableOffer = available.value === 'available' && available.confidence === 'confirmed' &&
      identity.confidence === 'confirmed' && !cutMismatch && !identityMismatch &&
      (!fixture.requestedCut || cut.confidence === 'confirmed') &&
      (listing.kind !== 'physical' || get('format').confidence === 'confirmed');
    const primaryReviewed = claims.some(c => c.humanVerified && c.provenance.some(p => p.url === listing.url));
    const primaryCited = chunks.some(c => c?.web?.uri === listing.url) && claims.some(c => c.citationRefs.length);
    return { id: listing.id, store: listing.store, kind: listing.kind, url: listing.url,
      urlConfidence: primaryReviewed ? 'confirmed' : primaryCited ? 'likely' : 'unknown',
      listingFound: primaryCited || primaryReviewed,
      availability: available.value || 'unknown', availabilityConfidence: available.confidence,
      cutMismatch, identityMismatch, usableOffer, claims };
  });
  const checkedSources = Object.entries(STORES).map(([store, config]) => {
    const cited = chunks.filter(c => storeUrl(store, c?.web?.uri));
    const searched = (queries || []).filter(q => config.hosts.some(h => q.toLowerCase().includes(h)) ||
      q.toLowerCase().includes(store.toLowerCase()));
    const manuallyRead = listings.some(l => l.store === store && l.claims.some(c => c.provenance.some(p => p.independentlyRead)));
    return { store, status: manuallyRead ? 'page_manually_reviewed' : cited.length ? 'grounding_result_observed' :
      searched.length ? 'search_query_observed' : 'not_observed',
    reportedQueries: searched, sourceUrls: cited.map(c => c.web.uri),
    modelReport: document.checkedSources.filter(c => c.store === store) };
  });
  const allClaims = listings.flatMap(l => l.claims);
  return {
    schemaVersion: '1.0.0', mode, movie: fixture, retrievedAt, validationAt,
    listings, checkedSources,
    grounding: { chunks, supports, reportedQueries: queries,
      searchSuggestions: grounding.searchEntryPoint || null },
    metrics: {
      foundListings: listings.filter(l => l.listingFound).length,
      usableOffers: listings.filter(l => l.usableOffer).length,
      confirmedClaimsHumanVerified: allClaims.filter(c => c.humanVerified).length,
      likelyClaims: allClaims.filter(c => c.confidence === 'likely').length,
      unknownFields: allClaims.filter(c => c.confidence === 'unknown').length,
      conflicts: allClaims.filter(c => c.conflict).length,
      unsupportedClaims: allClaims.filter(c => known(c.reportedValue) && !c.citationRefs.length && !c.humanVerified).length,
    },
  };
}
