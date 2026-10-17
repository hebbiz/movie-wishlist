import { selectScenario } from './config.mjs';

// Invented display data, never a live answer or an availability assertion.
export function syntheticResponse(scenario = 'grounded', filmId, options = {}) {
  const { film, discovery, amazonRegion } = selectScenario({ ...options, filmId });
  if (scenario === 'empty') return { candidates: [] };
  const segment = `Invented display example for ${film.title}. Edition, format, cut and availability are unknown.`;
  const text = `SYNTHETIC ONLY — not a shopping result.\nMode: ${discovery}; Amazon region: ${amazonRegion ?? 'unset'}.\n${segment}\nUkrainian viewing availability, Ukrainian audio and Ukrainian subtitles are unknown. No retailer was checked. No platform was checked. This fixture does not establish that any UHD edition or requested cut exists.`;
  const startIndex = Buffer.byteLength(text.slice(0, text.indexOf(segment)), 'utf8');
  const candidate = {
    finishReason: 'STOP',
    content: { role: 'model', parts: [{ text }] },
  };
  if (scenario !== 'ungrounded') candidate.groundingMetadata = {
    groundingChunks: [{ web: { uri: 'https://example.com/synthetic-edition', title: 'Synthetic source (example.com)' } }],
    groundingSupports: [{ segment: { partIndex: 0, startIndex, endIndex: startIndex + Buffer.byteLength(segment), text: segment }, groundingChunkIndices: [0] }],
    searchEntryPoint: {
      renderedContent: `<style>.synthetic-chip{display:block;padding:16px;border:1px solid #888;border-radius:12px;font:16px sans-serif}</style><a class="synthetic-chip" href="https://www.google.com/search?q=${encodeURIComponent(film.title)}">SYNTHETIC Search Suggestion — ${film.title}</a>`,
    },
  };
  return { candidates: [candidate] };
}
