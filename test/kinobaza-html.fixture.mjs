// Minimal shared authored scaffold for product tests and the retained demo.
// These are fixture identities, not captured source responses or live claims.
// Keep the three-record catalogue here once; the demo config re-exports it.
export const SYNTHETIC_FILMS = Object.freeze({
  'dune-part-two': Object.freeze({ id: 'dune-part-two', title: 'Dune: Part Two (2024)', director: 'Denis Villeneuve' }),
  coherence: Object.freeze({ id: 'coherence', title: 'Coherence (2013)', director: 'James Ward Byrkit' }),
  'blade-runner-final-cut': Object.freeze({ id: 'blade-runner-final-cut', title: 'Blade Runner (1982) — The Final Cut', director: 'Ridley Scott' }),
});

// Small authored markup; fictional providers/URLs, never copied from a live card.
export function syntheticHtml(film) {
  const title = film.identityTitle ?? (film.id === 'coherence' ? 'Coherence' : 'Dune: Part Two');
  const year = film.year ?? (film.id === 'coherence' ? '2013' : '2024');
  const section = (code, label, provider, href) => `<div class="accordion-item"><h2 class="accordion-header"><button data-bs-target="#collapse${code}">${label}</button></h2><div id="collapse${code}" data-bs-parent="#availabilityAccordion"><a title="Дивитись / Купити на ${provider}" href="${href}"><img alt="${provider}">${provider}</a><a href="https://www.justwatch.com/ua/">JustWatch</a></div></div>`;
  return `<!doctype html><html><head><title>SYNTHETIC ONLY</title></head><body><nav><a href="https://example.com/navigation">Example navigation</a></nav><h1>SYNTHETIC ${title} (${year})</h1><h2>${title}</h2><table><tbody><tr><td>Режисер:</td><td>${film.director}</td></tr></tbody></table><a title="Дивитись / Купити на Example Outside" href="/relative?x=%2F&amp;y=1">Example Outside</a><div id="availabilityAccordion">${section('UA', 'Доступно в Україні', 'Example UA', 'https://example.com/redirect?x=%2F&amp;y=1')}${section('PL', 'Доступно в Польщі', 'Example Foreign', 'https://example.com/foreign')}</div><script>throw new Error('SYNTHETIC script must never execute')</script></body></html>`;
}
