import { classifyLink } from '../shared/media-link-policy.mjs';
import { safeMediaReport } from './media-advice-report.mjs';

const media = Object.freeze({ apple: 'Apple TV / iTunes', netflix: 'Netflix', hbo: 'HBO Max', prime: 'Prime Video', megogo: 'Megogo', rakuten: 'Rakuten TV' });
const value = f => f?.state === 'reported' ? f.value : null;
const accessLabel = f => ({ rent: 'оренда', rental: 'оренда', buy: 'купівля', purchase: 'купівля', subscription: 'передплата', flatrate: 'передплата', addon: 'пакет', free: 'безкоштовний доступ', 'ad-supported': 'з рекламою' })[value(f)] ?? 'тип доступу не встановлено';
const localizationLabel = f => ({ 'reported-positive': '«+» у блоці', 'reported-negative': '«−» у блоці', conflicting: 'суперечливі позначки' })[f?.state] ?? 'невідомо';
export function transferFor(row, acknowledged = false) {
  if (row?.identityStatus !== 'matched' || row?.providerConflict || !Object.hasOwn(media, row?.provider?.key)) return null;
  const link = classifyLink(row.link?.href, row.provider);
  const needsAck = link.kind === 'tracking-redirect' || link.acknowledgementRequired;
  return { medium: media[row.provider.key], url: link.transferable && (!needsAck || acknowledged) ? link.href : null,
    needsAck: Boolean(needsAck), blocked: Boolean(needsAck && !acknowledged), link };
}
export function makePreview(row, form, { acknowledged = false, clearMissing = false } = {}) {
  const transfer = transferFor(row, acknowledged);
  if (!transfer || transfer.blocked || !transfer.url && form.purchase_url && !clearMissing) return null;
  return { rowId: row.id, before: { ...form }, after: { recommended_medium: transfer.medium, purchase_url: transfer.url ?? '' },
    linkKind: transfer.link.kind, acknowledged };
}
export function applyPreview(preview, current) {
  return preview && Object.keys(preview.before).every(k => current[k] === preview.before[k]) ? { ...preview.after } : null;
}

