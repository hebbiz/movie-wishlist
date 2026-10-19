// Extracted strings are untrusted text, never HTML, hyperlinks or resource URLs.
export function renderHtmlResult(document, host, result, synthetic) {
  host.replaceChildren();
  const add = (tag, value) => { const n = document.createElement(tag); n.textContent = value; host.append(n); };
  add('p', `${synthetic ? 'SYNTHETIC ONLY — authored HTML, no page fetched. ' : ''}Status: ${result.status}. Candidate links alone are not availability, entitlement, prices or localization. Separate block claims are not verified offers.`);
  add('pre', JSON.stringify({ identity: result.identity ?? null, httpStatus: result.httpStatus ?? null, issues: result.issues ?? [] }, null, 2));
  const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Separate film / provider localization and country-section claims'; details.append(summary);
  const projected = document.createElement('pre'); projected.textContent = JSON.stringify({ localization: result.localization ?? null, availabilitySignals: result.availabilitySignals ?? [] }, null, 2); details.append(projected); host.append(details);
  const candidates = result.candidates ?? [];
  for (const [heading, entries] of [
    ['Explicit Ukraine section', candidates.filter(c => c.territory?.code === 'UA')],
    ['Other explicit territories', candidates.filter(c => c.territory && c.territory.code !== 'UA')],
    ['Territory unknown — outside country sections', candidates.filter(c => c.territory === null)],
  ]) {
    add('h3', heading);
    add('pre', entries.length ? JSON.stringify(entries, null, 2) : 'No candidates established in this group (not unavailability).');
  }
}
