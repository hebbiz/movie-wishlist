// Page memory only. Never stores, submits, resolves URLs or rewrites source data.
import { buildShortReport, buildWorkflowReport, writeShortReport, relationText, sourceLabel, comparisonSummary } from './discovery-report.mjs';
const value = f => f?.state === 'reported' ? String(f.value) : `[${f?.state ?? 'unknown'}]`;
export function accessLabel(field) {
  const raw = field?.state === 'reported' ? field.value : undefined;
  const labels = { rent: 'Rental', rental: 'Rental', buy: 'Purchase', purchase: 'Purchase', flatrate: 'Subscription', subscription: 'Subscription', 'ad-supported': 'Ad-supported' };
  return Object.hasOwn(labels, raw) ? labels[raw] : 'Access unknown';
}
export function compactFields(row) {
  const known = [], unknown = [];
  for (const [key, label] of [['audio', 'UA audio'], ['subtitles', 'UA subtitles']]) {
    const claim = row.kinobazaLocalization?.[key];
    if (claim?.state === 'reported-positive') known.push(`${label} + (Kinobaza block)`);
    else if (claim?.state === 'reported-negative') known.push(`${label} − (named block labels only)`);
    else if (claim?.state === 'conflicting') known.push(`${label} CONFLICT (block)`);
    else if (row[key]?.ukrainian?.length) known.push(`${label} listed`); else unknown.push(label);
  }
  for (const [key, label] of [['quality', 'Video'], ['hdr10', 'HDR10'], ['dolbyVision', 'DV']]) {
    if (row[key]?.state === 'reported') known.push(`${label}: ${value(row[key])}`); else unknown.push(label);
  }
  if (row.price?.amount?.state === 'reported' && row.price?.currency?.state === 'reported') known.push(`${value(row.price.amount)} ${value(row.price.currency)} (source; unverified)`);
  else unknown.push('price');
  return { known, unknown };
}

export const needsLinkAcknowledgement = link => link?.kind === 'tracking-redirect' || link?.acknowledgementRequired === true;
export function linkPresentation(link) {
  const kind = link?.kind ?? 'missing';
  const allowedKind = ['exact-card-unverified', 'tracking-redirect'].includes(kind);
  const canOpen = allowedKind && link?.transferable === true && typeof link.href === 'string' && Boolean(link.href);
  if (canOpen) return { canOpen, summary: `Link: ${kind}${kind === 'tracking-redirect' ? ' — Tracking candidate — destination unverified' : link.referral === 'provider-native' ? ' — provider referral preserved; destination unverified' : ''}`,
    navigation: 'Navigation: explicit user-open only', draft: needsLinkAcknowledgement(link) ? 'Draft: acknowledgement required' : 'Draft: eligible candidate (unverified)' };
  const summary = kind === 'missing' ? 'Link: not reported' : kind === 'unsafe' ? 'Link: unsafe — withheld' : allowedKind ? 'Link: not eligible for transfer' : `Link: unsupported kind (${kind})`;
  return { canOpen: false, summary, navigation: kind === 'missing' ? 'Navigation: unavailable' : kind === 'unsafe' ? 'Navigation: blocked (unsafe)' : 'Navigation: disabled by demo URL policy', draft: 'Draft: not eligible for transfer' };
}

const platformNames = Object.freeze({ apple: 'Apple TV Store', rakuten: 'Rakuten TV', hbo: 'HBO Max', netflix: 'Netflix', prime: 'Prime Video', megogo: 'MEGOGO' });
export function groupProviderRows(rows) {
  const groups = new Map(), unmapped = [];
  for (const row of rows) {
    const key = row.provider?.key;
    if (!Object.hasOwn(platformNames, key) || row.provider.name !== platformNames[key]) { unmapped.push(row); continue; }
    if (!groups.has(key)) groups.set(key, { key, name: platformNames[key], rows: [] });
    groups.get(key).rows.push(row); // Same row references; no field/offer merging.
  }
  return { groups: [...groups.values()], unmapped };
}

