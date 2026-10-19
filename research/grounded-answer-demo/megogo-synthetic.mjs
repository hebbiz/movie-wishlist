// Authored small HTML, not MEGOGO markup captured from a live card. Formats,
// package and price are invented; identity scalars come from the fixed catalogue.
import { MEGOGO_URL, MEGOGO_IDS } from './megogo.mjs';
export function syntheticMegogo({ movie = {}, body = '', head = '', noJson = false } = {}) {
  const data = { '@context': 'https://schema.org', '@type': 'Movie', name: 'Dune: Part Two', datePublished: '2024-01-01', url: MEGOGO_URL,
    sameAs: [`https://www.imdb.com/title/${MEGOGO_IDS.imdbId}/`], ...movie };
  return `<!doctype html><html><head><link rel="canonical" href="${MEGOGO_URL}">${head}${noJson ? '' : `<script type="application/ld+json">${JSON.stringify(data)}</script>`}</head><body>
  <main><h1>Dune: Part Two</h1><p>SYNTHETIC ONLY — invented public-card metadata, not a real MEGOGO read.</p>
  <dl><dt>Year</dt><dd>2024</dd><dt>Audio</dt><dd><ul><li>English — PCM 1.0</li><li>Spanish — AAC 2.0</li></ul></dd>
  <dt>Subtitles</dt><dd><ul><li>Spanish standard</li><li>English SDH</li></ul></dd><dt>Quality</dt><dd>SD</dd>
  <dt>Access type</dt><dd>subscription</dd><dt>Package</dt><dd>SYNTHETIC Example Package</dd><dt>Price</dt><dd>1.23 XXX</dd></dl>${body}</main>
  <script>throw new Error('SYNTHETIC executable script must never run')</script><img src="https://example.com/never-load.png"></body></html>`;
}
