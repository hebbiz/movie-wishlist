# M4 — Mykola media advice

Status: M4.1–M4.3 implemented; narrow #192 blocker fixes validated locally;
default off; no live activation authorized. Pilot preparation is conditional on
independent review and the activation prerequisites below, not a pilot approval.
Current search provider: **Tavily basic Search**, candidate URLs only,
offline-tested/live-unvalidated; no activation authorized by this record.
Gemini Google Search Grounding remains excluded from URL → HTML extraction.
See [Tavily decision/configuration](#tavily-search-replacement-2026-10-21),
the historical [Brave decision/data-flow audit](#brave-pilot-provider-decision-and-data-flow-audit-2026-10-21)
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
3. **M4.3 — implemented, mock/browser-tested, live-unvalidated** replaceable Tavily Search resolver, ≤2 queries and ≤2 sequential
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
scope and account-specific Tavily plan/terms, attribution, transient transfer and
permitted access. The dated Tavily review below distinguishes the supported API
path from unresolved end-user licensing. Search does not license destination
content. No application LLM call or full-body archive.
No current production feature assignment, secret or migration is changed.

## Pilot (future, not executed)

No concrete pilot films selected. The single
[execution runbook](#activation--operation-plan-not-executed) defines selection,
activation gates, owner-only access, source-free smoke and the later five-film
pilot; do not substitute research fixtures.

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
providers 1 + MOTN title 1 + Tavily search ≤2 + Kinobaza cards ≤2. M4.2 alone ≤4.
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
M4.3 additionally `TAVILY_API_KEY`. Secrets are not arguments/URLs/UI data.
No configuration is changed by these PRs. Approved TMDb logo/complete current
attribution and applicable commercial/source-use terms must be checked during
activation preflight; text attribution and source links remain visible now.

## M4.3 automatic resolver and UI

No manual card field is required. The swappable search interface uses
Tavily basic Search `POST https://api.tavily.com/search`, with
server-only Bearer authentication. A verified original title/alias, year and
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

### Execution runbook — preparation checkpoint 2026-10-21

**Prepared, not authorized to execute.** One operational runbook; design remains
above. Target: Netlify **develop branch deploy** with existing production
Supabase `mttkectgdqqmejpenkrn`, not a fresh DB. Denys is the deployment/backend
operator. Owner checkout/demo is excluded. Every mutating step below requires
the next explicit authorization; do not run commands merely because documented.
The five pilot films are **not selected**.
**Execution hold:** the [recovery checkpoint](#recovery-checkpoint--2026-10-22-blocked)
below is blocked. Do not begin consolidation/auto-deploy or migrations on the
strength of a prepared runbook alone.

### Recovery checkpoint — 2026-10-22 (blocked)

**NOT recovery ready. No backup artifact or restored database was created.**
Inspection time **2026-10-21T21:24:28Z** (2026-10-22 local Kyiv).
PR #195 remained at `c2d38f6740ec4fd6ae7d6615d1e963c3ce9d1740`,
base #194 `bdca14f9a06a6e84297f75917c5b009dbf41fa66` before this
ordinary documentation follow-up. This timestamp is an access check, **not**
a backup/snapshot time; artifact path, size, SHA256 and restore comparisons
are **not available**, not inferred.

Evidence / exact blocker:

- No `pg_dump`, `pg_restore`, `psql`, Supabase CLI or Docker on PATH.
  The existing isolated native PG bundle supplies `postgres --version=17.6`,
  but no dump/restore/psql executables were found in that bundle.
- No PG connection/password/service environment configuration, default Windows
  pgpass or service file was present (presence-only checks, no values read).
  No login/export attempt, empty dump or invented checksum was produced.
- Read-only SQL connector reports role `postgres`, server17.6. This is SQL
  authorization, **not an exportable password/connection or secure streaming
  file channel**. Do not extract it, expose source rows through tool/chat output,
  use server-side files/OS commands, or substitute the Netlify service-role key.
- Catalog-only inspection: public plus auth/storage/realtime and
  cron/extensions/graphql/graphql_public/net/vault schemas exist. Extensions:
  pg_cron1.6.4, pg_net0.20.4, pg_stat_statements1.11, pgcrypto1.3, plpgsql1.0,
  supabase_vault0.3.1, uuid-ossp1.1. M4 schema/history table still absent.
  No user rows, role-password hashes, decrypted Vault values or Storage files
  were fetched. Core PG17.6 presence does not prove Supabase extension parity.

**Required access, no password in chat:** in this project's Supabase Dashboard
→ **Connect → Session pooler**, configure the displayed host, port **5432**,
database **postgres**, user **postgres.mttkectgdqqmejpenkrn** and TLS. Use the
existing DB password via a hidden local prompt or owner-restricted Windows
`%APPDATA%\postgresql\pgpass.conf` / `PGPASSFILE`, not command arguments,
source files, chat or public artifacts. Do not guess the regional pooler host.
Direct connection from Connect is an alternative only when network access is
established. Do not use transaction pooling (6543) for coordinated snapshots.
Do not reset the production password, create roles or change grants under
this authorization. Existing privileged read/export access is needed; a
limited account must fail rather than silently omit RLS-protected tables.
Portable PG17 client tools are also required before export can begin.

#### Backup coverage contract — planned, none captured yet

| Area | Intended protected artifact / explicit exclusion |
| --- | --- |
| Application schemas/data | Logical structure and data for public and every inventoried application schema: tables, sequences, constraints, indexes, functions, triggers, RLS policies and object grants. Inventory explicit exclusions and unreadable objects; no automatic public-only or CLI-default claim of completeness. |
| Auth | Include auth schema/rows and cross-schema references only in encrypted backup; sensitive account/session/password-hash data never enters Git/report. OAuth/SMTP settings, JWT/API secrets and external Auth service configuration are separate, not proven recoverable by SQL restore. |
| Roles/grants | Separate role definitions/memberships without role passwords, plus object ownership/ACL/default privileges. Managed-role permissions may restrict capture/restore: record that gap, do not invent equivalent grants or alter production. |
| Extensions / managed schemas | Archive definitions and exact version/schema inventory; extension binaries, provider-managed services and Vault decryption keys are not supplied by a logical dump. No decrypted Vault export. Core PG cannot automatically reproduce all Supabase internals. |
| Storage metadata | Capture storage schema/rows, buckets/object metadata and policies explicitly, or mark excluded. Metadata is not file bytes. |
| Storage files | Separate authorized object export with private per-object checksums/count/size verification; **not part of pg_dump**. No files copied or empty-bucket claim established in this checkpoint. |
| Project configuration | Netlify/Edge deployments, secrets, DNS, Auth-provider settings, service keys and other external configuration are excluded from this DB checkpoint. A database dump is **not a full Supabase-project backup**. |

Proposed destination, **not created or security-verified yet**:
`%LOCALAPPDATA%\MovieWishlist\Recovery\mttkectgdqqmejpenkrn\<UTC-checkpoint-id>`,
outside Git, owner checkout, visualization/preview roots, OneDrive and published
directories. Before writing data, require owner/SYSTEM-only ACL and encrypted
staging storage (or a validated direct-to-encryption stream) with a separately
secured, tested recovery key. Retained portable artifacts must also be encrypted.
No plaintext
staging in repo/TEMP, transcripts or public CI artifacts. Do not call filesystem
placement or compression encryption. Protected local test data/logs need the
same protection; do not broadly delete user files during cleanup.

#### Resume procedure — only backup and isolated local restore authorized

1. Establish the above private connection and PG17 tools. Recheck database/
   project identity and effective read permissions; no DDL on production.
   Record UTC start/end and a consistent snapshot boundary privately. Use a
   held read-only repeatable-read exported snapshot for the database dump and
   its validation counts so concurrent legitimate writes do not manufacture
   mismatches; keep its control connection open until exports finish.
2. Write the logical DB archive directly to the protected location, explicitly
   inventorying managed/application schemas; export roles without passwords
   separately. Inspect exit status/warnings and archive table-of-contents in
   protected files, never stdout/chat. Do not ignore unreadable relations or
   use schema-only/public-only output as a full DB success. Role/global metadata
   is separate from the data snapshot; detect/reconcile concurrent role changes.
3. Record SHA256, byte sizes, exact coverage/exclusions, dump-tool/server
   versions and snapshot UTC time in a protected manifest. Export Storage bytes
   separately if full Storage recovery is required; otherwise retain an explicit
   file-exclusion gap. Verify encrypted artifacts can be decrypted locally.
   Public documentation may record hashes/status, never bodies or credentials.
4. Initialize a disposable **local** PG17.6-compatible target, separate directory/
   cluster and local-only endpoint, no production connection string. Review the
   archive as executable SQL. Block outbound network; keep cron/pg_net, webhooks,
   subscriptions and Supabase services from executing external actions.
   Prepare matching extension/service prerequisites locally before restoring.
   Restore role prerequisites, then schema/pre-data, data/sequence state and
   post-data constraints/indexes/ACLs, using stop-on-error and no production
   `--clean`/restore commands. Never apply the M4 migrations as part of this test.
5. Compare captured and restored schema object inventories/definitions, RLS/
   grants/ownership, sequence state and **per-table snapshot row counts**,
   including Auth and Storage metadata. Check validated FKs and explicit orphan
   checks for group_members→users/groups, movie_group_lists→movies/groups and
   any other inventoried key relationships. Record only aggregate pass/fail in
   Git, keeping counts/identifiers/details protected. Historical violations,
   if any, must remain distinguished from restore-created differences; do not
   repair historical RLS/data under this task.
6. If a Supabase extension/managed schema cannot restore on plain PG, report
   that exact dependency and any separately tested application subset. Do not
   replace it with a mock/stub or suppress errors and claim full recovery.
   Native SQL restore cannot validate OAuth/email, object bytes, Realtime,
   provider-hosted Vault or live Supabase services. Save verified hashes and
   local comparison evidence before declaring **scope-qualified recovery ready**.
   Stop/securely remove only the verified disposable target afterward; preserve
   the encrypted backup. **No production restore is authorized**.

Until export and restore actually pass, Step2's recovery prerequisite remains
**blocked**, not satisfied by provider backups, old fixture tests or `--version`.
No backup time/location/checksum or successful restore is attested here.
Relevant official references (checked 2026-10-22):
[Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[DB backup limitations](https://supabase.com/docs/guides/platform/backups),
[PostgreSQL17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[roles/global objects](https://www.postgresql.org/docs/17/app-pg-dumpall.html),
[private password file](https://www.postgresql.org/docs/17/libpq-pgpass.html).

Original preparation findings (2026-10-21; retained, not new restore evidence):

- PRs #190–#194 are open/mergeable, each head descends from its stated base;
  develop `acbdadf8efa2d180a12ed3fc85aa7784bb681782`;
  main `e92392856038e40e6d98c6c8744eed04c4e8dff9`.
- At exact heads, #190 has Netlify Deploy Preview success, three neutral
  Netlify checks and skipped Supabase Preview. #191–#194 have skipped Supabase
  Preview, no commit statuses; no approvals reported on any PR. These are not
  passing required tests. Rulesets list is empty; branch-protection read is
  **403**, so effective required checks/approvals/merge policy are **unknown**.
- Supabase: PostgreSQL **17.6**, UTC; no M4 schema or function-name collisions;
  migration list empty and history **table absent**, not proof of a blank DB.
  Required UUID/text columns match. `auth.users`, UUID generation and required
  roles exist. `pg_cron 1.6.4` is installed, `cron.timezone=GMT`; named M4 job
  is absent. No DDL/DML or function invocation performed in this review.
- Netlify site `e4d5295a-0794-40dc-abfa-6e346b04c142`,
  `denyslisovyi-movies-list`: published production deploy
  `6ad3ad799a970e3fc942b516` is ready, branch main at the main SHA above.
  This does not prove configured develop builds. Project tool does not expose
  build/branch settings, env scopes, APM or log drains. Values were not requested.

### Step 0 — pre-merge operator gates

In the [Netlify project dashboard](https://app.netlify.com/projects/denyslisovyi-movies-list):

| Dashboard location | Required evidence before execution |
| --- | --- |
| Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts | Production branch **main**; branch deploy explicitly enables **develop**; record auto-publish/build behavior. A merge into develop may immediately deploy. If not confirmed, stop before final merge; do not change settings silently. |
| Same area → Build settings; Functions settings | Repository/base/publish directory, Functions directory `netlify/functions`, dependency install and Node **22+**, function bundler, supported synchronous limit. Repo has no `netlify.toml`/build command. Preserve existing settings until reviewed. |
| Project configuration → Environment variables | Owner reports Tavily/TMDb/MOTN keys Secret, Functions, Production + Branch deploys; Supabase URL/service-role present. Confirm **metadata/context only** (including develop overrides/shared-var precedence); no values/export. New source keys intentionally absent from PR previews. |
| Analytics & metrics → Log Drains; Extensions / installed APM integrations; Cloud compute → Functions → media-advice (branch filter develop) | Inspect destinations, body/header capture and retention/redaction; never capture bearer/API keys, source bodies/results, query snippets or card/tracking URLs. Tool cannot attest these. Built-in observability extension in published deploy is not proof of third-party APM capture or its absence. |

Check GitHub Settings → Rules → Rulesets / Branches and each PR merge box for
effective required checks, approvals and merge-commit support. Missing API
permission is not permission to bypass. If requirements cannot be established,
pause execution for owner confirmation, not policy changes.

Function/import review: `media-advice.mjs` imports three local libraries, then
existing research transports/projections/identity and shared URL policy; package
dependencies include Supabase JS and parse5. Offline import with networking
disabled and stubbed empty configuration succeeded. No runtime file-read asset
is needed by this handler. This is **not a Netlify bundle/deploy test**; local
Netlify bundler is unavailable. Branch build must include the complete import
closure/dependencies and list `media-advice` alongside existing functions.
Inspect publish output for secret/server-only artifacts; no env values may be
inlined. Keep 45s sources / 53s finish margins; no timeout/cap change.

### Step 1 — consolidate with merge commits

Pinned starting refs (full SHAs, not mutable labels):

| PR → base branch | Initial head | Initial base |
| --- | --- | --- |
| #194 → codex/m4-gemini-resolver-feasibility | bdca14f9a06a6e84297f75917c5b009dbf41fa66 | 0db059a710bff801e5c455dcc396f06914c156cc |
| #193 → codex/m4-3-kinobaza-discovery | 0db059a710bff801e5c455dcc396f06914c156cc | c5a09298903957b16360147b3363b8d4db90f195 |
| #192 → codex/m4-2-media-advice-server | c5a09298903957b16360147b3363b8d4db90f195 | e0817151f73da0f742ee72b77bc23bb709457d7b |
| #191 → codex/m4-1-media-advice-form | e0817151f73da0f742ee72b77bc23bb709457d7b | bd43cc83319888ff82c7763e48cd9adb36cb453a |
| #190 → develop | bd43cc83319888ff82c7763e48cd9adb36cb453a | acbdadf8efa2d180a12ed3fc85aa7784bb681782 |

Starting #194 tree: `6ddf25db140829951da748404a9244d6717308e5`.
This documentation successor is not silently part of that tree: if incorporated
into #194 first under later approval, repin its head/tree and review that docs
diff before executing this sequence.

| Merge | Expected source head | Expected target head immediately before merge | Record |
| --- | --- | --- | --- |
| #194 → #193 branch | H194 above | H193 above | M1 |
| #193 → #192 branch | M1 | H192 above | M2 |
| #192 → #191 branch | M2 | H191 above | M3 |
| #191 → #190 branch | M3 | H190 above | M4 |
| #190 → develop | M4 | pinned develop above, re-read immediately | M5 |

Before **each** operation: fetch refs; re-read source **and base** SHA, diff,
mergeability, reviews and checks at that exact head. Use GitHub merge method
`merge` with expected source `sha`; no admin/bypass/force/retarget/squash.
Expected head does not lock base: serialize operators, check base immediately
before merge and verify returned commit's first parent equals that base and
second parent equals expected source. After every parent advance, fetch and
record its new SHA, both parents, tree, ancestry and updated PR diff/checks.
Tree must equal the starting reviewed tip tree (or explicitly repinned docs
successor); do not copy old checks to the new SHA.

Before M5, verify the combined develop diff is M4 research-approved integration
only; both M4 migrations, Tavily selection and #192 fixes are present. Confirm
ancestry of all pinned heads plus launcher fix
`e596341f2fdc1203b52b9abae840f7090cef30c0` and R1/R2
`16461b22f001499720193d6b72df745dc8890a20`; no deletion/reversion of their tests/controls.
Run full M4 offline/HTTP/Edge suites on assembled M4; native PG17.6 evidence
can be reused only if SQL/ledger unchanged. After M5 record actual develop SHA,
tree/parents/ancestry, rerun relevant final checks and read fresh statuses.
Confirm main SHA and published production deploy unchanged.

**Stop** for any unexpected head/base/tree/diff, conflict, rejected merge,
missing required approval or failing required check. No automatic restacking.
M5 also authorizes an auto branch deploy **only if explicitly included in the
next approval**; do not invoke a manual deploy or build hook here.

### Step 2 — apply only the two M4 migrations (future privileged action)

| File under supabase/migrations | Dependency / SHA256 of reviewed bytes |
| --- | --- |
| `20261020205122_media_advice_access_ledger.sql` | Existing auth.users(id), public group_members/movies/movie_group_lists, standard roles and UUID function; creates private schema/two tables/index and two service-only public RPCs. `08b6ecfa102bb3d34d994a29d76412dfb6ad0546c65b4579c2408bd7f4fa825c` |
| `20261021072002_media_advice_review_fixes.sql` | Requires first file; replaces those RPCs, adds private cleanup_health. `39ab043e86072efe25db55e042945e11fa8cfe7f39d1977e5d55eab65b2cd1b7` |

No dependency on executing 001–016, no existing-row updates or historical
RLS changes. Recheck object collisions before applying, including **any**
same-name function signature; these are not idempotent replay scripts.
Verify hashes against Git blobs/assembled tip (line-ending conversion changes
byte hashes: establish the reviewed execution-file hash before running).
Confirm backup/PITR recovery availability privately; no restore is invoked.

Use a **new disposable Supabase CLI work directory containing only these two
unchanged migration files**, outside owner checkout. Current machine has no
Supabase CLI/psql in PATH: executing operator must pin/install an approved CLI
and first inspect `--version` and command `--help`. Planned commands below
are from the [official CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-up)
(checked 2026-10-21), not executed here:

```powershell
supabase migration up --help
supabase migration list --help
supabase migration repair --help
supabase --workdir "$m4Stage" init
# Copy ONLY the two reviewed files into $m4Stage/supabase/migrations.
supabase --workdir "$m4Stage" link --project-ref mttkectgdqqmejpenkrn
supabase --workdir "$m4Stage" migration list --linked
# STOP unless exactly these two pending versions and no unexpected remote history.
supabase --workdir "$m4Stage" migration up --linked
supabase --workdir "$m4Stage" migration list --linked
```

`$m4Stage` must be a new unique temporary directory, not the repo or an existing
linked workspace. Authenticate interactively with hidden password input; no
password-bearing URI/arguments, debug logs or credentials in the runbook/Git.
Confirm project identity independently before writes. CLI creates its own
history metadata and applies only pending files in that isolated directory.
Expected history: **only 20261020205122 and 20261021072002**, reflecting actual
execution. Do not use general `db push`, `--include-all`, historical replay,
blanket repair or automatic GitHub/Supabase production migration integration.

Both files contain transaction boundaries. On any error/lost reply **stop**:
an earlier file may have committed even if history recording failed. Inspect
actual catalogs/function definitions and history; never blindly rerun.
Only after proving which exact file executed may an operator use targeted
`migration repair <that-version> --status applied --linked` in the same
isolated directory. Do not mark 001–016 applied. Partial execution/history
reconciliation needs review, not an automatic retry.

Post-checks, with access still off:

- Exactly permissions/sessions/cleanup_health in private schema; RLS enabled,
  no anon/authenticated schema/table access. No permissions or sessions inserted.
- Two public RPCs have expected signatures/definitions, SECURITY DEFINER and
  empty search_path; service_role EXECUTE true, anon/authenticated false,
  including PUBLIC/inherited grants. Verify pg_proc/proacl and
  `has_function_privilege`; table grants match migration, cleanup_health is
  service-role SELECT only. Do not execute start/reserve as a smoke test.
- Record pre/post definitions/policies of the three existing public tables
  and private aggregate row counts/fingerprints, not row bodies; compare.
  Concurrent legitimate app writes require reconciliation, not a claim that
  counts prove no changes. Static SQL writes only new M4 objects. No lock or
  owner-demo interruption to manufacture identical snapshots.
- Check actual two history entries and no new automated cleanup job; capability
  without assignment must fail closed. Missing RPC/schema-cache visibility is
  an operations issue to investigate, not permission to replay migrations.

Copyable post-checks (privileged read-only connection, **after** migrations):

```sql
select version from supabase_migrations.schema_migrations order by version;
select c.relname,c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as user_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='media_advice_private' and c.relkind='r';
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,
  has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as user_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('media_advice_action','media_advice_cleanup');
select (select count(*) from media_advice_private.permissions) as assignments,
       (select count(*) from media_advice_private.sessions) as sessions;
```

### Step 3 — daily cleanup and independent control

Operator **Denys** owns activation and daily operations. After both migrations,
review/run [prepared schedule SQL](../supabase/operations/media-advice-cleanup.schedule.sql)
only with separate authorization: it creates the named job **inactive** and
refuses an existing name/non-UTC-equivalent timezone. Then inspect its single
jobid, command, database/user, `15 2 * * *` and GMT/UTC; activate that exact job
with `cron.alter_job(<verified-jobid>, active := true)`. No second job or
extension installation is needed by the observed baseline.

Retention origin is session **created_at**, eligibility after age24h **and**
expires_at elapsed (normal TTL30min), including unfinished/error sessions.
Still-active rows are retained and become an overdue finding if anomalously
old. Daily healthy scheduling expects deletion at age24–48h, **not a guaranteed
48h bound on scheduler/DB failure**. No movies/Wishlist or permission deletion.

Concrete pilot monitoring: Denys checks **daily at 09:00 UTC**, independently of
pg_cron, in Supabase SQL Editor using
[existing health SQL](../supabase/operations/media-advice-cleanup.sql), then
these read-only checks:

```sql
select jobid,schedule,active from cron.job
where jobname='mykola-media-advice-cleanup';
select status,start_time,end_time from cron.job_run_details
where jobid in (select jobid from cron.job
               where jobname='mykola-media-advice-cleanup')
order by start_time desc limit 3;
```

Require exactly one correctly configured job and today's scheduled
run succeeded and heartbeat advanced after02:15UTC; the health query's missing/
>26h success or age≥48h backlog is actionable too. Record only UTC check time,
success/overdue count privately. Initial missing heartbeat is expected before
first run, not permission to skip monitoring. Verify first scheduled success
before live access; alternatively a separately authorized one-time cleanup
can test the function but **does not validate scheduler firing**.

This is a **manual control, not automatic alerting**. Denys must explicitly
accept the duty before pilot, continuing after flag expiry until the final
session has been cleaned; without coverage postpone access. For a missed/
failed run, unexpected active job/TTL or overdue records: revoke pilot flag,
inspect scheduler/DB, perform only authorized cleanup recovery, recheck; no
source replay or accounting reset. Unattended alerting needs a separate
approved independent monitor/notification design; none is added or activated
implicitly. Scheduler cannot report its own complete outage.

### Step 4 — branch deploy verification and source-free smoke

Follow the automatic develop deploy from M5; record deploy ID, context
`branch-deploy`, branch develop, commit exactly M5 and its HTTPS URL
(expected convention `https://develop--denyslisovyi-movies-list.netlify.app`;
use dashboard-reported URL, not an unverified address as evidence).
Build/functions list must include media-advice with imports/dependencies and
no secret exposure; check diagnostics without bodies/keys. Published main
deploy must still be the recorded production one. Failure stops activation,
not a reason for manual prod publish or policy/secret-scanning bypass.

Future smoke, **no discovery/source calls**:

1. GET media-advice →405; cross-origin POST →403; valid-context POST without
   bearer →401, malformed context →400; all JSON/no-store, no secrets.
2. With actual browser login, only `action: capability` for an established
   film and eligible test group. Before assignment expect denial/hidden entry;
   ordinary form editing still works. Do not click Find; no start/reserve.
3. After separately authorized owner assignment, capability true only for
   that UUID/eligible group; unassigned user/visitor/foreign group denied.
   Open/close isolated advice without Find: no source requests or form writes.
   Do not create/delete/modify production group membership for smoke.

Capability uses Auth/RPC, not Tavily/TMDb/MOTN/Kinobaza. It does **not** validate
source keys or live resolver quality. Do not use existing movie-search as a
configuration probe. Ordinary read requests and later pilot Save are distinct.

### Step 5 — owner-only, expiring backend assignment

Owner UUID is **not established in this preparation**. Resolve it privately from
the owner's authenticated Supabase `getUser()` id, corroborate in Authentication
→ Users and eligible test-group membership. Never infer from display name or
choose the first auth user. Do not print access tokens or publish email/UUID.
Also establish the test group/list/film binding; current flag is per-user, not
a new per-group restriction.

Once all gates pass and activation is authorized: require no other enabled
M4 permission rows; replace `<VERIFIED_OWNER_UUID>` with that exact UUID and assign
**2 hours** through privileged SQL/admin, not editable user_metadata:

```sql
insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at)
values ('<VERIFIED_OWNER_UUID>'::uuid,'mykola_media_advice',true,
        clock_timestamp() + interval '2 hours')
on conflict(user_id,feature_key) do update
set enabled=true, expires_at=excluded.expires_at;
```

Emergency stop / end of pilot — a separate action, same verified UUID:

```sql
update media_advice_private.permissions
set enabled=false, expires_at=clock_timestamp()
where user_id='<VERIFIED_OWNER_UUID>'::uuid and feature_key='mykola_media_advice';
```

These are **future actions**. Confirm one exact active user/expiry after
assignment; all others default-off. Revocation
denies subsequent capability/reserve/finish/apply authorization; an already
dispatched source request may still have spent its attempt. It does not undo
earlier user Save or erase already displayed results. No retries/refund.

### Step 6 — pilot, only under subsequent authorization

Select **five concrete real Wishlist films first**; currently none selected.
Record their real IDs and test-group card bindings privately, not research
fixtures. One explicit discovery per film, ≤2 Tavily + ≤2 card + ≤4 baseline
= ≤8 attempts/case, **≤10 Tavily within ≤40 total**. No retries/fallback/
redirects/destination probes or platform sweep; internal search traffic unknown.
One select → preview → transfer → ordinary **Save in the test group**, checking
manual edits and exact acknowledged URL. This one Save is a later authorized
Wishlist write, not part of preparation/smoke. No claim/track propagation.

Record separately: search URL candidate acceptance; identity matched/refused;
extraction useful/partial/refused; source-labelled links/localization and
practical help; application calls/time and intervention; transfer/Save outcome.
No offers is not resolver failure or evidence of unavailability. Stop for
false identity, cap/access bypass, unexpected writes, lost edits or unsafe URL.
No raw responses/HTML/snippets/secrets archive.

### Unresolved prerequisites and evidence boundary

Execution remains **conditional**, not deployment/pilot-ready approval:

1. Effective branch policy/required approvals (403), fresh assembled-tip checks;
   explicit merge + possible automatic develop deploy authorization.
2. Dashboard develop/base/publish/functions/bundler/Node configuration and
   APM/log-drain/body-capture verification; env context metadata confirmation.
3. Approved CLI/privileged connection/recovery readiness for only two new
   migrations/history; live privileges/default-off/post-data checks not yet run.
4. Explicit cleanup activation/first-run evidence and Denys's independent
   daily monitoring commitment (no automatic alerting exists).
5. Exact owner UUID/test group and later bounded backend assignment.
6. Five real pilot films, still unselected, and separate pilot/Save authorization.
7. Account/source-use conditions: Tavily §§2/3.5 end-user scope versus an
   owner-only pilot, actual plan/quota and AUP obligations; Kinobaza automatic
   arbitrary-card content rights not supplied by Search; existing TMDb/MOTN
   attribution/commercial/retention requirements. See dated findings below;
   no blanket clearance, no new runtime legal switch.

Read-only catalog/project/PR review and offline import check passed. No runtime,
SQL, flag, secret or scheduler change here; prior #194 45-pass/1-skip browser/
offline and #192 native17.6 evidence stay pinned, not a new run on these docs.
Markdown-only: verify links/anchors, consistency, scope and whitespace; no
reason to repeat runtime/Windows suites. Reference docs checked 2026-10-21:
[Cron](https://supabase.com/docs/guides/cron),
[migration history repair](https://supabase.com/docs/reference/cli/supabase-migration-repair),
[function logs](https://docs.netlify.com/build/functions/logs/),
[log drains](https://docs.netlify.com/manage/monitoring/log-drains/).

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

**Historical checkpoint, superseded by the Tavily replacement below.** Brave is
no longer selected because of practical access/payment difficulties reported by
the owner. The dated review, observations and counts below remain historical
evidence, not current production adapter/configuration instructions.

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

## Tavily Search replacement (2026-10-21)

**Implemented/offline-tested; live-unvalidated, default-off.** Narrow successor
to #193 `0db059a710bff801e5c455dcc396f06914c156cc`, base #192
`c5a09298903957b16360147b3363b8d4db90f195`. #190/#191 and develop
`acbdadf8efa2d180a12ed3fc85aa7784bb681782` were unchanged at inspection.
No migrations, ledger stages, client/state/form-transfer logic, dependency,
cleanup configuration or research adapter changed. All three #192 fixes remain.
Brave is removed from the active M4 path; Gemini's established API-use blocker
is unchanged. There is no alternate-provider fallback.

### Contract and data boundary

[Official Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search),
checked 2026-10-21: POST `https://api.tavily.com/search`, Bearer header;
`search_depth: basic`, `topic: general`, `max_results: 5`,
`auto_parameters: false`, `include_answer: false`,
`include_raw_content: false`, `include_images: false`,
`include_favicon: false`, `include_usage: false`,
`include_domains: ["kinobazaua.com"]`, `include_domains_mode: restrict`.
The explicit request avoids automatic parameter/depth changes and generated
answers. Only `results[].url` is used; content/score/title/answer are discarded.
Missing/malformed results is an error, not an empty success; `results: []` is
empty. Responses exceeding five results are refused, unsafe URLs filtered and
exact admitted URLs deduplicated. No Extract/Crawl/Research endpoint or SDK.

The existing `searchFactory(apiKey, boundedFetch)` interface remains injectable.
Only exact Tavily endpoint POSTs are accepted; redirects/cookies are refused.
The 15s/512KiB response bound is inside the existing entry-based 45s source
deadline, leaving the finish phase until 53s. Durable reservation precedes each
attempt; a post-reservation deadline prevents dispatch without refund/retry.
At most two searches: the second uses an already established alternate title
only after successful search with zero admitted candidates. HTTP/auth/quota,
malformed/oversize, transport and timeout errors do not trigger another query.
401/403/429/432/433 and other HTTP errors use content-free status codes.

The audited path remains response → URL admission → bounded card GET →
independent identity/extraction → projected source rows → transient client.
Neither Search Results nor snippets/scores/envelopes enter ledger, form,
short report, browser storage or application logging. Matched card addresses
can appear as transient card provenance/choices, not a search archive.
The automated canary regression covers handler → projection → report/RPC and
zero application log calls. Hosting-side telemetry/log-drain configuration
remains uninspected and must not capture request/response bodies or secrets.
Separately extracted HTML provider links retain their own provenance and
R1/R2/navigation/transfer/acknowledgement rules. Ordinary explicit Save may
persist that chosen provider URL; this is not persistence of Search Results.
The existing app's form logging caveat in the historical audit still applies.

### Dated source-use findings, not legal approval

[Platform Terms](https://www.tavily.com/terms) (May 4, 2026; checked October 21):
§§1.2–1.3 define Customer Applications/inputs, including end-user queries.
§2 permits documented API integration but limits it to internal business
purposes and expressly restricts third-party API use without prior written
consent. §3.5 nevertheless addresses external application end users and
requires appropriate user agreements without shifting liability to Tavily.
Account/Order Form scope must reconcile this before unrelated group-user
activation; protected keys alone do not establish rights. §§7/9.2 permit
provider-side input sharing/retention/improvement: application no-storage is
not a provider zero-retention guarantee. §17.8 requires usage/audit records;
check actual account obligations without archiving result bodies. This is
neither blanket app prohibition nor clearance.

[AUP](https://www.tavily.com/acceptable-use-policy) (May 5, 2026; checked
October 21), §2 allows expressly supported automated access while preserving
third-party rights/obligations; no specific Google-style ban on candidate
URL → independent HTML fetch was found in these reviewed texts. §4 requires
downstream-user compliance/enforcement; §5 requires output vetting. Those are
conditions, not a Kinobaza content license. Query input here is public film
identity only, never user/group/draft/source offers. Application code requests
no LLM answer; this does not claim Tavily has no internal AI processing.

**Assessment:** documented search capability is compatible with the narrow
technical pipeline; customer-app/end-user license scope remains **unresolved**,
not cleared by this implementation. Kinobaza automatic arbitrary-card
extraction and existing TMDb/MOTN conditions still need the separately
authorized activation preflight. No new legal toggle/acknowledgement is added.

### Five-Wishlist-film live plan (prepared, not authorized/executed)

**Correction:** no five-film manifest has been selected or agreed. Earlier
P1–P5 labels were placeholders, not agreed films. The
[execution runbook](#activation--operation-plan-not-executed) is the only
current operation/pilot sequence: select real Wishlist films before activation,
≤10 Tavily calls within ≤40 application source attempts, one ordinary Save
check in the test group. No pilot, preflight discovery or automatic retries
are authorized here; billing/actual quota and provider internal traffic are
not established by application counters.

### Replacement verification

Authored fixtures only, not live Tavily/Kinobaza validation. Final M4
offline/mock-HTTP/isolated SQL/Edge suite: **45 passed, 1 native test skipped,
0 failures**. Edge covers desktop 1280×900, mobile 375×812 and 820×1180,
including pending apply/cancel/stale/manual-edit controls and safe clipboard
fallback. Separate research provider-grouping/matching/R1/R2 regressions:
**29/29 passed**. Ledger SQL, #192 queued access/
pending-apply fixes and launchers are unchanged: no new migration or native
PostgreSQL/Windows lifecycle execution is required for this adapter change.
Previous PostgreSQL **17.6** concurrency evidence is reused, not relabelled as
a Tavily run. No WebKit/device claim; Edge mobile viewport checks are separate.
Local Markdown verification covers the root README, this canonical record and
the existing research README/docs: **13 documents, 424 local links / 263
anchors**, zero errors. Historical counts above remain pinned to their own
checkpoints, not silently reused.
