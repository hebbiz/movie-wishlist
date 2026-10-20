// Page memory only. Never stores, submits, resolves URLs or rewrites source data.
import { buildShortReport, writeShortReport, relationText, sourceLabel, comparisonSummary } from './discovery-report.mjs';
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

export function prepareDraft(result, row, trackingAcknowledged = false) {
  if (!result.rows.includes(row) || row.identityStatus !== 'matched') throw new Error('Select an independently identity-gated row.');
  const ids = { coherence: 'tt2866360', 'dune-part-two': 'tt15239678',
    'kingdom-of-heaven': 'tt0320661', 'the-thing-1982': 'tt0084787', 'the-thing-2011': 'tt0905372', parasite: 'tt6751668' };
  const years = { coherence: '2013', 'dune-part-two': '2024', 'kingdom-of-heaven': '2005', 'the-thing-1982': '1982', 'the-thing-2011': '2011', parasite: '2019' };
  if (!Object.hasOwn(ids, result.film.id)) throw new Error('Fixed draft film required.');
  const acknowledgementRequired = needsLinkAcknowledgement(row.link);
  const purchaseURL = linkPresentation(row.link).canOpen && (!acknowledgementRequired || trackingAcknowledged) ? row.link.href : '';
  return { fields: { imdb_url: `https://www.imdb.com/title/${ids[result.film.id]}/`,
    title: result.film.title.replace(/ \(\d{4}\)$/, ''), year: years[result.film.id],
    recommended_medium: row.provider.medium, purchase_url: purchaseURL, status: 'wishlist' },
    sidecar: { rowId: row.id, source: row.provenance, provider: row.provider, linkKind: row.link.kind, linkAudit: row.linkAudit ?? null,
      linkPolicy: { originalURL: row.link.href, referral: row.link.referral ?? null, acknowledgementRequired, acknowledged: acknowledgementRequired && trackingAcknowledged }, territory: row.country ?? 'unknown',
      kinobazaLocalization: row.kinobazaLocalization ?? null, countrySignal: row.countrySignal ?? null,
      access: row.access, package: row.package, cut: row.cut, identity: row.identityStatus,
      commonIdentity: result.identity.status, conflicts: row.conflicts, comparisons: row.comparisons ?? [],
      titleBasis: 'Fixed verified film catalogue; original film year, not inferred regional release year.',
      availability: row.availability, accountEntitlement: 'unknown',
      excluded: ['Price/currency (including anomalies), audio, subtitles, video, ownership/account/group fields and all unreported characteristics.'] } };
}

