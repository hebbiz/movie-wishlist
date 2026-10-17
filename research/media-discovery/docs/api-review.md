# Gemini API review

Reviewed October 17, 2026. These are documentation observations, not a successful
API capability probe. Live credentials were absent.

| Topic | Decision and primary source |
| --- | --- |
| Model | Configure `GEMINI_MODEL=gemini-3.8-flash`. The [model guide](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8) documents this exact ID and `low` thinking. Older 2.5 models have restricted access for new projects. |
| Endpoint | One `POST /v1beta/models/{model}:generateContent` using built-in fetch, API key in `x-goog-api-key`. This API is now labelled Legacy in Google's documentation; migration risk is recorded, not hidden behind an SDK alias. |
| Grounding | [Generate Content Search guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search) documents `googleSearch`, `groundingChunks`, `groundingSupports`, `webSearchQueries`, and `searchEntryPoint`. |
| JSON and tools | [Structured output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) documents Search plus structured output for Gemini 3/4 as a preview capability. Use `generationConfig.responseFormat.text` with MIME type and schema. Local validation remains mandatory. |
| Parameters | `maxOutputTokens=8192`, `thinkingLevel=low`; no temperature, topP, topK or candidateCount. Actual `modelVersion`, parameters and prompt/schema hashes go in the run artifacts. A differently configured model receives no inherited price estimate. |
| Usage | [API reference](https://ai.google.dev/api/generate-content) describes `usageMetadata`, including prompt, candidate, thought, tool-use and total tokens. Keep original metadata. Query-array length is reported separately from the unknown actual internal/billed search count. |

## Pricing snapshot

The [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists standard
text rates for Gemini 3.8 Flash through December 31, 2026: USD 0.75 per million
input tokens, USD 3.75 per million output tokens including thinking. Search is
USD 14 per thousand queries after the shared monthly allowance of 5,000 queries.
The page lists higher token prices from January 1, 2027; estimates expire then.

The PoC calculates only a partial list-rate token estimate when the necessary
usage fields exist. It exposes a search-price scenario for reported queries,
but does not label it the actual charge or a complete total. Account tier,
remaining allowance, internal searches, tool-use/caching and error charges can
change billing. Missing telemetry is null, not zero. No measured API cost is
available for this offline experiment.

## Attribution, storage and research fit

The [Gemini API terms, Google Search section](https://ai.google.dev/gemini-api/terms)
require associated Search Suggestions when displaying grounded results and
restrict caching, analysis, automated collection and modification. Storage
exceptions concern particular display/chat/legal uses; a general research
dataset/archive is not assumed to qualify. Google also describes its own
30-day processing retention, which does not grant developer storage rights.

Consequently this PoC's intended raw archive, normalized field comparison and
evaluation require an appropriate written permission/contract basis before live
execution. `GEMINI_GROUNDING_PERMISSION_REF` records the reference to that basis;
setting a variable does not grant permission or establish compliance. The owner
must verify that the actual grant covers these uses, retention and display.
No such permission was provided in this experiment. Live remains unexecuted.
This is an API/product-fit constraint to resolve before expansion.

Local raw JSON preserves the full response and Search Suggestions, subject only
to secret redaction. It is not an attributed consumer UI. Any later display must
respect the applicable permission and original text, citations, suggestions and
destination behavior. Do not publicly commit live raw responses. Do not use
grounded links as a crawl queue. The PoC performs no retailer fetching, redirect
resolution, CAPTCHA interaction, sign-in or page scraping.