export function providerSummary(rows) {
  const sources = new Map();
  for (const row of rows) {
    const name = row.provenance?.source ?? 'Source unknown';
    if (!sources.has(name)) sources.set(name, { count: 0, fields: new Set() });
    const source = sources.get(name); source.count++;
    if (row.access?.state === 'reported') source.fields.add('access');
    if (row.country === 'UA') source.fields.add('UA context');
    if (row.link?.href) source.fields.add('candidate href');
    if (row.kinobazaLocalization) source.fields.add('block localization');
    if (row.audio?.ukrainian?.length || row.subtitles?.ukrainian?.length) source.fields.add('listed tracks');
    if (row.quality?.state === 'reported') source.fields.add('video claim');
    if (row.price?.state === 'reported') source.fields.add('price claim');
  }
  return [...sources].map(([name, source]) => `${name}: ${source.count} separate row(s)${source.fields.size ? ` — ${[...source.fields].join(', ')}` : ''}`).join(' | ');
}

// Deterministic Ukrainian view only. No joins, source mutation or transport.
export function viewingAccess(field) {
  const labels = { rent: 'Оренда', rental: 'Оренда', buy: 'Купівля', purchase: 'Купівля',
    flatrate: 'Передплата', subscription: 'Передплата', 'ad-supported': 'З рекламою', free: 'Безплатно', addon: 'Додатковий пакет' };
  return field?.state === 'reported' && Object.hasOwn(labels, field.value) ? labels[field.value] : 'Тип доступу невідомий';
}
const viewingSource = source => ({ tmdb: 'TMDb / JustWatch', motn: 'MOTN', kinobaza: 'Кінобаза' })[source] ?? 'Джерело не встановлено';
const rowSource = row => viewingSource(row.id?.split(':')[0]);
export function viewingSourceState(source) {
  if (source.status === 'disabled-no-request') return 'вимкнено для цього сценарію';
  if (source.status === 'not-evaluated-missing-crosswalk') return 'не перевірялося — немає підтвердженого IMDb crosswalk';
  if (source.identity === 'mismatch') return 'суперечлива ідентифікація, записи приховано';
  if (source.status === 'no-ua-options') return 'варіантів для України не повідомлено';
  if (source.identity === 'matched' && ['ok', 'A: ok; B: ok'].includes(source.status)) return 'дані отримано';
  if (source.identity === 'matched') return 'дані неповні';
  return 'дані недоступні або ідентифікацію не встановлено';
}
export function viewingSummary(result) {
  const count = groupProviderRows(result.rows ?? []).groups.length;
  const partial = (result.sources ?? []).some(s => !['ok', 'A: ok; B: ok', 'no-ua-options', 'disabled-no-request'].includes(s.status) ||
    s.status !== 'disabled-no-request' && s.identity !== 'matched');
  return [count ? `Є варіанти для пошуку: ${count} ${count === 1 ? 'платформа' : count < 5 ? 'платформи' : 'платформ'}.`
    : 'Джерела не дали достатньо даних для варіантів.', partial
    ? 'Дані неповні: частина джерел недоступна або потребує уточнення; це не доводить відсутності фільму.'
    : count ? 'Це повідомлення джерел, не перевірка доступу у вашому акаунті.' : 'Це не означає, що фільм недоступний.'];
}
export function viewingLocalization(row) {
  const source = rowSource(row), block = row.kinobazaLocalization;
  return [['audio', 'українське аудіо'], ['subtitles', 'українські субтитри']].map(([key, label]) => {
    const state = block?.[key]?.state;
    if (state === 'reported-positive') return `Кінобаза вказує ${label}; для цієї пропозиції ще не перевірено.`;
    if (state === 'reported-negative') return `Кінобаза: ${label} — «−» у цьому блоці, не висновок про всі пропозиції.`;
    if (state === 'conflicting') return `Кінобаза: позначки «${label}» у цьому блоці суперечливі.`;
    if (block) return `Кінобаза: ${label} — невідомо.`;
    return `${source}: ${label} ${row[key]?.ukrainian?.length ? 'зазначено у списку джерела' : '— невідомо'}.`;
  });
}
export function viewingWarnings(row) {
  return [row.conflicts?.length ? 'Суперечливі позначки в джерелі — дивіться деталі.' : '',
    row.comparisons?.some(c => c.outcome === 'possible-discrepancy') ? 'Є можлива розбіжність характеристик; чи це та сама пропозиція — невідомо.' : '',
    row.comparisons?.some(c => c.outcome === 'non-comparable') ? 'Ці записи не можна прямо порівнювати за наявними даними.' : ''].filter(Boolean);
}
export function viewingLink(link) {
  if (linkPresentation(link).canOpen) return needsLinkAcknowledgement(link)
    ? 'Параметри переходу збережено; для перенесення в чернетку потрібна ваша згода.'
    : 'Посилання надане джерелом; відкриється лише після натискання.';
  return ({ missing: 'Джерело не надало посилання.', unsafe: 'Небезпечну адресу приховано; відкриття й перенесення заблоковано.',
    search: 'Це пошукове посилання, а не картка фільму.', relative: 'Адреса відносна; відкриття й перенесення не підтримуються.',
    'tmdb-watch-page': 'Це сторінка каталогу, не пряма картка платформи.' })[link?.kind] ?? 'Цей формат посилання не підтримується для відкриття й перенесення.';
}

