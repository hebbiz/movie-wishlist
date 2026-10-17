import { PRICING, RESPONSE_SCHEMA } from './config.mjs';

export function requestBody(prompt) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'low' },
      responseFormat: { text: { mimeType: 'application/json', schema: RESPONSE_SCHEMA } },
    },
  };
}

// Redact known environment secrets anywhere in nested response text; do not log headers.
export function redact(value, secrets = []) {
  let text = JSON.stringify(value);
  for (const secret of secrets.filter(s => typeof s === 'string' && s)) {
    const escaped = JSON.stringify(secret).slice(1, -1);
    text = text.split(escaped).join('[REDACTED]');
  }
  text = text.replace(/AIza[\w-]{20,}/g, '[REDACTED]')
    .replace(/([?&](?:key|api_key|token)=)[^&\s"\\]+/gi, '$1[REDACTED]');
  return JSON.parse(text);
}

// One logical generateContent call. A transient HTTP response may retry ONCE,
// so at most two HTTP attempts total per film, including the retry.
export async function groundedSearch({ model, key, body, fetchImpl = fetch, saveAttempt = async () => {},
  secrets = [], sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^gemini-3[.\w-]*$/.test(model)) throw new Error('Select a documented Gemini 3 model supporting Search + structured output');
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const start = performance.now();
    let response;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(90000),
      });
      const text = await response.text();
      let raw;
      try { raw = JSON.parse(text); } catch { raw = { invalidJsonBody: text }; }
      const record = { attempt, receivedAt: new Date().toISOString(), elapsedMs: performance.now() - start, status: response.status,
        raw: redact(raw, [key, ...secrets]), redacted: true };
      attempts.push(record);
      await saveAttempt(record);
      if (response.ok) return { raw: record.raw, attempts };
      if (attempt === 1 && [429, 500, 502, 503, 504].includes(response.status)) { await sleep(1000); continue; }
      const error = new Error(`Gemini HTTP ${response.status}`);
      error.attempts = attempts;
      throw error;
    } catch (error) {
      if (!attempts.some(a => a.attempt === attempt)) {
        const record = { attempt, elapsedMs: performance.now() - start, status: null,
          error: 'Network/timeout failure: outcome and billed usage unknown; no retry', raw: null };
        attempts.push(record);
        await saveAttempt(record);
      }
      const safeError = new Error(error.attempts ? error.message : 'Gemini transport/persistence failure; see attempt journal');
      safeError.attempts = attempts;
      throw safeError;
    }
  }
}

export function costEstimate(raw, model, mode, now = new Date().toISOString()) {
  const usage = raw?.usageMetadata || null;
  const queries = raw?.candidates?.[0]?.groundingMetadata?.webSearchQueries;
  const applicable = mode === 'live' && model === PRICING.model &&
    (!raw?.modelVersion || raw.modelVersion === model) && now.slice(0, 10) <= PRICING.validThrough;
  const numbers = [usage?.promptTokenCount, usage?.candidatesTokenCount, usage?.thoughtsTokenCount];
  const complete = numbers.every(n => Number.isInteger(n) && n >= 0) && !usage?.cachedContentTokenCount;
  const tokenEstimate = applicable && complete ?
    (numbers[0] * PRICING.inputPerMillion + (numbers[1] + numbers[2]) * PRICING.outputIncludingThinkingPerMillion) / 1e6 : null;
  return {
    usageMetadata: usage, reportedSearchQueryCount: Array.isArray(queries) ? queries.length : null,
    actualInternalSearchCount: null, pricing: PRICING,
    estimatedTokenUsd: tokenEstimate,
    // Query arrays are observable telemetry, not a billing ledger or complete internal trace.
    searchUsdIfReportedQueriesBillable: applicable && Array.isArray(queries) ? queries.length * PRICING.searchPerThousand / 1000 : null,
    estimatedTotalUsd: null, actualChargeUsd: null,
    note: mode !== 'live' ? 'Offline: no API calls, no token/cost measurement.' :
      'Partial list-rate estimate, not invoice cost. Search count completeness, free quota, tool-use billing, cached input and failed-attempt charges may be unknown.',
  };
}
