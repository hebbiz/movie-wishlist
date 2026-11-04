import { admitKinobazaURL } from '../../research/grounded-answer-demo/assisted-kinobaza.mjs';

// Discovery pointer only. No alias/year variants, cross-script transliteration,
// Roman-number conversion, source search, redirects or identity authority.
export function predictedKinobazaURL(originalTitle) {
  if (typeof originalTitle !== 'string' || !originalTitle.trim() || originalTitle.length > 500 || /[\p{C}<>]/u.test(originalTitle)) return null;
  const decomposed = originalTitle.normalize('NFKD').replace(/\p{M}+/gu, '').replace(/['’‘ʼ]/gu, '').toLowerCase();
  if ([...decomposed].some(character => character.codePointAt(0) > 127 && /[\p{L}\p{N}]/u.test(character))) return null;
  const slug = decomposed.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug ? admitKinobazaURL('https://kinobazaua.com/titles/' + slug) : null;
}
