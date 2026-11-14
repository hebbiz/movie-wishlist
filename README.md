# Movie Wishlist

Movie Wishlist is a group-oriented movie catalogue and recommendation app. It
keeps shared lists for families, friends and communities, preserves the context
of personal recommendations, and offers a user-scoped Social Advice catalogue
plus Mykola's guided movie selection flow.

Version **v1.4.0** records **«Поради носіїв Миколи»** in limited production
beta, promoted through [#234](https://github.com/hebbiz/movie-wishlist/pull/234).
Mykola and his other movie-selection/recommendation flows existed before this
release. Release documentation was prepared on **2026-11-11**; tag and GitHub
Release completion are recorded separately. See the
[release notes](docs/releases/1.4.0/README.md).

## Product boundaries

- Group movie lists belong to groups.
- `recommendations` remains the source of recommendation content.
- `Поради` (Social Advice) is a global, user-scoped projection of socially
  visible recommendations; it is not another group list.
- Mykola and Social Advice share the same social eligibility core but use it
  through different interaction models.
- Push delivery is optional and does not define in-app catalogue availability.

## Streaming-media advice: limited beta

«Поради носіїв Миколи» searches digital offers in the Ukrainian context and
presents what TMDb, Movie of the Night and Kinobaza report about availability,
Ukrainian audio and Ukrainian subtitles. The user can choose a service/link,
review the transfer preview and copy the exact selected URL into a movie card;
the card's ordinary Save remains separate and requires existing editing rights.

These are **source claims**, not viewing entitlement, guaranteed current
availability or independently verified tracks for a particular offer. Missing,
conflicting and separate offer data must not be treated as interchangeable.
Physical-edition search is deferred; the pilot's decisions and evidence are
preserved in [the physical-media handoff](docs/m4-physical-media-handoff.md).

The owner confirmed one production flow for **«Форсаж 6» / Fast & Furious 6**:
get advice, transfer a link, save the card and see that link when editing it
again. This is owner-reported evidence, not an independent smoke test or full
validation of every source, service, device or failure scenario.

### Known release limits

- The production diagnostic report shows **`Commit: unknown`**. The #234 merge
  records the source promotion, not an attested runtime commit in that report.
- Full restore verification remains **`verified:false`** because of unresolved
  ACL/schema differences; narrower M4 results do not establish full database or
  Supabase-project recovery. See the [checkpoint evidence](docs/recovery-playbook.md#checkpoint-specific-evidence).
- Advice Room access policy needs separate follow-up. This is distinct from
  the streaming beta's personal feature flag and existing transfer/save rights.
- Technical-debt follow-ups are candidates for a later release, tentatively
  **1.4.1**; neither that release's scope nor its timing is promised.

## Stack

- static HTML, CSS and JavaScript frontend;
- installable PWA with a service worker and Web Push;
- Supabase PostgreSQL, Auth, RLS, RPC, Database Webhooks and Edge Functions;
- Netlify hosting and Netlify Functions;
- TMDb lookup/search integration;
- Mykola streaming-media advice through server-side TMDb, Movie of the Night
  (MOTN), Tavily and Kinobaza adapters.

The browser loads `@supabase/supabase-js` from jsDelivr. `package.json` records
that library and the server HTML parser `parse5`; the locked development
dependency PGlite supports local database-contract tests. The package exposes
`test:m4`, while Netlify invokes the build scripts directly rather than an
`npm run build` script. There is no `npm start` script.

## Repository map

| Path | Responsibility |
| --- | --- |
| `index.html` | public landing page |
| `app.html`, `app.js`, `styles.css` | authenticated application UI and client logic |
| `invite.html` | invitation landing flow |
| `service-worker.js`, `site.webmanifest` | PWA installation, push and notification navigation |
| `assets/` | static artwork, icons and Mykola GIF; TMDb logo at `assets/icons/tmdb.svg` |
| `src/media-advice/` | six canonical browser media-advice modules: controller, entry access, presentation, link choices, icons and protected report |
| `shared/media-advice/` | four pure URL-policy/diagnostic modules actually consumed by both browser and server |
| `netlify/functions/` | `movie-search.js`, `movie-lookup.js`, `invite-preview.js` and `media-advice.mjs` endpoints |
| `netlify/lib/` | media-advice orchestration, source adapters, extraction, identity/profile verification and request-budget helpers |
| `netlify/lib/media-advice/identity/` | six server-owned film/person identity, release-year and narrow title-spelling helpers; not static website files |
| `scripts/` | `build-site.mjs` and `stamp-media-advice-build.mjs` at the directory root; publication and develop build provenance |
| `scripts/media-advice-diagnostics/` | fourteen explicit operator/controlled-study files (ten `.mjs`, four `.ps1`); not an automatic release-validation suite |
| `test/` | M4 product, server, identity, access, browser, operator and historical-parity tests; canonical authored fixtures |
| `tests/` | static-publication and recovery-tool tests, separate from `npm run test:m4` |
| `supabase/functions/` | movie-activity and Social Advice push delivery |
| `supabase/migrations/` | ordered database changes; repository presence does not prove deployment |
| `supabase/operations/` | scoped preflight, activation/kill-switch and recovery tools; inspect their version-specific runbooks before use |
| `privacy/`, `terms/` | public legal pages |
| `docs/releases/` | immutable historical release archives and prepared release notes |
| `docs/baselines/` | current repository/deployment evidence records |
| `docs/m4-*.md` | current M4 status, dated research/operation records, cleanup inventory and physical-media handoff |
| `.site-dist/` | generated Netlify static publish directory, not the source checkout or Functions source |

Media-advice browser code belongs in `src/media-advice/`, separate from static
artwork and the server-side modules in `netlify/lib/`. The four policies shared
by both runtimes belong in `shared/media-advice/`; server-only identity helpers
belong in `netlify/lib/media-advice/identity/`. Ownership follows actual consumers,
not whether a module happens to be pure. The browser does not import server code
or test fixtures. Images,
service icons, the GIF and TMDb attribution keep their existing `/assets/` URLs.
The build also generates six small ESM forwarders at the former
`/assets/media-advice*.mjs` URLs for already-open pages. They re-export the
canonical modules, not a second implementation. New code and current tests use
`src/media-advice/`; the old URLs exist in built publication, not as source
modules to maintain. Four generated forwarders also preserve the old flat
`/shared/<name>.mjs` URLs used by those browser modules. The six server-only
identity files have no public compatibility URL. See the
[rule ownership and compatibility boundaries](docs/m4-runtime-separation.md#media-advice-rule-ownership--2026-11-11).
Their [retirement plan](docs/m4-runtime-separation.md#forwarder-retirement-plan--2026-11-14)
requires a separate cleanup PR no earlier than 30 days after the production deploy
of 1.4.1, a dependency review and an old-tab risk assessment; elapsed time alone
does not establish that no old tabs remain.

The fourteen local media-advice study/diagnostic files have one owner directory,
`scripts/media-advice-diagnostics/`, so the two publication tools remain visible
at the root of `scripts/`. Their basenames, explicit opt-ins, reviewed-checkout
guards and credential/IPC boundaries remain. There are no wrappers at the former
`scripts/m4-*` paths. Use the [current operator inventory](docs/m4-runtime-separation.md#current-operator-scope--2026-11-14)
for current locations; dated commands and pinned Git paths retain their historical
meaning. Relocation does not make cap10/cap12 studies current cap14 validators.

The Windows/LAN/Termius demo under `research/grounded-answer-demo` was retired
in [#240](https://github.com/hebbiz/movie-wishlist/pull/240). It is not a supported
installation path. Useful fixtures live in `test/`; frozen historical comparisons
read pinned Git objects rather than importing a current demo. The
[cleanup inventory](docs/m4-runtime-separation.md) records the #235–240 stages
and remaining operator/history dependencies. Physical-edition research is
preserved in the [handoff](docs/m4-physical-media-handoff.md), not enabled in
the streaming product.

## Local use

Run commands from the repository root with Node.js/npm available. Install the
root lockfile, including the parser required by the runtime and historical tests:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/build-site.mjs
```

The build deletes and recreates `.site-dist`; do not use it as a storage folder.
For static UI inspection, serve `.site-dist` over HTTP and open `/` or
`/app.html`. Opening files directly with `file://` is not equivalent because
the application uses a service worker, absolute paths and
`/.netlify/functions/*` endpoints.

A generic static server does not emulate Netlify Functions, Supabase Auth,
database RPCs, Edge Functions or Web Push. Full end-to-end behavior therefore
requires compatible external services and their configured environments. A
successful static build is not evidence of live source access, authorization or
production readiness. These commands do not install or migrate a Supabase project.

### Build and test commands

`test/` currently contains 83 Node test entry files and 12 authored fixture
modules. `tests/` contains four Node test files and four Windows PowerShell test
scripts. They are deliberately separate; running one directory does not cover
the other.

| Command | Scope and limitations |
| --- | --- |
| `npm run test:m4` | Runs `node --test --test-concurrency=1 test/*.test.mjs`; includes controlled source fixtures and local PGlite/SQL contract tests, not migrations against the target database. Native/browser scenarios have additional prerequisites and may skip. |
| `node --test tests/build-site.test.mjs` | Builds/rebuilds `.site-dist`, checks the public allowlist, browser dependencies and removal of stale output. |
| `node --test tests/recovery-archive.test.mjs tests/recovery-local.test.mjs` | Authored recovery-tool fixtures and temporary local files, not a restore of the current M4 database. |
| `node --test tests/recovery-m4-compare.test.mjs` | Authored supplemental M4 archive-comparison fixtures; cannot promote a failed full restore into a PASS. |
| `pwsh -NoProfile -File tests/recovery-local-guards.test.ps1` | Windows-only authored path/checkpoint/private-ACL guards; no actual backup, VM or restore. |
| `pwsh -NoProfile -File tests/recovery-m4-compare-wrapper.test.ps1` | Windows-only wrapper with authored DPAPI/AES-GCM inputs and preserved full `verified:false`; no real checkpoint or restore. |
| `pwsh -NoProfile -File tests/recovery-password-prompt.test.ps1` | Windows-only authored credential/ACL handling test; no real credentials or database connection. |
| `pwsh -NoProfile -File tests/recovery-password-prompt.native.test.ps1` | Explicit native Windows test of an empty local PostgreSQL 17 cluster; requires the already-installed PG 17.11 binaries at the path declared in that script. Not a target-database restore or an installer. |
| `node --test --test-concurrency=1 test/media-advice-browser.test.mjs test/media-advice-apple-subscription-browser.test.mjs` | Controlled browser scenarios; set `PLAYWRIGHT_MODULE_PATH` to an existing Playwright module and optionally `PLAYWRIGHT_CHANNEL` for an installed browser. These fixtures are not live source checks or a physical iPhone test. |
| `node --test --test-concurrency=1 test/media-advice-runtime-parity.test.mjs test/media-advice-fixture-parity.test.mjs test/media-advice-history.test.mjs` | Frozen baseline and fixture/history checks; the pinned historical Git objects must exist locally. |
| `node --test test/m4-diagnostics-layout.test.mjs` | Fixed-body relocation parity for all fourteen diagnostic tools, canonical paths/no wrappers and root build tools; nine importable Node tools plus the CLI-only pilot refusal and mocked wrong-commit/dirty-source guards. No live source requests or database checks. |

For frozen runtime parity the fixed baseline is
`42b4b849d77281e1660701500c7bba9e6ec44b02`. If the test reports it missing,
explicitly obtain that history and rerun the test:

```sh
git fetch origin 42b4b849d77281e1660701500c7bba9e6ec44b02
node --test test/media-advice-runtime-parity.test.mjs
```

Frontend/rule relocation parity and the retained-document browser fixture need
**both** pinned Git objects: the released v1.4.0 baseline
`15e29db04cf536c707a7d7dfba713affd57cac2c` and the post-#245, pre-rule-separation
baseline `a060cf6f9e2022fbdd5635623432b3684c1632a7`. If either is missing,
explicitly fetch it before rerunning:

```sh
git fetch origin 15e29db04cf536c707a7d7dfba713affd57cac2c
git fetch origin a060cf6f9e2022fbdd5635623432b3684c1632a7
node --test test/media-advice-layout-browser.test.mjs
```

The two parity checks need only Git/Node; the browser scenarios use the same
`PLAYWRIGHT_MODULE_PATH`/`PLAYWRIGHT_CHANNEL` prerequisites described above.
Missing history fails with the exact fetch command, without auto-fetch, skip or
current-code substitution. Retained-document scenarios switch local static roots
for the v1.4.0 asset paths and #245 source paths with old flat shared imports,
not a live Netlify deploy or full-app Save.

Diagnostic-tool relocation parity requires Git and the fixed pre-move develop
object `d7c98664ad5b3a975b47cca237ba9e30b865e0ee`. If it is missing, explicitly
fetch it and rerun the focused check:

```sh
git fetch origin d7c98664ad5b3a975b47cca237ba9e30b865e0ee
node --test test/m4-diagnostics-layout.test.mjs
```

The test compares all fourteen bodies with that fixed Git tree, allowing only
reviewed import/repository-root/source-guard path changes and line-ending
normalization. Missing history fails with the fetch command; there is no
automatic fetch, skip or current-body substitute.

For a shallow clone, `git fetch --unshallow origin` is another explicit option.
The tests neither auto-fetch nor silently substitute current runtime code.
Some operator/history tests require additional pinned commits listed in the
[inventory and historical test instructions](docs/m4-runtime-separation.md).
Do not interpret skipped prerequisites as passed scenarios. Test results must
state the actual commands, skips and whether only authored fixtures were used.

## Environment configuration

Secret values must remain in their deployment environments and must not be
committed to the repository.

### Netlify Functions

- `TMDB_API_KEY` — used by movie search and IMDb-based lookup.
- `SUPABASE_URL` — used by invitation preview and server-side media advice.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only credential used by the invitation
  preview and media-advice functions; never expose it to the browser.
- `TMDB_READ_ACCESS_TOKEN` — TMDb identity/details/provider data for media advice
  (distinct from the search/lookup `TMDB_API_KEY`).
- `MOTN_API_KEY` — Movie of the Night data for media advice.
- `TAVILY_API_KEY` — bounded Kinobaza candidate discovery for media advice.

Production, `develop` branch deploys and Deploy Previews have separate Netlify
environment contexts. Required values must be available to the relevant
Functions context; a successful preview build alone does not prove this. This
README lists variable names, not a verification of any live context or value.

### Supabase Edge Functions

- `VAPID_PRIVATE_KEY` — private Web Push signing key.
- `VAPID_SUBJECT` — VAPID contact subject.

### Supabase Vault

- `movie_wishlist_edge_secret` — secret used by database-side HTTP calls to
  authenticate Edge Function requests.

The Supabase URL, publishable browser key and VAPID public key are public client
configuration currently stored in application source. They are not substitutes
for the server-only values above.

## Deployment

The release workflow treats `main` as production and `develop` as integration.
[`netlify.toml`](netlify.toml) runs `node scripts/build-site.mjs` and publishes
only `.site-dist`. Its `develop` context first runs
`node scripts/stamp-media-advice-build.mjs`, then the same publication build.
The stamp is deliberately attested only for a matching Netlify `develop`
branch deploy; local, Preview and Production builds do not gain an attested
commit merely by running the script. Netlify-provided build metadata names are
`NETLIFY`, `CONTEXT`, `BRANCH`, `COMMIT_REF` and `DEPLOY_ID`.

The static allowlist retains the seven root browser/PWA files, `assets/`,
`privacy/`, `terms/`, the six explicit browser modules under `src/media-advice/`
and the four explicit rules under `shared/media-advice/`, excluding Markdown
provenance files. It does not publish arbitrary future `src/` or `shared/` files,
documentation, research, server code, tests, scripts, migrations or configuration.
Six generated legacy module forwarders under `assets/` and four at the former
flat `shared/` paths are part of this public compatibility surface; no identity
implementation from `netlify/` is copied into static output.
All four Netlify Functions and their dependencies
remain in the full checkout for Functions bundling, outside the static publish
directory. TMDb attribution continues to use `/assets/icons/tmdb.svg`.

Database migrations and Supabase Edge Functions are deployed separately. Git
contents and a successful build do not prove which schema, secrets, permissions
or production code are live. Check the relevant dated execution evidence and
target preflight before any separately authorized operation; this document is
not permission to activate, migrate, recover or deploy.

See [Git workflow](docs/git-workflow.md) for the branch, PR, release and rollback
process.

## Documentation

- [Changelog](CHANGELOG.md)
- [v1.4.0 release notes](docs/releases/1.4.0/README.md)
- [Local database backup/restore playbook and safety boundaries](docs/recovery-playbook.md)
- [v1.3.1 baseline record](docs/baselines/v1.3.1.md)
- [v1.3.1 release notes](docs/releases/1.3.1/README.md)
- [v1.3.0 release archive](docs/releases/1.3/README.md)
- [v1.2 release archive](docs/releases/1.2/README.md)

`MW-FUT-01`/M4 streaming advice is now in limited production beta. The v1.3.1
records below and dated M4 checkpoints remain historical; physical search is
still deferred.

### Current M4 status and operating boundaries

- [M4 status, runbook and dated evidence](docs/m4-media-advice.md) distinguish
  present contracts from original pre-install/pilot plans. The current resolver
  retains two bounded Basic Tavily searches, then one Advanced `exact_match`
  reserve using original title/year, then at most one unread predicted title
  URL. Search results and predicted URLs are candidates, never identity proof;
  the Kinobaza `/search` fallback is not used. Current cap14 and legacy
  cap8/10/12 ledger contracts, deadlines and no-automatic-retry rules remain
  distinct from historical local study budgets.
- The [personal feature-flag contract](docs/m4-media-advice.md#actual-region-transitions-and-personal-overrides--2026-11-08)
  requires global Beta plus the user's own `mykola_media_advice` flag. Capability
  preparation happens at authenticated app initialization, independently of
  a film, group or group role. Actual region changes synchronize the flag;
  writing the same region does not overwrite a personal override. Diagnostics
  and normal transfer/save editing rights remain separate.
- **Dated execution, not a fresh target check:** the
  [#233 execution report](https://github.com/hebbiz/movie-wishlist/pull/233)
  records `20261108185237_media_advice_global_access.sql` applied once at
  **2026-11-08 22:26:33 UTC**, with postchecks at 22:28:01 UTC. Older
  “prepared/unapplied” checkpoints describe the state before that operation.
  The report verified protected-copy readback/integrity, not an actual database
  restore. It is scoped M4 recovery evidence, not proof of a full-project or
  current-state restore; no database state is rechecked by this README update.
- TMDb/MOTN/Kinobaza availability and language rows are source claims, not
  entitlement or an independent platform-track check. URL grouping does not
  authorize copying language or access conditions between unconfirmed offers.
  Source-use permissions and release/live validation remain separate decisions.
- [Runtime separation, inventory and operator scope](docs/m4-runtime-separation.md)
  explain why historical cap10/cap12 studies and film-specific diagnostics are
  retained, but are not current release validators. Do not run them with live
  credentials merely because a historical command is documented.
- [Physical-media handoff](docs/m4-physical-media-handoff.md) preserves the
  PoC's decisions, owner-reported evidence and Git recovery references for
  future work; it is not a supported current demo or a streaming-beta feature.

### Historical M4 checkpoints

These dated records retain earlier behavior, limits and evidence. They are not
instructions to replay activation, recover a database or recreate live searches:

- [Same-document return state and expiry](docs/m4-media-advice.md#same-document-m4-return-state--2026-10-23)
- [Pilot dialog, grouped variants and form-session memory](docs/m4-media-advice.md#mykola-media-dialog-and-form-session-lifetime--2026-10-28)
- [Pilot diagnostics and bounded controls](docs/m4-media-advice.md#pilot-diagnostics-and-bounded-controls--2026-10-23)
- [Title/year search checkpoint](docs/m4-media-advice.md#titleyear-oriented-kinobaza-search--2026-10-23)
- [Person-level director crosswalk](docs/m4-media-advice.md#person-level-director-alias-crosswalk--2026-10-23)
- [Autonomous five-film iteration](docs/m4-media-advice.md#autonomous-five-film-resolver-iteration--2026-10-23)
- [Five-film automatic results](docs/m4-media-advice.md#five-film-automatic-results--2026-10-24)
- [Original activation plan (not the latest execution state)](docs/m4-media-advice.md#activation--operation-plan-not-executed)
- [UA Beta/private diagnostics checkpoint](docs/m4-media-advice.md#ua-beta-access-and-private-diagnostics--2026-10-31)
- [Beta/Tavily integration](docs/m4-media-advice.md#beta-and-tavily-integration--2026-11-01)
- [Three-film retrieval follow-up](docs/m4-media-advice.md#three-film-pilot-retrieval-follow-up--2026-10-28)
- [Tavily replacement checkpoint](docs/m4-media-advice.md#tavily-search-replacement-2026-10-21)
- [Second-search checkpoint](docs/m4-media-advice.md#tavily-only-alternative-search--2026-10-31)
