// Authored projected variants for unit/browser checks. Not live catalogue data,
// archived source responses or assertions about actual providers' offers.
const unknown = () => ({ state: 'unknown' });
const reported = () => ({ state: 'reported', ukrainian: [{ language: 'ukr' }] });
const row = (id, key, extra = {}) => ({ id, identityStatus: 'matched', provider: { key }, country: 'UA',
  kind: 'source-offer', audio: unknown(), subtitles: unknown(), conflicts: [], comparisons: [],
  access: { state: 'reported', value: 'subscription' }, link: { href: null }, ...extra });

export function authoredGroupedMediaRows() {
  const sharedRakutenURL = 'https://rakuten.tv/ua/movies/authored-shared-card?source=AUTHOR%2fONLY';
  return [
    row('motn:prime-rent', 'prime', { audio: reported(), access: { state: 'reported', value: 'rental' },
      link: { href: 'https://www.primevideo.com/detail/AUTHOREDRENT' } }),
    row('motn:prime-buy', 'prime', { access: { state: 'reported', value: 'purchase' } }),
    row('motn:hbo-subtitles', 'hbo', { subtitles: reported() }),
    row('tmdb:hbo-availability', 'hbo'),
    row('motn:rakuten-rent', 'rakuten', { access: { state: 'reported', value: 'rental' }, link: { href: sharedRakutenURL },
      quality: { state: 'reported', value: 'hd' }, price: { state: 'reported', amount: { state: 'reported', value: '1.23' }, currency: { state: 'reported', value: 'XXX' } } }),
    row('tmdb:rakuten-buy', 'rakuten', { access: { state: 'reported', value: 'buy' }, link: { href: sharedRakutenURL } }),
    row('kinobaza:rakuten-block', 'rakuten', { kind: 'candidate-link', country: null,
      kinobazaLocalization: { audio: { state: 'reported-positive', evidence: [{ label: 'Укр. звук (dolby)', literal: '+', state: 'positive', formatLiteral: 'dolby' }] }, subtitles: { state: 'reported-positive' } },
      link: { href: 'https://rakuten.tv/ua/movies/authored-separate-block' } }),
    row('motn:rakuten-conflict', 'rakuten', { audio: { state: 'conflicting' }, subtitles: reported(),
      conflicts: [{ field: 'audio', type: 'authored-conflict' }], link: { href: 'https://rakuten.tv/ua/movies/authored-conflict' } }),
  ];
}
