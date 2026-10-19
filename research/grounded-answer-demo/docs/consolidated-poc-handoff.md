# Approved research handoff: bounded UA discovery and local draft

**Approved for isolated research implementation only. MW-FUT-01 remains Discovery.**
Authorization follows checkpoint `e978e72389ec5fae7e2be141062b5606fd862f75`;
no production integration, persistence or merge approval. Optional Kinobaza is
enabled for the planned owner control session; its failure is nonblocking.
October 18, 2026. The [canonical architecture](regional-card-proposal.md#current-decision-checkpoint--proposed-not-implementation-approval)
owns decisions, source/field boundaries, rights gates and PR review. This is the
reviewable task boundary for D1, not production approval or a second architecture.

**Approved amendment after #182 `264ad83206c5304f41cc7abe56235cce4d2fae0c`:**
bounded Kinobaza localization extraction and one exact old-host→canonical-host
hop in composed discovery. The [canonical iteration record](regional-card-proposal.md#kinobaza-localization-enrichment--approved-bounded-iteration)
owns rules/evidence and supersedes the former link-only/Prime-recovery exclusion
only within this two-card scope. No MEGOGO work, new source or production approval.

Owner completed that session after #183 `7997b03`; the
[current audit/grouping checkpoint](regional-card-proposal.md#kinobaza-owner-checkpoint-link-audit-and-provider-grouping)
adds only presentation groups and precise per-row link reasons. It authorizes no
new source/owner requests or merged offer. Existing source bodies/budgets unchanged.

A later separately approved [current link diagnosis](regional-card-proposal.md#kinobaza-provider-link-loss--current-agent-diagnosis-and-bounded-fix)
used four canonical-card GETs, without provider requests or archives. Only proven
classification gaps for Prime native referral, iTunes UA movie-ID and MEGOGO short
UA view-ID routes are fixed. Native referrals now require draft acknowledgement;
exact href/row provenance, independent claims, request bodies and budgets remain.
No new owner test session is requested or production permission inferred.

## 1. Context

Verified implementation baseline: #181 `e978e72389ec5fae7e2be141062b5606fd862f75`, stacked on
#180 `b9f3c65342f9b558bf021f81aee26bb2f22029a8`. #175–#181 open/mergeable at
review; develop `a5d4f42`, production agreed v1.3.1 `e923928` unchanged. Recheck
instructions/stack/local changes before implementation. The
[owner ledger](digital-ua-owner-validation.md) separates reports from agent tests;
no live bodies archived. The original handoff requested no repeat source testing;
the approved localization amendment has only its single new-path acceptance session.

## 2. Objective

Determine whether complementary automatic source discovery yields a useful short
UA viewing-lead list and explicitly selected local MW-shaped draft without LLM
or production writes. Test utility/interaction/evidence boundaries, not general
accuracy, playback or six-platform recall.

## 3. Current implementation

At the approved handoff baseline: isolated Node demo with server-selected modes/films, `/session`, one-shot `/answer`,
original Gemini output and separate non-LLM projections. TMDb A identity/catalogue
and B UA signals use max two requests; MOTN one IMDb UA request; Kinobaza one fixed
HTML card. Source-specific parser; no arbitrary card discovery or exact/search
link classification. MEGOGO opt-in/unresolved, not a dependency. No composed mode,
cross-source projection, film picker, selection/confirmation or draft transfer yet.
That baseline description is historical; the implementation record below now
documents the completed research subset, not production integration.

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
general parser broadening/MEGOGO debugging. The amendment permits recognizing the
independently observed `amazon prime` badge and isolated provider-block properties,
not arbitrary Prime discovery or offer verification. No JustWatch Partner API,
authenticated workers, scoring, cross-source offer merge, batch or raw/evaluation
archive. No paid subscription/system changes. PR #173 and unrelated files untouched.

## 6. Functional requirements

- Film picker accepts only server-advertised fixed keys; session token bound to
  film/UA/source configuration. No arbitrary URL/prompt, credential or request
  override. Mode/film/sources/budget shown before action.
- One click consumes token before await, no implicit retry/reload/batch calls.
  Draft actions perform no network requests. New token only via explicit reset
  or normal reload; never after failure automatically.
- TMDb A+B and MOTN/optional Kinobaza independently bounded. TMDb transport/
  availability failure does not block MOTN with fixed verified IMDb ID. Each source
  has its own identity gate. Returned stable-ID conflict withholds that source,
  blocks cross-source combination and remains explicit; never invent common
  identity. Missing key is visible partial failure.
- Follow [canonical identity/field rules](regional-card-proposal.md#identity-provider-mapping-and-field-conflict-rules):
  namespaced IDs/labels, source methods/lineage/times/missingness; movie languages
  never populate provider tracks. Stable IDs conflict → mismatch, not fuzzy match.
- No merge by platform/link/empty IDs; rent/buy/package/cut/territory distinct.
  Comparable conflicts retain both claims, possible conflicts remain qualified.
- Preserve exact hrefs; classify known search/tracking/relative/unsafe/unknown
  without resolving/fetching. Apple Store not Apple TV+ by brand name. Unknown
  source aliases/IDs stay unmapped, not guessed.
  Without permitted exact/tracking candidate, purchase_url stays empty. Search,
  relative, unsafe and TMDb watch URLs cannot substitute. Tracking transfer needs
  explicit acknowledgement, preserved type/provenance, no resolve/rewrite.
- Compact UA rows in availability → UA audio → subtitles → video → price order;
  unknown/conflicting bands, separate territory-unknown candidates, collapsed
  foreign/technical details. No numeric score, inferred absence or source-value fix.
  No best-option claim with key fields unknown; show choice basis and missing data.
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

Max **4 HTTP requests/film without redirect; 5 only with one exact canonical
Kinobaza hop** (TMDb2 + MOTN1 + Kinobaza1+conditional1), max10 for two films.
Kinobaza off remains max3. Preserve current endpoints/bounds: TMDb/MOTN 20s/2MiB each, Kinobaza
15s/2MiB; proposed overall cancellation 65s, not measured latency. No retries,
fallback/continuations/polling/destinations or general automatic redirects.
Only exact `301/308` old fixed URL→`https://kinobazaua.com/titles/<same fixed film>`
is allowed in composed mode, no query/fragment/credentials/port/normalization tricks;
revalidate before request, never forward credentials, refuse loops/second hops.
Standalone HTML retains one GET. Provider-block enrichment remains Kinobaza-scoped,
not a provider-name join into MOTN or a generalized Data Merge Engine.
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
- [Kinobaza source-block extraction](../kinobaza-localization.mjs): general badge,
  isolated table/paragraph binding, exact labels/literal signs/formats, unknown
  completeness, no original-language/provider or cross-source inference.
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
owner session at handoff approval; the implementation checkpoint below now records
its completion, not accuracy/account entitlement/full coverage.

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
approval above is limited to research. Preserve research/media-discovery and
other local/untracked files. Feature commits, test/link/diff/whitespace/isolation
checks, explicit readiness/skips/owner plan; stop review-ready. No force/history
rewrite/retarget/merge/tag/release/deployment/live agent calls/system changes.

## Implementation record

Implemented from open #181 `e978e72389ec5fae7e2be141062b5606fd862f75` on a separate
stacked branch `codex/mw-fut-01-consolidated-discovery`. New mode `ua-discovery`,
server-only `DEMO_KINOBAZA=on|off`, one-process fixed film picker, independent
bounded sources and explicit local draft flow are now present. This closes only
the isolated research implementation authorization, not owner live acceptance,
production writes/persistence or merge. #175 launcher caveat remains: fix is #176.

Subsequent [owner functional checkpoint at #182 `3cd175a`](digital-ua-owner-validation.md#consolidated-discovery--owner-run-functional-checkpoint)
completed the two-film/draft session with partial results. No new owner test is
requested by that checkpoint. Narrow follow-up kept the same requests/security/budget: compact rows,
display-only access aliases, collapsed provenance/shape diagnostics and removal
of the destructive Cancel-edits reset. Cancel selection preserves edited draft.
Existing field exclusions/exact href handling stay unchanged. Redirect cause and
Coherence A partial cause remain unknown; authored fixtures do not recreate live
responses. New UI/diagnostics are offline/browser-tested, not live-revalidated.

Clarifications A/B/C above were reconciled with canonical proposal before code.
Actual transports remain the existing TMDb A+B/MOTN/Kinobaza functions; only the
new bounded composition calls them. One additive TMDb B error-identity diagnostic
preserves prior status/withholding, surfacing a returned stable-ID conflict even
when A matched. No source transport/parser/model/settings change.
Existing request-body golden regressions retained. Independent sources start
concurrently, TMDb A+B stay serial/gated; missing/failed TMDb does not block MOTN.
Returned stable conflicts withhold that source and block a common identity/merge.

`discovery.mjs` projects source-scoped rows without cross-source coalescing;
explicit provider aliases/IDs, unknown link kinds and field conflicts retained.
`public/discovery-client.mjs` mounts only in the new mode, shows compact rows/
details and review→confirm→edit/cancel page-memory draft. No suitable candidate
means empty purchase_url; opaque tracking opt-in preserves exact URL/provenance.
`server.mjs` binds allowed picker choice to token, ignores POST overrides, consumes
before awaits. New Windows helper parameters `TmdbToken` and `MotnKey` are secure
strings; default live prompts hidden/separate from LAN password, no CLI secrets.

Source-use review and checks are recorded once in the
[canonical implementation checkpoint](regional-card-proposal.md#consolidated-implementation-and-source-use-checkpoint).
**261 offline/HTTP passed; full Edge 119 passed / 8 skips** (7 WebKit absent, optional
same-host LAN unset), all eight temp-copy Windows mode lifecycle regressions and
native diagnostics passed. Separate same-host assigned-LAN Basic/multi-key lifecycle
also passed in a temp copy/free port, not iPhone reachability. No real iPhone/SSH/live source assertion. Additional
owner synthetic/disconnect repeat is not required by these covered changes.
Live readiness remains conditional on applicable source agreements/credentials;
no directly identified MOTN/Kinobaza conflict with this bounded non-LLM scope,
not blanket permission. [One-session owner commands](iphone-windows.md#consolidated-discovery-owner-workflow).

The separately approved localization amendment is now implemented from #182:
`kinobaza-localization.mjs` reads isolated block claims, `html-source.mjs` exposes
four independent layers and optional exact canonical transport, composition/UI
preserve provenance and do not join properties into MOTN by name. The standalone
HTML path stays one GET; composed max5 is conditional on the verified hop (base4).
Audio/subtitle properties remain sidecar-only, not draft fields. Requests/prompts/
settings for other sources unchanged; Windows helpers unchanged. Four approved
diagnostic GETs were source-structure inspection, not live execution of the new
adapter. Authored mocks/Edge and temp-copy Windows checks are implementation
evidence. Subsequent owner acceptance/source-claim observations are in the ledger;
the current grouping/reason correction has offline/browser validation, no new
owner acceptance requested. Grouping keeps row references and evidence separate;
unknown mappings remain separate and select/review/confirm binds to one row ID.
Unsafe sanitized hrefs remain unsafe, not missing. Navigation/draft labels explain
demo policy without broadening kinds, resolving URLs or changing draft exclusions.
