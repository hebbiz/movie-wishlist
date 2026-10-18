// URL-only display, not Search attribution or offer normalization.
// REST field names: Candidate.urlContextMetadata.urlMetadata[].
export function urlDisplayParts(response, expectedURL) {
  if (!Array.isArray(response?.candidates) || response.candidates.length !== 1 || !response.candidates[0]) throw new Error('Empty or unsupported URL Context response; retrieval unknown.');
  const candidate = response.candidates[0];
  if (candidate.groundingMetadata?.searchEntryPoint) throw new Error('Unexpected Search Suggestions in URL-only mode; nothing displayed.');
  const metadata = candidate.urlContextMetadata;
  const entries = metadata?.urlMetadata;
  const statuses = new Set(['URL_RETRIEVAL_STATUS_SUCCESS', 'URL_RETRIEVAL_STATUS_ERROR', 'URL_RETRIEVAL_STATUS_PAYWALL', 'URL_RETRIEVAL_STATUS_UNSAFE', 'URL_RETRIEVAL_STATUS_UNSPECIFIED']);
  const validEntries = Array.isArray(entries) && entries.length > 0 && entries.every(entry => typeof entry?.retrievedUrl === 'string' && statuses.has(entry.urlRetrievalStatus));
  const matchingSuccess = validEntries && entries.length === 1 && entries[0].retrievedUrl === expectedURL && entries[0].urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS';
  const parts = candidate.content?.parts;
  const completeText = candidate.finishReason === 'STOP' && Array.isArray(parts) && parts.every(part => part && (part.thought || typeof part.text === 'string'));
  const text = completeText ? parts.filter(part => !part.thought).map(part => part.text).join('') : '';
  const retrievalNotice = matchingSuccess
    ? 'Provider reports retrieval success for the configured URL. Not proof of truth, freshness or Ukrainian entitlement.'
    : 'Retrieval failed, missing, unspecified, unsupported or does not match the single configured URL. Page reading is NOT established; do not treat the answer as verified.';
  return {
    text,
    metadata: metadata ?? null,
    attribution: candidate.citationMetadata ?? null,
    groundingAttribution: candidate.groundingMetadata ?? null,
    notice: `${retrievalNotice}${text.trim() ? '' : ' Empty, incomplete, blocked or unsupported answer; no partial text displayed. No continuation call.'}`,
    matchingSuccess,
  };
}

export function renderUrlMetadata(document, host, data, synthetic) {
  const heading = document.createElement('h3');
  heading.textContent = synthetic ? 'SYNTHETIC retrieval metadata — simulated, no page read' : 'Provider retrieval metadata';
  const notice = document.createElement('p');
  notice.textContent = data.notice;
  const raw = document.createElement('pre');
  raw.textContent = JSON.stringify(data.metadata, null, 2); // Display only, never persisted.
  host.replaceChildren(heading, notice, raw);
  if (data.attribution !== null) {
    const title = document.createElement('h3'); title.textContent = 'Provider citation metadata (unchanged)';
    const citations = document.createElement('pre'); citations.textContent = JSON.stringify(data.attribution, null, 2);
    host.append(title, citations);
  }
  if (data.groundingAttribution !== null) {
    const title = document.createElement('h3'); title.textContent = 'Provider grounding metadata (unchanged, not independently verified)';
    const grounding = document.createElement('pre'); grounding.textContent = JSON.stringify(data.groundingAttribution, null, 2);
    host.append(title, grounding);
  }
}
