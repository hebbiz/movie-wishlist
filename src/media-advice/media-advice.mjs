import { classifyLink } from '../../shared/media-advice/media-link-policy.mjs';
import { safeMediaReport, mediaSourceDetails } from './media-advice-report.mjs';
import { groupMediaRows, presentMediaGroup, presentMediaGroups, presentMediaRow, summarizeMediaGroups } from './media-advice-presentation.mjs';
import { groupLinkChoices, preferredAppleLinkChoice } from './media-advice-link-choices.mjs';
import { MEDIA_SERVICE_ICON_SOURCES, preloadMediaServiceIcons, watchMediaServiceIcon } from './media-advice-icons.mjs';

const media = Object.freeze({ apple: 'Apple TV / iTunes', appletvplus: 'Apple TV / iTunes', netflix: 'Netflix', hbo: 'HBO Max', prime: 'Prime Video', megogo: 'Megogo', rakuten: 'Rakuten TV' });
// Only repeated notice text is collapsed. The original observations, their
// distinct offers and URLs remain in the result and privileged source details.
export function otherPlatformLabels(rows) {
  const labels = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = typeof row?.name === 'string' ? row.name.normalize('NFC').replace(/\s+/gu, ' ').trim() : '';
    const label = name || 'назву не встановлено', key = label.toLowerCase();
    if (!labels.has(key)) labels.set(key, label);
  }
  return [...labels.values()];
}
// Old boolean capabilities permit advice only, never privileged pilot details.
export function normalizeMediaCapabilities(value) {
  const enabled = value === true || value?.mykola_media_advice === true;
  return { mykola_media_advice: enabled, mykola_media_advice_diagnostics: enabled && value?.mykola_media_advice_diagnostics === true };
}
export function transferFor(row) {
  if (row?.identityStatus !== 'matched' || row?.providerConflict || !Object.hasOwn(media, row?.provider?.key)) return null;
  const link = classifyLink(row.link?.href, row.provider);
  // M4's explicit open/apply actions need no extra referral acknowledgement.
  // The shared classification and the observed href itself remain untouched.
  return { medium: media[row.provider.key], url: link.transferable ? link.href : null, link };
}
// One navigation choice per established card pointer, not a merged offer.
// The representative URL/row stays original; all observations stay in diagnostics.
export function linkChoicesFor(info) {
  if (info?.group?.readOnly) return [];
  if (info?.group?.key === 'apple') {
    const choice = preferredAppleLinkChoice(info.group.rows, { preferredRow: info.transferRow });
    // One UI service, but not one combined offer: Store navigation keeps its
    // established preference and subscription choices retain their own rows.
    return [...(choice ? [choice] : []), ...groupLinkChoices(info.group.rows, { providerKey: 'appletvplus', preferredRow: info.transferRow })];
  }
  return groupLinkChoices(info?.group?.rows, { providerKey: info?.group?.key, preferredRow: info?.transferRow });
}
export function makePreview(row, form, { clearMissing = false } = {}) {
  const transfer = transferFor(row);
  if (!transfer || !transfer.url && form.purchase_url && !clearMissing) return null;
  return { rowId: row.id, before: { ...form }, after: { recommended_medium: transfer.medium, purchase_url: transfer.url ?? '' },
    linkKind: transfer.link.kind };
}
export function applyPreview(preview, current) {
  return preview && Object.keys(preview.before).every(k => current[k] === preview.before[k]) ? { ...preview.after } : null;
}
export function linkPreview(current, chosen) {
  if (chosen) return current === chosen ? 'Посилання вже додано' : current ? 'Посилання буде замінено.' : 'Посилання буде додано.';
  return current ? 'Посилання буде очищено лише після підтвердження.' : 'Придатного посилання немає.';
}

