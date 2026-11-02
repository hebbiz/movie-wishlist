// Localized title spelling only; never person proof or general transliteration.
const normalize = s => s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA');
export function sameUkrainianGTitle(left, right) {
  if (![left, right].every(s => typeof s === 'string' && s.length <= 500)) return false;
  const [a, b] = [left, right].map(normalize);
  // This narrow route is for Cyrillic titles, not Latin homoglyphs/mixed-script
  // words. Every other letter, number and punctuation mark remains significant.
  if (![a, b].every(s => /[гґ]/u.test(s) && /^[\p{Script=Cyrillic}\p{N}\p{P} ]+$/u.test(s))) return false;
  return a.replaceAll('ґ', 'г') === b.replaceAll('ґ', 'г');
}
