// Page memory only. Never stores, submits, resolves URLs or rewrites source data.
const value = f => f?.state === 'reported' ? String(f.value) : `[${f?.state ?? 'unknown'}]`;
const audio = f => f?.ukrainian?.length ? 'Ukrainian listed (source claim)' : 'Unknown; missing/empty/incomplete list is not absence';

export function prepareDraft(result, row, trackingAcknowledged = false) {
  if (!result.rows.includes(row) || row.identityStatus !== 'matched') throw new Error('Select an independently identity-gated row.');
  const ids = { coherence: 'tt2866360', 'dune-part-two': 'tt15239678' };
  const exact = row.link.kind === 'exact-card-unverified';
  const tracking = row.link.kind === 'tracking-redirect' && trackingAcknowledged;
  const purchaseURL = row.link.transferable && (exact || tracking) ? row.link.href : '';
  return { fields: { imdb_url: `https://www.imdb.com/title/${ids[result.film.id]}/`,
    title: result.film.title.replace(/ \(\d{4}\)$/, ''), year: result.film.id === 'coherence' ? '2013' : '2024',
    recommended_medium: row.provider.medium, purchase_url: purchaseURL, status: 'wishlist' },
    sidecar: { source: row.provenance, provider: row.provider, linkKind: row.link.kind, territory: row.country ?? 'unknown',
      access: row.access, package: row.package, cut: row.cut, identity: row.identityStatus,
      commonIdentity: result.identity.status, conflicts: row.conflicts,
      titleBasis: 'Fixed verified film catalogue; original film year, not inferred regional release year.',
      availability: row.availability, accountEntitlement: 'unknown',
      excluded: ['Price/currency (including anomalies), audio, subtitles, video, ownership/account/group fields and all unreported characteristics.'] } };
}

