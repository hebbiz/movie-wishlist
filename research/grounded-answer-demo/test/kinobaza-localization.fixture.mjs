// Entirely authored, deliberately fictional properties/links. Not live HTML.
import { syntheticHtml } from '../synthetic.mjs';
import { FILMS } from '../config.mjs';
export const generalBadge = '<div title="За нашими даними до цього фільму/серіалу існує українське аудіо на стрімінгових сервісах або від аматорських студій">Є українське аудіо</div>';
export const badge = (provider, href = 'https://example.com/fictional?x=%2F&amp;y=1') => `<a title="Доступно в ${provider}" href="${href}"><img alt="Доступно в ${provider}"></a>`;
export const tableBlock = (provider = 'itunes', rows = [['Укр. звук (стерео)', '+'], ['Укр. субтитри', '-']], href) => `<div><div>${badge(provider, href)}<table><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th><th>${value}</th></tr>`).join('')}</tbody></table></div></div>`.replace('<div>', '<div class="d-md-flex">');
export const paragraphBlock = (provider = 'megogo', tokens = '(укр. аудіо, укр. субтитри)', href) => `<p class="mt-2">${badge(provider, href)} ${tokens}</p>`;
export const localizedMarkup = (blocks = '', filmId = 'coherence', general = true) => syntheticHtml(FILMS[filmId]).replace('<div id="availabilityAccordion">', `${general ? generalBadge : ''}${blocks}<div id="availabilityAccordion">`);

// Invented Dune (2024) source blocks, not captured public markup or a claim
// about current platform availability, audio, subtitles or real card URLs.
export const authoredDuneLanguageMarkup = ({
  appleRows = [['Укр. звук (стерео)', '+'], ['Укр. звук (dolby)', '+'], ['Укр. субтитри', '-']],
  rakutenRows = [['Укр. звук', '+'], ['Укр. субтитри', '+']],
  megogoTokens = '(укр. аудіо, укр. субтитри)', extraBlocks = '',
} = {}) => localizedMarkup(
  tableBlock('itunes', appleRows, 'https://example.com/authored-dune-apple?x=%2F&amp;y=1') +
  tableBlock('rakuten', rakutenRows, 'https://example.com/authored-dune-rakuten') +
  paragraphBlock('megogo', megogoTokens, 'https://example.com/authored-dune-megogo') + extraBlocks,
  'dune-part-two');
