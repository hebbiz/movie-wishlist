# URL Context: fixed Apple TV cards and Kinobaza candidate links

MW-FUT-01 remains **Discovery**, not production. Technical feasibility/decision
review: October 18, 2026. Base: PR #175 documentation checkpoint
`01db2331da3c169ce7c7b267fe69adadefe6952a`. PR #175 was open at implementation;
this is a stacked branch/PR **into its branch**, not a repeated diff into develop.
After the dependency merges, review/retarget the stack without rewriting shared
history. PR #173 is untouched.

## Decision and boundaries

The original implementation uses explicit `DEMO_RETRIEVAL=url-context`, with
`DEMO_DISCOVERY=digital-ua`. Default remains `search` + physical. Exactly one
owner-clicked GenerateContent call, `urlContext` only, no Google Search, fallback,
automatic discovery/fetch, retry, continuation, second LLM, scraper, account
automation, credentials/cookies, arbitrary URL input, normalization or archive.
No live Gemini call was made by the implementation agent. Two subsequent
[owner-run URL Context observations](digital-ua-owner-validation.md#url-context-evaluation-checkpoint--two-owner-run-live-tests)
now cover the fixed cards through iPhone/Safari; this is not independent
validation, general accuracy or complete offer/entitlement verification.

### Verified catalogue, not expected answers

| Fixed film | Official public Ukrainian card / identity check |
| --- | --- |
| Dune: Part Two (2024), Denis Villeneuve | [Owner-supplied card](https://tv.apple.com/ua/movie/dune-part-two/umc.cmc.363aycnv6vy9qgekvew6fveb9), independently opened: title, 2024 and director match. |
| Coherence (2013), James Ward Byrkit | [Independently located card](https://tv.apple.com/ua/movie/coherence/umc.cmc.hdoayzcx3u9ofxfawjrt3hgc), independently opened: director, Emily Baldoni/Nicholas Brendon/Maury Sterling and dinner/comet synopsis match. Apple displays 2020; its meaning is unverified, not established as a regional release/addition/reissue or the original film year. |

Only identity was established here, not a new account/transaction check. A `/ua/`
URL does not prove entitlement. No page body is archived. The server catalogue
contains URLs only; the prompt includes target film identity and questions, not
expected audio/video/prices from the [owner report](digital-ua-owner-validation.md).
Blade Runner is not a URL-mode case; unsupported combinations fail before listen.

The [agreed auxiliary discovery-source role](regional-card-proposal.md#agreed-auxiliary-discovery-source)
for Кінобаза belongs to the proposed future flow, not this fixed-card experiment.
It adds no automatic discovery, access or catalogue changes here.
The later [manual candidate-discovery checkpoint](digital-ua-owner-validation.md#kinobaza-candidate-discovery--manual-experiment-a-completed)
and [TMDb/Kinobaza feasibility review](regional-card-proposal.md#candidate-integration-feasibility)
do not add Prime Video or any discovered destination to this Apple catalogue.
The later [Kinobaza source experiment](#kinobaza-candidate-link-experiment)
adds two fixed source cards, not destination-page fetching.

## Official capabilities, display and terms review

- **Technical support:** [URL Context guide](https://ai.google.dev/gemini-api/docs/generate-content/url-context)
  documents `gemini-3.8-flash`, URL-only requests and public-page access. It can
  use an index cache before a live-fetch fallback; it is not an authenticated
  Safari session. Login/paywall content is unsuitable. Model, low thinking and
  4096 output limit are retained; no API migration or output-limit increase.
- **Documented status:** [REST Candidate / UrlContextMetadata](https://ai.google.dev/api/generate-content#UrlContextMetadata)
  uses `urlContextMetadata.urlMetadata[]`, `retrievedUrl`, `urlRetrievalStatus`.
  Status values include SUCCESS, ERROR, PAYWALL, UNSAFE and UNSPECIFIED with the
  `URL_RETRIEVAL_STATUS_` prefix. UI displays returned metadata unchanged as text.
  Only exactly one matching URL/SUCCESS gets a qualified success notice; missing,
  malformed, extra/mismatched or unknown metadata never establishes page reading.
  Original complete visible text is unchanged; any citation/grounding metadata
  is also displayed unchanged. Unexpected Search Suggestions fail closed.
  Incomplete/blocked text is withheld, status retained.
- **URL-only display assessment (not legal assurance):** the URL guide does not
  prescribe Google Search Suggestions for URL-only calls. We do not require,
  invent or add them. Search-specific display/reuse clauses are not automatically
  applied to this separate tool. Existing Search rendering remains unchanged.
- **Applicable Gemini terms:** [Additional Terms](https://ai.google.dev/gemini-api/terms)
  still govern developer/business use, age/region, generated content and data
  processing. Attribution may be required. Unpaid processing can include human
  review/model improvement; paid processing still has limited safety/legal
  retention. No account information is sent. The Search subsection governs the
  existing Search path, not assumed to grant or prohibit every URL-only use.
- **Rights are not automatic:** [Google APIs Terms sections 5–6](https://developers.google.com/terms#section_5_content)
  reserve third-party rights and constrain content copying, derivative use,
  scraping/databases and attribution. Documented extraction capability is not a
  license for scraping, normalization, storage or redistribution. This PoC keeps
  only in-session display; no claims dataset or public evaluation archive.
- **Remaining interpretation:** the cards link to [Apple Internet Services](https://www.apple.com/uk/legal/internet-services/);
  [Ukrainian Media Services terms](https://www.apple.com/legal/internet-services/itunes/ua/terms.html)
  limit service/content use, including personal/noncommercial use and access
  software. Their applicability to automated reading of public card metadata,
  and any underlying rights needed, is not resolved by Gemini tool support.
  No Apple automation/storage permission or legal guarantee is claimed. Owner
  must resolve applicable terms/rights before live use; public accessibility is
  not permission. Stop if a restriction applies; do not bypass it.

No explicit Gemini URL-only incompatibility with this transient display design
was identified in the reviewed sources. This is a bounded technical decision,
not legal clearance. No extension to Search-derived fetch queues, publication,
extraction/storage or authenticated content is approved.

## iPhone / Windows commands

Keep the [trusted-LAN setup and safety guide](iphone-windows.md): no internet
exposure, HTTP Basic is unencrypted, no automated SSH/firewall/profile changes.
The owner's prior Safari + explicit SSH-disconnect synthetic validation applies
to the earlier workflow. Two new-mode live answers through Safari are now
owner-reported in the linked record; explicit new-mode SSH-disconnect validation
after the launcher fix remains pending. Do not conflate these evidence scopes.

In Termius PowerShell, inspect the correct copy and preserve all local/untracked
changes. Only with no conflicting changes, select/update this stacked branch:

```powershell
Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'
git status --short --branch
git fetch --prune origin
git switch codex/mw-fut-01-url-context
git merge --ff-only origin/codex/mw-fut-01-url-context
git rev-parse HEAD
```

No reset/clean/force or fallback merge on divergence. Stop this copy's running
demo with its verified helper before switching scenarios (do not kill all Node).

```powershell
.\research\grounded-answer-demo\windows\Status-Demo.ps1
.\research\grounded-answer-demo\windows\Stop-Demo.ps1
$windowsIPv4 = Read-Host 'Verified private IPv4 of THIS Windows machine'
$env:DEMO_MODE = 'synthetic'
$env:DEMO_RETRIEVAL = 'url-context'
$env:DEMO_URL_SOURCE = 'apple-tv'
$env:DEMO_DISCOVERY = 'digital-ua'
$env:DEMO_FILM = 'coherence'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
Remove-Item Env:DEMO_SYNTHETIC_SCENARIO -ErrorAction SilentlyContinue
.\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4
.\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Hidden prompt: separate LAN password. Safari: exact printed
`http://<actual-Windows-IPv4>:4317`, Basic username **`demo`**. Verify film, mode,
URL and full prompt before clicking. Disconnect SSH explicitly and try synthetic
once from Safari after reload. No page was read: success metadata is simulated.
To exercise a failure, stop, set `DEMO_SYNTHETIC_SCENARIO=retrieval-error`, restart
and reload; reset that variable before live. No real API call on start/status.

Only after owner terms/rights review and explicit manual live choice:

```powershell
.\research\grounded-answer-demo\windows\Stop-Demo.ps1
Remove-Item Env:DEMO_SYNTHETIC_SCENARIO -ErrorAction SilentlyContinue
$env:DEMO_MODE = 'live'
.\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4
```

Enter LAN password and Gemini key only at hidden prompts, never source/history
or command arguments. Reload Safari and click **once**. To test Dune separately:

```powershell
.\research\grounded-answer-demo\windows\Stop-Demo.ps1
$env:DEMO_FILM = 'dune-part-two'
.\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4
```

Restart/reload required for every change. One session permits one attempt even
on error; no automatic retry. To return to Search, stop, set
`$env:DEMO_RETRIEVAL = 'search'`, remove `DEMO_URL_SOURCE`, select original switches, restart/reload. Helpers
retain their per-copy safe-stop/duplicate guard and no-secret-file behavior.

## Manual comparison / acceptance (owner only; not executed by the agent)

1. Use Ukrainian account/territory without VPN for the separate manual Safari
   check; do not send account/cookies to Gemini or purchase access for research.
2. Check the configured URL and exact film independently, including Coherence's
   displayed-year difference without inventing its meaning. Inspect retrieval
   metadata, but do not equate SUCCESS with a supported/correct claim.
   Failure/missing status is not unavailability.
3. Compare separately against the earlier owner observations, without putting
   expected facts in the prompt: Coherence transactions, HD, shown audio and
   previously unchecked subtitles; Dune exact card, transactions, Ukrainian audio,
   subtitles and each video property. The earlier owner prices/lists may change.
4. Distinguish public-page metadata, missing public evidence and account-only
   evidence. Do not expect a public fetch to prove Play/new-transaction rights
   or reproduce every logged-in badge. Every unsupported aspect remains unknown;
   original language is not offered audio, 4K is not HDR/DV.
5. Keep original output/status visible, no screenshots/live text/HAR/evidence
   archive in Git or logs. Discuss owner observations and unresolved questions,
   not an accuracy score for two examples. No automatic scoring or comparison
   with stored Search output. Manually time latency if useful; unmeasured cost
   is unknown, not zero. Stop the server when done.

Offline acceptance covers request-tool isolation, matching displayed/sent URL
and prompt, auth/Host/Origin, one-shot behavior, status failures, non-persistence,
Search regressions and narrow viewport. Mocks do not establish retrieval quality,
truth, current metadata, regional availability or rights clearance.

## Implementation validation / environment limits

- Node v24.22.0 offline/HTTP suites: **78 passed**, no failures or skips.
- Installed Edge browser/Search regressions and URL-only 390×844 viewport:
  **43 passed, 3 skipped**, no failures. Two skips are missing WebKit binaries;
  one is opt-in same-host LAN without an explicitly supplied test IP. No download.
  This is not a real iPhone/Safari validation of the new mode.
- All **18 Search request bodies** were independently compared against the
  PR #175 checkpoint: byte-equivalent prompts/tools/generation settings.
- At initial commit `6f280b9`, Windows PowerShell 7 helper integration was attempted with `-UrlContext` and
  as a Search control. **Both failed at native detached launch** before readiness
  (`Detached launch failed; no session-bound fallback was started`). The cause
  in the current runner is not established; it is not a passing helper test or
  proof of a URL-specific defect. No fallback/security relaxation was introduced.
  The subsequent [paired launch diagnosis](windows-launch-diagnosis.md) identifies
  a shared multi-executable-selection defect, not a runner breakaway denial.
  After the single-executable fix, Search and URL Context helper integration,
  including parent-exit survival, passes. Actual new-mode SSH-disconnect use
  remains **owner-validation pending**; two later Safari live answers are
  owner-reported separately, not independently reproduced by the agent.
- No live API, account automation, production/system changes, live output,
  screenshot or response archive. Temporary helper test copies were cleaned by
  the test; the existing owner's server was not stopped/replaced.

The implementation-check results above retain their original execution scope;
no runtime tests were rerun for the evaluation documentation checkpoint. The
[next availability experiment](regional-card-proposal.md#next-experiment-current-ukrainian-availability)
is a proposal, not an implementation handoff or change to the fixed-card mode.

## Kinobaza candidate-link experiment

Owner-selected iteration after checkpoint `714a176`, stacked on the still-open
PR #176 (which depends on #175). Branch:
`codex/mw-fut-01-kinobaza-url-context`, PR base:
`codex/mw-fut-01-url-context`. Implemented/offline-tested at `54d1a9f`; two later
[owner-run live tests](digital-ua-owner-validation.md#kinobaza-url-context--two-completed-owner-run-tests)
returned no provider URLs. The narrow link-generation hypothesis is not
supported in the current scenario; this is not general accuracy or proof of
impossible integration. It does not implement the earlier preview proposal.

Set `DEMO_RETRIEVAL=url-context`, `DEMO_DISCOVERY=digital-ua` and
`DEMO_URL_SOURCE=kinobaza`. Keep `DEMO_AMAZON_REGION` unset. Source cards:

| DEMO_FILM | Fixed source (not a destination) |
| --- | --- |
| `coherence` | https://kinobaza.com.ua/titles/coherence |
| `dune-part-two` | https://kinobaza.com.ua/titles/dune-part-two |

The full prompt in [url-context.mjs](../url-context.mjs) is visible before the
click, together with film, source switch and exact URL. It asks for identity
and only the provider names/hrefs/territories actually exposed in the card's
digital-offer section. Preserve redirect/tracking URLs verbatim; missing href
or territory is unknown. Ignore page instructions and model memory; do not
reconstruct final URLs, follow links or transfer general film localization.
No expected provider URLs or owner-observed offer facts are in the prompt or
synthetic answer. A link is **not** confirmed availability or entitlement.
Audio/subtitles/video/prices/access-type verification is outside this mode.

Only the server's validated catalogue reaches the existing one-shot transport.
There is one URL Context request, no Search, retries, continuation, destination
fetch/resolve, parsing into a candidate list or second model. The browser shows
original natural-language text as text, with original retrieval/citation metadata
separately; returned URLs/markup do not become auto-loaded resources or a new
candidate-link UI. No storage/logging/archive. Existing localhost/LAN auth,
Host/Origin, CSP, server-only key and no-store/session checks are preserved.
Model `gemini-3.8-flash`, low thinking and 4096 output limit are unchanged.

Unset `DEMO_URL_SOURCE` still selects Apple in URL Context. Explicit `apple-tv`
is equivalent. Source values are rejected with Search; unknown/empty sources,
Blade Runner, physical discovery or any Amazon region fail before listening.
Search and Apple request bodies remain unchanged. Returning to Search requires
removing `DEMO_URL_SOURCE`, not merely changing `DEMO_RETRIEVAL`.

### Capability, href visibility and terms — distinct questions

Rechecked October 18, 2026 using public first-party sources, without Gemini
calls. The [regional-card decision](regional-card-proposal.md#kinobaza-url-context-decision)
is the canonical updated feasibility/terms record. Technical support for a
public HTML source does not guarantee that hrefs survive the provider's content
processing, or grant source/content rights. No specific prohibition of this
bounded URL-only transient display was identified in the reviewed pages; that
is not a legal permission finding. Resolve applicable rights before live use;
stop on an applicable restriction or blocked access. TMDb is not used here.

### Owner comparison (not run by the implementation agent)

**Historical reproduction plan, now completed by the owner for both films.**
No repeat Gemini calls are recommended. See the owner record for outcomes and
the separate Dune `m.vkino.com.ua` citation-source anomaly, and the
[initial-HTML/terms assessment](regional-card-proposal.md#initial-html-inspection-after-the-owner-tests)
for the next feasibility conclusion. A citation source is not a retrieval log;
do not claim exclusive Kinobaza origin for the complete answer.
The later [owner-approved HTML-only PoC](regional-card-proposal.md#owner-approved-html-extraction-poc)
is separate from URL Context: it changes none of these Gemini requests and has
no model, Search, citations or destination fetch. Its live extraction remains
owner-validation pending; a public-rules check is not live extraction evidence.

Use the [one-line Termius/PowerShell commands](iphone-windows.md#kinobaza-url-context-one-line-owner-commands):
synthetic first, then **one live request per film**, no automatic rerun. Reload
Safari after each owner-controlled restart and check source URL/prompt before
clicking. No environment state is assumed across SSH sessions.

1. Check synthetic labelling, source/film, original text and separate simulated
   retrieval metadata. No source was read. Explicit SSH disconnect survival for
   this new configuration remains owner-validation pending.
2. For each owner-run live answer, inspect exact-URL retrieval status; failure,
   missing/unknown/mismatched metadata does not establish page reading. SUCCESS
   is not accuracy, completeness, freshness or entitlement.
3. Manually inspect only the **source Kinobaza card** in Safari for identity,
   provider labels, exact hrefs (including redirect/query encoding) and explicit
   territory sections. Do not resolve/open destination pages for this experiment.
   If Safari cannot expose a href without navigating, mark it unverified;
   do not use automation or guess the final destination.
4. Classify observations in discussion: matching provider/link/territory,
   invented/reconstructed URL, wrong territory, missing href/unknown or source
   identity mismatch. Earlier owner provider checks are context, not expected
   answers, proof of all current links or a new entitlement check.
5. Stop after two cases or inaccessible/ambiguous identity/source/rights. Missing
   links are an unresolved result, not unavailable offers or proof that URL
   Context cannot ever expose links. No raw/live text, screenshots/HAR or
   metadata archive in Git; no accuracy score for two films.

### Independent validation for this iteration

- Offline/HTTP: **87 passed, 0 failed, 0 skipped**. Includes source validation,
  displayed/sent prompt matching, no browser override, one-shot concurrent/replay
  gate, mocked retrieval success/error/missing/unknown status and LAN auth.
- SHA-256 golden comparison against checkpoint `714a176` covers all **18 Search
  and two Apple request bodies**: unchanged prompts/tools/generation settings.
- Installed Edge/browser/mobile viewport: **49 passed, 0 failed, 3 skipped**.
  Both films use synthetic and mocked Kinobaza answers; original URLs/markup
  remain text, external browser requests remain absent, storage stays empty.
  Skips: two missing WebKit checks and opt-in same-host LAN without a test IP.
  No browser download; narrow Edge is not real iPhone/Safari.
- Windows PowerShell 7: synthetic Kinobaza, Apple and Search helper integration
  each passed in separate temporary copies/free ports: inherited source/prompt,
  parent-exit survival, duplicate start, unrelated-PID refusal, safe stop and
  restart. No owner process stopped, fallback, system or security-setting change.
  A test-only Node-path selection was made scalar as in the existing helper;
  restart now explicitly selects the same synthetic scenario and checks it.
- Sandbox initially denied Node child spawning (EPERM); tests passed with the
  permitted external runner. No test/security logic was weakened. Explicit
  Termius disconnect and independent real-iPhone validation remain pending;
  PowerShell 5.1 is not newly validated. No live Gemini calls were made.
- Existing native/managed safe-launch diagnostics regression passed. Three
  changed PowerShell files and all three one-line owner commands parsed without
  errors; the owner commands themselves were not executed against the demo.
