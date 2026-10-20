# M4 — Mykola media advice

Status: implementation in progress; default off; no live activation authorized.
Canonical implementation record, not a second research architecture. Evidence and
source boundaries remain in [research proposal](../research/grounded-answer-demo/docs/regional-card-proposal.md).

## Reviewed baseline and sequence

`develop` acbdadf8efa2d180a12ed3fc85aa7784bb681782 (2026-10-20).
Existing static add/edit form writes only on Save; no feature-capability system
exists. Group owner/member may edit; visitors may not. Migration files 001–016
are historical evidence, not proof of their deployed state. Owner checkout is
excluded from implementation.

1. **M4.1** isolated accessible form dialog, source-row selection, explicit
   medium/URL diff and local-only transfer. Capability fails closed until M4.2.
   Authored fixtures exist only in tests. No social-chat controller reuse.
2. **M4.2** authenticated Netlify boundary, backend-only per-user assignment,
   independently gated TMDb/MOTN and atomic technical ledger. New SQL only;
   migration application/production flags/secrets require separate authorization.
3. **M4.3** replaceable Brave Web Search resolver, ≤2 queries and ≤2 sequential
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

## Source use and activation

Implementation/offline checks are not live validation or rights clearance.
No source/rules GET is authorized here. Existing dated research reviews do not
grant blanket production or arbitrary-card permission. Before live activation,
a separately authorized preflight must check current TMDb, MOTN, Kinobaza and
Brave terms, attribution, transient projection/transfer and permitted access.
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
Global source deadline 55s; individual existing transport bounds still apply.
This is an operational bound, not a measured latency target. Hosting duration
must support it before activation; timeout consumes reservations, no refetch.

Migration `20261020205122_media_advice_access_ledger.sql` was created using
Supabase CLI 2.121.0. It creates only a new private schema, default-off permission
assignments, technical sessions and restricted RPCs. New tables have RLS and no
anon/authenticated privileges; RPCs are service-role only. An advisory transaction
lock serializes a user's new sessions and reservations; no lock spans source I/O.
Per form session: one action; fixed stage names each reserved at most once,
maximum eight. Per user: twenty sessions per rolling 24h (including expired
30-minute sessions). Errors/lost responses consume reservations. No response,
HTML, credential or chat persistence. No session replay/result recovery.

Retention: delete technical rows after 24h via daily service-only
`media_advice_cleanup()`; same-user opportunistic cleanup also runs on actions.
Daily cleanup scheduling is an **activation prerequisite**, not an installed
production job; without it idle rows can remain longer. Permission assignments
persist until an authorized administrator revokes/removes them. No assignment
is seeded. No global historical RLS repairs or production migration commands.

Local validation uses PGlite 0.5.10 (test-only PostgreSQL/WASM), minimal authored
prerequisites, and this new SQL only. It proves SQL execution/privileges/replay,
not production migration history or native multi-connection/load behavior.
Docker/native PostgreSQL are unavailable here; native isolated multi-connection
validation and actual migration-baseline reconciliation remain pre-activation work.

Server configuration (no values in Git): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `TMDB_READ_ACCESS_TOKEN`, `MOTN_API_KEY`;
M4.3 additionally `BRAVE_SEARCH_API_KEY`. Secrets are not arguments/URLs/UI data.
No configuration is changed by these PRs. Approved TMDb logo/complete current
attribution and applicable commercial/source-use terms must be checked during
activation preflight; text attribution and source links remain visible now.
