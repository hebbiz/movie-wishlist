import { classifyLink } from '../shared/media-link-policy.mjs';
// Presentation of already projected source rows only. No joins, inference from
// provider names/URLs, or promotion of film badges and separate source blocks.
const providers = Object.freeze({ apple: 'Apple TV / iTunes', netflix: 'Netflix', hbo: 'HBO Max', prime: 'Prime Video', megogo: 'MEGOGO', rakuten: 'Rakuten TV' });
const accessLabels = Object.freeze({ rent: 'Оренда', rental: 'Оренда', buy: 'Купівля', purchase: 'Купівля', subscription: 'Передплата', flatrate: 'Передплата', addon: 'Додатковий пакет', free: 'Безкоштовний доступ', 'ad-supported': 'З рекламою' });
const bands = Object.freeze({ 'ua-audio': 0, 'ua-subtitles': 1, ua: 2, supplemental: 3, withheld: 4 });
// A preference between services is applied only after the language category.
// Equal services retain the supplied order; original source-row ranking stays
// independent of this display-only preference.
const servicePriority = Object.freeze({ apple: 0, rakuten: 1, netflix: 2, hbo: 2, prime: 2, megogo: 3 });
const value = field => field?.state === 'reported' ? field.value : null;
const ukrainian = language => typeof language === 'string' && ['uk', 'ukr'].includes(language.toLowerCase());
const hasConflicts = row => Boolean(row?.providerConflict || row?.conflicts?.length || ['audio', 'subtitles'].some(key => row?.[key]?.state === 'conflicting'));
const eligible = row => row?.identityStatus === 'matched' && Object.hasOwn(providers, row?.provider?.key) && !hasConflicts(row);

function languageState(row, key) {
  const field = row?.[key];
  if (field?.state === 'conflicting' || Array.isArray(row?.conflicts) && row.conflicts.some(conflict => conflict?.field === key)) return 'conflicting';
  if (row?.identityStatus !== 'matched' || row?.providerConflict) return 'unknown';
  if (field?.state === 'reported' && Array.isArray(field.ukrainian) && field.ukrainian.some(locale => ukrainian(locale?.language))) return 'reported';
  if (ukrainian(field?.language) && field.state === 'reported-positive') return 'reported';
  if (ukrainian(field?.language) && field.state === 'reported-negative') return 'negative';
  return 'unknown';
}

function bandFor(row) {
  if (!eligible(row)) return 'withheld';
  if (row.country !== 'UA') return 'supplemental';
  if (languageState(row, 'audio') === 'reported') return 'ua-audio';
  if (['unknown', 'negative'].includes(languageState(row, 'audio')) && languageState(row, 'subtitles') === 'reported') return 'ua-subtitles';
  return 'ua';
}

// Returns the original row objects; equal evidence keeps the supplied source
// order, without price/quality assumptions or changes to transfer eligibility.
export function rankMediaRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object').map((row, index) => ({ row, index }))
    .sort((a, b) => bands[bandFor(a.row)] - bands[bandFor(b.row)] || a.index - b.index).map(entry => entry.row);
}

// A group is a display container, never a combined offer. Its primary and every
// option are original rows, each retaining its own language, access and link.
// Unestablished identity/provider mappings cannot join a canonical platform.
export function groupMediaRows(rows) {
  const groups = [], canonical = new Map();
  for (const [index, row] of rankMediaRows(rows).entries()) {
    const known = row.identityStatus === 'matched' && !row.providerConflict && Object.hasOwn(providers, row.provider?.key);
    if (!known) {
      groups.push({ key: `unresolved:${index}`, title: presentMediaRow(row).title, rows: [row], primary: row, readOnly: true });
      continue;
    }
    const key = row.provider.key;
    if (!canonical.has(key)) {
      const group = { key, title: providers[key], rows: [], primary: row, readOnly: false };
      canonical.set(key, group); groups.push(group);
    }
    canonical.get(key).rows.push(row);
  }
  return groups;
}

