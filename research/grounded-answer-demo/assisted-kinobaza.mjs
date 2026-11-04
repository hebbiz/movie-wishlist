// Owner-assisted source card, not a resolver. No URL rewriting or destinations.
import { extractHtml, HTML_LIMIT_BYTES, HTML_TIMEOUT_MS } from './html-source.mjs';
import { identityGates } from '../../shared/media-advice-diagnostics.mjs';
import { lookupDirectorAliases } from '../../shared/director-alias-crosswalk.mjs';
import { releaseYearEvidence } from '../../shared/film-release-year.mjs';
import { sameTerminalRomanTitle } from '../../shared/terminal-roman-title.mjs';
import { sameUkrainianGTitle } from '../../shared/ukrainian-g-title.mjs';
import { movieSameAsEvidence } from '../../shared/kinobaza-movie-identity.mjs';

export function admitKinobazaURL(value) {
  // Validate original spelling BEFORE URL normalization (default ports/dot paths).
  if (typeof value !== 'string' || value.length > 512 ||
      !/^https:\/\/kinobazaua\.com\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return null;
  const u = new URL(value);
  return u.origin === 'https://kinobazaua.com' && !u.username && !u.password && !u.port && !u.search && !u.hash ? value : null;
}
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const normalize = s => typeof s === 'string' ? s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('uk-UA') : '';
const titleMatch = (source, names) => names.some(name => normalize(name) && normalize(name) === normalize(source)) ? 'exact' :
  names.some(name => sameTerminalRomanTitle(source, name)) ? 'terminal-roman-i' :
  names.some(name => sameUkrainianGTitle(source, name)) ? 'ukrainian-g' : null;
const text = n => (n.childNodes ?? []).map(c => c.nodeName === '#text' ? c.value : ['script', 'style', 'template', 'noscript', 'iframe'].includes(c.tagName) ? '' : text(c)).join(' ').replace(/\s+/gu, ' ').trim();
const excluded = n => { for (let p = n; p; p = p.parentNode) if (['nav', 'aside', 'footer', 'template', 'noscript', 'iframe'].includes(p.tagName)) return true; return false; };
const year = n => Number.isInteger(n) && n >= 1000 && n <= 9999 ? n : null;
const selectedIDs = film => ({ tmdb: /^[1-9]\d{0,9}$/.test(String(film.tmdbId ?? '')) ? String(film.tmdbId) : null,
  imdb: /^tt\d{1,20}$/.test(film.imdbId ?? '') ? film.imdbId : null });

// A visibly localized heading can be unestablished without contradicting an
// exact original title. This is only permission to check year/person evidence,
// never alphabet folding, a fuzzy title match or a film-ID bypass.
function unknownTranslationHeading(heading, film) {
  if (typeof heading !== 'string' || heading.length > 500 || !normalize(film.originalTitle)) return false;
  const clean = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const roman = value => /(?:^| )([IVXLCDMІ]{1,15})$/u.exec(clean(value))?.[1]?.replaceAll('І', 'I') ?? '';
  const localized = clean(heading).replace(/ [IVXLCDMІ]{1,15}$/u, '');
  if (!/\p{Script=Cyrillic}/u.test(localized) || !/^[\p{Script=Cyrillic}\p{N}\p{P} ]+$/u.test(localized)) return false;
  const signature = value => JSON.stringify({ digits: clean(value).match(/\p{N}+/gu) ?? [], roman: roman(value) });
  // Unknown translations do not erase or convert explicit sequel/title numbers.
  // Known aliases and the established Roman/glyph routes are evaluated first.
  const references = [film.identityTitle, film.originalTitle].filter(value => typeof value === 'string' && value.trim());
  // Numbered Roman titles retain their existing, base-preserving route. An
  // unknown base must not turn an equivalent sequel suffix into film proof.
  if (roman(heading) || references.some(value => roman(value))) return false;
  if (references.some(value => signature(value) !== signature(heading))) return false;
  if (/\p{Script=Cyrillic}/u.test(film.originalTitle) && normalize(film.identityTitle) === normalize(film.originalTitle)) return false;
  return true;
}

export function assistedIdentity(all, film, sourceURL, { onIdentityDiagnostic, directorAliasLookup = lookupDirectorAliases, directorConflictLookup } = {}) {
  const active = all.filter(n => !excluded(n));
  const directDirectorNames = film.directorAliases ?? [];
  const directDirectorAliases = new Set(directDirectorNames.map(normalize).filter(Boolean));
  const person = film.directorCount === 1 && Array.isArray(film.directorPeople) && film.directorPeople.length === 1 ? film.directorPeople[0] : null;
  // Keep the ID attached to names from the same trusted credits record. A flat
  // list or an ID supplied separately cannot establish a multi-person mapping.
  let crosswalk;
  if (person && Array.isArray(person.names) && person.names.some(n => directDirectorAliases.has(normalize(n))) && typeof directorAliasLookup === 'function') {
    try { crosswalk = directorAliasLookup(person); } catch {} // Fail closed, no I/O/retry.
  }
  const directorNames = [...directDirectorNames, ...(crosswalk?.status === 'confirmed' ? crosswalk.aliases : [])];
  const canonicals = active.filter(n => n.tagName === 'link' && (attr(n, 'rel') ?? '').split(/\s+/).includes('canonical')).map(n => attr(n, 'href'));
  const semantic = movieSameAsEvidence(all, sourceURL);
  const outcome = (status, reason) => {
    const counts = { headingCount: headings.length, originalTitleCount: originals.length, directorCount: directors.size, canonicalCount: canonicals.length, stableIdCount: stable.length };
    const reasonGate = { 'source-identity-structure-limit':'structure-limit', 'source-canonical-conflict':'canonical-conflict', 'source-stable-id-conflict':'stable-id-conflict', 'malformed-source-stable-id':'stable-id-shape', 'source-canonical-ambiguous':'canonical-count', 'source-identity-structure-incomplete':'metadata-structure', 'source-title-year-missing':'heading-format', 'source-title-conflict':'heading-alias', 'source-original-title-scope-unestablished':'original-scope', 'source-original-title-unestablished':'original-alias', 'selected-year-missing':'selected-year', 'source-year-conflict-without-stable-crosswalk':'year-crosswalk', 'source-year-conflict-terminal-roman-title':'year-crosswalk', 'source-or-selected-director-missing':'director-presence', 'director-scope-unestablished':'director-scope', 'director-alias-unestablished':'director-alias' };
    reasonGate['source-year-conflict-ukrainian-g-title'] = 'year-crosswalk';
    reasonGate['source-year-conflict-unknown-translation'] = 'year-crosswalk';
    reasonGate['director-known-person-conflict'] = 'director-alias';
    const failedGate = reasonGate[reason] ?? null, failedAt = identityGates.indexOf(failedGate);
    const parsed = headings.length === 1 ? /^(.*?)\s*\(\s*(\d{4})\s*\)\s*$/.exec(headings[0]) : null;
    const names = [film.identityTitle, film.originalTitle, ...(film.titleAliases ?? [])], aliases = new Set(names.map(normalize).filter(Boolean));
    const headingMatch = parsed ? titleMatch(parsed[1], names) : null;
    const translation = parsed && !headingMatch && unknownTranslationHeading(parsed[1], film);
    const directorAliases = new Set(directorNames.map(normalize).filter(Boolean));
    const expected = selectedIDs(film), sourceYear = parsed ? year(Number(parsed[2])) : null, selectedYear = year(film.year);
    const stableMatch = stable.some(s => s.filmScope && s.id && expected[s.namespace] === s.id);
    const directorBypassed = status === 'matched' && reason === 'explicit-stable-title-year-match';
    const diagnostics = { failedGate, counts, comparisons: {
      canonicalMatch: canonicals.length === 1 ? canonicals[0] === sourceURL : null,
      stableIdMatch: stableMatch,
      stableIdConflict: stable.some(s => s.id && expected[s.namespace] && expected[s.namespace] !== s.id) || ['tmdb','imdb'].some(ns => new Set(stable.filter(s => s.id && s.namespace === ns).map(s => s.id)).size > 1),
      headingAliasMatch: parsed ? Boolean(headingMatch) : null,
      originalAliasMatch: originals.length === 1 ? headingMatch === 'ukrainian-g' ? Boolean(normalize(film.originalTitle)) && normalize(originals[0]) === normalize(film.originalTitle) : aliases.has(normalize(originals[0])) : null,
      yearEqual: parsed && film.year ? Number(parsed[2]) === film.year : null,
      directorAliasMatch: directors.size && directorAliases.size ? [...directors].every(d => directorAliases.has(normalize(d))) : null },
      strategy: translation && (reason === 'explicit-original-year-director-translation-match' || reason === 'director-alias-unestablished') ? 'original-year-director-translation' : status !== 'matched' ? null : headingMatch === 'ukrainian-g' ? 'title-ukrainian-g-year-director' : headingMatch === 'terminal-roman-i' ? 'title-terminal-roman-year-director' : directorBypassed ? 'stable-id-title-year' : stableMatch ? 'stable-id-title-director-year-variance' : sourceYear !== selectedYear ? 'title-release-year-director' : 'title-year-director',
      years: { selected: selectedYear, source: sourceYear, delta: selectedYear !== null && sourceYear !== null ? sourceYear - selectedYear : null },
      movieSameAs: { status: semantic.status, reason: semantic.reason, movieCount: semantic.movieCount,
        idCount: semantic.records.length, datePublished: semantic.datePublished, yearAuthority: 'none' },
      gates: Object.fromEntries(identityGates.map((g,i) => [g, directorBypassed && g.startsWith('director-') ? 'not-evaluated' : status === 'matched' || i < failedAt ? 'pass' : i === failedAt ? status === 'mismatch' ? 'fail' : 'unresolved' : 'not-evaluated'])) };
    if (translation && reason !== 'source-title-conflict') diagnostics.gates['heading-alias'] = 'not-evaluated';
    if (reason === 'source-identity-structure-limit') for (const key of Object.keys(diagnostics.comparisons)) diagnostics.comparisons[key] = null;
    const result = { status, reason, basis: 'selected TMDb projection versus explicit source identity; alias non-match is not independent proof of another film; no transliteration or user override', observed: counts, diagnostics };
    if (status === 'matched' && sourceYear !== selectedYear && !stableMatch) result.releaseYearEvidence = releaseYearEvidence(film, sourceYear);
    if (status === 'matched' && !directorBypassed && crosswalk?.status === 'confirmed' && [...directors].some(d => !directDirectorAliases.has(normalize(d)))) {
      result.directorAliasEvidence = crosswalk.provenance;
    }
    // Explicit diagnostic hook, never a browser-controlled identity option.
    // Normal products/ledger/logs exclude these values; the server-authorized
    // possible-search report may project a bounded, sanitized title subset.
    if (typeof onIdentityDiagnostic === 'function') {
      const bounded = values => values.slice(0, 32).map(s => typeof s === 'string' ? s.slice(0,500) : null);
      const complete = values => reason !== 'source-identity-structure-limit' && values.length <= 32 &&
        values.every(s => typeof s === 'string' && s.length <= 500);
      try { onIdentityDiagnostic({ ...result, sourceURL, sourceIdentity: { h1: bounded(headings), h2: bounded(originals), year: parsed ? Number(parsed[2]) : null, directors: bounded([...directors]) },
        sourceTitleCompleteness: { h1: complete(headings), h2: complete(originals) },
        expected: { year: film.year ?? null, imdbId: film.imdbId, tmdbId: film.tmdbId, titleAliases: bounded(names), directorAliases: bounded(directorNames) },
        truncated: reason === 'source-identity-structure-limit' || [headings, originals, [...directors], names, directorNames].some(a => a.length > 32 || a.some(s => typeof s === 'string' && s.length > 500)) }); } catch {}
    }
    return result;
  };
  const headings = active.filter(n => n.tagName === 'h1').map(text);
  const headingNode = active.find(n => n.tagName === 'h1');
  const accordions = active.filter(n => attr(n, 'id') === 'availabilityAccordion');
  const accordion = accordions.length === 1 ? accordions[0] : null;
  const inMetadata = node => headings.length === 1 && accordions.length === 1 &&
    Number.isInteger(node.sourceCodeLocation?.startOffset) && Number.isInteger(node.sourceCodeLocation?.endOffset) &&
    node.sourceCodeLocation.startOffset >= headingNode.sourceCodeLocation?.endOffset &&
    node.sourceCodeLocation.endOffset <= accordion.sourceCodeLocation?.startOffset;
  const inMetadataTable = node => {
    let table = node.parentNode;
    while (table && table.tagName !== 'table') table = table.parentNode;
    return Boolean(table && inMetadata(table) && inMetadata(node));
  };
  const originals = active.filter(n => n.tagName === 'h2' && n.sourceCodeLocation?.startOffset > headingNode?.sourceCodeLocation?.startOffset &&
    n.sourceCodeLocation?.startOffset < accordion?.sourceCodeLocation?.startOffset).map(text).filter(Boolean);
  // Typed semantic records retain their source/scope; never fabricate labelled
  // rows or allow IDs from another graph object to enter the film contract.
  const directors = new Set(), stable = [...semantic.records];
  let directorFields = 0, ambiguousDirectorField = false;
  // The existing DOM ID route reads labelled film-metadata rows only, never
  // arbitrary recommendations/trailers. Semantic IDs above have their own scope.
  let identityRows = 0;
  for (const row of active.filter(n => n.tagName === 'tr')) {
    const cells = (row.childNodes ?? []).filter(n => ['td', 'th'].includes(n.tagName));
    if (cells.length !== 2) continue;
    const label = text(cells[0]);
    if (label === 'Режисер:' && !inMetadataTable(row)) continue;
    if (['Режисер:', 'IMDb:', 'TMDb:'].includes(label) && ++identityRows > 32) return outcome('unresolved', 'source-identity-structure-limit');
    if (label === 'Режисер:' && text(cells[1])) {
      directorFields++; directors.add(text(cells[1]));
      const stack = [cells[1]]; let anchors = 0;
      while (stack.length) {
        const node = stack.pop(); if (node.tagName === 'a') anchors++;
        if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(node.tagName)) stack.push(...node.childNodes ?? []);
      }
      if (anchors > 1) ambiguousDirectorField = true;
    }
    if (['IMDb:', 'TMDb:'].includes(label)) {
      // A convenient ID in recommendations or another body table is not film
      // authority. Keep existing explicit-conflict refusal even if the critical
      // boundary is missing, but only this bounded table scope can confirm an ID.
      let table = row.parentNode;
      while (table && table.tagName !== 'table') table = table.parentNode;
      const filmScope = headings.length === 1 && accordions.length === 1 &&
        table?.sourceCodeLocation?.startOffset >= headingNode.sourceCodeLocation?.endOffset &&
        table?.sourceCodeLocation?.endOffset <= accordion.sourceCodeLocation?.startOffset;
      const links = [], stack = [cells[1]];
      while (stack.length) { const n = stack.pop(); if (n.tagName === 'a') links.push(n); if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(n.tagName)) stack.push(...(n.childNodes ?? [])); }
      if (links.length > 20) return outcome('unresolved', 'source-identity-structure-limit');
      for (const a of links) {
        const href = attr(a, 'href') ?? '';
        const match = label === 'IMDb:' ? /^https:\/\/(?:www\.)?imdb\.com\/title\/(tt\d{1,20})\/?$/.exec(href) : /^https:\/\/(?:www\.)?themoviedb\.org\/movie\/(\d{1,10})(?:-[a-z0-9-]+)?\/?$/.exec(href);
        stable.push({ namespace: label === 'IMDb:' ? 'imdb' : 'tmdb', id: match?.[1] ?? null, filmScope });
      }
      if (text(cells[1]) && (!links.length || (label === 'IMDb:' ? /^tt\d{1,20}$/ : /^\d{1,10}$/).test(text(cells[1])))) {
        const literal = text(cells[1]);
        stable.push({ namespace: label === 'IMDb:' ? 'imdb' : 'tmdb', id: (label === 'IMDb:' ? /^tt\d{1,20}$/ : /^\d{1,10}$/).test(literal) ? literal : null, filmScope });
      }
    }
  }
  // Inline labels must be inside the same film metadata interval too. A later
  // dubbing-credit director is not a second director of the film.
  for (const n of active) if (inMetadata(n) && ((n.nodeName === '#text' && text({ childNodes: [n] }) === 'Режисер:') || (['span', 'strong', 'b'].includes(n.tagName) && text(n) === 'Режисер:'))) {
    const siblings = n.parentNode?.childNodes ?? [], next = siblings.slice(siblings.indexOf(n) + 1).find(c => c.tagName || c.nodeName === '#text' && c.value.trim());
    let table = n.parentNode; while (table && table.tagName !== 'table') table = table.parentNode;
    if (next?.tagName === 'a' && inMetadata(next) && inMetadata(n.parentNode) && (!table || inMetadata(table))) {
      directorFields++;
      // Do not silently select the first person in a labelled inline field.
      // Keep every following name/unknown value until its explicit line break;
      // extra directors or unscoped trailing text keep the identity unresolved.
      const field = siblings.slice(siblings.indexOf(next));
      let anchors = 0;
      for (const value of field) {
        if (value.tagName === 'br') break;
        const stack = [value];
        while (stack.length) { const item = stack.pop(); if (item.tagName === 'a') anchors++; if (!['script','style','template','noscript','iframe'].includes(item.tagName)) stack.push(...item.childNodes ?? []); }
        const name = value.nodeName === '#text' ? value.value.replace(/\s+/gu, ' ').trim() : text(value);
        if (name && !/^[,;/&]+$/u.test(name)) directors.add(name);
      }
      if (anchors > 1) ambiguousDirectorField = true;
    }
  }
  directors.delete('');
  const expected = selectedIDs(film);
  if (canonicals.some(u => u && u !== sourceURL)) return outcome('mismatch', 'source-canonical-conflict');
  if (stable.some(s => s.id && expected[s.namespace] && s.id !== expected[s.namespace]) || ['tmdb', 'imdb'].some(ns => new Set(stable.filter(s => s.id && s.namespace === ns).map(s => s.id)).size > 1)) return outcome('mismatch', 'source-stable-id-conflict');
  if (stable.some(s => !s.id)) return outcome('unresolved', 'malformed-source-stable-id');
  if (canonicals.length > 1) return outcome('unresolved', 'source-canonical-ambiguous');
  if (headings.length !== 1 || !originals.length || canonicals.length !== 1 || canonicals[0] !== sourceURL) return outcome('unresolved', 'source-identity-structure-incomplete');
  const aliases = new Set([film.identityTitle, film.originalTitle, ...(film.titleAliases ?? [])].map(normalize).filter(Boolean));
  const heading = /^(.*?)\s*\(\s*(\d{4})\s*\)\s*$/.exec(headings[0]);
  if (!heading || !year(Number(heading[2]))) return outcome('unresolved', 'source-title-year-missing');
  const headingMatch = titleMatch(heading[1], [film.identityTitle, film.originalTitle, ...(film.titleAliases ?? [])]);
  const possibleTranslation = !headingMatch && unknownTranslationHeading(heading[1], film);
  if (!headingMatch && !possibleTranslation) return outcome('mismatch', 'source-title-conflict');
  // Offsets only bound candidate H2s, not a proven semantic metadata container.
  // Never discard competing H2s just because one matches. Repeated identical
  // values are not a title conflict, but cannot justify a new multi-node scope
  // or deduplication rule without source evidence. Do not guess selectors.
  if (originals.length !== 1) return outcome('unresolved', 'source-original-title-scope-unestablished');
  // A new localization route exists only alongside the exact trusted original.
  // An unrelated original plus an unknown heading remains the existing title
  // refusal, including its protected possible-irrelevance diagnostics.
  const translation = possibleTranslation && normalize(originals[0]) === normalize(film.originalTitle);
  if (!headingMatch && !translation) return outcome('mismatch', 'source-title-conflict');
  if (!aliases.has(normalize(originals[0]))) return outcome('unresolved', 'source-original-title-unestablished');
  // A localized г/ґ spelling is only a bridge to the director gate, never film
  // proof. H2 must be the actual trusted original title, not another alias.
  if (headingMatch === 'ukrainian-g' && (!normalize(film.originalTitle) || normalize(originals[0]) !== normalize(film.originalTitle))) return outcome('unresolved', 'source-original-title-unestablished');
  const stableMatch = stable.some(s => s.filmScope && expected[s.namespace] && s.id === expected[s.namespace]);
  if (!year(film.year)) return outcome('unresolved', 'selected-year-missing');
  // A terminal glyph equivalence is weaker than an exact title alias. It must
  // retain exact original-title evidence, the primary year and director proof;
  // no stable-ID bypass or release-year exception is added for this new route.
  if (headingMatch === 'terminal-roman-i' && Number(heading[2]) !== film.year) return outcome('mismatch', 'source-year-conflict-terminal-roman-title');
  if (headingMatch === 'ukrainian-g' && Number(heading[2]) !== film.year) return outcome('mismatch', 'source-year-conflict-ukrainian-g-title');
  if (translation && Number(heading[2]) !== film.year) return outcome('mismatch', 'source-year-conflict-unknown-translation');
  const knownRelease = releaseYearEvidence(film, Number(heading[2])).length > 0;
  if (Number(heading[2]) !== film.year && !stableMatch && !knownRelease) return outcome('mismatch', 'source-year-conflict-without-stable-crosswalk');
  // Optional malformed JSON cannot donate positive IDs. Actually ambiguous
  // owned Movie metadata/duplicate-key authority is a critical refusal; earlier
  // explicit ID/title/year conflicts retain their existing mismatch priority.
  if (semantic.status === 'ambiguous') return outcome('unresolved',
    ['semantic-sameas-shape', 'semantic-movie-id-shape'].includes(semantic.reason) ? 'malformed-source-stable-id' : 'source-identity-structure-incomplete');
  // Unlike a spelling difference, a proven multi-director scope is explicit
  // ambiguity. New JSON-LD proof must not silently erase it. The historical
  // labelled-ID contract is left unchanged.
  const semanticMatch = stable.some(s => s.provenance === 'jsonld-owned-movie-sameas' && s.filmScope && expected[s.namespace] && s.id === expected[s.namespace]);
  const labelledMatch = stable.some(s => s.provenance !== 'jsonld-owned-movie-sameas' && s.filmScope && expected[s.namespace] && s.id === expected[s.namespace]);
  if (semanticMatch && !labelledMatch && (directors.size > 1 || directorFields > 1 || ambiguousDirectorField ||
      film.directorCount > 1 || Array.isArray(film.directorPeople) && film.directorPeople.length > 1)) return outcome('unresolved', 'director-scope-unestablished');
  // Only a trusted server verifier can remember a *proven* person-ID/birthday
  // conflict. Its exact person/profile/alias key is checked without I/O; mere
  // spelling differences, parse errors and prior failures are not conflicts.
  if (semanticMatch && headingMatch === 'exact' && Number(heading[2]) === film.year && typeof directorConflictLookup === 'function') {
    const pointer = linkedDirectorProfile(all);
    let knownConflict = false;
    if (pointer) { try { knownConflict = directorConflictLookup(pointer) === true; } catch {} }
    if (knownConflict) return outcome('unresolved', 'director-known-person-conflict');
  }
  // Explicit same-system film ID plus independently matching title/year is a
  // stronger route than name spelling. Canonical, title/original scope, malformed
  // IDs and all proven ID conflicts have already been checked above.
  if (headingMatch === 'exact' && stableMatch && Number(heading[2]) === film.year) return outcome('matched', 'explicit-stable-title-year-match');
  const directorAliases = new Set(directorNames.map(normalize).filter(Boolean));
  if (!directors.size || !directorAliases.size) return outcome('unresolved', 'source-or-selected-director-missing');
  // Flat aliases do not establish a multi-person group. Do not split source
  // formatting or guess membership/completeness. Count comes from the already
  // selected director records, never from aliases, script or browser input.
  if (film.directorCount !== 1 || directors.size !== 1 || directorFields !== 1 || ambiguousDirectorField || film.directorPeople !== undefined &&
      (!Array.isArray(film.directorPeople) || film.directorPeople.length > 1)) return outcome('unresolved', 'director-scope-unestablished');
  // Without a shared film ID, or with a differing year, director proof is still
  // required. A spelling difference is unresolved, not person-conflict evidence.
  if (![...directors].every(d => directorAliases.has(normalize(d)))) return outcome('unresolved', 'director-alias-unestablished');
  if (translation) return outcome('matched', 'explicit-original-year-director-translation-match');
  return outcome('matched', stableMatch ? 'explicit-stable-and-structural-match' : Number(heading[2]) !== film.year ? 'explicit-title-release-year-director-match' : 'explicit-title-year-director-match');
}

