import { displayParts, renderAnswer, renderSuggestions, once } from './display.mjs';
import { urlDisplayParts, renderUrlMetadata } from './url-display.mjs';

const el = id => document.getElementById(id);
const button = el('run');
const lifetime = new AbortController();
const clear = () => {
  el('answer').replaceChildren();
  el('suggestions').shadowRoot?.replaceChildren();
  el('retrieval-result').replaceChildren();
  el('result').hidden = true;
};
// Avoid retaining a rendered answer when navigating away/back via bfcache.
window.addEventListener('pagehide', () => { lifetime.abort(); clear(); });

try {
  const response = await fetch('/session', { cache: 'no-store', signal: lifetime.signal });
  if (!response.ok) throw new Error('Local session unavailable. Reload the page.');
  const session = await response.json();
  const urlOnly = session.retrieval === 'url-context';
  const htmlOnly = session.retrieval === 'kinobaza-html';
  el('film').textContent = `${session.urlSource === 'kinobaza' ? 'Kinobaza candidate links:' : session.discovery === 'physical' ? 'A physical edition of' : 'Digital viewing in Ukraine:'} ${session.film.title}`;
  el('director').textContent = `Director: ${session.film.director} · DEMO_FILM: ${session.film.id}`;
  el('discovery').textContent = `DEMO_DISCOVERY: ${session.discovery} · DEMO_AMAZON_REGION: ${session.amazonRegion ?? (session.discovery === 'physical' ? 'unset — HMV, Rarewaves, equal Amazon US/UK/DE/IT' : 'not applicable')}`;
  el('retrieval-mode').textContent = `DEMO_RETRIEVAL: ${session.retrieval}${urlOnly ? ` · DEMO_URL_SOURCE: ${session.urlSource}` : ''}`;
  el('source-url').hidden = !(urlOnly || htmlOnly);
  el('source-url').textContent = urlOnly || htmlOnly ? `Fixed public card URL: ${session.sourceURL}` : '';
  if (urlOnly) {
    el('provider-docs').href = 'https://ai.google.dev/gemini-api/docs/generate-content/url-context';
    el('provider-docs').textContent = 'URL Context documentation';
    el('result').setAttribute('aria-label', 'Original Gemini response and URL retrieval metadata');
  }
  el('mode').textContent = session.mode === 'synthetic'
    ? 'SYNTHETIC MODE — invented display fixture. No Gemini request, retailer or platform check.'
    : 'LIVE MODE — clicking sends one billable Gemini API request. No automatic retries.';
  el('settings').textContent = `Model: ${session.model} · maxOutputTokens: ${session.maxOutputTokens} · thinking: low`;
  el('prompt').textContent = htmlOnly ? session.operation : session.prompt;
  if (htmlOnly) {
    el('operation-label').textContent = 'Fixed HTML operation — no model prompt';
    el('service-notice').textContent = 'One initial-HTML GET to the fixed source; no model, cookies, scripts, destination requests or persistence. Candidate is not an available offer.';
    for (const id of ['service-terms', 'provider-docs']) { el(id).href = 'https://kinobaza.com.ua/terms'; el(id).textContent = 'Kinobaza public terms'; }
    el('mode').textContent = session.mode === 'synthetic' ? 'SYNTHETIC MODE — invented HTML/providers, no network.' : 'LIVE HTML MODE — one source GET only after your click. No API key or Gemini.';
    el('settings').textContent = `Initial HTML only · timeout ${session.htmlTimeoutMs} ms · max ${session.htmlLimitBytes} bytes · no model`;
    el('result-heading').textContent = 'HTML candidate extraction (not offer verification)';
    el('result').setAttribute('aria-label', 'HTML identity, candidate links and unresolved fields');
  }
  button.textContent = session.mode === 'synthetic' ? 'Show synthetic answer once' : 'Send fixed prompt once';
  if (htmlOnly) button.textContent = session.mode === 'synthetic' ? 'Parse synthetic HTML once' : 'Fetch fixed source once';
  button.disabled = false;
  button.addEventListener('click', once(async () => {
    button.disabled = true;
    button.textContent = 'Used — reload for a new session';
    el('status').textContent = htmlOnly ? 'Waiting… One HTML GET, no redirects, retries or destination requests.' : urlOnly ? 'Waiting… One URL Context request, no Google Search or retries.' : 'Waiting… One API request can involve multiple internal search queries.';
    try {
      const response = await fetch('/answer', { method: 'POST', headers: { 'x-demo-session': session.token }, cache: 'no-store', signal: lifetime.signal });
      const payload = await response.json();
      if (lifetime.signal.aborted) return;
      if (!response.ok) throw new Error(payload.error || 'Local request failed.');
      if (htmlOnly) {
        const { renderHtmlResult } = await import('./html-display.mjs');
        if (lifetime.signal.aborted) return;
        renderHtmlResult(document, el('answer'), payload.result, session.mode === 'synthetic');
        el('result').hidden = false;
        el('status').textContent = `${session.mode === 'synthetic' ? 'SYNTHETIC. ' : ''}HTML result: ${payload.result.status}; no destination fetched. Reload for a new session.`;
        return;
      }
      if (urlOnly) {
        const data = urlDisplayParts(payload.response, session.sourceURL);
        el('answer').textContent = data.text;
        renderUrlMetadata(document, el('retrieval-result'), data, session.mode === 'synthetic');
        el('result').hidden = false;
        el('status').textContent = `${session.mode === 'synthetic' ? 'SYNTHETIC — no page read. ' : ''}${data.notice} Reload for a new request.`;
        return;
      }
      const data = displayParts(payload.response);
      // Prepare both before revealing either; no partial/uncited fallback display.
      const answer = renderAnswer(document, data);
      renderSuggestions(document, el('suggestions'), data.suggestions);
      el('answer').replaceChildren(answer);
      el('result').hidden = false;
      el('status').textContent = 'Finished. Original answer with citation markers and associated suggestions below. Not independently verified. Reload for a new request.';
    } catch (error) {
      clear();
      // Only local errors or the server's fixed, content-free error messages.
      el('status').textContent = `${error instanceof TypeError || error instanceof SyntaxError ? 'Network or invalid JSON response.' : error.message} Reload for a new request.`;
    }
  }));
} catch {
  el('status').textContent = 'Local session setup failed. No Gemini request was made. Reload the page.';
}
