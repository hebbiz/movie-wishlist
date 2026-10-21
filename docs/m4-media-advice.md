# M4 — Mykola media advice

Status: M4.1–M4.3 implemented; narrow #192 blocker fixes validated locally;
default off; no live activation authorized. Pilot preparation is conditional on
independent review and the activation prerequisites below, not a pilot approval.
Pilot search-provider decision: **Brave Web Search approved**, candidate URLs
only, quality live-unvalidated; no activation authorized by this record.
Gemini Google Search Grounding remains excluded from URL → HTML extraction.
See [Brave decision/data-flow audit](#brave-pilot-provider-decision-and-data-flow-audit-2026-10-21)
and the preserved [Gemini finding](#gemini-primary-resolver-feasibility-2026-10-21).
Canonical implementation record, not a second research architecture. Evidence and
source boundaries remain in [research proposal](../research/grounded-answer-demo/docs/regional-card-proposal.md).

## Reviewed baseline and sequence

`develop` acbdadf8efa2d180a12ed3fc85aa7784bb681782 (2026-10-20).
Existing static add/edit form writes only on Save; no feature-capability system
exists. Group owner/member may edit; visitors may not. Migration files 001–016
are historical evidence, not proof of their deployed state. Owner checkout is
excluded from implementation.

1. **M4.1 — implemented, offline/browser-tested, live-unvalidated** isolated accessible form dialog, source-row selection, explicit
   medium/URL diff and local-only transfer. Capability fails closed until M4.2.
   Authored fixtures exist only in tests. No social-chat controller reuse.
2. **M4.2 — implemented, isolated SQL/mock-tested, live-unvalidated** authenticated Netlify boundary, backend-only per-user assignment,
   independently gated TMDb/MOTN and atomic technical ledger. New SQL only;
   migration application/production flags/secrets require separate authorization.
3. **M4.3 — implemented, mock/browser-tested, live-unvalidated** replaceable Brave Web Search resolver, ≤2 queries and ≤2 sequential
   admitted Kinobaza card GETs; no redirect/retry/destination resolution.

Each stage has a separate stacked PR; no merge/deployment in this task.

## Contracts and invariants

Form context: user + group + established IMDb identity + optional group-list ID
+ random form session. Typed title alone is insufficient. New film/group,
cancel, successful Save or logout invalidates it. Late responses are discarded.
Reopening retains same-session results. Abort does not refund a server attempt.
Only `recommended_medium` and `purchase_url` are transferable; no ownership,
status, title/year or added-by changes. Missing URL requires explicit clearing,
never silent retention of a different platform's URL. Form edits after preview
invalidate that preview. Affiliate/tracking acknowledgement preserves exact href.
Unsupported/unmapped platforms remain read-only. Source rows never merge.
Preview has its own opaque in-memory selection token, separate from discovery
generation. Cancel, Escape, close, re-render and any new selection revoke it.
After asynchronous access verification, both that token and the current form
context/field snapshot must still match before the two local fields can change.

## Source use and activation

Implementation/offline checks are not live validation or rights clearance.
No live source-body/API calls are authorized here. Existing dated research reviews do not
grant blanket production or arbitrary-card permission. Before live activation,
a separately authorized preflight must reconcile current TMDb, MOTN, Kinobaza
scope and account-specific Brave plan/terms, attribution, transient transfer and
permitted access. The public Brave terms review below is complete for this
bounded candidate-search decision, not a blanket rights clearance.
Brave search does not license destination content. No LLM or full-body archive.
No current production feature assignment, secret or migration is changed.

## Pilot (future, not executed)

Choose five actual owner Wishlist films before running; record their identities,
not a replacement exotic risk set. One trigger per film, no retries. Record
resolver candidate acceptance, identity outcome, extracted claims, useful links,
calls/time, intervention, transfer and preservation of manual edits. Missing
offers are not resolver failure. One brief owner session; no platform sweep.

## Validation and remaining work

M4.1 authored offline/browser validation covers capability failure, isolated
dialog, stale response and preview, exact URLs/acknowledgement, missing URL and
transfer-only fields. M4.2/M4.3 add server authz/concurrency/resolver tests.
Windows launcher components are unchanged and are outside this integration.
MW-FUT-01 remains Discovery; production readiness is a separate decision.

## M4.2 server and migration contract

Implemented, mock/offline tested; live-unvalidated. The server verifies a Supabase
Auth user (not user metadata), then calls service-role-only
`media_advice_action`. Every capability/start/reserve/finish checks backend
permission, fresh owner/member membership and (edit only) list/group/IMDb relation.
Add accepts an established IMDb selection without requiring an existing list row;
the server resolves/validates the crosswalk itself. No client result/role/counter
is accepted. Failed capability leaves normal editing usable.

No trusted TMDb preview is retained by the existing form lookup. Therefore the
full M4 ceiling is **8 source HTTP attempts**: IMDb Find 1 + Details 1 + UA
providers 1 + MOTN title 1 + Brave search ≤2 + Kinobaza cards ≤2. M4.2 alone ≤4.
Missing/ambiguous crosswalk skips MOTN, never guesses an ID. Details/providers
failure does not suppress an independent MOTN attempt with established crosswalk;
its own metadata/ID gate may still withhold claims. Identity Details are reused
within the action for localization/resolver, without additional fan-out.
The handler clock starts at entry, before reading the body, Auth or ledger RPCs.
Sources have only the remainder of the first **45s**; Auth and each RPC have at
most 8s and never more than the remaining phase time. At most one finish attempt
can use the next 8s, ending by 53s from entry. A 2s application response margin
and a further 5s platform margin fit Netlify's documented synchronous 60s limit.
Existing smaller adapter bounds remain; no budget increase or retry. Abort is
propagated to network/body waits; an awaited operation that ignores abort is
also raced against its deadline. This is an operational bound, not latency data.
The response distinguishes dispatched source attempts from the finish RPC's
durable reservation count. If a reservation reply is lost, no HTTP dispatch is
authorized by that reply; the ledger may still have consumed the slot. If the
whole action reply is lost, accounting is unknown to the client, not zero.
Deadline exhaustion returns 504 without source results. If a session ID was
received, the server makes one best-effort finish within its remaining margin,
never retries finish or fetch. Failed/lost finish withholds results; it may have
committed or left the session unfinished. Either way reservations are not refunded,
the form/action cannot replay, and the 30-minute TTL plus retention cleanup apply.
An unknown start outcome cannot be finished by guessed ID and is not retried.

Migration `20261020205122_media_advice_access_ledger.sql` was created using
Supabase CLI 2.121.0. It creates only a new private schema, default-off permission
assignments, technical sessions and restricted RPCs. New tables have RLS and no
anon/authenticated privileges; RPCs are service-role only. An advisory transaction
lock serializes a user's new sessions and reservations; no lock spans source I/O.
Follow-up `20261021072002_media_advice_review_fixes.sql` rechecks permission,
fresh group role and edit-card context **after** acquiring the advisory lock,
before any ledger mutation, including queued start/reserve/finish operations.
Permission expiration is checked against wall-clock time after that wait.
Per form session: one action; fixed stage names each reserved at most once,
maximum eight. Per user: twenty sessions per rolling 24h (including expired
30-minute sessions). Errors/lost responses consume reservations. No response,
HTML, credential or chat persistence. No session replay/result recovery.

Retention origin is the immutable action session's `created_at` (not its last
reservation, finish, logout or form close). Rows become eligible at age **24h**,
whether finished or abandoned, after their 30-minute active TTL has expired.
A still-active row is preserved defensively, including an anomalously extended
TTL; it becomes an overdue-monitor finding, not a reason to delete active work.
Daily service-only `media_advice_cleanup()` is expected to delete eligible rows
at ages **24–48h under a healthy scheduler**; opportunistic same-user cleanup can
delete them earlier within that window. There is **no guaranteed 48h ceiling**
during scheduler/DB failure. Movie, group-list/Wishlist and permission rows are
not deleted by cleanup. Permission assignments
persist until an authorized administrator revokes/removes them. No assignment
is seeded. No global historical RLS repairs or production migration commands.

Prepared, **not installed/activated**:
[inactive pg_cron job configuration](../supabase/operations/media-advice-cleanup.schedule.sql)
and [content-free health query](../supabase/operations/media-advice-cleanup.sql).
The daily job is named `mykola-media-advice-cleanup`, 02:15 UTC; configuration
refuses a non-UTC scheduler or an existing same-name job and creates it inactive
in one transaction. There is no `cron.schedule` in an automatic migration.
Enabling pg_cron/job requires later explicit authorization and baseline review.
Denys, as backend operator, owns activation and daily independent monitoring:
missing heartbeat, >26h since success, failed/inactive job or rows aged ≥48h
require investigation. The private singleton heartbeat stores only last success
and deletion count, atomically with deletion; a failed transaction cannot report
success. Inspect `cron.job` / `cron.job_run_details`; recover via one authorized
cleanup, never source replay or rate-counter reset. Before activation assign an
independent daily check/alert outside this cleanup job; a stopped scheduler
cannot report its own total outage. Cleanup health is backend-only, not browser
content. Cron history pruning remains an operator concern, not source archival.

Local validation uses PGlite 0.5.10 (test-only PostgreSQL/WASM), minimal authored
prerequisites, and this new SQL only. It proves SQL execution/privileges/replay,
not production migration history or native multi-connection/load behavior.
Native PostgreSQL **17.6** was additionally run in an isolated loopback cluster
with 24 distinct backend connections (matching the previously recorded target
major/minor, not querying production to attest its current version). Both new
M4 migrations run against authored prerequisites only; production migration
history/baseline reconciliation remains pre-activation work. No old SQL replay.

Server configuration (no values in Git): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `TMDB_READ_ACCESS_TOKEN`, `MOTN_API_KEY`;
M4.3 additionally `BRAVE_SEARCH_API_KEY`. Secrets are not arguments/URLs/UI data.
No configuration is changed by these PRs. Approved TMDb logo/complete current
attribution and applicable commercial/source-use terms must be checked during
activation preflight; text attribution and source links remain visible now.

## M4.3 automatic resolver and UI

No manual card field is required. The swappable search interface uses ordinary
Brave Web Search `GET https://api.search.brave.com/res/v1/web/search`, with
server-only `X-Subscription-Token`. A verified original title/alias, year and
director form a domain-limited query. Snippets/rank never establish identity or
claims and are not returned or persisted. At most one alternative known title
query is allowed **only when the first successful search yields no admitted
URLs**, not after transport/auth/quota errors or merely to seek a nicer result.
Read at most two distinct admitted candidates sequentially. More candidates are
reported unexamined, not declared absent. Provider-internal traffic is unknown.

Admission reuses the strict assisted policy:
`https://kinobazaua.com/titles/<lowercase-ascii-slug>` only; no query, fragment,
credentials, port (including explicit 443), alternative host, subpage, encoded
slash/dot path, normalization repair or guessed slug. Revalidate before every
GET; redirects/retries are refused. Search ≤15s/512KiB, source card ≤15s/2MiB,
within the remaining source phase of the entry-based deadline. A reservation
that outlives this phase cannot start a later search/card fetch. No
cookies/login/scripts/assets/destinations.

Identity reuses the existing independent canonical/title/original-title/year/
director/stable-ID gates, including unresolved director spellings/composition,
original-title scope refusal and stable-ID conflict priority. These parser
limitations are preserved, not fixed by finding a URL. Refusals withhold claims.
One matched card can contribute source rows automatically even when extraction
is partial. Two matched cards require an explicit choice of already checked
cards; selection adds **zero** requests and cannot override a refused identity.
An identity match is not extraction success, offer identity or account entitlement.

The dialog groups supported platforms for presentation only, keeps each source
row selectable independently, and retains unknown/unmapped observations read-only.
It shows source warnings, literal characteristics in details, localization scope,
shared JustWatch lineage, exact-link acknowledgement and a safe copyable report.
Report content is allowlisted counts/status/scopes; no raw URLs, tracking query,
source body, secret or manually edited draft. Commit remains unknown without
attestation. Clipboard denied/unavailable has selectable text fallback.
Default field exclusions remain price/currency, audio/subtitles/video, status,
owned medium, identity/title/year and added_by. No form write until explicit
transfer; no DB write until ordinary Save. No source request from rendering,
card selection, copy, review, transfer or cancel.

The ledger retains rate rows across list/group deletion: new contexts cannot
erase prior rolling-window usage. Historical foreign-key/RLS issues are not
modified. New accounting stores group/list IDs as technical bindings, checked
against fresh membership/list identity on each RPC, not cascading rate resets.

## Activation / operation plan (not executed)

1. Review #190 → #191 → successor M4.3 dependency diffs; do not merge/deploy as
   part of this task. Confirm production migration history separately; apply
   only the new migration later under explicit authorization.
2. Complete remaining source-use/account/attribution checks, including the
   existing TMDb logo and automatic arbitrary-card Kinobaza scope. The dated
   Brave public-terms finding below is not permission for Kinobaza content or
   proof of the owner's actual Order Form, quota or Netlify logging settings.
3. Brave ordinary **Web Search** is the approved pilot provider, not Answers/LLM
   and not a Gemini fallback. Verify the actual API plan/quota and provision
   `BRAVE_SEARCH_API_KEY` server-side in Netlify Functions for the intended
   develop branch-deploy context under separate activation authorization.
   Owner account/key possession does not establish Netlify configuration. No
   `GEMINI_API_KEY` is needed in this M4 path. No secrets, flags, account,
   subscription or credits are changed by this documentation decision.
4. Reconcile the actual migration baseline before applying the two new M4
   migrations. Review the entry-based hosting deadline and lost-outcome behavior.
   Authorize/configure daily cleanup separately; verify timezone, activation,
   heartbeat and independent monitor ownership. Native PostgreSQL 17.6 concurrency
   has passed locally; deployment/provider runtime behavior is not established.
5. Backend administrator may assign a small per-user, expiring permission using
   the private permissions table via a trusted server/admin path. No default
   grant, client toggle, user metadata claim or new legal acknowledgement switch.
   Keep feature off until these prerequisites and pilot authorization.
6. Five real Wishlist films, selected before requests; record titles/IDs privately
   for the pilot, not invented in this document. One form/discovery action each;
   maximum **10 Brave calls** inside **40 dispatched source attempts** (5 × 8),
   normally fewer. No Gemini/other-provider fallback. Search-provider
   internal traffic and manual browser navigation are separate/unknown.
   No full responses or platform sweep. Measure added useful claims as well as
   successful URL resolution; missing offers do not mean resolver failure.
   Stop for any false identity acceptance, unauthorized access, extra requests,
   unexpected writes or lost/manual field propagation. Review brief summaries.

## Verification record

Authored fixtures are not source HTML archives or live coverage evidence.
Real-form Edge browser covers desktop, 375×812 (iPhone X-sized) and 820×1180
(Air-sized), not real iPhone/WebKit validation. It checks social-state isolation,
local transfer, no write before Save, explicit clearing, affiliate acknowledgement,
manual edits, same-session reuse, late replies and clipboard fallback.
Local PostgreSQL/WASM validates only the new migration against minimal authored
prerequisites. Existing research offline/HTTP/security suites protect unchanged
requests, R1/R2 and old modes. No assertion/timeout is weakened.
Launcher/key-routing components are unchanged, but the pure shared URL-policy
import adds a copy-layout dependency. The Windows isolated test fixture now
preserves repository-relative paths; lifecycle is rerun for this concrete risk.
WebKit and live source/resolver behavior remain unvalidated. Windows lifecycle
was not repeated for the narrow #192 fixes: no launcher, key routing, research
transport or Windows fixture dependency changed; earlier evidence is reused only
for that unchanged boundary, not claimed as a new lifecycle run.

### #192 narrow blocker regressions (2026-10-21)

Original findings: pending apply survived Cancel/Escape while awaiting access;
the old 55s source clock excluded preceding Auth/start RPC; access checked before
the advisory lock could become stale while queued. Fixes are selection-token
revocation, entry-based phase deadline, and fresh post-lock authorization.
Authored regressions cover each trigger (not live source reconstruction), pending
close/new selection/manual edits, hanging Auth body/reserve/finish, resolver abort
after reservation, and queued flag/group/card revocation. Native 17.6 tests also
cover concurrent duplicate starts/stages, eight-slot cap, twenty-session cap,
service-only privileges and cleanup health. PGlite tests cover active/younger rows
and no card/Wishlist deletion. The isolated native server is stopped after tests.
Scheduler extension/run integration is **not run**: only inactive configuration
and the health query are prepared, no production job or migration activated.
An authored cron stub verifies the configuration transaction's UTC/refusal,
inactive-job and no-overwrite behavior; it is not evidence of pg_cron execution.

Final narrow-fix run: **43/43 M4 tests passed**, including real-form Edge at
1280×900 / 375×812 / 820×1180 and native PostgreSQL 17.6 with 24 connections;
**29/29** targeted research provider-grouping/matching regressions passed.
13 Markdown documents / 418 local links / 257 anchors: zero errors; whitespace
clean. To repeat native tests, set `M4_NATIVE_PG_MODULE` to the local pinned
`embedded-postgres@17.6.0-beta.15` module's `dist/index.js` before `npm run test:m4`.
No project dependency was added for that portable engine. Without the explicit
module path the native test is **skipped**, not successful native evidence.
Browser tests likewise need `PLAYWRIGHT_MODULE_PATH` and the installed Edge
channel; WebKit is absent. Native runs create authored temporary data and stop
their own loopback server, without installing a Windows service.

Platform references checked 2026-10-21:
[Netlify synchronous execution limit](https://docs.netlify.com/build/functions/configuration/?fn-language=js)
and [Supabase Cron scheduling/monitoring](https://supabase.com/docs/guides/cron),
[Cron configuration](https://supabase.com/docs/guides/cron/quickstart).
These are hosting/database checks, not movie-source rights clearance. The new
code is ready for focused re-review and controlled pilot **preparation**, not
automatic merge, activation or a claim of deployed readiness.

Recorded checks on the assembled implementation:
M4 authored offline/HTTP/SQL + Edge form suite passed; research offline/HTTP
**463/463** passed; Windows `windows.test.ps1 -Discovery` passed parent-exit
survival, duplicate start, inherited mock-key routing, safe stop and restart in
a disposable copy. No actual SSH disconnect was repeated. WebKit executable is
absent. Local links/anchors: 13 Markdown documents, 416 links / 257 anchors,
zero errors; whitespace clean. Exact final counts/remote statuses are recorded
in the implementation PR description rather than guessed here.

## Gemini-primary resolver feasibility (2026-10-21)

Historical Gemini proposal, retained for its explicit blocker. The later
[Brave pilot decision](#brave-pilot-provider-decision-and-data-flow-audit-2026-10-21)
supersedes provider selection, not this finding or the unchanged runtime gates.

### Decision and verified code baseline

**Outcome: concrete API-use blocker; documentation-only successor, no adapter
activation.** Current #192 HEAD `c5a09298903957b16360147b3363b8d4db90f195`,
base #191 `e0817151f73da0f742ee72b77bc23bb709457d7b`; fetched develop remains
`acbdadf8efa2d180a12ed3fc85aa7784bb681782`. All three #192 fixes are ancestors.
At that checkpoint the request was Gemini-only, so Brave was not silently
substituted. Its later explicit pilot approval below is a new provider decision,
not fallback behavior.

Inspection: `netlify/lib/kinobaza-resolver.mjs` exposes a replaceable
`searchFactory(apiKey, boundedFetch)` with `accepts` and `search`; its current
handler wiring in `netlify/functions/media-advice.mjs` still instantiates Brave.
**This documentation change does not switch that existing wiring off or claim
Gemini is installed.** M4 remains default-off, no activation or fallback is
performed. A deployment of the unchanged baseline with its old Brave key would
still select Brave; it must not be presented as the requested Gemini pilot.

Research `config.mjs`/`server.mjs` currently use `gemini-3.8-flash`, REST
`generateContent`, `googleSearch: {}`, low thinking, 4096 output tokens and a
server-side `x-goog-api-key`. `public/display.mjs` checks UTF-8 support offsets,
chunk indices and Search Suggestions to display the original answer/citations.
That display contract is not a reusable license for automated URL collection.
No secret values, owner configuration or live responses were inspected/copied.

### Source-use blocker: explicit, not missing permission documentation

The [Gemini Additional Terms, Grounding with Google Search → Use Restrictions](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)
(effective March 23, 2026; checked October 21) explicitly include these examples:
“using programmatic or automated means to collect Links” and
“using Links to identify destination pages for crawling or scraping”.
They restrict separating components for another purpose and require combined
grounded-answer/Search Suggestions display. The proposed machine URL resolver
followed by Kinobaza HTML extraction directly conflicts with that stated use
restriction. Transient memory, metadata-only URLs, fewer calls or adding display
do not remove this purpose conflict. No claim of a general ban on Gemini or
Kinobaza integration is made; this is the specific requested Grounding path.
No applicable written exception is established. Without one or a different
explicitly approved source route, do not activate this path. This is an
engineering source-use assessment, not a legal guarantee.

### Technical capability is present, but does not clear that blocker

| Question | Official contract / consequence |
| --- | --- |
| Supported model | [Stable model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) explicitly lists Search grounding for `gemini-3.8-flash`. Old model choice is still documented, not assumed valid merely because it exists in research. Account availability is not tested. |
| API variants | [Generate Content Search guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search) documents `POST /v1beta/models/gemini-3.8-flash:generateContent` with Google Search tool and header key. The [current main Search guide](https://ai.google.dev/gemini-api/docs/google-search) instead demonstrates Interactions. Do not mix their response shapes or assume an API migration fixes use restrictions. |
| Generate Content evidence | [GroundingMetadata / GroundingSupport reference](https://ai.google.dev/api/generate-content#GroundingMetadata): `groundingChunks[].web.uri`, support `groundingChunkIndices`, `segment`/part byte offsets, `webSearchQueries`, `searchEntryPoint`. Generated text alone is not metadata evidence; citation attribution is not film identity. |
| Interactions evidence | Main guide shows `google_search_call`, `google_search_result`/Suggestions and text `annotations` of type `url_citation`, with URL and segment indices. This is not the old `groundingMetadata` envelope. |
| Opaque URLs | Generate Content guide itself illustrates `vertexaisearch.cloud.google.com` source URIs. A `web` chunk has URI/title, not a guaranteed separate canonical-destination field. A generated canonical URL plus an opaque citation does not establish their equivalence. |

Any later permitted implementation must accept a URL only from a structurally
valid, actually grounded source reference, linked to the cited response segment,
then apply unchanged exact Kinobaza admission and independent identity/extraction.
Do not use citation title/snippet as a destination mapping or identity proof.
Wrong host, generated-text-only URL, empty/malformed grounding, or unsupported
opaque reference must return a precise non-candidate outcome, not absence of a
film/card. No redirect following, slug reconstruction, URL Context substitution,
provider fetch or hidden resolution request is permitted.

An opaque-reference-only result would require a **separately scoped proposal**
for one tightly bounded reference-resolution operation, with validated host/path,
target re-admission, accounting and terms review, before any implementation.
It is not approved here and would not itself solve the explicit use restriction.

### Accounting recorded before any implementation (proposed, not live-ready)

The API exposes a single application request that can cause multiple internal
Google Search queries. Keep these units separate:

| Unit | Ceiling / accounting rule |
| --- | --- |
| TMDb / MOTN HTTP attempts | Existing ≤4, unchanged independent gates and identity reuse. |
| Gemini API POST attempts | ≤2, each atomically reserved before dispatch using the two search slots. A lost response/timeout still consumes its reservation. |
| Google Search operations | Unknown unless a documented response exposes them; declared query metadata is diagnostic, not an attested billing total or guaranteed complete internal count. Never label two Gemini calls as two Google searches. |
| Kinobaza card GETs | ≤2, sequential; no redirects/retries/destination requests. |
| Application HTTP total | ≤8 = 4 + 2 + 2, not a total-network-traffic or cost cap. No extra opaque-reference hop fits this definition without a separately reviewed budget. |
| Time | Entry clock preserved: source work ends by 45s, finish by 53s, response/platform margin unchanged. No deadline reset or increased request cap. |

Second-call strategy, only if the use blocker is cleared: after a successful,
well-formed **grounded** first response with no admitted direct candidate, use
one different already-known title alias plus existing year/director to
disambiguate. No second call for auth/quota/transport/timeout, missing/malformed
grounding or opaque-reference-only output. Multiple direct candidates go through
the existing ≤2 card gates/choice, not a new LLM identity decision. This is not
implemented and is not permission to run a probe.

The [pricing page](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash)
currently lists Standard paid input/output at $0.75/$3.75 per million tokens
through December 31, 2026, then $1.50/$7.50 from January 1, 2027. Grounding is
not on the API Free tier for this model: 5,000 monthly search requests shared
across Gemini 3+ precede $14/1,000 search requests; each model-executed search
query is chargeable under its billing rules. No remaining quota, zero cost or
per-film price is inferred. The [rate-limit guide](https://ai.google.dev/gemini-api/docs/rate-limits)
uses model/project/tier limits (not per-key); actual owner limits are unknown.

### Data/configuration and pilot boundary

If later allowed, the outgoing input is explicitly projected public film
identity only: title/known aliases, year, director and optional IMDb. Never
serialize the whole film/source object: no user/group/form IDs, draft, TMDb/MOTN
offers, card HTML, full responses or owner control observations. No source data
to LLM for extraction, recommendations, localization or enrichment.

`GEMINI_API_KEY` would have to be separately provisioned in Netlify Functions
scope; an existing owner/demo key proves neither presence nor entitlement there.
That unimplemented proposal required server-side explicit Gemini selection, never
inference from whichever key exists. No env var, credential copy, provider-selection switch
or new dependency is installed by this blocked change. Existing
`BRAVE_SEARCH_API_KEY` is not invoked as Gemini fallback; baseline wiring is
unchanged as stated above. Do not provision keys to bypass this decision.

The five-real-Wishlist-film pilot must **not use the requested Gemini resolver**.
Provider choice is now resolved by the Brave decision below; no Gemini exception
is assumed. No owner evaluation or new risk-based study is requested. Tests for
any future, separately permitted Gemini adapter would still need: direct
grounded candidate; text-only/wrong-host/opaque URL; invalid/empty grounding;
ambiguous candidates; timeout/quota/no fallback; second-call strategy, ≤8 cap,
independent gates, R1/R2, exact URL/acknowledgement and form safeguards.
No placeholder adapter or synthetic pass is claimed as implementation. This
successor changes only Markdown, so runtime/browser/native suites are not rerun;
their #192 results remain pinned historical evidence, not a test of Gemini.
Verify local links/anchors, whitespace, scope and unchanged runtime tree only.
Documentation-only verification: 13 documents / 420 local links / 259 anchors,
zero reference errors; whitespace clean. Runtime/security/ledger/research paths
are byte-for-byte unchanged from #192 `c5a0929`; no runtime tests are newly
claimed. Actual Gemini/Search/card requests in this task: **0**.

## Brave pilot provider decision and data-flow audit (2026-10-21)

**Approved provider: Brave ordinary Web Search**, solely to find candidate
Kinobaza URLs. Current handler wiring already selects it; no runtime change or
provider switch is necessary. Gemini Grounding is not used for URL → HTML
extraction and is not a fallback. No other automatic fallback exists. Finding a
URL is not acceptance of film identity, extraction success or availability.
Search rank/snippets do not satisfy any identity gate or fill any offer field.
Resolver quality remains **live-unvalidated**, not established by authored mocks.

### Dated terms finding and boundaries

[Brave Search API Terms of Use](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service),
last updated September 1, 2026, checked October 21: §3(a) permits application use;
§3(b)(i) restricts Search Results persistence while excepting operational transient
storage. No direct equivalent of Google's Link-collection restriction was found
for this bounded candidate-only flow. This is not blanket permission or a legal
guarantee. §9(d) preserves third-party content rights; Brave grants no Kinobaza
content rights. Other §3(b) limits, including redistribution/AI-improvement,
remain; no Search Results are sent to an LLM or used for AI training/evaluation.
§4(c) end-user/privacy obligations and actual account/Order Form still require
operator confirmation. §4(d) attribution is optional but has requirements if
elected; this change adds no Brave branding or endorsement claim.

### Verified repository data path (no live traffic)

Reviewed #193 `e412c0374bc99279b8eaecbfacaf78bef44081d3` on #192
`c5a09298903957b16360147b3363b8d4db90f195`; both remain open, develop unchanged.
This is a code/mock audit, not an inspection of deployed databases, browser
extensions, log drains/APM or provider-side retention. No persistence or leak of
the specified Search Results was found in the application path; no fix required.

| Stage / inspected component | What exists transiently | What leaves/persists |
| --- | --- | --- |
| Brave response: `netlify/lib/kinobaza-resolver.mjs`, `braveWebSearch` | Bounded response bytes/JSON only in the current invocation (≤512KiB). | `web.results[].url` only through `admittedCandidates`; title, description/snippet, result envelope and numeric rank are not projected/logged/saved. Exact URL dedup/order preserves a bounded candidate list, not identity evidence. |
| Resolver: same module, `createKinobazaResolver` | Admitted URLs, ≤2 fetched card results, independently checked identity/extraction. | Only status/count/reason summary; matched card projections/choices. Rejected/unexamined raw search entries are not returned. No query/search response cache, disk, log or database call. |
| Projection: `netlify/lib/media-advice-service.mjs`, research `discovery.mjs` | Card `sourceURL` in provenance/film-localization or matched `cardChoices`, separate provider hrefs parsed from HTML. | Projected response only; `stages` removed. No raw Search Results or HTML archive. A source-card URL can reach the client as temporary provenance; it is not falsely claimed to be absent from the response. |
| HTTP boundary: `netlify/functions/media-advice.mjs` | Result/serialized response in invocation memory; secret-echo suppression. | `Cache-Control: no-store`; generic errors, no body/URL/error-object logging. RPC arguments are fixed context, operation, session ID and stage only, never search result/card URL/snippet. |
| UI: `assets/media-advice.mjs`; `app.js` media-advice bridge | Controller closure/session and text-only DOM; same-form reopening reuses memory. A chosen source-card URL may be shown. Invalidation clears session/DOM and rejects stale replies. | No localStorage/sessionStorage/IndexedDB, telemetry, chat-history snapshot or automatic navigation of search/card URLs. Requests use `cache: no-store`. `service-worker.js` has no fetch/cache handler. Closing retains appropriate current-session memory, not persistent storage. |
| Short report: `assets/media-advice-report.mjs` | Allowlisted counters, statuses/reason codes and localization scopes, copied only on explicit action; selectable-text fallback. | No search queries, result text/rank/snippets, raw source-card/provider URLs or credentials. Clipboard is an explicit user export of that safe summary, not a source archive. |
| Ledger/cleanup: both new M4 migration files | Private context bindings and attempt stages; cleanup health timestamp/count. | Technical session accounting only; no result/body/snippet/query/card URL columns or writes. Retention/permissions remain as above; no migrations executed in this task. |

The repository M4 path has no custom analytics/telemetry emitter, response logger
or Search Results storage. Existing unrelated app localStorage keys (group,
invite, conversation-finished boolean) and main-chat HTML state do not receive
this controller's results. Hosting instrumentation settings were not queried:
before activation, verify that function log drains/APM, replay or browser
telemetry do not capture request/response bodies or source URLs. This is a
remaining operational check, not a claim that remote logging was inspected.

### Separate origin and lifecycle of provider links

For Kinobaza source rows, provider hrefs in `row.link`/`rawHref` come from a
**separate Kinobaza HTML GET**, not from Brave's result URLs. MOTN links keep
their own API provenance. HTML links retain provenance and link classification;
tracking/affiliate transfer needs acknowledgement. `transferFor`/`makePreview`
pass only the chosen medium and eligible provider href, never card `sourceURL`,
search response, provenance object or snippet. Same-film/provider observations
do not merge, and film badges do not become provider tracks.

The controller changes only local form fields after explicit review/confirm.
Ordinary `getMovieFormData` → `getMovieGroupListData` → Save can later persist
that chosen **provider link** as `purchase_url`; no automatic save occurs.
Existing app form/movie debug logging can also contain saved/selected provider
URLs. Thus this audit does **not** claim that all URLs everywhere in MW are
nonpersistent/unlogged; the confirmed boundary concerns Brave Search Results
and search-discovered source-card URLs. Existing form logs do not receive the
Search Results, source-card provenance or M4 result object. No unrelated logging
refactor is introduced under a documentation-only provider decision.

### Pilot cap and remaining activation conditions

Exactly five actual Wishlist films, chosen before execution, not a new risk-set
substitution. One explicit action per form/case, no retries. Per film: TMDb/MOTN
≤4 + Brave ≤2 + card GET ≤2 = **8 application source HTTP attempts**. Across the
pilot: Brave **≤10**, card GETs ≤10, all sources **≤40**; these are ceilings, not
targets. Brave alternate query only after a successful first search with no
admitted candidate, never after timeout/auth/quota/transport error. Internal
provider traffic remains unknown and is not counted as known network traffic.
The entry deadline, atomic reservations, unknown accounting on lost responses,
independent gates, R1/R2 and form/draft controls are unchanged.

Provider selection is resolved; remaining preparation is the existing M4 review,
separate merge/develop branch-deploy authorization and verification of actual
Netlify context/functions/key mapping, source-use/account checks, reconciled
migration baseline, authorized cleanup/monitoring and backend-only pilot access.
No secrets/flags/migrations/deployment are changed here. The five-film pilot
and owner evaluation still require their separate activation step, not a new
research cycle or another provider-selection approval.

### Audit checks

No runtime defect found, so only canonical documentation/README change. Existing
resolver/report/HTTP authored regressions: **14/14 passed**. A separate in-memory
authored canary exercise traversed handler → resolver → projection → report/RPC:
2 Brave + 2 card + 4 baseline mock attempts, 8 reservations; no search
title/snippet/envelope/key in client output, no URL/result in RPC or report,
0 application log calls. Matched source-card URLs appeared only as transient
provenance/choices; a separately extracted HTML provider link kept exact href
and acknowledgement. The exercise disabled real fetch, saved no fixture/body
archive, and is not live validation. Static review additionally covered storage,
service worker, normal Save and existing app logging. Full browser/native/Windows
suites are not rerun for unchanged runtime; prior evidence is not relabelled.
Current documentation verification: 13 Markdown documents / 422 local links /
261 anchors, zero errors; scope and whitespace clean. The prior Gemini-only
checkpoint's 420/259 counts above are historical, not this audit's scope/count.