// A linked profile is eligible only in the same bounded labelled film metadata,
// not a recommendation/person link elsewhere on the page. It is a pointer, not
// proof of identity. No source URL is generated from a name or slug.
export function linkedDirectorProfile(all) {
  const active = all.filter(n => !excluded(n));
  const headings = active.filter(n => n.tagName === 'h1');
  const accordions = active.filter(n => attr(n,'id') === 'availabilityAccordion');
  if (headings.length !== 1 || accordions.length !== 1) return null;
  const rows = active.filter(n => n.tagName === 'tr').filter(row => {
    const cells = (row.childNodes ?? []).filter(n => ['td','th'].includes(n.tagName));
    let table = row.parentNode; while (table && table.tagName !== 'table') table = table.parentNode;
    return cells.length === 2 && text(cells[0]) === 'Режисер:' &&
      table?.sourceCodeLocation?.startOffset >= headings[0].sourceCodeLocation?.endOffset &&
      table?.sourceCodeLocation?.endOffset <= accordions[0].sourceCodeLocation?.startOffset;
  });
  if (rows.length !== 1) return null;
  const row = rows[0], cells = row.childNodes.filter(n => ['td','th'].includes(n.tagName));
  let table = row.parentNode; while (table && table.tagName !== 'table') table = table.parentNode;
  if (!(table?.sourceCodeLocation?.startOffset >= headings[0].sourceCodeLocation?.endOffset &&
      table.sourceCodeLocation?.endOffset <= accordions[0].sourceCodeLocation?.startOffset)) return null;
  const links = [], stack = [cells[1]];
  while (stack.length) { const n = stack.pop(); if (n.tagName === 'a') links.push(n); if (!['script','style','template','noscript','iframe'].includes(n.tagName)) stack.push(...n.childNodes ?? []); }
  if (links.length !== 1 || !text(cells[1]) || text(cells[1]) !== text(links[0])) return null;
  const href = attr(links[0],'href');
  const url = typeof href === 'string' && /^\/persons\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href) ? 'https://kinobazaua.com' + href : href;
  return typeof url === 'string' && url.length <= 512 && /^https:\/\/kinobazaua\.com\/persons\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ? {sourceURL:url,sourceAlias:text(cells[1])} : null;
}

