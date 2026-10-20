# MW-FUT-01 consolidated architecture proposal

## Verified baseline and M2 design status

**MW-FUT-01-M2: Proposed. Design only is authorized; implementation is not.**
Repository inspection on October 20, 2026, after fetching refs, confirms
`origin/develop` **`014014337ef5d2eb9ab95db09c334cef42d4b2fa`**. #175–#183
were consolidated through merge commits; launcher fix
`e596341f2fdc1203b52b9abae840f7090cef30c0` and reviewed R1/R2 tip
`16461b22f001499720193d6b72df745dc8890a20` are ancestors. The research tree
matches that tip. Main remains `e92392856038e40e6d98c6c8744eed04c4e8dff9`;
this is repository evidence, not a new production/deployment validation.

The [M2 matching policy](#m2-digital-offer-matching--proposed) below is the
canonical design extension of the shared observation contract, **not current
runtime behavior**. Its [13-section handoff](m2-offer-matching-handoff.md) is
Proposed / not authorized. The older [consolidated handoff](consolidated-poc-handoff.md)
records the implemented M1 slice. No separate ADR convention exists here;
proposed decisions remain in this document rather than a parallel architecture.

The consolidation task recorded 289 offline/HTTP passes, 126 browser passes /8
skips and eight Windows lifecycle passes on final develop. Those are **prior
implementation checks, not rerun for this Markdown-only M2 task**, not general
accuracy or entitlement. Earlier stack tables and “open/conditional/no merge”
statements below are dated historical snapshots superseded by this baseline.
Owner observations remain separately attributed in the owner ledger; no new
owner/source checks or raw evidence archive are introduced.

<a id="current-decision-checkpoint--proposed-not-implementation-approval"></a>

## Current decision checkpoint — approved isolated research

**Historical M1 decision/implementation timeline.** For current repository and
authorization status use [the verified baseline](#verified-baseline-and-m2-design-status).

Architecture review October 18, 2026 used #181 `77b44b32a8570d55a567d952173d258a251bce88`.
Implementation rechecked actual open #181 HEAD
**`e978e72389ec5fae7e2be141062b5606fd862f75`**, base #180
`b9f3c65342f9b558bf021f81aee26bb2f22029a8`; no intervening change. Remote refs
and all seven actual PR bases/HEADs checked; new work is a separate stacked branch.
Production agreed baseline remains v1.3.1 `e92392856038e40e6d98c6c8744eed04c4e8dff9`,
not a newly inspected deployment. `develop` remains #174 checkpoint
`a5d4f42149c616d4dc3cdac35c6086240b3fdacf`.

Current #182 checkpoint rechecked at `3cd175af47db6af31fe83e9eafae5336cad6eb36`,
open/mergeable on the same #181 base `e978e72389ec5fae7e2be141062b5606fd862f75`.
The two-film owner functional session is complete, with limits below; no new
live/owner cycle or merge is authorized. Earlier stack tables remain their dated
review snapshots, not fresh checks or approval of every parent.

The next separately approved research slice starts from open #182
`264ad83206c5304f41cc7abe56235cce4d2fae0c`, base #181 unchanged. Its
[Kinobaza localization record](#kinobaza-localization-enrichment--approved-bounded-iteration)
supersedes the link-only/no-hop limitation only within two fixed cards. Prior
owner results remain dated controls; no production or regular/commercial reuse approval.

Current owner-checkpoint/link-audit work rechecked open #183 HEAD
`7997b032abcef7d8af67c97ea8e879e3955e0dd4`, base #182
`264ad83206c5304f41cc7abe56235cce4d2fae0c`. The localization owner session is
complete; [the subsequent audit and presentation policy](#kinobaza-owner-checkpoint-link-audit-and-provider-grouping)
do not authorize another owner/live cycle or broaden source discovery.

Subsequent explicit approval permits the [bounded provider-link diagnosis/fix](#kinobaza-provider-link-loss--current-agent-diagnosis-and-bounded-fix)
from #183 `133a9fe3631362bd967ec57dc8b4e2fa201e8a96`, same base #182.
It used four canonical-card GETs in agent memory only. This establishes current
classification defects, not the historical owner hrefs or provider entitlement.

The subsequent [final code/stack review](#pr-stack-review-and-merge-sequencing)
rechecked #175–#183 at runtime1454c27 without live requests and found two P2
blockers. The [subsequently approved R1/R2 resolution](#r1r2-approved-resolution--offline-evidence)
after documentation checkpoint8680329 fixes those cases with authored offline
evidence. **Research merge is now conditional on review/policy/separate approval**,
not blocked by those two code findings. No roll-up/merge authorized or performed;
source/owner evidence below remains scoped history, not new live validation.

**Discovery only. Owner approved one isolated, non-LLM, two-film UA discovery →
selection → explicit draft-transfer PoC.** Required capabilities: TMDb identity/
UA signals and MOTN direct links/access types. Optional bounded Kinobaza HTML
adds candidate links from its two already fixed cards. MEGOGO extraction,
Gemini, arbitrary Kinobaza discovery, workers and production writes are deferred.
Successful MEGOGO extraction or six-platform coverage is not required.

Authorization after `e978e72389ec5fae7e2be141062b5606fd862f75` is research-only,
not production/persistence/merge. Kinobaza is enabled for the owner control session,
optional otherwise; failures cannot suppress independent sources. No best-option
claim with key fields unknown: show basis/gaps. Without permitted exact/tracking
candidate purchase_url is empty; watch/search/relative/unsafe URLs never substitute.
Tracking needs explicit acknowledgement with type/provenance preserved, no resolve.

This is the current decision view. Earlier experiments below are historical
evidence/terms records, **not competing next-step recommendations**. The
[shared observation contract](#shared-offer-observation-model--design-only)
remains the single conceptual field model. The separate
[handoff](consolidated-poc-handoff.md) records bounded research authorization,
not a second architecture. No established ADR practice was
found; significant proposed decisions are recorded in place, not a new framework.

### Evidence ledger and limits

| Evidence class / source | Established within its scope | Not established |
| --- | --- | --- |
| Implementation tests | Fresh cumulative **234 offline/HTTP passed** at the source checkpoint, including 46 MEGOGO and 22 unchanged Gemini request-body goldens. Authored mocks cover request bounds, identity, partial results, auth/one-shot, no destinations/persistence. Initial sandbox spawn EPERM was an execution restriction; unchanged suite passed with approved execution. | Not live source facts, entitlement, general accuracy or terms approval. |
| Owner: TMDb | Coherence identity/UA Apple Store rent/buy; first appends rejected. Dune after fix passed both blocks/five appends, UA HBO Max subscription/Rakuten rent/buy. Ukrainian title/overview/tagline useful; shown UA event language empty. | Coherence appends not revalidated. Catalogue localization is not provider audio/subtitles. |
| Owner: MOTN | Dune Apple/Prime links and rent/buy. Coherence options withheld by original identity/year defect, not a proven empty API list; separate website check had no UA offers. | Complete coverage/tracks/quality/currency. Apple HD/empty lists/UAH conflict with dated owner 4K/DV/UA-audio/USD. Field mapping audited; original response absent, upstream cause unknown. Year-only rejection fixed offline, not live-retested. |
| Owner: Kinobaza HTML | Initial two manual cases extracted hrefs. Later #183 session: Coherence Apple UA tracking + separate Prime audio-positive block; Dune HBO/Rakuten UA tracking + separate Apple/Rakuten/MEGOGO localization blocks, territory unknown. | Old Prime omission and three later link-policy refusal causes are not the same question. Current exact hrefs were not reported. Initial standalone parser accepted a foreign YouTube search candidate; composed URL policy excludes search from navigation/draft. Candidate links are not offers/entitlement. |
| Independent checks | Earlier read-only HTML inspection found relevant hrefs before JavaScript. Code audits established MOTN year gate, TMDb appended-ID assumption and MEGOGO policy defects. Current scope/isolation/stack audit. | Sampled HTML is not hidden Gemini payload or fresh destination/entitlement validation. No live source/API calls in this checkpoint. |
| Owner: Gemini URL Context | Apple tests supplied some identity/audio metadata. Both Kinobaza cases returned platform names but no hrefs; territory partial for Coherence, present for Dune. | SUCCESS/citation is not truth/completeness/freshness. Dune `m.vkino.com.ua` citation anomaly proves neither external fetch nor exclusive Kinobaza provenance. Href omission cause unknown. |
| Owner: MEGOGO; offline correction | First attempt HTTP 200/policy refusal; later DOM/canonical/JSON-LD/two H1s/30 duplicates, still pre-identity refusal. Attribute-aware v2 fixes authored defects. | Actual duplicate roles/locations, live identity/fields and post-fix compatibility unknown. **Unresolved/frozen; no new parser/live test cycle.** |
| Owner: consolidated PoC | Two discoveries, 4/4 calls each (Coherence490ms, Dune482ms), complementary source-labelled access/links; owner confirmed select/review/confirm/edit/cancel local draft. | Not independently reproduced, benchmark, general accuracy, entitlement or production readiness. Exact draft values/exclusions not separately reported. Both Kinobaza redirects and Coherence A partial remain unexplained. |
| Hypothesis | Complementary observations yielded useful leads and a local draft flow in these two owner scenarios without an LLM. | Broader utility/coverage remains unestablished; not six-platform recall or accuracy. |

All owner findings are owner-reported, not agent reproduction. Recording dates
in the [owner ledger](digital-ua-owner-validation.md) are not invented execution
timestamps. Prior app prices/settings are dated controls, not current truth.
TMDb and JustWatch-derived Kinobaza sections share lineage, not two independent
confirmations. No full answers, raw metadata, HTML or account data archived.

### Recommended PoC and product boundary

User chooses **Coherence or Dune** from a fixed server catalogue → one explicit
discovery → compact UA source observations/candidate links → selects/checks a row
→ explicitly confirms transfer to a **local, in-memory Movie Wishlist-shaped
draft form**. Edit/cancel allowed; no submit-to-MW, Supabase call, production
session or write. Row selection/link opening never implicitly transfers data.

This is automatic discovery of returned links/signals, **not a manually populated
provider-URL preview**. New utility: complementary leads with actionable access/
link information, uncertainty and selected draft, without copying raw debug panels
or an LLM. Fixed Kinobaza source cards are still inputs: arbitrary-film Kinobaza
card discovery is **not solved**. No general movie search or coverage guarantee.

Allowlist: **Apple TV Store, Rakuten TV, HBO Max, Netflix, Prime Video, MEGOGO**.
Unknown/out-of-scope IDs stay in a separate unmapped section, never silently
rebranded. No observation means “no result from selected sources”, not unavailable.

Default UI: chosen film/UA/request ceiling before click; source stage status;
platform groups containing separate source rows with display-normalized access,
known key fields, unknown/conflict markers and precise link-policy statuses.
Group summaries identify source and available field types, not a shared verified
offer. One shared source-claim/unknown explanation; each unscoped row explicitly
retains territory unknown. Raw access/link kind,
territory/basis, source/receipt time, missing fields, foreign dates/aliases/IDs and
field/conflict evidence are collapsed details;
warnings/unknowns/errors/attribution remain visible. No JSON dump by default.

Priority: **UA availability → Ukrainian audio → Ukrainian subtitles → video →
price/other details**, within comparable evidence/scope. UA aggregator buckets
remain source claims, not playback confirmation. Among comparable offers, explicit
UA audio/HD precedes explicit no-UA-audio/4K; UA subtitles precede unlocalized
video. Unknown tracks remain an unresolved band, not a negative or a hidden row.
Conflicts have no automatic winning rank. No numeric confidence, currency
conversion/cheapest inference or LLM re-ranking.

### Logical components and bounded flow

```text
Fixed film choice + one-shot session (no arbitrary URL/prompt)
  → independent bounded stages:
      TMDb A identity/catalogue → its stable-ID gate → TMDb B UA signals
      MOTN fixed IMDb UA options → its identity gate
      optional fixed Kinobaza HTML → its identity gate
  → lossless observations + explicit provider mapping/link-kind check
  → compact source-labelled list / partial failures / unknowns
  → owner selection → confirmation → local draft (no production write)
```

Reuse appropriate transport/projection functions, not raw payloads. Missing B
does not discard matched A or block other sources. TMDb transport/unresolved A
does not block MOTN with fixed verified IMDb ID. Each source gates its own output;
returned stable conflicts withhold that source and block cross-source combination,
with explicit conflict, not an invented common identity. No fuzzy replacement.
MOTN/Kinobaza each
retain their own identity gate, never borrowing A's matched label.

| Stage | Max HTTP requests/film | Conditions |
| --- | --- | --- |
| TMDb A Details + existing five appends | 1 | Fixed TMDb/IMDb, uk-UA; no append fallback. ID failure stops TMDb B, not independent sources; stable conflicts block combination. |
| TMDb B Watch Providers | 1 | Only after A passes; actual results.UA. TMDb watch-page link is not a provider deep link. Missing/empty/error is not unavailable. |
| MOTN fixed IMDb title, country=ua | 1 | Required capability/key, no country enumeration/search/enrichment. Error/missing key is explicit partial state, not success. |
| Kinobaza fixed initial HTML | 0, 1 or 2 | Optional; second GET only for the validated permanent same-title canonical hop. Two fixed cards, approved source-block localization; no arbitrary card search, broad parser expansion or destinations. |
| Other sources/destinations/LLMs | 0 | No MEGOGO/Apple GET, Search, URL Context, tracking resolve/retries/polling. Explicit owner navigation is separate. |

Ceiling **4/film without redirect; 5 only with canonical hop; two-film max10 only
with both hops; 3/film with Kinobaza off**. One film
per action, no batch or reload calls. Run A+B as one serial task alongside
independent MOTN/optional Kinobaza tasks with isolated failures. Existing limits:
TMDb/MOTN 20s / 2 MiB per request, Kinobaza whole-operation15s / 2 MiB including hop. Total cancellation
deadline 65s bounds composition, retaining margin beyond the serial two-call
TMDb task's transport limits; **not measured latency**. Preserve completed stages on expiry;
no retries/token replenishment. Record elapsed stages/call counts/errors in
session memory only, no content logs. Costs/usage unmeasured; no zero-cost claim,
new paid plan, token-budget change or automatic billing action.

### Identity, provider mapping and field conflict rules

Apply the [shared contract](#shared-offer-observation-model--design-only), not a
platform-keyed merged offer. IDs are namespaced (TMDb movie, IMDb, provider-native).
Exact agreed stable match survives a year difference with warning; stable conflict
is mismatch, missing required identity unresolved. Titles/aliases/directors cannot
override conflicting IDs. Version/cut is separate; no Final Cut case in this
two-film slice, unreported version stays unknown.

Use a small **reviewed explicit map** from observed source IDs/labels to the six
display providers, retaining original names/IDs. `tmdb:provider:2` is observed
Apple TV Store, not a global Apple identifier. MOTN service/addon IDs retain
their namespace; Kinobaza iTunes may map to Apple Store *candidate*, not Apple TV+
subscription. No missing ID invented or brand-substring mapping. Ambiguous
subscription/channel/addon stays unmapped. Provider grouping is presentation,
not offer equivalence; aliases require authored tests.

Rent/buy/subscription/free/ads/addon/package, territory/basis, film/cut/edition
and offer ID remain separate. Unknown scope identifiers do not compare equal.
The first PoC **does not merge offers across sources**. Possibly same listing
is only a tentative label; exact same-stage duplicates collapse only on all
scope/value/provenance keys, not platform. Each field retains source endpoint/
card, method, upstream, receipt time, reported time if supplied, context and state.
Preserve missing/null/empty where provided; MOTN already coalesces missing/null,
so do not invent lost precision. Empty language lists are not absence without
established completeness. Comparable contradictions retain both assertions and
a conflict; unestablished offer identity means possible conflict, not certainty.
Controls never overwrite source currency/quality/tracks/territory; MOTN UAH
anomaly remains literal, not changed to USD. Price needs its explicit currency.

Link kind: exact-card-unverified / tracking-redirect / search / relative / unknown.
Classify only conservative known shapes without requests; preserve exact href/
query/encoding. Unknown is not exact card. Search/relative/unsafe links are not
exact-offer transfer targets; tracking remains an opaque candidate, never decoded
into a guessed destination. TMDb watch-page link stays separate. Downstream
classification does not require changing Kinobaza extraction.

Draft copies only selected row's explicit title/identity and link the owner
confirms; access/context stay in a research evidence sidecar, not invented native
form fields. No foreign-row or catalogue-language enrichment.
A candidate-only row transfers as a lead with availability/territory unknown.
Suspect prices and unknown/conflicting fields are excluded from default transfer.
Confirmation shows included/excluded fields/provenance; cancel leaves form unchanged.

The inspected [MW form](../../../app.html) / [form projection](../../../app.js)
supports this proposed local subset, with no native price/audio/video fields:

| Draft field | Mapping only after explicit confirmation |
| --- | --- |
| `imdb_url` | Canonical IMDb URL from agreed matched ID; identity formatting, not reconstruction of a provider URL. |
| `title`, `year` | Explicit catalogue values with source/year variance labelled; no reason for a year difference invented. |
| `recommended_medium` | Explicit MW label map: Apple Store → `Apple TV / iTunes`, MEGOGO → `Megogo`; other allowed platform labels already exist. Unknown stays blank. |
| `purchase_url` | Exact safe absolute selected href; tracking retained with candidate warning. No TMDb watch/search/relative link disguised as exact offer. |
| `status` | Explicit `wishlist` draft default; rent/buy/subscription never sets owned/ordered/watched. |

Access/provenance/unknowns/conflicts remain a read-only **research sidecar**, not
new schema fields. Do not populate owned_medium/is_owned, group/user/added_by,
notes, ratings or account state. Actual app IMDb lookup/read-only-title behavior
is not changed or invoked by the local mock form.

### Source rights, persistence and privacy boundary

| Source | Scoped basis / remaining gate | PoC handling; production boundary |
| --- | --- | --- |
| TMDb | [FAQ](https://developer.themoviedb.org/docs/faq) and [Watch Providers](https://developer.themoviedb.org/reference/movie-watch-providers) re-read October 18, 2026: conditional non-commercial attribution category, logo/notice, JustWatch credit, no full deep links. [Current agreement](https://www.themoviedb.org/api-terms-of-use) still robots-denied. | Existing notice/logo/JustWatch credit retained. Review applicable combined non-LLM projection/draft scope during normal setup before live; past probe use is not clearance. No persistent derived cache, LLM forwarding or commercial permission inferred. |
| MOTN | [Contract review](#current-contract-and-rules-recheck) and [portal terms](https://developers.movieofthenight.com/terms-and-conditions): app display/functional retention subject to restrictions, attribution; AI training/evaluation/improvement prohibited. The currently linked public module was re-read at implementation; see checkpoint below. | Visible attribution, no AI/data-service/archive. No direct scoped non-LLM local projection/draft conflict identified, not inference/public-integration clearance. Functional retention is not a chosen cache policy. |
| Kinobaza | [Terms](https://kinobaza.com.ua/terms), current robots and earlier [bounded review](#public-rules-checked-before-implementation--october-18-2026); implementation checkpoint below records direct read/limited applicability. | Owner-approved fixed cards/transient extraction only. Preserve Kinobaza/JustWatch/tracking context, no broader licence. Regular/commercial automation, retention and redistribution rights unresolved. No email requirement solely for absence of explicit permission. |
| Gemini Search | [Additional Terms](https://ai.google.dev/gemini-api/terms) and [display guide](https://ai.google.dev/gemini-api/docs/google-search) checked October 18, 2026; Search-specific reuse/display restrictions apply to that path. | Existing original answer/citations/Suggestions only; excluded from model/draft. A general Data Merge Engine does not license normalization/cache of grounded output. No source data to LLM without established terms. |
| URL Context / MEGOGO | Existing [URL-specific review](url-context-poc.md#official-capabilities-display-and-terms-review) and [MEGOGO rules](#public-interface--terms-review); no new full clearance. | Retained isolated experiments, not composition dependencies. Tool capability/HTTP200 does not grant rights. MEGOGO unresolved; no new run. |
| Owner observations | Private context-bound controls, not universal source truth. | No account credentials/cookies/location history, scraping or worker. No publication of private content. |

Provider API rights do not license all destination content. Fresh pricing read
failed; prior MOTN free-tier checkpoint is not a current price guarantee or zero
total cost. Recheck normal account quota at activation; unknown cost is not a
new-source or paid-plan blocker for this design.

In particular, Google's Search subsection restricts component/link collection for
other purposes, caching/analysis and modification/interspersing of grounded output,
with specific limited exceptions. None licenses this proposed normalized offer
projection or a destination-fetch queue. Keep that output in its existing display
path; do not route it through the non-LLM observation layer to evade restrictions.

**No persistent cache**, including normalized results/draft: active operation/page
memory only, discard on reload/restart. No browser storage, analytics, raw logs or
response/evidence archive. Arbitrary TTL is not a legal right. Future product
storage, if approved, fits **Supabase PostgreSQL** relational identity/provider/
offer keys plus constrained `jsonb` observations/provenance/allowed-use/expiry and
user RLS. This is no migration or retention permission. No MongoDB/Redis/queue/new
hosting justified. Research Node/helpers are not production topology; assess
existing Netlify Functions/server constraints before product integration.

Keep secrets server-side with separately hidden prompts and minimal child env
for selected sources. Simultaneous TMDb+MOTN routing requires explicit helper/mock
tests. No arguments/files/logs/secrets in session payload. Preserve assigned-IP
LAN Basic/Host/Origin, trusted-home HTTP warning, no-store/CSP, one-shot before
await and text-only output. No arbitrary fetch/SSRF, scripts, assets, cookies,
redirects. User-opened links require action, safe protocol, separate context,
no-referrer/noopener; search/relative links remain text diagnostics.

### Decisions, roadmap and remaining approvals

| Decision | Choice and reason | Status |
| --- | --- | --- |
| D1: useful vertical slice | Two fixed films, required TMDb+MOTN, optional fixed Kinobaza; automatic source-labelled list/local draft. Kinobaza on for control session. | Implemented; two-film owner functional validation complete with partials, not general accuracy or production approval. |
| D2: evidence | No cross-source offer merge/global verified badge; field provenance, conflicts, candidate/offer/entitlement distinct. | Implemented in-memory research subset, not production model. |
| D3: writes/retention | Explicit local draft only; future persistence in existing Supabase subject to rights/RLS/mapping review. | Research draft implemented; no schema/write/cache authorization. |
| D4: LLM | Optional later explanation/research path, not truth source or AI-training/evaluation pipeline. | Deferred; no restricted-source forwarding. |

Roadmap: source probes/owner observations **completed with limits**; MEGOGO
**unresolved/frozen**; consolidated design/handoff **approved for research**;
composition/draft **implemented/offline-tested, owner functionally validated**;
compact-UI/cancel correction **offline/browser-tested, not live-revalidated**;
owner session **complete, no repeat requested**; arbitrary film/card discovery, physical expansion and product
integration **deferred**. JustWatch Partner API is deferred: suitable MW access/
commercial terms not established, not nonexistent. Personal authenticated workers
are a separate future discovery track: user-triggered, each user's own session,
private results, not one central owner's account. Not implemented now.

The owner approved D1 and optional Kinobaza on for the control session. No further
product choice is required within this isolated slice. Unknown fields remain an
accepted limit, not a promise to fill all gaps.
Current source-terms/key setup is an operational live gate, not a demand for paid
plans or blanket legal declaration. General search/LLM/cache/production writes
need later separate approval, not decisions required to complete this design.

### Acceptance and one short owner session

The following bounded plan was completed by the owner at #182 `3cd175a`;
[results and evidence limits](digital-ua-owner-validation.md#consolidated-discovery--owner-run-functional-checkpoint).
It is retained as the acceptance contract, **not a request for another session**.

Agent gates: authored mapping/link-kind/conflict/draft tests; zero synthetic/max4
mocked live calls; old request-body goldens; auth/Host/Origin/one-shot/bounds/no
destinations/storage; compact mobile view; temp-copy Windows multi-secret routing/
lifecycle/safe-stop regression, preserving owner demo. New helper/mode work is
agent-tested, not delegated to owner. Mocks are not live facts.

After source readiness: one Termius → Safari session, hidden keys/password in
reviewed copy/config, film/UA/budget visible, one discovery per film, one selection/
confirm/edit/cancel draft flow. No six-platform tour or repeat old probes. Dated
controls guide interpretation; only new material discrepancy justifies one
targeted card check. Synthetic/SSH-disconnect repeat only if corresponding workflow
changes, not documentation. Implemented commands are in the
[iPhone guide](iphone-windows.md#consolidated-discovery-owner-workflow).

Short summary only: stage failures, useful new links/access, unknown/conflicting
fields, draft outcome; no JSON/HTML/screenshots. Acceptance: partial source-labelled
results for both films; at least one automatically obtained usable candidate/offer
lead selectable into accurate draft; uncertainty survives; **zero production
writes**. Failure of utility on both films is a finding, not another run's approval.
Stop on identity conflict, unexpected requests/storage/credential leak, 403/429/
CAPTCHA/terms conflict or exceeded budget; preserve safe partials, no retries/new
source/second owner round by default. **No live run or owner test in this task.**

### PR stack review and merge sequencing

**Final research review, October20, 2026. Reviewed runtime #183
`1454c279c4d208538b93b3ee10cef14310388372`. At that snapshot research merge was
BLOCKED pending R1/R2 below.** The [later authorized narrow resolution](#r1r2-approved-resolution--offline-evidence)
supersedes that code-blocker status only; normal policy/owner approval remains.
No consolidation authorized by either record. Earlier owner/source findings retain their limited
scope; this replaces the older seven-PR review snapshot, not the architecture.

Fetched refs and inspected actual code/incremental diffs, not descriptions only.
All nine PRs are **open, non-draft, mergeable=true**; every current base HEAD is
an ancestor of its child. All69 changed paths from develop are inside this demo.
`develop=a5d4f42149c616d4dc3cdac35c6086240b3fdacf`,
`main=e92392856038e40e6d98c6c8744eed04c4e8dff9`; no deployment inference.
Each row's base SHA is the preceding row's full HEAD; #175 uses develop above.
The table freezes pre-documentation reviewed HEADs; this two-document commit
advances only #183, with unchanged runtime. Its resulting SHA belongs in the PR
and final report, not a self-referential follow-up commit.
Git mergeability is not code approval. Branch-protection API returned403
Resource not accessible by integration; rules endpoint unavailable to connector.
**Required checks/approvals/merge-method policy remain unknown**, not absent.

| PR | Reviewed HEAD / actual base | Incremental scope | Fresh remote statuses / check-runs | Research readiness / findings |
| --- | --- | --- | --- | --- |
| [#175](https://github.com/hebbiz/movie-wishlist/pull/175) | `01db2331da3c169ce7c7b267fe69adadefe6952a` / `develop` | 23 files: digital/Amazon, LAN/helpers | Preview success;3 completed neutral checks | Conditional only with #176 fix included; **not a corrected standalone checkpoint**. |
| [#176](https://github.com/hebbiz/movie-wishlist/pull/176) | `714a1766d8c8224ab8f62399a0b89cecc43d14ec` / `codex/mw-fut-01-digital-ua-amazon` | 23: Apple URL Context, launcher fix/diagnostics | Empty / empty | Conditional roll-up; no new scoped blocker. Includes required launcher fix. |
| [#177](https://github.com/hebbiz/movie-wishlist/pull/177) | `a4dbbab2b8a4b0030e1e9063d0f957fc1f72931b` / `codex/mw-fut-01-url-context` | 16: Kinobaza URL Context, HTML feasibility | Empty / empty | Conditional roll-up; unsuccessful href hypothesis is valid research, not merge blocker. |
| [#178](https://github.com/hebbiz/movie-wishlist/pull/178) | `30c3160efcf4ad2e1c489159db815445e61fa539` / `codex/mw-fut-01-kinobaza-url-context` | 21: bounded HTML/parse5 | Empty / empty | Conditional roll-up; source-rights/live limits, no new scoped code blocker. |
| [#179](https://github.com/hebbiz/movie-wishlist/pull/179) | `9e4bf4f90ab3d0cc4d8e203f5b47470511be0b4c` / `codex/mw-fut-01-kinobaza-html` | 16: MOTN/identity fix, TMDb handoff | Empty / empty | Conditional roll-up; currency/quality/language/coverage discrepancies remain source limitations. |
| [#180](https://github.com/hebbiz/movie-wishlist/pull/180) | `b9f3c65342f9b558bf021f81aee26bb2f22029a8` / `codex/mw-fut-01-motn-api` | 17: TMDb metadata/UA, append fix | Empty / empty | Conditional roll-up; Coherence A partial unresolved, not security/merge defect by itself. |
| [#181](https://github.com/hebbiz/movie-wishlist/pull/181) | `e978e72389ec5fae7e2be141062b5606fd862f75` / `codex/mw-fut-01-tmdb-data` | 17: MEGOGO/failure policy/architecture | Empty / empty | Conditional roll-up; opt-in isolated, honest failure, MEGOGO unresolved/frozen. |
| [#182](https://github.com/hebbiz/movie-wishlist/pull/182) | `264ad83206c5304f41cc7abe56235cce4d2fae0c` / `codex/mw-fut-01-megogo-html` | 18: composed discovery/local draft | Empty / empty | R2 in mapping/composition; do not treat as a corrected standalone integration endpoint. |
| [#183](https://github.com/hebbiz/movie-wishlist/pull/183) | `1454c279c4d208538b93b3ee10cef14310388372` / `codex/mw-fut-01-consolidated-discovery` | 18: localization/canonical hop/link policy/grouping | Empty / empty | **Blocked: R1 and inherited R2**. Documentation-only review does not fix these. |

No Actions workflow found in Git. Empty statuses/check-runs are **not successful
checks**, nor does #175's Preview test research code. Fresh local cumulative
checks below ran at the reviewed child tree, not independently at all nine HEADs.

#### Findings and bounded fix plan — historical review, now resolved below

R1/R2 were P2 at reviewed1454c27, reproduced without live data. The fixes were
not authorized by that review itself; the owner subsequently approved only
these two cases after8680329. Original triggers/plan remain below as history;
current implementation/evidence/status are in the resolution record.

**R1 — P2, affiliate acknowledgement bypass on an already accepted Apple route.**
[discovery.mjs](../discovery.mjs), line85 (classifier lines74–87), and
[discovery-client.mjs](../public/discovery-client.mjs), lines25–31/65–74.
Authored offline trigger:
`https://tv.apple.com/ua/movie/fictional/umc.cmc.fictional999?at=fictional`.
The same recognized Apple affiliate key `at` sets the gate only on the new
itunes route. On this accepted tv.apple route the result is transferable exact
card with no acknowledgement flag; `prepareDraft(..., false)` includes the URL,
so the review checkbox is absent. Explicit navigation/review still occur; this
is a promised consent/provenance-boundary defect, **not proven credential leak,
entitlement or hidden network activity**. No assertion that a live source returned
this authored URL.

Proposed fix: detect the reviewed Apple affiliate marker after safe host/path
validation independently of its accepted card route; preserve exact href/query,
unverified kind/referral/provenance and separate navigation. Add both-route
at/plain URL and encoded-query tests, draft blank-before-ack/check/uncheck,
confirm/cancel/mobile tests. Do not infer arbitrary query semantics or strip URLs.

**R2 — P2, same namespaced provider ID can become two conflicting platform groups.**
[discovery.mjs](../discovery.mjs), lines44–56 and TMDb row projection lines109–120.
Authored offline UA bucket with `provider_id=999999` twice, once labelled Netflix
and once Prime Video: composition emits both groups with the same
`tmdb:provider:999999`, empty conflicts and no unmapped record. The ID is fictional;
no claim about a real ID's service or occurrence in a live response. The TMDb
guard checks ID/label coherence only for Apple Store ID2, while other names map
without a same-ID/cross-label consistency check. Consequence: contradictory
upstream identity can appear as two independent positive platform/access claims
and supply the wrong selected draft medium. Row grouping itself does not merge
fields and no production write occurs; **data integrity, not a security finding**.

Proposed fix: retain source labels/IDs and detect conflicting canonical mappings
for one namespaced provider ID within the response, including across UA access
buckets; keep conflicting rows unresolved/unmapped rather than choosing a label
or positive group. Maintain reviewed ID/label guards and source namespaces; do not
invent new provider IDs. Add same-ID/different-platform negatives, consistent
aliases/rent-buy positives, missing-ID and Apple Store/subscription distinction,
plus browser unresolved-provenance/draft exclusion checks. No source call needed.

Apply these only after a separate narrow fix approval, preferably one new commit
on current #183, without changing parent history. Rerun relevant authored probes,
full offline/security/body/budget tests and targeted/full mock browser suites.
No launcher change is needed; no Windows/owner/live rerun by default. A fix plan
is not permission to implement or merge. No P0/P1 found in the inspected scope;
this is not a general security certification.

#### Verified safeguards, coverage limits and readiness classes

Reviewed in actual code: HTTPS plus populated-userinfo/non-default-port/unsafe
character checks, exact provider hosts/native paths, matching provider key,
search/relative/watch refusal, exact href/referral/query retention; no destination
resolution. WHATWG URL parsing accepts normalized default443 and empty userinfo;
these authored probes did not demonstrate credential or address bypass, and are
not labelled security blockers. The canonical source hop instead compares exact
raw strings and rejects those variants, foreign hosts, wrong titles, credentials,
queries/fragment/ports/loops/second hops; max one301/308 transition.

Budgets4/base or5 only with the approved hop, independent TMDb/MOTN/Kinobaza
identity/failure gates, unique allowlisted requests and cancellation are retained.
Provider groups hold original rows, not synthesized offers; territories/claims
do not leak across source rows. Tracking and the **currently recognized** native
referrals have correct acknowledgement/review behavior, except R1's missing
recognition. Draft excludes prices/tracks/video/ownership, stays page-memory only,
explicit confirm and Cancel preserving manual edits; no autosave/production writes.
Keys remain server-side, fixed LAN/auth/Host/Origin/session controls precede API
calls, response projection/text-only display/no-store retained. No new endpoints
outside research or root runtime/dependency/schema changes.

- **A. Research merge at1454c27:** R1/R2 blocked the final roll-up. Both are now
  fixed in the separately authorized child iteration below, not in parent HEADs.
  Review/policy/merge approval still gate the roll-up. #175 alone retains
  its known launcher defect; include #176 before any integrated use. Policy/owner
  approval remains required and unknown policy cannot be assumed satisfied.
- **B. Live use/source rights:** credentials/current applicable agreements and
  bounded source-use gates remain conditional. Prior observations, including
  Kinobaza's current links, are not broader extraction/cache/redistribution rights
  or account entitlement. No fresh source rules review/live request in this task.
- **C. Production integration:** not authorized; rights/retention/attribution,
  hosting/static-publish isolation, auth/TLS/write/RLS design, arbitrary-film
  discovery and coverage/field reliability require separate work. Research files'
  exclusion from Netlify publishing is not established in Git; no publish probe.

MEGOGO transport/policy remains opt-in/fixed/synthetic by default with explicit
unresolved failure; not a composition dependency. Its lack of a useful live
result, Coherence A partial, incomplete provider fields/coverage and entitlement
are **not automatic research merge blockers** or new security findings.

#### Proposed consolidation sequence — no operations performed

Prefer an **existing-base, child-into-parent roll-up**, after R1/R2 fixes/review
and explicit consolidation approval. This replaces the old oldest-first plan:
do not land #175 alone as an apparently corrected develop checkpoint.

1. Freeze/re-fetch all refs, verify policy and that the reviewed corrected tip
   includes launcher fix **`e596341f2fdc1203b52b9abae840f7090cef30c0`** from #176.
   That commit selects one Node executable, retains breakaway/no-fallback and
   secret-safe diagnostics. All later current heads contain it by ancestry.
2. History-preserving merge **#183 into #182's branch**, its existing base.
   Keep branches; review the widened #182 HEAD/diff/checks before the next step.
3. Likewise merge **#182→#181, #181→#180, #180→#179, #179→#178,
   #178→#177, #177→#176, #176→#175**, each into its already configured base.
   The parent tip changes, so refresh its review/checks; earlier empty checks
   are not portable approvals. Do not auto-delete branches during the roll-up.
4. Only then review the full combined #175 diff against current develop and
   merge **#175→develop** after explicit approval. #175 now includes #176 fix
   and the reviewed corrected later research, never an intermediate broken
   launcher checkpoint. Main/PR173/tag/release/deployment remain out of scope.

**Preferred retarget count: zero**, because existing bases already form the
chain. Require the repository's allowed history-preserving merge method; do not
assume policy permits it. If policy requires squash/rebase, a base disappears,
refs diverge or parallel changes occur: stop for a revised owner-approved plan.
Do not force-push, cherry-pick, duplicate diffs or improvise history reconciliation.
An alternative oldest-first/retarget workflow requires separate approval,
including how to avoid exposing #175 without its fix.

After every parent advance (or any separately approved retarget): verify base/
ancestry/reviewed tip, remaining diff/scope/whitespace/links, required approvals/
remote checks and cumulative offline regressions. Re-run mock browser/security
checks for effective UI/adapter/conflict changes; Windows temp-copy lifecycle/
key-routing only if those components change. Final full browser suite at roll-up
candidate. No new live/owner test merely for documentation/base changes.

**Final develop SHA cannot be predicted.** After a future authorized final merge,
record actual remote develop SHA `D`, corrected reviewed tip `H` and actual merge
commits. Validate **D itself**, not this pre-merge tip: launcher-fix and H are
ancestors; research tree matches the reviewed candidate (unless separately
reviewed parallel changes); diff from recorded old develop is research-only;
production/main remain unchanged. Run offline/browser/link/whitespace/required
checks on D, sync local develop without overwriting local files. If current
develop moved, preserve/review its changes and re-establish these assertions.

#### Fresh review checks, not live validation

At runtime1454c27: **284 offline/HTTP passed**, **124 installed-Edge browser
passed /8 skips** (seven absent-WebKit checks, optional same-host LAN unset).
Mock narrow viewport is not real iPhone. Existing suites pass but omit R1/R2;
separate authored in-memory probes reproduce them, no network/storage. Initial
R2 probe selected an empty synthetic bucket and failed in the diagnostic harness;
corrected selection of the reported rent bucket then reproduced the actual issue.
This was not a runtime/test fixture fix or hidden failing product check.
Windows was not rerun: helpers/key routing unchanged since previously recorded
integration tests; no new uncovered launcher defect established. Actual launcher
source/ancestry and historical controlled diagnosis re-read. No owner process
touched, live API/source/destination request, system/deployment operation or
response archive. This follow-up changes only README and this existing document;
PR description updated separately. Untracked research/media-discovery preserved.
Documentation checks:236 local links/168 anchors across nine Markdown documents,
13 ordered handoff sections; final scope/whitespace and unchanged runtime checked.

#### R1/R2 approved resolution — offline evidence

Separate narrow runtime approval after #183 documentation HEAD
`868032969dd737c96c11613ec532b79caac428ca`; base remains #182
`264ad83206c5304f41cc7abe56235cce4d2fae0c`. Parent branches are unchanged; the
table above remains the prior review snapshot, not a claim that parent commits
contain this fix. Existing untracked research preserved. No source/live/API/
destination request, new provider/host/route/marker, helper change or owner test.

**R1 resolved:** after the existing safe host/path/provider gate, decoded query
key `at` is treated identically on accepted iTunes and tv.apple.com card routes.
Presence requires explicit draft acknowledgement even if its value is empty,
bare, repeated or the key uses equivalent percent encoding. This is a conservative
consent policy, not proof an empty key actually performs affiliate accounting.
Keys are case-sensitive: `AT`, `attribution` and repeated `l` are not `at` and
do not add a gate. No markers inferred or parameters removed/reordered/decoded
in the stored href. Navigation remains explicit-only and separate. Before ack
purchase_url is blank; check/uncheck toggles inclusion of the exact string.
Existing opaque tracking/Prime referral gates, provenance/default exclusions and
cancel preserving confirmed/manual draft edits are unchanged.

**R2 resolved:** an in-memory consistency pass uses only explicit IDs and
recognized canonical labels from independently identity-gated TMDb/MOTN data.
Key is `source:provider:id`, not bare numeric ID. The same namespaced ID mapping
to more than one recognized canonical platform is quarantined for that response,
including across UA access buckets. A conflicting label rejected by the normal
source-specific mapper still participates in consistency detection; do not let
one half silently win. Compatible reviewed aliases normalize to one key and
are not conflicts. Rent/buy/package observations remain distinct, not merged.
Unknown labels keep the existing unresolved mapping behavior, not invented
aliases/platforms/IDs. Kinobaza has no reported provider ID, so no ID is inferred
from block name/href and no name-only cross-source property join is introduced.

Conflicting observations are retained in `unmapped` with reason
`provider-id-conflict`, exact namespaced ID/raw label, source bucket or projected
option and receipt/source/country/upstream provenance. No canonical provider,
access/availability row or draft medium is emitted for them. The UI explicitly
shows provider ID conflict/unresolved and no selection/navigation/transfer action;
details retain raw source access/link evidence, not a synthesized offer. The
existing draft membership/identity guard rejects these entries. Other IDs and
other source namespaces remain independent; an ID conflict does not convert
film identity into a mismatch or suppress good observations from that source.

**Current readiness: conditional for isolated research review/merge approval.**
R1/R2 code blockers are resolved by this child, not waived by passing old tests.
Required branch checks/approval/merge-method policy remains unknown from the
previous inaccessible API; zero remote checks are not success. Consolidation
sequence is still a proposal, no permission to execute it. #175 launcher caveat
and mandatory inclusion of #176 remain unchanged. Live use/source-rights and
production blockers remain as listed above; MEGOGO unresolved, Coherence A
partial, entitlement and incomplete coverage/fields remain limitations, not
automatically new research merge defects. No new owner test cycle requested.

Verification: the R1/R2 regression cases first failed at the prior runtime
(missing Apple gate and two conflicting rows still canonical), then passed.
**55 targeted offline/HTTP passed;289 full offline/HTTP passed** including five
new authored tests. Cases cover both Apple routes/plain/at/empty/bare/repeated/
decoded query, exact string preservation, same ID incompatible labels across
access buckets, aliases/rent-buy, numeric namespace isolation/no invented IDs,
MOTN conflicts and unaffected independent source rows, draft membership refusal.
Full installed-Edge mock browser suite: **126 passed /8 skips** (seven missing
WebKit binaries, optional same-host LAN setup). Not real iPhone/live validation.
Two new browser scenarios cover affiliate ack check/uncheck/confirm/cancel and
conflict panel/provenance/no selection, with good rows still selectable, unchanged
request counts/auth/one-shot/no storage. The first conflict-panel assertion counted
an unrelated pre-existing Kinobaza unmapped item; selector corrected to conflict
rows only, without relaxing runtime or hiding independent unknown observations.
Windows lifecycle not rerun: helpers/key routing unchanged. Local links238/
anchors170 across9 Markdown documents and13 handoff sections, scope/whitespace
checked. Owner demo/untracked files untouched; no merge/retarget/roll-up or deployment.

### Consolidated implementation and source-use checkpoint

Implemented on `codex/mw-fut-01-consolidated-discovery`, stacked on open #181
**`e978e72389ec5fae7e2be141062b5606fd862f75`** / base #180 `b9f3c65` after
fresh fetch/state checks. #175–#181 remain open on their original sequential
bases; no parent modified/merged/retargeted. Earlier PR-review table/metrics are
the architecture-review snapshot, not the new feature's commit or a merge action.
Known #175 multi-PATH launcher defect is fixed in #176; #175 is not a standalone
corrected endpoint. Stack planning never authorizes merge.

`ua-discovery` implements only the agreed two-film research contract:
`discovery.mjs`, `public/discovery-client.mjs`, minimal config/server/Windows
routing changes. Source transports, parser grammars, model/settings and all old
Gemini request bodies unchanged. TMDb Watch Providers error projection adds a
safe ID mismatch/unresolved observation, preserving its old error status and
withholding behavior; composition cannot borrow matched A to conceal a B ID
conflict, and compact stage status shows both A/B errors. No new dependencies, endpoints at providers,
LLM, MEGOGO work, source-card search or production files/schema. Kinobaza on/off
is validated server configuration; default/control session on. One server's film
picker creates a fixed-film token, not arbitrary prompt/URL input. POST content
cannot override it. Used film disables on that page; no automatic retry/batch.

**Approved clarifications supersede earlier serial/gate wording:** TMDb and
MOTN/Kinobaza run as independent bounded tasks; TMDb's two calls remain serial
and gated within that source. TMDb transport/availability failure does not block
fixed-ID MOTN. Each source gates identity. Stable-ID conflict withholds that
source and explicitly prevents a common matched identity, not the remaining
sources' independently valid rows. No cross-source offer merging is performed.
Max4 requests/film (TMDb2/MOTN1/Kinobaza1), total cancellation65s, existing source
size/time limits. Exact observed href stays unchanged; link shape only classifies
exact-card-unverified/tracking/search/relative/watch/unknown/unsafe, never fetches
or resolves. No allowed candidate means blank purchase_url; tracking requires
separate acknowledgement and preserves type/provenance in the research sidecar.
Source/field observations, conflicts/possible conflicts and incomplete language
lists remain literal. Positive listed UA audio/subtitles precede comparable
video; price is informational given unresolved currency anomalies. No best label,
confidence number, negative inference or control-based correction. Kinobaza's
receipt timestamp is the local completed source operation, explicitly not a
provider update/freshness timestamp; no missing upstream time invented.

Review/confirm/edit/cancel is a **page-memory local draft**, not production MW
transfer. Only actual MW field subset is filled; evidence/access stays sidecar.
Wishlist is explicit default, not ownership. No storage/autosave/submit, response
logs/archives, analytics or destinations. Keys use separate hidden helper prompts
and minimal child environment, absent from browser/state/arguments. Auth/Host/
Origin/CSP/no-store/one-shot, native breakaway and safe PID controls retained.

**Public source-use recheck October 18, 2026**, read-only documentation/rules, no
live card/API data calls:

- TMDb [FAQ](https://developer.themoviedb.org/docs/faq) and existing Watch Providers
  attribution contract retained. [Current full terms](https://www.themoviedb.org/api-terms-of-use)
  still robots-denied, no bypass; combined live readiness is **conditional** on
  scoped applicable-account agreement review. Old index/previous probe is neither
  permission nor blanket AI/inference ban. Implementation/synthetic work complete;
  no email requirement solely because text is inaccessible.
- MOTN [current portal Terms](https://developers.movieofthenight.com/terms-and-conditions)
  were read from the JS module linked by the current public page/index,
  [terms module](https://developers.movieofthenight.com/assets/terms-and-conditions-By-pMztN.js),
  **as text, not executed**. §3 permits app/end-user display but prohibits standalone
  availability-data/competing services; this owner-operated private local selection/
  draft is not a public data product/API. §4 visible attribution/link retained;
  §5 third-party rights are not granted (no artwork/full descriptions added),
  §6 functional retention is not used to create a cache. §10 AI training/evaluation/
  improvement prohibition respected: no LLM/data forwarding or AI evaluation.
  No direct conflict with this narrow non-LLM transient projection/draft identified;
  not legal assurance, inference clearance or permission for public integration.
- Kinobaza [Terms](https://kinobaza.com.ua/terms) re-read and
  [robots.txt](https://kinobaza.com.ua/robots.txt) read directly as text (HTTP200):
  generic-group exclusions cover query/search/subpages, not these exact two
  `/titles/...` cards. `meta-externalagent` has a separate deny-all group; existing
  descriptive research client unchanged, no agent disguise. Robots is not a
  licence. No direct scoped conflict identified; proceed only with owner's
  narrow fixed-card approval, not regular/commercial extraction. Broader rights/
  retention/attribution uncertainty and shared JustWatch lineage remain explicit.

No new pricing/cost measurement or paid plan; quota/403/429 stops that source
without retry. Safe completed independent stages remain visible; no destination
check or repeated owner app tour. One short owner session is new-mode utility,
not replay of completed probes or accuracy evaluation. MEGOGO remains unresolved/
frozen. Personal workers/JustWatch Partner access and production RLS/cache/hosting
remain separately deferred. [Actual commands and stop plan](iphone-windows.md#consolidated-discovery-owner-workflow).

Implementation checks: **261 offline/HTTP passed**, including 27 new consolidated
checks and all 22 unchanged Gemini-body goldens. Full sequential installed-Edge
suites **119 passed / 8 skips**, zero failures: seven absent-WebKit checks and
optional same-host browser LAN check not configured. Narrow viewport is not real
iPhone. All **eight Windows modes**
passed temp-copy/free-port parent-exit/scenario/duplicate-start/forged-PID-safe-stop/
restart regressions; new mode includes simultaneous mock keys, both films/max8
calls/replay/no key metadata. Additional new-mode **same-host assigned-LAN** Basic
Auth/multi-key/lifecycle passed separately on a free port; not iPhone reachability.
Native safe-launch diagnostics passed. Owner process
untouched; no live API, real SSH disconnect or system/deployment operation.

#### Owner checkpoint and narrow offline correction

The [owner ledger](digital-ua-owner-validation.md#consolidated-discovery--owner-run-functional-checkpoint)
records the completed session without full output: Coherence TMDb A partial/B ok,
matched, Apple rental/purchase without provider URL; MOTN matched/no-ua-options.
Dune TMDb A/B ok/matched, HBO Max subscription/Rakuten rent+buy; MOTN matched,
Apple/Prime rent+buy/direct URLs, literal quality/currency. Both Kinobaza stages
stopped at redirect-not-followed/identity unresolved. The owner confirmed the
local draft flow; no exact values/exclusions inferred. 490/482ms are two elapsed
observations, not a benchmark; four attempts do not mean four HTTP200 responses.

**Established offline:** fixed Kinobaza URLs match the catalogue; GET/manual
redirect handling stops before parsing, no SSRF/allowlist/budget defect found.
Original status/Location absent: redirect cause/destination unknown, no canonical
URL guessed or general following enabled. TMDb A's partial classification is
independent of stable identity/B: absent/null/invalid resources or invalid projected
metadata can trigger it; missing optional fields alone do not. The live partial's
specific cause is unknown without its unsaved states/issues. No speculative
adapter fix or reconstruction; source requests/validators unchanged.

**Minimal new-mode diagnostics:** call HTTP status and Location-header presence
only (never its value/body), plus TMDb resource states and missing/null/invalid/
empty metadata paths, first32 and omitted count, without content values. Displayed
only in collapsed session-memory details; no logs/storage/destination requests.
These help a future authorized run but do not initiate a diagnostic owner cycle.

**Proven contract correction:** Cancel edits previously reset manual edits to
confirmed values. Remove that destructive reset; Cancel selection only closes
review, preserving the current confirmed/edited form. Explicit confirm/clear or
film change/reload retain their separate semantics. Draft default exclusions and
exact/acknowledged-tracking href handling were already correct, unchanged: no
price/currency/audio/subtitle/video/ownership import or UAH→USD/HD→UHD inference.

Rows now use Rental/Purchase/Subscription display aliases only, retaining raw
access in provenance, never coalescing offers. Known fields and compact unknown/
conflict markers remain visible; missing details/source labels/caveats collapsed.
Shared warning, material errors/tracking notice and source attribution retained.
No “best” badge or unproven tracks. This incremental UI/diagnostic correction is
offline/browser evidence, not new live accuracy or source validation. No lifecycle/
key-routing change, Windows/SSH owner rerun or MEGOGO work needed.

Incremental verification: **264 offline/HTTP passed**, including three new authored
diagnostic/display cases and unchanged source/security/request-body goldens.
Full sequential installed-Edge suites: **120 passed / 8 skips**, no failures
(seven absent-WebKit cases, optional same-host LAN unset). Final targeted suite
after stronger compact-row/all-draft-field cancel assertions: **14 passed / 1
WebKit skip**. Mobile viewport is not real iPhone. Local links/anchors across all
nine Markdown documents and 13 handoff sections checked; scope/whitespace clean.
Windows lifecycle not rerun: helpers/key routing unchanged; prior results above
remain historical evidence only. No owner process, live request, system change,
merge/retarget/tag/release/deployment or production mutation.

### Kinobaza localization enrichment — approved bounded iteration

**October 19, 2026; implementation parent #182 `264ad83206c5304f41cc7abe56235cce4d2fae0c`.**
Separate stacked branch `codex/mw-fut-01-kinobaza-localization`, no parent
modification/merge/retarget. This iteration is active research, not a claim that
the earlier link-only parser was an offer-property extractor. No new source,
LLM, MEGOGO parsing, price objective or production writes.

#### Diagnostic facts and environment limits

Offline materials could not establish the owner redirect target. Initial explicit
approval allowed one manual GET of each old fixed card; both returned **301** with
Location exactly `https://kinobazaua.com/titles/<same-film>`: Coherence and Dune.
No query/fragment/userinfo/port. Responses were not followed or archived.
After separately reporting the exhausted two-GET allowance, the owner explicitly
approved two more GETs, one per canonical card. Both returned **200**, UTF-8 HTML,
no parse5 warnings during structural inspection. **Four film-card diagnostic GETs
total**, not counting separate public-rules/documentation reads. No additional
card, provider/tracking, Gemini, TMDb or MOTN requests. No saved HTML/raw responses.

This was agent Node/Windows unauthenticated fetch, not the owner's historical
Termius/Safari execution. Fetcher geographic/egress context and past response
contents remain unknown. The current old-host→canonical-host transition explains
the current agent no-hop refusal; it **does not prove the historical owner cause**.
The implemented adapter was not live-run against those bodies afterward.

Structural observations, not hardcoded expected answers:

- Both cards had an explicit general film-UA-audio badge, separate from provider
  blocks and the country availability accordion.
- Dune had direct single-provider anchors with their own tables under separate
  `div.d-md-flex` children (iTunes and Rakuten), with labelled Ukrainian audio/
  subtitle rows. Its MEGOGO block was an isolated `p.mt-2` with one provider
  anchor and explicit parenthesized localization tokens, **not that table shape**.
- Coherence separately had a `p.mt-2` Amazon Prime badge with its own audio token.
  This proved why the old `prime video`-only badge regex could miss that observed
  `amazon prime` spelling. Support the explicit alias, not arbitrary Prime matching.
- Country panels remain separate explicit JustWatch signals. Pre-accordion position
  alone does not assign a territory to a localization/provider block.

#### Public rules for this expanded scope

Checked the current canonical host directly (Terms/Privacy/robots each HTTP200),
not only the previous link-only review:

- [Terms](https://kinobazaua.com/terms) §1 applies to public users; §2 site conduct
  restrictions, including language/content conduct, provide neither a documented
  extraction licence nor an identified direct prohibition of this read-only,
  no-post/no-account, two-card transient experiment. §3 puts use/third-party-rights
  responsibility on the user; §4 permits changes. **No direct scoped conflict
  identified**, not a legal guarantee or inferred blanket permission.
- [Privacy](https://kinobazaua.com/privacy) distinguishes external-site responsibility
  and public discussion RSS/API distribution; it is not a catalogue/property reuse
  API contract. Broader automatic access, redistribution, retention and licensing
  remain unestablished. No personal/account data is collected here.
- [robots.txt](https://kinobazaua.com/robots.txt) generic exclusions do not cover
  these exact two title paths; `meta-externalagent` has a separate deny-all group.
  Keep the existing descriptive research UA, no impersonation/bypass. Robots and
  public accessibility are **not licences**. Source attribution and country-panel
  JustWatch lineage retained; their rights are not independently cleared by this.

Proceed only within the owner's expanded bounded approval; no email prerequisite
merely because broader rights are unresolved. Stop on an applicable new restriction,
CAPTCHA/403/429/technical block, not retry/bypass. No regular/commercial integration,
cache, archive, source-data forwarding to LLMs or partner/private endpoints.

#### Implemented field and redirect boundaries

[Extractor](../kinobaza-localization.mjs) reads the already bounded parse5 DOM;
the existing identity gate and conservative parse-error refusal are unchanged.
No scripts/eval/HTML insertion, assets or destination requests. Four layers:

1. `localization.film`: exact general film badge, never provider tracks.
2. `localization.blocks`: only isolated, recognized direct film-content blocks:
   one direct provider anchor plus its own table under `d-md-flex`, or one anchor
   in `p.mt-2` with an otherwise exact parenthesized token list. Generic anchor
   audio/subtitle tooltip, nearby text and original language are not evidence.
   Multiple headers, nested tables/active nodes, conflicting links or unknown
   boundaries leave properties unknown. Input remains 2MiB/bounded DOM; over100
   blocks or over64 property rows per block refuse the respective property set.
   Duplicate provider names remain separate
   block IDs, with qualified possible conflicts rather than a shared offer.
3. `availabilitySignals`: explicit country/provider panel claims, access unknown
   unless actually established. Foreign panels cannot become UA availability.
4. `candidates`: exact observed href/raw spelling and link kind; no resolve/rewrite.

Only exact labelled `Укр. звук` / `Укр. субтитри` rows can interpret literal `+`,
`-` or `−`; missing/unrecognized labels/signs remain unknown. Negative is scoped
to the named block/format/type, never universal absence. List completeness stays
unknown. Conflicting identical labels stay conflicting; stereo/generic Dolby
and subtitle-type literals are not promoted to codecs/channels/Atmos. An absent
Dolby label says nothing about all audio. Each block retains source/href/receipt/
territory basis/upstream and evidence; source audio is not copied from controls.

The composer attaches a block only by parser-issued anchor/block ID + exact href
and provider label, **never by provider-name join into MOTN** or a country panel.
Film claim, country signal and block localization remain distinct in compact UI/
collapsed provenance. Draft excludes tracks/formats/prices as before; localization
stays sidecar only, exact permitted link transfer/cancel rules unchanged.

Only composed discovery opts into **one** permanent canonical hop: exact
`https://kinobaza.com.ua/titles/<fixed-film>` →
`https://kinobazaua.com/titles/<same-fixed-film>`, only301/308, validated again by
transport and composition allowlist before GET. Reject all other hosts/schemes,
userinfo/ports/query/fragments/path encodings/variations, unknown targets, loops
and second hops. Construct clean fixed headers, omit cookies/credentials; never
forward source secrets or auto-follow provider/tracking links. Original and
conditional canonical URL are shown before action. Standalone HTML remains one
GET/no hop; all non-Kinobaza request bodies/model/settings remain unchanged.

Budget: **max4 without redirect; max5 only with canonical hop**, Kinobaza off max3.
Two-film ceiling10 only with both hops. Same source whole-operation15s/2MiB,
overall65s, no retries. Auth/Host/Origin/one-shot/no-store/CSP/transient-only boundary
unchanged; owner demo and unrelated files never touched. No helper/key-routing change.

**Status at implementation:** authored offline/mock/browser checks were
implementation evidence, not live extraction/entitlement/accuracy. The later
[owner localization session is now complete](digital-ua-owner-validation.md#kinobaza-localization--owner-run-checkpoint).
No new owner/live cycle, streaming-app tour, full JSON/HTML/screenshots or
synthetic/SSH-disconnect repeat is requested by the subsequent audit below.
[Existing workflow reference](iphone-windows.md#consolidated-discovery-owner-workflow).

Implementation verification: **276 offline/HTTP passed** (12 new authored cases,
including label/format/boundary/redirect/budget/provenance regressions; 22 unchanged
Gemini-body goldens). Full installed-Edge browser suites: **121 passed /8 skips**;
final frozen-code targeted mobile suite **15 passed /1 WebKit skip**, no failures.
Skipped engines are seven absent WebKit cases and the optional same-host browser
LAN setup; mobile viewport is not real iPhone. The first authored Dune fixture
accidentally invoked Coherence's identity gate and was corrected, not the validator.
The initial browser helper assumed every Kinobaza row was tracking; corrected
the selector to genuine tracking rows, without relaxing runtime URL/draft policy.

Windows Discovery and standalone HTML temp-copy/free-port checks passed:
parent-exit survival, inherited config/module loading, duplicate start, forged PID
refusal/safe stop, restart and mock multi-key/one-shot flow. No owner process or
real SSH connection touched; Windows helper logic/key routing unchanged. Local
links/anchors, 13-section handoff, command syntax, scope and whitespace checked.
No production/schema/MEGOGO changes, extra dependency, response archive or deployment.

### Kinobaza owner checkpoint, link audit and provider grouping

Documentation/audit checkpoint recorded October 20, 2026 against #183
`7997b032abcef7d8af67c97ea8e879e3955e0dd4`; no new source HTTP/API calls.
The [owner ledger](digital-ua-owner-validation.md#kinobaza-localization--owner-run-checkpoint)
records two successful composed Kinobaza identity/localization paths, 5/5 calls
each (Coherence567ms, Dune665ms). These are owner-reported source claims, not
independent provider/account checks, general accuracy or a latency benchmark.
The historical unknown redirect cause and Coherence TMDb A partial remain
unresolved; successful later requests do not reconstruct earlier responses.

| Audited owner row | Established by the report/code | Not established |
| --- | --- | --- |
| Coherence Prime | Mapped provider-block row with UA-audio-positive claim; territory unknown. Anchor recognition/provider mapping/block association succeeded for that row. | Actual href and rejection reason: missing/empty, unsafe/extraction-withheld, unsupported URL shape or transfer gate. |
| Dune Apple/iTunes | Separate mapped block with audio+/subtitles−, territory unknown. Not the same observation as any TMDb/MOTN/country-section row. | Actual source href/kind; do not assume a legacy iTunes URL or substitute the known Apple control card. |
| Dune MEGOGO | Separate mapped block with audio+/subtitles+, territory unknown; property association succeeded. | Actual href/kind; the fixed MEGOGO control URL is not proof of this anchor's URL. |

The old phrase **No permitted provider link** tested only `transferable === false`.
It did not establish absence of an href, legal prohibition or even which URL
policy failed. No unsaved live href/Location/response is reconstructed. No URL
allowlist, parser, redirect target, transport, request body or budget expanded.
Fictional authored Prime/iTunes/MEGOGO fixtures exercise extraction → mapping →
block association → classification → navigation → draft eligibility. Accepted
exact paths and unsupported shapes remain separate, preserving observed href
and raw entity spelling without resolving tracking URLs.

**Proven offline defect:** extraction safely nulls an unsafe href, but composition
previously classified that null as `missing`, losing the known refusal reason.
A regression first failed (`missing` instead of `unsafe`); composition now carries
`unsafe` plus extraction reason. The unsafe URL stays withheld and draft-empty.
This proves a reason-loss defect, **not the cause of any of the three owner rows**.
Safe row-level link audit retains extraction state/issue, provider mapping,
block association and classification; unmatched provider labels retain reasons
in their own section. Unsupported labels cannot silently become platform offers.

**Presentation only:** group by explicit canonical platform mapping. Apple TV Store
is not Apple TV+; unresolved mappings remain separate. A group summarizes source
row counts and field types, never merges values or yields a combined status.
Each original observation keeps its own source/territory and basis/access/
package/cut/link kind/localization/unknowns/conflicts/provenance. A UA country
claim cannot supply territory to a nearby unscoped localization block, nor can
Kinobaza properties enrich a MOTN offer by platform name. Select/review/confirm
targets one row; the draft sidecar records that row ID, not a platform selection.

Link labels distinguish **not reported**, **unsafe — withheld**, **unsupported
kind** and **not eligible for transfer**. Navigation policy and draft eligibility
are explained separately: unsupported/watch/search/relative/unsafe URLs neither
navigate through this demo nor substitute for purchase_url; exact candidates stay
unverified and tracking candidates need acknowledgement. This is demo policy,
not a new legal finding. Exact allowed URL/type/provenance, default exclusions,
memory-only draft and Cancel preserving confirmed/manual edits remain unchanged.

Verification: **282 offline/HTTP passed**; targeted link/grouping/source suite
**48 passed**. Full sequential installed-Edge/browser suites **123 passed /8 skips**
(seven absent-WebKit checks, optional same-host LAN setup); targeted consolidated
mobile suite **17 passed /1 WebKit skip**. Mobile viewport is not a real iPhone.
Tests use authored fixtures/mocks and free-port servers, not live source evidence.
Windows lifecycle/key-routing checks were not rerun because those components
are unchanged; prior results are historical. No owner process or unrelated files
touched. No new owner test is requested; actual live link causes remain unknown.

### Kinobaza provider-link loss — current agent diagnosis and bounded fix

October 20, 2026, reviewed #183 `133a9fe3631362bd967ec57dc8b4e2fa201e8a96`,
base #182 `264ad83206c5304f41cc7abe56235cce4d2fae0c`; tracked tree initially clean,
unrelated untracked research preserved. This is separately approved functional
diagnosis, not git consolidation or a new source. Prior owner reports above
remain unchanged. No historical unsaved owner response is reconstructed.

**Current agent evidence:** one direct GET per fixed canonical card, then one
further GET per card to check the fix: **four source GETs total**, all HTTP200,
no redirects followed. Both extractions `ok`, identity `matched`, no issues.
Only in-memory initial HTML; no scripts/assets/accounts/cookies, provider/tracking
requests, browser automation, LLM transport or saved bodies/HAR/fixtures.
Environment: agent Node/Windows, unauthenticated; egress geography unknown, not
the owner's Windows/Safari response or an account-specific offer. Three separate
public-rules GETs described below are not film-card extraction validations.

| Current source block | Anchor → extraction → mapping/block → projection before fix | Exact refusal rule / root cause | After fix: navigation / draft |
| --- | --- | --- | --- |
| Coherence Prime | href present, absolute candidate, provider Prime mapped, own paragraph block associated, href preserved, territory unknown | Classifier accepted detail ID with no trailing referral segment; native `/detail/<alphanumeric-id>/ref=atv_<alphanumeric-or-underscore-token>` became `unknown`. | `exact-card-unverified`, explicit-open only. Native referral preserved; draft URL blank until acknowledgement, then exact original URL. |
| Dune Apple/iTunes | href present, absolute candidate, Apple Store mapped, own table block associated, href preserved, territory unknown | Classifier accepted `tv.apple.com` card shape only, not the observed `itunes.apple.com/ua/movie/id<digits>` with affiliate `at` / language `l` query. | `exact-card-unverified`, explicit-open only. Observed `at` referral requires acknowledgement before exact unchanged draft URL. |
| Dune MEGOGO | href present, absolute candidate, MEGOGO mapped, own paragraph block associated, href preserved, territory unknown | Classifier required `/ua/view/<digits>-<slug>.html`, excluding native short `/ua/view/<digits>`. | `exact-card-unverified`, explicit-open only; exact short URL eligible for selected-row draft confirmation. |

All three current failures were **unsupported classification**, not missing href,
unsafe extraction, unmapped provider or absent block association. No extraction/
localization/provider-mapping defect was established, so those modules are unchanged.
All three matched rows now reach the UI policy; a mock browser test separately
checks the actual rendered anchors/review/confirm/cancel, not a live provider visit.
Destination identity/redirects/availability remain unverified even for a card-shaped
URL. No known control URL or current source ID was hardcoded into fixtures/runtime.

**Narrow URL policy:** existing HTTPS/userinfo/port/unsafe-character checks precede
classification; search/relative/watch-page URLs remain ineligible. The additions
require an already mapped matching provider, exact native host and bounded path:
`primevideo.com`/`www.primevideo.com` with the specific detail-ID/`ref=atv_...`
suffix, `itunes.apple.com` with **UA movie numeric-ID route only** (not album,
search, other country, arbitrary legacy slug route), and `megogo.net`/`www.megogo.net`
with **UA numeric view route only**. Existing supported paths remain intact. Other
hosts, extra path suffixes, malformed IDs/referral path, credentials, non-default
ports, unsafe protocols and search/relative forms are refused. Query/encoding/
referral components stay exactly as extracted, never reconstructed or resolved.

Native provider referral is not asserted to be an opaque redirect. It retains
`exact-card-unverified` plus `referral: provider-native` and an acknowledgement
gate. Prime's observed `ref=atv_...` path and iTunes `at` query require the same
explicit draft acknowledgement as opaque tracking, without falsely labelling
their destination as fetched/verified. Navigation is a separate explicit user
action; it makes no network request during discovery. The sidecar retains original
URL/kind/referral/gate/ack state and the selected row's provenance. Acknowledgement
does not verify entitlement or import localization into another source offer.
Without it the URL stays blank; Cancel still preserves the existing manual draft.

**Rules review, October20:** direct HTTP200 reads of current canonical
[Terms](https://kinobazaua.com/terms), [Privacy](https://kinobazaua.com/privacy) and
[robots.txt](https://kinobazaua.com/robots.txt), after web-reader cache failures.
Terms §1 covers public users; §2 conduct restrictions disclose no identified
direct prohibition applicable to this no-account/no-post bounded read; §3 leaves
information-use/third-party responsibility with the user; §4 allows changes.
Privacy's public-discussion RSS/API wording is not catalogue extraction permission.
Generic robots exclusions do not match either exact title card; separate
meta-externalagent deny-all is not bypassed/impersonated. No scoped direct conflict
or technical blocking observed, **not an established licence or legal guarantee**.
Robots/public access is not permission; regular/commercial reuse, redistribution
and broader retention rights remain unresolved. No email prerequisite inferred.
Existing attribution/transient-only/source-use boundaries stay in force.

Source fetch/config/redirect/parser/request bodies/budgets are unchanged: max4
composed calls without canonical hop, max5 only with it, no retries/destinations.
Search/Apple/Gemini/TMDb/MOTN modes, MEGOGO adapter and Windows helpers unchanged.
Current agent extraction/projection checks are not a new owner run, provider
verification, general accuracy result or full live multi-source UI run. No further
owner/source test cycle requested; historical owner response causes remain unknown.

Verification: two new authored regressions failed before the classifier fix
(`unknown` instead of `exact-card-unverified`), then passed. **284 offline/HTTP
passed**, including **50 targeted** link/grouping/localization/discovery cases;
full installed-Edge mock browser suites **124 passed /8 skips**. Targeted
consolidated mobile suite **18 passed /1 WebKit skip**. Full skips: seven absent
WebKit binaries, optional same-host LAN setup; no downloads, not real iPhone.
Browser checks cover all three rendered links, explicit click (destination
navigation intercepted before request), acknowledgement check/uncheck, exact URL
confirmation and cancel preserving manual edits, plus unchanged source-call
counts/auth/one-shot/no persistence. Source-card extraction/projection above is
separate current live evidence, not a mock claim or provider navigation test.
Windows lifecycle/key routing not rerun because unchanged; owner demo untouched.
All nine Markdown documents checked:231 local links/166 anchors,13 handoff
sections. Owner restart-command syntax parsed only, not executed; scope/whitespace
clean. No production/other adapter/request changes or full-response archive.

## Historical experiments and feasibility records

Architecture/feasibility record, updated October 18, 2026 after manual candidate
experiment A and the owner's choice of a narrow Kinobaza URL Context experiment.
MW-FUT-01 remains **Discovery**. The conceptual pipeline is not implemented;
the isolated fixed-source demo extensions below are implemented/offline-tested,
with subsequent owner-run results recorded separately. The HTML pilot is now
complete for two films; its limits and Movie of the Night feasibility are below.
Existing Search/Apple prompts and all model/generation settings stay unchanged.
The [owner observations](digital-ua-owner-validation.md) motivate narrower
questions, not an accuracy claim or a production recommendation. The current
record distinguishes completed manual research, public-document feasibility and
the newly selected URL-only hypothesis. The existing PoC guide contains runtime
scope and owner tests; no general discovery pipeline or product handoff.

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
its fixed server-side catalogue. The opt-in Kinobaza extension reads only two
explicitly configured source cards; no discovered destination populates the
catalogue or triggers a follow-up request.

## Next experiment: current Ukrainian availability

The [two reported URL-only tests](digital-ua-owner-validation.md#url-context-evaluation-checkpoint--two-owner-run-live-tests)
provided identity/audio metadata but left availability and transaction fields
unknown. The provider's full retrieved content is unavailable; the cause of
omissions remains unresolved. Retrieval SUCCESS is not truth or entitlement.

The previous **manual experiment A is now completed for Coherence and Dune**:
see the [owner candidate-discovery record](digital-ua-owner-validation.md#kinobaza-candidate-discovery--manual-experiment-a-completed).
Kinobaza led to useful cards, including owner-confirmed Coherence availability
and Ukrainian audio on Prime Video. Dune audio observations remain tied to
HBO Max, Rakuten TV and separately checked Prime Video; no missing URL/provenance
or access type is invented. Earlier Apple/MEGOGO checks remain historical.

This is evidence for candidate-source utility in two cases, not completeness,
general accuracy or automatic-integration feasibility. The next question is
how to obtain candidate links responsibly without confusing an aggregator
signal with a current Ukrainian offer. The comparison below replaces the old
A-first recommendation. The later owner-selected URL-only scope is recorded
below; it does not authorize an automatic end-to-end pipeline.

## Candidate integration feasibility

Public documentation checked **October 18, 2026**. This review used read-only
public pages and official documentation, including the downloadable OpenAPI
document, **not Gemini/TMDb API calls**. No private endpoints, account automation,
cookies, scraping or bypass. Public access and robots.txt are not permission.

### TMDb: documented capability versus Ukraine coverage

- [Movie Watch Providers](https://developer.themoviedb.org/reference/movie-watch-providers)
  documents country-keyed, per-film provider availability supplied through
  JustWatch. It explicitly does **not** return full provider deep links: the
  country `link` is a **TMDb watch-page link**, not the exact provider offer.
  JustWatch attribution is explicitly required.
- The [official OpenAPI document](https://developer.themoviedb.org/openapi/tmdb-api.json)
  shows country examples with access buckets `flatrate`, `rent`, `buy` and
  `ads` when present. Provider entries describe
  `provider_id`, `provider_name`, `logo_path` and `display_priority`.
  These are aggregator/provider signals, not account entitlement. This response
  does not document offer prices, offered audio/subtitles or video formats.
- [Movie Providers](https://developer.themoviedb.org/reference/watch-providers-movie-list)
  allows country filtering with `watch_region`;
  [Available Regions](https://developer.themoviedb.org/reference/watch-providers-available-regions)
  documents the method for discovering countries with provider data. The
  [Discover Movie reference](https://developer.themoviedb.org/reference/discover-movie)
  and its OpenAPI parameters separate territory from monetization filters
  (`flatrate/free/ads/rent/buy`); language is not an offered-audio filter.
- **Ukraine is not verified by this review.** The inspected static OpenAPI
  movie example, its country-specific example schema and available-regions
  example do not contain `UA`. Examples are not a current exhaustive coverage
  guarantee or proof of non-support. Do not promise Ukrainian provider results
  for either film, invent a provider list or translate absent data into
  unavailable. A future separately approved API probe would first establish
  current region support and then inspect each film's `results.UA`, if present.
  No such probe was run here.

### TMDb: permission, attribution, retention and cost

- **Documented general terms, not AI clearance:** the
  [developer FAQ](https://developer.themoviedb.org/docs/faq) describes
  non-commercial API use as free with attribution, commercial licensing through
  sales (no price established here), and no SLA. It requires an approved TMDb
  logo and prominent non-endorsement notice in About/Credits. Watch-provider
  data additionally requires the JustWatch attribution above. Neither billing
  category nor the applicable agreement for this project is settled here.
- **Explicit restriction signal; current legal text needs verification:** an
  indexed first-party version of the
  [API Terms of Use](https://www.themoviedb.org/api-terms-of-use?language=en-CA)
  (labelled October 20, 2023; search index crawled over a year before this review)
  prohibits API/content use in connection with AI/ML applications, not only
  training. It also restricts derivatives, caching beyond six months and
  requires purging content on termination. Direct reading of the current legal
  page was blocked by robots; these are **indexed terms, not a fresh verification
  of the effective agreement**. They are a reason to hold, not a license for
  six-month storage or an assertion about a newly checked contract.
- **Unresolved:** applicable current agreement and any exception for candidate
  discovery in an AI-connected product, downstream transfer to another model,
  normalization/derived fields and retention. Do not pass TMDb data/links to
  Mykola or another LLM based on the FAQ's general free-use statement. Resolve
  this scope before an automatic experiment; this review neither contacts the
  provider nor changes existing production TMDb use.
- Provider API rights would not automatically grant rights to the destination
  sites' content. The existing [tool/source-rights review](url-context-poc.md#official-capabilities-display-and-terms-review)
  remains separate; Google Search reuse rules are not automatically applied to
  every URL-only route, nor treated as permission to harvest grounded links.

The later **bounded non-LLM** implementation proposal, current documentation
recheck and precise remaining agreement gate are in the
[TMDb data-probe handoff](tmdb-probe-handoff.md#technical-constraints-and-current-terms).
The older indexed AI wording is not a blanket decision on that new scope or
inference, nor a freshly verified current agreement.

### Kinobaza: what was and was not found

- [About](https://kinobaza.com.ua/about) describes a Ukrainian film catalogue
  with ordinary title search. The
  [Dune: Part Two public title page](https://kinobaza.com.ua/titles/dune-part-two)
  visibly contains Ukrainian title/provider links and country sections.
  Its watch section credits JustWatch; some links target
  `click.justwatch.com`. This checks public source/provenance presentation,
  **not** the owner's provider availability/audio observations.
- TMDb explicitly credits JustWatch and Kinobaza visibly uses it in this block.
  Thus overlapping provider signals may share upstream data and are not
  independent corroboration. This does not establish that every Kinobaza
  title/localization field comes from JustWatch or is copied from TMDb.
- **Not found:** a public documented movie/provider-link API or another
  explicitly supported automated export/interface, with authentication,
  fields, coverage and usage contract. Review scope: public About, Terms,
  Privacy, the title page and site-scoped searches for API/developer
  documentation. This is **not a finding that no API exists**; no undocumented
  endpoints were tested.
- [Privacy](https://kinobaza.com.ua/privacy) mentions RSS/API distribution of
  public discussion/user contributions. That is not a documented catalogue/
  provider-link interface or permission for our automated access.
- [Terms](https://kinobaza.com.ua/terms) apply to registered and unregistered
  users and place responsibility for use/third-party rights on the user.
  The reviewed pages do **not establish** automated access, redistribution to
  another model, extraction/normalization, attribution rules for an integration
  or retention/cache rights for movie/provider data. These remain unresolved;
  silence and public accessibility are not grants. No supported plan, API
  tariff, limits or SLA were found; costs are **unknown**, not zero.
- Manual discovery is owner-agreed research, not authorization for scraping or
  future public redistribution. Provider-specific prices, localization and
  entitlement still require their own offer/context checks.

## Options for the next technical step (design only)

| Option | Value and coverage limits | Complexity and dependencies | Known costs and unresolved questions |
| --- | --- | --- | --- |
| **A. TMDb provider discovery + manual exact URLs** | Structured country/provider/access-type leads; exact destinations still manual. Current UA/two-film coverage unverified; no offer audio/video/price or entitlement guarantee. | Small isolated server-side API step plus manual link entry, only after permission and UA capability checks. Needs owner credential, attribution and error/unknown handling; no direct-URL resolver inferred. | FAQ's free non-commercial category is conditional, commercial quote unknown; not a zero-cost project estimate. Current AI-use/transfer/cache agreement unresolved. No API call approved here. |
| **B. TMDb + documented supported Kinobaza interface** | Could add Ukrainian titles/exact-link candidates if the interface actually exposes them; shared JustWatch signals are not independent. Coverage/fields unknown. | Cannot size or select transport: supported public interface was **not found**. Depends on authoritative documentation/permission, fields, access limits, attribution and retention, plus A's gates. | No established plan/tariff; cost and maintenance unknown. Not feasible to implement on current evidence; do not substitute internal endpoints or scraping. |
| **C. Kinobaza as a manual auxiliary source** | Already useful for these two films; owner chooses exact regional cards and checks offers. Human coverage is bounded, not complete or automatically current. | Lowest complexity: no provider adapter. A proposed owner-curated link-only preview could exercise navigation/provenance separation without source-site fetching or model calls. Depends on ordinary owner access and manual identity checks. | Owner time/device/network and any provider/account charges are not measured; no automatic-integration tariff established. Redistribution/retention/AI forwarding of source data remains unapproved. |

Unknown usage/cost is not a blocker and is not zero. No integration is chosen
from the absence of documentation. The conceptual multi-source architecture
above is retained, not implemented or expanded on assumptions.

## Kinobaza URL Context decision

### Selected scope versus the previous recommendation

At checkpoint `714a176`, C (manual auxiliary discovery) was recommended, with a
possible owner-curated candidate preview. **That preview is not being built.**
The owner instead selected a smaller, different hypothesis: can the existing
Gemini URL Context tool expose provider hrefs from one exact Kinobaza card,
without reading destinations? The A/B/C review above remains about future
integration and its unresolved gates, not proof that this PoC is impossible
without a Kinobaza API.

The [implemented opt-in mode](url-context-poc.md#kinobaza-candidate-link-experiment)
uses fixed Coherence/Dune source URLs, original natural-language display and
separate retrieval metadata. It is offline-tested; two later
[owner-run tests](digital-ua-owner-validation.md#kinobaza-url-context--two-completed-owner-run-tests)
returned no provider URLs. The current scenario is not a suitable automatic
link generator on this evidence; the omission cause remains unresolved.
No TMDb data/API, new provider, Search, scraper, destination follow-up,
normalization, response archive or Mykola integration. No model/settings change.
Existing Search and Apple request bodies stay unchanged. This does not
retroactively validate the completed manual experiment as automated retrieval.

### Current first-party review: October 18, 2026

- **Technical capability:** [URL Context documentation](https://ai.google.dev/gemini-api/docs/generate-content/url-context)
  explicitly supports `gemini-3.8-flash`, public HTML and URL-only requests. It
  says only supplied URLs are retrieved, not nested links; retrieval can use
  an index cache before live fetching. This supports the one-source experiment,
  not freshness or an exact HTML/href-access guarantee.
- **Href visibility is a separate unknown:** the guide describes content
  extraction, not preservation of every anchor, tracking href, country heading
  or dynamic section. The provider's full retrieved content is unavailable.
  SUCCESS can coexist with missing URLs/territory. We cannot distinguish source
  omission, provider transformation and model omission from that status alone.
- **Google applicability:** [Gemini Additional Terms](https://ai.google.dev/gemini-api/terms)
  (effective March 23, 2026) cover developer use, generated content and paid/
  unpaid processing; Google retention differs from this app's no-storage.
  Its Search-specific subsection governs Google Search results, not
  automatically this URL-only mode. The URL guide prescribes no Search
  Suggestions for URL-only; keep returned attribution/text/metadata unchanged.
- **Concrete content restrictions, not a blanket grant:**
  [Google APIs Terms §5(a), §5(e), §6(b)](https://developers.google.com/terms#section_5_content)
  reserve third-party rights, restrict scraping/permanent copies, content
  redistribution/modification absent permission/law, and require applicable
  attribution. This PoC adds none of those archives/public redistribution/
  scraping mechanisms; whether the particular link-reading use has the
  necessary source rights is not settled by tool support. Do not strip source
  notices, normalize/reuse results in a dataset or forward them to another LLM.
- **Source terms:** [Kinobaza Terms](https://kinobaza.com.ua/terms) §1 applies
  to all users; §3 places responsibility for information use and third-party
  claims on the user. [Privacy](https://kinobaza.com.ua/privacy) does not license
  catalogue extraction via its public-discussion API mention. No express rule
  specifically approving or forbidding this exact third-party URL-only,
  transient owner display was identified in the reviewed pages. **Unresolved
  interpretation, not permission or a legal guarantee:** automated page access
  by the provider, source-content use, attribution and any future retention.
  Owner must resolve applicable rights before live use; stop if a restriction
  applies. No CAPTCHA/login/technical restriction bypass.
- **Public source identity only:** [Coherence](https://kinobaza.com.ua/titles/coherence)
  and [Dune: Part Two](https://kinobaza.com.ua/titles/dune-part-two) were opened
  read-only to check titles/directors and normal public card accessibility.
  This is not a Gemini retrieval probe, destination check, new owner-offer
  validation or proof of stable link coverage. No page contents archived.
- **TMDb stays separate:** no TMDb calls or data are needed. The older indexed
  TMDb legal text above is not a freshly verified effective agreement and
  neither authorizes nor blocks this independent source experiment.

### Acceptance and stop boundary

Success for the narrow hypothesis means the owner can reconcile returned
provider/link/territory with the exact source card, preserving redirect hrefs
without model-reconstructed destinations. Missing href/territory stays unknown;
a general Ukrainian film-localization badge is not provider localization.
A candidate link is not availability, access type, price or entitlement.
Incorrect identity, invented hrefs, foreign-section leakage, retrieval failure
or inaccessible source are recorded as failures/unresolved, not silently fixed.

The [owner comparison plan](url-context-poc.md#owner-comparison-not-run-by-the-implementation-agent)
and [standalone Termius commands](iphone-windows.md#kinobaza-url-context-one-line-owner-commands)
cover synthetic first and then one manual live request per film, without
automatically visiting returned links. Stop after two cases, an applicable
restriction, blocked source or identity ambiguity. No output archive, raw
metadata/screenshots or accuracy score. Usage/cost is unknown rather than zero
and is not a blocker. No integration is selected from this experiment alone.

## Initial HTML inspection after the owner tests

### Method and independently observed source facts

Checked **October 18, 2026**, after the owner's report. This was a bounded manual
inspection of ordinary public HTML, **not another Gemini test or an implemented
scraper**. Two direct GETs per fixed source card used PowerShell
`Invoke-WebRequest -UseBasicParsing`, no login/account cookies or browser session,
no JavaScript/asset execution, no automatic redirects and no destination URLs
opened/resolved. Both passes returned HTTP 200 and `text/html; charset=UTF-8`.
Only in-memory source inspection was used; no HTML, extraction script, candidate
dataset or response archive was added to the repository.

| Source card | Observed in the initial HTTP response, before JavaScript |
| --- | --- |
| [Coherence](https://kinobaza.com.ua/titles/coherence) | The `availabilityAccordion` / `collapseUA` markup under the explicit Ukraine heading contained one ordinary anchor labelled Apple TV Store, with an actual `href` to `click.justwatch.com`. |
| [Dune: Part Two](https://kinobaza.com.ua/titles/dune-part-two) | The explicit `collapseUA` block contained two ordinary anchors, Rakuten TV and HBO Max, with actual `click.justwatch.com` hrefs. Additional iTunes/Apple and MEGOGO hrefs were present before that accordion; their position alone is not an explicit UA territory label. |

These were actual `<a href="…">` attributes, not merely provider names,
JavaScript-only URL placeholders or strings awaiting a destination lookup.
The JustWatch hrefs contain long encoded tracking/redirect query parameters;
they were neither decoded into guessed final URLs nor followed. Bootstrap
collapse markup can control visibility, but does not need to create these
already-present anchors. Dune also has later foreign-country blocks: a
page-wide provider match would conflate territories.

This establishes **at least these links in the inspected initial responses**,
not a complete permanent inventory. The inspected Coherence UA block did not
establish the owner's earlier Prime Video candidate. A generic Prime navigation
link elsewhere on a page is not a title-specific offer. Do not erase the earlier
owner observation, infer unavailability, or claim that all users/times receive
the same card content. No current entitlement, audio, prices or final provider
destinations were checked by this inspection.

### What this resolves, and what it does not

For the observed anchors, **JavaScript is not a prerequisite for href presence**.
The broad explanation "the source HTML contains no provider hrefs" is not
supported by these responses. A technical read of initial HTML could encounter
candidate hrefs; that is a capability observation, not approval to build it.
No post-JavaScript browser comparison was necessary for this positive finding
or performed; additional/different dynamic links remain unassessed.

These are later unauthenticated responses, not the provider's hidden payload
or its response at the owner's execution time. Source variants/cache age,
provider content processing/href omission and model selection/response behavior
remain possible but **unestablished** explanations. The
[URL Context guide](https://ai.google.dev/gemini-api/docs/generate-content/url-context)
documents cached/live retrieval and metadata, not preservation of every href.
The current failure therefore does not isolate a specific Gemini defect or
prove that another integration is impossible. No repeated model request was
made to choose a cause.

### External citation anomaly: keep attribution distinct from retrieval

The Dune `m.vkino.com.ua` entry is an **owner-reported anomaly**, documented in
the owner record, not an independently examined response. Google's
[Candidate / CitationMetadata reference](https://ai.google.dev/api/generate-content#CitationMetadata)
describes source attribution; the Candidate field can include recitation
information. It is distinct from
[`UrlContextMetadata`](https://ai.google.dev/api/generate-content#UrlContextMetadata),
which describes tool retrieval. This distinction explains why a citation entry
is not a network trace; it does **not** establish recitation as this anomaly's
cause. No attributed passage/offsets or exact external URI were supplied.

The literal `m.vkino.com.ua` string was not present in either sampled initial
HTML response. That narrow negative finding neither proves an external fetch
nor proves the answer was derived only from Kinobaza, and does not audit all
scripts, nested resources, earlier page versions or Google's index. The
external host was not contacted. One configured source URL/tool is not proof
of exclusive provenance for all generated text. Do not treat this as evidence
of an actual Search fallback or make an unsupported security diagnosis.

### Access terms: separate from HTML feasibility

Rechecked public first-party pages October 18, 2026:

- [Kinobaza Terms](https://kinobaza.com.ua/terms), §1/§3, apply to public users
  and place responsibility for information use/third-party rights on the user.
  No clause expressly granting or expressly prohibiting this exact bounded
  initial-HTML inspection was identified. This is an **unresolved permission
  question**, not a legal conclusion or a general automated-access license.
- [Kinobaza Privacy](https://kinobaza.com.ua/privacy) mentions public discussion
  RSS/API distribution, not a catalogue/provider-link extraction contract.
  No documented permission for repeated harvesting, transfer to an LLM,
  redistribution, source-data retention or an attribution scheme for a future
  HTML integration was established. Public accessibility, HTTP 200 and
  robots.txt are not grants. Existing JustWatch labels/sponsored redirect
  links do not license us to reuse the partner's feed or private interfaces.
- [Google APIs Terms §5(a/e), §6(b)](https://developers.google.com/terms#section_5_content)
  constrain content copying/scraping/attribution; the earlier Google review
  remains applicable to Google-delivered content, not a source-site license.
  Search-specific restrictions are not automatically applied to this URL-only
  path or to ordinary HTML inspection. No source/Google rights guarantee is
  inferred, and no TMDb data/API is needed for this feasibility finding.

### Feasibility conclusion / next decision

**Do not promote the current URL Context scenario into an automatic URL
generator or repeat the two live requests now.** Relevant hrefs exist without
client JavaScript in these source responses, so an eventual permission-reviewed
initial-HTML approach is technically plausible for these anchors. Reliability,
stable coverage, supported access, source/JustWatch rights, attribution and
retention are not established. No scraper, parser module, new endpoint,
integration, model/prompt change or implementation handoff is produced here.

At that checkpoint, supported access and permissible candidate-link use needed
clarification before a prototype. The subsequent owner request approves only
the bounded experiment below after a fresh public-rules check, **without an
email prerequisite**. It does not approve regular/commercial integration or
silently replace URL Context. Preserve no archive, no availability-from-link
inference and no general accuracy/cost claim.

## Owner-approved HTML extraction PoC

### Public rules checked before implementation — October 18, 2026

- [Terms](https://kinobaza.com.ua/terms) §1 applies to public/registered users;
  §2 lists prohibited site-user conduct, not an automated-access authorization;
  §3 leaves information-use and third-party-rights responsibility with the user;
  §4 allows the terms to change. No direct provision prohibiting this specific
  two-card, manually initiated, transient link-reading experiment was found.
  **Absence of a found ban is not an established license** for regular fetching,
  commercial reuse, redistribution, attribution practice or retention.
- [robots.txt](https://kinobaza.com.ua/robots.txt), read directly as text (HTTP
  200), has generic-group exclusions for movie/series query pages, comments,
  search and certain person subpages; none matches the two exact `/titles/...`
  source paths. Commented-out title rules are not active. The separate
  `meta-externalagent` group denies all paths; our descriptively identified
  `MovieWishlistResearchPoC/0.1` client is not that agent. **Robots is not a
  license**, and no user-agent disguise or technical bypass is approved.
- [About](https://kinobaza.com.ua/about) says this is film information, not
  hosting online films. [Privacy](https://kinobaza.com.ua/privacy) distinguishes
  external sites and public-discussion RSS/API, not a catalogue-reuse agreement.
  The earlier public HTML inspection found JustWatch attribution/sponsored
  redirect notices: keep source/label provenance; no partner feed/private API
  access or claim of independently confirmed offers follows from those links.

**Decision:** no direct applicable conflict or technical block was identified
in this public-rule review. Proceed within the owner's narrow approval; email
is not a precondition merely because broader rights remain unestablished.
Redirect/403/429/CAPTCHA or changed rules are stop conditions, not retry/bypass
instructions. No current live card extraction was performed by the agent for
this iteration. The rules read is not live validation. TMDb/Google content terms
do not govern this non-LLM transport by automatic inheritance.

### Implemented experiment and parser choice

`DEMO_RETRIEVAL=kinobaza-html` reuses validated fixed sources, LAN auth,
Host/Origin and one-shot `/answer` gating. No arbitrary URL or crawler. One
manual click → one GET; no cookies, redirects, retries, scripts/assets, model
or destination/tracking requests. A 15-second whole-read deadline and 2 MiB
body limit bound input. Error bodies, HTML and credentials are never logged,
stored or sent to the browser. The result is session-page memory only.

[parse5](https://parse5.js.org/) **8.0.1** is pinned in the demo's private
`package.json`/lockfile, with locked `entities` transitive dependency; root
production manifests are untouched. It provides HTML tree parsing and source
attribute locations without a browser/script engine. This avoids a home-grown
whole-page-regex parser or resource-loading browser DOM. It is lazy-loaded, so
existing Gemini modes need no parser installation. Missing parser is reported
before a live source GET. Use `npm ci --prefix research/grounded-answer-demo
--ignore-scripts --no-audit --no-fund`; no install scripts or new service.

The source-specific adapter requires unambiguous observed heading/original
title/year/director, then explicit country heading → target → matching panel
relationships. It currently recognizes UA, PL, CZ and DE labels from the
inspected layout; unsupported/duplicate/mismatched markup yields a visible
unsupported result, not a different territory guess. Only recognized provider
markers count; navigation/trailers/ads and JustWatch attribution are excluded.
Recognized pre-accordion film badges are shown separately with territory null.
No global localization transfer or availability/price/audio inference.

`href` retains the parsed attribute value; `rawHref` retains source spelling,
so entity decoding is visible while percent/query/tracking encoding is never
reconstructed or resolved. Relative hrefs stay relative. Unsafe schemes,
credentialled absolute URLs and invalid values are withheld/unresolved. Missing
hrefs retain an unresolved provider entry. Ambiguous film identity stops the
candidate list. This intentionally fails closed and is not a complete generic
provider discovery API. Partial results are not absence evidence.

### Evidence and boundaries for the new mode

At implementation checkpoint `8e36937`, the mode was synthetic/mock-tested and
live-unvalidated. The subsequent [two-film owner-run HTML checkpoint](digital-ua-owner-validation.md#kinobaza-html--completed-owner-run-checkpoint)
completes manual testing of this stage, not independent agent validation or
proof of complete coverage. Existing Gemini results and earlier initial-HTML
checks remain historical, separate evidence. Neither author-written fixtures
nor rules retrieval establish card compatibility, link validity or entitlement.
No new candidate-preview product, production/Mykola integration, cache, database,
response archive or regular/commercial extraction is approved.

The [HTML owner workflow](iphone-windows.md#kinobaza-html-owner-workflow) specifies
synthetic first, then one owner-run live GET per film, without API key. Those
manual source tests are now complete; the commands are reproduction instructions,
**not a request to rerun** them for this documentation checkpoint.
Verify identity, explicit UA/foreign/unknown groups and exact/raw href spelling
against the source card, without resolving destinations. Record unresolved and
blocked results as such; no raw HTML/screenshots/output archive in Git. Recheck
rules before a later run if they change. Real iPhone/SSH-disconnect survival for
this new mode remains owner-validation pending. No merge/deployment or system
changes accompany this experiment.

### Independent checks for this iteration (not live validation)

- Node 24.22.0 offline/HTTP suites: **107 passed, no failures/skips**. Authored
  synthetic HTML covers UA/foreign/unscoped links, attribute/entity/percent
  encoding and relative URLs, exclusions, missing/unsafe hrefs, identity and
  markup ambiguity, status errors, timeout/body limits and one-shot/auth gates.
- All **22 Gemini request bodies** were independently compared with Git
  checkpoint `a4dbbab` and pinned in a golden-hash regression: unchanged Search,
  Apple and Kinobaza URL Context prompts/tools/generation settings.
- Final bounded sequential installed-Edge/browser suites: **60 passed,
  4 skipped, no failures**. Skips: three missing WebKit checks and optional
  same-host LAN without a supplied test IP. Narrow Edge is not real Safari.
  Synthetic/mock display verifies no raw-HTML insertion, destination requests,
  browser storage, response logs or automatic second click/request.
- The initial parallel browser run stalled in a test worker; terminating only
  its verified headless test browser produced closed-browser failures. That run
  is **not counted as passed**; its stall cause is unresolved. Standalone HTML
  and two bounded sequential full reruns passed without relaxing assertions or
  application security. Prefer the documented sequential/time-limited command.
- Windows PowerShell 7: separate temporary copies/free ports passed HTML,
  Search, Apple and Kinobaza Gemini helper start/status/duplicate/safe-stop/
  restart tests. HTML also parsed synthetic markup in the detached child, then
  restarted in live **readiness only** without a key prompt or source GET.
  No `/answer` call in live Windows mode; owner process untouched. Actual
  Termius disconnect and PowerShell 5.1 remain unverified for this new mode.

No agent live extraction, model API or production call at that implementation
checkpoint. Dependency installation and public-rules retrieval are setup/research,
not evidence of live extraction. The checks above remain historical results,
not rerun test claims for the Markdown-only checkpoint below.

## HTML checkpoint diagnosis: no parser expansion

Checked October 18, 2026 against `8e36937`, using [html-source.mjs](../html-source.mjs),
[the authored fixture](../synthetic.mjs), existing tests and the retained
[initial-HTML inspection](#initial-html-inspection-after-the-owner-tests).
**No new Kinobaza/provider request, owner test or destination resolution.**

**Coherence → Prime:** the earlier independent inspection established an Apple
anchor in `collapseUA`, not a title-specific Prime anchor. It did not establish
whether such an anchor existed elsewhere/dynamically or in the owner's response.
The live HTML was deliberately not archived, and this owner report has no DOM
location/attributes for the omitted link. Thus a specific source-vs-parser root
cause **cannot be established** from the available evidence.

The adapter has no Prime-specific denylist: `providerName()` accepts any exact
`Дивитись / Купити на …` title (with matching image alt), including Prime Video.
It additionally recognizes a short explicit badge vocabulary, including
`prime video`, **not** `prime`. Only supported country panels and pre-accordion
film badges are searched; bare provider text, differently labelled anchors and
anchors outside these ranges may be omitted without an issue. These are concrete
coverage limits, not proof that one caused the observed omission. Generic Prime
navigation must not be promoted to an offer to fill the gap.

Four in-memory, no-network authored-fixture probes confirmed: a properly labelled
Prime UA anchor is accepted; a bare Prime link and unsupported short `prime`
badge are not; a labelled YouTube `/results?search_query=…` URL is accepted as
an absolute candidate. The fixture's separate relative-link issue remains
unrelated to those UA checks. These are code-behavior probes, not live evidence.

**Search URLs:** `candidate()` checks HTTP(S), syntax, unsafe values and JustWatch
attribution, but `hrefKind` distinguishes only absolute/relative/missing. Neither
it nor the display establishes a destination type or film identity at that URL.
This explains why a provider-labelled YouTube search transition can survive
without an issue. It is not an exact regional-card/offer result. A tracking URL
may conceal the destination type; without resolving it the type stays unknown,
not guessed from a provider logo. No search URL is followed or reconstructed.

**Decision:** freeze the completed narrow PoC; no parser broadening or new owner
tests in this checkpoint. A later separately reviewed change could distinguish
observed search-transition / exact-card-unverified / redirect-unknown types,
with small authored fixtures and preserved exact hrefs. It must justify each
source marker, retain unknowns and avoid destination GETs. It would not by itself
recover Prime or validate offers. No automatic discovery pipeline is approved.

## Movie of the Night: bounded feasibility only

Official public materials checked **October 18, 2026**; no account creation,
subscription, credential use, API call or adapter. This is separate from Kinobaza
owner results and Google tool terms. Sources describe a capability, not measured
coverage or accuracy for our two films.

### Ukraine coverage and fields

The [Countries & Services guide, Ukraine](https://docs.movieofthenight.com/guide/countries-and-services#ukraine)
lists `netflix`, `prime`, `apple` (plus Mubi, Curiosity Stream, Crunchyroll).
For our six-platform allowlist:

| Platform | Published UA API coverage |
| --- | --- |
| Netflix / Prime Video / Apple TV | Listed; actual two-film offers/field completeness not tested. |
| Rakuten TV / MEGOGO / HBO Max | Not listed for UA; do not substitute global/foreign coverage or infer service unavailability. |

The official [OpenAPI 4.1.0 schema](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)
defines country-keyed `streamingOptions`, `link` (web offer page), optional
`videoLink`, `type` (free/subscription/rent/buy/addon), price amount/currency,
audio locales and subtitle locales/closed captions. `quality` is optional
sd/hd/qhd/uhd. No HDR10/Dolby Vision, audio codec/channel layout or cut field is
documented in these models. Missing/empty data stays unknown, not confirmed
absence. Schema presence does not establish Ukrainian audio completeness or
account entitlement; `availableSince` is detection time, not a fresh playback
check. Title/director/year/IMDb/TMDb fields support identity checks, not cut proof.

### Access plan and applicable terms

The [official pricing page](https://www.movieofthenight.com/about/api/pricing)
lists all endpoints/catalogues on Free: **$0/month, 1,000 requests/month**, no
payment details; Starter **$49/25,000**, Growth **$99/100,000**, Scale
**$299/1,000,000**, USD/month. Free would suffice for a tiny non-AI capability
probe if separately approved; no paid plan is needed merely to unlock fields.
Account/API key required. Quota is a hard stop without overage, not permission
to retry. Recheck at signup; these prices are not an experiment cost estimate.

The current [portal Terms](https://developers.movieofthenight.com/terms-and-conditions)
were read from its publicly referenced
[terms module](https://developers.movieofthenight.com/assets/terms-and-conditions-By-pMztN.js)
without executing it: portal HTML is a JS shell; this session had no browser
surface. The official schema/README link to these portal terms. The older GitHub
`TERMS.md` differs and is **not substituted as the current agreement**.

- §3 permits app/end-user display, including commercial products, subject to
  restrictions on standalone redistribution/data services and competing products.
- §4 requires visible attribution/link to the API for display and written
  publications; §5 reserves third-party content rights, with notice/takedown
  duties. Attribution is not a third-party licence.
- §6 permits functional caching/storage and post-subscription retention subject
  to the other terms; this research still adds no archive. §2 disclaims data
  completeness/accuracy. §§7/9 cover quotas and subscription billing.
- **§10 explicitly prohibits using the data to train, fine-tune, evaluate or
  improve ML models/AI systems.** Do not use it as Gemini evaluation ground truth.
  Sending data to Mykola/another LLM for inference is not explicitly resolved by
  these provisions; no permission is inferred. Clarification would be needed
  before such a proposal, not a new adapter now.

### Recommendation and limits

At documentation checkpoint `30c3160`, the recommendation was to treat this as
a **partial non-LLM API candidate**, not a six-platform replacement
or approved Mykola integration. First decide whether coverage of three of six
platforms and absent HDR/audio-format fields is useful. If so, separately approve
a tiny owner-operated, display-only UA capability probe under the current terms:
country/service check plus the two already identified films, with attribution,
no LLM, no destination fetching or public dataset. Success would mean country/
identity-scoped API-reported links and explicit available/missing fields, not
account availability or model accuracy. Stop on access/terms conflict, quota,
identity mismatch or need for unsupported providers/fields; no fallback scraping.
Do not ask the owner to repeat the completed streaming-card checks. No integration
choice, implementation handoff or additional test was executed at that checkpoint.

## Approved non-LLM API probe

Subsequent owner authorization, October 18, 2026: implement a minimal direct
Movie of the Night probe for **Coherence and Dune, country UA**, not a new
six-platform integration or evaluation of an AI system. Current implementation
uses `DEMO_RETRIEVAL=motn-api`; at implementation it was **live-unvalidated**.
The [later two owner runs and closeout](#motn-closeout-identity-and-field-provenance)
are now complete, not independent validation or a post-fix retest. Existing
Search/URL Context/HTML modes and prompts are not changed.

### Current contract and rules recheck

- The current official [OpenAPI](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)
  is 4.1.0 on the `/v4` transport. `GET /shows/{id}` accepts the documented IMDb
  `tt…` form; `country=ua` asks for only Ukraine. Key from the direct
  [developer portal](https://developers.movieofthenight.com/) uses `X-API-Key`,
  not a RapidAPI key. No `/countries` or search request is added. Exact fixed
  IDs and prior evidence limits are in the [README](../README.md#movie-of-the-night-api-probe).
- [Published UA service coverage](https://docs.movieofthenight.com/guide/countries-and-services#ukraine)
  remains Netflix/Prime/Apple among our scope; this is not measured offer-level
  completeness. In the schema, `apple.rent`/`apple.buy` and subscription/addon
  types are distinct: the service ID/name is not an Apple TV subscription claim.
  No hidden subscription-only filter. Source `link`, access/addon, locales,
  optional quality and price are kept separate; no HDR/DV/codecs inferred.
- [Direct pricing](https://www.movieofthenight.com/about/api/pricing) rechecked:
  **Free $0 / 1,000 requests/month**, all endpoints/catalogues, no payment details.
  Optional Starter $49/25,000, Growth $99/100,000, Scale $299/1,000,000 USD/month.
  Free is sufficient for the two manually initiated title requests; no paid
  subscription chosen. Quota hard stop/no overage; signup/billing must still be
  checked by owner. A free advertised plan is not a zero total-cost claim.
- [Current Terms](https://developers.movieofthenight.com/terms-and-conditions)
  and their public route module linked above were re-read (not the older GitHub
  agreement). **§3** permits app/end-user use subject to standalone-data-product,
  redistribution and competing-service restrictions; this local owner-only UI
  does not offer a public dataset/API. **§4** attribution is visible before and
  after the request. **§5** third-party rights remain separate, so no logos,
  posters/descriptions or redistribution are introduced. **§6** permits functional
  retention subject to other terms, but the probe keeps none. **§10** AI training,
  evaluation/improvement prohibition is respected: no LLM receives any result,
  and data is not AI ground truth. It is not read as an automatic decision about
  inference rights, which are outside scope. No direct conflict with this narrow
  non-LLM manual capability probe was identified; this is not a legal guarantee
  or permission for a future pipeline. Stop on a concrete applicable conflict.

### Implemented boundary and original owner plan

Minimal built-in-fetch adapter, no SDK/dependency. One title GET per token,
20-second/2-MiB bounds, no redirects/retries/continuations/cookies/destinations.
Server-side secret header; safe content-free errors. Only UA fields projected;
foreign catalogue, descriptions/images and raw body never reach the page.
Identity mismatch stops offer display. Missing/empty UA is not unavailable.
Missing language versus an array without Ukrainian are distinguished, but list
completeness is not established: neither becomes confirmed absence. Provider
metadata is not account entitlement. Live output is neither logged nor archived.

The original plan was **one request per film**, now completed, not an automatic batch or new check of
every streaming card. Historical dated manual observations are controls, not
current guaranteed truth. Ask for a concise useful/missing-field summary; only
new or materially conflicting results merit another exact-card check. No full
JSON/metadata request unless an error actually requires diagnosis; never secrets.
[Termius/Safari commands](iphone-windows.md#movie-of-the-night-api-owner-workflow)
retain existing safeguards. No repeat SSH-disconnect test is mandated: detached
launch/auth mechanics are unchanged; the new key routing is tested in an isolated
mock-only Windows child, not inferred from Start-Process alone.

Agreed next sequence, **not an implemented pipeline**: Movie of the Night probe
→ compare with Kinobaza/JustWatch → MEGOGO direct-adapter feasibility → common
offer model. The [owner-reported platform coverage](digital-ua-owner-validation.md#owner-reported-platform-coverage-and-next-sequence)
does not guarantee API fields/catalogue completeness. Kinobaza's JustWatch
redirects are not a direct Partner API integration. Authorized workers remain
a separate conditional research direction; no credentials/accounts/worker or
new downstream adapter is provisioned. MW-FUT-01 remains Discovery.

## MOTN closeout: identity and field provenance

Audit October 18, 2026 against actual PR #179 HEAD `d3e32b0`, base #178
`30c3160`. Tracked tree was clean; no changes from the deliberately interrupted
turn were present. Owner's [two completed runs](digital-ua-owner-validation.md#movie-of-the-night--two-completed-owner-run-results)
are not independently repeated. No provider/model/destination request or full
response archive. Public documentation reads are not live data validation.

### Proven adapter defects and minimal correction

`normalizeMotn()` required `releaseYear === expected.year` even with exact
IMDb and agreeing supplied TMDb ID. A new authored fixture with Coherence's
reference identity and a differing integer year failed before the fix; currency/
language provenance checks passed unchanged. Thus the gate could reject a
stable-ID match solely over 2013/2014. **Corrected:** year variance is retained
as a visible warning, not an identity veto or a guessed explanation of the year.
The fixed catalogue/IDs, request URL/country, transport and field values stay
unchanged.

Explicit valid stable-ID conflict (including movie/TV namespace), or returned
series type, is now `mismatch`; missing/invalid required identity or other
ambiguous metadata stays `unresolved`. Both withhold options with
`optionsState=withheld-identity` and do not evaluate UA. Matched identity with
an actually empty array is `reported-empty`; missing UA is `not-reported`.
The display distinguishes these, not an invented negative availability result.
The correction does **not** reveal what Coherence's live API options contained;
no post-fix live run is requested. No confidence score or general matching engine.

### Field trace: source, adapter, display

Paths below start at `response.streamingOptions.ua[i]`. The official
[MOTN OpenAPI](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)
documents price strings/currency, optional quality, audio locales and subtitle
locale/CC objects. Code paths are [motn.mjs](../motn.mjs), the unchanged MOTN
branch of [server.mjs](../server.mjs), and [display](../public/motn-display.mjs).

| Source | Adapter → display | Finding / limits |
| --- | --- | --- |
| `price.amount`, `price.currency` | `priceField()` → each `stringField()` → `Price/currency` joins those values. | No country-based UAH default, conversion, price inference or lookup. Missing/null currency remains not reported. `price.formatted` is **not used** to recover/change either field. Applies identically to Apple and Prime, separately per offer. |
| `quality` | Validate returned sd/hd/qhd/uhd → display value. | No HD default or UHD/HDR inference; missing/null is not reported, unsupported code withheld. |
| `audios` | `languageField()` checks each returned locale → Ukrainian matches / returned locales. | `ukr`/explicit `uk`, not original language or country. Missing and null both become not reported; raw missing-vs-null is not retained. Empty array remains `[]`, not listed with completeness unknown. |
| `subtitles` | Same, using each `locale` and optional `closedCaptions`. | Independent of audio; identical missing/null/empty distinctions. No subtitle/audio substitution or proven completeness. |

**No field-mapping defect demonstrated** in these paths at the inspected HEAD.
Authored regressions preserve USD, UAH and EUR in the same UA context, omit
currency/quality without defaults, and distinguish empty lists from not reported.
Browser mocks verify literal amount/currency/HD and withheld-vs-empty messages.
The synthetic values are authored examples, not reconstructions of live data.

### Source discrepancies versus unknown causes

Owner-reported Apple HD/empty lists and UAH prices differ from the owner's dated
4K/DV, Ukrainian-audio and USD observations; Prime prices raise the same currency
question. In the inspected code, these displayed fields can only come from the
corresponding response fields. However no full live response/running-commit
trace exists to independently prove those original values, compare `formatted`,
or diagnose upstream currency/catalogue/region/age/metadata processing. **The
exact cause remains unestablished**, not a proven upstream bug or agent retest.
No USD, UHD, Ukrainian audio or negative availability is substituted from controls.

Close this manual stage: useful candidate links/access types in these cases;
language, video, prices/currency and coverage not established as complete or
reliable. Two films do not support a general accuracy conclusion. No new owner
test. The [TMDb handoff](tmdb-probe-handoff.md) was subsequently approved and
implemented as an isolated follow-up; its live run remains conditional. Other demo modes, native
Windows/auth controls, Kinobaza parser and production are unchanged.

## Approved TMDb data probe — implementation, not live findings

The owner approved the bounded two-film handoff after #179 `9e4bf4f`. Separate
`tmdb-data` mode now implements A identity/catalogue metadata and B actual
`results.UA`, maximum two serial HTTP requests per film, with fixed IDs and no
search/fallback/LLM/destination requests. This is not a shared offer model or
new availability truth source. MOTN and Kinobaza modes/parsers are unchanged.

Canonical endpoint/schema/terms assessment, localization hypothesis and actual
implementation limits remain in the [existing handoff/record](tmdb-probe-handoff.md#implementation-record),
not duplicated here. The official TMDb FAQ/Watch Providers docs were rechecked
October 18, 2026. Full current API Terms remain robots-inaccessible, so
**live readiness is conditional on owner review of the applicable agreement**,
not a permission/ban inferred from an old index or a compulsory email. No paid
plan selected. The official documentation SVG/notice and JustWatch attribution
are local display assets, not response evidence or branding certification.

Initial implementation + synthetic/offline checks did not answer which real
fields/UA providers are returned. The [first owner Coherence run](digital-ua-owner-validation.md#coherence--first-owner-run-result)
subsequently reported Apple TV Store rent/buy in UA and invalid appended objects.
The [separate validator diagnosis/fix](tmdb-probe-handoff.md#appended-resource-validation-correction)
does not independently establish the original live shape. The owner subsequently
confirmed Dune A/B and all five appends passed; the manual stage is complete.
In particular film-level TMDb language/UA aliases do
not fill MOTN's provider-track/quality/currency gaps. Explicit `uk` catalogue
translation and JustWatch aggregate buckets are different evidence classes;
shared JustWatch lineage is not independent corroboration. No additional owner
tests or Coherence/card/synthetic/SSH-disconnect repeat requested.
[Completed owner checkpoint](digital-ua-owner-validation.md#tmdb-data-probe--completed-owner-checkpoint).

## Shared offer observation model — design only

Motivated by the [completed two-film source comparison](digital-ua-owner-validation.md#cross-source-complementarity--observations-not-independent-entitlement).
This began as a **proposed logical contract**. Its bounded in-memory research
subset is implemented in the consolidated mode; the general production contract,
storage and LLM forwarding are not implemented or approved. Start with
digital offers; physical disc/cut models and automated Mykola recommendations
remain separate work. No arbitrary confidence score or global verified badge.

Keep **film catalogue metadata**, **candidate links**, **source offer claims**
and **account-specific observations** distinct. A candidate can exist without
an offer; a source availability signal can exist without a provider deep link.
One provider can have multiple rental/purchase/subscription/package offers.

| Component | Minimal proposed fields and meaning |
| --- | --- |
| Subject | Expected/observed TMDb, IMDb and provider-native IDs with namespaces; identity matched/mismatch/unresolved + basis; title/year/director; cut/version unknown unless established. Dates alone cannot veto exact agreed stable IDs. Catalogue original/localized title, description/tagline **presence** and film languages live here, not in provider tracks. |
| Candidate | Exact observed href, source card, provider name/namespace ID, link kind (exact card / tracking-redirect / search / relative / unknown), explicit territory + basis or unknown. Never reconstruct/resolve a destination automatically. A search URL is not an exact card; a TMDb country watch page is not a provider link. |
| Offer scope | Subject + provider + country/basis + access type/source bucket + package/offer/version ID if supplied. Unknown access/package/cut remains unknown. Country from a section/API key is a source context, not proof of account entitlement. |
| Field observation | Field path, value, state (reported / explicit-negative / unknown / invalid), source/URL or endpoint, evidence method, receipt time and observation time separately; review provenance (not reviewed / owner-reported check / independent check), context and short evidence note. Missing/null/empty distinctions preserved where supplied. No invented timestamps or account settings. |
| Availability / entitlement | Availability value available / preorder / unavailable / unknown, always scoped to the reporting source/context. Separate listing/link found, aggregator claim, direct public-page claim, account Play-button observation and new rental/purchase terms. A Play button is not a new purchase price; reported availability is not independently verified playback. No search miss or missing UA becomes unavailable. |
| Characteristics | Separate audio locales, subtitle locales/types, video resolution, HDR10, Dolby Vision, price amount/currency, access type and package. Audio codec/channels attach to a specific locale only with evidence. Track-list completeness defaults unknown; original_language and Ukrainian catalogue text never fill offered tracks. UHD is not HDR/DV. |
| Provenance / limitations | Source and upstream lineage (e.g. JustWatch), retrieval status, identity/territory context, field conflicts, missingness/completeness, attribution and allowed-use/retention status. Unknown rights are unresolved, not permission. A retrieval SUCCESS/HTTP 200 is not claim truth or freshness. |

**Combining policy, proposed not implemented:** refined by the
[M2 relation-specific policy](#m2-digital-offer-matching--proposed) below. Group observations only after
identity/provider/country/access/package/version compatibility is established.
Provider IDs are namespaced per source; Apple TV Store must not be conflated
with an Apple subscription/channel merely because the brand name matches.
Unknown scopes can be displayed alongside, not silently merged. Preserve each
source assertion with its own provenance; do not choose a universal winner or
count TMDb + JustWatch-derived Kinobaza as two independent confirmations.
Conflicting claims stay separate with a conflict flag; observation time does not
automatically establish freshness/priority. Do not overwrite MOTN UAH/HD/empty
lists with owner USD/4K/Ukrainian audio, nor transfer a Kinobaza unscoped MEGOGO
link into UA just because a separate owner observation was Ukrainian.

### Proposed source mapping and acceptance

| Existing source | Contribution | Must not imply |
| --- | --- | --- |
| TMDb Details/translations | Stable identity, names/aliases/directors/dates, explicit Ukrainian catalogue text evidence. | Offered audio/subtitles from spoken/original language, title/overview/tagline or an empty UA release-language field. |
| TMDb / JustWatch results.UA | Country provider/access-bucket observations; TMDb watch-page link separately. | Exact provider URL, account entitlement, current offer characteristics or independence from Kinobaza's JustWatch sections. |
| MOTN | Additional provider URLs and access types; literal per-offer metadata with provenance. | Complete language lists, reliable price currency/quality or absence from empty/missing data; no automatic correction or AI forwarding permission. |
| Kinobaza HTML | Exact/tracking candidates, explicit country-section signals and separately scoped film/provider-block localization claims in the approved iteration. | Verified entitlement/offer tracks, cross-source enrichment by provider name, complete lists, resolved tracking destinations or UA territory from a loose page location. |
| Owner observations | Field/context-specific manual controls with owner attribution; no account credentials. | Agent validation, universal truth, current guaranteed price or whole-platform verification. |

Future acceptance tests (authored data only): same provider rent/buy stay separate;
unknown territory/package/cut never auto-merges; search/relative/tracking remain
distinct; conflicting currency/quality retains both assertions; empty languages
never become absence; film localization never becomes provider audio; shared
JustWatch lineage never raises an independent-confirmation count. No persistence
or real-source-derived archive is authorized by this design. Implement the model
only in a separately scoped task after source-specific usage/attribution/transfer
conditions are established; do not retrofit current adapters now.

## M2 digital offer matching — Proposed

**Design decision M2-D1, Proposed / not authorized for implementation.** The
first implementation slice is **A/B-only**: same-film association and comparison
of supported regional provider-card pointers, with direct evidence/reason links
between existing source rows. No general relation graph, exhaustive pairwise
engine or merged “verified offer”. Preserve all M1 row/link/draft controls.
C/D remain long-term design constraints and forbidden-inference tests, **not
runtime engines or required runtime outcomes in this slice**. M2 needs no LLM,
new source, destination fetch or storage. Only documentation is authorized now;
implementation, preflight and live evaluation all need separate authorization.

This documentation-only narrowing continues open #184 after
`d8b24719fbe2a6de41a8c25858ac9890e714c2a0`, on the same verified develop base.
No runtime or preflight/evaluation work has been performed for this amendment.

### Inspected implementation and evidence boundary

At the [verified baseline](#verified-baseline-and-m2-design-status):

- [TMDb projection](../tmdb.mjs) validates root/supplied stable IDs; Details
  metadata and `results.UA` buckets are separate. No provider deep link/offer ID,
  provider tracks or price is supplied by that projection. Missing IMDb leaves
  the crosswalk unknown even when the root TMDb ID matches.
- [MOTN projection](../motn.mjs) requires the fixed IMDb match and rejects supplied
  stable-ID conflicts. Year variance alone is allowed. Per-option link/access/
  addon/language/quality/price are source assertions. Missing/null languages
  coalesce; empty lists retain unknown completeness. No provider-native offer ID
  or provider update time is projected; do not assume these fields exist upstream.
- [Kinobaza HTML](../html-source.mjs) currently matches title/year/director in
  bounded markup, not a returned stable-ID crosswalk. [Localization](../kinobaza-localization.mjs)
  binds direct single-anchor table/paragraph blocks with parser-issued block IDs;
  film badge, provider block and country section remain different observations.
  Block IDs are operation-local, not stable provider offer IDs.
- [Composition](../discovery.mjs) keeps independent source identity/failure gates,
  explicit provider mapping, R2 namespaced-ID quarantine, and exact link policy.
  Its quality/price peer warnings are heuristic scope warnings, **not M2 offer
  identity evidence**. It does not extract a cross-source native-card key today.
- [Client](../public/discovery-client.mjs) groups by platform without merging
  row references. R1 Apple `at` and opaque-tracking/referral acknowledgement are
  independent of navigation; review/confirm selects one row. Only six existing
  draft fields are copied; tracks/video/price stay excluded. Cancel selection
  preserves manual edits. None of these protections is replaced by M2.

Owner observations in the [ledger](digital-ua-owner-validation.md) are dated,
context-specific controls. Authored regressions prove implementation behavior,
not live coverage. Earlier independent HTML/code checks do not verify destination
entitlement. Proposed relations below are hypotheses until implemented/tested;
MEGOGO direct extraction and Coherence TMDb A partial remain unresolved/frozen
as previously recorded. No new source rules/rights are verified in this task;
the [dated source-use boundaries](#source-rights-persistence-and-privacy-boundary)
remain conditional, not a fresh licence for matching, forwarding or retention.

### Four independent questions and outcomes

| Level | Question | A positive relation means | It does not mean |
| --- | --- | --- | --- |
| A — film | Are these observations about the same catalogue work? | Agreed namespaced IDs/crosswalk, or a separately labelled accepted source identity gate. | Same card, cut, territory, offer, tracks or entitlement. |
| B — card | Do both references designate the same regional provider-card pointer? | Accepted provider/route/native-ID comparison with its routing context; keep basis `declared-pointer`, destination unverified. | That destination was read, the film/cut there was verified, or all access options share characteristics. |
| C — offer | Do these assertions refer to the same commercial proposition? | Positive explicit offer binding plus compatible known commercial scope. | Playback entitlement, independent corroboration, or application of every card-level field. |
| D — field | Does this particular assertion apply to that particular offer? | Direct field-to-offer binding or explicit source statement covering that offer scope. | Applicability to sibling offers, complete track lists, or independent truth. |

The first slice returns **`compatible` / `conflicting` / `insufficient-evidence`
for A/B only**, with reasons, supporting row/field refs and missing dimensions.
The same vocabulary for C/D is a future design, not a request to implement it.
`conflicting` requires explicit incompatible evidence, not missing
data. A known difference (rent versus buy) is a C conflict **for a proposed join**,
not an error in either source. Keep field disagreements separate from identity
conflicts: C may be compatible while D has contradictory values.

`compatible` is scoped support, never a global verified badge. Invalid/unsafe
input is withheld with its existing reason, not converted into negative evidence.
No numeric confidence, majority vote or latest-receipt-wins rule. Direct A/B
links do not authorize a transitive union, territory borrowing or field
propagation; there is no general graph to traverse. A conflict quarantines only
affected links/observations;
independent correctly gated rows remain useful/selectable.

### Matching rules matrix

All examples below are **authored scenarios**, not assertions about current
catalogues. `F`, `P`, `N`, `O` and times denote fictional film/provider/card/offer
identifiers and contexts. “Same offer” examples with provider-issued offer IDs
exercise the logical contract; current adapters do not establish such an ID.

**Scope partition:** M01–M09 drive A/B checks and preserve existing provider/link
controls. M10/M14/M19/M20 supply scope/lineage/time explanations where already
available, not a broader matching engine. M11–M13 and M15–M18 remain C/D design
constraints: first-slice tests assert **no commercial join/field propagation**,
not positive C/D runtime matching. All20 rules remain canonical long-term design.

| Rule / level | Required evidence | Positive authored example | Negative or ambiguous authored example | Permitted outcome; forbidden inference |
| --- | --- | --- | --- | --- |
| M01 / A stable identity | Valid IDs with movie/source namespaces, an explicit crosswalk where namespaces differ, no returned stable conflict. | Both independently gated records agree on IMDb F; one reports year2013 and another2014. | IMDb F versus G, or a conflicting supplied TMDb ID despite matching title/year. | Compatible A with year warning, or conflicting A and affected source withheld. Never explain the year without evidence or let title similarity override IDs. |
| M02 / A partial identity | Preserve each actual source gate and missing crosswalk, plus title/director basis where used. | Existing Kinobaza title/year/director gate matches the fixed subject; show source-gated film association, not a stable-ID match. | TMDb root F matches but no IMDb crosswalk; another record has only a translated title. | A compatible only to the extent of accepted gates; crosswalk-dependent relation insufficient. Do not label a structural match a verified provider identity or invent missing IDs. |
| M03 / provider namespace | Reviewed source ID/name aliases; R2 consistency within a namespace across buckets. | One TMDb ID labelled Prime Video / Amazon Prime Video in rent/buy; separate MOTN numeric ID with the same number. | One TMDb ID labelled Netflix and Prime Video. | Compatible alias mapping, independent namespaces; conflict quarantines that ID's observations, preserving raw provenance. Never silently pick a platform/access/draft medium. |
| M04 / Apple product | Store identity from reviewed ID/access/label context; distinguish service, channel/addon and seller. | Known TMDb Store ID2 and a mapped MOTN Apple rent option both classify as Store. | “Apple TV” alone; Apple TV+ subscription; channel subscription sharing Apple branding. | Platform grouping only when mapping is explicit; otherwise unresolved. Store and TV+/channels cannot join by brand or URL host. |
| M05 / B exact pointer | Safe accepted URL grammar, mapped provider, exact native ID and same regional route; retain original href and ID namespace. | Two accepted UA Apple card routes contain the same `umc.cmc.N` and no incompatible qualifier. | iTunes numeric N versus Apple `umc.cmc.M` without a crosswalk; same title slug only. | Compatible B `declared-pointer` in first case, insufficient otherwise. Native ID in a known URL is not a destination fetch or film/offer verification. |
| M06 / B regional card | Route-region/native-ID context and explicit differences recorded separately from source market. | Same provider/native-ID/UA-route pointer repeated by two sources. | Same native ID on UA and GB routes, or a regionless route versus UA without a supported equivalence. | Insufficient same-regional-card evidence across routes; known different regional pointers stay separate. UA URL/UI is not availability or entitlement. |
| M07 / B query/referral | Only reviewed route-specific identity parsing; exact query/order/encoding retained. | Identical supported Apple card/native ID with and without `at`; other qualifiers equal/absent. | Unknown differing query keys that might select a variant, or ambiguous/repeated native-ID parameters. | Reviewed `at` can be ignored for a **comparison key only**; R1 presence gate still applies to empty/bare/repeated/decoded `at`. Unknown material qualifiers → insufficient B. Never strip/rewrite transfer URL or broaden markers/routes. |
| M08 / B tracking | Exact opaque href/provenance, no inferred destination; existing tracking kind. | The same observed tracking href is repeated: record same opaque candidate reference. | Tracking URL and MOTN direct card, even if provider/title match or query appears to contain a destination. | B insufficient for destination-card equality; no decode/resolve/fetch. Repeated opaque string is not a provider-native ID. Transfer needs acknowledgement, not a claimed legal ban. |
| M09 / link exclusion | Existing scheme/host/path/userinfo/port and search/relative/unsafe classification. | Safe supported native card yields a candidate usable under current explicit-navigation rules. | Search URL, `/relative`, unsafe scheme/userinfo/port, unknown route, or TMDb watch page. | Preserve each precise classification; no B/C proof from it and no substitution into purchase_url. Unsafe value withheld; relative/search/watch not provider cards. |
| M10 / territory | Source's explicit market/country association and basis attached to this observation. | TMDb `results.UA` and MOTN `streamingOptions.ua` separately report UA context. | Kinobaza provider block outside country panels beside a UA section; foreign section with a UA badge elsewhere. | Compatible market dimension only for explicit UA-scoped assertions. Unknown remains unknown; no transplantation of territory through a platform/card relation. |
| M11 / C access | Explicit normalized access plus raw bucket; own package/channel context. | Two source assertions expressly bound to offer O both say rental. | Rent and buy share one URL/native card; subscription versus purchase. | First is access-compatible, not alone C proof; second is C conflicting/different offers, while B may remain compatible. Never merge rent/buy or infer ownership from access. |
| M12 / C positive offer binding | A compatible film/provider/card scope; explicit same provider-issued offer reference/crosswalk; known agreeing country/access/package/version or explicit scoped not-applicable; compatible effective context. | Fictional sources explicitly reference P:offer:O, UA rental, package K, cut V, overlapping validity; all scope agrees. | Same full-looking tuple/card but no explicit offer binding; unknown package/cut treated as empty; different provider offer IDs. | Compatible C only with positive binding and no known conflict; otherwise insufficient or conflicting. Same URL/tuple/price alone cannot establish a commercial offer. No current-source C success is promised. |
| M13 / package/cut/version | Explicit source association for that particular card/offer; missing is not `none`. | Both offer-O assertions expressly name package K and Final Cut V. | Final Cut versus theatrical/2049; package K versus L; unnamed edition/package on either record. | Known incompatibility blocks C/D; unknown dimension leaves them insufficient. Stable film IDs and a matching card do not silently resolve cut/version. |
| M14 / TMDb no deep link | A and provider/market/access signal with JustWatch lineage, no provider offer/card assertion. | TMDb UA rental signal is shown alongside a same-film/platform MOTN UA rental lead. | Attaching MOTN link or Kinobaza audio to the TMDb signal as if directly reported there. | Related market/access **lead**, B/C/D insufficient without further evidence; TMDb row remains linkless. Watch link is separate navigation information, not a provider-card replacement. |
| M15 / D block binding | Exact source anchor/block association and field label; territory/access/cut applicability separately evidenced. | Kinobaza block's own anchor/table contains audio+ and subtitle−: display those literal block claims beside that card pointer. | Same provider name in MOTN; adjacent block; unknown block territory/access; film-level UA badge. | D compatible for the **source block's own assertion**, insufficient for a particular MOTN offer. No scope borrowing, synthetic enriched offer or tracks in draft. |
| M16 / D positive offer scope | Direct field-to-offer binding, or explicit statement that field covers exactly the compared territory/version/access scopes. | Authored offer O explicitly lists UA audio for that rental; an authored card statement explicitly covers both named rent and buy scopes. | Generic card audio list with unknown access scope; original language English; Ukrainian title/overview/tagline. | Use direct scoped property for comparison as a source claim, not entitlement. B/C alone never authorize D; catalogue metadata is not offered audio. Current sources may leave D insufficient. |
| M17 / D negatives/completeness | Exact field/type/format label and explicit negative, separately documented completeness if asserting list absence. | Source block says Ukrainian stereo− and generic Dolby+; preserve both with their labels. | Empty/missing list, omitted subtitle type, or negative stereo applied to all audio/offers. | Label-specific negative only; unknown completeness stays unknown. Generic Dolby is not Atmos/codec/channels; UHD is not HDR10/DV; HD does not prove no4K. |
| M18 / field conflict | Scope relation and literal values, currency/units, times and evidence refs. | Same-scoped contemporary offer assertions disagree HD/UHD or USD/UAH: retain both and mark field conflict. | Different regional/access/version scope or unknown update time; same price digits with different currency. | Conflict if applicability/context established, otherwise possible conflict/scope unknown. Never correct UAH→USD, HD→UHD or empty tracks using controls; price incomplete/anomalous/conflicting excluded. |
| M19 / lineage | Explicit upstream per observation, not per platform/site globally. | TMDb UA and Kinobaza JustWatch country panel both cite JustWatch. | Kinobaza provider block assumed JustWatch, or MOTN assumed independent without evidence. | Show shared/unknown lineage; no independent corroboration count or majority boost. Distinct source labels are not independent evidence. |
| M20 / time | Local receipt time versus source update/effective interval, if actually supplied. | Two assertions explicitly refer to the same offer/version with overlapping stated validity. | A later receipt of undated data overrides an earlier receipt; old/new prices are called simultaneous contradictions. | Compare known intervals, qualify temporal mismatch; unknown freshness stays unknown. Same operation/close receipts alone do not prove source freshness or C identity. No invented TTL or automatic winner. |

### Relation contract and useful presentation

Proposed first-slice direct link: source row ref and fixed-film/related row ref;
question **A or B**; outcome/reason; evidence refs; routing/identity basis and
missing context; receipt/lineage already present on the rows. Keep operation-local
indices distinct from durable IDs. No C/D record generation, generic graph schema,
graph traversal, all-row Cartesian comparisons or production/persistence model.
The [shared contract](#shared-offer-observation-model--design-only) remains the
long-term field model, not a prerequisite to implement all of it.

Use existing per-source identity gates for direct association with the fixed film
(A), then R2 consistency and a small lookup of supported regional native-card keys
(B). Attach explanatory references only for the explicit association/key tested.
Unknown/unsupported keys yield a qualified related film/provider claim, not a
fabricated B match. Stable-ID conflict cannot be “fixed” by URL similarity; check
all returned IDs and keep independent good rows. Different supported pointers
conflict only with a proposed same-card link, not necessarily with the film or
either source's validity.

UI remains platform groups with separate selectable source rows. Use short
**source-labelled** explanations; labels can coexist without pooling scope:

| Short explanation | Evidence and visible limit |
| --- | --- |
| Same supported regional card pointer | Name both source rows and supported native-key/route basis; destination unverified, not commercial-offer equality. |
| Related film/provider claim, exact card unresolved | A/source provider association exists; no comparable direct card key, e.g. TMDb signal, tracking or cross-ID Apple routes. |
| Territory/access/version insufficient for enrichment | A/B may be useful, but block localization stays on its original row; no C/D evaluation or copying tracks to another offer. |
| Conflicting identity/card evidence | Show affected sources and precise stable-ID/R2/different-pointer reason; independent valid rows survive. No platform-wide failure inferred. |

Long technical reasons, compared refs, missing dimensions, exact hrefs and
provenance stay in collapsed details. No unified verified offer, best-option
badge, auto-open or merge-all action. Select/review/confirm always targets the
original source row. Useful A/B explanations suffice; commercial offer identity
and field applicability remain explicitly deferred.

#### Copy short test summary — proposed UI requirement

Documentation-only addition approved after #184 `aefb166`; implementation is
still **Proposed / not authorized**. Add a **Copy short report** action after a
discovery operation finishes, including partial/error results. Its purpose is
the owner's short acceptance summary, not raw evidence export or accuracy scoring.

Generate a bounded **plain-text** report from an explicit allowlist, not by
serializing the result/stages/draft. Contents:

- Film, retrieval/mode and actual run receipt time, clearly synthetic versus
  live source claims; never automatically label a run owner-validated.
- Source status/identity, requests made versus ceiling, elapsed time (one run,
  not a benchmark/cost estimate).
- Compact source-labelled leads/access/link kinds, A/B outcomes with short
  evidence/reasons, important unknown/conflict markers. No C/D inference,
  unified verified offer, entitlement or successful-test assertion.
- Draft interaction summary, if used: actual present/confirmed/edited/cancelled
  state only, not free-text draft values or an invented list of transferred
  fields. Cancelling selection must not imply that the prior edited draft vanished.

Do not copy credentials, headers/environment, account/device/local-path data,
full JSON/HTML, raw responses, long technical diagnostics or full provider/
tracking URLs/query parameters by default. Keep source names/attribution and
uncertainty in the summary. Indicate omitted rows if the bounded summary cannot
include all leads. This is not a new source-data licence or a response archive.

Copy only on an explicit user gesture; repeated copies may reuse the current
snapshot without another request/token/session. Do not read the clipboard,
auto-copy, add analytics/storage/downloads or change draft/source state. Enable
only for the displayed film's completed snapshot; clear stale success/report
state on film change/reload. No API/destination requests or budget increase.

Do not assume clipboard write capability/permission in the existing iPhone/
Safari LAN HTTP workflow. Attempt copying only when supported and permitted;
show success **only after the write succeeds**. If unavailable/denied/failing,
show the same plain text in a selectable read-only fallback for manual copying,
with honest status; do not weaken auth/Host/Origin/CSP or require HTTPS/system
changes merely for this action. No guaranteed one-click success where the
browser refuses clipboard access. Page data stays memory-only, but an explicit
copy exports text to the **OS clipboard**, which can outlive the page or be
managed/synced by the device; do not promise clipboard erasure on reload.

Future checks: mocked successful/denied/unavailable writes; exact allowlisted
summary, synthetic/partial/error labels, no secrets/raw/draft contents; stale-film
guard, repeated copy without requests, no mutation of edited draft. Browser/mobile
tests verify success feedback and fallback selection; actual Safari behavior
remains unverified until the separately approved acceptance session. Fold this
into that one session, not an extra owner test cycle or mandatory repeat of old
platform/synthetic/SSH-disconnect checks.

### Localization, recommendations and local draft

| Evidence use | Allowed in proposed comparison | Draft boundary |
| --- | --- | --- |
| Independently gated source UA availability/access | Compare as source-market signal; not account playback/new purchase entitlement. | Existing selected-row identity/medium only; access/provenance sidecar, no ownership. |
| Direct source-row audio/subtitles/video | Show only on the reporting row with its original scope; cross-source field applicability is deferred (D). Explicit negatives retain narrow scope. | Still excluded from form fields: current MW-shaped draft has no track/video fields. Preserve sidecar only. |
| Provider block, unknown territory/access, catalogue localization | Show adjacent hint with its own basis, not an offer's rank/value; general film localization is search/identity context. | Never populate another row or recommended tracks; no cross-source URL borrowing. |
| Price/quality/currency disputes; missing/empty metadata | Retain literal source claims/unknowns/conflicts, no conversion or repair. | Price/currency and unknown/conflicting/suspect fields remain excluded by default. |
| Selected-row safe exact or opaque-tracking/referral candidate | Explicit navigation independent of transfer and matching result. | Exact href only; R1 `at` and existing tracking/referral acknowledgement required. Search/relative/unsafe/watch/unknown kinds leave purchase_url blank. |

Requirement-level ordering only: **UA availability → Ukrainian audio → Ukrainian
subtitles → video → price/other parameters**, among genuinely comparable scopes.
Unknown is neither negative nor a hidden zero; conflicting or scope-insufficient
fields do not break ties. A known source claim of HD+UA audio may precede a
comparable explicit no-UA-audio4K claim; subtitle-only UA may precede an explicitly
unlocalized higher format. If one key dimension is unknown, show reasons/gaps
without a mandatory “best”. Do not design a numerical score, FX conversion,
automatic cheapest selection or LLM ranking in M2.

Selection continues to bind one original source row; relations are explanatory,
not permission to assemble its title/link/audio from peers. Review included and
excluded fields → explicit confirm → editable page-memory draft. Cancel must
leave confirmed/manual edits untouched. No autosave, browser storage, production
MW write or new audio/price schema. Unmapped/conflicting provider observations
remain unresolved, not selectable canonical media (R2); other good rows survive.

### Future regression design and evaluation outside two films

The full matrix retains authored positive and negative/ambiguous examples as
long-term design. First-slice executable regressions cover A/B outcomes/reasons
and forbidden-inference assertions for C/D; **no positive C/D runtime engine or
commercial-offer fixture schema is required**. This task adds no executable
fixtures/tests. Future first-slice coverage must also include:

| Regression family | Required guard beyond the individual matrix rows |
| --- | --- |
| False joins | A/B positive never yields a C/D conclusion; same URL rent/buy; missing scopes on both sides not equal; tracking versus direct; region variants; Apple Store/TV+/channel; no transitive propagation. |
| Missed joins | Exact stable ID/year variance; compatible reviewed aliases; same accepted regional native-card key despite allowed referral difference, keeping both exact hrefs/ack gates. |
| Conflicts | Supplied stable ID conflict; R2 per-namespace ID conflict; different supported card keys; independent namespace unaffected. Contradictory fields stay on their rows, with no new C/D winner engine. |
| Partial/missing data | TMDb failure leaves MOTN; matched identity/partial A; absent deep link; missing/null/empty; malformed/unsafe withheld; no added fallback/fetch. |
| Lineage/time | JustWatch shared origin not independent; unknown upstream not invented; receipt versus source time; possible temporal discrepancy not automatic latest-wins. |
| Draft/mobile/security | Only selected-row fields, exact URL/R1 acknowledgement toggle, R2 no selection, excluded tracks/video/prices, review/confirm/edit/cancel, text-only/no storage; no extra requests or changes to auth/budgets. |

**Proposed held-out set, not configured or run:** four catalogue candidates
selected by risk **before knowing provider results**, not viewing recommendations:

| Candidate / hypothesis or risk | Required sources and source-card precondition | Expected semantic behavior, not factual results | Outcomes the case can reveal |
| --- | --- | --- | --- |
| Kingdom of Heaven (2005), target Director's Cut: film/card versus version | TMDb + MOTN + **Kinobaza required**; exact film source-card URL and any permitted canonical pair verified in preflight before configuration. | Relate accepted film identities and supported pointers; keep version unknown unless explicitly reported. Localization stays block-scoped even if B matches. No assumed provider/cut availability. | Positive A/B if evidence aligns; insufficient B/version for tracking/cross-ID/unreported cut; conflicting supplied stable IDs or supported card keys for the proposed link. |
| The Thing (1982): same-name collision | TMDb + MOTN; Kinobaza off for this case. | Distinguish the1982 subject by stable IDs, never a shared title. B can match without a commercial join. | Positive A/B with agreeing evidence; insufficient card metadata/empty result; conflicting identity if a source returns the2011 subject. No expected live conflict asserted. |
| The Thing (2011): paired counterexample | TMDb + MOTN; Kinobaza off for this case. | Keep separate from1982 despite names; preserve independent gates and access rows. | Positive links within2011; insufficient B without direct key; explicit ID/card conflict. A difference across films is not a source defect. |
| Parasite (2019): localized title versus offered tracks | TMDb + MOTN + **Kinobaza required**; exact film source-card URL and any permitted canonical pair verified in preflight before configuration. | Keep catalogue localization, own-block audio/subtitles and explicit country claims separate; compare supported pointers without moving tracks into MOTN offers. | Positive A/B with supported IDs/pointers; related claim but B unresolved for tracking/iTunes cross-ID/missing key; conflict from explicit ID/card disagreement. No assumed UA tracks/results. |

**URL/ID readiness now: pending for all four films.** No new source-card URLs,
stable IDs or provider results are asserted/fetched in this documentation task.
The two required Kinobaza URLs must be exact **source film cards**, not search
pages/provider destinations, identity-checked before the future session. Do not
invent slugs, substitute old Coherence/Dune cards or silently disable Kinobaza.
Failure to establish either card makes this plan not ready for localization-source
matching evaluation. Arbitrary-card discovery is not solved. Empty live coverage
remains a finding; do not replace samples after seeing results. Missing block
claims mean that aspect was not observed, not a passed localization-match test.
Authored guards cover cases absent live; do not hunt for successful results.

#### Separate proposed request budgets — no requests authorized now

| Phase | Bounded work, after its own approval | Ceiling |
| --- | --- | --- |
| Identity preflight | At most2 public authoritative identity-document GETs per film for TMDb/IMDb/director crosswalk; no unlisted endpoint fan-out. Stop if unresolved. | 8 GETs for4 films. |
| Kinobaza source-card preflight | Only the2 proposed exact source-card URLs; at most1 GET each plus1 strictly validated canonical hop each. No provider/tracking requests. | 2 without hops;4 maximum with2 permitted hops. |
| Source-use readiness preflight, if needed | Up to3 relevant public rules/notices/robots documents per source (TMDb/MOTN/Kinobaza); not catalogue extraction or a licence inferred from robots. | 9 document GETs maximum; actual0 if no fresh read needed. |
| **Preflight total** | Separate from discovery/owner time; failed attempts and redirects count; no retries or unbudgeted searches. | **At most21 GETs** (8 identity +4 source-card +9 conditional rules); stop if evidence cannot be established within caps. |
| Discovery, Kinobaza-off cases | The Thing1982/2011: TMDb A+B max2 plus independent MOTN1 each. | 3 each;6 total. |
| Discovery, Kinobaza-required cases | Kingdom of Heaven/Parasite: TMDb2 +MOTN1 +Kinobaza1, plus at most1 configured exact canonical hop per case. | 4 each without hop;5 each maximum. |
| **Four-film discovery total** | One explicit discovery per film; no retries, new endpoints or destination requests. | **14 without hops;16 maximum**:12 +K +H, K=2 configured cards, 0≤H≤2 actual permitted hops. |

Preflight is a separate bounded future operation, not hidden inside discovery or
a request to the owner now. Candidate source URLs must be supplied for review
before GETs; unknown URLs needing additional search/navigation require a separately
approved bounded plan, not fabricated paths/invisible requests. Count every actual
GET, including redirect/refusal responses, against its phase cap. Preflight has
no automatic redirect following: only a validated exact old→canonical same-title
pair may consume the one additional GET. Configure the verified pair or direct
canonical card before evaluation; unknown targets stop the path, no generic
redirect expansion. Preflight metadata can record IDs, exact configured source
URL and verification basis, not HTML/response archives.

After separate implementation/sample approval and source-use readiness, retain
the original two films as dated controls, not compulsory new runs. Identity or
transport failures may reduce actual calls; unused budget is not retry/new-source
permission. Existing Coherence/Dune budgets stay unchanged (max4/conditional5 per
film, Kinobaza-off max3). Matching adds0 requests.

Agent would run authored/offline/HTTP/mobile/security checks first; Windows only
if helper/key/lifecycle changes, preserving owner demo. One **future** short
Termius → iPhone/Safari acceptance session: correct branch/status/config/hidden
credentials with existing workflow; one discovery per approved new film; inspect
new relations/unknowns and one select/review/confirm/edit/cancel flow. No repeated
streaming-app tour or old Coherence/Dune checks; no mandatory synthetic/SSH-disconnect
repeat without relevant workflow changes. Summary only: useful A/B links/explanations,
false/missed joins, missing/conflicting fields, draft result, actual calls.
No JSON/HTML/screenshots. Existing owner prices/settings are dated controls.

Stop the affected source on403/429/CAPTCHA/terms conflict/identity mismatch; keep
independent safe partials. Stop the session on security leak, extra/destination
requests, false scope propagation or budget violation. No workaround, sample
replacement, retry/second session by default. If supported B links cannot be
established or localization blocks are absent, report that limit, not a reason
to weaken gates or gather more data. C/D are deferred and need no runtime output.

### Trade-offs, approvals and roadmap

M2-D1 favors explainable missed joins over false enrichment. Card-pointer links
can improve comparison even when C/D remain unknown; there is no promise of
automatic commercial-offer merging from currently projected data. Unknown
package/cut/territory blocks strong claims, not display of related hints.
Extra provenance costs UI space: compact reason labels, details for dimensions,
no duplicate full payload. Conditional source rights and track reliability stay
separate from implementation correctness; no cache/LLM/reuse permission inferred.

| Phase | Status / decision |
| --- | --- |
| M1 isolated probes/composition | Merged into research develop; bounded owner observations, not production. |
| M2 matching matrix/handoff | **Proposed, design-only**; this document is canonical. |
| M2 implementation on existing fixed Coherence/Dune | **Not authorized**. A/B-only direct explanations, no graph/full pairwise or C/D engine; preserve separate rows and one-row draft/default exclusions. |
| C/D commercial identity/field applicability | Deferred long-term rules/forbidden-inference tests only, not required runtime in the first slice. |
| Held-out four-film session | **Proposed, not authorized**;2 required preverified Kinobaza cards. Separate preflight cap21 and discovery14/conditional16. Approval/readiness/configuration needed before any live work. |
| Arbitrary Kinobaza cards/MEGOGO/LLM/workers/persistence/production | Deferred; no new authorization or infrastructure. |

These two scope approvals are the actual product decisions. Rule mechanics,
unknown preservation and safety are proposed engineering defaults, not a request
for the owner to pick a confidence threshold. No need to choose an aggregator,
subscription, storage TTL or new hosting to review M2. The separate
[implementation handoff](m2-offer-matching-handoff.md) references this policy;
it is not an implementation instruction until separately approved.

<a id="megogo-one-card-adapter-proposal--not-implemented"></a>

## MEGOGO one-card HTML PoC

**Status: implemented / offline-tested; two owner attempts rejected before
identity. MEGOGO remains unresolved. Attribute-aware v2 fixes authored policy
defects only; no new owner GET is requested.** This section replaces
the earlier proposal in place; the legacy anchor preserves historical links.
Starting from #180 `b9f3c65`, the owner approved the same bounded experiment
model as Kinobaza HTML: one fixed public card, explicit manual action, transient
display. This is not approval of regular/commercial integration. The shared
offer model above remains design-only; other adapters and prior observations
are unchanged. Hypothesis: the initial HTML might provide useful offer-local
metadata missing from aggregators. Earlier owner Dune/MEGOGO observations are
dated controls, not seeded fixtures, current expected facts or a retest request.

### Public interface / terms review

Read-only official sources checked **October 18, 2026**; no streaming-card or API
request. [Partnership](https://megogo.net/ua/partnership) and
[contacts](https://megogo.net/ua/contacts) describe cooperation, not a public
metadata API contract. Public supported API endpoints/auth/fields/quota/pricing
were **not found** in the inspected official pages/search, not proven nonexistent.
No private endpoints inferred from apps or third-party libraries.

**Current bounded-scope recheck, October 18, 2026:** the web reader again returned
a Polish MEGOGO.PL agreement from [the exact rules URL](https://megogo.net/ua/rules).
An ordinary direct HTTP read of that same URL, without cookies, login, proxy,
region pinning or redirect following, returned the **Ukrainian agreement**, naming
ТОВ «МЕГОГО», EDRPOU 38347009 (§1.1), service territory Ukraine (§1.8), edition
**June 4, 2026**. Do not substitute the Polish edition or infer fetcher geography
from either representation. No film-card GET was performed by the agent.

- **Applicable prohibitions preserved:** §2.4/§9.3 prohibit technical/protection/
  territorial circumvention and disruptive conduct. No such path is implemented;
  redirect, access block, CAPTCHA or rate limit terminates the request.
- **Rights not established:** §1.6 defines content broadly; §9.1–9.2 reserve
  service/content intellectual-property and reproduction/display rights. They
  are not an extraction/normalization licence. No precise, expressly applicable
  prohibition of this single non-commercial factual-metadata GET/transient
  display was established in the inspected text; this is **absence of a found
  direct conflict, not affirmative permission or a legal guarantee**. Applicability
  of reserved rights to particular metadata/outputs remains unresolved. No
  general attribution/retention licence or redistribution/LLM rights inferred.
- [robots.txt](https://megogo.net/robots.txt), HTTP 200 on the same date, has a
  `User-agent: *` group disallowing, among other paths, search/account/service
  paths and `/*?`. The exact fixed `/ua/view/22027436-dyuna-chastina-druga.html`
  path **without query** was not disallowed. It is not a licence; no query,
  alternate endpoint or user-agent evasion is added to bypass restrictions.
- **Decision:** no direct applicable conflict or rules-read technical block was
  established, so proceed only within the owner's explicit bounded approval.
  An extraction-time block is a result, never bypassed. Unavailable public API
  docs/affirmative licence do not alone require an email; no email, signup,
  purchase or legal-clearance claim. Future recurring/commercial use requires a
  separate review; costs are unmeasured, not asserted zero.

### Narrow approach and decision gates

Implemented opt-in `megogo-html`: only Dune, `digital-ua`, URL source/Amazon
region unset; default remains synthetic. One owner click consumes one session
token before any await and permits at most one GET. **20-second total network/
body timeout, 2 MiB decoded-response cap**, manual redirects, UTF-8 HTML only,
no retry, cookies, scripts/assets, destinations, endpoints, credentials upstream
or model. API key not required. Existing parser dependency `parse5` is reused
without a new dependency or general crawler/framework. Fixed source is
<https://megogo.net/ua/view/22027436-dyuna-chastina-druga.html>, expected native
ID `22027436`; existing catalogue TMDb `693134`, IMDb `tt15239678`. No TMDb call.

The source-specific parser supports declarative [Schema.org Movie](https://schema.org/Movie)
and [Offer](https://schema.org/Offer) JSON-LD (including optional labelled
PropertyValues), and labelled `dt/dd` / two-cell table fields in a unique main
with matching H1. These standards document the grammar, **not what MEGOGO's
current HTML actually contains**. No live page/markup inspection or validation
was performed. Unknown layouts, multiple film objects, malformed embedded JSON
or missing fields stay unresolved/partial/unsupported; there is no JS evaluation,
endpoint probing or account fallback. Source-native ID/title/year or exact
IMDb establish identity; supplied native/TMDb/IMDb conflicts block attribution.
Configured IDs alone do not constitute retrieved identity evidence.

### Acceptance, stop criteria and future test plan

UI shows fixed source/film/mode/operation, limits and fetcher geography **unknown**
before click. Projection/display is text-only, no raw HTML or executable/linked
content. Source/receipt time/retrieval/identity statuses and field evidence
kind/locator accompany reported, unknown and conflicting values. Literal
public-card claims and individual JSON-LD offers remain separate, with no
cross-offer track/format propagation. Language clauses must bind codec/channels
or subtitle types explicitly; list completeness remains unknown. HD does not
exclude 4K, UHD does not imply HDR10/DV, and locale is not codec. Price requires
explicit amount and ISO currency. No historical owner facts are substituted.

**Public characteristics are separate from account entitlement:** expose
supported page fields even without login proof; account entitlement stays unknown.
Regional messages and explicit eligible/ineligible regions are source claims
with evidence, not a geolocation/entitlement verdict. `/ua/`, interface language
and LAN RFC1918 IP establish neither UA viewing rights nor egress region. No
geolocation request is made; server HTML may differ from owner Safari in Ukraine.
Missing fields do not prove absence, and public access is not verified playback.

Authored synthetic tests cover identity matched/mismatch/unknown and stable-ID
conflicts; partial/missing/conflicting fields, per-language formats, subtitle
types, separate access/package/price offers, explicit regions, unsafe text,
malformed JSON, redirect/403/429/451/CAPTCHA, timeout (headers and body), size
limits and unsupported content/UTF-8; one-shot/auth/Host/Origin and no follow-ups.
Browser checks use mock responses at 390×844, not real iPhone validation;
Windows lifecycle uses temporary copies and mock-only transport, not owner demo.
Parser absence is explicit before a live fetch. Do not equate mocks/public-rules
reads with live extraction validation or promise needed fields will be found.

**Original owner plan (now attempted): at most one live GET Dune**, using the
[standalone Termius/Safari workflow](iphone-windows.md#megogo-initial-html-owner-workflow).
No compulsory synthetic/SSH-disconnect repeat or streaming-app tour: those
mechanics are unchanged. The owner reported parse-policy rejection, documented
below; the subsequent approved [acceptance-policy iteration](#megogo-html-acceptance-policy--scoped-recovery-v1)
prepared one final GET, subsequently attempted. The [v2 correction](#megogo-duplicate-attribute-scope--offline-correction-v2)
does not start another manual cycle. Stop on blocks/identity ambiguity/
unsupported or JS/login-only fields; do not retry or expand endpoints. Offer
characteristics remain unvalidated; no general accuracy conclusion.

### Implementation checks — October 18, 2026

- **215 offline/HTTP tests passed**, zero failures/skips, including 27 MEGOGO
  cases and the existing 22 Gemini-body golden regressions. Existing adapters,
  prompts/model/settings/dependencies and production were not changed.
- Full sequential Edge/mobile regression: **102 passed / 7 skipped** (six absent
  WebKit engines, optional explicit-IP LAN not configured), zero failures. A
  final standalone MEGOGO rerun: 8 passed / 1 absent-WebKit skip. Initial parallel
  browser invocation stalled and was interrupted, not counted as success;
  cause not isolated. Sequential/standalone runs passed without weakened checks.
- PowerShell 7 temporary-copy lifecycle passed for MEGOGO and all six previous
  configurations: parent-exit survival, fixed switch inheritance, duplicate
  start, forged/unrelated PID refusal, safe stop/restart. MEGOGO mock-live restart
  needed no API key, made one mock GET, and rejected replay. Owner demo untouched.
  Actual SSH disconnect, real iPhone/WebKit and PowerShell 5.1 were not rerun;
  earlier owner workflow validation is separate evidence.
- 135 local links / 102 anchors valid across eight Markdown files; scope/diff/
  whitespace checked. Only isolated demo files changed; existing untracked
  `research/media-discovery/` preserved. No full source/body/credentials archive.
- No live MEGOGO extraction, API call, destination request, system change,
  merge/tag/release or deployment. Public rules/robots and schema documentation
  reads only; these are not extraction validation. MW-FUT-01 remains Discovery.

### MEGOGO owner failure — parse-policy diagnosis

**Historical diagnostic-only checkpoint `03a472e`.** The no-tolerance-expansion
decision below describes that commit, not the current policy. Superseded by the
separately approved [scoped acceptance policy](#megogo-html-acceptance-policy--scoped-recovery-v1).

Review baseline #181 `abc2bba`, base #180 `b9f3c65`, rechecked open/unchanged
October 18, 2026. [Owner-reported result](digital-ua-owner-validation.md#megogo-initial-html--owner-run-parse-policy-rejection):
HTTP 200 / unsupported-markup / ambiguous-html-tokenization, all unknown.
No independently retained/read body, exact parser code or executed commit trace.
No live GET, repeat owner request, raw archive or provider/endpoint probe.

**Exact branch:** `extractMegogo()` called parse5's `onParseError`, retained only
the first 20 codes, and returned `unsupported-markup` if **any** differed from
`missing-doctype`. That return preceded all canonical/title/ID/JSON-LD checks.
Thus unknown identity meant **not evaluated**, not a demonstrated mismatch;
unknown fields did not prove their absence. The string claimed tokenization
ambiguity without knowing the error kind, scope or resulting card identity.

**What is proven:** the diagnostic conflated different failures and discarded
the information needed to distinguish them. Authored offline fixtures reproduce
the same old symptom with (a) a legacy HTML 4 DOCTYPE (`non-conforming-doctype`),
(b) a missing entity semicolon in unrelated text, (c) a duplicate canonical-link
attribute, and (d) an unclosed comment. Clean HTML, permitted omitted `dt/dd`
end tags, and the already allowed missing doctype pass the existing gate.
These are controlled examples, **not reconstructions of MEGOGO's live response**.
Legacy/recoverable syntax is not declared modern-conforming HTML, and a browser's
ability to parse a page is not enough evidence to safely accept it here.

First-party references checked October 18, 2026:
[parse5 ParserOptions](https://parse5.js.org/interfaces/parse5.ParserOptions.html)
describes `onParseError` as an error callback, not an ambiguity/identity verdict;
[ParserError](https://parse5.js.org/interfaces/parse5.ParserError.html) exposes a
code plus locations. The [HTML parsing standard](https://html.spec.whatwg.org/multipage/parsing.html#parse-errors)
defines deterministic recovery for syntax errors. Error existence does not
alone prove multiple possible parses; this does not require this PoC to accept
all recoverable errors. The installed pinned parse5 8.0.1 implementation was
also inspected: legacy doctype errors arise in tree construction, so the old
generic **tokenization** label was additionally misleading.

**Minimal proven fix, not a parser-tolerance expansion:** label the issue
`html-parse-policy-rejection` and return `diagnostics` with policy/stage,
`identityEvaluation: not-run`, total error count and counts per fixed parse5
enum (unrecognized code gets a fixed fallback). Aggregate all events rather than
losing those after 20; storage is bounded by the fixed code vocabulary, not body
size/content. Only on rejection add bounded parsed-tree counts for main/H1,
canonical links and JSON-LD blocks plus an allowlisted document-mode enum.
Tree-limit failure is a fixed structural-unavailable status, not an exception
dump. No text, JSON values, attribute values/names, URLs, source excerpts,
positions or environment/credentials enter diagnostics. Display is text-only,
transient/no-store, with no logging/storage/background or additional requests.

**Unchanged safety:** reject every parser error except the pre-existing
`missing-doctype` allowance; no new code bypass. Identity/stable-ID conflicts,
CAPTCHA/geo/size/depth controls, extraction grammar, fixed URL, one-shot auth,
20s/2MiB/one-GET budget and all other adapters remain unchanged. A diagnostic
structural count is not identity evidence. No existing live claim is filled in.

**Uncertainty boundary / shortest next test plan:** the exact original parse
error, whether the returned document was the expected card, and whether any
particular error is safe to tolerate remain **unestablished**. Old codes cannot
be recovered without a retained body (none requested/stored). No new owner run
is requested. Offline fixtures/mock HTTP and mobile display verify the corrected
diagnostic and unchanged rejection/one-shot/security behavior. For a future
**separately authorized** continuation, the minimum needed evidence is only
the structural diagnostic summary (stage, code counts, structure), not HTML,
raw JSON, personal/account data or streaming-app retests. Decide any narrowly
justified parser change only after that; do not assume this commit fixes the
unobserved live layout. MW-FUT-01 remains Discovery.

Targeted regressions failed before the diagnostic correction (two failures:
wrong generic reason and absent diagnostic; the clean/optional-end-tag control
already passed). Final **220 offline/HTTP tests passed**, including **32 MEGOGO**;
targeted Edge/mobile suite **9 passed / 1 absent-WebKit skip**, no failures.
Mock HTTP proves rejection yields one GET and blocks replay, with no body/marker
leak; browser checks text-only diagnostics, no external requests/storage/logging.
No Windows lifecycle rerun: helpers/native transport/session/network behavior
unchanged. No real iPhone, live request, owner process stop or system change.

### MEGOGO HTML acceptance policy — scoped recovery v1

**Historical checkpoint `06c69ef`.** The owner has now reported its second
attempt. Attribute/tag/count rules below are superseded where noted by the
[offline v2 correction](#megogo-duplicate-attribute-scope--offline-correction-v2);
the final owner plan below is completed, not a new test instruction.

Approved follow-up on #181 `03a472e`, base still #180 `b9f3c65`. A blanket
conformance gate is **not treated as an intrinsic security requirement**. The
parser's deterministic DOM is the read model; warnings neither establish nor
refute identity. No attempt to infer the original owner-run error from mocks.
This implementation is live-unvalidated and prepares one final owner GET, not
an intermediate diagnostic request or a general crawler/production parser.

The [HTML parsing standard](https://html.spec.whatwg.org/multipage/parsing.html#parse-errors)
and [parse5 options/locations](https://parse5.js.org/interfaces/parse5.ParserOptions.html)
were rechecked October 18, 2026 against pinned 8.0.1 behavior. parse5 handles
recovery; no string repair/reparse, JS, assets, endpoints or network discovery.
Source locations are internal only: match parser errors to parser-produced
start-tag/comment spans, using the same offset system (Unicode fixture covered).
No byte-offset/JavaScript-index conversion, source snippets or positions returned.

| Condition | Minimal action / rationale |
| --- | --- |
| Missing or non-conforming legacy DOCTYPE | Warning. Parsing mode recorded, not treated as film evidence. No layout/CSS/browser script is executed, and explicit identity checks still apply. |
| Missing semicolon after character reference | Warning; use parser-decoded DOM text/attributes, never guess the author's intended spelling. Validated field grammar and text-only display remain mandatory. |
| EOF in comment | Comment is never data. Completed independent fields can survive; a field/H1/year node containing or affected by the unfinished comment is refused. Text swallowed into the comment is not reconstructed. Trailing comment outside used nodes does not veto identity. |
| Duplicate HTML attributes in a supported field/value/label subtree | Unknown for that entire card field, including competing card-level representations; no first/last/equality guess. A tainted quality field also withholds HDR10/DV derived from that label. Other independent fields/offers survive. |
| Duplicate attributes on html/head/body/main, H1, link or script, or recovery touching identity ancestors/year evidence | Page-level refusal/identity unknown: the discarded attribute could alter card visibility/scope or hide rel/href/type/identity. Do not reconstruct discarded values or use another identity source to wave away that ambiguity. |
| Duplicate attributes outside all used fields/identity | That subtree is not evidence. No regional claim from its ambiguous text; independent card fields can still be reported. Warning/scope-check remains visible. |
| Malformed JSON-LD | Ignore that block, record issue/count; no repair or eval. Independent visible evidence can establish identity/fields. Unsupported/missing block content is not negative availability evidence. |
| Duplicate JSON object keys, including escaped equivalent names | Page refusal: JSON.parse otherwise silently selects a value and could hide a stable-ID/title conflict. No key-level scope guarantee, so do not guess which discarded value mattered. Object scopes are independent; identical key names in separate objects are allowed. |
| Truncated tag, null replacement, or any other unreviewed parse recovery | Explicit unsupported recovery/page refusal. These can discard attributes/elements, change text or boundaries; this small adapter has no reviewed field-scope mapping for them. Not a claim that every such document is malicious or that all standards recovery must be refused. No automatic accept-all list. |
| Unlocated scoped error, >256 location events, depth/node/byte limits | Explicit page refusal: bounded analysis cannot reliably bind damage to evidence. No guessing or limit increase. |
| Conflicting explicit native/IMDb/TMDb IDs, title, multiple card scopes | Identity mismatch or unresolved as appropriate; no fields attributed. Check both supplied Movie URL and @id, not a preferred one. Parse warnings do not override the gate. |

The unchanged native-ID/title/year-or-exact-IMDb matching criteria run **after**
the scope policy, independently of warning count. Multiple mains/H1s or tainted
identity evidence stay unresolved rather than selecting a convenient node.
Observed IDs, not configured constants, provide evidence. Dates alone do not
explain away stable-ID conflicts. No confidence score or new identity discovery.

Duplicate visibility attributes cannot hide a competing label from quarantine:
the bounded raw tree is consulted **only to find potential fields to withhold**,
never to turn hidden/untrusted text into positive evidence. A possibly hidden
year/H1 stays an identity-scope refusal. No regional claim is taken from a
tainted subtree. These checks do not broaden supported field selectors.

`diagnostics` now accompanies every successfully parsed result, **including
useful fields**: `scoped-recovery-v1`, decision, evaluated identity status,
fixed parser-code counts/actions, parsed-tree counts/mode, field/page refusals,
ignored malformed-block count. A parse/structure-limit outcome has fixed refusal
diagnostics. No body/text/attributes/URLs/positions/exception dump/credentials in
diagnostics. Error counters have a fixed vocabulary; private scope events are
bounded to 256. JSON key/depth checking uses validated JSON tokens in memory,
no new dependency; no repair or evaluation. Display remains text-only/transient.

Unchanged: fixed source, one action → max one GET, 20s / 2 MiB, no redirects,
retries, login/cookies, follow-ups, scripts/assets, persistence, response logs,
LLM/TMDb/MOTN or production integration. LAN auth/Host/Origin/session controls
and Windows helpers are unchanged. No owner process stopped; no system changes.
Malformed metadata/unsupported layout may still yield unknowns: no promise this
policy will expose fields absent from MEGOGO's initial HTML or prove entitlement.

**Final owner plan:** use the existing [standalone restart](iphone-windows.md#megogo-initial-html-owner-workflow)
on the correct updated branch, hidden LAN password/no API key, Safari username
`demo`. At most **one live GET Dune**. Read useful/new/missing/conflicting fields
and the structural decision/code counts/refused fields **in that same result**.
No separate diagnostic-only run, automatic retries, compulsory synthetic/SSH
disconnect repeat or streaming-app tour. Request only the short summary, not
HTML/raw JSON/screenshots. A page refusal/unknown is a final finding for this
run, not a reason to request another immediately. Agent makes no live GET.

Acceptance-policy checks: **228 offline/HTTP passed**, including **40 MEGOGO**;
targeted Edge/mobile **11 passed / 1 absent-WebKit skip**, zero failures. Tests
cover recoverable warnings with useful fields, field-only/page refusals,
duplicate visibility attributes, Unicode scope binding, identity URL/@id and
stable-ID conflicts, malformed/duplicate-key JSON, >256 event bounds, combined
one-request HTTP result and replay rejection. No content in diagnostics/logs,
DOM execution, persistence or destination requests. Existing 22 Gemini-body
goldens and other adapter regressions pass. No Windows lifecycle rerun: helpers/
native launch/auth/transport are unchanged, no new module imports for temp copies.
No real iPhone or live extraction validation; owner demo remains untouched.

### MEGOGO duplicate-attribute scope — offline correction v2

Review baseline #181 `06c69ef`, open on #180 `b9f3c65`, rechecked October 18,
2026. [Latest owner summary](digital-ua-owner-validation.md#second-owner-attempt--30-duplicate-attributes-identity-not-evaluated)
reports 30 duplicate-attribute events, canonical/JSON-LD/two H1s and a pre-identity
refusal. No body, attribute names/values/locations or heading contexts retained;
no live read, owner repeat, hidden request or reconstruction performed.

**Exact old identity scope:** the v1 immediate veto included any duplicate on
`html`, `head`, `body`, `main`, `h1`, `link`, `script`, without examining the
attribute's role. A second gate included every link/script and main-subtree H1,
plus labelled year evidence and their touched ancestors/descendants; >1 main
or >1 usable H1 also vetoed before identity evaluation. Thus a decorative class
on a canonical link/script or two agreeing desktop/mobile-style headings were
enough to stop the page. Scope membership was not evidence of a real conflict.

**Proven policy defects fixed:** four new authored regression cases failed on
v1 before changes (decorative link/script class, agreeing H1s, visibility-held
evidence with independent JSON identity, and missing significant-attribute
classification). They pass with v2. Fixtures are authored, **not a reconstruction
of the 30 live events**. The previous diagnostics cannot establish which
attributes actually occurred or whether the live H1 texts agree. Therefore:
the over-broad policy defect is proven/fixed, while actual MEGOGO compatibility,
identity and offer usefulness remain **unresolved**. No new owner test is started.

| Attribute/evidence context | v2 action and reason |
| --- | --- |
| Duplicate class on link/script/meta | Not an input to canonical/JSON-LD/meta interpretation in this adapter; record a fixed decorative-class count, do not veto identity. No claim about visual appearance/CSS, and no permission for other duplicate attributes. |
| Class elsewhere | It affects this adapter's inert/visibility filter. Quarantine dependent H1/year/fields and regional claims, not blindly accept either class value. Clean canonical/JSON-LD can still be evaluated. A possibly contradictory quarantined H1/year keeps overall identity unknown. |
| href/rel/type or another non-class duplicate on document/card/identity boundaries | Withhold the affected node and dependent identity evidence. Check other unambiguous signals, but significant ambiguity keeps overall identity unknown; never pick the first attribute or let an agreeing JSON block erase the unresolved source. |
| Meta content or native-ID-like duplicate (`data-id`, `data-movie-id`, `data-film-id`, `data-video-id`) | Not classified decorative. Overall identity unknown, independent evidence still inspected. These names are conservative role hints, not newly implemented positive meta/native-ID extraction or proof which identity a value describes. |
| Duplicate confined to another supported field | Only that card field stays unknown; no competing representation chosen. Independent identity and unrelated fields/offers remain separate. |
| Several usable H1s | Compare **all**, never choose the expected one. All agreeing expected names can support identity/one main's field context. An explicit unambiguous title/ID conflict remains mismatch; unresolved multi-main/movie scope still withholds overall identity. Count alone is not conflict. |
| Unknown/foreign attribute-name mapping, unsupported recovery/location limits | No general acceptance. Quarantine unknown attribute scope or retain explicit page refusal when even scope cannot be bound. Existing 256-event/depth/node/byte bounds preserved. |

Attribute classification uses the installed parse5 tokenizer's duplicate-name
error position and the **same start tag's already tokenized attribute names**.
Only a bounded ASCII-name suffix match is used, case-insensitively; the discarded
value is not parsed, reconstructed, compared or returned. Unmatched names are
not assumed harmless. Quoted/unquoted/boolean attrs, mixed case, Unicode before
the tag and misleading attribute-like text inside values are covered. No raw
name/value/offset is exported: diagnostics add fixed role counts and usable/
quarantined-source counts only. No new parser dependency or source acquisition.

`identity.independentStatus` describes clean observed signals; `identity.status`
remains the overall gate. A significant ambiguity can yield independent matched
**and overall unknown**; it never releases offer fields or proves availability.
All clean stable-ID/title conflicts still defeat matching; no ID is supplied
from configuration when ambiguous canonical evidence is withheld. Both statuses
are labelled separately in text-only display. Malformed/duplicate-key JSON,
CAPTCHA (including quarantined visibility text), no-store/auth/one-shot/bounds,
no persistence/execution/follow-up requests and other adapter behavior remain
protected. No owner process, Windows helper or production changes.

Checks: **234 offline/HTTP passed**, including **46 MEGOGO**; targeted Edge/mobile
**12 passed / 1 absent-WebKit skip**, zero failures. Four failures reproduced
before correction, then authored case and security regressions passed. The suite
also confirms significant href/content/native-ID ambiguities stay withheld,
independent evidence cannot override conflict/missing IDs, decorative class is
not a global class exemption, H1 disagreement is not selected away, one-shot
and no destination/storage/content logging remain. No Windows lifecycle rerun
(helpers/config/transport unchanged), real iPhone or live extraction check.

**Stop/manual plan:** no GET, owner restart, synthetic/disconnect cycle,
diagnostic request, app-card tour or body/screenshots required now. Preserve
the owner's report as unresolved evidence. Any future live step requires a
separate decision; this commit is not an automatic testing loop.

### Architecture conclusion boundary — no new integration

The [completed source comparison](digital-ua-owner-validation.md#cross-source-complementarity--observations-not-independent-entitlement)
already supports drafting the architecture conclusion without resolving MEGOGO:
TMDb contributes identity/catalogue text and country access signals; MOTN adds
candidate URLs/access types with known characteristic/currency limits; Kinobaza
adds URLs with explicit/unknown territory and shared JustWatch lineage. These
are complementary observations, not entitlement truth or independent corroboration.
MEGOGO remains an optional unresolved direct-characteristics research source,
not a prerequisite to define source/field provenance, unknowns/conflicts and
manual account evidence in the [design-only shared model](#shared-offer-observation-model--design-only).
No automatic adapter, aggregation/runtime model, discovery→fetch pipeline or
implementation handoff is authorized by that conclusion. MW-FUT-01 remains Discovery.
