// Authored malformed recommendation shape, not captured/reconstructed source
// HTML. Fictional links and titles never identify the selected film or offers.
export const quotedRecommendation = `<div class="scrolling-wrapper-flexbox__item me-1"><div class="position-relative"><a href="/titles/authored-other-film" class="d-block" title="Authored "quoted" recommendation"><img class="rounded" src="/authored.jpg" alt="Authored "quoted" recommendation"></a></div><a class="truncate small text-center" title="Authored "quoted" recommendation" href="/titles/authored-other-film">Other film</a></div>`;
export const recommendationCarousel = (item = quotedRecommendation) => `<div class="mt-5"><div class="scrolling-wrapper-flexbox">${item}</div></div>`;
