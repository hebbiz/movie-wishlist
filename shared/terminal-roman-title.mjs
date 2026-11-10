// A title spelling comparison, never film/person identity proof. Do not reuse
// for director names, IDs, URLs, query rewriting or arbitrary homoglyph folding.
const clean = s => s.normalize('NFC').replace(/\s+/gu, ' ').trim();
const roman = /^(?:M{0,3})(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;
function parts(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  // A separate final uppercase token only. Single letters, lowercase words,
  // Unicode numeral symbols and malformed/noncanonical Romans are ambiguous.
  const match = /^(.*\S) ([IVXLCDMІ]{2,15})$/u.exec(clean(value));
  if (!match) return null;
  const numeral = match[2].replaceAll('І', 'I'); // U+0406 only, within this token.
  return roman.test(numeral) ? { base: match[1].toLocaleLowerCase('uk-UA'), numeral } : null;
}
export function sameTerminalRomanTitle(left, right) {
  const a = parts(left), b = parts(right);
  return Boolean(a && b && a.base === b.base && a.numeral === b.numeral);
}
