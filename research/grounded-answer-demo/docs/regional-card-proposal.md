# Proposed next experiment: regional card first

Design only, updated October 18, 2026 after two owner-run URL Context tests.
MW-FUT-01 remains **Discovery**. No prompt,
runtime, model/settings, provider, output limit or integration is changed here.
The [owner observations](digital-ua-owner-validation.md) motivate narrower
questions, not an accuracy claim or a production recommendation. The current
proposal below supersedes the earlier prompt-clarification preference. The
implemented fixed-card URL-only experiment is documented separately in the
existing PoC guide; no implementation handoff is prepared here.

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

## Agreed auxiliary discovery source

Owner-agreed documentation checkpoint, October 18, 2026: **Кінобаза (Kinobaza)**
is an additional source of Ukrainian film titles and candidate URLs, not a new
integration or a final authority on an offer.

Proposed future flow (not the current runtime):

TMDb / Кінобаза / web search → candidate regional cards → film/cut identity and
offer-characteristic checks → Mykola recommendation.

Кінобаза is not final evidence of offer availability/entitlement, current prices,
audio or video format of a particular provider offer/edition. General film
localization does not establish localization at a provider. Its data may
originate from JustWatch and may not be independent of TMDb. Shared upstream
information is not independent
corroboration; titles/links are leads to verify against the exact regional card,
not grounds for transferring characteristics between offers or editions.

API availability, automated-access permission, attribution requirements and
retention remain **open questions**, not approved capabilities or rights. No
automatic integration, scraping or discovery-to-fetch pipeline is added. This
conceptual flow does not authorize collecting grounded links into a fetch queue.
MW-FUT-01 remains Discovery. The current [URL-only PoC](url-context-poc.md) keeps
its fixed, verified server-side cards; Кінобаза does not populate that catalogue
or supply runtime input.

## Next experiment: current Ukrainian availability

