# MW-FUT-01-M3 handoff: arbitrary-film discovery

**M3.1 subsequently approved/implemented for bounded isolated research** after
#187 `eb21427a325c8331bddfb1dd05c17d4db5c96cac`. **M3.2, live preflight/evaluation,
merge and production remain Proposed / not authorized.** The13 sections retain
the design; the [implementation record](regional-card-proposal.md#m31-bounded-implementation--authored-checks-only)
states the actual M3.1 boundary and authored verification. No new owner cycle.
October20,2026. MW-FUT-01 remains Discovery. The
[canonical M3 decision](regional-card-proposal.md#m3-arbitrary-film-discovery--proposed-design-only)
owns architecture, source-use evidence, metrics and trade-offs; this file is the
reviewable task boundary, not a parallel specification. M3.1 is implemented in
a separate child PR; M3.2 still requires approval. Automatic Kinobaza search
is not a verified dependency.

## 1. Context

Fetched research develop `09c9482694b37f16fb0371f6d2fca790167a31b0`, tree
`81f08f63033ae7f5cb612e42cc6eb7e9fe281e99`. #184–#186 are merged;
launcher fix and R1/R2 are ancestors. Main remains e923928. M1/M2 and the
deterministic Ukrainian answer use six fixed films. A explains existing source
identity gates; no positive cross-source B benefit demonstrated. B expansion/
reserved probe deferred, C/D/automatic enrichment absent. Prior owner outcomes
are dated source observations, not runtime attestation or general accuracy.

## 2. Objective

Remove per-film code registration for TMDb/MOTN and propose a separately
controlled Kinobaza card-selection step. User searches a title, selects and
confirms the correct identity, receives separate source claims, then explicitly
selects/reviews/confirms one row into an editable page-memory draft. No production
Movie Wishlist write/transfer. Useful partial results need neither B equality nor
complete source coverage. Prove user benefit, not synthetic matching success.

## 3. Current implementation

[Verified-component map](regional-card-proposal.md#decision-and-verified-implementation-gap)
records actual files/functions and fixed assumptions. `config.mjs`/`held-out.mjs`
define fixed films; server `/session?film=` binds one filmId to the consumed
`/answer` token. TMDb/MOTN projections and matching consult fixed expected IDs;
Kinobaza structural identity has explicitly reviewed title/director aliases.
Report labels and draft metadata also use fixed catalogue lookups. Changing
only the picker would be incomplete and unsafe.

Production `netlify/functions/movie-search.js` fans external-ID requests over
up to8 results; `movie-lookup.js` selects the first find result. Both are context,
not imports/proxies or M3 behavioral templates. Never call production endpoints.

## 4. Scope

- **M3.1 PR:** explicit bounded TMDb text search, candidate preview and user
  confirmation, validated dynamic identity/crosswalk context, TMDb UA/MOTN
  discovery, existing separate-row answer/draft/report. Kinobaza not evaluated
  for dynamic selections. Six fixed controls and all older modes preserved.
- **M3.2 separate PR, product choice pending:** assisted ordinary public-UI
  selection of one exact canonical Kinobaza source card, controlled server
  admission, identity gate, then existing extraction from the same HTML.
  No per-film catalogue registration/provider-link entry. Automated native
  search is not included; explicit search-path robots exclusion must not be
  bypassed. Resolver failures leave M3.1 results usable.
- Optional posters deferred initially; selected preview displays returned
  directors. No per-result credit requests or assets required for selection.

## 5. Non-goals

No production frontend/backend integration, Supabase/schema/writes, cache/DB/
queue, persistence, LLM, new aggregator/search provider, authenticated workers,
MEGOGO debugging, automatic card crawl, B/C/D engine, ranking or cross-offer
enrichment. No provider/tracking destination requests, account/cookie transfer,
raw source archive or historical owner controls substituted as current facts.
No successful resolver/track/full-six-platform coverage prerequisite for M3.1.

## 6. Functional requirements

Use the canonical [selection/gate flow](regional-card-proposal.md#proposed-search-selection-and-independent-gates)
and [resolver states](regional-card-proposal.md#kinobaza-search-feasibility-and-resolver-decision):

1. Explicit search only, query2–160 safe Unicode characters, optional year,
   movie-only page1, max8 results. Never auto-select first result. Show safe
   original/localized titles and date/year; preview returned directors, then
   explicit confirm. Missing identity metadata is visible, not fabricated.
2. Match selected root TMDb ID and any supplied stable IDs. Obtain IMDb only
   from validated Details/external IDs; conflicting values reject that crosswalk.
   Conflicting supplied IDs prevent confirming that TMDb context, not just
   deleting one disagreeing field. Missing IMDb → MOTN not evaluated,0 calls.
   Year variance alone cannot override
   exact consistent IDs; a structural-only ambiguous year does not prove identity.
3. Reuse the confirmed preview projection rather than refetching Details.
   Provider/MOTN failures and returned-ID conflicts gate their own source.
   No crosswalk snapshot exists after a failed first preview: do not guess one.
4. Search/select a new film without restart. Immediately revoke old tokens and
   clear results/review/draft/report, abort work and ignore stale/late responses
   and clipboard callbacks. Same-film cancel preserves edited confirmed draft.
5. Kinobaza matched/ambiguous/not found/unsupported/unavailable are distinct;
   disabled/pending and mismatch reasons also explicit. Manual no-card is an
   owner report, not an automated global absence finding. No card is a guarantee
   of UA availability, provider audio or entitlement.
6. Preserve film/block/country/link observations and shared JustWatch lineage.
   No platform-name merge of tracks/territory. Literal prices/quality remain
   source assertions; default draft exclusions, exact URL and ack unchanged.
7. Short report extends safe selected-identity/phase-count/outcome labels, not
   arbitrary serialization. Bounded sanitized chosen title/year/IDs may identify
   the run; exclude queries, raw URLs/tokens/HTML/credentials/draft input. Commit
   unknown unless reliably attested. Clipboard fallback and stale protection stay.

## 7. Technical constraints

Keep server-side credentials, localhost/opt-in LAN Basic Auth, exact Host/Origin,
no-store/CSP/text-only display, current source bounds/timeouts and cancellation.
Separate search, preview and discovery capabilities; one-shot consumption before
await per action, bound to current session/generation/selected identity.
Session state is bounded transient projected request context, not a cache;
at most8 candidates/2 previews,30min maximum TTL and existing session-count bound.
Enforce phase counters and final exact per-run URL allowlist server-side.

Arbitrary film never means arbitrary URL fetch. Generate TMDb numeric and MOTN
validated IMDb API paths on their exact existing hosts. Assisted M3.2 accepts
only a source-card proposal: exact canonical HTTPS Kinobaza host, one root title
slug, no userinfo/ports/query/fragment/encoded slash/dot path/subpage; issue an
opaque run-bound candidate reference. Revalidate before its one GET; response
canonical must agree. No new redirects/retries/destinations. Old fixed request
bodies/conditional canonical hop remain unchanged. No new dependencies without
demonstrated need. Source-specific prohibition/block stops that live path.

## 8. Approach

Incrementally parameterize pure request builders/projectors with an immutable,
server-owned expected identity while keeping wrappers/goldens for fixed controls.
Reuse existing append projection, MOTN normalization, source composition, URL/
provider policy and Ukrainian presentation. Do not place editable client-supplied
expected IDs or aliases directly into validators. Preview proves the context;
the browser sends only opaque selection/candidate references, not URLs to fetch.

M3.2 adds at most one run-bound one-shot stage to the same identity/counters,
even if selected later; do not repeat TMDb/MOTN or overwrite a same-film draft.
M3.2 requires a separate admission/identity policy review. Reuse `parse5` and
localization extraction only after identity; no per-film alias patches or nearby
text inference. Unestablished director transliteration remains ambiguous.
Native public search UI exists, but request/result protocol not established and
robots excludes search. No automatic API/export found, not proof none exists.
[Feasibility options and first-party evidence](regional-card-proposal.md#kinobaza-search-feasibility-and-resolver-decision)
must be reviewed before any different resolver. No new local route/component
names are mandated until implementation inspection.

## 9. Verified components

All paths relative to this demo:

- `config.mjs`, `held-out.mjs`, `server.mjs`: catalogue, film binding/assets,
  credentials and consumed-token controls.
- `tmdb.mjs`, `motn.mjs`: fixed-ID builders, bounded transport, projections/gates.
- `html-source.mjs`, `kinobaza-localization.mjs`: fixed root cards, narrow hop,
  structural identity and own-block properties/country links.
- `discovery.mjs`, `matching.mjs`: exact planned URL set/budget, independent
  stages, namespaced provider-ID quarantine and auxiliary A/B.
- `public/discovery-client.mjs`, `public/discovery-report.mjs`, `public/style.css`:
  deterministic separate rows, selection/draft/copy/reset.
- `windows/Start-Demo.ps1` and sibling helpers, `test/windows.test.ps1`:
  hidden credentials, detached lifecycle and isolated dependency-copy checks.
- Existing `test/held-out.test.mjs`, `test/held-out-browser.test.mjs`,
  `test/checkpoint-audit.test.mjs`, `test/matching.test.mjs`,
  `test/discovery-report.test.mjs`, `test/m2-browser.test.mjs`,
  `test/mykola-browser.test.mjs`: extend authored controls, not live fixtures.

No production file/module imported; no new hosting or storage assumed.

## 10. Acceptance criteria

Functional/security invariants in sections6–7 and all existing fixed controls
must pass authored tests. Changing selected film invalidates previous request
and UI state; a conflict cannot be user-overridden into matched. Rendering,
copy and offer selection/draft add0 requests; explicit search/identity-preview
and resolver actions consume their separate counted budgets. Kinobaza failure does not mask good
TMDb/MOTN. No track/price/video repair, C/D join or best/verified badge.

Future [evaluation matrix/metrics](regional-card-proposal.md#eight-film-evaluation-matrix-and-measurable-acceptance):
8 nominated films; **0 false assignments is mandatory**. Ratios of6 usable
selections,4 cases with eligible links/choices, and assisted M3.2 at least4
matched cards and2 added useful hints, otherwise defer. Unknown/missing cases
stay in denominator. These product thresholds need approval before execution;
they are usefulness hypotheses, not permission to repair data, replace failed
cases or call absent offers an implementation defect. They are not current
coverage facts or confidence scores. Max3 independent
manual link checks, scoped source claims separate from verified correctness.

## 11. Test plan

Agent: authored offline/HTTP/browser mobile tests for aliases/remakes, conflicts,
missing IMDb/partial metadata, no first-result/fan-out, counters and exact URLs,
host/path/redirect attacks, dynamic identity/report/draft clearing and stale
callbacks, R1 Apple `at`/tracking ack, R2 namespace consistency, localization
scope, exact href, draft exclusions/confirm/edit/cancel, safe report fallback.
Run existing regression suites; mock sources, no live traffic. Windows lifecycle
only for actual module/key-routing changes in temporary copies; owner demo untouched.

Future authorization budgets are separate, [canonical arithmetic](regional-card-proposal.md#separate-request-budgets--proposals-not-executed):
preflight max28 (TMDb search8/identity8/cards8/rules4), no native Kinobaza search.
Per-film M3.1 search
normal1/max2 +identity1/max2 +resolver0 +discovery2 =normal4/max6; assisted M3.2
adds1 direct source GET =normal5/max7. Eight cases32/max48 or40/max56. Missing
crosswalk/candidate reduces usage; no retries/replacements. Human site UI and
max3 explicit link opens are separate/unmeasured browser traffic, not source APIs.
No API calls are authorized by this handoff.

One future Termius→Safari session, no restart per film, short copy summaries,
one dynamic-draft semantic check only if needed; no repeated six-platform tour.
Predefined3-link sample/time limit and stop criteria are canonical. Search/card
failures are findings, no automatic second owner cycle or synthetic/SSH-disconnect
repeat. Stop on unsafe request/false identity/stale draft/leak/block/cap/time limit.

## 12. Documentation updates

Update existing README, this handoff's status and canonical proposal/roadmap with
implemented versus mocked versus evaluated evidence. Future owner ledger entries
must be attributed and exclude raw responses/screenshots. Preserve historical
six-film observations and P3 debt, unresolved MEGOGO and source-use distinctions.
Do not claim TMDb catalogue localization means provider tracks, robots means
licence, or the prior fixed-card scope clears arbitrary search. Source-use review
and product choice for assisted resolver are explicit gates, not new runtime
acknowledgement switches or mandatory emails due only to unknown rights.

## 13. Git workflow

After separate approval, fetch/instructions/dirty-tree check and create M3.1
feature branch from actual develop, isolated from owner demo/untracked files.
Actual M3.1 implementation is stacked on still-open #187, with only the new
implementation diff, per subsequent owner authorization. Review-only path;
M3.2 separate child PR only after its scope is
approved, use actual stack/base without duplicate diffs. Pin reviewed/tested SHA
and report checks/skips, scope, source rights and pending evaluation separately.
No history rewrite/force, merge/retarget/tag/release/deployment/system changes.
Stop review-ready; neither this proposed task nor future implementation consent
authorizes live preflight/evaluation or production integration.
