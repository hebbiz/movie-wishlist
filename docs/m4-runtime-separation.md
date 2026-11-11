# M4 runtime separation and pilot inventory

Current layout: [browser source ownership](#browser-source-layout--2026-11-11).
The completed pilot cleanup is recorded at
[local pilot retirement](#local-pilot-retirement--2026-11-09).
Stage 1–2.3 inventories and launch commands below are historical checkpoints,
not instructions for running the retired demo in the current checkout.

## Browser source layout — 2026-11-11

This layout-only follow-up starts from develop `15e29db`. It moves the six
canonical browser media-advice modules from `assets/` to `src/media-advice/`:

| Module | Owner / purpose |
| --- | --- |
| `media-advice.mjs` | Browser dialog/controller and exact selected-address preview/transfer |
| `media-advice-entry-access.mjs` | Early, session-scoped capability preparation and invalidation |
| `media-advice-presentation.mjs` | Pure service, offer and source-language presentation |
| `media-advice-link-choices.mjs` | Navigation-equivalence grouping and original link selection |
| `media-advice-icons.mjs` | Local service-icon warming, load state and bounded fallback |
| `media-advice-report.mjs` | Protected, allowlisted diagnostics and source details |

`src/media-advice/` is one focused browser-source directory, not a new runtime
layer or package. It distinguishes executable application code from artwork
without moving `app.js`, `shared/`, server libraries or unrelated product code.
Sibling module names and exports stay the same; imports of shared policies now
resolve two levels upward. Existing image, icon, GIF and TMDb attribution URLs
remain under `/assets/`.

```text
app.js
├─ src/media-advice/media-advice-entry-access.mjs
└─ src/media-advice/media-advice.mjs
   ├─ sibling presentation / link-choices / icons / report modules
   └─ shared policies via ../../shared/

build-site.mjs → .site-dist/src/media-advice/<six canonical modules>
              → .site-dist/assets/<six legacy ESM forwarders>
              → unchanged /assets/ artwork, /shared/ and site resources
```

The publication builder admits the **six explicit module paths**, not every
present or future file under `src/`. The old `/assets/media-advice*.mjs` URLs
are generated ESM forwarders to those canonical modules so an already-open page
can still resolve a delayed old import after the new publication. They preserve
exports without copying implementation bodies. They are not source-controlled
compatibility implementations or an alternative import path for new code.
Static inspection should use the built `.site-dist`, as in the README; a raw
checkout is not the generated public compatibility surface.

This compatibility scope does **not** promise atomic replacement of arbitrary
cached old code or prove every browser/CDN version combination. The review must
check the built old-URL import graph, forwarding/canonical binding identity, unchanged
canonical behavior, selected-link/preview/exact transfer and resource URLs,
alongside runtime/fixture/history boundaries and repeated publication cleanup.
Passing a static build alone is not evidence of those browser scenarios or live
source access; actual commands, results and unavailable cases belong in this
change's PR report. No new live-source, database, deployment or release outcome
is asserted by this layout record.

`test/media-advice-layout-browser.test.mjs` pins its path-only comparison and
authored retained-document source to v1.4.0 commit
`15e29db04cf536c707a7d7dfba713affd57cac2c`. A shallow checkout must explicitly
fetch that object if absent; the failure names the command, without skipping,
fetching automatically or comparing current code against itself. Cached browser
module-map retention is distinct from general HTTP/CDN cache validation, and an
already evaluated old module intentionally remains its own old namespace.

Earlier diagrams, resource counts and `assets/media-advice*.mjs` source paths
below describe their pinned cleanup stages. They are preserved as historical
evidence, not silently rewritten to make an old Git tree resemble this layout.
The dated path references in the M4 runbook and release archives likewise
retain their original meaning. Current source consumers use `src/media-advice/`;
historical comparisons continue to read their exact old Git paths and bodies.

## Current operator scope — 2026-11-10

At verified develop `890f3a9ada0bedcfc91898d7832fa6fa9ea4cfc5`, `scripts/`
contains **two build tools and fourteen operator files**, not a current
release-validation suite. The retained Windows credential/IPC tools are not
the retired Windows/LAN demo launcher. Recovery tooling lives separately in
`supabase/operations/`; the older structure table's broad “recovery workflows”
label for `scripts/` does not relocate or replace that recovery chain.

| Retained files | Purpose and present limitation |
| --- | --- |
| [`build-site.mjs`](../scripts/build-site.mjs), [`stamp-media-advice-build.mjs`](../scripts/stamp-media-advice-build.mjs) | Current publication build and develop-only attestation. These write generated output/stamp files; they are not read-only diagnostic commands. |
| [`m4-control-credentials.mjs`](../scripts/m4-control-credentials.mjs), [`m4-url-diagnostics.mjs`](../scripts/m4-url-diagnostics.mjs) | Shared memory-only credential and sanitized address-analysis helpers used by controlled studies and their authored tests; not release validators themselves. |
| [`m4-control-password-prompt.ps1`](../scripts/m4-control-password-prompt.ps1), [`m4-read-control-result.ps1`](../scripts/m4-read-control-result.ps1), [`m4-practical-session.ps1`](../scripts/m4-practical-session.ps1), [`m4-practical-request.ps1`](../scripts/m4-practical-request.ps1) | Explicit operator entrypoints, hidden credential input and local IPC/result handling. Preserve reviewed-checkout/ExpectedCommit fences and credential lifecycle; a working IPC test is not evidence of live source or server authorization behavior. |
| [`m4-control-diagnostic.mjs`](../scripts/m4-control-diagnostic.mjs), [`m4-director-person-diagnostic.mjs`](../scripts/m4-director-person-diagnostic.mjs) | Fixed-film source/address and director-profile investigations. Their selected examples/projections are study-specific, not replacements for runtime identity gates or a general release checklist. |
| [`m4-fockers-control.mjs`](../scripts/m4-fockers-control.mjs) | Historical cap10/cap12 studies, including the eight-film cap12 series and in-memory cap10 replay. The cap12 series omits `tmdb-providers` and `motn-title`, so its local maximum is ten source attempts, not an attested server cap12 ledger session. Its report explicitly says `serverLedgerCapAttested: false`. |
| [`m4-practical-series.mjs`](../scripts/m4-practical-series.mjs) | Historical practical series: even the mode named `production-beta` passes `sourceCap: 10`. The name does not make this a validator for the current cap14/global-access release. |
| [`m4-cascade-comparison.mjs`](../scripts/m4-cascade-comparison.mjs), [`m4-predicted-controls.mjs`](../scripts/m4-predicted-controls.mjs) | Historical Git-pinned comparisons and sanitized study replay/control. Preserve original commits, historical `research` paths, manifest hashes and reviewed-source fences; these paths refer to Git objects, not a missing current demo dependency. |
| [`m4-pilot-page-inspection.mjs`](../scripts/m4-pilot-page-inspection.mjs), [`m4-profile-markup-inspection.mjs`](../scripts/m4-profile-markup-inspection.mjs) | Explicit bounded page/profile investigation tools. The first is a fixed three-card pilot inspector; the second inspects one profile's markup. Neither proves current end-to-end release readiness. |

No operator is run automatically as a release prerequisite. A new live study
needs an agreed film/target, reviewed source revision, source/credit/time
budget and safe-output plan before credentials or HTTP are used. Never infer
permission to repeat a live call from a missing result. Local authored tests
and static publication checks are described separately in the [README](../README.md#build-and-test-commands).

The current application remains cap14 with legacy cap8/10/12 compatibility;
retaining these studies does not change that contract. For access, migration
execution and recovery evidence use the [current runbook](m4-media-advice.md),
not an old pilot activation recipe. Historical SHA prerequisites below remain
unchanged, including the frozen `42b4b849…` baseline and the operator comparison
pins. [Physical-media work](m4-physical-media-handoff.md) remains deferred and
recoverable from Git; none of these streaming studies integrates it into beta.

## Historical cleanup checkpoints

Stage 1 separates the code used by the deployed Function from the research
demo. It does not retire the demo, change source rules, clean deployment output,
apply SQL, or authorize a release. The baseline is committed develop
`42b4b849d77281e1660701500c7bba9e6ec44b02`; main was
`e92392856038e40e6d98c6c8744eed04c4e8dff9`. Both match the owner's starting
context. Release PR #234 and publish-output PR #235 were open drafts. This
branch starts from develop, not #235 or an uncommitted experimental checkout.

## Runtime ownership

Six generic modules now belong to the existing `netlify/lib` directory:

| Module | Responsibility | Deliberately left in research |
| --- | --- | --- |
| `media-source-tmdb.mjs` | Bounded JSON transport, selected-ID identity/metadata and UA-provider projection | Fixed film catalogue, scenario selection, fixed-film wrappers and synthetic responses |
| `media-source-motn.mjs` | Bounded official-API transport and independent source/offer/language projection | Fixed films, scenario selection and authored API responses |
| `media-discovery-compose.mjs` | Provider mapping/conflict checks and stable source-scoped result composition | Demo discovery orchestration, fixed URL fallbacks and synthetic data generation |
| `kinobaza-card.mjs` | URL admission, film identity and one bounded assisted card read/deferred extraction | Demo workflow/session/CLI orchestration |
| `kinobaza-html.mjs` | Bounded DOM/provider/localization extraction with a caller-supplied identity gate | Fixed-film identity, fixed URL catalogue and canonical-hop probe |
| `kinobaza-localization.mjs` | Source-block language evidence and scope/ambiguity handling | Authored HTML fixtures |

No new permanent directory or dependency package is introduced. Existing
`netlify/lib` owns server implementations, `shared` retains its existing pure
cross-boundary policies, and `assets/icons` owns browser artwork. Browser code
does not import server code. Transport headers, issue/audit text, source
ordering, limits and unknown/conflict interpretation are intentionally retained.
The parser is resolved at its runtime owner using the existing root lockfile.
Missing-parser diagnostics now point to that root installation, not research.

```text
netlify/functions/media-advice.mjs
├─ lib/media-advice-service.mjs
│  ├─ media-source-tmdb.mjs
│  ├─ media-source-motn.mjs
│  └─ media-discovery-compose.mjs → shared/media-link-policy.mjs
└─ lib/kinobaza-resolver.mjs
   ├─ kinobaza-card.mjs → kinobaza-html.mjs → kinobaza-localization.mjs
   ├─ kinobaza-director-verifier.mjs → media-source-tmdb.mjs
   ├─ kinobaza-predicted-url.mjs → kinobaza-card.mjs
   └─ existing shared identity/URL/diagnostic policies

app.js → assets/media-advice*.mjs → existing shared policies
         └─ /assets/icons/tmdb.svg

research demo/tests → compatibility wrappers → server modules
                     (never the reverse)
```

The Function previously loaded **11 research modules**, including unused demo
catalogue/configuration/prompt/synthetic imports. The same lexical graph audit
now finds zero research nodes, including re-exports and literal dynamic imports:

| Graph | Baseline local modules / edges / research modules | Stage 1 |
| --- | --- | --- |
| Function entry | 32 / 56 / 11 | 27 / 36 / 0 |
| Entry plus every server library | 33 / 58 / 11 | 28 / 38 / 0 |
| Browser entries | 17 / 13 / 0, plus the research logo | 17 / 13 / 0, asset under `assets` |

Edges include package/builtin imports; module counts cover repository files.
The regression scanner supports this repository's JavaScript, not arbitrary
TypeScript/JSX. It rejects unresolved dynamic import expressions, missing local
modules and research traversal; authored negative graphs check static, dynamic,
re-export, encoded-path and nested-template cases. Strings/comments/regex bodies
are not imports. It is an ownership regression guard, not a JavaScript security
sandbox or a replacement for the Netlify bundle check.

The TMDb SVG's repository-normalized Git object remains
`b1baec94bf2ccaab4ec98fd20119c79fbce49a77`. Its old demo copy is retained for
the separate demo. The product changes only the resource path; alt `TMDB`, width
110, the official source link and non-endorsement attribution remain unchanged.

### Compatibility boundaries

The old research entry paths remain import-compatible. Shared implementation
is not duplicated: demo-only wrappers retain their fixed catalogue/scenario
defaults and delegate generic work to the server modules. Demo composition's
four source-URL/provenance fallbacks remain lazy. Production already provides
source URLs and card provenance. Production assisted reads always provide the
independent identity callback; the generic extractor cannot confirm a film when
that callback is absent. The demo wrapper alone retains fixed-film identity.

Existing product tests now import generic TMDb/MOTN/card exports from their
server owner; useful authored fixtures remain test-only in research for stage 2.
Static no-logging/storage/extra-fetch tests inspect both the wrapper and the
extracted adapter, retaining the same assertions. Only logo-path assertions
change in presentation/browser tests. No source, access, identity or budget
assertion is weakened.

## Stage 2 inventory

Counts are from tracked baseline files, not temporary worktrees, dependencies,
private recovery directories, secret handoffs or uncommitted experiments.
Baseline has **349 files**. The following disjoint groups cover **283**;
the remaining 66 are existing application/integration files, not deletion
candidates. Initial Stage 1 HEAD `4ec3cef` added six server modules, one SVG,
two test suites and this inventory: **359 files**. Review fixes add two
regression suites and one test-only history helper: **362 files**, with no
tracked file deletion.

| Group | Baseline count | Stage 1 count | Next-stage decision and dependency |
| --- | ---: | ---: | --- |
| `research/grounded-answer-demo` | 96 | 96 | Retain temporarily; extract useful fixture/contracts before retiring demo orchestration |
| Root `test` | 81 | 86 | Keep product/security regression coverage; relocate pilot fixtures deliberately |
| Recovery `tests` | 4 | 4 | Keep with supported recovery chain |
| `scripts` | 15 | 15 | Keep build stamp; individually review 14 local controls |
| M4 migrations | 7 | 7 | Keep all seven, including applied versions |
| `supabase/operations` | 34 | 34 | Keep rollback/cleanup/recovery; label superseded runbooks rather than deleting blindly |
| M4 documentation | 2 | 3 | Extract current contract/runbook before archiving chronological evidence |
| Product M4 runtime/resources | 44 | 51 | Keep: these are product code/artwork, not pilot leftovers |
| **Disjoint M4/test/operator total** | **283** | **296** | Other application files remain 66 |

Mixed integration surfaces (`app.js`, `app.html`, `styles.css`, `README.md`,
package files, `.gitignore`, `netlify.toml` and baseline assets) remain in place.
This inventory is not approval to remove anything in those files.

### Research 96 files

| Subgroup | Count | Purpose and recommendation |
| --- | ---: | --- |
| Root metadata/docs | 4 | `.gitignore`, README and two package files; retain while demo remains runnable |
| Root modules | 17 | Six compatibility/mixed wrappers plus demo config, server, scenarios, workflow and synthetic generators; archive retired demo code in Git history only after consumers move |
| Public demo | 13 | Demo HTML/CSS, ten client/display modules and SVG; retire demo UI as one reviewed change, retaining needed contract tests and product artwork |
| Research docs | 10 | Checkpoints, owner validation, M2/M3/TMDb/URL handoffs and launch diagnosis; extract active restrictions and repair links before Git-history archival |
| Research tests | 47 | 31 JS suites, ten fixtures, five PowerShell files and one C# probe; retain reusable contracts, retire launcher/UI-specific tests with their retired feature |
| Windows launcher | 5 | `Common.ps1`, `DetachedProcess.cs`, Start/Status/Stop; retain until demo launcher support is deliberately retired |

Seventeen root modules:

```text
assisted-kinobaza.mjs  config.mjs  discovery.mjs
film-workflow-synthetic.mjs  film-workflow.mjs  held-out.mjs
html-source.mjs  kinobaza-localization.mjs  matching.mjs
megogo-synthetic.mjs  megogo.mjs  motn.mjs  network.mjs
server.mjs  synthetic.mjs  tmdb.mjs  url-context.mjs
```

The ten test fixtures are assisted-kinobaza, assisted-title-boundaries,
discovery-launch, film-workflow, kinobaza-localization, megogo-launch,
motn-launch, mykola, recommendation-markup and tmdb-launch. At baseline,
**29 root test files directly consume four** of them: assisted-kinobaza,
film-workflow, kinobaza-localization and recommendation-markup. The new parity
and clean-install suites add two consumers (31 total). Their transitive demo dependencies must also be
accounted for before moving/deleting `research/test`.

The 31 JS research suites include source adapter, HTML/localization, identity,
URL, provider-grouping and composition contracts as well as demo UI checks.
Twelve filenames explicitly say browser; this does not make the other contract
tests disposable. Windows material comprises `JobProbe.cs`,
`launch-diagnostics.test.ps1`, `launch-matrix.ps1`, `launch-probe.fixture.ps1`,
`start-helper.fixture.ps1` and `windows.test.ps1`.

Research documentation:

```text
checkpoint-174.md  consolidated-poc-handoff.md  digital-ua-owner-validation.md
iphone-windows.md  m2-offer-matching-handoff.md  m3-arbitrary-film-handoff.md
regional-card-proposal.md  tmdb-probe-handoff.md  url-context-poc.md
windows-launch-diagnosis.md
```

`docs/m4-media-advice.md` still links to `regional-card-proposal.md`; archiving
without reconciling that reference would strand a policy dependency.

### Root tests and local controls

Root baseline tests comprise 75 suites and six DB/group fixtures. Six suites
cover operator controls (credentials, Fockers, practical pipe/series, predicted
controls and URL diagnostics); 69 cover product/source/security/identity/UI
behavior. Nine browser and six native PostgreSQL suites are overlapping
attributes, not additional files. Stage 1 adds boundary, frozen-parity,
clean-install and history-guard suites plus the test-only history helper.

Keep `scripts/stamp-media-advice-build.mjs`: it is required build provenance.
Review the other 14 scripts independently:

```text
m4-cascade-comparison.mjs  m4-control-credentials.mjs
m4-control-diagnostic.mjs  m4-control-password-prompt.ps1
m4-director-person-diagnostic.mjs  m4-fockers-control.mjs
m4-pilot-page-inspection.mjs  m4-practical-request.ps1
m4-practical-series.mjs  m4-practical-session.ps1
m4-predicted-controls.mjs  m4-profile-markup-inspection.mjs
m4-read-control-result.ps1  m4-url-diagnostics.mjs
```

Retain supported controls under clearly documented operator ownership; archive
obsolete one-shot investigations in Git history only after deciding which
reproduction evidence remains needed. None belongs in the public runtime.

### Migrations and operational recovery

Keep all seven M4 migrations. Application is not permission to delete history:
fresh provisioning, mixed cap8/10/12/14 tests and recovery depend on the chain.

```text
20261020205122_media_advice_access_ledger.sql
20261021072002_media_advice_review_fixes.sql
20261031135149_media_advice_beta_ua.sql
20261101180436_media_advice_identity_budget.sql
20261102181617_media_advice_exact_reserve_budget.sql
20261104210025_media_advice_predicted_card_budget.sql
20261108185237_media_advice_global_access.sql
```

The seven M4 operation SQL files are Beta activate/preflight/postcheck/rollback,
cleanup execution/scheduling, and global-access preflight. Preserve rollback,
cleanup and current preflight unless a reviewed replacement exists. Retained
legacy activation is not an instruction to run it against current production.

The other **27 operation files** are the recovery chain: ACL checks, archive,
audit (`.mjs`/`.ps1`), pg-net build/source, client17/curl source, export
(`.mjs`/`.ps1`), focus/native focus, guest scripts, local validation/cleanup,
OCI layout, password prompt, schema compare/supplement, software ISO, target
inventory/relationships, and VM assets/runner. Keep this encrypted export →
authenticated read → local/native/VM verification → schema/ACL comparison chain
until a documented and tested replacement exists. Preserve the four associated
`tests/recovery-*` JS/PowerShell tests. This inventory contains no backup, key,
credential or private report.

### Documentation and product resources

`docs/m4-media-advice.md` mixes current contracts/runbooks with dated decisions
and source evidence. `docs/m4-platform-summary-pilot.md` has a pilot name but
contains current compact-table, source-language, link-choice and preview/transfer
rules. Extract authoritative current guidance before archiving either wholesale.

The 44 baseline product resources are one Function, 11 server libraries, ten
shared policies, six `assets/media-advice*.mjs` modules, Mykola's GIF and 15
service-icon/source files. Stage 1 adds seven product files, not a new subsystem.

## Historical and standalone tooling

`m4-cascade-comparison.mjs` reads the original research card module at
`5a9c3c38f892644d04988d9055e3463fc6b9b86b` and
`21d1be24acf2b654254c38c9b252246ed8de1343`. `m4-predicted-controls.mjs`
reads three pinned modules at `7a9754d6431426a86ea9c3843a11c97f28210c4c`.
Their historical Git paths are unchanged; current relative dependencies resolve
through the compatibility wrappers. Predicted-control dirty-source coverage
now includes all six extracted modules, so moving code does not bypass its
reviewed-commit fence. Actual authored loader tests, not just syntax checking,
are required.

The group-entry browser test reads old app/assets/shared bytes with Git
`ls-tree`/`cat-file`; this historical baseline is not replaced with current UI.
Windows launcher integration explicitly exports a standalone demo tree. Its
copy manifest now includes the six runtime modules and ten shared policies;
parser packages live at the disposable repository root so both import owners
resolve them. Existing launch/restart/refusal assertions remain intact.

## Validation and release boundary

### Supported clean installation and pinned history

From the repository root, install the existing locked dependencies:

```text
npm ci --ignore-scripts --no-audit --no-fund
node --test research/grounded-answer-demo/test/html-source.test.mjs
```

This is the maintained setup for the retained HTML/Kinobaza/MEGOGO demo and
the root tests. No nested install is required. The old research-only `--prefix`
command does not install a parser visible to `netlify/lib`; it is insufficient
after separation. The unchanged root manifest/lockfile already pins `parse5`
8.0.1. Older named pilot checkouts retain their historical setup; current demo
README, iPhone guide and source-handoff notes explicitly distinguish them.
Installing packages does not start a server or authorize a live source request.

The frozen parity suite additionally requires Git and the actual baseline
commit **42b4b849d77281e1660701500c7bba9e6ec44b02**, including nine source files,
in the local object database. A normal full clone containing develop history
already satisfies this. A depth-1 clone often does not. Check/prepare explicitly:

```text
git cat-file -e "42b4b849d77281e1660701500c7bba9e6ec44b02^{commit}"
git fetch origin 42b4b849d77281e1660701500c7bba9e6ec44b02
node --test test/media-advice-runtime-parity.test.mjs
```

Fetch only if the object is absent. If the remote refuses a pinned-SHA fetch,
use `git fetch --unshallow origin` for a shallow checkout (or fetch develop
history in a full checkout), verify the exact object, then rerun. This is an
explicit operator Git action, not an automatic test network request. Git
source archives without `.git` cannot run frozen parity; use a Git checkout.

The test preloads the pinned commit and all nine required files before any
frozen module executes. Missing history/files fail nonzero with a sanitized
`M4_FROZEN_BASELINE_UNAVAILABLE` error and these commands. There is no silent
skip, automatic fetch, missing-file workaround or current-implementation
substitute. The focused guard tests cover absent commit, each missing file,
fixed repository cwd/command order and suppression of raw Git stderr.

### Initial Stage 1 validation at 4ec3cef

The comparison uses authored transport, parser/API fixtures and local browser
routes. It is not live TMDb/MOTN/Kinobaza/Tavily coverage or a reconstruction of
historical source responses. External source HTTP and API credits are zero.
No user data, Supabase objects/flags, secrets or Netlify configuration changed.

Baseline broad suite: **1495 pass, 0 fail, 28 skip**, 175.29s. Exact command:

```text
node --test --test-concurrency=1 --test-skip-pattern="native local pipe|full fake-key broker" --test-reporter=tap --test-reporter-destination=../m4-runtime-separation-baseline-validated.tap "test/*.test.mjs" "research/grounded-answer-demo/test/*.test.mjs"
```

The two named Windows pipe/broker controls are excluded from this broad run;
22 browser and six native-PG opt-ins are skipped without their module settings.
A default sandbox attempt failed to spawn Node workers (EPERM) before execution;
the reported baseline is the subsequent successful authorized worker run.
The two IPC controls were then run separately with fake keys and zero source
HTTP: **2/2 before and after**, no skips (24.47s / 25.01s), using
`node --test --test-concurrency=1 --test-timeout=90000 test/m4-practical-pipe.test.mjs`.
This verifies local authorization/reconnect/stop, not a real SSH session.

Frozen parity reads implementations from the committed baseline, not another
dirty checkout. It compares bounded requests/reservations, projections, HTML
identity/localization and composed rows/links, including cap8/10/12/14 and both
ordinary/diagnostic modes. Only local `receivedAt`/`elapsedMs` observations are
excluded from equality; source values, ordering, claims, URLs and issue codes
are compared exactly. Projection tests use an explicit common timestamp.

Initial after-run: 1498 pass, three failures, 28 skip. The failures identified
two static tests still scanning old adapter files and one old logo-path
expectation. They were adapted to the new file ownership without relaxing
their no-storage/no-logging/one-fetch/attribution assertions.

Final broad after-run: **1507 pass, 0 fail, 28 skip**, 232.21s, using the same
command and `../m4-runtime-separation-after-final.tap` output. All baseline test
names and skipped names remain; the 12 additions are six boundary and six
frozen-equivalence tests. Durations are local observations under concurrent
test load, not a performance comparison. Node was 24.22.0, npm 11.19.1;
dependencies were installed from the existing cache with
`npm ci --offline --ignore-scripts --no-audit --no-fund`.

The same four explicit browser suites pass **29/29 before and after**, without
skips (146.88s / 159.54s). Set `PLAYWRIGHT_MODULE_PATH` to the installed
Playwright module and `PLAYWRIGHT_CHANNEL=msedge`, then run:

```text
node --test --test-concurrency=1 test/media-advice-apple-subscription-browser.test.mjs test/media-link-card-grouping-browser.test.mjs test/media-advice-scoped-negative-browser.test.mjs test/media-advice-availability-browser.test.mjs
```

They use the real local app at mobile 375px and desktop 1280px with authored
auth/source/database routes: subscription/Store, same/different/unknown cards,
negative/unknown/conflicting language claims, selection, preview, exact-URL
transfer and ordinary Save. The full dialog suite additionally passes after
extraction at 375px and 1280px (**2/2 each**, 38.27s / 29.46s):
`M4_BROWSER_WIDTH=<width> node --test test/media-advice-browser.test.mjs`
(set that variable using the host shell). It checks the new logo path and
unchanged attribution. These are headless Edge viewport checks, not physical
iPhone/Safari or assistive-technology testing.

The standalone Windows launcher control passes after extraction in each of
`-Discovery`, `-Html` and `-Tmdb` modes:

```text
pwsh -NoProfile -File research/grounded-answer-demo/test/windows.test.ps1 -Discovery
```

Run each mode separately. It checks detached parent-exit survival, scenario
inheritance, duplicate-start refusal, identity refusal, scoped stop and restart
with synthetic/fake-key intercepted transport. A configured baseline
`-Discovery` run fails at child startup: its old standalone-copy manifest
includes only `shared/media-link-policy.mjs`, but the copied card module
statically requires six additional shared policies. That incomplete copy graph
is verified separately; the child's exact first error was not retained after
fixture cleanup. The new explicit manifest closes that packaging gap rather
than deleting the test. A combined `-Html -Tmdb` invocation is deliberately
rejected by the existing mutually exclusive-mode guard. SSH disconnect and the
complete launcher matrix were not tested.

Automatic Preview status is recorded in the PR report. No successful build
implies a live source search. No token or redirect-context setting is changed
for this stage. If a later live authenticated Preview scenario is approved,
its required function-scoped source keys and allowed Supabase Auth callback
context must be checked separately, without posting values in chat.

Stage 1 stops at a draft PR into develop. Stage 2 inventory decisions, public
publish-output hardening (#235), full release-diff review (#234) and any
production release remain separate owner decisions. A publish root that exposes
research/server source files is not fixed by moving imports; do not mistake
this ownership refactor for deployment isolation or source-policy approval.

## Root and publication review (read-only)

Rechecked main `e92392856038e40e6d98c6c8744eed04c4e8dff9`, develop
`42b4b849d77281e1660701500c7bba9e6ec44b02`, PR #236 initial head `4ec3cef`,
and PR #235 draft head `0261a8af63394a2725d1d35619003ea3fe51206d`.
No root object was moved/deleted, nor was #235/configuration changed.
Counts exclude installed packages, Git internals and private recovery data:

| Root object | main files | develop files | #236 after review fixes | Purpose |
| --- | ---: | ---: | ---: | --- |
| Root files | 10 | 13 | 13 | Site/PWA entrypoints plus project/build metadata |
| `assets` | 37 | 43 | 44 | Browser code and artwork |
| `docs` | 9 | 11 | 12 | Repository guidance and operational decisions |
| `netlify` | 3 | 15 | 21 | Functions and server libraries |
| `privacy`, `terms` | 2 | 2 | 2 | Public legal pages |
| `research` | 0 | 96 | 96 | Retained pilot, demo and test fixtures |
| `scripts` | 0 | 15 | 15 | Build stamp and local source controls |
| `shared` | 0 | 10 | 10 | Browser/server pure policies |
| `supabase` | 18 | 59 | 59 | Edge Functions, 23 migrations, 34 operations |
| `test` | 0 | 81 | 86 | Product/control tests and fixtures |
| `tests` | 0 | 4 | 4 | Recovery verification |
| **Total** | **79** | **349** | **362** | Initial #236 had 359; review adds three test files |

main → develop is 270 added + five modified files (275 total); initial
#236 → main spans 285 changed files, and the three review additions make 288.
Directory count is not a cleanup criterion: new runtime, tests, policies and
operational ownership explain much of the difference. New root files versus
main are `.gitignore`, `netlify.toml` and `package-lock.json`; keep them for
generated/private-file exclusion, attested develop builds and reproducibility.

| Object | Recommendation | Checked dependencies and consequence/risk |
| --- | --- | --- |
| Seven public root site/PWA files, legal pages | Keep URLs/layout; publish | HTML references, app/service-worker navigation and manifests; moving requires routing/cache/link review |
| Product `assets` and new TMDb logo | Keep and publish | Browser dynamic imports, icon paths/preloading, attribution; losing an asset breaks UI or branding |
| `netlify/functions`, `netlify/lib` | Keep in Git; exclude static publication | Function entry/import closure, root packages; exclude from publish, not from bundling |
| `shared` | Keep in Git; publish proven browser closure | Browser uses link policy, advice diagnostics, director-profile diagnostics and search-relevance diagnostics; server-only policies can be excluded from static output only after closure tests |
| Build stamp, package/lock/config | Keep; not static website files | Develop provenance, root parser install and reproducible tests; moving needs explicit build-path adaptations |
| Root product tests and pilot fixtures | Keep tests; move reusable fixtures in a later PR | 31 current root consumers of four pilot fixtures, frozen Git readers and explicit copy manifests; deleting research first would remove coverage |
| Research demo/launchers/dated source investigations | Exclude publication now; review retirement later | Demo wrappers, README/iPhone links, authored contracts and standalone-copy controls; archive obsolete code in Git history only after useful contracts move |
| Fourteen local controls | Review supported controls individually; exclude publication | Pinned historical modules, reviewed-commit fences, credential/IPC lifecycle; do not retire all merely because they were pilot work |
| Seven M4 migrations, seven M4 operation SQL files | Keep | Provisioning/history, access/RPC/cap compatibility, rollback/preflight/cleanup; applied history is not disposable |
| 27 recovery tools and four recovery tests | Keep until tested replacement | Export/read/schema/ACL/recovery chain; filename cleanup alone must not weaken recovery |
| M4 documentation | Separate active contract from dated evidence later | Existing internal policy/runbook links; repair references before archival |

### What #235 does and needs after #236

#235 changes four files: `.site-dist` ignore rule, explicit publish output,
allowlist-copy build script and publication test. It keeps repository files in
Git; it does not retire pilot code. Its checked allowlist produces **63 static
files from 351 tracked files**, excluding 288: seven root website/PWA files,
43 assets, ten shared policies, two legal pages and the legacy research logo
are included. Functions are bundled separately from the full checkout.

With #236's new logo, `assets` copying already includes `/assets/icons/tmdb.svg`.
Unadapted #235 also copies the now-unused
`research/grounded-answer-demo/public/tmdb-logo.svg`, giving 64 static files.
In a separate #235 update, remove only that obsolete output entry/assertion,
assert the new logo bytes/attribution and **no published research subtree**,
then verify browser import/asset closure and bundled Functions. This predicts
63 static files from this 362-file review tree (299 excluded); these are
allowlist-derived counts, not a claim that a combined deployment was executed.
All six runtime libraries stay in Git and outside static output.

#235 currently publishes all ten shared modules, while only four are direct
browser dependencies: `media-link-policy.mjs`, `media-advice-diagnostics.mjs`,
`director-profile-diagnostics.mjs`, `media-search-relevance-diagnostic.mjs`.
A tighter publication closure is an optional separate hardening decision, not
permission to delete the other six from Git. Preserve stamp-before-build order.

Existing main already has public-reference debt: `invite.html` names
`/assets/icons/site.webmanifest` (tracked manifest is `/site.webmanifest`),
`app.html` names untracked `/assets/icons/browserconfig.xml`, and index/invite
link `/terms.html` and `/privacy.html` while tracked pages are directory
`index.html` files. Reference inspection establishes these strings, not their
effective CDN destinations; redirects/settings were not inferred or changed.
Check them in a separate public-routing/resource task, not opportunistically here.

Recommended separate sequence: finish #236 review; adapt/test #235's output
against the final runtime/asset layout; extract useful fixtures/contracts and
retire only individually justified pilot material; recompute the complete
release diff and verify develop; then request the separate release decision.
None of these future stages is authorized by this report to merge or deploy.

## Review-fix verification record

The review reproduced a genuine clean-install gap hidden by the initial
worktree's root dependency installation. In separate clean baseline/initial-PR
copies, the old documented nested-only install and the same
`node --test --test-name-pattern="authored fixtures: exact href" research/grounded-answer-demo/test/html-source.test.mjs`
produce baseline **1 pass** versus initial #236 **1 fail**. Installing the
documented root dependencies in the latter makes that exact test **1 pass**.
The failing case has no matched identity because its runtime parser is absent;
no identity/source rules are changed to repair it.

The focused HTML/MEGOGO/discovery, server, historical-loader, boundary and
parity run passes **142 tests**, no failures/skips. The new disposable clean-tree
suite passes **4 tests**: missing-parser guidance before I/O, root-only parser
demo localization/fixed-card read, and retained assisted-card read with
independent identity. Each transport is authored/intercepted, not live.

Full/shallow committed-checkout verification, final broad/browser totals and
the new automatic Preview are recorded in the PR review-fix report after
execution. The test never fetches history itself. Live film-source HTTP and
credits remain zero. No package/lockfile, source/identity/URL rule, budget,
Supabase object/data/flag or Netlify configuration is changed by these fixes.

## Stage 2.1 — shared product fixtures

This is a separate fixture-ownership change based on verified
`origin/develop` **d94159db070c8f04f224def605f9bfbbee1fd172** (merged #235),
not a rewrite of the historical Stage 1 counts above. No product runtime,
public resource, source rule, identity gate, request budget, migration,
Supabase object, flag or Netlify configuration changes here. No demo is deleted.

### Ownership and dependency graph

| Canonical file in existing `test/` | Purpose | Baseline direct root / research references |
| --- | --- | ---: |
| `assisted-kinobaza.fixture.mjs` | Authored card identity, availability and provider blocks | 27 / 3 |
| `film-workflow.fixture.mjs` | Fictional API-shaped identities/offers and injected, bounded fake-key transport | 11 / 5 |
| `kinobaza-localization.fixture.mjs` | Authored language tables, captions, Netflix catalogue and Dune regression structures | 9 / 7 |
| `recommendation-markup.fixture.mjs` | Deliberately malformed unrelated recommendation/carousel | 2 / 1 |
| `kinobaza-html.fixture.mjs` | Minimal generic HTML scaffold plus the three shared authored film identities | Extracted transitive dependency, not a new production module |

Counts overlap. The four-name baseline union is **31 root files** (30 suites
and the group helper), plus **14 research references** (ten suites, two helper
fixtures, the Windows integration script and the assisted fixture itself).
The root group helper also feeds `media-advice.test.mjs` and
`media-advice-presentation.test.mjs`; the research Mykola helper feeds
`mykola.test.mjs` and `mykola-browser.test.mjs`. The assisted title-boundary
helper feeds the already-counted assisted suite. Literal dynamic imports and
standalone-copy manifests are included, not only top-level imports.

The localization fixture formerly pulled `synthetic.mjs → config.mjs →` the
whole mixed demo adapter/scenario graph. Moving its two imports unchanged
would therefore leave a transitive product-fixture dependency on research.
Only the generic `syntheticHtml` builder and three `FILMS` records are shared
now; prompts, scenario selection, synthetic model responses and orchestration
stay in research. The third catalogue entry remains for the retained demo;
there is one catalogue instance, not a second product/demo copy. All five
files are test data, never imported by production runtime or browser modules.
No permanent directory or production abstraction is added.

```text
product tests → test/assisted-kinobaza.fixture
                     → test/kinobaza-localization.fixture
                              → test/kinobaza-html.fixture
product tests → test/film-workflow.fixture (self-contained)
product tests → test/recommendation-markup.fixture (self-contained)
retained demo tests → four legacy re-exports → same canonical fixtures
demo config/synthetic → shared HTML scaffold/catalogue
production Function/browser → runtime/shared (no research or test edge)
```

Root consumers use canonical paths, including the group helper's dynamic
import and frozen-runtime-parity's authored inputs. Product tests using the
same catalogue/builder now import the shared scaffold directly. Four old
research fixture files are temporary two-line re-exports so retained demo
suites keep their paths and exactly the same function/value references.
Delete these wrappers only after their supported consumers move or retire.

The disposable clean-install manifest includes canonical assisted,
localization and HTML fixtures alongside the old wrappers. Every Windows
mode copies the shared HTML fixture because every mode imports demo config.
Discovery copies the self-contained canonical workflow implementation under
its existing `film-probe.fixture.mjs` name: renaming a relative re-export
would resolve incorrectly. The control's reviewed-source fence also includes
the new shared scaffold before credentials are obtained. Normal root
installation remains `npm ci --ignore-scripts --no-audit --no-fund`.

### Historical and unchanged boundaries

No historical Git path or SHA is rewritten. Cascade comparison still reads
the original assisted module at `5a9c3c…` / `21d1be…`; predicted comparison
reads three modules at `7a9754…`; frozen runtime parity reads nine sources at
`42b4b849d77281e1660701500c7bba9e6ec44b02`; group-entry browser checks retain
their historical app/assets/shared tree. None reads a historical version of
the four relocated fixtures directly. The added fixture parity test reads
their actual committed originals, the original HTML builder and catalogue
from that same fixed `42b4b849…` baseline; only comments, import paths and
the catalogue export name may differ. It does not replace old data with
current builders or silently skip a missing baseline.

For a shallow checkout, explicitly run
`git fetch origin 42b4b849d77281e1660701500c7bba9e6ec44b02` (or
`git fetch --unshallow origin`) before running both frozen parity suites.
Neither suite fetches automatically. The existing full/shallow prerequisite
and fail-closed history tests remain in force.

### Remaining research dependencies and next separate cleanup candidates

Research still has **96 tracked files**; replacement wrappers do not count
as deletion. Its six non-relocated fixtures, demo modules/UI/launchers,
documentation and package metadata are retained. All seven M4 migrations,
operation SQL, recovery tools/data contracts and their tests remain untouched.

| Candidate for a later stage | Dependencies / prerequisite; recommendation |
| --- | --- |
| Thirteen product test/helper files still importing demo APIs | `apple-subscription-mapping`; Kinobaza contextual, deferred, localized-identity, movie-director-group, Slevin, Roman, Ukrainian-g suites; media-advice browser, diagnostics, group helper, pipeline and platform-UI. Separate runtime-wrapper imports from scenario/catalogue helpers first; do not delete research beneath them. |
| Seven operator source consumers | Cascade comparison, control diagnostic, director-person diagnostic, Fockers control, practical series, predicted controls, URL diagnostics. Adapt current imports and reviewed-source fences separately; preserve pinned historical sources and credential lifecycle. |
| Four compatibility fixture paths | Ten direct demo suites and two helper fixtures still use them; retain until those consumers migrate or are intentionally retired. Windows uses canonical data in its disposable copy. |
| Six research-owned fixtures | `assisted-title-boundaries`, `mykola`, `discovery-launch`, `megogo-launch`, `motn-launch`, `tmdb-launch`. Evaluate reusable contract coverage separately from demo-specific launch adapters; keep supported launcher chains intact. |
| Demo UI and Windows launchers | Thirteen public demo files and five launcher files, plus their browser/integration tests. Retire together only after the remaining useful contracts and copy manifests are handled. |
| Ten demo documents and old SVG | Extract current contracts and repair links first; `docs/m4-media-advice.md` still links to `regional-card-proposal.md`. Runtime-boundary still compares the old logo bytes with `assets/icons/tmdb.svg`. |
| Seven M4 migrations, operation SQL and recovery | Keep: schema/history, cap compatibility, ACL/RPC and recovery obligations are not pilot clutter. No removal is proposed in this stage. |

Publication remains #235's allowlist: **62 static files**; root `test/`,
research, scripts, docs, migrations, server code and configuration are not
static output. Functions still bundle from the full checkout. The added
fixture-closure audit fails on static, re-export or literal dynamic imports
escaping the five-file test graph; the existing production audit still
rejects any direct/transitive/dynamic `research` or `test` dependency.

### Verification record

All source transports in these checks are authored/injected; film-source
HTTP and Tavily credits are **zero**. No live search, platform navigation,
SQL, migration or manual deployment is part of this verification.

| Check | Verified result |
| --- | --- |
| Paired affected product + all research suites + publication | Baseline **1171 pass / 0 fail / 14 skip**, current **1175 / 0 / 14**; 58.815s / 56.969s. Four new assertions/tests account for the difference. Fourteen opt-in browser suites are exercised separately where relevant, not claimed as browser passes here. |
| Extended non-DB root + research + publication | Baseline **1511 / 0 / 22**, current first concurrent run **1512 / 3 / 22**. Three Windows credential-helper startup/time-limit failures occurred during browser/broad concurrency; the unchanged entire credentials file immediately rerun separately gave **8 / 0 / 0**. These retries are not presented as a single all-green broad run. |
| Focused fixture parity, boundary, frozen runtime parity, clean installation, publication | **20 / 0 / 0**. Exact authored inputs/URLs, production export closure and unchanged results. |
| Actual shallow Git copy | Without pinned history, nonzero with explicit fetch instructions, no skipped parity/current-code fallback. After explicitly fetching `42b4b849…` from the local full repository, both fixture/runtime parity suites **8 / 0 / 0**; full repository parity also passes. |
| Native Windows demo standalone | `-Html` and `-Discovery` pass: detached start/status/duplicate-start refusal/unrelated-PID refusal/safe stop/restart; Discovery also checks fake-key fixed/dynamic assisted workflows. No SSH-disconnect test. |
| Product browser | Headless installed Edge on Windows: **11 / 0 / 0**. Actual local form/dialog at 1280×900, 375×812, 420×912 and 820×1180; ordinary/diagnostic link groups at 375/1280, Store-only, repeated selection, preview and exact-address transfer. |
| Six retained research browser suites | **62 / 4 / 5**: assisted 9/2/0, discovery 18/2/1, film-search 9/0/1, HTML 11/0/1, M2 9/0/1, Mykola 6/0/1. Five skips are missing WebKit; no download or real iPhone test. |
| Inherited browser failures, repeated on untouched baseline | Assisted **9 / 2 / 0**, discovery **18 / 2 / 1**, identical to current. Each counts one failing scenario and its parent. No assertions weakened. |
| Runtime / fixture graph | Server **28 modules / 38 edges**, browser **17 / 13**, no research/test edge. Canonical fixtures **5 modules / 2 edges**, no research/runtime/package/transport import. |
| Publication | **62 byte-equivalent public files**, 16 browser/shared modules evaluated; all **308** private tracked paths retained, including the seven M4 migrations. Stale/nested generated output cleaned on rebuild, source files unchanged. |
| Automatic Deploy Preview, implementation commit `587d723…` | Netlify **6af21b32dd8960fb0e97b554**, `ready`, `deploy-preview`, `manual_deploy=false`, matching commit. All four Functions available. Eight public paths returned 200 (five JS/SVG/PWA bodies equal local normalized bytes); fourteen private paths returned 404 with no source prefix, not a misleading 200 fallback. Guard-only Function GETs returned 405/400 without source calls. Final report-only HEAD Preview is checked in PR #237. |

The known `discovery-browser` `store-subscription` assertion expects the old
unmapped Apple TV+ state. The additional `assisted-kinobaza-browser`
`unresolved-director` fixture supplies a matching stable IMDb ID but expects
unresolved identity. Both fail on unmodified `d94159d`; neither is repaired
opportunistically by moving fixtures. Review these two stale demo contracts
explicitly in a later stage before treating their suites as green.

Reproduction uses the existing root locked setup
`npm ci --ignore-scripts --no-audit --no-fund` (these worktrees used
`--offline`, with an already populated package cache). From each worktree,
the paired test selection is the root `.test.mjs` files changed by this PR
(omit the newly added file only in the baseline where it does not exist),
plus `media-advice.test.mjs`, `media-advice-presentation.test.mjs`,
`media-advice-history.test.mjs`, every research `.test.mjs`, and
`tests/build-site.test.mjs`. Invocation:

```powershell
node --test --test-concurrency=1 --test-reporter=tap <selected-files>
node --test test/media-advice-fixture-parity.test.mjs test/media-advice-runtime-boundary.test.mjs test/media-advice-runtime-parity.test.mjs test/media-advice-demo-install.test.mjs tests/build-site.test.mjs
node --test test/m4-control-credentials.test.mjs
pwsh -NoProfile -File research/grounded-answer-demo/test/windows.test.ps1 -Html
pwsh -NoProfile -File research/grounded-answer-demo/test/windows.test.ps1 -Discovery
```

The extended non-DB selection is all root/research suites except root files
whose source matches `PGlite|pglite|POSTGRES` case-insensitively (one local
ledger SQL suite plus six native PostgreSQL suites), and uses
`--test-skip-pattern="native local pipe|full fake-key broker"` for two separate
unmodified IPC cases. No local or remote SQL is executed. Browser runs set
`PLAYWRIGHT_MODULE_PATH` to the already-installed Playwright module and
`PLAYWRIGHT_CHANNEL=msedge`, then use the same `node --test
--test-concurrency=1` invocation. The product pair is
`media-advice-browser` / `media-link-card-grouping-browser`; the six research
suites are `assisted-kinobaza-browser`, `discovery-browser`,
`film-search-browser`, `html-browser`, `m2-browser`, `mykola-browser`.
All timings reflect concurrent local workload, not a performance comparison.

Supabase Preview reports **skipped: PR database branching disabled**; no
Supabase setting is changed to enable it. Preview source search is deliberately
not exercised, so its secret contexts and authenticated redirect settings are
not attested. No additional secret/redirect change is required for these
static, bundle or mock-browser checks. A later live evaluation would need an
explicit scenario, the existing deploy-preview source-token context and its
permitted auth redirect URL reviewed separately, without putting keys in chat.

Updated existing root consumers (relative to `test/`; canonical fixture
definitions and the two graph/parity guards are listed separately above):

```text
apple-subscription-mapping.test.mjs       director-alias-crosswalk.test.mjs
kinobaza-cascade.test.mjs                 kinobaza-contextual-policy.test.mjs
kinobaza-deferred-extraction.test.mjs     kinobaza-director-selection.test.mjs
kinobaza-exact-reserve.test.mjs           kinobaza-localized-identity.test.mjs
kinobaza-movie-director-group.test.mjs    kinobaza-movie-sameas.test.mjs
kinobaza-predicted-reserve.test.mjs       kinobaza-resolver.test.mjs
kinobaza-second-query-policy.test.mjs    kinobaza-slevin-profile-pipeline.test.mjs
kinobaza-terminal-roman.test.mjs         kinobaza-title-year.test.mjs
kinobaza-ukrainian-g.test.mjs             m4-fockers-control.test.mjs
m4-practical-series.test.mjs             m4-predicted-controls.test.mjs
m4-url-diagnostics.test.mjs              media-advice-beta-response.test.mjs
media-advice-browser.test.mjs            media-advice-demo-install.test.mjs
media-advice-diagnostics.test.mjs        media-advice-group.fixture.mjs
media-advice-platform-ui.test.mjs        media-advice-report.test.mjs
media-advice-runtime-parity.test.mjs     media-advice-search-security.test.mjs
media-advice-server.test.mjs             media-search-relevance-diagnostic.test.mjs
```

## Stage 2.2 — current demo API dependencies

This section records the Stage 2.2 checkpoint. The four remaining product
dependencies and conditional deletion proposal below are superseded by
[Stage 2.3](#stage-23--remaining-product-identity-and-compatibility-retirement).

Based on verified `origin/develop`
**77565bbf9e9d2249913f6df367e87aa32ad437ed**, after #237. The Stage 2.1
inventory above is historical; the following is the new dependency state.
No production/runtime/browser/shared module, source/identity/access/URL rule,
request budget, package, Supabase object, secret, flag or Netlify configuration
changes here. No SQL, live source requests, manual deployment or release.
There are **no new permanent files/directories and no deleted files**.

### Product consumers: 18 current demo import edges → 4

All thirteen inventoried product test/helper files were inspected, including
the group helper's literal dynamic imports and its transitive UI consumers.
Eleven composer imports now use `netlify/lib/media-discovery-compose.mjs`;
two extractor imports whose callers already supply an independent
`identityCheck` now use `netlify/lib/kinobaza-html.mjs`. The group helper's
single MOTN fixed-catalogue lookup becomes the identical authored case input
`tt15239678`, not a new catalogue or a claim about a current API response.
Fourteen direct import edges are removed; nine files are demo-independent.

| Product file under `test/` | Result |
| --- | --- |
| `kinobaza-contextual-policy.test.mjs` | Runtime extractor; the existing explicit linked-person pointer callback is unchanged |
| `kinobaza-deferred-extraction.test.mjs` | Runtime extractor; existing independent/deferred identity callbacks are unchanged |
| `kinobaza-localized-identity.test.mjs` | Runtime composer; fetched assisted card already carries source evidence |
| `kinobaza-movie-director-group.test.mjs` | Same runtime composer replacement |
| `kinobaza-slevin-profile-pipeline.test.mjs` | Same runtime composer replacement |
| `kinobaza-terminal-roman.test.mjs` | Same runtime composer replacement |
| `kinobaza-ukrainian-g.test.mjs` | Same runtime composer replacement |
| `media-advice-diagnostics.test.mjs` | Runtime composer; existing explicit MOTN source URL retained |
| `media-advice-kinobaza-pipeline.test.mjs` | Runtime composer; assisted-card provenance retained |
| `apple-subscription-mapping.test.mjs` | Runtime composer/provider mapping; one fixed-demo extractor import remains |
| `media-advice-browser.test.mjs` | Runtime composer; one fixed-demo extractor import remains |
| `media-advice-platform-ui.test.mjs` | Runtime composer; one fixed-demo extractor import remains |
| `media-advice-group.fixture.mjs` | Runtime composer and local authored IMDb input; one fixed-demo extractor import remains |

The four remaining imports are deliberate, not overlooked. Their synthetic
HTML starts with an authored `SYNTHETIC` heading and relies on the demo's
fixed-film title/year/director checker. The runtime extractor deliberately
returns `identity-check-required` without a caller-provided product gate.
An import-only replacement, an always-matched callback or copying the old
pilot gate into a newly named helper would change or conceal that contract.
The retained gate still rejects a wrong director, with claims withheld.

Their exact current research closure is
`html-source.mjs → url-context.mjs / held-out.mjs → runtime extractor`.
Next action: separately rebase these four authored scenarios onto existing
product-shaped markup/selected-film metadata and explicit product identity,
with before/after source-result and UI-contract review. Do not retire the
fixed gate merely because the import path can be made shorter.

The old composer supplied lazy source-operation URLs and language provenance.
The four default-dependent callers now supply the **same values explicitly**:
Coherence TMDb `220289`, MOTN `tt2866360`, old
`https://kinobaza.com.ua/titles/coherence` / `dune-part-two` operation URLs,
the same synthetic method/upstream labels and the same `receivedAt` value
(including `undefined`). These are test evidence, not new network requests
or changed source URLs. Assisted-card callers already carry their own
`sourceURL` and localization provenance. Exact complete Dune helper output
is compared with its actual frozen original at `42b4b849…`, without timestamp,
URL, undefined-property or provenance normalization.

### Seven operators: 15 direct demo imports → 0

| Script under `scripts/` | Current runtime dependencies replacing demo imports |
| --- | --- |
| `m4-cascade-comparison.mjs` | HTML extractor and assisted identity |
| `m4-control-diagnostic.mjs` | TMDb read/projection and card admission |
| `m4-director-person-diagnostic.mjs` | TMDb read |
| `m4-fockers-control.mjs` | TMDb read/projection, card admission, composition |
| `m4-practical-series.mjs` | TMDb read/projection, card admission/read, composition |
| `m4-predicted-controls.mjs` | TMDb read/projection, card admission, composition |
| `m4-url-diagnostics.mjs` | Card admission |

The three operator composition callsites use fetched Kinobaza results with
their own source URL/provenance; no fixed-demo fallback used to execute.
URL spelling, reservations, timing/budget rules, no-retry behavior, credential
input/IPC handling and public-safe output schemas are unchanged.

Top-level import changes alone were insufficient: pinned assisted card code
still imported the **current** demo extractor, and the pinned verifier imported
the current demo TMDb wrapper. The existing loader URL-rebinding step now maps
only those two known delegation imports to their exact runtime equivalents.
All three pinned cards already pass their original independent `identityCheck`;
the verifier uses `readTmdbJson`, formerly a direct runtime re-export. Expected
rebinding counts are checked fail-closed before executing the pinned modules.

Original Git SHA and source-path strings remain unchanged:

- Cascade: `5a9c3c38f892644d04988d9055e3463fc6b9b86b` and
  `21d1be24acf2b654254c38c9b252246ed8de1343`, original research assisted path.
- Predicted comparison: `7a9754d6431426a86ea9c3843a11c97f28210c4c`, original
  assisted/verifier/resolver paths.
- Existing runtime/fixture parity: `42b4b849d77281e1660701500c7bba9e6ec44b02`.

Historical bodies/gates are not rewritten. Only dependency-loader URLs change.
The predicted-control reviewed-source manifest no longer includes unrelated
current research or the canonical test scaffold, because neither executes.
A recursive test checks every current and rebound historical dependency is
still fenced **before credentials are read**. A fresh module-hook child imports
all seven operators and all pinned loaders while refusing any current module
under `research/` or `test/`. Historical Git reads are not current-module imports.

### Intentional non-product and historical research use

Keep separate from the four product dependencies:

- `media-advice-demo-install.test.mjs`: retained demo installation and explicit
  disposable-copy manifests; purposefully tests the demo and compatibility paths.
- `media-advice-runtime-boundary.test.mjs`: legacy re-export identity, demo
  catalogue/scaffold compatibility, old/new logo equality and the explicit
  distinction between fixed demo identity and product identity requirements.
- `media-advice-fixture-parity.test.mjs`: reads immutable original fixtures and
  the original group input-builder through Git; rebases import URLs only.
- `media-advice-runtime-parity.test.mjs` / history fixture: original nine pinned
  implementation files, unchanged fail-closed history prerequisite.
- `m4-predicted-controls.test.mjs`: reads the small current demo delegation body
  as compatibility evidence with an injected runtime extractor and a failing
  default gate; it does not import demo orchestration. It also inspects the
  three pinned card bodies to verify their original explicit identity callbacks.
- Group-entry historical browser comparison and Windows launch-matrix remain
  intentional historical application/demo checks, not current product imports.

### Exact next-PR deletion proposal — conditional, not immediate

**No compatibility path is consumer-free today; the standalone safe-deletion
list is empty.** The following six paths are the bounded next proposal only
with their consumer/doc/manifest migrations in the same reviewed follow-up:

| Path under `research/grounded-answer-demo/` | Required before deletion |
| --- | --- |
| `assisted-kinobaza.mjs` | Redirect retained `film-workflow.mjs`, assisted/HTML-source tests and source-inspection assertion to runtime; update Windows and clean-install manifests; keep historical Git path strings |
| `kinobaza-localization.mjs` | Redirect its source-inspection test and copy manifests; repair references in `regional-card-proposal.md`, `m3-arbitrary-film-handoff.md`, `m2-offer-matching-handoff.md`, `consolidated-poc-handoff.md` |
| `test/assisted-kinobaza.fixture.mjs` | Redirect assisted unit/browser suites, title-boundary helper and root compatibility/clean-install guards to canonical fixture |
| `test/film-workflow.fixture.mjs` | Redirect assisted/workflow/search suites and root compatibility guard; preserve the canonical Windows renamed-copy behavior |
| `test/kinobaza-localization.fixture.mjs` | Redirect its six suites plus `mykola.fixture.mjs`, root compatibility guard and clean-install manifest |
| `test/recommendation-markup.fixture.mjs` | Redirect HTML-source suite and root compatibility guard |

Do **not** include `tmdb.mjs`, `motn.mjs`, `discovery.mjs` or `html-source.mjs`
in an isolated shim-deletion PR: these retain real fixed-scenario/orchestration
logic used by config/server/workflow, demo/browser/Windows tests and, for HTML,
the four remaining product consumers. The old SVG still serves demo display,
its handoff document and the boundary byte check. Keep it pending coordinated
demo retirement. Keep all seven M4 migrations, operation SQL, recovery tools,
operators and current documentation. Research remains **96 tracked files**.

### Verification

Fresh baseline/current worktrees used root
`npm ci --offline --ignore-scripts --no-audit --no-fund` with the locked local
package cache. No extra utility or browser was installed.

| Check | Result |
| --- | --- |
| Same targeted product/operator/demo/unit/publication selection | Baseline **927 pass / 0 fail / 14 skip**, current **932 / 0 / 14**; five added checks, existing assertions preserved. Timings 59.331s / 33.324s are not a benchmark. |
| Thirteen assigned product test/helper consumers | Twelve suites **273 / 0 / 1**; one opt-in browser placeholder, exercised separately |
| Product browser, installed Edge/Windows | **5 / 0 / 0**, all 1280×900, 375×812, 420×912, 820×1180: service/link selection, preview/apply, recovered language data, icon load/failure and diagnostics |
| Current retained demo browser | **38 / 4 / 2** across assisted/discovery/HTML: exactly the two known failing scenarios plus parents; missing WebKit accounts for both skips |
| Native Windows operator IPC/fake-key broker | **2 / 0 / 0**, no real key or source request |
| Production / fixture boundary | Server **28 modules / 38 edges**, browser **17 / 13**, no research/test node; canonical fixtures **5 / 2**. Nine migrated product suites also execute with current research modules forbidden. |
| Frozen parity / source metadata | Runtime parity passes; canonical fixture code and complete group result match immutable originals. Explicit-callback delegation covers matched/unresolved/mismatch and sync/async cases. |
| Clean demo install / publication | Pass: root parser setup and copy manifests retained; **62 exact static files**, 16 browser/shared modules, **308 tracked private files** preserved, repeated-build stale/nested cleanup and all seven M4 migrations retained. |

Paired selection uses `node --test --test-concurrency=1` on the twelve affected
product suites, `media-advice.test.mjs`, `media-advice-presentation.test.mjs`,
runtime/fixture boundary and parity, demo-install, Fockers/practical/predicted/
URL operator suites, `kinobaza-cascade.test.mjs`,
`director-person-diagnostic.test.mjs`, every research `.test.mjs` and
`tests/build-site.test.mjs`. Browser opt-in runs set existing
`PLAYWRIGHT_MODULE_PATH` and `PLAYWRIGHT_CHANNEL=msedge`; actual browser suites
are `test/media-advice-browser.test.mjs` plus demo `html-browser`,
`assisted-kinobaza-browser`, `discovery-browser`. Native operator check:
`node --test test/m4-practical-pipe.test.mjs`, fake keys/local IPC only.

The two demo-browser failures are unchanged `unresolved-director` (assisted
line 63, supplies matching stable IMDb but expects unresolved) and
`store-subscription` (discovery line 109, expects the obsolete unmapped Apple
TV+ state). The entire current research tree has zero diff from `77565bb…`;
these test files also match `d94159d…`, where both failures were reproduced in
Stage 2.1. That earlier baseline-browser run is historical evidence, not a
new baseline run in this stage. No assertion was weakened. No WebKit/real
iPhone, SSH-disconnect, authenticated Preview search or live platform check.

Automatic Preview identity, all-four-Function checks and read-only public /
private HTTP smoke results are recorded in this stage's draft PR after push.
No secret/redirect setting is needed for static/bundle/mock checks. A future
live search requires its own approved scenario and review of deploy-preview
token scopes/auth redirect context; no credential value is requested in chat.

## Stage 2.3 — remaining product identity and compatibility retirement

Verified starting `origin/develop` is the expected post-#238 commit
`39187a30488b931ecd19a18e7943f347567893bd`. Work uses a fresh branch and an
independent baseline worktree, not an earlier uncommitted experiment.
No production module, browser asset, source rule, request budget, access rule,
Supabase/Netlify configuration, operator implementation or migration changes.
No new permanent file, directory, package or duplicate data set is added.

### Four product consumers: fixed demo gate → actual product gate

The last four consumers were `apple-subscription-mapping.test.mjs`,
`media-advice-browser.test.mjs`, `media-advice-platform-ui.test.mjs` and
`media-advice-group.fixture.mjs` under root `test/`. They now share small
helpers in the existing group fixture: full authored selected-film metadata,
canonical-owned HTML and `extractHtml` with the actual runtime
`assistedIdentity` callback. The existing canonical HTML scaffold supplies
only authored data; its demo-only `SYNTHETIC` H1 prefix is removed rather
than admitted as an alias. No fixed-film gate is copied, and no result is
forced to `matched`.

Coherence/Dune lack source stable IDs in these authored inputs, so the valid
route really checks title, original title, year **and director**. New negative
cases mutate H1, H2, year, director, canonical, conflicting IMDb and duplicate
identity fields; each withholds pointers and language blocks. Other existing
identity suites retain their multiple-director, Movie.sameAs, crosswalk,
ambiguous/conflicting data and cap8/10/12/14 coverage.

Frozen `42b4b849…` group comparison still executes the original builder body.
Only its one known historical fixture import URL is rebound to the identical
canonical data, with an exact expected-rebinding count. Full selected-film
metadata and actual product identity evidence are the **two explicit result
differences**, individually asserted. All other result fields, all source
rows/order, language evidence, exact provider hrefs, source-operation URLs,
undefined fields and provenance remain deeply equal to the frozen result.
There is no broad timestamp/URL normalization or current-code baseline.

The current product-import guard now executes all thirteen assigned scenarios
and the Dune helper while refusing every current `research/` module, including
transitive imports. Production graph checks remain strict for unknown imports.
The separate retained demo fixed-film gate is still tested as a demo contract;
the runtime extractor still refuses a missing identity callback.

### Six deleted compatibility paths and migrated consumers

All paths below are relative to `research/grounded-answer-demo/`. Each was a
two-line re-export, not an implementation or a source-data archive.

| Deleted path | Consumers moved before deletion |
| --- | --- |
| `assisted-kinobaza.mjs` | `film-workflow.mjs`, assisted and HTML-source suites → `netlify/lib/kinobaza-card.mjs`; source-body assertion reads the real implementation; Windows/clean-install manifests updated |
| `kinobaza-localization.mjs` | Localization source-body assertion → runtime implementation; manifests and four handoff/proposal documents updated |
| `test/assisted-kinobaza.fixture.mjs` | Assisted unit/browser and title-boundary helper → root canonical fixture; clean-install manifest/probe updated |
| `test/film-workflow.fixture.mjs` | Assisted, film-search browser and workflow suites → root canonical fixture; Windows keeps its canonical self-contained renamed `film-probe.fixture.mjs` copy |
| `test/kinobaza-localization.fixture.mjs` | Localization, HTML, discovery, M2, provider-grouping and Mykola helpers/suites → root canonical fixture; disposable-copy manifests updated |
| `test/recommendation-markup.fixture.mjs` | HTML-source suite → root canonical fixture |

README and live documentation links name the new owners. The boundary guard
asserts all six old paths are absent and rejects literal references to them
in retained demo code, including import/readFile strings. Calculated demo
loaders are covered by actual clean-install/Windows copy execution, not claimed
as a fully static demo import graph. Canonical fixtures remain **5 files / 2
edges**, without research/runtime/packages/transport. Research is now **90
tracked files**, down from 96. Deleted wrappers remain recoverable from Git.

Original historical Git paths and SHA values in cascade/predicted operators,
history fixtures and frozen parity remain unchanged. Frozen runtime source
loading already binds its original dependencies to the actual pinned bodies;
it needs no current-wrapper fallback. No historical gate is rewritten.

### Verification and limitations

Locked offline setup in both fresh worktrees:
`npm ci --offline --ignore-scripts --no-audit --no-fund`.
The paired `node --test --test-concurrency=1` selection is the same selection
listed in Stage 2.2 above: 24 named root suites, every retained research
`.test.mjs`, and `tests/build-site.test.mjs`.

| Check | Result |
| --- | --- |
| Paired baseline / current broad selection | **932 pass / 0 fail / 14 skip** before; **933 / 0 / 14** after. One added gate-regression test; existing assertions preserved. 58.024s / 42.158s are local timings, not a performance claim. |
| Additional history / identity / resolver suites | **168 / 0 / 0**: history fail-closed, title/year, Movie.sameAs, director selection/verifier/reuse, resolver, exact and predicted reserve |
| Runtime/fixture boundary and frozen parity | **19 / 0 / 0**; server **28 modules / 38 edges**, browser **17 / 13**, no research/test dependency |
| Owned Apple/controller units | **47 / 0 / 0**, including subscription/Store, language signs/conflicts, source scope and exact selection/preview/transfer |
| Product browser, installed Edge on Windows | **5 / 0 / 0**, 1280×900, 375×812, 420×912, 820×1180; unchanged service/link/preview/transfer, recovered languages and icon checks |
| Retained demo browser, installed Edge | **38 / 4 / 2**, 76.189s. Only the known assisted `unresolved-director` and discovery `store-subscription` failures, each also failing its parent; HTML passes. Both skips are unavailable WebKit. Assertions unchanged. |
| Retained demo clean install + targeted unit suites | **218 / 0 / 0**, including actual runtime source-body assertions |
| Windows standalone copies | `pwsh -NoProfile -File research/grounded-answer-demo/test/windows.test.ps1 -Html` and `-Discovery`: both **PASS**; restart, parent exit, duplicate start, identity refusal and safe stop |
| Native operator IPC | `node --test test/m4-practical-pipe.test.mjs`: **2 / 0 / 0**, fake-key local broker only |
| Publication / repeated build | **62 exact public files**, 16 imported browser/shared modules, **302 tracked private files** preserved, all seven M4 migrations retained; stale/nested output cleanup passes |

Counts overlap and are not additive. The 14 broad-selection skips are opt-in
browser cases; dedicated browser runs use installed Edge via the existing
`PLAYWRIGHT_MODULE_PATH` / `PLAYWRIGHT_CHANNEL=msedge` hooks. No new browser or
utility is installed. Automatic Preview and dedicated retained-demo browser
results are recorded in the draft PR after push; a build does not prove live
source access. The known demo-browser baseline evidence is historical; the
baseline browser was not rerun in this stage. Only fixture import paths changed
in the two failing suites, not their assertions. No live film-source HTTP, API credit, platform visit, real key,
SQL, user-data mutation, migration, manual deploy or release was performed.
Real iPhone/WebKit and SSH-disconnect behavior are not verified here.

### Remaining dependencies and exact next cleanup candidates

There is **no further consumer-free deletion list** after these six wrappers.
The following are coordinated follow-up candidates, not deletion authorization:

| Candidate | Remaining dependency / required next action |
| --- | --- |
| Demo `html-source.mjs`, `tmdb.mjs`, `motn.mjs`, `discovery.mjs` | Real fixed-scenario/orchestration logic remains in config/server/workflow/public UI, tests and Windows modes. Retire or migrate useful contracts before retiring each mode. Product scenarios no longer import them. |
| Six demo-only fixtures | `assisted-title-boundaries.fixture.mjs` serves assisted tests; four `*-launch.fixture.mjs` files serve Windows renamed-server copies; `mykola.fixture.mjs` serves Mykola unit/browser modes and config/discovery/matching. Move only useful independent contracts before coordinated demo retirement. |
| `public/tmdb-logo.svg` | Still used by demo display, server route, TMDb test, root byte-parity guard and its handoff link. Coordinate retirement; the product uses `assets/icons/tmdb.svg`. |
| `config.mjs` / `synthetic.mjs` | Not empty wrappers: retain prompts, scenarios and synthetic-response generators. Do not remove merely because their shared data moved. |
| Root historical/demo checks | Demo-install, demo contract/logo boundary checks, frozen Git parity and historical operator-loader proofs remain intentional, distinct from a product dependency. `m4-predicted-controls.test.mjs` still reads the tiny demo callback delegate as evidence; move that proof only if the demo delegate is retired. |

Keep the seven M4 migrations, operation SQL, recovery and operator tools,
current documentation and canonical product fixtures. The next stage should
first select retained demo contracts/modes, then adapt their browser/Windows
and documentation dependencies, and only then propose bounded deletions.

## Local pilot retirement — 2026-11-09

The owner approved retirement of the local Windows/LAN/Termius demo, not a
change to streaming beta or a production release. Verified starting develop:
`f534dacba1b7377637fe4f00bf995e8145adcc8f` (after #239); main remains
`e92392856038e40e6d98c6c8744eed04c4e8dff9`.

### Preserved work and retired application

[Deferred physical-media handoff](m4-physical-media-handoff.md) is the permanent
standalone record: retailers and Marketplace, stock/price/seller/condition,
English audio and edition/disc rules, Final Cut, shipping exclusion, actual
Gemini PoC architecture, prompt-only versus checked guarantees, limited
owner-reported results and exact Git recovery references. No physical search
is added to Mykola. This compact document is new because the requirements and
evidence must survive without the old application/manuals; links alone would
not preserve the decisions.

All **90 files** under `research/grounded-answer-demo` are removed from this
checkout after consumers move: 19 root code/config/package files, 10 research
documents, 13 UI/assets, 43 tests/fixtures/Windows probes and five Windows
launcher files. This includes the server, fixed-scenario/Gemini orchestration,
legacy UI, LAN/Termius operation instructions, old demo logo and demo-only
test infrastructure. No remaining component requires current demo files.
The tree is recoverable at `f534dac…`; see the handoff for full-commit recovery,
not a second permanent demo copy or authorization to run live sources.

From this PR's checkout, the old demo **cannot start**: `server.mjs`, package,
UI and Start/Status/Stop launchers are absent. Existing processes or other
historical worktrees were not stopped, deleted or upgraded. Develop/main are
not modified until a separately authorized merge. Earlier launch commands in
this document and the implementation record are archival evidence only.

Useful coverage stays in product-owned tests:

| Retired contract | Preserved product coverage |
| --- | --- |
| HTML/localization parsing, channel suffixes, Netflix catalogue scope, table precedence, raw/exact URLs, candidate limits, malformed attribute recovery/refusal and bounded transport | New `test/kinobaza-source-contracts.test.mjs`: 41 tests, including all 25 authored title-boundary cases; real `assistedIdentity` / `fetchAssistedKinobaza`, existing canonical fixtures, no copied fixed gate or forced match |
| TMDb/MOTN projections, independent identity, malformed/missing responses, one-shot transport, composition/source claims | Frozen runtime parity plus existing source/server/identity-context/Apple mapping suites; synthetic responses remain test data, not live evidence |
| Link grouping/selection, source-scoped languages, preview and exact transfer | Existing media-link choices/card-grouping and media-advice presentation/controller/browser suites |
| Parser dependency resolution, missing parser failure and clean-layout source reading | Existing demo-install suite is renamed/adapted to `test/media-advice-runtime-install.test.mjs`; copies only runtime/shared/canonical data and locked parser packages, never demo code |
| Local LAN/basic-auth, PID/port/lifecycle and legacy multi-mode demo UI | Intentionally retire with the application; not represented as beta security/behavior coverage |

The source-contract test is the only new test file: a coherent home for useful
runtime contracts formerly mixed with server/UI/demo modes. No new directory,
package or production layer is introduced. Canonical fixture implementations
and the current product runtime remain unchanged.

### Historical parity and the two old browser failures

The nine original baseline entry paths and SHA `42b4b849…` remain unchanged.
Their reviewed **29-file historical dependency closure**, including original
shared helpers and circular config/discovery/synthetic wiring, is read from
Git into a disposable temporary tree only during tests. Only `parse5` package
resolution is rebound; relative paths, bodies, default identity gates and
input data are original. Missing historical dependencies fail closed rather
than resolving against current code. This is not relocating the 90-file demo.
Group parity retains the previously reviewed two differences (selected metadata
and actual product identity evidence); all other result fields, source rows,
order, languages, exact hrefs/provenance and undefined fields remain exact.

The logo byte comparison now reads Git; operator callback-delegation evidence
reads the last reviewed wrapper at `f534dac…`. Seven current operator scripts
and their credential fences/pinned comparison loaders are unchanged.
Full Git history is the simplest supported setup. Shallow users must explicitly
fetch required pinned objects before the applicable tests; runtime/fixture
parity requires `42b4b849d77281e1660701500c7bba9e6ec44b02`, operator proofs also
use `f534dacba1b7377637fe4f00bf995e8145adcc8f`,
`5a9c3c38f892644d04988d9055e3463fc6b9b86b`,
`21d1be24acf2b654254c38c9b252246ed8de1343` and
`7a9754d6431426a86ea9c3843a11c97f28210c4c`.
Tests never fetch automatically or substitute current implementations.

The two known demo-browser failures disappear **because their obsolete demo
application/scenarios are removed**, not because assertions were weakened:

- Assisted `unresolved-director` expected refusal despite a matching stable ID.
  The product's stable-ID/title/year acceptance and truthful skipped-director
  diagnostics remain checked in `kinobaza-cascade.test.mjs`, with conflicts and
  unowned IDs refused in cascade/Movie.sameAs/director suites.
- Discovery `store-subscription` expected Apple TV+ to be unmapped. Current
  subscription/Store separation, own-offer languages, single Apple display
  service, exact link selection/preview/transfer remain in
  `apple-subscription-mapping.test.mjs` and the Apple UI/browser suites.

### Verification

Fresh baseline/current root installs used
`npm ci --offline --ignore-scripts --no-audit --no-fund`; no utility/browser
installation, live film-source HTTP, API credit, actual platform visit or real
credential. No SQL (including local SQL tests), DB/user mutation, secrets,
flags, Supabase/Netlify config, manual deploy, merge or release action.

| Check | Result |
| --- | --- |
| Same controlled product/operator selection | Baseline **986 pass / 0 fail / 9 skip** in 66 root suites; current **1028 / 0 / 9** in 67. Added 41 source-contract tests and one history closure check; the install suite is a rename. 50.115s / 45.693s are local timings, not a speed claim. |
| Original baseline including every demo `.test.mjs` | **933 / 0 / 14**; historical comparison only. Retired demo-only checks are not counted as current beta coverage. |
| Affected history/boundary/parity/runtime-install/operator/publication selection | **42 / 0 / 0**, after deletion; parser absence/installation and negative card identity tested in clean layouts |
| Product source contracts + cascade/localized identity/Apple mapping | **129 / 0 / 0**; new source-contract file alone **41 / 0 / 0** |
| Installed Edge product + Apple subscription browser | **10 / 0 / 0**, both suites at 375×812, 420×912, 820×1180, 1280×900; own-offer languages, mixed subscription/Store, exact selection/preview/apply/local Save, diagnostics and icon failure |
| Production / fixture boundary | **28 server modules / 38 edges**, **17 browser modules / 13 edges**, no research dependency; **14** product scenarios execute with current research modules forbidden; canonical data closure **5 files / 2 edges** |
| Publication / repeated build | **62 exact public files**, 16 imported browser/shared modules, **214 tracked private files** preserved; all seven M4 migrations retained; stale/nested private output cleanup passes |

Counts overlap, not additive. The nine normal-selection skips are opt-in
browser suites; the two selected browser suites are separately exercised above.
Other opt-in browser suites, real iPhone/WebKit and live/authenticated Preview
search were not verified. Old Windows/LAN/Termius launch tests are intentionally
not rerun after removal. Current operator IPC and automatic Preview outcomes
are recorded in the draft PR after push.

The controlled selection is reproducible in PowerShell without SQL execution:

```powershell
$excluded = 'media-advice-(beta-ledger|global-access|identity-budget|ledger|personal-flag|predicted-budget|reserve-budget|.*native)\.test\.mjs$|m4-practical-pipe\.test\.mjs$'
$cases = @(Get-ChildItem -LiteralPath test -Filter '*.test.mjs' | Where-Object { $_.Name -notmatch $excluded } | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 @cases tests/build-site.test.mjs
```

Browser runs use the existing `PLAYWRIGHT_MODULE_PATH` and
`PLAYWRIGHT_CHANNEL=msedge` hooks with
`node --test --test-concurrency=1 test/media-advice-browser.test.mjs test/media-advice-apple-subscription-browser.test.mjs`.
Native operator IPC runs separately with fake keys/local pipes:
`node --test test/m4-practical-pipe.test.mjs`.

### Structure compared with main

These are tracked-file inventories, not live deployments or a requirement to
make develop identical to main. This PR adds no runtime feature.

| Area | Main `e923928` | Before `f534dac` | After cleanup | Why retained |
| --- | ---: | ---: | ---: | --- |
| Root files | 10 | 13 | 13 | Site/PWA plus existing ignore, lockfile and publish configuration |
| `assets` | 37 | 44 | 44 | Current product UI/icons/TMDb attribution |
| `docs` | 9 | 12 | 13 | Product/recovery/release history and new compact physical handoff |
| `netlify` | 3 | 21 | 21 | Four Functions and current server modules |
| `research` | 0 | 90 | 0 | Local pilot retired, Git remains its archive |
| `scripts` | 0 | 16 | 16 | Publish builder and needed diagnostic/operator/recovery workflows |
| `shared` | 0 | 10 | 10 | Browser/server product identity, URL and diagnostic policies |
| `test` / `tests` | 0 | 97 | 98 | Product/operator/history fixtures, regressions and publication/UX checks |
| `supabase` | 18 | 59 | 59 | Existing migrations, operation SQL, recovery and Functions; untouched |
| `privacy` / `terms` | 2 | 2 | 2 | Existing public legal pages |
| **Total** | **79** | **364** | **276** | Net reduction **88**; 90 removed, one document and one contract suite added |

Compared with main the remaining release diff is **197 added / 5 modified
files** (202 paths), not pilot residue by default. The extra permanent root
directories are `scripts`, `shared`, `test`, `tests`, each with a concrete
production/build/recovery/test obligation. No flattening or removal is proposed
just to match main's file count. The next task is an independent whole-release
review; runtime changes, seven M4 migrations, recovery, operator tools and useful
tests remain. A production release needs a separate owner decision.
