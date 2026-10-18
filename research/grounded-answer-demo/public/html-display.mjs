// Extracted strings are untrusted text, never HTML, hyperlinks or resource URLs.
export function renderHtmlResult(document, host, result, synthetic) {
  host.replaceChildren();
  const add = (tag, value) => { const n = document.createElement(tag); n.textContent = value; host.append(n); };
  add('p', `${synthetic ? 'SYNTHETIC ONLY — authored HTML, no page fetched. ' : ''}Status: ${result.status}. Candidate links are not availability, entitlement, prices or localization.`);
  add('pre', JSON.stringify({ identity: result.identity ?? null, httpStatus: result.httpStatus ?? null, issues: result.issues ?? [] }, null, 2));
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
