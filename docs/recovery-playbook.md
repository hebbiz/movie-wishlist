# Movie Wishlist local backup and restore playbook

This is the current operator entry point for **movie-wishlist,
`mttkectgdqqmejpenkrn`**. Use the existing
[`recovery-*` tools](../supabase/operations/), not a new scoped exporter.
The [dated recovery record](m4-media-advice.md#recovery-checkpoint--2026-10-22-blocked)
retains historical evidence and limitations; it is not a command to replay an
old checkpoint or authorization for a production restore.

## Scope and authorization

For this project, an owner-approved local backup/restore test may use the
existing export/readback/VM pipeline, a private disposable directory, and the
temporary public software listed below. Restore real data only from the
**explicitly approved checkpoint** after all safety gates pass. Rechecking an
existing archive does not require another production export or password.

Separate owner decisions are required for production restore, migrations or
other production data/schema/rights/flag/configuration changes; external service
or Storage-byte recovery; new services, cloud/paid resources, permanent software
or system-service installation; broader access or a changed recovery pipeline.
No merge, deploy, release or feature activation follows from a recovery result.
These permissions do not bypass platform restrictions or supply unavailable
credentials: use the existing hidden local prompt when a new export needs them.

## 1. Preflight and fresh encrypted logical export

1. Record reviewed Git SHA, target, UTC times, available storage, tool versions
   and intended scope. Independently check the target and migration history
   read-only. Do not infer database state from Git. The current full exporter
   expects PowerShell 7 on Windows, Node, the prepared PG17.11 clients/CA and its
   existing local `pg` module path; inspect
   [`recovery-export.ps1`](../supabase/operations/recovery-export.ps1) before use.
   If a dependency, access or current-schema coverage is missing, stop rather
   than silently substitute a different export.
2. Use an ordinary non-recorded local terminal, without transcripts. Run
   [`recovery-password-prompt.ps1`](../supabase/operations/recovery-password-prompt.ps1)
   and enter the existing database password **hidden**, never in chat, argv,
   scripts or logs. The helper verifies the fixed session-pooler target on
   port 5432, CA/hostname with `verify-full`, PG17 and an explicit read-only
   transaction. Transaction pooling on 6543 is not suitable for the coordinated
   snapshot. Do not downgrade TLS on failure. Revocation checking is not attested.
3. Consume the same-user/machine, unexpired, one-use DPAPI credential handoff
   with the existing exporter. It holds a repeatable-read **READ ONLY** snapshot
   for the unfiltered custom archive and source inventory/counts; captures roles
   before/after **without passwords**; and encrypts streams directly with
   AES-256-GCM. Role stability is separate from the data snapshot. Unreadable
   counts, warnings or incomplete output are not success. No plaintext archive
   should be created during export. The exact pending credential is consumed;
   existing checkpoints and keys must not be overwritten.

From a reviewed checkout, these are separate operations, not a retry loop:

```powershell
& .\supabase\operations\recovery-password-prompt.ps1
& .\supabase\operations\recovery-export.ps1
# Set to the new name returned by that one export, not an old example.
& .\supabase\operations\recovery-audit.ps1 -Checkpoint $checkpoint
```

Checkpoint directories live outside Git under
`%LOCALAPPDATA%\MovieWishlist\Recovery\mttkectgdqqmejpenkrn\`; each separate
wrapped key is under `%LOCALAPPDATA%\MovieWishlist\RecoveryKeys\`.
Require current-user ownership and protected current-user/SYSTEM-only ACLs;
refuse reparse points. Only historical, non-consumed metadata may retain the
recorded built-in Administrators owner, still with that same restricted DACL;
this is not an exception for the original manifest, seven consumed artifacts,
wrapped key or staging. DPAPI CurrentUser binds the key to this Windows
profile/machine. It is **not** an off-device recovery-key solution, and neither
private placement nor NTFS ACLs are disk encryption.

Pin the original `status.json` and wrapped-key SHA256 in the private operation
record. Verify persisted-key readback, all manifest sizes/hashes and every
retained AES-GCM tag. A hash calculated from an untrusted file is not independent
authenticity evidence. The [offline audit](../supabase/operations/recovery-audit.ps1)
also checks archive TOC/full native reading and coverage; inspect its semantic
flags, not just process exit status. **Readback is not restoration.** Authenticate
the whole file before a second decrypt stream feeds any executing restore;
streamed GCM plaintext is not authenticated until the final tag passes.

## 2. Temporary software: reuse first, prepare before real data

Only missing required components may be downloaded into the verified temporary
local directory. Use official HTTPS sources, fixed versions/commits where
available, and verify published checksums or pinned OCI digests **before use**.
Record URLs, versions, sizes and digests privately. Distinguish a locally
calculated integrity hash from an independently published checksum/signature.
Stop for mismatches, unavailable pins or unexpected substitutions.

| Component | Existing route and constraint |
| --- | --- |
| Windows PG clients | Existing EDB portable PG17.11 binaries; no installer, service, PATH or trust-store changes. Recheck versions and retained archive hash. |
| QEMU | Portable temporary QEMU from the reviewed Windows publisher (`qemu.weilnetz.de`), verified against its published checksum; no installer side effects or system integration. |
| Alpine | Official `dl-cdn.alpinelinux.org` virt ISO/kernel/initramfs; prefer the recorded version/hash. The asset helper discovers `latest-stable`, so inspect/pin the resolved version rather than treating that URL as immutable. |
| Supabase PostgreSQL | Official `supabase/postgres:17.6.1.054` OCI manifest `sha256:e884cde9f5594ddb30ebec888bd236d128eaf9c9b48cc864d8fa3d27a6c6c6bc`; verify manifest and every layer. Registry download is not permission to install Docker or run the service entrypoint. |
| Extensions/build inputs | Real matching native modules; official pg_net 0.20.4 commit `698fb055f666366a78c112b0578b0a5652ddbcfa`, official curl headers and PostgreSQL client assets only as required. Existing client/locale pins are enforced by the driver. No stubs or ignored extension errors. |
| Unpacking/ISO | Existing reviewed OCI/unpacking tools and built-in Windows ISO APIs; software ISO contains public software only. No database, keys or private staging may be packaged into it. |

The relevant existing helpers are
[`recovery-vm-assets.mjs`](../supabase/operations/recovery-vm-assets.mjs),
[`recovery-oci-layout.mjs`](../supabase/operations/recovery-oci-layout.mjs),
[`recovery-client17-source.mjs`](../supabase/operations/recovery-client17-source.mjs),
[`recovery-pgnet-source.mjs`](../supabase/operations/recovery-pgnet-source.mjs),
[`recovery-curl-source.mjs`](../supabase/operations/recovery-curl-source.mjs),
[`recovery-build-pgnet.sh`](../supabase/operations/recovery-build-pgnet.sh) and
[`recovery-software-iso.ps1`](../supabase/operations/recovery-software-iso.ps1).
They are an operator harness, **not a complete fresh-machine installer**. Check
the required inputs/layout and exact pins before invocation; a missing or
unverified preparation step is a blocker, not a working instruction.
The current staging worker uses the archive helper's bounded 32 MiB in-memory
reader. A larger artifact requires a separately reviewed staging change, not
removal of the bound or an unrecorded plaintext workaround.

Preparation order matters: assemble the verified OCI/software inputs and create
the public software ISO first. The ISO helper moves `share` to `software` and
creates a fresh `share`; put the verified pg_net/curl build inputs in that new
share afterward. Then use VM modes `prepare` → `inspect` → `build-pgnet`, checking
each result before staging data. Reuse the exact locale payload from verified
OCI **layer 50**, with the driver's pinned digest, and the pinned Linux17.11
client package. Do not substitute an arbitrary locale or image pg_net0.19.5
for the source's0.20.4. A failed prepare is not permission to stage data.

## 3. Mandatory gates before plaintext staging

1. Check checkpoint name, project, snapshot time, original manifest/key pins,
   every artifact hash and full GCM authentication against the approved record.
   Do not choose the newest directory automatically. Run the synthetic guard
   tests first, including wrong checkpoint/path/hash, extra-reader ACLs and
   reparse points. Never relax a guard just to pass.
2. Create exactly one private immediate child of
   `%LOCALAPPDATA%\MovieWishlist\RestoreTests\`, named
   `restore-YYYYMMDD-qemu-xxxxxxxx`. Verify resolved ancestors, current-user
   ownership, protected owner/SYSTEM ACLs and no reparse points throughout.
   Use `New-RecoveryPrivateDirectory` from the existing prompt helper for the
   new child; do not broaden or rewrite a parent directory's rights.
3. Prepare and test public software only. Verify QEMU invocation has **no NIC**
   (`-nic none`), no host forwarding, monitor/API/VNC or inherited user config.
   PostgreSQL must have `listen_addresses=''`, a guest-local mode0700 Unix
   socket, and no production connection string. Check the actual command and
   process, not a descriptive filename. Never start Supabase Auth/Storage/
   Realtime services or image entrypoints.
4. Before import, require cron `launch_active_jobs=off`; any required real
   pg_net preload is confined to untouched `template1` with `batch_size=0`,
   never the restored database. Import uses `session_replication_role=replica`
   so ordinary webhook/assignment/Vault triggers do not execute. Independently
   verify no-NIC isolation, worker configuration and empty restored HTTP queue;
   do not claim the required pg_net worker is absent. Do not execute restored
   jobs, RPC actions, subscriptions or external destinations.
5. Disk encryption must be verified, **or** the owner's explicit waiver for
   this local test must apply with the unchanged private-ACL, no-network and
   exact-cleanup conditions. Record unknown encryption as unknown. Stop if
   these conditions cannot be established; do not silently extend the waiver.

Run `pwsh -NoProfile -File tests/recovery-local-guards.test.ps1` for authored
Windows-only negative/positive guard cases (38 checks in this change), and
`node --test tests/recovery-local.test.mjs tests/recovery-archive.test.mjs`
for archive/VM-contract fixtures. They do not use real backups, keys, a live
database or QEMU. Confirm the stopped public-only root separately with:

```powershell
& .\supabase\operations\recovery-vm-preflight.ps1 -VmRoot $vmRoot -SoftwareOnly
```

The VM entry point repeats its own guard before writes/start. Omit
`-SoftwareOnly` only for an already-staged private root; the switch is a strict
absence-of-private-data check, not a permission bypass.

## 4. Restore and compare, without changing the source

Use the guarded local wrapper and the no-NIC VM driver, not the source pooler.
The operator supplies independently recorded lowercase pins; these variables
must not be populated by blindly trusting the files being checked:

```powershell
& .\supabase\operations\recovery-local.ps1 -Mode stage -VmRoot $vmRoot `
  -Checkpoint $checkpoint -ManifestSha256 $manifestSha256 -KeySha256 $keySha256
node .\supabase\operations\recovery-vm.mjs $vmRoot restore
& .\supabase\operations\recovery-local.ps1 -Mode verify -VmRoot $vmRoot `
  -Checkpoint $checkpoint -ManifestSha256 $manifestSha256 -KeySha256 $keySha256
```

These commands require the verified software layout from sections 2–3; they
are not a substitute for preparing it. Never use `software-console` after
private staging. Review archived SQL as executable code privately. Restore with
stop-on-error, preserving owners and ACLs; do not add `--no-owner`/`--no-acl`
or suppress failed statements. The existing driver records the sole bootstrap
reconciliation: omit only the already-created `supabase_admin` CREATE ROLE in a
private replay copy, retain its ALTER/GRANTs and keep the encrypted original.
Do not apply repository migrations during a snapshot restore.

Record each comparison separately, with encrypted details and only safe
aggregate results in Git/reports:

- all archived tables: snapshot counts, sorted COPY-record fingerprints,
  sequence state, schema/table inventory and owners;
- constraints and actual FK targets/validation flags, all restored FK orphan
  checks, including group/member/movie/Auth dependencies;
- function/RPC signatures and bodies, trigger bindings, RLS/force-RLS/policies,
  defaults, role attributes/memberships and native ACL grantee/**grantor**/
  privilege/grant-option/default semantics;
- exact M4 object identities, not counts alone: seven private tables
  (`beta_config`, `beta_feature_assignments`, `cleanup_health`, `permissions`,
  `pilot_access_users`, `sessions`, `user_regions`), ten private functions,
  four public RPCs, eight trigger bindings and seven migration rows against
  the approved snapshot. Check cap8/10/12/14, attempts ≤ cap, nullable global
  group context, flag/diagnostics/pilot/region state and service-role-only RPC
  permissions without exercising production actions;
- cron/pg_net/no-TCP/no-NIC evidence, extension versions/native dependencies,
  full schema redump and all retained audit flags. A successful command or
  matching totals alone is insufficient.

The October 22 full restore had **two GraphQL schema ACL mismatches** and a
full-schema SQL mismatch. A later focused public/Auth schema test did not
retroactively fix or prove that full restore. If the current test needs
[`recovery-schema-supplement.mjs`](../supabase/operations/recovery-schema-supplement.mjs),
use it only on the isolated target after its exact captured source and allowed
target ACL checks pass, only for `graphql`/`graphql_public`, as the original
grantor. Retain before/after evidence and rerun native ACL comparisons. Never
apply it to production, add broader grants, or relabel unclassified schema
differences as formatting. Keep exact failures alongside any narrower semantic
comparison or scope-qualified conclusion.

## 5. Evidence, shutdown and cleanup

Before cleanup, encrypt private logs/catalogs/comparison evidence beside the
checkpoint, authenticate readback, and record actual tools, times, driver hashes,
failures, exclusions and safe status. Stop guest PostgreSQL/VM; confirm the exact
QEMU process has exited and no process uses the temporary target. The cleanup
wrapper rechecks the bounded path, private ACL/reparse guards, stopped VM,
isolated invocation and original checkpoint/key pins:

Reserve `restore-<ISO-time>.status.json` for the full verifier: the offline audit
selects the latest such record. Give supplemental M4/schema comparisons another
prefix so they cannot be mistaken for a complete restore result.

```powershell
& .\supabase\operations\recovery-local-cleanup.ps1 -VmRoot $vmRoot `
  -Checkpoint $checkpoint -ManifestSha256 $manifestSha256 -KeySha256 $keySha256
```

For a failure **before** private staging, the same cleanup command may use
`-SoftwareOnly`; it recursively refuses a private marker, dump, roles,
source-inventory, encrypted artifact or wrapped key. A staging failure before
the first restore attempt has no supported automatic cleanup path: keep it
private/stopped and review the exact evidence and target separately. Do not
pass `-SoftwareOnly` or fabricate restore-invocation evidence to get past that
refusal.

Remove only that verified disposable target. Recheck original ciphertext/key
hashes and authenticate retained evidence afterward. Preserve all original
checkpoints, keys and previous copies. If cleanup refuses or evidence is
incomplete, keep staging private, stop processes, and report the exact blocker;
do not use a broad recursive deletion workaround. Ordinary removal is **not
forensic erase**, including SSD/pagefile remnants.

## Coverage and explicit limits

This is a logical database `postgres` archive plus logical roles, **not a full
Supabase-project backup**, physical/PITR/WAL recovery or proof of service
recoverability. SQL Auth/Storage records can be covered while their services
remain untested. Excluded or separately required components include Storage
object bytes; Auth OAuth/SMTP/JWT configuration; API/service/project secrets and
Vault encryption roots; role passwords; Netlify/Edge deployments, DNS and other
external configuration. Native pg_dump extension semantics omit the two net
queue/cache table payloads; do not claim preservation of in-flight HTTP work.
Source inventory does not independently capture every function/column ACL or
`pg_init_privs`: distinguish archived replay fidelity from an independent source
catalog audit. Sequence state is not a transactional snapshot of concurrent
`nextval`. DPAPI profile/machine loss is a separate recovery risk.

For release rollback, returning to a previous Netlify deploy changes code only:
Supabase schema/data/flags remain as they are. Do not automatically run down
migrations or restore the database. Database recovery is a separate owner-led
response to data/schema loss or corruption, with its own target, downtime and
data-loss decision.

### Checkpoint-specific evidence

The current approved test concerns
`checkpoint-20261110T084741Z-dd8c8783`, snapshot **2026-11-10 08:47:42 UTC**.
Its fresh export and persisted-key readback are distinct from the older scoped
pre-#233 copy. One real-data no-NIC/socket-only PG17.6 restore started at
**10:03:56.712 UTC**; the full verifier ran at **10:06:31 UTC**. Counts, COPY
fingerprints, sequences, logical roles, FK checks and captured catalogs passed.
All **79 M4 SQL blocks**, seven private table payloads, fourteen functions,
eight trigger bindings, RPC/RLS, cap8/10/12/14 and migration history matched.

The full result remains **`verified:false`**: `graphql` and `graphql_public`
schema ACLs differ, and 51 non-M4 `extensions` ACL blocks differ (49 function
and two relation ACLs). Their archive/redump owner annotations change from
`postgres` to `supabase_admin`; 51 source revocation statements for `postgres`
are absent from the redump. These are not dismissed as formatting. No ACL
supplement or permission repair was applied. Independent complete source
function/column/initial-ACL capture remains absent; the M4 result is archived
replay fidelity, not a full-project privilege audit or service-recovery proof.

Public preparation had an unpack timeout and a QEMU writable-FAT failure on
reused output files. Required real native components were inspected/built;
a fresh-share empty-PG isolation smoke then passed and shut down normally
before real staging. The actual restore also used a fresh per-attempt share
and completed normally. Do not reuse an old writable output share for retries.

Exact temporary cleanup completed at **10:11:55 UTC**. Readback authenticated
all retained evidence and confirmed all 61 previously pinned encrypted/key
files unchanged. The operation/PR report retains the comparison boundaries;
this result does **not** establish whole-project recovery or production readiness.

Official references:
[Supabase backup limits](https://supabase.com/docs/guides/platform/backups),
[PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[pg_restore execution/inspection](https://www.postgresql.org/docs/17/app-pgrestore.html),
[roles/global objects](https://www.postgresql.org/docs/17/app-pg-dumpall.html).