function sourceLabel(row) {
  const id = typeof row?.id === 'string' ? row.id : '';
  if (/(^|:)kinobaza:/.test(id) || row?.provenance?.source === 'Kinobaza HTML') return 'Кінобаза';
  if (/(^|:)motn:/.test(id) || row?.provenance?.source === 'Movie of the Night') return 'Movie of the Night';
  if (/(^|:)tmdb:/.test(id) || ['TMDB / JustWatch', 'TMDb / JustWatch'].includes(row?.provenance?.source)) return 'TMDb / JustWatch';
  return 'Джерело не вказано';
}

function languageLabel(row, key) {
  const subject = key === 'audio' ? 'Українське аудіо' : 'Українські субтитри';
  const state = languageState(row, key);
  if (state === 'reported') return `${subject}: вказано джерелом`;
  if (state === 'negative') return `${subject}: джерело повідомляє відсутність`;
  if (state === 'conflicting') return `${subject}: суперечливі дані`;
  if (row?.[key]?.state === 'not-listed-completeness-unknown') return `${subject}: не зазначено, повнота даних невідома`;
  return `${subject}: невідомо`;
}

function blockLabel(row, key) {
  const field = row?.kinobazaLocalization?.[key];
  if (!field) return null;
  const subject = key === 'audio' ? 'українське аудіо' : 'українські субтитри';
  if (field.state === 'reported-positive') return `Є згадка про ${subject}`;
  if (field.state === 'reported-negative') return `Зазначені українські ${key === 'audio' ? 'аудіодоріжки' : 'субтитри'} позначені як відсутні`;
  if (field.state === 'conflicting') return `Згадки про ${subject} суперечливі`;
  return `Не уточнено, чи є ${subject}`;
}

// Text labels are fixed vocabulary. Source details remain available separately;
// block labels deliberately cannot replace the row-bound audio/subtitle labels.
export function presentMediaRow(row) {
  const band = bandFor(row), warnings = [];
  if (row?.identityStatus !== 'matched') warnings.push('Відповідність фільму не підтверджено.');
  if (row?.providerConflict || !Object.hasOwn(providers, row?.provider?.key)) warnings.push('Платформу не вдалося однозначно визначити.');
  if (hasConflicts(row)) warnings.push('Джерело містить суперечливі дані.');
  if (row?.country !== 'UA') warnings.push(row?.country ? 'Цей варіант наведено для іншої країни.' : 'Країну доступу не встановлено.');
  if (row?.kinobazaLocalization) warnings.push('Для цієї пропозиції ще не перевірено.');
  if (row?.comparisons?.some(comparison => comparison.outcome === 'possible-discrepancy')) warnings.push('Повідомлення джерел різняться; пропозиції можуть відрізнятися.');
  return {
    title: Object.hasOwn(providers, row?.provider?.key) ? providers[row.provider.key] : 'Інша платформа', sourceLabel: sourceLabel(row), band,
    territoryLabel: row?.country === 'UA' ? 'Україна за даними джерела' : row?.country ? 'Інша країна' : 'Країну не встановлено',
    accessLabel: Object.hasOwn(accessLabels, value(row?.access)) ? accessLabels[value(row.access)] : 'Тип доступу невідомий',
    audioLabel: languageLabel(row, 'audio'), subtitlesLabel: languageLabel(row, 'subtitles'),
    blockAudioLabel: blockLabel(row, 'audio'), blockSubtitlesLabel: blockLabel(row, 'subtitles'), warnings,
  };
}

