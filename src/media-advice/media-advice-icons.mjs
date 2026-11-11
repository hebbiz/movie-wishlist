// Only these bundled SVGs may be warmed. This never contacts a provider or
// waits for an icon before returning search results.
export const MEDIA_SERVICE_ICON_SOURCES = Object.freeze({
  apple: '/assets/icons/media/appletv.svg',
  netflix: '/assets/icons/media/netflix.svg',
  hbo: '/assets/icons/media/hbomax.svg',
  prime: '/assets/icons/media/primevideo.svg',
  megogo: '/assets/icons/media/megogo.svg',
  rakuten: '/assets/icons/media/rakuten.svg',
});
export const MEDIA_SERVICE_ICON_TIMEOUT_MS = 5000;
const warmedDocuments = new WeakSet();

export function preloadMediaServiceIcons(doc) {
  if (!doc?.head || warmedDocuments.has(doc)) return;
  warmedDocuments.add(doc);
  for (const href of Object.values(MEDIA_SERVICE_ICON_SOURCES)) {
    try {
      const preload = doc.createElement('link');
      preload.rel = 'preload'; preload.as = 'image'; preload.href = href;
      doc.head.append(preload);
    } catch { return; } // Warming is optional and must never interrupt search.
  }
}

// Loading belongs to the visual slot, not to discovery. A stalled image has a
// bounded text fallback, and a late response cannot switch that fallback back.
export function watchMediaServiceIcon({ button, slot, icon, view }) {
  let timer, failed = false;
  const clear = () => { if (timer !== undefined) view.clearTimeout(timer); timer = undefined; };
  const fallback = () => {
    failed = true; clear(); icon.hidden = true; slot.hidden = true;
    button.dataset.iconState = 'failed';
  };
  button.dataset.iconState = 'pending';
  icon.addEventListener('load', () => {
    if (failed) return;
    if (!(icon.naturalWidth > 0)) return fallback();
    clear(); button.dataset.iconState = 'loaded';
  });
  icon.addEventListener('error', fallback);
  // Minimal authored DOM controls need no real timers. Browsers always supply
  // these methods; using that view also makes this deadline testable.
  if (typeof view?.setTimeout === 'function' && typeof view?.clearTimeout === 'function') {
    timer = view.setTimeout(fallback, MEDIA_SERVICE_ICON_TIMEOUT_MS);
  }
}
