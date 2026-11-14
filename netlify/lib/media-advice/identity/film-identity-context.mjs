// Metadata already projected from the server's validated TMDb movie Details.
// This context is not identity proof, a browser-input validator, or provider data.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MAX_TITLES = 120;
const MAX_RELEASES = 240;
const MAX_LIST = 2000;
const text = (value, max = 500) => typeof value === 'string' && value.length <= max && !!value.trim() && !/[\p{C}]/u.test(value);
const scalar = (field, valid) => object(field) && field.state === 'reported' && valid(field.value) ? field.value : undefined;
const title = field => scalar(field, value => text(value));
const country = field => scalar(field, value => typeof value === 'string' && /^[A-Z]{2}$/.test(value));
const language = field => scalar(field, value => typeof value === 'string' && /^[a-z]{2}$/.test(value));
const list = (field, max = MAX_LIST) => object(field) && field.state === 'reported' && Array.isArray(field.items) && field.items.length <= max ? field.items : [];

function releaseDate(field) {
  const value = scalar(field, value => typeof value === 'string' && value.length <= 40);
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return undefined;
  if (match[4] !== undefined) {
    if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) return undefined;
    const zone = match[7];
    if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 14 || Number(zone.slice(4, 6)) > 59 || (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4, 6)) !== 0))) return undefined;
  }
  // The source's calendar day/year is evidence; never convert its timezone to UTC.
  return { date: value, year };
}

export function projectFilmIdentityContext(projection) {
  if (!object(projection) || projection.identity?.status !== 'matched') return null;
  const tmdbId = scalar(projection.identity.tmdbId, value => Number.isSafeInteger(value) && value > 0);
  if (!tmdbId) return null;
  const metadata = object(projection.metadata) ? projection.metadata : {};
  const titleEvidence = [], releaseEvidence = [], seenTitles = new Set(), seenReleases = new Set();
  const addTitle = entry => {
    if (!entry.title || titleEvidence.length >= MAX_TITLES) return;
    const key = JSON.stringify(entry);
    if (!seenTitles.has(key)) { seenTitles.add(key); titleEvidence.push(entry); }
  };
  const withContext = (entry, key, value) => value === undefined ? entry : { ...entry, [key]: value };
  addTitle({ title: title(metadata.originalTitle), source: 'original' });
  addTitle({ title: title(metadata.requestedTitle), source: 'requested' });
  for (const item of list(metadata.translations)) {
    if (!object(item)) continue;
    let entry = { title: title(item.title), source: 'translation' };
    entry = withContext(entry, 'language', language(item.language));
    entry = withContext(entry, 'country', country(item.country));
    addTitle(entry);
  }
  for (const item of list(metadata.alternativeTitles)) {
    if (!object(item)) continue;
    let entry = { title: title(item.title), source: 'alternative' };
    entry = withContext(entry, 'country', country(item.country));
    entry = withContext(entry, 'type', scalar(item.type, value => text(value, 100)));
    addTitle(entry);
  }
  for (const section of list(metadata.releaseDates, 250)) {
    if (!object(section)) continue;
    const region = country(section.country);
    if (!region) continue;
    for (const item of list(section.dates)) {
      if (releaseEvidence.length >= MAX_RELEASES) break;
      if (!object(item)) continue;
      const date = releaseDate(item.date);
      const type = scalar(item.type, value => Number.isInteger(value) && value >= 1 && value <= 6);
      if (!date || type === undefined) continue;
      const entry = withContext({ ...date, type, country: region }, 'language', language(item.language));
      const key = JSON.stringify(entry);
      if (!seenReleases.has(key)) { seenReleases.add(key); releaseEvidence.push(entry); }
    }
    if (releaseEvidence.length >= MAX_RELEASES) break;
  }
  return { tmdbId, titleEvidence, releaseEvidence };
}