// At most two sentences. Priority describes source evidence, never entitlement,
// verified destination tracks, merged offers, or absence when sources are quiet.
export function summarizeMediaAdvice(resultOrRows, { variantName } = {}) {
  const rows = rankMediaRows(Array.isArray(resultOrRows) ? resultOrRows : resultOrRows?.rows);
  const first = rows.find(row => eligible(row));
  if (!first) return 'Поки не отримано узгоджених варіантів для вибору. Це не означає, що фільм недоступний.';
  const presented = presentMediaRow(first), band = presented.band;
  let variant = '';
  if (typeof variantName === 'function') {
    try {
      const label = variantName(first), match = typeof label === 'string' && /^варіант [1-9]\d{0,2}(?: \(([^()\r\n]{1,50})\))?$/iu.exec(label);
      if (match && (!match[1] || [...Object.values(accessLabels), 'Тип доступу невідомий'].some(access => access.toLowerCase() === match[1].toLowerCase()))) variant = `, ${label}`;
    } catch {} // Optional local display labels cannot change evidence or the answer.
  }
  const title = presented.title + variant;
  if (band === 'ua-audio') return `Спершу перегляньте ${title}: джерело вказує Україну та українське аудіо для цього варіанта. Перевірте доріжки й умови доступу на платформі.`;
  if (band === 'ua-subtitles') {
    const audio = languageState(first, 'audio') === 'negative' ? 'українське аудіо джерело позначає як відсутнє' : 'українське аудіо не підтверджене';
    return `Спершу перегляньте ${title}: джерело вказує Україну й українські субтитри, а ${audio}. Перевірте доріжки й умови доступу на платформі.`;
  }
  if (band === 'ua') return `Спершу перегляньте ${title}: джерело вказує Україну, але українське аудіо для цього варіанта не підтверджене. Перевірте мови й умови доступу на платформі.`;
  return `Є додаткова згадка про ${title}, але доступність в Україні не встановлено. Перевірте країну, мови й умови доступу на платформі.`;
}



