import { classifyLink } from '../shared/media-link-policy.mjs';
import { safeMediaReport, mediaSourceDetails } from './media-advice-report.mjs';
import { groupMediaRows, presentMediaGroups, summarizeMediaGroups } from './media-advice-presentation.mjs';

const media = Object.freeze({ apple: 'Apple TV / iTunes', netflix: 'Netflix', hbo: 'HBO Max', prime: 'Prime Video', megogo: 'Megogo', rakuten: 'Rakuten TV' });
export function transferFor(row) {
  if (row?.identityStatus !== 'matched' || row?.providerConflict || !Object.hasOwn(media, row?.provider?.key)) return null;
  const link = classifyLink(row.link?.href, row.provider);
  // M4's explicit open/apply actions need no extra referral acknowledgement.
  // The shared classification and the observed href itself remain untouched.
  return { medium: media[row.provider.key], url: link.transferable ? link.href : null, link };
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
export function createMediaAdvice({ document: doc, entry, context, readForm, writeForm, capability, discover, validateApply = capability, renewContext, now = Date.now }) {
  const dialog = doc.createElement('dialog'); dialog.className = 'media-advice-dialog';
  dialog.setAttribute('aria-label', 'Поради носіїв від Миколи'); doc.body.append(dialog);
  let session = null, generation = 0, controller = null, capabilityGeneration = 0, selectionToken = null;
  let returnFocus, viewReturnFocus, scrollY = 0, freshnessTimer, chat, preview, diagnostics, notice, staleNotice;
  // View freshness only. The server's 30-minute action ledger is NOT extended.
  const freshnessMs = 30 * 60 * 1000;
  const key = c => c && JSON.stringify([c.userId, c.groupId, c.imdbId, c.listId ?? null, c.formSession, c.title ?? null, c.year ?? null]);
  const usable = c => c?.userId && c.groupId && /^tt\d{7,10}$/.test(c.imdbId ?? '') && c.formSession;
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
    clearTimeout(freshnessTimer); selectionToken = null; generation++; capabilityGeneration++;
    controller?.abort(); controller = null; session = null; entry.hidden = true;
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
    if (!session) entry.hidden = true;
    markStale();
    if (selectionToken) returnToChat('Перевірте вибір повторно після оновлення доступу.');
    const check = ++capabilityGeneration;
    try {
      const ok = await capability(c);
      if (check !== capabilityGeneration) return;
      if (key(context()) !== key(c) || ok !== true) return invalidate();
      markStale(); entry.hidden = false;
    } catch { if (check === capabilityGeneration) invalidate(); }
  }
  async function renew() {
    if (!valid() || session.loading || session.renewing || !renewContext) return;
    const current = session, c = context(), epoch = generation; current.renewing = true;
    let ok = false; try { ok = await capability(c); } catch {}
    if (epoch !== generation || !valid() || current !== session || key(c) !== key(context())) return;
    if (!ok) return invalidate();
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
  function showReport() {
    if (!valid()) return invalidate();
    markStale(); selectionToken = null; session.chatScroll = dialog.scrollTop;
    viewReturnFocus = doc.activeElement;
    diagnostics.replaceChildren(node('h3', 'Діагностичний звіт'), node('p', 'Лише для пілоту. Звіт нікуди не надсилається автоматично.'), button('← До порад', () => returnToChat()));
    const text = node('textarea'); text.readOnly = true; text.value = reportText(); text.setAttribute('aria-label', 'Короткий звіт для копіювання'); text.rows = 14;
    const status = node('p'); status.setAttribute('role', 'status');
    diagnostics.append(button('Скопіювати короткий звіт', async () => {
      if (!valid()) return invalidate();
      markStale(); const report = reportText(); text.value = report;
      const epoch = generation, current = session;
      try {
        if (!doc.defaultView.navigator.clipboard?.writeText) throw Error();
        await doc.defaultView.navigator.clipboard.writeText(report);
        if (epoch === generation && current === session && valid()) status.textContent = 'Короткий звіт скопійовано.';
      } catch {
        if (epoch !== generation || current !== session || !valid()) return;
        status.textContent = 'Буфер недоступний. Виділіть і скопіюйте текст.'; text.focus(); text.select();
      }
    }), text, status);
    const sourceDetails = node('details'); sourceDetails.append(node('summary', 'Джерельні деталі варіантів'));
    for (const group of groupMediaRows(rowsFor())) for (const [index, row] of group.rows.entries()) {
      sourceDetails.append(node('h4', `${group.title} · варіант ${index + 1}`), node('pre', JSON.stringify(mediaSourceDetails(row), null, 2)));
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
    details.append(node('p', 'This product uses the TMDB API but is not endorsed or certified by TMDB.'));
    const links = node('p');
    for (const [label, href] of [['TMDb', 'https://www.themoviedb.org/'], ['JustWatch', 'https://www.justwatch.com/'], ['Streaming Availability API by Movie of the Night', 'https://www.movieofthenight.com/about/api'], ['Кінобаза', 'https://kinobazaua.com/']]) {
      const a = node('a', label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; links.append(a, doc.createTextNode(' · '));
    }
    details.append(links, node('p', 'Країнові секції Кінобази й TMDb можуть походити з JustWatch — це не незалежні підтвердження.'));
    details.append(node('p', 'Деякі посилання можуть проходити через сторонній сервіс, який враховує переходи.'));
    const logo = node('img'); logo.src = '/research/grounded-answer-demo/public/tmdb-logo.svg'; logo.alt = 'TMDB'; logo.width = 110; details.append(logo); chat.append(details);
  }
  function render() {
    const hadFocus = dialog.open && dialog.contains(doc.activeElement);
    selectionToken = null; preview = null;
    const header = node('header'); header.className = 'media-advice-header';
    const heading = node('div'); heading.append(node('h2', 'Поради Миколи'));
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
      const rows = rowsFor(), groups = presentMediaGroups(rows);
      const answer = bubble(summarizeMediaGroups(groups)); answer.classList.add('media-advice-answer');
      if (session.result.sources?.some(s => /error|failed|unavailable|timeout|blocked|unsupported|partial/i.test(s.status ?? ''))) bubble('Частина відомостей неповна або не надійшла. Показую те, що вдалося отримати, без здогадок.');
      for (const [index, choice] of (session.result.cardChoices ?? []).entries()) {
        if (!index) bubble('Знайшов кілька карток із підтвердженою відповідністю фільму. Оберіть, дані якої додати до відповіді.');
        chat.append(button(`Використати підтверджену картку ${index + 1}`, () => { if (!valid()) return invalidate(); session.choice = choice; render(); }));
      }
      if (filmLocalizationFor()?.ukrainianAudio?.state === 'reported-positive') bubble('Є згадка про українське аудіо для фільму загалом. На кожній платформі його наявність ще треба перевірити.');
      const list = node('div'); list.className = 'media-advice-options';
      for (const info of groups) {
        const group = info.group, row = info.transferRow;
        const card = node('article'); card.className = 'media-advice-row'; card.dataset.providerKey = group.key; card.dataset.rowId = row.id;
        const title = node('div'); title.className = 'media-advice-option-title'; title.append(node('h3', group.title)); card.append(title);
        const body = node('div'); body.className = 'media-advice-variant';
        const basis = node('p', `${info.access} · ${info.territory}`); basis.className = 'media-advice-source'; body.append(basis);
        body.append(node('p', info.audio), node('p', info.subtitles));
        if (info.unboundLabels.length) { const e = node('p', info.unboundLabels.join('. ') + '. Для цієї пропозиції ще не перевірено.'); e.className = 'media-advice-warning'; body.append(e); }
        for (const warning of [...new Set(info.warnings)]) { const e = node('p', warning); e.className = 'media-advice-warning'; body.append(e); }
        if (group.rows.length > 1) body.append(node('p', 'Відомості можуть стосуватися різних пропозицій; перевірте умови за посиланням.'));
        if (row.kind === 'candidate-link') body.append(node('p', 'Умови перегляду за посиланням ще потрібно перевірити.'));
        const transfer = transferFor(row);
        const actions = node('div'); actions.className = 'media-advice-row-actions';
        if (transfer?.link.transferable) actions.append(button('Відкрити посилання', () => {
          if (!valid()) return invalidate(); markStale();
          doc.defaultView.open(transfer.link.href, '_blank', 'noopener,noreferrer');
        }));
        const select = button('Обрати', () => review(row)); select.disabled = group.readOnly || !transfer; actions.append(select); body.append(actions);
        card.append(body); list.append(card);
      }
      chat.append(list);
      for (const row of [...(session.result.unmapped ?? []), ...(session.choice?.unmapped ?? [])]) {
        const other = node('p', `Інші платформи — ${row.name ?? 'назву не встановлено'}: лише для перегляду. Тип доступу й умови потрібно перевірити окремо.`); other.className = 'media-advice-other'; chat.append(other);
      }
      const caution = node('p', 'Це відомості джерел, не гарантія доступності. Невідоме не означає «немає».'); caution.className = 'media-advice-footnote'; chat.append(caution); attribution();
    }
    if (renewContext) {
      const update = button('Оновити вручну', renew); update.dataset.mediaRefresh = ''; update.hidden = !session.stale && !session.error; chat.append(update);
    }
    // Last Mykola bubble is pilot-only diagnostics, never mixed into the answer.
    const last = bubble('Якщо щось не зійшлося, тут є подробиці для пілоту.'); last.classList.add('media-advice-report-bubble'); last.append(button('Діагностичний звіт', showReport));
    if (hadFocus) header.querySelector('button').focus({ preventScroll: true });
  }
  function review(row) {
    if (!valid()) return invalidate(); markStale();
    const before = readForm(), transfer = transferFor(row);
    if (!transfer) return;
    tell('');
    const token = selectionToken = {}; session.chatScroll = dialog.scrollTop;
    viewReturnFocus = doc.activeElement;
    preview?.remove(); diagnostics.hidden = true; chat.hidden = true;
    preview = node('section'); preview.className = 'media-advice-preview';
    preview.append(node('h3', 'Перевірте зміни'), node('p', `Рекомендований носій: ${before.recommended_medium || '—'} → ${transfer.medium}`), node('p', linkPreview(before.purchase_url, transfer.url)), node('p', 'Статус, придбаний носій, назва, рік і автор не змінюються. Збереження — звичайною кнопкою форми.'));
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
      if (!permitted) return invalidate();
      const changes = applyPreview(makePreview(row, before, { clearMissing }), readForm());
      if (!changes) return returnToChat('Поля змінилися або очищення не підтверджено. Оберіть варіант повторно.');
      writeForm(changes); session.applied = true; close();
    });
    preview.append(apply, button('Скасувати вибір', () => returnToChat())); dialog.append(preview); dialog.scrollTop = 0;
    const heading = preview.querySelector('h3'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  }
  async function run() {
    if (!valid() || session.used) return; session.used = true; session.loading = true;
    session.startedAt = now(); session.runContext = { ...session.context };
    const epoch = generation, current = session;
    freshnessTimer = setTimeout(() => { if (current === session && epoch === generation) markStale(true); }, freshnessMs);
    controller = new AbortController(); render();
    try {
      const result = await discover(current.context, { signal: controller.signal });
      if (epoch !== generation || current !== session || !valid()) return;
      if (result?.film?.imdbId && result.film.imdbId !== current.context.imdbId) return invalidate();
      current.result = result; current.loading = false; markStale(); render();
    } catch {
      if (epoch !== generation || current !== session || !valid()) return;
      current.error = true; current.loading = false; markStale(); render();
    }
  }
  entry.addEventListener('click', async () => {
    const c = context(), epoch = generation; if (!usable(c)) return invalidate();
    const check = ++capabilityGeneration; let ok = false; try { ok = await capability(c); } catch {}
    if (check !== capabilityGeneration || epoch !== generation || key(c) !== key(context())) return;
    if (!ok) return invalidate();
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
  });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dialog.addEventListener('close', () => { selectionToken = null; if (preview) returnToChat(); });
  return { refresh, invalidate, dialog };
}

