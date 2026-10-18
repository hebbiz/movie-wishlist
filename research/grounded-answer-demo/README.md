# MW-FUT-01: isolated grounded-answer demo

Local, owner-operated, display-only **Discovery** experiment, not a production
feature. This iteration starts from develop checkpoint
`a5d4f42149c616d4dc3cdac35c6086240b3fdacf`. The physical-only owner pilot and
historical implementation checks are preserved separately in the
[PR #174 checkpoint record](docs/checkpoint-174.md). They do not validate the
new digital or Amazon-region prompts. Subsequent
[owner-reported iPhone and digital-UA observations](docs/digital-ua-owner-validation.md)
cover three digital scenarios, not general accuracy or every platform.
Amazon-region scenarios remain **live-unvalidated**. The
[next-experiment record](docs/regional-card-proposal.md) distinguishes historical
proposals from approved isolated probes; the shared offer model is design only.

The separate opt-in [URL Context PoC](docs/url-context-poc.md) now tests two
fixed Apple TV Ukraine cards without Search. It is stacked on PR #175; it does
not change the existing Search prompts or their default selection. Two
[owner-run URL Context live tests](docs/digital-ua-owner-validation.md#url-context-evaluation-checkpoint--two-owner-run-live-tests)
through iPhone/Safari supplied useful identity/audio metadata but left offer
availability and several transaction/video fields unknown. These are not
independently repeated tests, general accuracy or proof of method superiority.
The subsequent [manual Kinobaza experiment A](docs/digital-ua-owner-validation.md#kinobaza-candidate-discovery--manual-experiment-a-completed)
is completed for these two films: the owner confirmed useful provider candidates,
including Coherence on Prime Video in Ukraine with Ukrainian audio. These
provider-specific observations are separate from the URL Context tests. The
[candidate integration feasibility review](docs/regional-card-proposal.md#candidate-integration-feasibility)
compares TMDb discovery, a supported Kinobaza interface if available, and manual
Kinobaza assistance. Its earlier candidate-link-preview proposal is not being
built. The owner selected a narrower new experiment instead: opt-in
`DEMO_URL_SOURCE=kinobaza` reads one of two fixed Kinobaza cards with URL Context
and asks for provider/link/territory candidates, not offer verification.
[Two completed owner-run tests](docs/digital-ua-owner-validation.md#kinobaza-url-context--two-completed-owner-run-tests)
returned identity/platform names but **no provider URLs**; the current scenario
is not suitable as an automatic link generator on this evidence. Dune also had
an external citation-source anomaly, not proof of a destination fetch or of
exclusive source provenance. A separate [initial-HTML feasibility check](docs/regional-card-proposal.md#initial-html-inspection-after-the-owner-tests)
found relevant hrefs already present without JavaScript; the Gemini omission
cause and automation rights remain unresolved. No repeat live runs recommended.
The subsequent owner-approved **HTML-only PoC** is a separate opt-in
`DEMO_RETRIEVAL=kinobaza-html`: one manual source GET, deterministic initial-HTML
parsing, no Gemini or destination requests. The owner has now completed the
[two-film HTML pilot](docs/digital-ua-owner-validation.md#kinobaza-html--completed-owner-run-checkpoint):
candidate links were obtained, not offer availability or characteristics.
Coherence Prime was missed; a foreign Dune YouTube search transition is not an
exact film card. [Parser diagnosis](docs/regional-card-proposal.md#html-checkpoint-diagnosis-no-parser-expansion)
and [Movie of the Night feasibility](docs/regional-card-proposal.md#movie-of-the-night-bounded-feasibility-only)
were documentation-only at checkpoint `30c3160`. The subsequent owner-approved
`DEMO_RETRIEVAL=motn-api` adds a separate non-LLM, two-film UA capability probe,
initially offline-tested / live-unvalidated. The [two owner-run results](docs/digital-ua-owner-validation.md#movie-of-the-night--two-completed-owner-run-results)
now close that manual stage: useful links/access types, with catalogue/metadata/
currency limitations. The year-only identity fix is offline-tested, not rerun
live; no repeat owner test requested. This is not a Kinobaza parser fix. See
[API setup/result contract](#movie-of-the-night-api-probe) and the
[current scope/terms decision](docs/regional-card-proposal.md#approved-non-llm-api-probe).
The [bounded approval/rules record](docs/regional-card-proposal.md#owner-approved-html-extraction-poc)
does not approve regular/commercial integration. See [HTML owner commands](docs/iphone-windows.md#kinobaza-html-owner-workflow).
The [Windows launch diagnosis](docs/windows-launch-diagnosis.md) resolves the
earlier detached-launch failure: multiple Node PATH matches were passed as one
executable string. The helper now selects one executable, without changing
breakaway/auth/security controls. Safe native diagnostics and paired baseline/
HEAD tests are documented there; explicit new-mode SSH-disconnect validation
after the fix remains pending, separate from the reported Safari live answers.

The approved [TMDb data probe](#tmdb-data-probe) is now implemented separately
as opt-in `tmdb-data`, stacked on #179 at `9e4bf4f`. Identity/catalogue metadata
and actual `results.UA` are separate blocks; maximum two serial HTTP requests
per film. The [first owner-run Coherence result](docs/digital-ua-owner-validation.md#coherence--first-owner-run-result)
established a reported UA Apple TV Store rent/buy signal but exposed over-strict
appended-resource validation. The owner subsequently confirmed Dune passed both
blocks/all five appends after the correction. [Manual stage complete](docs/digital-ua-owner-validation.md#tmdb-data-probe--completed-owner-checkpoint),
not independently repeated; no Coherence rerun or further owner test required.
Current-terms readiness remains conditional for any separately approved future use.
No new MOTN/card/SSH-disconnect test asked.

The owner separately approved a [one-card MEGOGO HTML PoC](#megogo-initial-html-probe),
stacked on #180 checkpoint `b9f3c65`. It is implemented / offline-tested; the
[owner's first run](docs/digital-ua-owner-validation.md#megogo-initial-html--owner-run-parse-policy-rejection)
reported HTTP 200 but was rejected by the parse policy before identity evaluation.
Offer-field usefulness remains **unvalidated**; no agent extraction or repeat
owner GET. It does not change any
previous request body, prompt, model, parser or owner observation. MW-FUT-01
remains Discovery, not a regular/commercial integration.

No production integration, production TMDb calls, chat/input, LLM-output
normalization, scoring, response archive or analytics. HTML-only returns a small
deterministic candidate result, not a normalized Gemini answer. PR #173 is not changed
or imported as code; two previously verified scalar film IDs are reused with
provenance below. The implementation agent makes no live API calls; the owner-run
requests below are reported separately, not independently reproduced.

## Setup and server switches

For opt-in trusted-home-LAN Safari testing and detached Windows process helpers,
see the [Windows + iPhone guide](docs/iphone-windows.md). It has separate one-time
owner setup and daily Termius/Safari steps. The localhost workflow below remains
the default. Basic Auth over HTTP is not encrypted and is **not** suitable for
public networks or internet exposure. The owner confirms iPhone/Safari LAN HTTP
with Basic Auth and a synthetic request after explicit SSH disconnection. This is
owner validation on that configuration, not an independent agent device test
or a guarantee for other Windows/SSH environments.

Node.js 24, modern desktop browser. Gemini, Movie of the Night and TMDb modes need no npm install or
build. HTML-only needs the pinned isolated parser below, not production
dependencies. Run from the repository root. No `.env` file is loaded.

| Environment | Values / purpose |
| --- | --- |
| `DEMO_MODE` | `synthetic` by default; explicitly `live` only for an owner-run request |
| `GEMINI_API_KEY` | Required only for live Gemini modes; HTML/Movie of the Night modes never need/forward it |
| `MOTN_API_KEY` | Direct Movie of the Night developer-portal key; live `motn-api` only, server-side header; Windows helper prompts hidden instead of reading inherited key env |
| `TMDB_READ_ACCESS_TOKEN` | Live `tmdb-data` only, server-side Bearer token; Windows helper prompts hidden, never inherits a production key or unrelated provider credential |
| `DEMO_FILM` | `dune-part-two` (default), `coherence`, `blade-runner-final-cut` |
| `DEMO_DISCOVERY` | `physical` (default), `digital-ua` |
| `DEMO_RETRIEVAL` | `search` (default), `url-context`, opt-in `kinobaza-html`, `motn-api`, `tmdb-data` or `megogo-html` |
| `DEMO_URL_SOURCE` | URL Context: `apple-tv` default or `kinobaza`; Kinobaza HTML: unset or `kinobaza`; unset for Search, `motn-api`, `tmdb-data`, `megogo-html` |
| `DEMO_AMAZON_REGION` | Optional, physical only: `us`, `uk`, `de`, `it`; unset for multi-store search |
| `DEMO_PORT` | Default 4317, range 1024–65535 |
| `DEMO_ACCESS` | `localhost` (default) or explicit `lan` |
| `DEMO_BIND_IPV4` | LAN only: specific assigned private IPv4, never 0.0.0.0 |
| `DEMO_LAN_PASSWORD` | Required server-side LAN Basic Auth password; username `demo`; helpers prompt secretly |
| `DEMO_SYNTHETIC_SCENARIO` | `grounded` (default), `api-error`, `empty`, `ungrounded`; synthetic error/display tests only |

URL Context additionally supports synthetic `retrieval-error`, `retrieval-paywall`
and `retrieval-unsafe`. `grounded` simulates success, never an actual page read;
`ungrounded` simulates missing retrieval metadata. See the PoC guide for commands,
retrieval statuses, current capability/terms review and manual comparison plan.
Set `DEMO_RETRIEVAL=search` (or unset it) and remove `DEMO_URL_SOURCE` when
returning to the Search commands below; URL-only requires `digital-ua`, no
Amazon region, and Dune or Coherence. Unknown/empty source values and any
explicit source with Search fail at startup. No browser source override.
Kinobaza commands reset every relevant switch per SSH session in the
[iPhone instructions](docs/iphone-windows.md#kinobaza-url-context-one-line-owner-commands).

Unset means absent, not an empty/unknown value. Invalid film/discovery/region
or **any Amazon region with digital-ua** causes a clear startup error before
listening or making a provider request. All choices are resolved once at startup.
The browser cannot override film, discovery, region or prompt.

### HTML-only setup and result contract

Install only the research dependency, with its lockfile and no install scripts:

```powershell
npm ci --prefix research/grounded-answer-demo --ignore-scripts --no-audit --no-fund
```

`DEMO_RETRIEVAL=kinobaza-html` requires `DEMO_DISCOVERY=digital-ua`, Dune or
Coherence, no Amazon region, and URL source unset or `kinobaza`. Only synthetic
scenario `grounded` is accepted. Source URL, operation, timeout and byte limit
are visible before clicking. Defaults and all Gemini prompts/settings/request
bodies are unchanged. Parser absence is explicit before a live source GET.

One click consumes the existing token, including failure. Live: one GET of the
fixed Kinobaza source, 15-second deadline, 2 MiB maximum decoded response body,
UTF-8 HTML only. Redirects/403/429/timeouts/oversize are separate statuses, never
retried. No cookies, source scripts/assets, destination resolution, follow-up,
LLM or raw-HTML browser payload. Start/status/reload alone makes no source GET.

The transient result separates observed title/year/director identity,
`status`/`issues` and candidates: `provider`, explicit `territory` or null,
`href`, `rawHref`, `hrefKind`, candidate/unresolved status. `href` is the HTML
attribute value (entities such as `&amp;` decoded by the parser); `rawHref`
preserves its source spelling. Neither percent encoding/query order nor redirect
destinations are rewritten. Relative values stay relative, never reconstructed
as absolute URLs. Unsafe values are withheld, with an issue. Display uses only
text nodes, no clickable candidate/resource elements or raw HTML insertion.

Only supported country-heading/panel relationships establish territory;
recognized badges outside those panels are **territory unknown**. Identity or
markup ambiguity yields unresolved/unsupported, not guessed candidates. A link
does not establish availability, localization, prices or entitlement. This is a
source-specific, deliberately incomplete parser; changed markup requires review.
Synthetic markup/providers are authored and invented, not archived live results.
See the existing feasibility record for parser choice, public rules and limits.

### Movie of the Night API probe

Opt-in `DEMO_RETRIEVAL=motn-api`, `DEMO_DISCOVERY=digital-ua`, film `coherence`
or `dune-part-two`; unset `DEMO_URL_SOURCE` and `DEMO_AMAZON_REGION`. Country is
fixed **UA** in code, not browser input/environment. Only synthetic scenario
`grounded` is supported. No SDK/new dependency. Existing modes, Gemini bodies
and Kinobaza parser are unchanged.

| Fixed film | IMDb used in request | TMDb identity cross-check |
| --- | --- | --- |
| Coherence (2013), James Ward Byrkit | `tt2866360` | `220289` |
| Dune: Part Two (2024), Denis Villeneuve | `tt15239678` | `693134` |

Identifier provenance: the already verified
[repository fixture at 9b5fda6](https://github.com/hebbiz/movie-wishlist/blob/9b5fda67379007156cd25297d3df62aef76daecd/research/media-discovery/fixtures/movies.json),
checked October 17, 2026. TMDb page-content identity evidence and IMDb search
results were recorded there; IMDb direct retrieval failed and API crosswalk
verification was **not** performed. No IDs inferred from model memory and no
runtime dependency on PR #173. Exact IMDb is required; a valid conflicting IMDb
or TMDb (including a TV namespace), or an explicit series type, is `mismatch`.
Missing/malformed stable identity or ambiguous title/director/type is
`unresolved`. **Year alone cannot reject the stable-ID match**: preserve the
reported year with a warning, without inventing a regional-release explanation.
Both failure states explicitly mark `optionsState=withheld-identity`: the UA
list was not evaluated. That differs from matched identity with an actually
reported empty UA array (`reported-empty`) or a missing UA field (`not-reported`).

Before clicking, UI shows the film, IMDb, UA, operation and exact GET URL:
`https://api.movieofthenight.com/v4/shows/<fixed-imdb-id>?country=ua`.
One click → one title request; **no** extra `/countries`, model, retry, redirect,
cookie, destination request or automatic continuation. Server-side
`X-API-Key` authentication. Missing/invalid key, auth/access/quota errors,
404, invalid JSON/type/identity, timeout and oversized response are explicit.
20-second whole-read deadline and 2 MiB decoded-body limit. Error bodies and
raw/global catalogue are not returned/logged/stored. No key reaches the browser,
including an unexpected upstream echo. One-shot token consumed on failure too.

The small transient projection contains source/UTC receipt time/status/identity
and **only** `streamingOptions.ua`: separate service/access/addon/link, Ukrainian
audio/subtitles, optional quality and price/currency for each option. Exact safe
HTTP(S) links are shown as text, never opened/resolved. No foreign offer fields
are copied. Each field distinguishes reported, not reported or invalid; a
provided language array without Ukrainian is **not listed / completeness
unknown**, including an empty array. The reviewed docs do not establish list
completeness, so no automatic confirmed-absence state is emitted. ISO 639-2
`ukr` (or explicitly returned `uk`) counts, not `UKR` region/original language.
Missing and null language fields both map to `not-reported`; their original
missing-vs-null distinction is not retained. Empty arrays retain `[]` and mean
not listed / completeness unknown, never confirmed absence. Quality has no
default; price amount/currency come only from their response fields, never UA.
See the [field trace and findings](docs/regional-card-proposal.md#motn-closeout-identity-and-field-provenance).
No UA options/404 does not mean unavailable in Ukraine.

Apple service ID `apple` alone does not mean subscription: retain `rent`, `buy`,
`subscription`, `addon`, `free` or an explicit unknown/other type, without
combining offers. UHD does **not** establish HDR10/DV; locales do not establish
AAC/Dolby/channels. Aggregator data is not account-specific entitlement or a
guarantee of freshness. Attribution/link to Movie of the Night stays visible.
Synthetic options/prices/services are invented, not an archived API response.

[Exact key/Free-plan setup and standalone owner commands](docs/iphone-windows.md#movie-of-the-night-api-owner-workflow).
The two owner-run tests are **complete**, not independently reproduced. Existing
commands are reproduction instructions, not a request to rerun either film or
its streaming cards. No full JSON/metadata or secret-bearing dumps requested.
The corrected identity behavior remains live-unvalidated. No LLM, training or AI
evaluation/improvement; inference permission is outside this probe, not inferred.

Approved research sequence (not implemented as a pipeline): Movie of the Night
probe → comparison with Kinobaza/JustWatch → MEGOGO adapter feasibility → shared
offer model. Direct JustWatch Partner API access is **not** the current Kinobaza
tracking-link path; owner-reported platform coverage is not an API guarantee.
Authorized workers remain a separate conditional direction, not this scope.
The approved follow-up [TMDb data-probe handoff](docs/tmdb-probe-handoff.md) is
implemented below, with current terms uncertainty separated from technical
capability and no provider-localization inference from film metadata.

Historical implementation checks at `d3e32b0` (Node 24.22.0, October 18, 2026): **135**
offline/HTTP tests passed, including the 22-body Gemini golden regression.
Sequential Edge desktop/narrow-viewport suites: **72 passed / 5 skipped**
(four absent WebKit checks and optional explicit-IP LAN); the final exact-URL
probe suite rerun passed **12 / 1 WebKit skip**. Narrow Edge is not real Safari.
PowerShell 7 temporary-copy lifecycle passed for all five retrieval modes,
including mock-only child API-key inheritance, parent exit, replay, duplicate
start, forged-PID refusal, safe stop and restart. No owner process stopped.
PowerShell 5.1 / new-mode real iPhone/live API not independently validated.

Closeout/fix checks: **139 offline/HTTP tests passed**, including the unchanged
22-body Gemini golden regression; **75 browser checks passed / 5 skipped**
(four absent WebKit binaries, optional explicit-IP LAN). MOTN PowerShell 7
temp-copy lifecycle/mock key-routing regression passed. The new year/status
cases and field provenance use authored fixtures, not retained live responses.
No new owner/live/API/card test. See the audit for proven vs unresolved findings.

Offline probe commands (no live API):

```powershell
node --test research/grounded-answer-demo/test/motn.test.mjs
# With an already installed Playwright/browser configured as below:
node --test --test-concurrency=1 --test-timeout=120000 research/grounded-answer-demo/test/motn-browser.test.mjs
.\research\grounded-answer-demo\test\windows.test.ps1 -Motn
```

### TMDb data probe

Opt-in `DEMO_RETRIEVAL=tmdb-data`, `DEMO_DISCOVERY=digital-ua`, film `coherence`
or `dune-part-two`; unset URL source and Amazon region. Fixed IDs above are
reused as scalar catalogue data; no MOTN/PR #173 import or runtime request.
Only synthetic scenario `grounded` is supported. No new dependency.

Before clicking: film/director, both IDs, UA, `uk-UA`, exact A/B URLs, operation,
two-request cap, 20-second/2-MiB **per-request** bounds and conditional terms
readiness. No model prompt exists. `/session` and transport use the same startup
selection; browser input/body cannot override it.

1. **A:** Details with `language=uk-UA` and appended `external_ids`,
   `alternative_titles`, `credits`, `release_dates`, `translations`.
   Exact primary TMDb ID is required; conflicting supplied TMDb/IMDb IDs block
   B. Missing IMDb is an explicitly unknown crosswalk, not a mismatch. Dates or
   localized title variation alone do not override stable IDs. Missing/invalid
   appended data stays partial/unknown, with no decomposition/fallback calls.
   An appended object need not repeat the parent movie `id`; if supplied it must
   match. Resource missing/null/invalid/reported states are separate from its
   field states, so a valid object with missing fields is not an invalid resource.
   Nonobjects, malformed/conflicting supplied IDs and API-error objects are
   withheld. See [schema evidence and limits](docs/tmdb-probe-handoff.md#appended-resource-validation-correction).
2. **B:** separate Watch Providers request; project only uppercase `results.UA`.
   If A fails identity, B is **not requested**, not an empty UA result. Actual
   absent/null/empty UA and missing/null/empty/invalid buckets are distinguished.
   Subscription (`flatrate`), rental (`rent`), purchase (`buy`), ad-supported
   (`ads`) stay separate; future buckets are labelled unknown, not remapped.
   `link` is the **TMDb country watch page**, not a provider deep link.

Compact display shows source/receipt time/status, IDs, original/requested titles,
directors, film-level language codes, **UA** aliases/release events, **uk**
translation entries and UA providers/access buckets by default. All other/unknown
territory release events are retained in collapsed details, not dropped or relabelled
UA. Other aliases/translations, person IDs and provider technical fields also
remain in details; opening them makes no requests. Errors/unknowns stay visible.
Translation overview/tagline have presence states only,
not full prose. Explicit `uk` + nonempty translation title establishes Ukrainian
**catalogue text**. Requested `uk-UA` alone can fall back; UA aliases/dates,
original/spoken languages do **not** establish provider dubbing/subtitles.
Provider names/IDs, separate access buckets, `logo_path` (text only) and source
`display_priority` add aggregate country signals, not audio, prices, quality,
entitlement or a confidence score. Shared JustWatch lineage is not independent
confirmation of Kinobaza. No external image/provider/watch-page fetch occurs.

Bearer `TMDB_READ_ACCESS_TOKEN` stays server-side, never URL/arguments/HTML/state.
No default production key, LLM, retry/redirect, search/country enumeration,
destination fetch, raw response logging/archive or browser storage. A failed A
uses one request; successful identity allows at most one B. Errors are findings,
not instructions to reload/retry. Synthetic uses authored invented metadata and
services with **zero actual requests**, not expected live facts.

[Official docs/terms assessment and implementation record](docs/tmdb-probe-handoff.md#implementation-record)
and [token setup / one-line iPhone restart](docs/iphone-windows.md#tmdb-data-owner-workflow).
TMDb/JustWatch attribution and the official documentation logo are visible in
Credits/About. Current complete Terms remain inaccessible to this agent;
**live readiness is conditional on normal owner review of applicable current
terms for this bounded non-LLM scope**. No email is required merely for that
access limitation. No paid plan or zero-total-cost assertion is made.

Implementation/synthetic checks are separate from the [completed owner checkpoint](docs/digital-ua-owner-validation.md#tmdb-data-probe--completed-owner-checkpoint).
No agent live API/card test was performed. Coherence's original appended shape
remains unknown; Dune's post-fix A/B success is owner-reported. Sources contributed
different UA/provider/link signals, not independent entitlement evidence.
TMDb Ukrainian title/overview/tagline are catalogue metadata, not offer tracks;
displayed UA release-event language was empty. No general accuracy conclusion
or additional manual test requested. No full JSON/screenshots retained.

The [shared offer-observation model](docs/regional-card-proposal.md#shared-offer-observation-model--design-only)
is **design only**, not a new runtime schema or source-data forwarding
permission. The [MEGOGO record](docs/regional-card-proposal.md#megogo-one-card-html-poc)
now describes the separately approved bounded HTML experiment below. At the
TMDb checkpoint only its display was shortened; requests, budget, auth, other modes
and production remain unchanged. iPhone workflow/commands are preserved as
reproduction steps, not instructions to repeat the completed pilot.

### MEGOGO initial-HTML probe

Opt-in `DEMO_RETRIEVAL=megogo-html`, `DEMO_DISCOVERY=digital-ua`,
`DEMO_FILM=dune-part-two`; unset `DEMO_URL_SOURCE` and `DEMO_AMAZON_REGION`.
Synthetic default, only synthetic scenario `grounded`; unsupported combinations
fail before listening. No API key. Install the existing pinned research `parse5`
dependency using the [HTML setup](#html-only-setup-and-result-contract), not a
production dependency. Reused parser avoids regex HTML parsing or JS execution.

Fixed source: <https://megogo.net/ua/view/22027436-dyuna-chastina-druga.html>.
Expected native ID `22027436`, TMDb `693134`, IMDb `tt15239678`; the last two are
the existing [catalogue's verified IDs](#movie-of-the-night-api-probe), not new
API results. UI shows source, operation, film/IDs, limits and unknown fetcher
geography before click. One click consumes the token and permits **one GET max**,
20-second total network/body timeout, 2 MiB decoded-body cap, UTF-8 HTML only.
No credentials upstream, redirect following, retries, scripts/assets, destination
requests, private endpoints, login/cookies or LLM. No archive, response logs or
browser storage. Start/status/reload alone does not fetch the card.

The source-specific parser in `megogo.mjs` reads declarative Schema.org
Movie/Offer JSON-LD, optional `PropertyValue` labels, and explicit `dt/dd` or
two-cell table labels in a unique main with matching H1. This **supported grammar
is not proof of MEGOGO's current markup or field presence**: no live card read
by the agent. Unknown layouts stay partial/unsupported; executable JSON/JS is
not evaluated and no mentioned endpoints are called. Identity uses observed
canonical/Movie native ID + title + year (or exact IMDb); supplied native/TMDb/
IMDb conflicts withhold characteristics. Configured IDs are not observations.

Result separates receipt/source/HTTP/retrieval/identity status, card claims and
each explicit JSON-LD offer. Fields have `reported`, `unknown`, `conflicting`
or bounded `partial` state and evidence kind/locator. No cross-offer copying.
Audio codec/channels and subtitle standard/forced/CC/SDH types attach only to
an explicit single-language clause; unknown association remains unknown.
Original film language is not an offered track. Resolution, HDR10 and Dolby
Vision are separate; HD does not exclude 4K and UHD does not establish HDR.
Price requires explicit amount **and** ISO currency; no country-based default
or fallback to historical prices. Supported explicit negatives are source
claims, not universal absence; missing metadata/lists never establish absence.

**Public-card characteristics are not account entitlement.** Report supported
characteristics without demanding login proof, while leaving account entitlement
unknown. Regional messages/Offer regions are source claims with a basis, not
proof of Ukrainian rights or fetcher country. `/ua/`, UI language and RFC1918 IP
establish neither. Fetcher geography remains unknown (no geolocation request).
Redirect/403/429/451/CAPTCHA/timeout/oversize/unsupported markup/login-or-JS-only
data are explicit outcomes, not routes to bypass or infer missing facts.

[Current public-rules assessment](docs/regional-card-proposal.md#megogo-one-card-html-poc)
distinguishes the actual Ukrainian edition from a Polish response at the same
URL; robots is not a licence, and residual IP/extraction rights uncertainty
remains. The owner's approval is bounded, not regular/commercial approval.

[Standalone Termius/Safari restart](docs/iphone-windows.md#megogo-initial-html-owner-workflow)
is retained for separately approved reproduction, **not a repeat owner test now**.
The first owner GET returned `ambiguous-html-tokenization`; the [diagnosis](docs/regional-card-proposal.md#megogo-owner-failure--parse-policy-diagnosis)
shows a pre-identity parse-policy early exit, not proven ambiguity/wrong film.
That misleading issue is now `html-parse-policy-rejection`, with parser-code
counts and small parsed-tree counts under `diagnostics`; no page text, attributes,
URLs, parser positions, body or content logs. The conservative gate and one-GET
contract remain unchanged. Exact original parser code/layout is unrecoverable
from the old summary; no safe tolerance expansion is demonstrated for that run.
No new owner/synthetic/SSH-disconnect or streaming-app round. Earlier observations
are controls, never seeded facts or current guaranteed truth. Offer fields remain
unvalidated; only authored fixtures/mock HTTP were independently checked.

```powershell
node --test research/grounded-answer-demo/test/megogo.test.mjs
# External Playwright configuration as documented below; all fetches mocked:
node --test research/grounded-answer-demo/test/megogo-browser.test.mjs
.\research\grounded-answer-demo\test\windows.test.ps1 -Megogo
```

```powershell
node --test research/grounded-answer-demo/test/tmdb.test.mjs
# With the same external Playwright configuration described below:
node --test --test-concurrency=1 research/grounded-answer-demo/test/tmdb-browser.test.mjs
.\research\grounded-answer-demo\test\windows.test.ps1 -Tmdb
```

### 1. Physical default (safe synthetic display)

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_FILM = 'dune-part-two'
$env:DEMO_DISCOVERY = 'physical'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
node research/grounded-answer-demo/server.mjs
```

Open **http://127.0.0.1:4317**, not `localhost`, a LAN URL or a static server.
Review the film, director, discovery mode, region and full prompt before clicking.

### 2. Ukrainian digital scenarios (safe synthetic display)

Stop the server with Ctrl+C first. Unset the physical-only region:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
$env:DEMO_FILM = 'dune-part-two'
node research/grounded-answer-demo/server.mjs
```

For Coherence, stop the server, then:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
$env:DEMO_FILM = 'coherence'
node research/grounded-answer-demo/server.mjs
```

For Blade Runner (1982), specifically The Final Cut, stop the server, then:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
$env:DEMO_FILM = 'blade-runner-final-cut'
node research/grounded-answer-demo/server.mjs
```

### 3. One Amazon store (safe synthetic display)

After Ctrl+C, select a physical film and exactly one region:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'physical'
$env:DEMO_FILM = 'dune-part-two' # or coherence / blade-runner-final-cut
$env:DEMO_AMAZON_REGION = 'us' # us=amazon.com, uk=amazon.co.uk, de=amazon.de, it=amazon.it
node research/grounded-answer-demo/server.mjs
```

To test another region, stop the server, set `DEMO_AMAZON_REGION` to `uk`,
`de` or `it`, and run the same Node command again. No batch/automatic loop.
To return to the original store set, remove the environment variable as in step 1.

**Restart the server and reload the page after every configuration change.**
A reload alone cannot change the running server's switches. Restart invalidates
old in-memory tokens. Reload does not automatically make a model request.

### 4. Manual live mode — owner only, not run by the implementation agent

With the desired configuration selected, stop the synthetic server. Securely
configure `GEMINI_API_KEY` in the server environment (not source or terminal
history), then:

```powershell
$env:DEMO_MODE = 'live'
node research/grounded-answer-demo/server.mjs
```

Reload the local page, verify all displayed switches and prompt, then click once.
Missing key is explained without a provider call. Button and server token permit
one attempt, including failure, with no retry/continuation or second model call.
Another attempt requires an explicit reload. Do not expose the server through
a proxy/tunnel, publish it, or export/archive live answers, screenshots or HAR.

## Prompts, priorities and unchanged model

The exact prompt comes from the validated catalogue/builder in
[config.mjs](config.mjs) and is fully visible before the click. `/session` and
the API request use the same server configuration. No arbitrary browser prompt.

Model remains **`gemini-3.8-flash`**, `maxOutputTokens=4096`,
`thinkingLevel=low`, `googleSearch: {}` for Search; URL-only uses `urlContext: {}`
instead, never both. No automatic output-limit increase.
One non-streaming GenerateContent REST call using built-in fetch; no new SDK.
The previously reviewed [Search guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search)
and [model parameters](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8)
are referenced; this iteration does not claim a new live API capability probe.

Physical keeps the three films and existing multi-store scope, but intentionally
revises prompt instructions to the newly agreed priorities (not byte-identical
to the earlier Dune prompt). Ordering is **availability → English audio →
UHD/Blu-ray/DVD → other details**. UHD existence is not assumed; edition year
does not replace film identity. Blade Runner must remain the 1982 film's
**Final Cut**, not a different cut or 2049; collections must establish inclusion
and unresolved cuts must be described as uncertain.

Without an Amazon region, HMV, Rarewaves and equal Amazon US/UK/DE/IT remain in
scope; one suitable available Amazon offer is sufficient. With a region, search
only that Amazon store, including Marketplace; no other Amazon store, HMV or
Rarewaves. Seller/condition are stated if known; Amazon is not assumed to be the
seller. Price alone does not prove stock; a sold-out price is not a success and
is not called historical without evidence. UHD and bundled Blu-ray details
must be distinguished, with citations tied to the exact edition/disc.
Delivery stays entirely outside scope.

Digital-ua searches Apple TV, Rakuten TV, Netflix, Prime Video, MEGOGO and
**HBO Max (formerly Max)**. The [official HBO Max brand changelog](https://brand.hbomax.com/changelog)
was checked October 18, 2026 for the current name; a brand name is **not evidence
of availability in Ukraine**. Owner-observed title availability is scoped in the
validation record, not established by the platform list or prompt itself.

Digital search and presentation order:

1. Ability to watch the exact film/cut in Ukraine.
2. Ukrainian audio track.
3. Ukrainian subtitles, separately from audio.
4. 4K, HDR10, Dolby Vision and HD, separately.
5. Subscription/rental/purchase, price/currency and other parameters; direct offer
   link when confirmed for the Ukrainian offer.

For each characteristic, the prompt asks to distinguish confirmed presence,
confirmed absence and unknown. A film page, Ukrainian interface or country URL
is insufficient playback evidence; negative search results do not prove absence.
Global/foreign specifications cannot be transferred to the Ukrainian offer.
4K does not imply HDR/Dolby Vision, nor do subtitles imply audio. An original
language or generic Atmos badge does not prove an offered Ukrainian track.

Among established UA-viewable offers, HD with Ukrainian audio beats 4K without
Ukrainian localization; without Ukrainian audio, Ukrainian subtitles beat better
video without localization. Missing evidence remains unknown, not confirmed
absence. These are **prompt instructions only**, not a filter, scoring system,
confidence normalizer or post-processing/re-ranking of the answer.

## Manual review: Ukrainian account, no VPN

For each explicitly owner-run digital request, inspect source links manually
using an account whose country is Ukraine, from Ukraine **without a VPN** or
other region bypass. Do not share credentials with the demo. If playback,
catalogue rights or account territory cannot be established, keep availability
unknown; do not purchase/subscribe just to complete this research.

Check the film and Final Cut identity first, then actual Ukrainian viewing
entitlement, Ukrainian audio and Ukrainian subtitles independently, then each
video format. Separate subscription, rental and purchase variants; verify any
price/currency and direct link in the proper territory/account context.
Record uncertainty in discussion without copying live text or creating an
evidence archive. Citations are attribution, not independent verification.

For physical region checks, verify the selected store, stock, English audio,
disc format/edition/cut, Marketplace seller/condition and disc-specific
characteristics. A search miss, title page, price or generic film-language
metadata is not sufficient evidence. Do not infer all regions were checked.

Latency can be timed manually from click to completed display for future
owner-run attempts. Token usage and actual API costs remain unmeasured here.
The owner currently reports **0 in the dashboard**; this does not establish
zero cost, a settled bill or free searches. Usage/cost measurement is not a
blocker for this iteration. One API request may involve multiple internal search
queries, and the output cap is not a complete spending cap.

## Display, privacy and limitations

Only the selected public-film prompt, configuration and authentication go to
Google; no Supabase, account data or movie lists. The response is held only in
active request/browser memory and DOM, with no-store headers. No logs of answers,
files, browser storage, cache, database, service worker, analytics or archive.
Provider/browser/OS handling outside the app is not a non-retention promise.
Windows helpers save only service metadata in ignored `.run/instance.json`,
not response content, credentials or environment. LAN Auth protects all routes;
the account password is entered by the owner into Safari's native auth prompt,
not returned as session data. Use a separate LAN password, never the API key.

The complete visible answer remains in order as plain text (Markdown syntax
is not executed HTML), with citation markers using validated Part-local UTF-8
offsets per the [Segment reference](https://ai.google.dev/api/generate-content#Segment).
Citations/source URIs and the provider Search Suggestions HTML/CSS/targets are
not rewritten, resolved, tracked or fed to a second LLM. Suggestions render
alongside the answer in Shadow DOM, not an iframe. Empty/ungrounded/truncated
or unsupported attribution/active snippets fail visibly rather than display
an incomplete or uncited answer. No retailer fetching/crawling code is added.

That citation/Suggestions contract describes **Search**, unchanged. URL-only
shows original visible text plus the provider's `urlContextMetadata` and any
`citationMetadata` separately, without inventing Search Suggestions or citations.
Retrieval errors/missing/mismatched metadata remain explicit; success proves no
truth, freshness or entitlement. URL-only does not require Search metadata.
Its distinct terms/display assessment is in the PoC guide; Search-specific
restrictions are not automatically treated as URL-only requirements.

The [Gemini terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)
and [Client Application Guidelines](https://support.google.com/adsense/answer/10926790)
remain relevant (original review October 17, 2026). Associated Search Suggestions
are kept; Google's processing/retention is separate from local non-persistence.
Google-supplied image resources can load as the snippet renders, and source/chip
clicks navigate directly under destination terms. No tracking/interstitials are
added by this app. The limited owner-observed digital results include missed
offers, metadata omissions and citation/context mismatches; see the validation
record. The provider's complete retrieved content is unavailable; the cause of
URL Context omissions is not established. No general accuracy, exhaustive
platform coverage or legal-permission claim is made. Amazon-region live
validation remains pending.

## Offline validation

```powershell
node --test research/grounded-answer-demo/test/demo.test.mjs
```

Tests use mocked provider transport and loopback HTTP only. They check all 18
film/discovery/store configurations, invalid modes/regions/combinations (including
CLI rejection before listening), default physical scope, displayed/sent prompt
identity, browser-override rejection, single-use sessions, existing errors/UTF-8
attribution and non-persistence. Prompt tests do **not** measure search quality.

Browser tests use an already installed external Playwright and browser;
no production dependency or browser download is required:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:\path\to\playwright\index.mjs'
$env:PLAYWRIGHT_CHANNEL = 'msedge' # optional, else installed Playwright Chromium
node --test research/grounded-answer-demo/test/browser.test.mjs
```

The suite blocks non-loopback browser requests and uses synthetic/mocked answers.
It retains prior display/error/storage/reload tests and adds all three digital
films plus each Amazon region, visible switches/prompt, no browser inputs and
one-shot behavior. Without the external module path, browser tests are skipped
and must be reported as such. Synthetic fixtures explicitly establish **no real
viewing availability, localization, edition or stock**.

Implementation test results are reported in the PR at their execution baseline.
Code-iteration offline/browser checks are reported at their execution baselines;
the historical evaluation checkpoint was Markdown-only. The subsequent
Kinobaza implementation checks are recorded in the existing URL Context guide.
Historical physical outcomes remain in the PR #174 checkpoint; subsequent owner
observations are in the linked digital-UA record. No live response, screenshot,
public evaluation report or evidence archive is added.

LAN/auth and optional mobile-viewport tests (loopback/mocks; mobile is not a real
iPhone check):

```powershell
node --test research/grounded-answer-demo/test/network.test.mjs
# With PLAYWRIGHT_MODULE_PATH already set:
node --test research/grounded-answer-demo/test/mobile.test.mjs
# Windows-only helper integration, isolated temporary PoC copy:
.\research\grounded-answer-demo\test\windows.test.ps1
```

The integration test starts and exits a separate PowerShell parent, checks that
the demo remains reachable, refuses forged unrelated PID metadata, and verifies
duplicate-start, restart and safe stop. It does not install/start SSH or change
firewall/services. Optional `-LanIPv4 <verified-Windows-IP>` tests same-host LAN
with a public test-only password and a temporary port; no live model calls.
WebKit is skipped explicitly when its binary is missing; nothing is downloaded.
Set `DEMO_TEST_LAN_IPV4` to this Windows host's verified assigned private IPv4
only to opt into the same-host LAN Basic Auth browser test (temporary port,
public test-only password). Without it that extra mobile subtest is skipped.

URL-only checks (mocks, no real Gemini):

```powershell
node --test research/grounded-answer-demo/test/url-context.test.mjs
node --test research/grounded-answer-demo/test/kinobaza.test.mjs
node --test research/grounded-answer-demo/test/html-source.test.mjs
# With the same external Playwright/installed browser configuration above:
node --test research/grounded-answer-demo/test/url-browser.test.mjs
node --test --test-concurrency=1 --test-timeout=120000 research/grounded-answer-demo/test/html-browser.test.mjs
.\research\grounded-answer-demo\test\windows.test.ps1 -UrlContext
.\research\grounded-answer-demo\test\windows.test.ps1 -UrlContext -Kinobaza
.\research\grounded-answer-demo\test\windows.test.ps1 -Html
# Same Windows PowerShell 7 runner for paired archived baselines and safe diagnostics:
.\research\grounded-answer-demo\test\launch-matrix.ps1
.\research\grounded-answer-demo\test\launch-diagnostics.test.ps1
```