// Presentation-only platform summary. Source rows remain unchanged for reporting.
const kinoSource = row => /(^|:)kinobaza:/.test(row?.id ?? '') || row?.provenance?.source === 'Kinobaza HTML';
const normalizedLabel = name => typeof name === 'string' ? name.normalize('NFC').trim().toLowerCase() : null;
const boundaryIssues = new Set(['ambiguous-provider-block', 'unsupported-provider-block', 'provider-block-count-limit', 'block-field-count-limit']);
function ownKinobazaBlock(row, filmId) {
  const block = row?.kinobazaLocalization;
  return row?.identityStatus === 'matched' && !row.providerConflict && kinoSource(row) && Object.hasOwn(providers, row.provider?.key) &&
    (!filmId || row.filmId === filmId) && (!row.country || row.country === 'UA') && (!block?.territory?.code || block.territory.code === 'UA') &&
    /^kinobaza:block:\d+$/.test(block?.blockId ?? '') && row.linkAudit?.blockAssociation === 'associated' &&
    Boolean(normalizedLabel(row.provider?.sourceName)) && normalizedLabel(block.provider) === normalizedLabel(row.provider.sourceName) &&
    block.href === row.link?.href && classifyLink(row.link?.href, row.provider).transferable &&
    (block.issues === undefined || Array.isArray(block.issues)) && !(block.issues ?? []).some(issue => boundaryIssues.has(issue));
}
function blockLanguage(rows, key) {
  const fields = rows.map(row => row.kinobazaLocalization[key]).filter(Boolean);
  if (fields.some(field => field.state === 'conflicting')) return 'conflicting';
  const positives = fields.filter(field => field.state === 'reported-positive'), negatives = fields.filter(field => field.state === 'reported-negative');
  const labels = new Map();
  for (const field of [...positives, ...negatives]) {
    // An unexplained positive/negative disagreement is not a format mapping.
    if (!Array.isArray(field.evidence) || !field.evidence.length) {
      if (positives.length && negatives.length) return 'conflicting';
      continue;
    }
    for (const e of field.evidence) {
      if (!e || typeof e !== 'object') return 'conflicting';
      if (!['positive', 'negative'].includes(e.state)) continue;
      const label = normalizedLabel(e.label); if (!label) return 'conflicting';
      if (labels.has(label) && labels.get(label) !== e.state) return 'conflicting';
      labels.set(label, e.state);
    }
  }
  return positives.length ? 'reported-positive' : negatives.length ? 'reported-negative' : 'unknown';
}
function kinoLanguageLabel(state, key) {
  const subject = key === 'audio' ? 'Українське аудіо' : 'Українські субтитри';
  if (state === 'reported-positive') return `${subject} — за даними Кінобази`;
  if (state === 'reported-negative') return key === 'audio' ? `${subject}: «−» для зазначених доріжок — за даними Кінобази` : `${subject}: позначено «−» Кінобазою`;
  if (state === 'conflicting') return `${subject}: суперечливі дані Кінобази`;
  return `${subject}: невідомо`;
}
function comparisonAvailability(rows, kinoRows) {
  const matched = rows.filter(row => row.identityStatus === 'matched' && !row.providerConflict && Object.hasOwn(providers, row.provider?.key));
  // The regional interpretation of a Kinobaza block is never promoted to an
  // independently returned UA availability observation.
  if (matched.some(row => !kinoSource(row) && row.country === 'UA')) return { state: 'reported', symbol: '●', label: 'Джерело вказує варіант для України; фактичну доступність не перевірено' };
  if (kinoRows.length) return { state: 'partial', symbol: '◐', label: 'Неповні дані сервісу Кінобази; український регіон враховано за правилом застосунку, доступність не перевірено' };
  if (matched.length && matched.every(row => row.country && row.country !== 'UA')) return { state: 'foreign', symbol: '◇', label: 'Джерела вказують іншу країну; доступність в Україні невідома' };
  return { state: 'unknown', symbol: '?', label: 'Доступність в Україні невідома' };
}
function comparisonLanguage(rows, kinoRows, key) {
  const subject = key === 'audio' ? 'Українське аудіо' : 'Українські субтитри';
  const observations = [];
  for (const row of rows) {
    // Preserve a field-specific warning even where a record's region/block
    // scope is unestablished. It cannot supply a positive track or UA context.
    if (row.identityStatus === 'matched' && !row.providerConflict && Object.hasOwn(providers, row.provider?.key) && !row.country && !kinoRows.includes(row) && languageState(row, key) === 'conflicting') {
      observations.push({ state: 'conflicting', source: 'unknown-scope' });
    }
    // A foreign/unknown-country offer cannot borrow UA from another record.
    if (row.identityStatus !== 'matched' || row.providerConflict || row.country !== 'UA' || kinoSource(row)) continue;
    const state = languageState(row, key);
    if (state === 'conflicting') observations.push({ state, source: 'ua-row' });
    else if (eligible(row) && ['reported', 'negative'].includes(state)) observations.push({ state, source: 'ua-row' });
  }
  const kinoState = blockLanguage(kinoRows, key);
  if (kinoState !== 'unknown') {
    const negatives = kinoRows.map(row => row.kinobazaLocalization[key]).filter(field => field?.state === 'reported-negative');
    const namedFormatOnly = key === 'audio' && negatives.length > 0 && negatives.every(field => Array.isArray(field.evidence) && field.evidence.length > 0 &&
      field.evidence.filter(item => item?.state === 'negative').length > 0 && field.evidence.filter(item => item?.state === 'negative').every(item => typeof item.formatLiteral === 'string' && item.formatLiteral.trim()));
    observations.push({ state: kinoState === 'reported-positive' ? 'reported' : kinoState === 'reported-negative' ? namedFormatOnly ? 'format-negative' : 'negative' : 'conflicting', source: 'kinobaza-block' });
  }
  const sources = [...new Set(observations.map(item => item.source))];
  const positive = observations.some(item => item.state === 'reported');
  const negative = observations.some(item => ['negative', 'format-negative'].includes(item.state));
  const conflict = observations.some(item => item.state === 'conflicting');
  const mixed = positive && (negative || conflict);
  const state = mixed ? 'mixed' : conflict ? 'conflicting' : positive ? 'reported' : observations.some(item => item.state === 'negative') ? 'negative' : observations.some(item => item.state === 'format-negative') ? 'format-negative' : 'unknown';
  const source = sources.length === 1 && sources[0] === 'kinobaza-block' ? 'за даними Кінобази для цього сервісу; український регіон — правило застосунку' : 'за окремими записами джерел у контексті України';
  let symbol = '?', label = `${subject}: невідомо; незгадана мова не означає її відсутності`;
  if (state === 'reported') { symbol = '+'; label = `${subject}: джерело повідомляє наявність, ${source}; доріжку конкретної пропозиції не гарантуємо`; }
  if (state === 'negative') { symbol = '−'; label = `${subject}: джерело явно позначає відсутність у зазначеному записі, ${source}; це не висновок про всі пропозиції`;
  }
  if (state === 'format-negative') label = `${subject}: зазначені формати позначено як відсутні, але наявність інших українських доріжок невідома`;
  if (state === 'mixed') { symbol = '±'; label = `${subject}: в одному записі є позитивні дані, інші записи відрізняються або суперечливі; це можуть бути різні пропозиції`;
  }
  if (state === 'conflicting') { symbol = '±'; label = `${subject}: суперечливі дані; це не означає відсутність доріжки`;
  }
  if (sources.includes('unknown-scope') && state === 'conflicting') label = `${subject}: суперечливі дані з невстановленою країною або областю застосування; це не означає відсутність доріжки`;
  if (sources.includes('unknown-scope') && state === 'mixed') label = `${subject}: є позитивний запис для України та суперечлива згадка з невстановленою країною або областю застосування; записи не об'єднано в одну пропозицію`;
  return { state, symbol, label, sources };
}
export function presentMediaGroup(group, { filmId } = {}) {
  const rows = (group?.rows ?? []).filter(row => !filmId || row.filmId === filmId);
  const safe = rows.filter(eligible);
  const linked = safe.filter(r => classifyLink(r.link?.href, r.provider).transferable);
  const explicitFilms = new Set(rows.map(row => row.filmId).filter(id => typeof id === 'string' && id));
  const scope = filmId ?? (explicitFilms.size === 1 ? [...explicitFilms][0] : null);
  // This is the owner's M4 region interpretation, not a mutation of source
  // country/offer fields or a join to another service's/film's language block.
  const kinoRows = explicitFilms.size > 1 && !filmId ? [] : rows.filter(row => ownKinobazaBlock(row, scope));
  const kinoAudio = blockLanguage(kinoRows, 'audio'), kinoSubtitles = blockLanguage(kinoRows, 'subtitles');
  const inferredAudio = kinoAudio === 'reported-positive', inferredSubtitles = kinoSubtitles === 'reported-positive';
  const inferred = kinoRows.length > 0 && [kinoAudio, kinoSubtitles].some(state => state !== 'unknown');
  const policyBand = inferredAudio ? 'ua-audio' : inferredSubtitles ? 'ua-subtitles' : inferred ? 'ua' : 'withheld';
  const base = safe[0] ?? rows[0];
  const policyRow = kinoRows.find(row => inferredAudio && row.kinobazaLocalization.audio?.state === 'reported-positive' || !inferredAudio && inferredSubtitles && row.kinobazaLocalization.subtitles?.state === 'reported-positive') ?? kinoRows[0];
  const transferRow = (inferred && policyRow) || linked.find(r => classifyLink(r.link?.href, r.provider).kind === 'exact-card-unverified') || linked[0] || base;
  const evidence = inferred ? policyRow : base;
  const band = bands[bandFor(base)] < bands[policyBand] ? bandFor(base) : inferred ? policyBand : bandFor(base);
  const accesses = [...new Set(safe.filter(r => r.country === 'UA').map(r => value(r.access)).filter(Boolean).map(v => accessLabels[v]).filter(Boolean))];
  const access = accesses.length ? accesses.join(' / ') : presentMediaRow(base).accessLabel;
  const audio = inferred ? kinoLanguageLabel(kinoAudio, 'audio') : languageLabel(evidence, 'audio');
  const subtitles = inferred ? kinoLanguageLabel(kinoSubtitles, 'subtitles') : languageLabel(evidence, 'subtitles');
  const languageSummary = inferredAudio && inferredSubtitles ? 'Українське аудіо та субтитри — за даними Кінобази' : null;
  const otherLanguageLabels = [];
  if (inferred && base.country === 'UA' && languageState(base, 'audio') === 'reported' && !inferredAudio) otherLanguageLabels.push('В іншому варіанті джерело вказує українське аудіо; умови можуть відрізнятися.');
  if (inferred && base.country === 'UA' && languageState(base, 'subtitles') === 'reported' && !inferredSubtitles) otherLanguageLabels.push('В іншому варіанті джерело вказує українські субтитри; умови можуть відрізнятися.');
  const unbound = !inferred && rows.find(r => eligible(r) && r.kinobazaLocalization);
  const unboundLabels = unbound ? [blockLabel(unbound, 'audio'), blockLabel(unbound, 'subtitles')].filter(Boolean) : [];
  const comparison = { availability: comparisonAvailability(rows, kinoRows), audio: comparisonLanguage(rows, kinoRows, 'audio'), subtitles: comparisonLanguage(rows, kinoRows, 'subtitles') };
  return { group, transferRow, band, access, audio, subtitles, inferred, inferredAudio, inferredSubtitles, unboundLabels, comparison,
    languageSummary, otherLanguageLabels, kinobaza: { applied: inferred, audio: kinoAudio, subtitles: kinoSubtitles, basis: 'matched-provider-block-app-ua-interpretation' },
    territory: inferred ? 'Український регіон — за правилом застосунку' : presentMediaRow(evidence).territoryLabel,
    warnings: [ ...presentMediaRow(evidence).warnings.filter(warning => !inferred || !['Країну доступу не встановлено.', 'Для цієї пропозиції ще не перевірено.'].includes(warning)),
      ...(inferred ? ['Це правило інтерпретації, не перевірка доступності на платформі.'] : []),
      ...(rows.some(hasConflicts) || [kinoAudio, kinoSubtitles].includes('conflicting') ? ['У джерелах є суперечливі дані.'] : []) ] };
}
export function presentMediaGroups(rows, { filmId } = {}) {
  const filmIds = new Set((Array.isArray(rows) ? rows : []).map(row => row?.filmId).filter(id => typeof id === 'string' && id));
  if (!filmId && filmIds.size > 1) return []; // No established single-film view context.
  const scoped = filmId ? (Array.isArray(rows) ? rows : []).filter(row => row?.filmId === filmId) : rows;
  return groupMediaRows(scoped).map((g, index) => ({ ...presentMediaGroup(g, { filmId }), index }))
    .sort((a,b) => comparisonCategory(a.band) - comparisonCategory(b.band) || (servicePriority[a.group.key] ?? 4) - (servicePriority[b.group.key] ?? 4) || a.index - b.index);
}
const comparisonCategory = band => band === 'ua-audio' ? 0 : band === 'ua-subtitles' ? 1 : band === 'withheld' ? 3 : 2;
export function summarizeMediaGroups(groups) {
  const choices = groups.filter(g => g.band !== 'withheld'), first = choices[0];
  if (!first) return 'Поки не знайшов підтверджених варіантів для вибору. Це не означає, що фільм недоступний.';
  const title = first.group.title;
  const lead = choices.length === 1 ? 'Знайшов один варіант.' : 'Знайшов кілька варіантів.';
  const caveat = 'Інформація не завжди точна, тож варто перевіряти.';
  const audio = first.comparison?.audio.state, subtitles = first.comparison?.subtitles.state;
  let advice;
  if (first.band === 'ua-audio' && audio === 'mixed') advice = `Я б перевірив ${title}: є згадка про українське аудіо, але дані різняться між варіантами.`;
  else if (first.band === 'ua-subtitles' && subtitles === 'mixed') advice = `Я б перевірив ${title}: є згадка про українські субтитри, але дані різняться між варіантами.`;
  else if (first.band === 'ua-audio') advice = `Мій вибір — ${title}: є дані про українське аудіо.`;
  else if (first.band === 'ua-subtitles') advice = `Я б почав із ${title}: є дані про українські субтитри, ${audio === 'conflicting' ? 'але щодо українського аудіо є суперечності' : 'а українське аудіо не підтверджене'}.`;
  else if (first.band === 'ua') advice = ['conflicting', 'mixed'].includes(audio) || ['conflicting', 'mixed'].includes(subtitles)
    ? `Можна перевірити ${title}, але дані про українські доріжки суперечливі.`
    : `Можна перевірити ${title}, але українські доріжки поки не підтверджені.`;
  else advice = `Є згадка про ${title}, але доступність в Україні поки не встановлена.`;
  return `${lead} ${advice} ${caveat}`;
}
