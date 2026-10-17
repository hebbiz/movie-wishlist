// Invented display data, never a live answer or an availability assertion.
export function syntheticResponse(scenario = 'grounded') {
  if (scenario === 'empty') return { candidates: [] };
  const text = 'SYNTHETIC ONLY — not a shopping result.\nExample edition: Dune: Part Two (2024), 4K UHD Blu-ray. Availability unknown.\nNo retailer was checked.';
  const segment = 'Example edition: Dune: Part Two (2024), 4K UHD Blu-ray. Availability unknown.';
  const startIndex = Buffer.byteLength(text.slice(0, text.indexOf(segment)), 'utf8');
  const candidate = {
    finishReason: 'STOP',
    content: { role: 'model', parts: [{ text }] },
  };
  if (scenario !== 'ungrounded') candidate.groundingMetadata = {
    groundingChunks: [{ web: { uri: 'https://example.com/synthetic-edition', title: 'Synthetic source (example.com)' } }],
    groundingSupports: [{ segment: { partIndex: 0, startIndex, endIndex: startIndex + Buffer.byteLength(segment), text: segment }, groundingChunkIndices: [0] }],
    searchEntryPoint: {
      renderedContent: '<style>.synthetic-chip{display:block;padding:16px;border:1px solid #888;border-radius:12px;font:16px sans-serif}</style><a class="synthetic-chip" href="https://www.google.com/search?q=Dune+Part+Two+4K+UHD">SYNTHETIC Search Suggestion — Dune Part Two 4K UHD</a>',
    },
  };
  return { candidates: [candidate] };
}