// A controller instance owns all state. No shared Mykola/Advice Room history.
export function createMediaAdvice({ document: doc, entry, context, readForm, writeForm, capability, discover, validateApply = capability }) {
  const dialog = doc.createElement('dialog'); dialog.className = 'media-advice-dialog';
  dialog.setAttribute('aria-label', 'Поради носіїв від Миколи'); doc.body.append(dialog);
  let session = null, generation = 0, controller = null, capabilityGeneration = 0, returnFocus, scrollY = 0;
  const key = c => c && JSON.stringify([c.userId, c.groupId, c.imdbId, c.listId ?? null, c.formSession]);
  const valid = () => session && key(context()) === session.key;
  const node = (tag, text) => { const e = doc.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
  function button(text, action) { const e = node('button', text); e.type = 'button'; e.addEventListener('click', action); return e; }
  function close() { dialog.close(); if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); doc.defaultView.scrollTo(0, scrollY); }
  function invalidate() { generation++; capabilityGeneration++; controller?.abort(); controller = null; session = null; entry.hidden = true; if (dialog.open) dialog.close(); dialog.replaceChildren(); }
  async function refresh() {
    const c = context(), epoch = ++capabilityGeneration; entry.hidden = true;
    if (!c?.userId || !c.groupId || !/^tt\d{7,10}$/.test(c.imdbId ?? '') || !c.formSession) { invalidate(); return; }
    if (session && session.key !== key(c)) invalidate();
    const check = capabilityGeneration; // Invalidating a different form also revokes in-flight capability replies.
    try { const ok = await capability(c); if (check === capabilityGeneration && key(context()) === key(c)) entry.hidden = ok !== true; }
    catch { if (epoch === capabilityGeneration) entry.hidden = true; }
  }
  function render(message) {
    dialog.replaceChildren(node('h2', 'Поради Миколи'), button('← До картки', close));
    dialog.append(node('p', 'Це повідомлення джерел, не гарантія доступності чи придбання. Невідоме — не «немає».'));
    if (session.result?.rows?.length) dialog.append(node('p', 'Є варіанти для вашого вибору. Де джерела мовчать, Микола фактів не домальовує.'));
    if (message) { const status = node('p', message); status.setAttribute('role', 'status'); dialog.append(status); }
    const search = button('Знайти варіанти', run); search.disabled = session.used; dialog.append(search);
    for (const s of session.result?.sources ?? []) dialog.append(node('p', `${s.source}: ${s.status}; identity: ${s.identity}`));
    if (session.result?.film) dialog.append(node('h3', session.result.film.title));
    if (session.result?.metrics) dialog.append(node('p', `Джерельні HTTP-спроби: ${session.result.metrics.requestsMade} / ${session.result.metrics.requestBudget}; зарезервовано в ledger: ${session.result.metrics.ledgerReservations ?? 'невідомо'}. Повторних запитів немає.`));
    if (session.result?.metrics) {
      const counts = node('details'); counts.append(node('summary', 'Облік запитів'),
        node('pre', JSON.stringify(session.result.metrics, null, 2))); dialog.append(counts);
    }
    if (session.choice) dialog.append(node('p', `Обрана source-картка Кінобази: ${session.choice.sourceURL}. Identity matched; це не entitlement.`));
    if (session.result?.resolver) {
      const info = node('details'); info.append(node('summary', 'Пошук картки Кінобази'),
        node('pre', JSON.stringify(session.result.resolver, null, 2))); dialog.append(info);
    }
    for (const choice of session.result?.cardChoices ?? []) dialog.append(button(`Використати підтверджену картку ${choice.id}`, () => {
      if (!valid()) return invalidate();
      session.choice = choice; render('Обрана картка Кінобази. Це не підтвердження характеристик інших пропозицій.');
    }));
    const filmLocalization = session.choice?.filmLocalization ?? session.result?.filmLocalization;
    if (filmLocalization?.ukrainianAudio?.state === 'reported-positive') dialog.append(node('p', 'Кінобаза вказує українську локалізацію фільму загалом. Це не підтвердження доріжки на кожній платформі.'));
    const rows = [...(session.result?.rows ?? []), ...(session.choice?.rows ?? [])], groups = new Map();
    for (const row of rows) {
      const groupKey = row.provider?.key ?? 'unmapped';
      if (!groups.has(groupKey)) { const group = node('section'); group.append(node('h3', row.provider?.name ?? 'Інша платформа')); groups.set(groupKey, group); dialog.append(group); }
      const card = node('section'); card.className = 'media-advice-row';
      card.append(node('p', `${row.provenance?.source ?? 'Джерело не зазначено'} · ${accessLabel(row.access)} · ${row.country ?? 'територія невідома'}`));
      if (row.kind === 'candidate-link') card.append(node('p', 'Посилання-кандидат, не підтверджена пропозиція.'));
      if (row.conflicts?.length) card.append(node('p', 'Суперечливі дані джерела; ці характеристики не переносяться до форми.'));
      if (row.comparisons?.some(c => c.outcome === 'possible-discrepancy')) card.append(node('p', 'Можлива розбіжність; еквівалентність пропозицій не встановлена.'));
      if (row.provenance?.source === 'Movie of the Night') card.append(node('p', 'MOTN: мовні списки, якість і ціни потребують перевірки; порожній список не означає відсутність.'));
      if (row.kinobazaLocalization) card.append(node('p', `Кінобаза: українське аудіо — ${localizationLabel(row.kinobazaLocalization.audio)}, субтитри — ${localizationLabel(row.kinobazaLocalization.subtitles)}; для конкретної пропозиції ще не перевірено.`));
      const details = node('details'); details.append(node('summary', 'Джерело й обмеження'), node('pre', JSON.stringify({ provenance: row.provenance, audio: row.audio, subtitles: row.subtitles, quality: row.quality, price: row.price, conflicts: row.conflicts, comparisons: row.comparisons }, null, 2))); card.append(details);
      const transfer = transferFor(row); let acknowledged = false;
      if (transfer?.needsAck) {
        const label = node('label'), check = node('input'); check.type = 'checkbox';
        check.addEventListener('change', () => { acknowledged = check.checked; }); label.append(check, doc.createTextNode('Розумію: посилання містить tracking/affiliate-перехід.')); card.append(label);
      }
      if (transfer?.link.transferable) card.append(button('Відкрити посилання', () => {
        if (!valid() || transfer.needsAck && !acknowledged) { render('Спочатку підтвердьте tracking/affiliate-перехід.'); return; }
        doc.defaultView.open(transfer.link.href, '_blank', 'noopener,noreferrer');
      }));
      const select = button('Обрати', () => review(row, acknowledged)); select.disabled = !transfer; card.append(select); groups.get(groupKey).append(card);
    }
    for (const row of [...(session.result?.unmapped ?? []), ...(session.choice?.unmapped ?? [])]) {
      const details = node('details'); details.append(node('summary', `Інші платформи — ${row.name ?? 'назву не встановлено'} (${row.source}): лише для перегляду`),
        node('pre', JSON.stringify({ access: row.access, reason: row.reason, provenance: row.provenance, observations: row.observations ?? row.observation }, null, 2))); dialog.append(details);
    }
    const attribution = node('p', 'This product uses the TMDB API but is not endorsed or certified by TMDB. ');
    for (const [text, href] of [['TMDb', 'https://www.themoviedb.org/'], ['JustWatch', 'https://www.justwatch.com/'], ['Streaming Availability API by Movie of the Night', 'https://www.movieofthenight.com/about/api'], ['Кінобаза', 'https://kinobazaua.com/']]) {
      const a = node('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; attribution.append(a, doc.createTextNode(' · '));
    }
    dialog.append(attribution);
    dialog.append(node('p', 'Країнові секції Кінобази й TMDb можуть походити з JustWatch — це не незалежні підтвердження.'));
    const logo = node('img'); logo.src = '/research/grounded-answer-demo/public/tmdb-logo.svg'; logo.alt = 'TMDB'; logo.width = 110; dialog.append(logo);
    if (session.result) dialog.append(button('Скопіювати короткий звіт', async () => {
      const epoch = generation, report = safeMediaReport({ ...session.result, rows, filmLocalization }, { applied: session.applied });
      try {
        if (!doc.defaultView.navigator.clipboard?.writeText) throw Error();
        await doc.defaultView.navigator.clipboard.writeText(report);
        if (epoch === generation && valid()) { const notice = node('p', 'Короткий звіт скопійовано.'); notice.setAttribute('role', 'status'); dialog.append(notice); }
      } catch {
        if (epoch !== generation || !valid()) return;
        const fallback = node('textarea'); fallback.readOnly = true; fallback.value = report; fallback.setAttribute('aria-label', 'Короткий звіт для копіювання');
        dialog.append(node('p', 'Буфер недоступний. Виділіть і скопіюйте текст.'), fallback); fallback.focus(); fallback.select();
      }
    }));
    if (session.result && !session.result.rows?.length) dialog.append(node('p', 'Придатних варіантів джерела не повернули. Це не означає, що фільм недоступний.'));
  }
  function review(row, acknowledged) {
    if (!valid()) return invalidate();
    const before = readForm(), transfer = transferFor(row, acknowledged);
    if (!transfer || transfer.blocked) return render('Потрібне підтвердження tracking/affiliate-переходу.');
    const preview = node('section'); preview.className = 'media-advice-preview';
    preview.append(node('h3', 'Перевірте зміни'), node('p', `Рекомендований носій: ${before.recommended_medium || '—'} → ${transfer.medium}`), node('p', `Посилання: ${before.purchase_url || '—'} → ${transfer.url || 'відсутнє'}`), node('p', 'Статус, придбаний носій, назва, рік і автор не змінюються. Збереження — звичайною кнопкою форми.'));
    let clearMissing = false;
    if (!transfer.url && before.purchase_url) { const label = node('label'), check = node('input'); check.type = 'checkbox'; check.addEventListener('change', () => clearMissing = check.checked); label.append(check, doc.createTextNode('Явно очистити попереднє посилання.')); preview.append(label); }
    const apply = button('Перенести в картку', async () => {
      const epoch = generation; apply.disabled = true;
      let permitted = false; try { permitted = await validateApply(context()); } catch {}
      if (epoch !== generation || !valid()) return;
      const p = makePreview(row, before, { acknowledged, clearMissing }), changes = applyPreview(p, readForm());
      if (!permitted) { invalidate(); return; }
      if (!changes) { render('Поля змінилися або очищення не підтверджено. Оберіть варіант повторно.'); return; }
      writeForm(changes); session.applied = true; close();
    }); preview.append(apply, button('Скасувати вибір', () => render())); dialog.replaceChildren(preview);
  }
  async function run() {
    if (!valid() || session.used) return; session.used = true; const epoch = generation, current = session;
    controller = new AbortController(); render('Шукаю варіанти…');
    try {
      const result = await discover(current.context, { signal: controller.signal });
      if (epoch !== generation || !valid()) return;
      session.result = result; render('Результати джерел.');
    } catch { if (epoch === generation && valid()) render('Запит завершився без результату. Спроба могла бути витрачена; автоматичного повтору немає.'); }
  }
  entry.addEventListener('click', async () => {
    const c = context(), epoch = generation; let ok = false; try { ok = await capability(c); } catch {}
    if (!ok || epoch !== generation || key(c) !== key(context())) { entry.hidden = true; return; }
    if (!session || session.key !== key(c)) session = { context: { ...c }, key: key(c), used: false, result: null };
    returnFocus = doc.activeElement; scrollY = doc.defaultView.scrollY; render(); dialog.showModal();
  });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  return { refresh, invalidate, dialog };
}