export function prepareDraft(result, row, trackingAcknowledged = false) {
  if (!result.rows.includes(row) || row.identityStatus !== 'matched') throw new Error('Select an independently identity-gated row.');
  const ids = { coherence: 'tt2866360', 'dune-part-two': 'tt15239678',
    'kingdom-of-heaven': 'tt0320661', 'the-thing-1982': 'tt0084787', 'the-thing-2011': 'tt0905372', parasite: 'tt6751668' };
  const years = { coherence: '2013', 'dune-part-two': '2024', 'kingdom-of-heaven': '2005', 'the-thing-1982': '1982', 'the-thing-2011': '2011', parasite: '2019' };
  const dynamic = result.dynamic === true && result.film.dynamic === true && Number.isSafeInteger(result.film.tmdbId) && result.film.tmdbId > 0 &&
    result.film.id === `tmdb:${result.film.tmdbId}` && row.filmId === result.film.id &&
    (result.film.imdbId === null || /^tt\d{1,20}$/.test(result.film.imdbId)) && typeof result.film.title === 'string' && result.film.title.length <= 180;
  if (!Object.hasOwn(ids, result.film.id) && !dynamic) throw new Error('Validated draft film required.');
  const imdbId = dynamic ? result.film.imdbId : ids[result.film.id];
  const acknowledgementRequired = needsLinkAcknowledgement(row.link);
  const purchaseURL = linkPresentation(row.link).canOpen && (!acknowledgementRequired || trackingAcknowledged) ? row.link.href : '';
  return { fields: { imdb_url: imdbId ? `https://www.imdb.com/title/${imdbId}/` : '',
    title: result.film.title.replace(/ \(\d{4}\)$/, ''), year: dynamic ? Number.isInteger(result.film.year) ? String(result.film.year) : '' : years[result.film.id],
    recommended_medium: row.provider.medium, purchase_url: purchaseURL, status: 'wishlist' },
    sidecar: { rowId: row.id, source: row.provenance, provider: row.provider, linkKind: row.link.kind, linkAudit: row.linkAudit ?? null,
      linkPolicy: { originalURL: row.link.href, referral: row.link.referral ?? null, acknowledgementRequired, acknowledged: acknowledgementRequired && trackingAcknowledged }, territory: row.country ?? 'unknown',
      kinobazaLocalization: row.kinobazaLocalization ?? null, countrySignal: row.countrySignal ?? null,
      access: row.access, package: row.package, cut: row.cut, identity: row.identityStatus,
      commonIdentity: result.identity.status, conflicts: row.conflicts, comparisons: row.comparisons ?? [],
      titleBasis: dynamic ? 'User-confirmed TMDb selected identity; reported release year, not provider edition/cut. Missing IMDb stays blank.' : 'Fixed verified film catalogue; original film year, not inferred regional release year.',
      availability: row.availability, accountEntitlement: 'unknown',
      excluded: ['Price/currency (including anomalies), audio, subtitles, video, ownership/account/group fields and all unreported characteristics.'] } };
}

