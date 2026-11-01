// Deterministic linked-person evidence only. This module performs no I/O,
// registration, persistence, fuzzy matching or transliteration.
const HTML_BYTES = 2 * 1024 * 1024;
const JSON_BYTES = 128 * 1024;
const excludedTags = new Set(['nav', 'aside', 'footer', 'template', 'noscript', 'iframe']);
const skipTags = new Set([...excludedTags, 'script', 'style']);
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const children = n => n.childNodes ?? [];
const clean = s => s.replace(/\s+/gu, ' ').trim();
const normalize = s => typeof s === 'string' ? clean(s.normalize('NFC')).toLocaleLowerCase('uk-UA') : '';
const string = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 500 && !/[\p{C}]/u.test(s);
const id = n => Number.isSafeInteger(n) && n > 0;
const object = n => n !== null && typeof n === 'object' && !Array.isArray(n);
const own = (o, key) => Object.hasOwn(o, key);
const hasClass = (n, value) => (attr(n, 'class') ?? '').split(/\s+/).includes(value);
const nodeText = n => clean(children(n).map(c => c.nodeName === '#text' ? c.value : skipTags.has(c.tagName) ? '' : nodeText(c)).join(' '));
const excluded = n => { for (let p = n; p; p = p.parentNode) if (excludedTags.has(p.tagName)) return true; return false; };
const fail = (reason, diagnostics = {}) => ({ status: 'unresolved', reason, diagnostics });
function fullDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 1000 ? value : null;
}
const months = Object.freeze({ січня: '01', лютого: '02', березня: '03', квітня: '04', травня: '05', червня: '06', липня: '07', серпня: '08', вересня: '09', жовтня: '10', листопада: '11', грудня: '12' });
function birthDate(label) {
  const m = /^Дата народження:\s*(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})(?:\s*\(\d{1,3}\s+(?:років|роки|рік)\))?$/iu.exec(label);
  return m && months[m[2].toLocaleLowerCase('uk-UA')] ? fullDate(`${m[3]}-${months[m[2].toLocaleLowerCase('uk-UA')]}-${m[1].padStart(2, '0')}`) : null;
}