// Shared visual classes, private DOM/state. Never call another Mykola controller.
export function createMediaAdvice({ document: doc, entry, context, readForm, writeForm, capability, preparedEntry = () => false, cachedAvailability = false, discover, validateApply = capability, canApply = () => true, validateDiagnostics, renewContext, now = Date.now }) {
  const dialog = doc.createElement('dialog'); dialog.className = 'media-advice-dialog';
  dialog.setAttribute('aria-label', 'Поради носіїв від Миколи'); doc.body.append(dialog);
  let session = null, generation = 0, controller = null, capabilityGeneration = 0, selectionToken = null, refreshFlight = null, entryCheck = null, diagnosticCheck = null;
  let access = normalizeMediaCapabilities(false), diagnosticRevision = 0;
  let returnFocus, viewReturnFocus, scrollY = 0, freshnessTimer, chat, preview, diagnostics, notice, staleNotice;
  // View freshness only. The server's 30-minute action ledger is NOT extended.
  const freshnessMs = 30 * 60 * 1000;
  const key = c => c && JSON.stringify([c.userId, c.groupId, c.imdbId, c.listId ?? null, c.formSession, c.title ?? null, c.year ?? null]);
  const usable = c => c?.userId && /^tt\d{7,10}$/.test(c.imdbId ?? '') && c.formSession;
  const valid = () => session && key(context()) === session.key;
  const node = (tag, text) => { const e = doc.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
  function button(text, action) { const e = node('button', text); e.type = 'button'; e.addEventListener('click', action); return e; }
  function bubble(text, user = false) {
    const row = node('div'); row.className = user ? 'user-message-row' : 'mykola-message-row';
    const avatar = node('div', user ? 'Ви' : 'М'); avatar.className = user ? 'user-avatar' : 'mykola-avatar'; avatar.setAttribute('aria-hidden', 'true');
    const body = node('div'); body.className = user ? 'user-bubble' : 'mykola-bubble';
    if (text) body.append(node('p', text)); row.append(avatar, body); chat.append(row); return body;
  }
  function tell(text) { if (notice) { notice.textContent = text; notice.hidden = !text; } }
  function diagnosticBubble() {
    if (!access.mykola_media_advice_diagnostics || !chat || session?.loading || chat.querySelector('.media-advice-report-bubble')) return;
    const last = bubble('Якщо щось не зійшлося, тут є подробиці для пілоту.'); last.classList.add('media-advice-report-bubble'); last.append(button('Діагностичний звіт', showReport));
  }
  function updateAccess(value) {
    access = normalizeMediaCapabilities(value);
    if (!access.mykola_media_advice_diagnostics) {
      const reportWasOpen = diagnostics && !diagnostics.hidden;
      diagnostics?.replaceChildren();
      if (diagnostics) diagnostics.hidden = true;
      chat?.querySelector('.media-advice-report-bubble')?.closest('.mykola-message-row')?.remove();
      if (reportWasOpen && chat && !preview) { chat.hidden = false; if (dialog.open && valid()) dialog.scrollTop = session.chatScroll ?? 0; }
    } else diagnosticBubble();
    return access.mykola_media_advice;
  }
  function updateDisplayAccess(value) {
    // A cached global display hint is not a private diagnostics grant. Keep
    // the grant supplied by the last fresh result; report access is separately
    // checked on demand before any private content is inserted or copied.
    if (cachedAvailability && normalizeMediaCapabilities(value).mykola_media_advice) {
      return updateAccess({ mykola_media_advice: true, mykola_media_advice_diagnostics: access.mykola_media_advice_diagnostics });
    }
    return updateAccess(value);
  }
  function returnToChat(message) {
    selectionToken = null; preview?.remove(); preview = null;
    if (diagnostics) diagnostics.hidden = true;
    if (chat) chat.hidden = false;
    if (valid()) dialog.scrollTop = session.chatScroll ?? 0;
    tell(message ?? '');
    if (dialog.open && viewReturnFocus?.isConnected && !viewReturnFocus.closest('[hidden]')) viewReturnFocus.focus({ preventScroll: true });
  }
  function close() {
    selectionToken = null;
    if (preview) returnToChat();
    if (session) session.dialogScroll = dialog.scrollTop;
    dialog.close();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    doc.defaultView.scrollTo(0, scrollY);
  }
  function invalidate() {
    clearTimeout(freshnessTimer); selectionToken = null; generation++; capabilityGeneration++; diagnosticRevision++;
    diagnosticCheck?.controller.abort();
    controller?.abort(); controller = null; session = null; refreshFlight = entryCheck = diagnosticCheck = null; access = normalizeMediaCapabilities(false); entry.hidden = true;
    if (dialog.open) dialog.close(); dialog.replaceChildren(); chat = preview = diagnostics = notice = staleNotice = viewReturnFocus = null;
  }
  function markStale(timerElapsed = false) {
    if (!session || session.stale || session.startedAt === undefined || !timerElapsed && now() < session.startedAt + freshnessMs) return;
    session.stale = true; clearTimeout(freshnessTimer);
    // Cancel pending apply so a newly stale selection must be reviewed again.
    if (selectionToken) returnToChat('Дані вже не свіжі. Перевірте вибір повторно.');
    if (staleNotice) staleNotice.hidden = false;
    const refreshButton = dialog.querySelector('[data-media-refresh]');
    if (refreshButton) refreshButton.hidden = false;
    const report = diagnostics?.querySelector('textarea');
    if (report) report.value = reportText();
  }
  async function refresh() {
    const c = context();
    if (!usable(c)) return invalidate();
    if (session && session.key !== key(c)) invalidate();
    // This hint reveals only the entry, never grants dialog/diagnostics access.
    // In the integrated app this reads only a session-level availability hint;
    // neither opening a card nor opening advice performs film authorization.
    // Background refresh must not supersede a pending opening action.
    if (entryCheck?.key === key(c)) return;
    if (!session) entry.hidden = preparedEntry(c) !== true;
    if (refreshFlight?.key === key(c)) return refreshFlight.promise;
    markStale();
    if (selectionToken) returnToChat('Перевірте вибір повторно після оновлення доступу.');
    const check = ++capabilityGeneration;
    const flight = { key: key(c), promise: null };
    flight.promise = (async () => {
      try {
        const ok = await Promise.resolve().then(() => capability(c));
        if (check !== capabilityGeneration) return;
        if (key(context()) !== key(c) || !updateDisplayAccess(ok)) return invalidate();
        markStale(); entry.hidden = false;
      } catch { if (check === capabilityGeneration) invalidate(); }
      finally { if (refreshFlight === flight) refreshFlight = null; }
    })();
    refreshFlight = flight;
    return flight.promise;
  }
  async function renew() {
    if (!valid() || session.loading || session.renewing || !renewContext) return;
    const current = session, c = context(), epoch = generation; current.renewing = true;
    let ok = false; try { ok = await capability(c); } catch {}
    if (epoch !== generation || !valid() || current !== session || key(c) !== key(context())) return;
    if (!updateDisplayAccess(ok)) return invalidate();
    const next = renewContext();
    if (!next || key(next) !== key(context()) || ['userId', 'groupId', 'imdbId', 'listId', 'title', 'year'].some(k => (c[k] ?? null) !== (next[k] ?? null)) || next.formSession === c.formSession) return invalidate();
    clearTimeout(freshnessTimer); generation++; controller?.abort(); selectionToken = null;
    session = { context: { ...next }, key: key(next), used: false, result: null };
    // Explicit refresh alone creates a new bounded ledger action. Server rate,
    // identity, authorization, reservation, deadlines and caps remain in force.
    await run();
  }
  const rowsFor = () => [...(session.result?.rows ?? []), ...(session.choice?.rows ?? [])];
  const filmLocalizationFor = () => session.choice?.filmLocalization ?? session.result?.filmLocalization;
  const reportText = () => safeMediaReport({ ...session.result, rows: rowsFor(), unmapped: [...(session.result?.unmapped ?? []), ...(session.choice?.unmapped ?? [])], filmLocalization: filmLocalizationFor() }, { applied: session.applied, filmContext: session.runContext, stale: session.stale === true });
  async function verifyDiagnostics() {
    if (!validateDiagnostics) return access.mykola_media_advice_diagnostics;
    if (!valid() || !dialog.open) return false;
    if (diagnosticCheck?.session === session) return diagnosticCheck.promise;
    const epoch = generation, reportEpoch = diagnosticRevision, current = session;
    const flight = { session: current, controller: new AbortController(), promise: null };
    flight.promise = Promise.resolve().then(() => validateDiagnostics(current.context, { signal: flight.controller.signal })).then(value => {
      if (epoch !== generation || reportEpoch !== diagnosticRevision || current !== session || !valid() || !dialog.open) return false;
      if (!updateAccess(value)) { invalidate(); return false; }
      return access.mykola_media_advice_diagnostics;
    }, () => {
      if (epoch === generation && reportEpoch === diagnosticRevision && current === session && valid()) updateAccess({ mykola_media_advice: true, mykola_media_advice_diagnostics: false });
      return false;
    }).finally(() => { if (diagnosticCheck === flight) diagnosticCheck = null; });
    diagnosticCheck = flight;
    return flight.promise;
  }
  async function showReport() {
    if (!valid()) return invalidate();
    if (!access.mykola_media_advice_diagnostics) return;
    if (validateDiagnostics && !await verifyDiagnostics()) return;
    if (!valid() || !dialog.open || !access.mykola_media_advice_diagnostics) return;
    markStale(); selectionToken = null; session.chatScroll = dialog.scrollTop;
    viewReturnFocus = doc.activeElement;
    diagnostics.replaceChildren(node('h3', 'Діагностичний звіт'), node('p', 'Лише для пілоту. Звіт нікуди не надсилається автоматично.'), button('← До порад', () => returnToChat()));
    const text = node('textarea'); text.readOnly = true; text.value = reportText(); text.setAttribute('aria-label', 'Короткий звіт для копіювання'); text.rows = 14;
    const status = node('p'); status.setAttribute('role', 'status');
    diagnostics.append(button('Скопіювати короткий звіт', async () => {
      if (!valid()) return invalidate();
      if (!access.mykola_media_advice_diagnostics) return;
      if (validateDiagnostics && !await verifyDiagnostics()) return;
      if (!valid() || !dialog.open || !access.mykola_media_advice_diagnostics) return;
      markStale(); const report = reportText(); text.value = report;
      const epoch = generation, current = session;
      try {
        if (!doc.defaultView.navigator.clipboard?.writeText) throw Error();
        await doc.defaultView.navigator.clipboard.writeText(report);
        if (epoch === generation && current === session && valid() && access.mykola_media_advice_diagnostics) status.textContent = 'Короткий звіт скопійовано.';
      } catch {
        if (epoch !== generation || current !== session || !valid() || !access.mykola_media_advice_diagnostics) return;
        status.textContent = 'Буфер недоступний. Виділіть і скопіюйте текст.'; text.focus(); text.select();
      }
    }), text, status);
    const sourceDetails = node('details'); sourceDetails.append(node('summary', 'Джерельні деталі варіантів'));
    for (const group of groupMediaRows(rowsFor())) for (const [index, row] of group.rows.entries()) {
      sourceDetails.append(node('h4', `${group.title} · варіант ${index + 1}`), node('pre', JSON.stringify(mediaSourceDetails(row), null, 2)));
      // Original Apple alternatives stay inspectable even where the Store's
      // primary chooser retains only its preferred pointer. No navigation.
      const transfer = group.key === 'apple' ? transferFor(row) : null;
      if (transfer?.link.transferable) {
        const address = node('details'); address.className = 'media-advice-link-address media-advice-diagnostic-link';
        address.append(node('summary', 'Адреса вихідного запису'), node('p', transfer.url)); sourceDetails.append(address);
      }
    }
    for (const row of [...(session.result?.unmapped ?? []), ...(session.choice?.unmapped ?? [])]) {
      sourceDetails.append(node('h4', 'Інша платформа · лише для перегляду'), node('pre', JSON.stringify(mediaSourceDetails(row), null, 2)));
    }
    diagnostics.append(sourceDetails);
    chat.hidden = true; diagnostics.hidden = false; dialog.scrollTop = 0;
    const heading = diagnostics.querySelector('h3'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  }
  function attribution() {
    const details = node('details'); details.className = 'media-advice-attribution'; details.append(node('summary', 'Про джерела та обмеження'));
    details.append(node('p', 'Відомості можуть бути неповними або застарілими. Доступність, умови перегляду й доріжки перевіряйте на платформі.'));
    details.append(node('p', 'Мовні дані та посилання можуть стосуватися різних пропозицій. Брак інформації не означає відсутності доріжки.'));
    details.append(node('p', 'Мовний блок сервісу на підтвердженій картці Кінобази враховуємо для України за правилом застосунку, не як перевірку платформи. «−» для окремого формату аудіо не виключає інших українських доріжок.'));
    details.append(node('p', 'Кінобаза й TMDb можуть використовувати спільні дані JustWatch, тож це не незалежні підтвердження. Деякі посилання ведуть через сторонній сервіс, що рахує переходи.'));
    details.append(node('p', 'Поради Миколи щодо носіїв доступні в режимі бета-тестування для українського регіону'));
    const footer = node('footer'); footer.className = 'media-advice-source-footer';
    const links = node('nav'); links.className = 'media-advice-source-links'; links.setAttribute('aria-label', 'Джерела даних');
    for (const [label, href] of [['TMDb', 'https://www.themoviedb.org/'], ['JustWatch', 'https://www.justwatch.com/'], ['Streaming Availability API by Movie of the Night', 'https://www.movieofthenight.com/about/api'], ['Кінобаза', 'https://kinobazaua.com/']]) {
      const a = node('a', label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; links.append(a);
    }
    footer.append(links, node('p', 'This product uses the TMDB API but is not endorsed or certified by TMDB.'));
    const logo = node('img'); logo.src = '/assets/icons/tmdb.svg'; logo.alt = 'TMDB'; logo.width = 110; footer.append(logo); details.append(footer); chat.append(details);
  }
  function comparison(groups, { onAppleSelection = () => {} } = {}) {
    if (!groups.length) return;
    const body = bubble(); body.classList.add('media-advice-comparison-bubble', 'media-advice-options');
    const table = node('table'); table.className = 'media-advice-comparison';
    const caption = node('caption', 'Аудіо та субтитри — українською'); caption.className = 'media-advice-table-caption'; table.append(caption);
    const columns = node('colgroup');
    for (const kind of ['service', 'availability', 'language', 'language']) { const col = node('col'); col.className = `media-advice-${kind}-column`; columns.append(col); }
    table.append(columns);
    const head = node('thead'), headings = node('tr');
    for (const title of ['Сервіс', 'Доступ', 'Аудіо', 'Субтитри']) { const th = node('th', title); th.setAttribute('scope', 'col'); headings.append(th); }
    head.append(headings); table.append(head);
    const rows = node('tbody'), controls = [], actions = node('div'); actions.className = 'media-advice-actions';
    actions.setAttribute('aria-label', 'Дії для обраного сервісу');
    const symbol = state => { const e = node('span', state.symbol); e.className = 'media-advice-symbol'; e.setAttribute('role', 'img'); e.setAttribute('aria-label', state.label); e.setAttribute('title', state.label); e.dataset.state = state.state; return e; };
    const fallback = { state: 'unknown', symbol: '?', label: 'Невідомо: даних недостатньо, це не означає відсутність.' };
    session.linkSelections ??= new Map();
    // A presentation change cannot change a navigation choice's source row.
    // In particular, literal-equal subscription links may have different
    // language evidence; retain their chosen representative for this view.
    const choicesByGroup = new Map(groups.map(info => [info, linkChoicesFor(info)]));
    const selected = groups.find(info => info.group.key === session.platformKey) ?? groups.find(info => !info.group.readOnly) ?? groups[0];
    function showActions(info) {
      if (!valid()) return invalidate();
      selectionToken = null; session.platformKey = info.group.key;
      for (const item of controls) item.button.setAttribute('aria-pressed', String(item.info === info));
      actions.replaceChildren();
      const group = info.group;
      const links = choicesByGroup.get(info) ?? [];
      // Equal hrefs do not establish equal access products or language claims.
      const choiceKey = link => JSON.stringify([link.row?.provider?.key, link.row?.id, link.href]);
      const chosen = links.find(link => choiceKey(link) === session.linkSelections.get(group.key)) ?? links.find(link => link.row === info.transferRow) ?? links[0];
      const row = chosen?.row ?? info.transferRow;
      const selectedInfo = group.key === 'apple' ? presentMediaGroup(group, { filmId: session.result?.film?.id, selectedRow: row }) : info;
      if (group.key === 'apple') onAppleSelection(info, selectedInfo);
      const item = controls.find(item => item.info === info);
      if (item && row) {
        item.tr.dataset.rowId = row.id;
        if (group.key === 'apple') for (const field of ['availability', 'audio', 'subtitles']) item.cells[field].replaceChildren(symbol(selectedInfo.comparison?.[field] ?? fallback));
      }
      actions.append(node('p', `Обраний сервіс: ${group.title}`));
      if (links.length > 1) {
        const label = node('label', 'Посилання сервісу'), select = node('select'); select.className = 'media-advice-link-select';
        select.setAttribute('aria-label', `Посилання сервісу ${group.title}`);
        for (const [index, link] of links.entries()) {
          const presented = presentMediaRow(link.row);
          const label = group.key === 'apple'
            ? `${link.row?.provider?.key === 'appletvplus' ? 'Apple TV+' : 'Apple TV Store'} · ${presented.accessLabel} · ${presented.sourceLabel} · ${new URL(link.href).hostname} · посилання ${index + 1}`
            : `Посилання ${index + 1} · ${new URL(link.href).hostname}`;
          const option = node('option', label);
          option.value = String(index); option.selected = link === chosen; select.append(option);
        }
        select.addEventListener('change', () => {
          if (!valid()) return invalidate();
          const link = links[Number(select.value)]; if (!link) return;
          session.linkSelections.set(group.key, choiceKey(link)); showActions(info);
          actions.querySelector('select')?.focus({ preventScroll: true });
        });
        label.append(select); actions.append(label);
      }
      if (chosen) {
        const address = node('details'); address.className = 'media-advice-link-address';
        address.append(node('summary', 'Адреса обраного посилання'), node('p', chosen.href)); actions.append(address);
      } else actions.append(node('p', 'Придатного посилання немає.'));
      const transfer = transferFor(row), buttons = node('div'); buttons.className = 'media-advice-row-actions';
      if (transfer?.link.transferable) buttons.append(button('Відкрити посилання', () => {
        if (!valid()) return invalidate(); markStale();
        doc.defaultView.open(transfer.link.href, '_blank', 'noopener,noreferrer');
      }));
      const choose = button('Обрати', () => review(row)); choose.disabled = group.readOnly || !transfer || !canApply(); buttons.append(choose); actions.append(buttons);
      if (!canApply()) actions.append(node('p', 'Поради доступні для перегляду. Для перенесення в картку потрібні права додавання або редагування цієї групи.'));
    }
    for (const info of groups) {
      let displayed = info;
      if (info.group.key === 'apple') {
        const links = choicesByGroup.get(info) ?? [];
        const chosen = links.find(link => JSON.stringify([link.row?.provider?.key, link.row?.id, link.href]) === session.linkSelections.get(info.group.key)) ?? links.find(link => link.row === info.transferRow) ?? links[0];
        displayed = presentMediaGroup(info.group, { filmId: session.result?.film?.id, selectedRow: chosen?.row ?? info.transferRow });
        onAppleSelection(info, displayed);
      }
      const tr = node('tr'); tr.className = 'media-advice-row'; tr.dataset.providerKey = info.group.key; tr.dataset.rowId = info.transferRow?.id ?? '';
      const cell = node('th'); cell.setAttribute('scope', 'row');
      const choose = button('', () => showActions(info)); choose.className = 'media-advice-service-select'; choose.setAttribute('aria-label', info.group.title); choose.setAttribute('title', info.group.title); choose.setAttribute('aria-pressed', 'false');
      if (Object.hasOwn(MEDIA_SERVICE_ICON_SOURCES, info.group.key)) {
        const slot = node('span'); slot.className = 'media-advice-icon-slot'; slot.setAttribute('aria-hidden', 'true');
        const icon = node('img'); icon.className = 'media-advice-provider-icon'; icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); icon.width = 24; icon.height = 24;
        watchMediaServiceIcon({ button: choose, slot, icon, view: doc.defaultView });
        icon.src = MEDIA_SERVICE_ICON_SOURCES[info.group.key]; slot.append(icon);
        choose.append(slot);
      }
      const name = node('span', info.group.title); name.className = 'media-advice-service-name'; choose.append(name);
      cell.append(choose); tr.append(cell);
      const cells = {};
      for (const field of ['availability', 'audio', 'subtitles']) {
        const td = node('td'); td.append(symbol(displayed.comparison?.[field] ?? fallback)); tr.append(td); cells[field] = td;
      }
      controls.push({ info, tr, button: choose, cells }); rows.append(tr);
    }
    table.append(rows); body.append(table);
    const legend = node('details'); legend.className = 'media-advice-legend';
    legend.append(node('summary', 'Що означають позначки'), node('p', '● — джерело вказує Україну; ◐ — неповні дані сервісу; ◇ — інша країна. Мови: + — вказано; − — явно позначено відсутність у зазначеному записі; −* — позначено відсутність лише в зазначених форматах, інші доріжки й пропозиції не перевірено; ? — невідомо; ± — дані різняться.'));
    body.append(legend, actions); showActions(selected);
  }
  function render() {
    const hadFocus = dialog.open && dialog.contains(doc.activeElement);
    selectionToken = null; preview = null;
    const header = node('header'); header.className = 'media-advice-header';
    const heading = node('div'), title = node('h2', 'Поради Миколи'), beta = node('span', 'Beta'); beta.className = 'media-advice-beta'; title.append(beta); heading.append(title);
    const film = node('p', `${session.context.title || 'Фільм'}${session.context.year ? ` · ${session.context.year}` : ''}`); film.className = 'media-advice-film'; heading.append(film);
    header.append(heading, button('← До картки', close));
    chat = node('div'); chat.className = 'media-advice-chat mykola-chat';
    diagnostics = node('section'); diagnostics.className = 'media-advice-diagnostics'; diagnostics.hidden = true;
    dialog.replaceChildren(header, chat, diagnostics);
    bubble(`Де подивитися «${session.context.title || 'цей фільм'}»?`, true);
    staleNotice = node('div'); staleNotice.className = 'media-advice-stale'; staleNotice.hidden = !session.stale; staleNotice.setAttribute('role', 'status');
    staleNotice.append(node('p', 'Це попередні результати, отримані понад 30 хвилин тому. Вони збережені для цієї картки, але актуальність потрібно перевірити.'));
    chat.append(staleNotice);
    notice = node('p'); notice.className = 'media-advice-notice'; notice.hidden = true; notice.setAttribute('role', 'status'); chat.append(notice);
    if (session.loading) {
      const body = bubble('Шукаю варіанти… Перевірю, що джерела кажуть про українську мову.'); body.setAttribute('role', 'status');
      const typing = node('span'); typing.className = 'mykola-typing-bubble'; typing.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) { const dot = node('span'); dot.className = 'mykola-typing-dot'; typing.append(dot); } body.append(typing);
      if (hadFocus) header.querySelector('button').focus({ preventScroll: true });
      return;
    }
    if (!session.result) {
      bubble('Зараз не вдалося отримати відповідь. Спроба могла бути витрачена; повторного пошуку без вашої дії не буде.');
    } else {
      const rows = rowsFor(), groups = presentMediaGroups(rows, { filmId: session.result.film?.id });
      const sourcesIncomplete = session.result.sources?.some(s => /error|failed|unavailable|timeout|blocked|unsupported|partial/i.test(s.status ?? ''));
      const answer = bubble(summarizeMediaGroups(groups, { sourcesIncomplete })); answer.classList.add('media-advice-answer');
      for (const [index, choice] of (session.result.cardChoices ?? []).entries()) {
        if (!index) bubble('Знайшов кілька карток із підтвердженою відповідністю фільму. Оберіть, дані якої додати до відповіді.');
        chat.append(button(`Використати підтверджену картку ${index + 1}`, () => { if (!valid()) return invalidate(); session.choice = choice; render(); }));
      }
      comparison(groups, { onAppleSelection(info, selectedInfo) {
        // Only the local presentation changes. The source rows and their
        // groups stay intact; changing an offer never starts discovery.
        Object.assign(info, selectedInfo);
        answer.querySelector('p').textContent = summarizeMediaGroups(groups, { sourcesIncomplete });
      } });
      for (const label of otherPlatformLabels([...(session.result.unmapped ?? []), ...(session.choice?.unmapped ?? [])])) {
        const other = node('p', `Інші платформи — ${label}: лише для перегляду. Тип доступу й умови потрібно перевірити окремо.`); other.className = 'media-advice-other'; chat.append(other);
      }
      attribution();
    }
    if (renewContext) {
      const update = button('Оновити вручну', renew); update.dataset.mediaRefresh = ''; update.hidden = !session.stale && !session.error; chat.append(update);
    }
    // Privileged pilot details are independent of ordinary Beta access.
    diagnosticBubble();
    if (hadFocus) header.querySelector('button').focus({ preventScroll: true });
  }
  function review(row) {
    if (!valid()) return invalidate(); markStale();
    if (!canApply()) return returnToChat('Немає прав для перенесення в цю картку. Поради можна переглядати.');
    const before = readForm(), transfer = transferFor(row);
    if (!transfer) return;
    tell('');
    const token = selectionToken = {}; session.chatScroll = dialog.scrollTop;
    viewReturnFocus = doc.activeElement;
    preview?.remove(); diagnostics.hidden = true; chat.hidden = true;
    preview = node('section'); preview.className = 'media-advice-preview';
    preview.append(node('h3', 'Перевірте зміни'), node('p', `Рекомендований носій: ${before.recommended_medium || '—'} → ${transfer.medium}`), node('p', linkPreview(before.purchase_url, transfer.url)), node('p', 'Статус, придбаний носій, назва, рік і автор не змінюються. Збереження — звичайною кнопкою форми.'));
    if (['apple', 'appletvplus'].includes(row.provider?.key)) {
      const presented = presentMediaRow(row), group = groupMediaRows([row])[0];
      const selectedInfo = presentMediaGroup(group, { filmId: session.result?.film?.id, selectedRow: row });
      const product = row.provider.key === 'appletvplus' ? 'Apple TV+' : 'Apple TV Store';
      preview.append(node('p', `Тип доступу: ${presented.accessLabel} · ${product}. Джерело: ${presented.sourceLabel}.`));
      preview.append(node('p', selectedInfo.comparison.audio.label), node('p', selectedInfo.comparison.subtitles.label));
    }
    if (before.purchase_url || transfer.url) {
      const details = node('details'); details.className = 'media-advice-preview-links';
      details.append(node('summary', 'Повні адреси'), node('p', `Зараз: ${before.purchase_url || 'відсутнє'}`), node('p', `Обране: ${transfer.url || 'відсутнє'}`)); preview.append(details);
    }
    if (session.stale) preview.append(node('p', 'Це попередні результати. Перевірте актуальність пропозиції перед збереженням.'));
    let clearMissing = false;
    if (!transfer.url && before.purchase_url) { const label = node('label'), check = node('input'); check.type = 'checkbox'; check.addEventListener('change', () => clearMissing = check.checked); label.append(check, doc.createTextNode('Явно очистити попереднє посилання.')); preview.append(label); }
    const apply = button('Перенести в картку', async () => {
      const epoch = generation, c = context(); apply.disabled = true;
      let permitted = false; try { permitted = await validateApply(c); } catch {}
      markStale();
      if (epoch !== generation || token !== selectionToken || !dialog.open || !valid()) return;
      if (!canApply() || !normalizeMediaCapabilities(permitted).mykola_media_advice) return returnToChat('Немає прав для перенесення в цю картку. Поради можна переглядати.');
      updateAccess(permitted);
      const changes = applyPreview(makePreview(row, before, { clearMissing }), readForm());
      if (!changes) return returnToChat('Поля змінилися або очищення не підтверджено. Оберіть варіант повторно.');
      writeForm(changes); session.applied = true; close();
    });
    preview.append(apply, button('Скасувати вибір', () => returnToChat())); dialog.append(preview); dialog.scrollTop = 0;
    const heading = preview.querySelector('h3'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  }
  function editingAccessChanged() {
    // Role changes affect writing, not global advice access or its one-shot
    // source ledger. Keep the already obtained result and chosen addresses.
    selectionToken = null;
    if (preview) returnToChat('Права редагування змінилися. Перевірте вибір повторно.');
    if (valid() && !session.loading) render();
  }
  async function run() {
    if (!valid() || session.used) return; session.used = true; session.loading = true;
    session.startedAt = now(); session.runContext = { ...session.context };
    const epoch = generation, current = session;
    freshnessTimer = setTimeout(() => { if (current === session && epoch === generation) markStale(true); }, freshnessMs);
    controller = new AbortController(); render();
    preloadMediaServiceIcons(doc);
    try {
      const result = await discover(current.context, { signal: controller.signal });
      if (epoch !== generation || current !== session || !valid()) return;
      if (result?.film?.imdbId && result.film.imdbId !== current.context.imdbId) return invalidate();
      // The server rechecks access at finish; an earlier capability cannot
      // override a fresh revocation or diagnostics denial on the result.
      if (result?.capabilities !== undefined && !updateAccess(result.capabilities)) return invalidate();
      current.result = result; current.loading = false; markStale(); render();
    } catch {
      if (epoch !== generation || current !== session || !valid()) return;
      current.error = true; current.loading = false; markStale(); render();
    }
  }
  entry.addEventListener('click', async () => {
    const c = context(), epoch = generation; if (!usable(c)) return invalidate();
    if (entryCheck?.key === key(c)) return;
    const opening = { key: key(c) }; entryCheck = opening;
    try {
      const check = ++capabilityGeneration; let ok = false; try { ok = await capability(c); } catch {}
      if (check !== capabilityGeneration || epoch !== generation || key(c) !== key(context())) return;
      if (!updateDisplayAccess(ok)) return invalidate();
      entry.hidden = false;
      if (!session || session.key !== key(c)) { generation++; session = { context: { ...c }, key: key(c), used: false, result: null }; dialog.replaceChildren(); }
      returnFocus = doc.activeElement; scrollY = doc.defaultView.scrollY;
      markStale();
      if (!session.used) void run();
      if (!dialog.open) dialog.showModal();
      const top = session.dialogScroll ?? 0, current = session, reportHidden = diagnostics.hidden;
      dialog.scrollTop = top;
      // Native showModal focus can scroll again after this event. Restore before
      // the next paint, without reviving a closed/changed context or a new view.
      doc.defaultView.requestAnimationFrame(() => {
        if (valid() && session === current && dialog.open && !preview && diagnostics.hidden === reportHidden) dialog.scrollTop = top;
      });
    } finally { if (entryCheck === opening) entryCheck = null; }
  });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    selectionToken = null; if (preview) returnToChat();
    if (validateDiagnostics) {
      diagnosticCheck?.controller.abort();
      diagnosticRevision++; diagnosticCheck = null;
      diagnostics?.replaceChildren();
      if (diagnostics) diagnostics.hidden = true;
      if (chat) chat.hidden = false;
    }
  });
  return { refresh, invalidate, editingAccessChanged, dialog };
}

