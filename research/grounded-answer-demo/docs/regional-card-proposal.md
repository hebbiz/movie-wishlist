# Proposed next experiment: regional card first

Design only, October 18, 2026. MW-FUT-01 remains **Discovery**. No prompt,
runtime, model/settings, provider, output limit or integration is changed here.
The [owner observations](digital-ua-owner-validation.md) motivate narrower
questions, not an accuracy claim or a production recommendation.

## Proposed sequence and evidence boundaries

1. Discover a concrete regional card, not just a film/platform name. The owner
   independently locates the Ukrainian card in Safari; do not invent an ID or
   accept interface language/country URL alone as entitlement evidence.
2. Check film identity: title, film year, director and, for Blade Runner, explicit
   Final Cut identification. A different Apple ID requires reconciliation, not
   automatic acceptance/rejection. An unresolved cut remains unknown.
3. Check each aspect separately in its regional/account context: viewing
   availability; audio languages/formats; subtitle languages/types; 4K, HD,
   HDR10 and Dolby Vision individually; subscription/rental/purchase and price.
4. Retain **unknown** where evidence is missing or cannot be reproduced. A
   search miss is not unavailability; an incomplete list is not proven absence;
   an inaccessible URL is not proof of invalidity. Do not substitute typical
   distribution formats for direct evidence.
5. Keep original film language distinct from offered audio, an account's Play
   button distinct from new rental/purchase, and catalogue metadata distinct
   from that account's viewing entitlement. Never transfer global/foreign
   properties to the Ukrainian offer.

These are manual review questions, not a normalized schema, confidence engine,
automatic ranking or extraction pipeline. Keep audio before subtitles, then
video; preserve the existing Ukrainian-localization priorities.

## Two options, no integration selected

| Option | What a future approved iteration could change | Limit / decision gate |
| --- | --- | --- |
| A. Minimal prompt clarification + manual card check | Make card identity, account-playback versus new transaction, and separate field-level unknowns more explicit in the fixed prompt. Keep one original grounded answer and manual Safari checks. | Existing prompts already contain many safeguards; repetition may not fix retrieval omissions or unreliable citations. No guaranteed access to page content or account rights. |
| B. Separate check of one specific URL | Manual Safari reading is available now. A future API URL-reading stage is a candidate only after the checks below; it is not implemented or selected. | A URL retrieval success cannot establish Ukrainian account entitlement or claim correctness. Extra retrieval cannot be assumed permitted, current, regional or equivalent to logged-in Safari. |

### Official capabilities and terms checked October 18, 2026