The [two reported URL-only tests](digital-ua-owner-validation.md#url-context-evaluation-checkpoint--two-owner-run-live-tests)
provided useful identity/audio metadata, but left availability and transaction
fields unknown. The full provider-retrieved content is unavailable; the cause of
omissions is unresolved. The next question is **whether a current digital offer
can be established in Ukraine**, not whether a longer prompt fills every field.

### A. Candidate links from TMDb / Кінобаза, then manual offer verification

- **Hypothesis / new information:** Ukrainian titles and candidate links can
  lead the owner to a concrete provider offer whose current access type can be
  checked directly. This adds a time/account-scoped availability observation,
  not just identity/audio metadata or another aggregator availability assertion.
- **Minimum change:** no code, prompt, dependency or model change. One manual
  session, the same two films, at most one provider-card candidate per film.
  Use TMDb/Кінобаза through their ordinary UI only if accessible; a source may
  provide no usable link. Existing fixed Apple cards can be controls, but using
  a seed URL is not counted as successful new candidate discovery. No Gemini
  call is needed to answer this manual research question.
- **Dependencies / access limits:** owner access to source/provider UI, Ukraine
  without VPN and a Ukrainian account when needed. Neither an API nor relevant
  TMDb/Кінобаза fields/links are assumed to exist. Source rights/access,
  attribution and retention remain unresolved; no automatic access is approved.
  Shared JustWatch-origin data is not independent corroboration.
- **Acceptance:** establish exact film/cut/card identity first. For each case,
  distinguish current subscription access, a new rental and a new purchase
  using visible offer-specific controls, or explicitly retain unknown. A Play
  button shows an account-scoped playback control, not successful playback, a
  new transaction or another account's entitlement. Price is a dated observation,
  not a persistent promise. Supporting the hypothesis requires at least one
  actual current offer observation beyond the URL-only unknown; merely marking
  both cases unknown is a documented unresolved outcome, not successful proof.
- **Stop criteria:** stop at two cases or when identity/territory/access cannot
  be established normally. No usable link means unknown, not unavailable. Do not
  buy, subscribe, bypass geo/login restrictions, expand platforms/films or infer
  missing fields to complete the exercise. No automated extraction or archive.
- **Termius → iPhone/Safari order:** inspect the correct checkout and, if the
  demo is already running, use status only; leave the owner process/configuration
  intact. Move to Safari, manually locate a title/link in the source UI, then
  open the exact regional provider card and verify identity. Check current
  access controls in the owner's Ukrainian context; keep localization/video
  observations separate and unknown where absent. Discuss concise observations
  and uncertainty without saving live model text, raw metadata or screenshots.
  No demo/model click is required; follow the existing trusted-LAN guide if
  using the demo as context, not as an entitlement oracle.

### B. Additional exact-card check, gated by demonstrated access to missing data

- **Hypothesis / new information:** a permitted technical view of the **same**
  card might expose current transaction/availability information omitted from
  URL Context. This must first be demonstrated; another retrieval SUCCESS or
  the same identity/audio list would add no evidence for the availability gap.
- **Minimum change:** begin with a manual feasibility check of normal rendered
  Safari/provider UI. If offered through normal navigation, the official Apple
  TV app may be checked as a separate account-bound view, not silently equated
  with the public page. No implementation or new transport is proposed now.
  A future technical read would require a separately approved method and proof
  that it can expose the needed fields; no API/endpoint or field availability
  is assumed. Repeating URL Context is not itself a new method.
- **Dependencies / access limits:** exact card/version mapping, demonstrated
  extra fields and applicable permission. An official documented interface, if
  one exists, needs its own capability/terms/attribution/retention review before
  any request. A rendered-page observation does not grant scraping/DOM
  automation rights; app-only/account data is not automatically available to a
  backend. No cookies, credentials, internal endpoints, account automation or
  access-control circumvention. The existing terms review below is context,
  not clearance for a new route.
- **Acceptance:** in one chosen case, identify at least one additional
  offer-specific availability/access field absent from the URL-only answer,
  with known card and territorial/account scope. Before selecting a technical
  route, demonstrate authorized access to that field, not just HTML retrieval
  or a generic badge. Report which conclusions remain account-only/unknown;
  do not claim that this reveals what Gemini actually received.
- **Stop criteria:** no new availability field, uncertain card mapping, no
  documented permitted method, blocked/login-only automated access or dependence
  on invented/private endpoints ends this option as infeasible/unresolved for
  now. Do not add a scraper/provider, replay model calls or relax constraints.
- **Termius → iPhone/Safari order:** inspect status without restarting/stopping
  the owner demo; open the chosen configured card in Safari normally. Check
  rendered availability controls; optionally follow the provider's ordinary
  official-app navigation only if exact identity can be maintained. Compare
  this observation to the existing owner summary, not an archived model answer.
  If only the account view adds information, label it account-scoped. Return to
  discussion with the feasibility result; make no technical/API call or code
  change until a separate decision. Keep the iPhone safety workflow unchanged.

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

## Recommendation (design only, no implementation handoff)

Choose **A first**: one bounded owner session with Coherence and Dune: Part Two,
candidate links if obtainable normally, then direct manual current-offer checks.
It targets the availability gap without another model call, speculative API or
new integration. Its benefit is a scoped current observation and a clearer
boundary between discovery, public metadata and account access, not proof of a
generally reliable method. If neither offer can be established, retain that
unresolved result; do not switch to B automatically.

B is a subsequent feasibility question only if it can demonstrate new,
permitted access to missing availability information. Do not choose a technical
integration merely because URL Context omitted fields. Current prompts/model/
settings and the fixed catalogue remain unchanged; nothing is sent to Mykola.

Both options preserve the [iPhone workflow](iphone-windows.md), no response
archive, independent unknowns and no payments/geo bypass. Owner observations
must remain distinct from model statements and implementation-agent tests.
Usage/cost is not a blocker, unmeasured cost is not zero, and two cases cannot
establish general accuracy or superiority. No API calls, automation, system
changes or implementation handoff accompany this documentation proposal.
