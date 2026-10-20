import { classifyLink } from '../shared/media-link-policy.mjs';

const media = Object.freeze({ apple: 'Apple TV / iTunes', netflix: 'Netflix', hbo: 'HBO Max', prime: 'Prime Video', megogo: 'Megogo', rakuten: 'Rakuten TV' });
const value = f => f?.state === 'reported' ? f.value : null;
export function transferFor(row, acknowledged = false) {
  if (row?.identityStatus !== 'matched' || row?.providerConflict || !media[row?.provider?.key]) return null;
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
    if (message) { const status = node('p', message); status.setAttribute('role', 'status'); dialog.append(status); }
    const search = button('Знайти варіанти', run); search.disabled = session.used; dialog.append(search);
    for (const s of session.result?.sources ?? []) dialog.append(node('p', `${s.source}: ${s.status}; identity: ${s.identity}`));
    for (const row of session.result?.rows ?? []) {
      const card = node('section'); card.className = 'media-advice-row';
      card.append(node('h3', row.provider?.name ?? 'Інша платформа'), node('p', `${row.provenance?.source ?? 'Джерело не зазначено'} · ${value(row.access) ?? 'тип доступу невідомий'} · ${row.country ?? 'територія невідома'}`));
      if (row.kinobazaLocalization) card.append(node('p', `Кінобаза: аудіо ${row.kinobazaLocalization.audio?.state ?? 'unknown'}, субтитри ${row.kinobazaLocalization.subtitles?.state ?? 'unknown'}; для конкретної пропозиції не перевірено.`));
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
      const select = button('Обрати', () => review(row, acknowledged)); select.disabled = !transfer; card.append(select); dialog.append(card);
    }
    for (const row of session.result?.unmapped ?? []) dialog.append(node('p', `Інші платформи — ${row.name ?? 'назву не встановлено'} (${row.source}): лише для перегляду; ${row.reason ?? 'mapping unresolved'}`));
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
      writeForm(changes); close();
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
