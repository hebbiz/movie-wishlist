# M4 runtime separation and pilot inventory

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
An old diagnostic installation hint still mentions the demo parser command;
it is inert text, not an import or a runtime asset dependency.

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
candidates. Stage 1 adds six server modules, one SVG, two test suites and this
inventory: **359 files**, with no tracked file deletion.

| Group | Baseline count | Stage 1 count | Next-stage decision and dependency |
| --- | ---: | ---: | --- |
| `research/grounded-answer-demo` | 96 | 96 | Retain temporarily; extract useful fixture/contracts before retiring demo orchestration |
| Root `test` | 81 | 83 | Keep product/security regression coverage; relocate pilot fixtures deliberately |
| Recovery `tests` | 4 | 4 | Keep with supported recovery chain |
| `scripts` | 15 | 15 | Keep build stamp; individually review 14 local controls |
| M4 migrations | 7 | 7 | Keep all seven, including applied versions |
| `supabase/operations` | 34 | 34 | Keep rollback/cleanup/recovery; label superseded runbooks rather than deleting blindly |
| M4 documentation | 2 | 3 | Extract current contract/runbook before archiving chronological evidence |
| Product M4 runtime/resources | 44 | 51 | Keep: these are product code/artwork, not pilot leftovers |
| **Disjoint M4/test/operator total** | **283** | **293** | Other application files remain 66 |

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
suite is one more consumer. Their transitive demo dependencies must also be
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
attributes, not additional files. Stage 1 adds boundary and frozen-parity suites.

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
