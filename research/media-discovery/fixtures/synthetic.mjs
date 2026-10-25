// Manufactured adversarial examples, NOT observations of these shops/products.
// Deliberately fake /synthetic/ URLs prevent confusing this with scraped inventory.
export function syntheticResponse(movie) {
  const urls = {
    amazon: 'https://www.amazon.co.uk/synthetic/not-a-product',
    apple: 'https://tv.apple.com/gb/synthetic/not-a-film',
    hmv: 'https://hmv.com/synthetic/not-a-product',
    rarewaves: 'https://www.rarewaves.com/synthetic/not-a-product',
  };
  const claim = (field, value, url, note = 'Synthetic search assertion.') => ({
    field, value, sourceUrls: url ? [url] : [], note, conflict: false,
  });
  const identity = `${movie.imdbId}; ${movie.director}`;
  let listings;
  if (movie.id === 'dune-part-two') listings = [
    { id: 'synthetic-amazon', store: 'Amazon UK', kind: 'physical', url: urls.amazon,
      claims: [claim('movie_identity', identity, urls.amazon), claim('availability', 'available', urls.amazon),
        claim('format', 'UHD + Blu-ray', urls.amazon), claim('uhd.hdr', 'Dolby Vision', null)] },
    { id: 'synthetic-uk-stream', store: 'Apple TV', kind: 'streaming', url: urls.apple,
      claims: [claim('movie_identity', identity, urls.apple), claim('availability', 'available', urls.apple),
        claim('territory', 'GB', urls.apple, 'UK offer; /gb/ is not proof of Ukraine entitlement.')] },
  ];
  else if (movie.id === 'coherence') listings = [
    { id: 'synthetic-sold-out', store: 'HMV', kind: 'physical', url: urls.hmv,
      claims: [claim('movie_identity', identity, urls.hmv),
        claim('availability', 'available', urls.hmv, 'Sold out; price remains visible.'),
        claim('price', '12.99', urls.hmv), claim('currency', 'GBP', urls.hmv),
        claim('bluray.audio.uk.codec', 'Ukrainian Atmos', urls.hmv),
        claim('bluray.audio.uk.codec', 'English DTS-HD MA only', urls.hmv)] },
  ];
  else listings = [
    { id: 'synthetic-wrong-cut', store: 'HMV', kind: 'physical', url: urls.hmv,
      claims: [claim('movie_identity', identity, urls.hmv), claim('availability', 'available', urls.hmv),
        claim('cut', 'Theatrical Cut', urls.hmv), claim('format', 'Blu-ray', urls.hmv)] },
    { id: 'synthetic-final-cut', store: 'Rarewaves', kind: 'physical', url: urls.rarewaves,
      claims: [claim('movie_identity', identity, urls.rarewaves), claim('cut', 'The Final Cut', urls.rarewaves),
        claim('listing_year', '2007', urls.rarewaves, 'Edition/cut year differs; film identity agrees.'),
        claim('availability', 'unknown', null)] },
  ];
  return groundedDocument({ movieId: movie.id, listings, checkedSources: [] });
}

// Deliberately precise synthetic attribution, not a claim that real API responses
// provide this granularity. Independent serialization builds the fixture offsets.
export function groundedDocument(document) {
  const text = JSON.stringify(document);
  const sourceUrls = [...new Set(document.listings.flatMap(l => l.claims.flatMap(c => Array.isArray(c.sourceUrls) ? c.sourceUrls : [])))];
  let cursor = 0;
  const groundingSupports = document.listings.flatMap(listing => listing.claims.map(assertion => {
    const serialized = JSON.stringify(assertion);
    const start = text.indexOf(serialized, cursor);
    if (start < 0) throw new Error('Synthetic serialization mismatch');
    cursor = start + serialized.length;
    return { segment: { partIndex: 0, startIndex: Buffer.byteLength(text.slice(0, start), 'utf8'),
      endIndex: Buffer.byteLength(text.slice(0, cursor), 'utf8'), text: serialized },
    groundingChunkIndices: (Array.isArray(assertion.sourceUrls) ? assertion.sourceUrls : []).map(url => sourceUrls.indexOf(url)) };
  })).filter(s => s.groundingChunkIndices.length);
  return {
    synthetic: true, modelVersion: 'synthetic-no-model',
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] }, groundingMetadata: {
      groundingChunks: sourceUrls.map(uri => ({ web: { uri, title: 'SYNTHETIC TEST DATA' } })),
      groundingSupports,
      webSearchQueries: [],
    } }],
  };
}
