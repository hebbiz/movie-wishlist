// Transient text-only result. No raw HTML, hrefs, external resources or handlers.
export function renderMegogoResult(document, host, result, synthetic) {
  host.replaceChildren();
  const add = (tag, value, parent = host) => { const node = document.createElement(tag); node.textContent = value; parent.append(node); return node; };
  if (synthetic) add('p', 'SYNTHETIC ONLY — authored HTML and invented characteristics. No network or real MEGOGO availability/metadata check.');
  add('p', `Source: ${result.source} · Received: ${result.receivedAt} · HTTP: ${result.httpStatus ?? 'not-requested'} · Retrieval: ${result.status}`);
  add('p', `Fixed source: ${result.sourceURL}`);
  add('p', `Fetcher geography: ${result.fetcherGeography.state}. ${result.fetcherGeography.basis}`);
  add('p', `Identity: ${result.identity.status}; observed native IDs: ${(result.identity.observed.nativeIds ?? []).join(', ') || 'unknown'}`);
  if (result.identity.observed.titles?.length) add('p', `Observed title/year: ${result.identity.observed.titles.join('; ')} / ${result.identity.observed.years.join('; ') || 'unknown'}`);
  add('p', `Account entitlement: ${result.accountEntitlement.state}. ${result.accountEntitlement.note} Public-card characteristics below are not hidden for lack of login, but are not guaranteed UA/account offers. /ua/ and UI language do not establish that.`);
  const fields = (entries, parent = host) => {
    for (const [key, field] of Object.entries(entries)) {
      add('p', `${key}: ${field.state}${field.observations.length ? '' : ` — ${field.note}`}`, parent);
      for (const claim of field.observations) add('pre', `${JSON.stringify(claim.value)}\nEvidence: ${claim.evidence.kind} · ${claim.evidence.locator}`, parent);
    }
  };
  add('h3', 'Public-card fields — not copied across offers'); fields(result.cardFields);
  for (const [i, offer] of result.offers.entries()) { add('h3', `Separate source offer ${i + 1}: ${offer.status}`); fields(offer.fields); }
  add('p', 'Missing is unknown, not absent. HD does not exclude 4K; UHD is not HDR10/Dolby Vision. Locale is not codec/channels; list completeness is unknown. Regional statements are source claims, not egress geolocation or account entitlement.');
  if (result.issues.length) add('pre', result.issues.join('\n'));
}