export async function mountDiscovery(document, initial, { signal, fetchImpl = fetch } = {}) {
  const el = id => document.getElementById(id), button = el('run');
  let session = initial, result = null, reviewRow = null, loading = false;
  let generation = 0, reportReady = false, reportFailed = false, receivedAt = null;
  const emptyDraftState = () => ({ present: false, confirmed: false, edited: false, selectionCancelled: false, cleared: false });
  let draftState = emptyDraftState();
  const used = new Set();
  const add = (host, tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; host.append(n); return n; };
  el('film').textContent = `UA discovery — ${session.films.length} fixed films`;
  el('director').textContent = 'Independent source gates; not a production MW transfer.';
  el('discovery').textContent = 'Country UA · priority: availability → Ukrainian audio → Ukrainian subtitles → video → price';
  el('retrieval-mode').textContent = `DEMO_RETRIEVAL=ua-discovery · Kinobaza ${session.kinobaza}`;
  el('settings').textContent = `${session.sources.join(' + ')} · max ${session.requestBudget} HTTP requests/film (${session.baseRequestBudget} without redirect) · no retries, LLM or storage`;
  el('mode').textContent = session.mode === 'synthetic' ? 'SYNTHETIC ONLY — invented source responses, links and fields. No external requests or real offers.' : 'LIVE — manually initiated fixed source requests. Source claims are not entitlement. Current source-use readiness remains conditional.';
  el('operation-label').textContent = 'Bounded source operations (no model prompt)';
  el('prompt').textContent = session.operation;
  el('service-notice').textContent = 'Source claims/candidate links are not account entitlement or full coverage. Unknown is not absent; empty language lists prove no absence. Source prices/formats are unverified, never corrected from owner controls. No best-option claim. Local draft only; no production writes or storage.';
  el('prompt').parentElement.open = false;
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
  const syncChoice = () => {
    el('retrieval-mode').textContent = `DEMO_RETRIEVAL=ua-discovery · Kinobaza ${session.kinobaza}`;
    el('settings').textContent = `${session.sources.join(' + ')} · max ${session.requestBudget} HTTP requests/film (${session.baseRequestBudget} without redirect) · no retries, LLM or storage`;
    el('prompt').textContent = session.operation;
    chosen.textContent = `${session.film.title} · ${session.film.director} · UA · Kinobaza ${session.kinobaza} · budget ${session.requestBudget} (${session.baseRequestBudget} without redirect)`;
    planned.textContent = [...session.plannedRequests, ...(session.conditionalRequests ?? []).map(url => `Conditional canonical GET only after validated redirect: ${url}`)].join('\n');
    button.disabled = loading || used.has(session.film.id); button.textContent = used.has(session.film.id) ? 'Used for this film — choose another film' : 'Discover selected film once';
  };
  const panes = add(el('result'), 'div'); panes.className = 'discovery-ui';
  const review = add(panes, 'section'); review.id = 'draft-review'; review.hidden = true;
  const draft = add(panes, 'section'); draft.id = 'local-draft'; draft.hidden = true;
  const report = add(panes, 'section'); report.id = 'short-report';
  const copy = add(report, 'button', 'Copy short report'); copy.id = 'report-copy'; copy.type = 'button'; copy.disabled = true;
  const reportStatus = add(report, 'p'); reportStatus.id = 'report-status'; reportStatus.setAttribute('role', 'status');
  const fallback = add(report, 'div'); fallback.id = 'report-fallback'; fallback.hidden = true;
  const label = add(fallback, 'label', 'Short report — select and copy manually');
  const reportText = add(label, 'textarea'); reportText.id = 'report-text'; reportText.readOnly = true; reportText.rows = 12;
  const selectText = add(fallback, 'button', 'Select report text'); selectText.type = 'button';
  selectText.addEventListener('click', () => { reportText.focus(); reportText.select(); });
  add(report, 'p', 'Explicit copy exports to your device clipboard, which may outlive this page. No raw responses, secrets or draft contents.');
  const resetReport = () => { generation++; reportReady = false; copy.disabled = true; reportStatus.textContent = ''; reportText.value = ''; fallback.hidden = true; };
  copy.addEventListener('click', async () => {
    if (!reportReady || loading || copy.disabled) return;
    const at = generation;
    const text = buildShortReport({ filmId: session.film.id, mode: session.mode, receivedAt, result, failed: reportFailed, draft: draftState });
    copy.disabled = true; reportStatus.textContent = 'Copying…'; fallback.hidden = true;
    const outcome = await writeShortReport(text, document.defaultView.navigator);
    if (at !== generation || signal?.aborted) return;
    copy.disabled = false;
    if (outcome === 'copied') { reportStatus.textContent = 'Copied short report.'; reportText.value = ''; }
    else { reportText.value = text; fallback.hidden = false; reportStatus.textContent = 'Clipboard unavailable or denied. Select the text and copy manually.'; }
  });
  const hideReview = () => { review.replaceChildren(); review.hidden = true; reviewRow = null; };
  const showDraft = prepared => {
    draft.replaceChildren(); draft.hidden = false;
    draftState = { ...emptyDraftState(), present: true, confirmed: true };
    add(draft, 'h3', 'Editable local draft — NOT production MW; page memory only');
    const form = add(draft, 'form'); form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('input', () => { draftState.edited = true; });
    for (const [name, text] of Object.entries(prepared.fields)) {
      const label = add(form, 'label', name); const input = add(label, 'input'); input.name = name; input.value = text;
      if (name === 'status') input.readOnly = true;
    }
    const details = add(draft, 'details'); add(details, 'summary', 'Research evidence sidecar / excluded fields (not MW schema)'); add(details, 'pre', JSON.stringify(prepared.sidecar, null, 2));
    const clear = add(draft, 'button', 'Clear local draft'); clear.type = 'button'; clear.id = 'draft-clear';
    clear.addEventListener('click', () => { draft.replaceChildren(); draft.hidden = true; draftState = { ...emptyDraftState(), cleared: true }; });
  };
  const select = row => {
    hideReview(); reviewRow = row; review.hidden = false;
    add(review, 'h3', `Review included fields — ${row.provider.name} · ${row.provenance.source} · ${accessLabel(row.access)}`);
    add(review, 'p', 'Review then explicitly confirm. Existing draft is unchanged until confirmation. This is not a verified offer or production MW write.');
    const included = add(review, 'pre'); included.id = 'draft-included';
    const evidence = add(review, 'details'); add(evidence, 'summary', 'Excluded fields and provenance'); const sidecar = add(evidence, 'pre');
    let tracking;
    if (needsLinkAcknowledgement(row.link)) {
      const label = add(review, 'label'); tracking = add(label, 'input'); tracking.type = 'checkbox'; tracking.id = 'draft-tracking-ack';
      label.append(document.createTextNode(` I explicitly accept this ${row.link.kind === 'tracking-redirect' ? 'opaque tracking candidate' : 'provider-native referral candidate'} with its original URL/type/provenance; destination and entitlement unverified.`));
    }
    const refresh = () => { const prepared = prepareDraft(result, row, tracking?.checked ?? false); included.textContent = JSON.stringify(prepared.fields, null, 2); sidecar.textContent = JSON.stringify(prepared.sidecar, null, 2); };
    tracking?.addEventListener('change', refresh); refresh();
    const linkStatus = linkPresentation(row.link);
    add(review, 'p', `${linkStatus.summary} · ${linkStatus.navigation} · ${linkStatus.draft}. ${row.link.transferable ? 'Exact URL/type/provenance retained.' : 'purchase_url stays empty; no substitute URL.'}`);
    const confirm = add(review, 'button', 'Confirm to local draft'); confirm.id = 'draft-confirm'; confirm.type = 'button';
    confirm.addEventListener('click', () => { const prepared = prepareDraft(result, reviewRow, tracking?.checked ?? false); showDraft(prepared); hideReview(); });
    const cancel = add(review, 'button', 'Cancel selection'); cancel.type = 'button'; cancel.id = 'draft-review-cancel'; cancel.addEventListener('click', () => { draftState.selectionCancelled = true; hideReview(); });
  };
  const render = data => {
    const host = el('answer'); host.replaceChildren();
    if (data.synthetic) add(host, 'p', 'SYNTHETIC ONLY — invented data; not live validation or real source offers.');
    if (data.identity.conflicts.length) add(host, 'p', `Identity: ${data.identity.status}. Conflicting stable IDs: ${data.identity.conflicts.join(', ')}. Affected source withheld; no common identity.`);
    add(host, 'p', `HTTP calls: ${data.metrics.requestsMade}/${data.metrics.requestBudget} · elapsed ${data.metrics.elapsedMs}ms (not a cost estimate)`);
    const sourceSummary = add(host, 'p'); sourceSummary.id = 'discovery-source-status';
      sourceSummary.textContent = data.sources.map(s => s.status === 'disabled-no-request' ? `${s.source}: not evaluated — disabled by scenario` : `${s.source}: ${s.status} · identity ${s.identity}`).join(' | ');
    const subjects = add(host, 'details'); subjects.id = 'matching-subjects'; add(subjects, 'summary', 'A — source film identity evidence');
    for (const s of data.matching?.subjects ?? []) add(subjects, 'p', `${sourceLabel(s.source)}: ${relationText(s)}${s.yearVariance ? ' · Year variance retained; reason not inferred.' : ''}`);
    const matches = new Map((data.matching?.rows ?? []).map(m => [m.rowId, m]));
    if (data.filmLocalization?.ukrainianAudio?.state === 'reported-positive') add(host, 'p', 'Kinobaza film-level UA audio claim — not provider tracks.');
    if (!data.rows.length) add(host, 'p', 'No usable rows from selected sources. This is not proof of unavailability.');
    const grouped = groupProviderRows(data.rows);
    for (const group of grouped.groups) {
      const section = add(host, 'section'); section.className = 'provider-group'; section.dataset.provider = group.key;
      add(section, 'h3', group.name);
      const summary = add(section, 'p', `${providerSummary(group.rows)}. Separate observations, not one verified offer or shared territory.`); summary.className = 'provider-summary';
      for (const row of group.rows) {
        const card = add(section, 'article'); card.className = 'discovery-card'; card.dataset.rowId = row.id;
        add(card, 'h4', `${row.provenance.source} · ${accessLabel(row.access)}`);
        const scope = row.country === 'UA' ? 'UA source context' : 'Territory unknown — not a UA offer claim';
        const optional = [row.package?.name?.state === 'reported' ? `Package: ${value(row.package.name)}` : '', row.cut?.state === 'reported' ? `Cut: ${value(row.cut)}` : ''].filter(Boolean).join(' · ');
        add(card, 'p', `${scope} · ${row.kind === 'candidate-link' ? row.countrySignal ? 'candidate link / country-section claim (not entitlement)' : 'candidate link / availability unknown' : 'source availability claim'}${optional ? ` · ${optional}` : ''}`);
        const fields = compactFields(row);
        if (fields.known.length) add(card, 'p', fields.known.join(' · '));
        const comparison = comparisonSummary(row);
        add(card, 'p', `Unknown: ${fields.unknown.join(', ') || 'no missing summary fields'}${row.conflicts.length ? ' · CONFLICT — inspect details' : ''}${comparison ? ` · ${comparison}` : ''}`);
        const status = linkPresentation(row.link);
        add(card, 'p', `${status.summary} · ${status.navigation} · ${status.draft}`);
        const match = matches.get(row.id);
        if (match) {
          const summary = add(card, 'div'); summary.className = 'matching-summary';
          add(summary, 'span', `${row.provenance.source} · A: ${relationText(match.A)}.`);
          add(summary, 'span', `${row.provenance.source}${match.B.peer ? ` ↔ ${sourceLabel(match.B.peer.source)} (${match.B.peer.rowId})` : ''} · B: ${relationText(match.B)}.`);
          add(summary, 'span', 'Territory/access/version insufficient for enrichment. Separate rows; no localization transfer.');
          const why = add(card, 'details'); add(why, 'summary', 'A/B reasons and missing scope'); add(why, 'pre', JSON.stringify(match, null, 2));
        }
        if (status.canOpen) { const link = add(card, 'a', 'Open candidate explicitly (not verified)'); link.href = row.link.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; }
        const details = add(card, 'details'); add(details, 'summary', 'Field provenance, unknowns and conflicts'); add(details, 'pre', JSON.stringify(row, null, 2));
        const button = add(card, 'button', 'Select and review'); button.type = 'button';
        button.disabled = Boolean(match && (match.A.outcome !== 'compatible' || ['provider-id-conflict', 'provider-mapping-unresolved'].includes(match.B.reason)));
        button.addEventListener('click', () => select(row));
      }
    }
    if (data.unmapped.length || grouped.unmapped.length) {
      const section = add(host, 'section'); section.id = 'discovery-unmapped'; add(section, 'h3', 'Unmapped observations — no platform assignment');
      for (const item of data.unmapped) add(section, 'p', `${item.source}: ${item.name ?? '(name not reported)'} · ${item.reason === 'provider-id-conflict' ? `provider ID conflict (${item.sourceId}) — unresolved; no canonical access or draft selection` : 'provider mapping unresolved; not assigned to a Store/subscription group'}.`);
      const details = add(section, 'details'); add(details, 'summary', 'Unmapped source labels / access / reasons'); add(details, 'pre', JSON.stringify({ unmapped: data.unmapped, ungroupedRows: grouped.unmapped }, null, 2));
    }
    const details = add(host, 'details'); details.id = 'discovery-source-details'; add(details, 'summary', `Source diagnostics / unmapped (${data.unmapped.length}) / catalogue (not provider tracks)`); add(details, 'pre', JSON.stringify({ diagnostics: data.sources.map(s => ({ source: s.source, diagnostics: s.diagnostics })), calls: data.metrics.calls, stages: data.stages, unmapped: data.unmapped, limits: data.limits }, null, 2));
  };
  const credits = add(panes, 'section'); credits.id = 'discovery-credits';
  const { renderTmdbCredits } = await import('./tmdb-display.mjs'); renderTmdbCredits(document, credits);
  const attribution = add(credits, 'p', 'Streaming availability information provided by ');
  const motn = add(attribution, 'a', 'Streaming Availability API by Movie of the Night'); motn.href = 'https://www.movieofthenight.com/about/api'; motn.rel = 'noreferrer';
  const kino = add(credits, 'p', 'Candidate hrefs: Kinobaza; country sections may share JustWatch lineage. No independent confirmation or destination fetching. ');
  const terms = add(kino, 'a', 'Kinobaza terms'); terms.href = 'https://kinobaza.com.ua/terms'; terms.rel = 'noreferrer';
  picker.addEventListener('change', async () => {
    if (loading) return; loading = true; syncChoice(); picker.disabled = true;
    resetReport();
    try {
      const response = await fetchImpl(`/session?film=${encodeURIComponent(picker.value)}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('Fixed-film session unavailable.');
      session = await response.json(); result = null; hideReview(); draft.replaceChildren(); draft.hidden = true;
      draftState = emptyDraftState();
      el('answer').replaceChildren(); el('result').hidden = true;
    } catch { el('status').textContent = 'Film session failed. Reload; no source request was made.'; button.disabled = true; return; }
    finally { loading = false; picker.disabled = false; }
    el('status').textContent = 'Film selected; no source request until click.'; syncChoice();
  });
  button.addEventListener('click', async () => {
    if (loading || used.has(session.film.id)) return;
    used.add(session.film.id); loading = true; picker.disabled = true; syncChoice();
    resetReport(); reportFailed = false;
    el('status').textContent = 'Discovering fixed film once; no retries or destination requests.';
    try {
      const response = await fetchImpl('/answer', { method: 'POST', headers: { 'x-demo-session': session.token }, cache: 'no-store', signal });
      const payload = await response.json(); if (!response.ok) throw new Error('Discovery failed.');
      if (signal?.aborted) return;
      result = payload.result; render(result); el('result').hidden = false;
      el('status').textContent = 'Finished; inspect source claims/unknowns. Select another film in the same server; no automatic rerun.';
    } catch { if (!signal?.aborted) { result = null; reportFailed = true; el('answer').replaceChildren(); el('result').hidden = false; el('status').textContent = 'Discovery failed/invalid response. No automatic retry.'; } }
    finally { loading = false; picker.disabled = false; if (!signal?.aborted) { receivedAt = new Date().toISOString(); reportReady = true; copy.disabled = false; } syncChoice(); }
  });
  document.defaultView.addEventListener('pagehide', () => { resetReport(); result = null; reviewRow = null; draftState = emptyDraftState(); panes.replaceChildren(); pickerHost.remove(); }, { once: true });
  syncChoice();
}