export async function mountDiscovery(document, initial, { signal, fetchImpl = fetch, onFixedChange } = {}) {
  const el = id => document.getElementById(id), button = el('run');
  let session = initial, result = null, reviewRow = null, loading = false;
  let generation = 0, reportReady = false, reportFailed = false, receivedAt = null;
  let workflowReport = null;
  const emptyDraftState = () => ({ present: false, confirmed: false, edited: false, selectionCancelled: false, cleared: false });
  let draftState = emptyDraftState();
  const used = new Set();
  let requestController;
  const add = (host, tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; host.append(n); return n; };
  document.documentElement.lang = 'uk';
  el('answer').classList.add('discovery-ui');
  el('film').textContent = 'Микола · варіанти перегляду';
  el('director').textContent = 'Дані джерел для вашого вибору.';
  el('discovery').textContent = 'Україна · цифровий перегляд';
  el('mode').previousElementSibling.textContent = 'Research PoC, не основний Movie Wishlist.';
  el('retrieval-mode').textContent = `DEMO_RETRIEVAL=ua-discovery · Kinobaza ${session.kinobaza}`;
  el('settings').textContent = `${session.sources.join(' + ')} · max ${session.requestBudget} HTTP requests/film (${session.baseRequestBudget} without redirect) · no retries, LLM or storage`;
  el('mode').textContent = session.mode === 'synthetic' ? 'SYNTHETIC ONLY · Вигадані дані, без зовнішніх запитів і реальних пропозицій.' : 'LIVE · Запит лише після натискання; умови використання джерел залишаються окремим обмеженням.';
  el('operation-label').textContent = 'Технічні налаштування й межі запитів';
  el('operation-label').parentElement.append(el('retrieval-mode'), el('settings'));
  el('prompt').textContent = session.operation;
  el('service-notice').textContent = 'Невідоме не означає відсутнє. Чернетка — лише в пам’яті цієї сторінки.';
  el('prompt').parentElement.open = false;
  el('service-terms').href = 'https://www.themoviedb.org/api-terms-of-use'; el('service-terms').textContent = 'Умови TMDb';
  el('provider-docs').href = 'https://developers.movieofthenight.com/terms-and-conditions'; el('provider-docs').textContent = 'Умови MOTN';
  el('result-heading').textContent = 'Де шукати фільм';
  el('result').setAttribute('aria-label', 'Варіанти з джерел і локальна чернетка');
  const pickerHost = document.createElement('p'); pickerHost.className = 'discovery-ui';
  const pickerLabel = add(pickerHost, 'label', 'Фільм'); const picker = add(pickerLabel, 'select'); picker.id = 'discovery-film';
  for (const film of session.films) { const option = add(picker, 'option', film.title); option.value = film.id; }
  picker.value = session.film.id; button.before(pickerHost);
  const requestDetails = add(pickerHost, 'details'); add(requestDetails, 'summary', 'Заплановані запити — без ключів'); const planned = add(requestDetails, 'pre');
  const chosen = add(pickerHost, 'p'); chosen.id = 'discovery-chosen';
  const syncChoice = () => {
    el('retrieval-mode').textContent = `DEMO_RETRIEVAL=ua-discovery · Kinobaza ${session.kinobaza}`;
    el('settings').textContent = `${session.sources.join(' + ')} · max ${session.requestBudget} HTTP requests/film (${session.baseRequestBudget} without redirect) · no retries, LLM or storage`;
    el('prompt').textContent = session.operation;
    chosen.textContent = `${session.film.title} · ${session.film.director} · Україна · ліміт ${session.requestBudget} запитів`;
    planned.textContent = [...session.plannedRequests, ...(session.conditionalRequests ?? []).map(url => `Conditional canonical GET only after validated redirect: ${url}`)].join('\n');
    button.disabled = session.dynamicSelection || loading || used.has(session.film.id); button.textContent = session.dynamicSelection ? 'Довільний фільм — керування в блоці пошуку' : used.has(session.film.id) ? 'Запит уже виконано — оберіть інший фільм' : 'Знайти варіанти';
  };
  const panes = add(el('result'), 'div'); panes.className = 'discovery-ui';
  const review = add(panes, 'section'); review.id = 'draft-review'; review.hidden = true;
  const draft = add(panes, 'section'); draft.id = 'local-draft'; draft.hidden = true;
  const report = add(panes, 'section'); report.id = 'short-report';
  const copy = add(report, 'button', 'Скопіювати короткий звіт'); copy.id = 'report-copy'; copy.type = 'button'; copy.disabled = true;
  const reportStatus = add(report, 'p'); reportStatus.id = 'report-status'; reportStatus.setAttribute('role', 'status');
  const fallback = add(report, 'div'); fallback.id = 'report-fallback'; fallback.hidden = true;
  const label = add(fallback, 'label', 'Короткий звіт — можна виділити й скопіювати вручну');
  const reportText = add(label, 'textarea'); reportText.id = 'report-text'; reportText.readOnly = true; reportText.rows = 12;
  const selectText = add(fallback, 'button', 'Виділити текст звіту'); selectText.type = 'button';
  selectText.addEventListener('click', () => { reportText.focus(); reportText.select(); });
  add(report, 'p', 'Після копіювання звіт може залишитися в буфері пристрою. Без ключів, повних відповідей і вмісту чернетки.');
  const resetReport = () => { generation++; workflowReport = null; reportReady = false; copy.disabled = true; reportStatus.textContent = ''; reportText.value = ''; fallback.hidden = true; };
  copy.addEventListener('click', async () => {
    if (!reportReady || loading || copy.disabled) return;
    const at = generation;
    const text = workflowReport ? buildWorkflowReport(workflowReport) : buildShortReport({ filmId: session.film.id, mode: session.mode, receivedAt, result, failed: reportFailed, draft: draftState });
    copy.disabled = true; reportStatus.textContent = 'Копіюю…'; fallback.hidden = true;
    const outcome = await writeShortReport(text, document.defaultView.navigator);
    if (at !== generation || signal?.aborted) return;
    copy.disabled = false;
    if (outcome === 'copied') { reportStatus.textContent = 'Короткий звіт скопійовано.'; reportText.value = ''; }
    else { reportText.value = text; fallback.hidden = false; reportStatus.textContent = 'Буфер обміну недоступний або доступ заборонено. Виділіть текст і скопіюйте вручну.'; }
  });
  const hideReview = () => { review.replaceChildren(); review.hidden = true; reviewRow = null; };
  const showDraft = prepared => {
    draft.replaceChildren(); draft.hidden = false;
    draftState = { ...emptyDraftState(), present: true, confirmed: true };
    add(draft, 'h3', 'Локальна чернетка — можна редагувати');
    add(draft, 'p', 'Лише в пам’яті цієї сторінки. У Movie Wishlist нічого не записано.');
    const form = add(draft, 'form'); form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('input', () => { draftState.edited = true; });
    for (const [name, text] of Object.entries(prepared.fields)) {
      const labels = { imdb_url: 'IMDb', title: 'Назва', year: 'Рік', recommended_medium: 'Носій / платформа', purchase_url: 'Посилання', status: 'Статус' };
      const label = add(form, 'label', labels[name] ?? name); const input = add(label, 'input'); input.name = name; input.value = text;
      if (name === 'status') input.readOnly = true;
    }
    const details = add(draft, 'details'); add(details, 'summary', 'Походження даних і виключені поля'); add(details, 'pre', JSON.stringify(prepared.sidecar, null, 2));
    const clear = add(draft, 'button', 'Очистити чернетку'); clear.type = 'button'; clear.id = 'draft-clear';
    clear.addEventListener('click', () => { draft.replaceChildren(); draft.hidden = true; draftState = { ...emptyDraftState(), cleared: true }; });
  };
  const select = row => {
    hideReview(); reviewRow = row; review.hidden = false;
    add(review, 'h3', `${row.provider.name} · ${rowSource(row)} · ${viewingAccess(row.access)}`);
    add(review, 'p', 'Перегляньте поля перед підтвердженням. Попередня чернетка зміниться лише після вашої згоди; це не запис у Movie Wishlist.');
    const included = add(review, 'pre'); included.id = 'draft-included';
    const evidence = add(review, 'details'); add(evidence, 'summary', 'Виключені поля й походження даних'); const sidecar = add(evidence, 'pre');
    let tracking;
    if (needsLinkAcknowledgement(row.link)) {
      const label = add(review, 'label'); tracking = add(label, 'input'); tracking.type = 'checkbox'; tracking.id = 'draft-tracking-ack';
      label.append(document.createTextNode(` Погоджуюся перенести ${row.link.kind === 'tracking-redirect' ? 'посилання з невстановленим кінцевим переходом' : 'посилання з партнерськими параметрами'} без змін. Кінцева картка й доступ у моєму акаунті не перевірені.`));
    }
    const refresh = () => { const prepared = prepareDraft(result, row, tracking?.checked ?? false); included.textContent = JSON.stringify(prepared.fields, null, 2); sidecar.textContent = JSON.stringify(prepared.sidecar, null, 2); };
    tracking?.addEventListener('change', refresh); refresh();
    const linkStatus = linkPresentation(row.link);
    add(review, 'p', viewingLink(row.link));
    add(evidence, 'p', `${linkStatus.summary} · ${linkStatus.navigation} · ${linkStatus.draft}. ${row.link.transferable ? 'Exact URL/type/provenance retained.' : 'purchase_url stays empty; no substitute URL.'}`);
    const confirm = add(review, 'button', 'Підтвердити в чернетку'); confirm.id = 'draft-confirm'; confirm.type = 'button';
    confirm.addEventListener('click', () => { const prepared = prepareDraft(result, reviewRow, tracking?.checked ?? false); showDraft(prepared); hideReview(); });
    const cancel = add(review, 'button', 'Скасувати вибір'); cancel.type = 'button'; cancel.id = 'draft-review-cancel'; cancel.addEventListener('click', () => { draftState.selectionCancelled = true; hideReview(); });
  };
  const render = data => {
    const host = el('answer'); host.replaceChildren();
    if (data.synthetic) add(host, 'p', 'SYNTHETIC ONLY · Усі наведені дані вигадані, не результат перевірки платформ.').className = 'notice';
    const intro = add(host, 'p', viewingSummary(data).join(' ')); intro.id = 'mykola-summary';
    add(host, 'p', data.sources.map(s => `${viewingSource(s.source)}: ${viewingSourceState(s)}`).join(' · ')).className = 'viewing-source-status';
    if (data.identity.conflicts.length) add(host, 'p', 'Джерела суперечать одне одному щодо фільму; відповідні записи приховано.').className = 'viewing-warning';
    const technical = add(host, 'details'); technical.id = 'discovery-source-details'; add(technical, 'summary', 'Джерела, ідентифікація й технічні деталі');
    if (data.identity.conflicts.length) add(technical, 'p', `Identity: ${data.identity.status}. Conflicting stable IDs: ${data.identity.conflicts.join(', ')}. Affected source withheld; no common identity.`);
    add(technical, 'p', `HTTP calls: ${data.metrics.requestsMade}/${data.metrics.requestBudget} · elapsed ${data.metrics.elapsedMs}ms (not a cost estimate)`);
    const sourceSummary = add(technical, 'p'); sourceSummary.id = 'discovery-source-status';
    sourceSummary.textContent = data.sources.map(s => s.status === 'disabled-no-request' ? `${s.source}: not evaluated — ${data.dynamic ? 'dynamic M3.1 scope' : 'disabled by scenario'}` : `${s.source}: ${s.status} · identity ${s.identity}`).join(' | ');
    const subjects = add(technical, 'details'); subjects.id = 'matching-subjects'; add(subjects, 'summary', 'A — source film identity evidence');
    for (const s of data.matching?.subjects ?? []) add(subjects, 'p', `${sourceLabel(s.source)}: ${relationText(s)}${s.yearVariance ? ' · Year variance retained; reason not inferred.' : ''}`);
    const matches = new Map((data.matching?.rows ?? []).map(m => [m.rowId, m]));
    if (data.filmLocalization?.ukrainianAudio?.state === 'reported-positive') add(host, 'p', 'Кінобаза має загальну позначку українського аудіо для фільму — це не перелік доріжок на платформі.').className = 'film-localization';
    const grouped = groupProviderRows(data.rows);
    for (const group of grouped.groups) {
      const section = add(host, 'section'); section.className = 'provider-group'; section.dataset.provider = group.key;
      add(section, 'h3', group.name);
      const counts = new Map(); for (const row of group.rows) counts.set(rowSource(row), (counts.get(rowSource(row)) ?? 0) + 1);
      const summary = add(section, 'p', [...counts].map(([source, n]) => `${source}: ${n} ${n === 1 ? 'запис' : n < 5 ? 'записи' : 'записів'}`).join(' · ') + ' — показано окремо.'); summary.className = 'provider-summary';
      for (const row of group.rows) {
        const card = add(section, 'article'); card.className = 'discovery-card'; card.dataset.rowId = row.id;
        add(card, 'h4', `${rowSource(row)} · ${row.kind === 'candidate-link' ? 'Посилання-кандидат' : viewingAccess(row.access)}`);
        const scope = row.country === 'UA' ? 'Україна — за даними джерела' : 'Територія не встановлена';
        const optional = [row.package?.name?.state === 'reported' ? `Пакет: ${value(row.package.name)}` : '', row.cut?.state === 'reported' ? `Версія: ${value(row.cut)}` : ''].filter(Boolean).join(' · ');
        add(card, 'p', `${scope}${row.kind === 'candidate-link' ? ' · саме посилання не підтверджує доступність' : ''}${optional ? ` · ${optional}` : ''}`);
        add(card, 'p', viewingLocalization(row).join(' ') + (row.kinobazaLocalization ? ' Повнота списків невідома.' : '')).className = 'viewing-localization';
        const fields = compactFields(row);
        const comparison = comparisonSummary(row);
        const warning = viewingWarnings(row).join(' ');
        if (warning) add(card, 'p', warning).className = 'viewing-warning';
        const status = linkPresentation(row.link);
        add(card, 'p', viewingLink(row.link)).className = 'viewing-link-status';
        const details = add(card, 'details'); add(details, 'summary', 'Характеристики, обмеження й походження даних');
        if (fields.known.length) add(details, 'p', fields.known.join(' · '));
        add(details, 'p', `Unknown: ${fields.unknown.join(', ') || 'no missing summary fields'}${row.conflicts.length ? ' · CONFLICT — inspect details' : ''}${comparison ? ` · ${comparison}` : ''}`);
        add(details, 'p', `${status.summary} · ${status.navigation} · ${status.draft}`);
        const match = matches.get(row.id);
        if (match) {
          const summary = add(details, 'div'); summary.className = 'matching-summary';
          add(summary, 'span', `${row.provenance.source} · A: ${relationText(match.A)}.`);
          add(summary, 'span', `${row.provenance.source}${match.B.peer ? ` ↔ ${sourceLabel(match.B.peer.source)} (${match.B.peer.rowId})` : ''} · B: ${relationText(match.B)}.`);
          add(summary, 'span', 'Territory/access/version insufficient for enrichment. Separate rows; no localization transfer.');
          const why = add(details, 'details'); add(why, 'summary', 'A/B — reasons and missing scope'); add(why, 'pre', JSON.stringify(match, null, 2));
        }
        add(details, 'pre', JSON.stringify(row, null, 2));
        const actions = add(card, 'div'); actions.className = 'viewing-actions';
        if (status.canOpen) { const link = add(actions, 'a', 'Відкрити посилання'); link.href = row.link.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; }
        const button = add(actions, 'button', 'Обрати'); button.type = 'button';
        button.disabled = Boolean(match && (match.A.outcome !== 'compatible' || ['provider-id-conflict', 'provider-mapping-unresolved'].includes(match.B.reason)));
        button.addEventListener('click', () => select(row));
      }
    }
    if (data.unmapped.length || grouped.unmapped.length) {
      const section = add(host, 'section'); section.id = 'discovery-unmapped'; add(section, 'h3', 'Записи з невстановленою платформою');
      add(section, 'p', 'Частину записів не можна однозначно віднести до платформи; обрати їх у чернетку не можна.');
      const details = add(section, 'details'); add(details, 'summary', 'Джерельні назви, доступ і причини');
      for (const item of data.unmapped) add(details, 'p', `${item.source}: ${item.name ?? '(name not reported)'} · ${item.reason === 'provider-id-conflict' ? `provider ID conflict (${item.sourceId}) — unresolved; no canonical access or draft selection` : 'provider mapping unresolved; not assigned to a Store/subscription group'}.`);
      add(details, 'pre', JSON.stringify({ unmapped: data.unmapped, ungroupedRows: grouped.unmapped }, null, 2));
    }
    add(technical, 'pre', JSON.stringify({ diagnostics: data.sources.map(s => ({ source: s.source, diagnostics: s.diagnostics })), calls: data.metrics.calls, stages: data.stages, unmapped: data.unmapped, limits: data.limits }, null, 2)); host.append(technical);
  };
  const credits = add(panes, 'section'); credits.id = 'discovery-credits';
  const { renderTmdbCredits } = await import('./tmdb-display.mjs'); renderTmdbCredits(document, credits);
  credits.querySelector('h2').textContent = 'Джерела';
  const attribution = add(credits, 'p', 'Дані про варіанти перегляду: ');
  const motn = add(attribution, 'a', 'Streaming Availability API by Movie of the Night'); motn.href = 'https://www.movieofthenight.com/about/api'; motn.rel = 'noreferrer';
  const kino = add(credits, 'p', 'Посилання й позначки: Кінобаза. Її країнові секції можуть мати спільне походження з TMDb/JustWatch, не незалежне підтвердження. ');
  const terms = add(kino, 'a', 'Умови Кінобази'); terms.href = 'https://kinobaza.com.ua/terms'; terms.rel = 'noreferrer';
  picker.addEventListener('change', async () => {
    if (loading) return; loading = true; syncChoice(); picker.disabled = true;
    resetReport();
    result = null; hideReview(); draft.replaceChildren(); draft.hidden = true; draftState = emptyDraftState();
    el('answer').replaceChildren(); el('result').hidden = true; onFixedChange?.();
    try {
      const response = await fetchImpl(`/session?film=${encodeURIComponent(picker.value)}`, { cache: 'no-store', signal,
        ...(session.dynamic?.id ? { headers: { 'x-demo-page': session.dynamic.id } } : {}) });
      if (!response.ok) throw new Error('Fixed-film session unavailable.');
      session = await response.json(); result = null; hideReview(); draft.replaceChildren(); draft.hidden = true;
      onFixedChange?.(session.dynamic);
      draftState = emptyDraftState();
      el('answer').replaceChildren(); el('result').hidden = true;
    } catch { el('status').textContent = 'Не вдалося обрати фільм. Перезавантажте сторінку; запитів до джерел не було.'; button.disabled = true; return; }
    finally { loading = false; picker.disabled = false; }
    el('status').textContent = 'Фільм обрано. Запит до джерел — лише після натискання.'; syncChoice();
  });
  button.addEventListener('click', async () => {
    if (session.dynamicSelection || loading || used.has(session.film.id)) return;
    used.add(session.film.id); loading = true; picker.disabled = true; syncChoice();
    resetReport(); reportFailed = false;
    const at = generation; requestController = new AbortController();
    el('status').textContent = 'Шукаю варіанти один раз, без автоматичних повторів.';
    try {
      const response = await fetchImpl('/answer', { method: 'POST', headers: { 'x-demo-session': session.token }, cache: 'no-store', signal: signal ? AbortSignal.any([signal, requestController.signal]) : requestController.signal });
      const payload = await response.json(); if (!response.ok) throw new Error('Discovery failed.');
      if (signal?.aborted || at !== generation) return;
      result = payload.result; render(result); el('result').hidden = false;
      el('status').textContent = 'Готово. Перегляньте варіанти й обмеження; автоматичного повтору не буде.';
    } catch { if (!signal?.aborted && at === generation) { result = null; reportFailed = true; el('answer').replaceChildren(); el('result').hidden = false; el('status').textContent = 'Не вдалося отримати коректну відповідь. Автоматичного повтору не буде.'; } }
    finally { if (at === generation) { loading = false; picker.disabled = false; if (!signal?.aborted) { receivedAt = new Date().toISOString(); reportReady = true; copy.disabled = false; } syncChoice(); } }
  });
  document.defaultView.addEventListener('pagehide', () => { resetReport(); result = null; reviewRow = null; draftState = emptyDraftState(); panes.replaceChildren(); pickerHost.remove(); }, { once: true });
  syncChoice();
  return {
    beginDynamic() {
      requestController?.abort(); resetReport(); loading = false; picker.disabled = false;
      session = { ...session, dynamicSelection: true, film: { id: 'pending', title: 'Оберіть identity у блоці пошуку', director: 'не підтверджено' },
        kinobaza: 'off — not evaluated', sources: ['TMDb', 'Movie of the Night'], requestBudget: 6, baseRequestBudget: 6,
        plannedRequests: [], conditionalRequests: [], operation: 'M3.1 · search max2, preview max2, discovery max2; no retries/LLM/destinations. Kinobaza not evaluated.' };
      result = null; hideReview(); draft.replaceChildren(); draft.hidden = true; draftState = emptyDraftState();
      el('answer').replaceChildren(); el('result').hidden = true;
      if (!picker.querySelector('option[value=""]')) { const option = add(picker, 'option', 'Довільний фільм'); option.value = ''; option.disabled = true; }
      picker.value = ''; syncChoice();
    },
    presentDynamic(data) {
      workflowReport = null;
      session = { ...session, dynamicSelection: true, film: data.film, kinobaza: 'off — not evaluated for dynamic selections', sources: ['TMDb', 'Movie of the Night'],
        requestBudget: 6, baseRequestBudget: 6, plannedRequests: [], conditionalRequests: [], operation: 'M3.1: explicit search max2, preview max2, discovery max2; Details preview reused; Kinobaza not evaluated. No LLM, retries, destinations or storage.' };
      result = data; reportFailed = false; receivedAt = new Date().toISOString(); render(data); el('result').hidden = false;
      reportReady = true; copy.disabled = false; syncChoice();
    },
    presentWorkflowReport(data) { workflowReport = data; reportReady = true; copy.disabled = false; el('result').hidden = false; },
    beginAction() { resetReport(); },
    page() { return session.dynamic; },
  };
}