export async function fetchAssistedKinobaza(sourceURL, film, fetchImpl, { timeoutMs = HTML_TIMEOUT_MS, maxBytes = HTML_LIMIT_BYTES, signal, onIdentityDiagnostic, directorAliasLookup, directorConflictLookup, verifyDirector, onDeferredDirector } = {}) {
  if (!admitKinobazaURL(sourceURL)) throw new Error('Unadmitted source');
  const controller = new AbortController(); const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let reader; const timer = setTimeout(abort, timeoutMs);
  // The parent signal must still bound a deferred continuation after the first
  // card read returns and its temporary abort bridge is removed in finally.
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const aborted = new Promise((_, reject) => { if (combined.aborted) reject(Error('aborted')); else combined.addEventListener('abort', () => reject(Error('aborted')), { once: true }); });
  const bounded = p => Promise.race([p, aborted]);
  const fail = (status, httpStatus) => ({ status, ...(httpStatus ? { httpStatus } : {}), candidates: [], sourceURL });
  try {
    const r = await bounded(fetchImpl(sourceURL, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'MovieWishlistResearchPoC/0.1 (manual assisted-card experiment)' }, signal: controller.signal }));
    const stop = status => { void r.body?.cancel().catch(() => {}); return fail(status, r.status); };
    if (r.status >= 300 && r.status < 400) return stop('redirect-not-followed');
    if (!r.ok) return stop([403, 429].includes(r.status) ? 'access-blocked-no-retry' : 'http-error-no-retry');
    const type = r.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || /charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type)) return stop('unsupported-content-type');
    if (Number(r.headers.get('content-length')) > maxBytes) return stop('response-too-large');
    if (!r.body) return fail('empty-response', r.status);
    reader = r.body.getReader(); const chunks = []; let bytes = 0;
    while (true) { const part = await bounded(reader.read()); if (part.done) break; bytes += part.value.byteLength; if (bytes > maxBytes) { void reader.cancel().catch(() => {}); return fail('response-too-large', r.status); } chunks.push(part.value); }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
    // Card body has finished. Optional person verification has its own bounded
    // waits plus the handler's unchanged end-to-end deadline, not a second GET.
    clearTimeout(timer);
    if (/captcha|cf-chl-|challenge-platform/i.test(html)) return fail('challenge-unsupported-no-retry', r.status);
    const receivedAt = new Date().toISOString();
    const attach = extracted => {
      if (extracted.localization) extracted.localization.provenance = { source: 'Kinobaza HTML', sourceURL, receivedAt, method: 'initial HTML source blocks; assisted card', upstream: 'not-established' };
      return { ...extracted, sourceURL, receivedAt, bytes, httpStatus: r.status, requestsMade: 1 };
    };
    let deferredPointer, resumeExtraction;
    const verifyIdentity = async all => {
      const checked = assistedIdentity(all, film, sourceURL, {directorAliasLookup,directorConflictLookup});
      const pointer = checked.reason === 'director-alias-unestablished' && typeof verifyDirector === 'function' ? linkedDirectorProfile(all) : null;
      let proof;
      if (pointer && !combined.aborted) { try { proof = await bounded(verifyDirector(pointer)); } catch {} }
      const person = film.directorCount === 1 && film.directorPeople?.length === 1 ? film.directorPeople[0] : null;
      const valid = person?.namespace === 'tmdb:person' && Number.isSafeInteger(person.personId) && person.personId > 0 &&
        proof?.status === 'confirmed' && proof.provenance?.namespace === person.namespace &&
        proof.provenance.personId === person.personId && proof.provenance.scope === 'kinobaza-director-identity' &&
        proof.provenance.sourceURL === pointer?.sourceURL && proof.aliases?.length === 1 && normalize(proof.aliases[0]) === normalize(pointer.sourceAlias);
      const lookup = valid ? candidate => candidate.namespace === person.namespace && candidate.personId === person.personId ? proof : {status:'unresolved'} : directorAliasLookup;
      return assistedIdentity(all, film, sourceURL, {onIdentityDiagnostic,directorAliasLookup:lookup,directorConflictLookup});
    };
    const extracted = await bounded(extractHtml(html, film, { identityCheck: async all => {
      const checked = assistedIdentity(all, film, sourceURL, {directorAliasLookup,directorConflictLookup});
      const pointer = checked.reason === 'director-alias-unestablished' && typeof verifyDirector === 'function' && typeof onDeferredDirector === 'function' ? linkedDirectorProfile(all) : null;
      if (pointer) {
        deferredPointer = pointer;
        return assistedIdentity(all, film, sourceURL, {onIdentityDiagnostic,directorAliasLookup,directorConflictLookup});
      }
      return verifyIdentity(all);
    }, onIdentityBlocked: resume => { if (deferredPointer) resumeExtraction = resume; } }));
    const initial = attach(extracted);
    if (deferredPointer && resumeExtraction) {
      let pending = resumeExtraction, resumed;
      resumeExtraction = null;
      const dispose = () => { pending = null; };
      const resume = () => {
        if (resumed) return resumed;
        const continuation = pending; pending = null;
        if (!continuation) return Promise.resolve(initial);
        resumed = (async () => {
          if (combined.aborted) return fail('timeout-or-cancelled-no-retry', r.status);
          try { return attach(await bounded(continuation(verifyIdentity))); }
          catch { return fail(combined.aborted ? 'timeout-or-cancelled-no-retry' : 'network-or-decoding-error-no-retry', r.status); }
        })();
        return resumed;
      };
      try { onDeferredDirector({ pointer: deferredPointer, identity: extracted.identity, resume, dispose }); }
      catch { dispose(); } // Controller registration failure keeps claims withheld.
    }
    return initial;
  } catch { if (reader) void reader.cancel().catch(() => {}); return fail(combined.aborted ? 'timeout-or-cancelled-no-retry' : 'network-or-decoding-error-no-retry'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