- **Documented capability, not a permission grant:** the
  [GenerateContent URL Context guide](https://ai.google.dev/gemini-api/docs/generate-content/url-context)
  lists `gemini-3.8-flash`, supports supplied public URLs and combination with
  Google Search, and exposes retrieval URLs/status. Retrieval may use an index
  cache before a live-fetch fallback; success alone does not prove freshness.
  Login/paywall content is unsuitable. This is not the owner's authenticated
  Ukrainian Safari session; no regional entitlement guarantee is documented.
- **Explicit restrictions / narrow display use:** the
  [Gemini Search terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)
  require results with associated Suggestions for the initiating user in an
  owner-operated app. They restrict analysis/reuse/storage, with specific narrow
  exceptions, and prohibit extracting links for crawling/scraping. They constrain
  modification and link navigation. Those exceptions are not a blanket license
  for this experiment's normalization, evidence archive or evaluation dataset.
  Preserve original display and direct navigation; the
  [Client Application Guidelines](https://support.google.com/adsense/answer/10926790)
  also apply. Google-side retention is separate from local no-storage.
- **Third-party rights remain separate:** the
  [Google APIs terms, section 5](https://developers.google.com/terms#section_5_content)
  do not grant all rights to accessed third-party content. Source-site terms
  and applicable rights must be reviewed for any proposed automated access,
  extraction or retention. No Apple TV/MEGOGO scraping permission was established
  by this documentation review.
- **Unresolved:** technical support for Search + URL Context does not settle
  whether a particular discovery-to-URL follow-up or performance-analysis use is
  permitted under the applicable agreement. Clarify that scope with the owner
  and, where needed, the provider before an automated stage or broader evaluation.
  Do not harvest grounded links into a fetch queue, forward responses to another
  LLM, normalize/store them, bypass login/CAPTCHA, or assume silence is permission.

The guide documents a possible tool, not authorization to deploy it. No new
integration, scraper or provider is recommended automatically; no API migration
is implied by the docs labelling GenerateContent legacy.

## Recommended narrow PoC (proposed, not executed)

Prefer **A with an owner-operated exact-card check**, not an automated URL stage.
First resolve the permitted scope of this manual experiment under the terms
above; no broad quality-analysis permission is asserted. Then seek approval for
a small fixed-prompt clarification in a separate change. Retain current model,
settings, one-click/one-request behavior, original citations/Suggestions,
non-persistence and [iPhone workflow](iphone-windows.md). No arbitrary URL/input
UI, second model call, automatic fetch or new integration.

Limit the next owner session to Coherence / Apple TV and Dune / Apple TV, with
Blade Runner / Final Cut as an account-playback-versus-transaction boundary case.
At most one explicitly initiated request per case, no retries/batch. The owner
finds cards independently using the platform UI, not an automated grounded-link
collection. Inspect links manually without exporting output. If option A still
misses metadata, report unresolved fields; do not silently add option B.

### Acceptance criteria for that future iteration

- Correct regional card and film/cut are established or explicitly unresolved;
  neither country URL nor the presence of a citation alone passes the check.
- Availability, Ukrainian audio, Ukrainian subtitles, separate video properties
  and access type each have an offer-specific basis or remain unknown. Original
  language, a generic badge and typical HD distribution are not evidence.
- Account playback does not imply a new transaction/price. A list omission or
  failed URL does not become a definitive negative. Metadata and entitlement
  disagreements remain explicit, with regional/account context acknowledged.
- iPhone synthetic smoke test still works after explicit SSH disconnect; live
  execution is owner-only. Display remains intact, no answer archive/screenshot,
  scoring, normalized dataset, browser storage or response logging is added.
- Failure to meet a factual criterion is reported as a failure/unknown, not
  repaired by inference. Three cases do not establish general accuracy.

### Manual test plan (after separate approval, no calls in this update)

1. Use the same trusted home network and Ukrainian platform account from Ukraine,
   without VPN. Do not provide platform credentials/cookies to the demo or buy
   access solely for research. If territory is uncertain, stop that conclusion.
2. Follow the Windows/iPhone guide: inspect the correct checkout, start synthetic
   with hidden secrets, verify the printed IP URL and Basic username `demo`,
   disconnect SSH explicitly, reload Safari, and perform one synthetic attempt.
3. Independently open the regional card in the platform UI. Check Coherence's
   transaction buttons, HD, audio and previously unchecked subtitles; Dune's
   exact Apple card/ID, transactions, Ukrainian tracks and 4K/DV; Blade Runner's
   cut description, Play versus transaction controls, English/UA lists and 4K/DV.
   Do not assume the earlier prices or metadata remain current.
4. Only after approving the future prompt change and live use, stop/restart for
   each fixed film in `digital-ua`, unset `DEMO_AMAZON_REGION`, reload and inspect
   the full prompt before one click. Keep complete original answer/citations and
   Suggestions visible. Read the specific cited card manually; distinguish
   reproduced facts, non-reproduced claims and unknowns. Do not weaken auth or
   modify output to make a result look correct.
5. Discuss owner observations and gaps without copying live text/images or
   making an evidence archive. Optional latency timing is manual; usage/costs
   remain unknown unless measured, not zero. Stop the demo after the session.
   Do not expand to more platforms/films or automated URL retrieval without a
   separate decision. Amazon-region live checks remain a separate pending task.
