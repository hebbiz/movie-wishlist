// Explicit local actions only. Source URL input is admitted server-side, never fetched by the browser.
export function mountFilmSearch(document, initial, view, { signal, fetchImpl = fetch } = {}) {
  let workflow = initial, generation = 0, busy = false, dirty = false, awaitingPage = false, accountingUnknown = false, pending = Promise.resolve(), controller;
  let lastResult = null, admitted = null;
  const add = (host, tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; host.append(n); return n; };
  const host = document.createElement('section'); host.className = 'discovery-ui'; host.id = 'film-search';
  document.getElementById('discovery-film').parentElement.parentElement.before(host);
  add(host, 'h2', 'Знайти інший фільм');
  add(host, 'p', 'TMDb → підтвердження фільму → варіанти. За бажанням додайте точну картку Кінобази, знайдену вами вручну. Це не автоматичний пошук Кінобази.');
  const form = add(host, 'form'); const ql = add(form, 'label', 'Назва'); const query = add(ql, 'input'); query.id = 'film-query'; query.maxLength = 160; query.minLength = 2; query.required = true;
  const yl = add(form, 'label', 'Рік, якщо відомий'); const year = add(yl, 'input'); year.id = 'film-year'; year.inputMode = 'numeric'; year.maxLength = 4; year.pattern = '[0-9]{4}';
  const search = add(form, 'button', 'Шукати в TMDb'); search.id = 'film-search-submit'; search.type = 'submit';
  const fresh = add(host, 'button', 'Новий випадок — очистити попередній'); fresh.id = 'film-new-case'; fresh.type = 'button';
  const counters = add(host, 'p'); counters.id = 'film-counters';
  const status = add(host, 'p', 'Пошук — лише після натискання. Перший результат автоматично не обирається.'); status.id = 'film-search-status'; status.setAttribute('role', 'status');
  const candidates = add(host, 'section'); candidates.id = 'film-candidates';
  const preview = add(host, 'section'); preview.id = 'film-preview';
  const kino = add(host, 'section'); kino.id = 'assisted-kinobaza'; kino.hidden = true;
  add(kino, 'h3', 'Додати дані Кінобази');
  add(kino, 'p', 'Знайдіть картку самостійно. Сервер перевірить точну адресу, потім — відповідність вибраному фільму. Один GET, без переходів і повторів; це не перевірка відтворення.');
  const cardForm = add(kino, 'form'), cardLabel = add(cardForm, 'label', 'Точний URL картки Кінобази');
  const cardURL = add(cardLabel, 'input'); cardURL.id = 'kinobaza-card-url'; cardURL.type = 'url'; cardURL.required = true; cardURL.maxLength = 512;
  const admit = add(cardForm, 'button', 'Перевірити адресу'); admit.type = 'submit'; admit.id = 'kinobaza-admit';
  const cardStatus = add(kino, 'p'); cardStatus.id = 'kinobaza-status'; cardStatus.setAttribute('role', 'status');
  const readCard = add(kino, 'button', 'Прочитати одну картку'); readCard.type = 'button'; readCard.id = 'kinobaza-read'; readCard.hidden = true;
  const sync = () => {
    const c = workflow.counters, u = workflow.uses;
    counters.textContent = `HTTP: search ${c.search}/2 · preview ${c.preview}/2 · discovery ${c.discovery}/2 · разом ${Object.values(c).reduce((a, b) => a + b, 0)}/${workflow.cap}. Дії: пошук ${u.search}/2, preview ${u.preview}/2. ${document.getElementById('mode').textContent.includes('SYNTHETIC') ? 'Synthetic: зовнішніх запитів 0.' : ''}`;
    counters.textContent += ` Час фаз: search ${workflow.phaseElapsedMs.search} ms, preview ${workflow.phaseElapsedMs.preview} ms, discovery ${workflow.phaseElapsedMs.discovery} ms — не benchmark/API cost.`;
    if (workflow.cap === 7) counters.textContent += ` Кінобаза ${c.kinobaza ?? 0}/1 · час ${workflow.phaseElapsedMs.kinobaza ?? 0} ms.`;
    if (accountingUnknown) counters.textContent = 'HTTP counters: unknown — локальну відповідь втрачено; старі значення не є поточним обліком. Без автоматичного повтору.';
    search.disabled = busy || awaitingPage || u.search >= 2 || u.discovery >= 1; fresh.disabled = awaitingPage;
    for (const b of candidates.querySelectorAll('button')) b.disabled = busy || u.preview >= 2 || b.dataset.used === 'yes';
    for (const b of preview.querySelectorAll('button')) b.disabled = busy;
    admit.disabled = busy || awaitingPage || !lastResult || workflow.uses.kinobaza >= 1;
    cardURL.disabled = busy || awaitingPage || workflow.uses.kinobaza >= 1;
    readCard.disabled = busy || awaitingPage || !admitted || workflow.uses.kinobaza >= 1;
  };
  const clearCard = () => { lastResult = null; admitted = null; kino.hidden = true; cardURL.value = ''; cardStatus.textContent = ''; readCard.hidden = true; };
  const clear = () => { generation++; controller?.abort(); busy = false; candidates.replaceChildren(); preview.replaceChildren(); clearCard(); view.beginDynamic(); sync(); };
  const headers = () => ({ 'Content-Type': 'application/json', 'x-demo-workflow': workflow.id, 'x-demo-action': workflow.actionToken });
  async function invalidate() {
    if (dirty || awaitingPage) return pending;
    dirty = true; clear(); const at = generation;
    pending = (async () => {
      try {
        const r = await fetchImpl('/dynamic/invalidate', { method: 'POST', headers: headers(), body: '{}', cache: 'no-store', signal });
        const p = await r.json(); if (at !== generation || signal?.aborted) return;
        if (!r.ok || !p.workflow) throw new Error('Expired'); workflow = p.workflow; sync();
      } catch { if (at === generation && !signal?.aborted) { awaitingPage = true; accountingUnknown = true; sync(); status.textContent = 'Сесію втрачено. Перезавантажте сторінку; автоматичних повторів немає.'; } }
    })();
    return pending;
  }
  query.addEventListener('input', () => { void invalidate(); }); year.addEventListener('input', () => { void invalidate(); });
  async function action(name, input) {
    if (busy || awaitingPage || signal?.aborted) return null;
    await pending; if (awaitingPage || signal?.aborted) return null;
    busy = true; dirty = false; const at = generation; controller = new AbortController(); view.beginAction(); sync();
    status.textContent = 'Виконую одну дію, без автоматичного повтору.';
    try {
      const r = await fetchImpl(`/dynamic/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(input), cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal });
      const p = await r.json(); if (at !== generation || signal?.aborted) return null;
      if (p.workflow) { workflow = p.workflow; accountingUnknown = false; }
      else { awaitingPage = true; accountingUnknown = true; view.presentWorkflowReport({ status: 'action-failed-no-retry', assisted: ['admit-card', 'read-card'].includes(name) }); }
      if (p.workflow && name !== 'new-case' && !p.result && !['admit-card', 'read-card'].includes(name)) view.presentWorkflowReport({ workflow: p.workflow, status: p.status, mode: p.mode, film: p.film });
      if (p.workflow && !p.result && ['admit-card', 'read-card'].includes(name) && lastResult) { lastResult.accounting = p.workflow; view.presentDynamic(lastResult); }
      status.textContent = ({ results: 'Оберіть фільм для identity preview.', preview: 'Перевірте identity й підтвердьте свій вибір.',
        confirmed: 'Identity підтверджено вами. Запит варіантів — окрема дія.', complete: 'Готово. Це дані джерел, не перевірка відтворення.',
        'no-results-for-query': 'За цим запитом результатів немає. Це не означає, що фільму не існує.', 'new-case': 'Попередній випадок очищено. Можна обрати новий фільм.' })[p.status] ?? `Дію зупинено: ${p.status ?? 'unknown'}. Автоматичного повтору немає.`;
      return r.ok ? p : null;
    } catch { if (at === generation && !signal?.aborted) { status.textContent = 'Локальну відповідь втрачено. Перезавантажте сторінку; автоматичного повтору немає.'; awaitingPage = true; accountingUnknown = true; view.presentWorkflowReport({ status: 'action-failed-no-retry', assisted: ['admit-card', 'read-card'].includes(name) }); } return null; }
    finally { if (at === generation) { busy = false; sync(); } }
  }
  function showPreview(p) {
    preview.replaceChildren(); if (!p?.preview) return;
    const v = p.preview; add(preview, 'h3', v.film.title); add(preview, 'p', `Оригінальна назва: ${v.film.originalTitle ?? 'не зазначено'} · TMDb ${v.film.tmdbId}`);
    add(preview, 'p', `Режисери: ${v.directors.join(', ') || 'не зазначені'} · IMDb crosswalk: ${v.crosswalk} · metadata: ${v.metadataStatus}`);
    add(preview, 'p', 'Назва, мови й дати каталогу не доводять версію, доступ чи українські доріжки платформи.');
    const confirm = add(preview, 'button', 'Це потрібний фільм — підтвердити'); confirm.id = 'film-identity-confirm'; confirm.type = 'button';
    confirm.addEventListener('click', async () => {
      const p = await action('confirm', { preview: v.ref }); if (!p) return;
      confirm.remove(); const discover = add(preview, 'button', 'Знайти варіанти для вибраного фільму'); discover.id = 'film-discover'; discover.type = 'button';
      discover.addEventListener('click', async () => { discover.disabled = true; const p = await action('discover', {}); discover.remove(); if (p?.result) { p.result.accounting = p.workflow; lastResult = p.result; view.presentDynamic(p.result); kino.hidden = false; sync(); } });
    });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!form.reportValidity()) return;
    await pending; clear(); const p = await action('search', { query: query.value, year: year.value }); if (!p) return;
    candidates.replaceChildren();
    for (const c of p.candidates ?? []) {
      const b = add(candidates, 'button', `${c.title} · ${c.originalTitle ?? 'оригінальна назва невідома'} · ${c.year ?? 'рік невідомий'}`); b.type = 'button';
      b.addEventListener('click', async () => { if (busy || b.dataset.used) return; clearCard(); view.beginDynamic(); preview.replaceChildren(); b.dataset.used = 'yes'; const p = await action('preview', { candidate: c.ref }); showPreview(p); sync(); });
    }
    sync();
  });
  cardURL.addEventListener('input', () => { admitted = null; readCard.hidden = true; cardStatus.textContent = 'Адресу змінено — спочатку перевірте її. Зовнішніх запитів ще немає.'; sync(); });
  cardForm.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || !cardForm.reportValidity()) return;
    admitted = null; readCard.hidden = true;
    const p = await action('admit-card', { sourceURL: cardURL.value });
    if (p?.card) { admitted = p.card; cardStatus.textContent = `Прийнята адреса: ${p.card.sourceURL} · бюджет: один Kinobaza GET, випадок max7; без redirects/retries. Натисніть окрему кнопку для читання.`; readCard.hidden = false; }
    else if (!awaitingPage && lastResult) cardStatus.textContent = 'Адресу не прийнято. Лише https://kinobazaua.com/titles/<slug> без query, fragment, портів, інших хостів або підсторінок. GET не виконано, попередні варіанти збережені.';
    sync();
  });
  readCard.addEventListener('click', async () => {
    if (busy || !admitted) return;
    const ref = admitted.ref; admitted = null; sync();
    const p = await action('read-card', { card: ref });
    if (p?.result) {
      p.result.accounting = p.workflow; lastResult = p.result; view.presentDynamic(p.result);
      const c = p.result.assistedContribution;
      cardStatus.textContent = `Кінобаза: ${c.status}; identity ${c.identity}. Показано окремих рядків: ${c.rowsAdded}; source кандидатів: ${c.candidates}; блоків локалізації: ${c.blocks}. ${c.reason ?? ''} Це окремі source claims, не доповнення полів іншої пропозиції. Наявна підтверджена чернетка збережена. Повтору немає.`;
    } else if (!awaitingPage && lastResult) cardStatus.textContent = 'Читання не завершено; спробу не повторюємо. Попередні варіанти й чернетка збережені.';
    readCard.hidden = true; sync();
  });
  fresh.addEventListener('click', async () => {
    await pending; if (awaitingPage) return; dirty = false; await invalidate(); if (awaitingPage) return;
    const p = await action('new-case', {}); if (p) { query.value = ''; year.value = ''; dirty = false; sync(); }
  });
  signal?.addEventListener('abort', () => { generation++; controller?.abort(); host.remove(); }, { once: true });
  sync();
  return { leave(page) { generation++; controller?.abort(); busy = false; dirty = false; candidates.replaceChildren(); preview.replaceChildren(); clearCard();
    awaitingPage = !page; if (page) { workflow = page; accountingUnknown = false; } sync(); } };
}