export function admitDirectorProfileURL(value) {
  // Exact original spelling, before URL parser normalization. No URL guessing.
  if (typeof value !== 'string' || value.length > 512 || !/^https:\/\/kinobazaua\.com\/persons\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return null;
  const u = new URL(value);
  return u.origin === 'https://kinobazaua.com' && !u.username && !u.password && !u.port && !u.search && !u.hash ? value : null;
}

export function projectTmdbPerson(data, expectedPerson) {
  if (expectedPerson?.namespace !== 'tmdb:person' || !id(expectedPerson.personId) ||
      !Array.isArray(expectedPerson.names) || !expectedPerson.names.length || expectedPerson.names.length > 32 || !expectedPerson.names.every(string)) return fail('trusted-person-projection-invalid');
  if (!object(data) || data.success === false || own(data, 'status_code')) return fail('tmdb-person-response-invalid');
  if (data.id !== expectedPerson.personId) return fail('tmdb-person-id-conflict');
  const external = data.external_ids;
  if (external !== undefined && external !== null && (!object(external) || external.success === false || own(external, 'status_code') || own(external, 'id') && external.id !== data.id)) return fail('tmdb-person-external-ids-invalid');
  const aliases = data.also_known_as ?? [];
  if (!string(data.name) || !Array.isArray(aliases) || aliases.length > 100 || !aliases.every(string)) return fail('tmdb-person-names-invalid');
  if (data.birthday !== undefined && data.birthday !== null && data.birthday !== '' && !fullDate(data.birthday)) return fail('tmdb-person-birthday-invalid');
  const ids = [data.imdb_id, external?.imdb_id].filter(v => v !== undefined && v !== null && v !== '');
  if (ids.some(v => typeof v !== 'string' || !/^nm\d{1,20}$/.test(v)) || new Set(ids).size > 1) return fail('tmdb-person-imdb-conflict-or-invalid');
  return { status: 'ok', reason: 'trusted-tmdb-person-projection', namespace: 'tmdb:person', personId: data.id,
    names: [...new Map([data.name, ...aliases, ...expectedPerson.names].map(n => [normalize(n), n])).values()],
    birthday: fullDate(data.birthday), imdbId: ids[0] ?? null };
}

function personID(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const imdb = /^https:\/\/(?:www\.)?imdb\.com\/name\/(nm\d{1,20})\/?$/.exec(value);
  if (imdb) return { namespace: 'imdb:person', id: imdb[1] };
  const tmdb = /^https:\/\/(?:www\.)?themoviedb\.org\/person\/([1-9]\d{0,15})(?:-[a-z0-9-]+)?\/?$/.exec(value);
  return tmdb && id(Number(tmdb[1])) ? { namespace: 'tmdb:person', id: Number(tmdb[1]) } : null;
}
function collect(root) {
  const all = [], stack = [[root, 0]];
  while (stack.length) {
    const [n, depth] = stack.pop();
    if (depth > 256 || all.length >= 100_000) throw Error('profile-structure-limit');
    all.push(n);
    if (!skipTags.has(n.tagName)) for (const c of children(n).toReversed()) stack.push([c, depth + 1]);
  }
  return all;
}
function interval(n) { return [n?.sourceCodeLocation?.startOffset, n?.sourceCodeLocation?.endOffset]; }
function intersects(error, node) {
  const [start, end] = interval(node);
  return Number.isInteger(start) && Number.isInteger(end) && error.startOffset >= start && error.startOffset < end;
}
function noncriticalImageError(error, all, header, html) {
  if (!['missing-whitespace-between-attributes', 'unexpected-character-in-attribute-name'].includes(error.code) || intersects(error, header)) return false;
  const targets = all.filter(n => n.sourceCodeLocation?.startTag && error.startOffset >= n.sourceCodeLocation.startTag.startOffset && error.startOffset < n.sourceCodeLocation.startTag.endOffset && error.endOffset <= n.sourceCodeLocation.startTag.endOffset);
  if (targets.length !== 1) return false;
  const n = targets[0], loc = n.sourceCodeLocation.startTag;
  return n.tagName === 'img' && n.namespaceURI === 'http://www.w3.org/1999/xhtml' && children(n).length === 0 &&
    loc.startOffset >= header.sourceCodeLocation.endOffset && !html.slice(loc.startOffset + 1, loc.endOffset).includes('<');
}

function stylePreambleErrors(html, errors, header) {
  // Observed person-profile template emits one closed, attribute-free style
  // before its HTML doctype. parse5 retains the profile tree but reports these
  // three located document-opening errors. Validate the *entire* preamble;
  // this is not permission to ignore arbitrary errors before the person header.
  const doctypes = [...html.matchAll(/<!doctype\b[^>]*>/gi)];
  if (doctypes.length !== 1 || !/^<!doctype\s+html\s*>$/i.test(doctypes[0][0])) return new Set();
  const doctype = doctypes[0], prefix = html.slice(0, doctype.index);
  if (prefix.length > 32 * 1024) return new Set();
  const style = /^(\s*)<style>[^<>]*<\/style>\s*$/iu.exec(prefix);
  if (!style) return new Set();
  const afterDoctype = doctype.index + doctype[0].length;
  const htmlTag = /^(\s*)<html(?:\s[^<>]*)?>/iu.exec(html.slice(afterDoctype));
  if (!htmlTag) return new Set();
  const afterHtml = afterDoctype + htmlTag[0].length;
  const headTag = /^(\s*)<head>/iu.exec(html.slice(afterHtml));
  if (!headTag) return new Set();
  const headStart = afterHtml + headTag[1].length, headEnd = afterHtml + headTag[0].length;
  if (!(header.sourceCodeLocation?.startOffset > headEnd)) return new Set();
  const expected = [
    // parse5 locates missing-doctype as a zero-width position at the style.
    ['missing-doctype', style[1].length, style[1].length],
    ['misplaced-doctype', doctype.index, afterDoctype],
    ['misplaced-start-tag-for-head-element', headStart, headEnd],
  ];
  const found = [];
  for (const [code, start, end] of expected) {
    const matches = errors.filter(e => e.code === code);
    if (matches.length !== 1 || matches[0].startOffset !== start || matches[0].endOffset !== end) return new Set();
    found.push(matches[0]);
  }
  return new Set(found);
}

export async function inspectDirectorProfile(html, sourceURL, sourceAlias) {
  if (!admitDirectorProfileURL(sourceURL)) return fail('profile-url-rejected');
  if (!string(sourceAlias)) return fail('source-director-alias-invalid');
  if (typeof html !== 'string' || Buffer.byteLength(html) > HTML_BYTES) return fail('profile-html-size-limit');
  let parse;
  try { ({ parse } = await import('parse5')); } catch { return fail('profile-parser-unavailable'); }
  try {
    const errors = [];
    const root = parse(html, { sourceCodeLocationInfo: true, onParseError: e => { if (errors.length < 100) errors.push(e); } });
    const all = collect(root), active = all.filter(n => !excluded(n));
    const canonical = active.filter(n => n.tagName === 'link' && (attr(n, 'rel') ?? '').split(/\s+/).includes('canonical'));
    const headings = active.filter(n => n.tagName === 'h1');
    const diagnostics = { canonicalCount: canonical.length, headingCount: headings.length, latinHeadingCount: 0, birthdayCount: 0, roleCount: 0, ownedPersonCount: 0,
      recoveredImageErrors: 0, recoveredPreambleErrors: 0, nativeAliasMatch: false };
    if (canonical.length !== 1 || attr(canonical[0], 'href') !== sourceURL) return fail('profile-canonical-conflict-or-ambiguous', diagnostics);
    if (headings.length !== 1 || !hasClass(headings[0], 'h2')) return fail('profile-heading-ambiguous', diagnostics);
    const heading = headings[0], header = heading.parentNode;
    if (header?.tagName !== 'div' || !hasClass(header, 'col-8') || !header.sourceCodeLocation?.endTag) return fail('profile-header-scope-unestablished', diagnostics);
    const h2 = children(header).filter(n => n.tagName === 'h2');
    const birthdays = children(header).filter(n => n.tagName === 'p' && /^Дата народження:/u.test(nodeText(n)));
    const roles = children(header).filter(n => n.tagName === 'p' && /^Ролі:/u.test(nodeText(n)));
    Object.assign(diagnostics, { latinHeadingCount: h2.length, birthdayCount: birthdays.length, roleCount: roles.length });
    if (h2.length !== 1 || !hasClass(h2[0], 'h3') || !hasClass(h2[0], 'text-muted') || !string(nodeText(heading)) || !string(nodeText(h2[0]))) return fail('profile-name-scope-unestablished', diagnostics);
    if (birthdays.length > 1 || roles.length !== 1) return fail('profile-facts-ambiguous', diagnostics);
    const nativeName = nodeText(heading), latinName = nodeText(h2[0]);
    diagnostics.nativeAliasMatch = normalize(nativeName) === normalize(sourceAlias);
    if (!diagnostics.nativeAliasMatch) return fail('profile-source-alias-conflict', diagnostics);
    if (!/^[\p{Script=Latin}\p{M}\d .,'’‘()\-]+$/u.test(latinName)) return fail('profile-latin-name-unestablished', diagnostics);
    const birthday = birthdays.length ? birthDate(nodeText(birthdays[0])) : null;
    if (birthdays.length && !birthday) return fail('profile-birthday-invalid', diagnostics);
    const roleText = nodeText(roles[0]).slice('Ролі:'.length);
    const director = /(?:^|,)\s*режисер(?:\s|★|$)/iu.test(roleText);
    if (!director) return fail('profile-director-role-unestablished', diagnostics);
    if (errors.length >= 100) return fail('profile-html-error-limit', diagnostics);
    const preambleErrors = stylePreambleErrors(html, errors, header);
    const firstDoctype = /<!doctype\b[^>]*>/i.exec(html);
    if (firstDoctype && html.slice(0, firstDoctype.index).trim() && !preambleErrors.size) return fail('profile-html-parse-errors', diagnostics);
    for (const error of errors) {
      if (preambleErrors.has(error)) { diagnostics.recoveredPreambleErrors++; continue; }
      if (error.code === 'missing-doctype') continue;
      if (!noncriticalImageError(error, all, header, html)) return fail('profile-html-parse-errors', diagnostics);
      diagnostics.recoveredImageErrors++;
    }
    const scripts = active.filter(n => n.tagName === 'script' && attr(n, 'type') === 'application/ld+json');
    if (scripts.length > 32) return fail('profile-semantic-limit', diagnostics);
    const people = []; let bytes = 0, scanned = 0;
    for (const script of scripts) {
      const raw = children(script).map(n => n.value ?? '').join('');
      bytes += Buffer.byteLength(raw);
      if (bytes > JSON_BYTES) return fail('profile-semantic-limit', diagnostics);
      let value; try { value = JSON.parse(raw); } catch { return fail('profile-semantic-invalid', diagnostics); }
      const queue = [value];
      while (queue.length) {
        if (++scanned > 128) return fail('profile-semantic-limit', diagnostics);
        const item = queue.shift();
        if (Array.isArray(item)) { queue.push(...item); continue; }
        if (!object(item)) continue;
        if (item['@graph'] !== undefined) queue.push(item['@graph']);
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!types.some(t => ['Person', 'https://schema.org/Person', 'http://schema.org/Person'].includes(t))) continue;
        // An arbitrary body link or unbound Person does not own this profile.
        if (item.url !== sourceURL && item['@id'] !== sourceURL) continue;
        if (item.url !== undefined && item.url !== sourceURL || item['@id'] !== undefined && item['@id'] !== sourceURL && !personID(item['@id'])) return fail('profile-semantic-ownership-conflict', diagnostics);
        if (!string(item.name) || ![nativeName, latinName].some(n => normalize(n) === normalize(item.name))) return fail('profile-semantic-name-conflict', diagnostics);
        const sameAs = item.sameAs === undefined ? [] : Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
        if (sameAs.length > 32 || sameAs.some(u => typeof u !== 'string' || u.length > 512)) return fail('profile-semantic-limit', diagnostics);
        const ids = [...sameAs, item['@id']].filter(Boolean).map(personID).filter(Boolean);
        if (sameAs.some(u => /^https?:\/\/(?:www\.)?(?:imdb\.com|themoviedb\.org)(?:\/|$)/.test(u) && !personID(u))) return fail('profile-person-id-shape-invalid', diagnostics);
        if (item.birthDate !== undefined && (!fullDate(item.birthDate) || birthday && item.birthDate !== birthday)) return fail('profile-birthday-conflict', diagnostics);
        people.push({ ids, birthday: fullDate(item.birthDate) });
      }
    }
    diagnostics.ownedPersonCount = people.length;
    if (people.length > 1) return fail('profile-semantic-ambiguous', diagnostics);
    const stableIds = people[0]?.ids ?? [];
    if (['imdb:person', 'tmdb:person'].some(ns => new Set(stableIds.filter(s => s.namespace === ns).map(s => s.id)).size > 1)) return fail('profile-person-id-conflict', diagnostics);
    return { status: 'ok', reason: 'scoped-profile-evidence', sourceURL, nativeName, latinName,
      birthday: birthday ?? people[0]?.birthday ?? null, director, stableIds, diagnostics };
  } catch { return fail('profile-parser-or-structure-limit'); }
}

export function compareDirectorProfile(profile, person) {
  if (profile?.status !== 'ok') return fail(profile?.reason ?? 'profile-not-established', profile?.diagnostics ?? {});
  if (person?.status !== 'ok' || person.namespace !== 'tmdb:person' || !id(person.personId) || !Array.isArray(person.names) || !person.names.every(string)) return fail(person?.reason ?? 'tmdb-person-not-established');
  const ids = profile.stableIds ?? [];
  const expected = { 'tmdb:person': person.personId, 'imdb:person': person.imdbId };
  const stableIdConflict = ids.some(s => expected[s.namespace] !== undefined && expected[s.namespace] !== null && expected[s.namespace] !== s.id) ||
    ['imdb:person', 'tmdb:person'].some(ns => new Set(ids.filter(s => s.namespace === ns).map(s => s.id)).size > 1);
  const stableIdMatch = ids.some(s => expected[s.namespace] !== undefined && expected[s.namespace] !== null && expected[s.namespace] === s.id);
  const birthdayConflict = Boolean(profile.birthday && person.birthday && profile.birthday !== person.birthday);
  const birthdayMatch = Boolean(profile.birthday && person.birthday && profile.birthday === person.birthday);
  const latinNameMatch = person.names.some(n => normalize(n) === normalize(profile.latinName));
  const diagnostics = { ...profile.diagnostics, stableIdConflict, stableIdMatch, birthdayConflict, birthdayMatch, latinNameMatch };
  if (stableIdConflict) return fail('director-person-id-conflict', diagnostics);
  if (birthdayConflict) return fail('director-person-birthday-conflict', diagnostics);
  if (!profile.director || !profile.diagnostics?.nativeAliasMatch || !string(profile.nativeName)) return fail('director-profile-scope-unestablished', diagnostics);
  const basis = stableIdMatch ? 'shared-person-id' : latinNameMatch && birthdayMatch ? 'exact-name-birthdate-role' : null;
  if (!basis) return fail('director-person-evidence-insufficient', diagnostics);
  return { status: 'confirmed', reason: basis === 'shared-person-id' ? 'confirmed-shared-person-id' : 'confirmed-person-profile-facts',
    aliases: [profile.nativeName], basis, diagnostics,
    provenance: { namespace: person.namespace, personId: person.personId, scope: 'kinobaza-director-identity', sourceURL: profile.sourceURL,
      method: basis, facts: { latinNameMatch, birthdayMatch, directorRole: true, nativeAliasMatch: true, sharedPersonId: stableIdMatch } } };
}