export async function mountDiscovery(document, initial, { signal, fetchImpl = fetch } = {}) {
  const el = id => document.getElementById(id), button = el('run');
  let session = initial, result = null, confirmed = null, reviewRow = null, loading = false;
  const used = new Set();
  const add = (host, tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; host.append(n); return n; };
  el('film').textContent = 'UA discovery — two fixed films';
  el('director').textContent = 'Independent source gates; not a production MW transfer.';
  el('discovery').textContent = 'Country UA · priority: availability → Ukrainian audio → Ukrainian subtitles → video → price';
  el('retrieval-mode').textContent = `DEMO_RETRIEVAL=ua-discovery · Kinobaza ${session.kinobaza}`;
  el('settings').textContent = `${session.sources.join(' + ')} · max ${session.requestBudget} HTTP requests/film · no retries, LLM or storage`;
  el('mode').textContent = session.mode === 'synthetic' ? 'SYNTHETIC ONLY — invented source responses, links and fields. No external requests or real offers.' : 'LIVE — manually initiated fixed source requests. Source claims are not entitlement. Current source-use readiness remains conditional.';
  el('operation-label').textContent = 'Bounded source operations (no model prompt)';
  el('prompt').textContent = session.operation;
  el('service-notice').textContent = 'Partial results are retained. No best-option claim when key fields are unknown. TMDb failure does not block fixed-ID MOTN. No source value is corrected from historical controls. Local draft only; nothing is saved or sent to production MW.';
  el('service-terms').href = 'https://www.themoviedb.org/api-terms-of-use'; el('service-terms').textContent = 'TMDb applicable terms review';
  el('provider-docs').href = 'https://developers.movieofthenight.com/terms-and-conditions'; el('provider-docs').textContent = 'MOTN terms';
  el('result-heading').textContent = 'Source-labelled viewing leads — not verified entitlement';
  el('result').setAttribute('aria-label', 'UA discovery, independent source claims and local draft');
  const pickerHost = document.createElement('p'); pickerHost.className = 'discovery-ui';
  const pickerLabel = add(pickerHost, 'label', 'Film '); const picker = add(pickerLabel, 'select'); picker.id = 'discovery-film';
  for (const film of session.films) { const option = add(picker, 'option', film.title); option.value = film.id; }
  picker.value = session.film.id; button.before(pickerHost);
  const requestDetails = add(pickerHost, 'details'); add(requestDetails, 'summary', 'Exact fixed requests (no credentials)'); const planned = add(requestDetails, 'pre');
  const chosen = add(pickerHost, 'p'); chosen.id = 'discovery-chosen';
  const syncChoice = () => { chosen.textContent = `${session.film.title} · ${session.film.director} · UA · Kinobaza ${session.kinobaza} · budget ${session.requestBudget}`; planned.textContent = session.plannedRequests.join('\n'); button.disabled = loading || used.has(session.film.id); button.textContent = used.has(session.film.id) ? 'Used for this film — choose the other film' : 'Discover selected film once'; };
  const panes = add(el('result'), 'div'); panes.className = 'discovery-ui';
  const review = add(panes, 'section'); review.id = 'draft-review'; review.hidden = true;
  const draft = add(panes, 'section'); draft.id = 'local-draft'; draft.hidden = true;
  const hideReview = () => { review.replaceChildren(); review.hidden = true; reviewRow = null; };
  const showDraft = prepared => {
    confirmed = prepared; draft.replaceChildren(); draft.hidden = false;
    add(draft, 'h3', 'Editable local draft — NOT production MW; page memory only');
    const form = add(draft, 'form'); form.addEventListener('submit', e => e.preventDefault());
    for (const [name, text] of Object.entries(prepared.fields)) {
      const label = add(form, 'label', name); const input = add(label, 'input'); input.name = name; input.value = text;
      if (name === 'status') input.readOnly = true;
    }
    const details = add(draft, 'details'); add(details, 'summary', 'Research evidence sidecar / excluded fields (not MW schema)'); add(details, 'pre', JSON.stringify(prepared.sidecar, null, 2));
    const cancel = add(draft, 'button', 'Cancel edits — restore confirmed draft'); cancel.type = 'button'; cancel.id = 'draft-cancel-edits';
    cancel.addEventListener('click', () => showDraft(confirmed));
    const clear = add(draft, 'button', 'Clear local draft'); clear.type = 'button'; clear.id = 'draft-clear';
    clear.addEventListener('click', () => { confirmed = null; draft.replaceChildren(); draft.hidden = true; });
  };
  const select = row => {
    hideReview(); reviewRow = row; review.hidden = false;
    add(review, 'h3', `Review included fields — ${row.provider.name}`);
    add(review, 'p', 'Review then explicitly confirm. Existing draft is unchanged until confirmation. This is not a verified offer or production MW write.');
    const included = add(review, 'pre'); included.id = 'draft-included';
    let tracking;
    if (row.link.kind === 'tracking-redirect') {
      const label = add(review, 'label'); tracking = add(label, 'input'); tracking.type = 'checkbox'; tracking.id = 'draft-tracking-ack';
      label.append(document.createTextNode(' I explicitly accept this opaque tracking candidate with its original URL/type/provenance; destination and entitlement unverified.'));
    }
    const refresh = () => { const prepared = prepareDraft(result, row, tracking?.checked ?? false); included.textContent = JSON.stringify(prepared, null, 2); };
    tracking?.addEventListener('change', refresh); refresh();
    if (!row.link.transferable) add(review, 'p', 'No permitted exact/tracking candidate: purchase_url stays empty. Watch/search/relative/unsafe/unknown URLs are not substituted.');
    const confirm = add(review, 'button', 'Confirm to local draft'); confirm.id = 'draft-confirm'; confirm.type = 'button';
    confirm.addEventListener('click', () => { const prepared = prepareDraft(result, reviewRow, tracking?.checked ?? false); showDraft(prepared); hideReview(); });
    const cancel = add(review, 'button', 'Cancel selection'); cancel.type = 'button'; cancel.id = 'draft-review-cancel'; cancel.addEventListener('click', hideReview);
  };
  const render = data => {
    const host = el('answer'); host.replaceChildren();
    if (data.synthetic) add(host, 'p', 'SYNTHETIC ONLY — invented data; not live validation or real source offers.');
    add(host, 'p', data.limits);
    add(host, 'p', `Identity: ${data.identity.status}. ${data.identity.conflicts.length ? `Conflicting stable IDs: ${data.identity.conflicts.join(', ')}. Results remain independent; no common identity.` : data.identity.note}`);
    add(host, 'p', `HTTP calls: ${data.metrics.requestsMade}/${data.metrics.requestBudget} · elapsed ${data.metrics.elapsedMs}ms (not a cost estimate)`);
    for (const source of data.sources) add(host, 'p', `${source.source}: ${source.status} · identity ${source.identity} · ${source.elapsedMs}ms`);
    if (!data.rows.length) add(host, 'p', 'No usable rows from selected sources. This is not proof of unavailability.');
    for (const [label, rows] of [['UA source context', data.rows.filter(r => r.country === 'UA')], ['Territory unknown — not a UA offer claim', data.rows.filter(r => r.country !== 'UA')]]) {
      add(host, 'h3', label);
      for (const row of rows) {
        const card = add(host, 'article'); card.className = 'discovery-card'; card.dataset.rowId = row.id;
        add(card, 'h4', `${row.provider.name} · ${value(row.access)} · ${row.kind}`);
        add(card, 'p', `Availability: ${row.availability.state} — ${row.availability.note} · account entitlement unknown`);
        add(card, 'p', `UA audio: ${audio(row.audio)} · UA subtitles: ${audio(row.subtitles)}`);
        add(card, 'p', `Video: ${value(row.quality)} · HDR10 ${value(row.hdr10)} · Dolby Vision ${value(row.dolbyVision)}`);
        add(card, 'p', `Price: ${value(row.price?.amount)} ${value(row.price?.currency)} (literal source; currency/quality anomalies are not corrected)`);
        add(card, 'p', `Source: ${row.provenance.source} · ${row.provenance.receivedAt ?? 'receipt time unknown'} · ${row.territoryBasis}`);
        add(card, 'p', `Choice basis: ${row.choiceBasis.join('; ')} Missing key facts prevent a best-option claim.`);
        add(card, 'p', `Link: ${row.link.kind} · ${row.link.href ?? 'not reported'}${row.conflicts.length ? ' · CONFLICT / possible conflict — inspect details' : ''}`);
        if (row.link.transferable) { const link = add(card, 'a', 'Open candidate explicitly (not verified)'); link.href = row.link.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; }
        const details = add(card, 'details'); add(details, 'summary', 'Field provenance, unknowns and conflicts'); add(details, 'pre', JSON.stringify(row, null, 2));
        const button = add(card, 'button', 'Select and review'); button.type = 'button'; button.addEventListener('click', () => select(row));
      }
    }
    const details = add(host, 'details'); add(details, 'summary', `Source details / unmapped (${data.unmapped.length}) / catalogue (not provider tracks)`); add(details, 'pre', JSON.stringify({ stages: data.stages, unmapped: data.unmapped }, null, 2));
  };
  const credits = add(panes, 'section'); credits.id = 'discovery-credits';
  const { renderTmdbCredits } = await import('./tmdb-display.mjs'); renderTmdbCredits(document, credits);
  const attribution = add(credits, 'p', 'Streaming availability information provided by ');
  const motn = add(attribution, 'a', 'Streaming Availability API by Movie of the Night'); motn.href = 'https://www.movieofthenight.com/about/api'; motn.rel = 'noreferrer';
  const kino = add(credits, 'p', 'Candidate hrefs: Kinobaza; country sections may share JustWatch lineage. No independent confirmation or destination fetching. ');
  const terms = add(kino, 'a', 'Kinobaza terms'); terms.href = 'https://kinobaza.com.ua/terms'; terms.rel = 'noreferrer';
  picker.addEventListener('change', async () => {
    if (loading) return; loading = true; syncChoice(); picker.disabled = true;
    try {
      const response = await fetchImpl(`/session?film=${encodeURIComponent(picker.value)}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('Fixed-film session unavailable.');
      session = await response.json(); result = null; confirmed = null; hideReview(); draft.replaceChildren(); draft.hidden = true;
      el('answer').replaceChildren(); el('result').hidden = true;
    } catch { el('status').textContent = 'Film session failed. Reload; no source request was made.'; button.disabled = true; return; }
    finally { loading = false; picker.disabled = false; }
    el('status').textContent = 'Film selected; no source request until click.'; syncChoice();
  });
  button.addEventListener('click', async () => {
    if (loading || used.has(session.film.id)) return;
    used.add(session.film.id); loading = true; picker.disabled = true; syncChoice();
    el('status').textContent = 'Discovering fixed film once; no retries or destination requests.';
    try {
      const response = await fetchImpl('/answer', { method: 'POST', headers: { 'x-demo-session': session.token }, cache: 'no-store', signal });
      const payload = await response.json(); if (!response.ok) throw new Error('Discovery failed.');
      if (signal?.aborted) return;
      result = payload.result; render(result); el('result').hidden = false;
      el('status').textContent = 'Finished; inspect source claims/unknowns. Select another film in the same server; no automatic rerun.';
    } catch { if (!signal?.aborted) el('status').textContent = 'Discovery failed/invalid response. No automatic retry.'; }
    finally { loading = false; picker.disabled = false; syncChoice(); }
  });
  document.defaultView.addEventListener('pagehide', () => { result = null; confirmed = null; reviewRow = null; panes.replaceChildren(); pickerHost.remove(); }, { once: true });
  syncChoice();
}
