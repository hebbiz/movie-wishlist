# URL Context: two fixed Apple TV Ukraine cards

MW-FUT-01 remains **Discovery**, not production. Technical feasibility/decision
review: October 18, 2026. Base: PR #175 documentation checkpoint
`01db2331da3c169ce7c7b267fe69adadefe6952a`. PR #175 was open at implementation;
this is a stacked branch/PR **into its branch**, not a repeated diff into develop.
After the dependency merges, review/retarget the stack without rewriting shared
history. PR #173 is untouched.

## Decision and boundaries

Implement a minimal explicit `DEMO_RETRIEVAL=url-context`, with
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
do not add Prime Video or any discovered URL to this two-card catalogue.

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
`$env:DEMO_RETRIEVAL = 'search'`, select original switches, restart/reload. Helpers
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
