# Proposed handoff: bounded UA discovery and local draft

**Proposed / not authorized for implementation. MW-FUT-01 remains Discovery.**
October 18, 2026. The [canonical architecture](regional-card-proposal.md#current-decision-checkpoint--proposed-not-implementation-approval)
owns decisions, source/field boundaries, rights gates and PR review. This is the
reviewable task boundary for D1, not approval, commands or a second architecture.

## 1. Context

Verified baseline: #181 `77b44b32a8570d55a567d952173d258a251bce88`, stacked on
#180 `b9f3c65342f9b558bf021f81aee26bb2f22029a8`. #175–#181 open/mergeable at
review; develop `a5d4f42`, production agreed v1.3.1 `e923928` unchanged. Recheck
instructions/stack/local changes before implementation. The
[owner ledger](digital-ua-owner-validation.md) separates reports from agent tests;
no live bodies archived. No new owner test is requested by this handoff.

## 2. Objective

Determine whether complementary automatic source discovery yields a useful short
UA viewing-lead list and explicitly selected local MW-shaped draft without LLM
or production writes. Test utility/interaction/evidence boundaries, not general
accuracy, playback or six-platform recall.

## 3. Current implementation

Isolated Node demo: server-selected modes/films, `/session`, one-shot `/answer`,
original Gemini output and separate non-LLM projections. TMDb A identity/catalogue
and B UA signals use max two requests; MOTN one IMDb UA request; Kinobaza one fixed
HTML card. Source-specific parser; no arbitrary card discovery or exact/search
link classification. MEGOGO opt-in/unresolved, not a dependency. No composed mode,
cross-source projection, film picker, selection/confirmation or draft transfer yet.

## 4. Scope

One isolated opt-in non-LLM mode, synthetic default, two fixed film choices:
Coherence (TMDb `220289`, IMDb `tt2866360`), Dune (TMDb `693134`, IMDb `tt15239678`).
Required TMDb+MOTN capabilities; optional visibly configured fixed Kinobaza cards.
UA only; Apple TV Store, Rakuten TV, HBO Max, Netflix, Prime Video, MEGOGO allowlist,
not a guarantee of rows from each. Reuse projections, add small lossless observation
view, explicit provider/link-kind map, compact list, local draft confirmation.
Choose actual new filenames/switches after inspection; none claimed implemented.

## 5. Non-goals

No new source, Gemini/LLM/Mykola inference, production UI/Supabase/schema/write,
Netlify endpoint/hosting/cache/queue, arbitrary text/URL/card discovery, destination
fetch, account/login/cookies/playback, complete audio/video/pricing enrichment,
parser broadening/Prime recovery/MEGOGO debugging. No JustWatch Partner API,
authenticated workers, scoring, cross-source offer merge, batch or raw/evaluation
archive. No paid subscription/system changes. PR #173 and unrelated files untouched.

## 6. Functional requirements

- Film picker accepts only server-advertised fixed keys; session token bound to
  film/UA/source configuration. No arbitrary URL/prompt, credential or request
  override. Mode/film/sources/budget shown before action.
- One click consumes token before await, no implicit retry/reload/batch calls.
  Draft actions perform no network requests. New token only via explicit reset
  or normal reload; never after failure automatically.
- Existing TMDb A+B first, then MOTN/optional Kinobaza independently bounded.
  Root identity failure blocks downstream; B/source failure preserves safe partials.
  Each source retains its own identity gate. Missing key is visible partial failure.
- Follow [canonical identity/field rules](regional-card-proposal.md#identity-provider-mapping-and-field-conflict-rules):
  namespaced IDs/labels, source methods/lineage/times/missingness; movie languages
  never populate provider tracks. Stable IDs conflict → mismatch, not fuzzy match.
- No merge by platform/link/empty IDs; rent/buy/package/cut/territory distinct.
  Comparable conflicts retain both claims, possible conflicts remain qualified.
- Preserve exact hrefs; classify known search/tracking/relative/unsafe/unknown
  without resolving/fetching. Apple Store not Apple TV+ by brand name. Unknown
  source aliases/IDs stay unmapped, not guessed.
- Compact UA rows in availability → UA audio → subtitles → video → price order;
  unknown/conflicting bands, separate territory-unknown candidates, collapsed
  foreign/technical details. No numeric score, inferred absence or source-value fix.
- Source availability/candidate/account entitlement/dated owner controls labelled
  separately. Literal MOTN UAH/HD/empty lists never replaced with USD/4K/UA audio.
- Select → explicit confirmation of included/excluded fields → editable local
  form; cancel leaves draft unchanged. Transfer only the canonical proposal's
  reviewed `imdb_url/title/year/recommended_medium/purchase_url/status` subset.
  Access/provenance stay in a research sidecar, not invented native form fields.
  Status stays explicit wishlist; no ownership inferred. Candidate is a lead only.
  Unknown/conflicting/suspect-price fields excluded by default; no autosave/submit.
- Attribution/errors/unknowns visible. Empty UA/language data not unavailable or
  absent; no current price/entitlement guarantee. No six-platform coverage claim.

## 7. Technical constraints

Max **4 HTTP requests/film** (TMDb2 + MOTN1 + optional Kinobaza1), 8 for two-film
owner plan. Preserve current endpoints/bounds: TMDb/MOTN 20s/2MiB each, Kinobaza
15s/2MiB; proposed overall cancellation 65s, not measured latency. No retries,
fallback/enrichment/continuations/polling/destinations or automatic redirects.
Cancel pending tasks on expiry; safe completed projections remain partial.

Keep localhost default, opt-in assigned private-IP LAN, exact Host/Origin,
route-wide Basic Auth, no-store/CSP/text-only output, no browser storage. Keys
server-side via separately hidden TMDb/MOTN helper prompts/minimal child env;
never browser/arguments/PID files/logs. Simultaneous routing needs mock Windows
checks; preserve breakaway/detach/safe PID controls and owner process. Explicit
user-opened links need safe protocol/separate context/no-referrer/noopener;
search/relative links are not exact navigation/transfer targets.

Page/operation memory only; no raw/normalized/draft persistence/analytics.
Source-specific [rights gates](regional-card-proposal.md#source-rights-persistence-and-privacy-boundary)
apply to combined transient projection/draft, not inherited blanket approval from
old probes. If terms unavailable, complete synthetic and keep live conditional;
no invented grant/ban or email requirement merely for unavailable text. No LLM
forwarding/AI evaluation. Supabase PostgreSQL/jsonb is future direction only,
not storage authorization. No new dependency unless necessary and justified.

## 8. Approach

Small opt-in composition with dependency injection; reuse `fetchTmdb`, `fetchMotn`,
`fetchHtmlCandidates` and projections. Minimal compatibility refactor only with
unchanged old request/output tests; no parser contract change. Compose projected
observations, not raw bodies. Implement the existing
[shared contract](regional-card-proposal.md#shared-offer-observation-model--design-only)
in small in-memory types; no generic crawler or merge engine. Known URL shapes/
provider aliases need authored tests/unknown fallback, not destination probes.

Single-purpose picker/list/selection/confirmation/draft, not chat. Use a reviewed
local subset of MW form fields, not importing app.js or authenticated Supabase.
Keep unsupported fields explicitly omitted. Record content-free elapsed/stage/
call count/quota errors in memory; no precise cost inferred from missing usage.

## 9. Verified components

Inspected at review baseline; re-inspect before changes:

- [config](../config.mjs), [server](../server.mjs), [network](../network.mjs):
  fixed configuration/synthetic/auth/session controls.
- [TMDb](../tmdb.mjs), [MOTN](../motn.mjs), [HTML](../html-source.mjs):
  catalogue/identity/bounded transports/projections. Existing parse5 isolated in
  [research package](../package.json), not production dependencies.
- [client](../public/client.mjs), [TMDb display](../public/tmdb-display.mjs),
  [MOTN display](../public/motn-display.mjs), [HTML display](../public/html-display.mjs):
  separate outputs, no composed list or transfer.
- [Start](../windows/Start-Demo.ps1), [Common](../windows/Common.ps1),
  [Status](../windows/Status-Demo.ps1), [Stop](../windows/Stop-Demo.ps1):
  currently one selected credential, not simultaneous TMDb/MOTN routing.
- [offline/HTTP](../test/demo.test.mjs), source tests beside it,
  [browser](../test/browser.test.mjs), [mobile](../test/mobile.test.mjs),
  [Windows lifecycle](../test/windows.test.ps1) plus authored mock-child fixtures.
- [Production form](../../../app.html), [app](../../../app.js), [movie search](../../../netlify/functions/movie-search.js):
  context only. Search's external-ID fan-out is not this bounded request plan;
  no production endpoints/client imports authorized.

## 10. Acceptance criteria

Fixed IDs/config/display/request agree. Synthetic zero external calls; live-mocked
max4 with identity/partial/cancel gates. Source/territory/access/link-kind/field
provenance explicit; catalogue localization never becomes tracks. Namespaced
provider mapping does not conflate store/subscription. Offers/conflicts survive;
search/relative/tracking do not become verified exact offers. Automatically found
usable lead can be explicitly selected/confirmed to accurate local draft; cancel/
no-write proven. Attribution present, secrets/private content absent. No storage/
LLM/destination requests. Existing modes/goldens unchanged. Live utility pending
owner session, not accuracy/account entitlement/full coverage.

## 11. Test plan

Authored mocks: IDs/year variance/conflicts; partial A/B/source/missing keys; six
providers plus unknown/Apple-subscription ambiguity; rent/buy/package/cut/country;
same platform/different offers; JustWatch shared lineage; UAH/USD/quality conflict;
missing/null/empty languages, catalogue vs tracks; exact/search/encoded/tracking/
relative/unsafe links. No parser expansion/destination resolution. Timeouts/body
bounds/403/429/abort, partial completion/max4, auth/Host/Origin/token replay and
no logs/storage/secret leakage. Preserve existing offline/request golden suites.

Browser narrow view: picker/session binding, compact results/details, unknowns/
conflicts, explicit navigation/selection/confirm/cancel, field default exclusions,
zero production writes/storage/destinations. External browser traffic blocked;
installed browser, explicit missing-WebKit skip, not real iPhone validation.
Windows temp-copy/free-port tests: multi-key routing, detached parent-exit,
duplicate start/safe stop/restart, credential non-persistence, unrelated owner
process intact. No agent live API calls or fixture copies of live responses.

After approval/readiness: **one short Termius → Safari session**, one discovery
per film and one local-draft flow. Existing dated controls, no repeat platform
tour/source probes/Coherence append test. Short new/useful/missing/conflicting/
draft summary only, not JSON/HTML/screenshots. Synthetic/SSH-disconnect repeat
only if respective workflow changes. Stop on identity/security/terms/budget
violation or 403/429/CAPTCHA; no automatic retry/new source/second owner round.
Only a genuinely material new discrepancy merits a targeted card check.

## 12. Documentation updates

Update README/canonical proposal/owner ledger/iPhone guide, no parallel architecture.
Distinguish implemented/offline-tested/live-pending, no fabricated expected facts.
Add commands **only after implementation**: PowerShell entry if SSH cmd; safe
ff-only update; standalone restart resetting all variables; separate hidden keys/
LAN password; exact Safari URL/username demo. Retain no-storage/trusted-LAN warning.
No raw archive/screenshots/public evaluation or production release-note feature.

## 13. Git workflow

Re-read instructions/fetch/inspect then-current stack/tree; do not assume #181
stays open. If open, new stacked feature branch/PR at current #181 HEAD with only
new diff; if merged, current develop after intervening-change review. Product
approval of this handoff required first. Preserve research/media-discovery and
other local/untracked files. Feature commits, test/link/diff/whitespace/isolation
checks, explicit readiness/skips/owner plan; stop review-ready. No force/history
rewrite/retarget/merge/tag/release/deployment/live agent calls/system changes.
