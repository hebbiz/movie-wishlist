// Documentary preflight, 2026-10-20: canonical ledger in regional-card-proposal.md.
// Identity metadata only, never expected availability, localization or cut facts.
const film = (id, title, year, director, tmdbId, imdbId, extra = {}) => Object.freeze({
  id, title: `${title} (${year})`, identityTitle: title, originalTitle: title, year, director, tmdbId, imdbId, ...extra,
});
export const HELD_OUT_FILMS = Object.freeze({
  'kingdom-of-heaven': film('kingdom-of-heaven', 'Kingdom of Heaven', 2005, 'Ridley Scott', 1495, 'tt0320661', {
    directorAliases: Object.freeze(['Ridley Scott', 'Рідлі Скотт']),
    kinobazaURL: 'https://kinobazaua.com/titles/kingdom-of-heaven',
  }),
  'the-thing-1982': film('the-thing-1982', 'The Thing', 1982, 'John Carpenter', 1091, 'tt0084787'),
  'the-thing-2011': film('the-thing-2011', 'The Thing', 2011, 'Matthijs van Heijningen Jr.', 60935, 'tt0905372'),
  parasite: film('parasite', 'Parasite', 2019, 'Bong Joon Ho', 496243, 'tt6751668', {
    originalTitle: '기생충',
    titleAliases: Object.freeze(['Parasite', '기생충', 'Gisaengchung']),
    directorAliases: Object.freeze(['Bong Joon Ho', 'Joon-ho Bong', 'Пон Чун Хо', 'Пон Джун-Хо']),
    kinobazaURL: 'https://kinobazaua.com/titles/parasite-2019',
  }),
});
export const isHeldOut = id => Object.hasOwn(HELD_OUT_FILMS, id);
