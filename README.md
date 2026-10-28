# Movie Wishlist

Movie Wishlist is a group-oriented movie catalogue and recommendation app. It
keeps shared lists for families, friends and communities, preserves the context
of personal recommendations, and offers a user-scoped Social Advice catalogue
plus Mykola's guided movie selection flow.

Version **v1.3.1** stabilizes the production state that followed v1.3.0 without
introducing a new product milestone.

## Product boundaries

- Group movie lists belong to groups.
- `recommendations` remains the source of recommendation content.
- `Поради` (Social Advice) is a global, user-scoped projection of socially
  visible recommendations; it is not another group list.
- Mykola and Social Advice share the same social eligibility core but use it
  through different interaction models.
- Push delivery is optional and does not define in-app catalogue availability.

## Stack

- static HTML, CSS and JavaScript frontend;
- installable PWA with a service worker and Web Push;
- Supabase PostgreSQL, Auth, RLS, RPC, Database Webhooks and Edge Functions;
- Netlify hosting and Netlify Functions;
- TMDb lookup/search integration.

The browser loads `@supabase/supabase-js` from jsDelivr. `package.json` records
the same runtime library as a dependency, but the repository currently defines
no build, start or test scripts.

## Repository map

| Path | Responsibility |
| --- | --- |
| `index.html` | public landing page |
| `app.html`, `app.js`, `styles.css` | authenticated application UI and client logic |
| `invite.html` | invitation landing flow |
| `service-worker.js`, `site.webmanifest` | PWA installation, push and notification navigation |
| `assets/` | icons, logos and preview assets |
| `netlify/functions/` | TMDb search/lookup and invitation preview functions |
| `supabase/functions/` | movie-activity and Social Advice push delivery |
| `supabase/migrations/` | ordered database changes; repository presence does not prove deployment |
| `docs/releases/` | immutable historical release archives and prepared release notes |
| `docs/baselines/` | current repository/deployment evidence records |

## Local use

This repository has no canonical local command or build step. For static UI
inspection, serve the repository root over HTTP and open `/` or `/app.html`.
Opening files directly with `file://` is not equivalent because the application
uses a service worker, absolute paths and `/.netlify/functions/*` endpoints.

A generic static server does not emulate Netlify Functions, Supabase Auth,
database RPCs, Edge Functions or Web Push. Full end-to-end behavior therefore
requires compatible external services and their configured environments. No
local database bootstrap or automated test harness is defined in this
repository.

## Environment configuration

Secret values must remain in their deployment environments and must not be
committed to the repository.

### Netlify Functions

- `TMDB_API_KEY` — used by movie search and IMDb-based lookup.
- `SUPABASE_URL` — used by the invitation preview function.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only credential used by the invitation
  preview function.

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

The release workflow treats `main` as the production source branch and
`develop` as the integration branch. The owner confirmed that the changes in
this baseline were published through Netlify and work in production, but the
exact deployed commit and live branch-deploy settings were not independently
verified. Database migrations and Supabase Edge Functions are deployed
separately from the static frontend. The repository does not contain a
`netlify.toml` or an infrastructure-as-code record of the live Netlify/Supabase
configuration, so deployment status must be verified in those services rather
than inferred from Git alone.

See [Git workflow](docs/git-workflow.md) for the branch, PR, release and rollback
process.

## Documentation

- [Changelog](CHANGELOG.md)
- [v1.3.1 baseline record](docs/baselines/v1.3.1.md)
- [v1.3.1 release notes](docs/releases/1.3.1/README.md)
- [v1.3.0 release archive](docs/releases/1.3/README.md)
- [v1.2 release archive](docs/releases/1.2/README.md)

`MW-FUT-01` and `MW-FUT-02` remain Discovery items. They are not part of the
implemented or documented v1.3.1 scope.
- [M4 media advice implementation and activation boundaries](docs/m4-media-advice.md)
- [M4 same-document return state and expiry boundaries](docs/m4-media-advice.md#same-document-m4-return-state--2026-10-23)
- [M4 pilot Mykola dialog, evidence ranking and form-session memory](docs/m4-media-advice.md#mykola-media-dialog-and-form-session-lifetime--2026-10-28)
  — separate Mykola-style conversation; first open searches once, results stay
  in memory for the card session and become stale rather than disappearing at
  30 minutes. Server ledger/limits stay unchanged; not deployed by this work.
- [M4 pilot diagnostic corrections and bounded controls](docs/m4-media-advice.md#pilot-diagnostics-and-bounded-controls--2026-10-23)
  — historical MOTN `unknown` reports do not prove missing API language data.
  Diagnostics are offline-tested. First local control run used6/12 attempts,
  stopping at Tavily authentication. A separately authorised repeat used8/12
  (TMDb4/Tavily4/Kinobaza0): successful non-empty search results were all rejected
  by URL admission (`unsupported-path`/`query`), not by HTML identity. Actual URL
  shapes and historical search/title-refusal causes remain unresolved;
  local checkout provenance is not deployed-runtime attestation.
  The separately authorised Blade-only URL diagnostic used3/3 attempts
  (TMDb2/Tavily1/Kinobaza0; cumulative17). Screenshot evidence shows unchanged
  `/persons/denis-villeneuve`: a person-shaped pointer correctly rejected by
  title-card admission, not a normalization defect. No HTML destination checked;
  at that checkpoint query strategy changes were proposals only. A second result-reader error after
  the JSON was printed is consistent with one-shot handoff consumption.
  [Title/year-only search](docs/m4-media-advice.md#titleyear-oriented-kinobaza-search--2026-10-23)
  is now implemented separately above #198, preserving the independent director
  gate and existing limits. The authorised Blade-only control used5/6 attempts
  (TMDb2/Tavily1/Kinobaza2; prior17 separate, actual cumulative22).
  Search admitted3 pointers: two read, one unexamined. The2049 card stopped at
  director-alias-unestablished (Денні Вільньов versus Дені Вільнев / Denis
  Villeneuve); the other visible card fields describe Blade Runner1982 and
  fail title matching. Claims withheld; no general-quality/causal conclusion or
  historical-pilot reconstruction. No automatic repeat or alias bypass.
  [Person-level director crosswalk](docs/m4-media-advice.md#person-level-director-alias-crosswalk--2026-10-23)
  preserves server TMDb person IDs and supports exact, provenance-scoped aliases
  across films. At the mechanism checkpoint the real registry was empty; the
  [autonomous five-film iteration](docs/m4-media-advice.md#autonomous-five-film-resolver-iteration--2026-10-23)
  now records independent person-profile evidence for the literal Villeneuve
  spelling, without guessed IDs or per-film exceptions.
  [Final five-film automatic results](docs/m4-media-advice.md#five-film-automatic-results--2026-10-24)
  confirm all five correct cards locally, including Alien via the bounded
  ordinary Kinobaza title-search fallback; not catalogue-wide accuracy or
  verified availability/tracks. The expanded task used74 HTTP attempts,
  including all investigation/rechecks; earlier25 controls remain separate.
  The separately authorised person check used3/3 reads (2TMDb +1person page;
  cumulative25). TMDb confirms person137427/IMDbnm0898288 but no exact target
  alias among3 examined aliases. Kinobaza HTTP200 was size-refused at the512KiB
  bound before parsing. That historical run did not confirm the entry; the
  subsequent expanded owner authorization and new evidence are recorded separately.
  — [deployment execution runbook](docs/m4-media-advice.md#activation--operation-plan-not-executed),
  with its original prepared plan kept separate from later execution records.

M4 default-off semantics and the existing deployment/access state are unchanged
by this work. Narrow #192 apply/deadline/queued-reservation fixes were locally
verified, including native PostgreSQL 17.6 concurrency; dated execution records
describe actual activation separately from prepared plans.
The [three-film pilot retrieval follow-up](docs/m4-media-advice.md#three-film-pilot-retrieval-follow-up--2026-10-28)
preserves independent localization when UA country data is absent, adds a
reviewed person-level Craig Gillespie alias and safe extraction diagnostics.
Current automatic Blade Runner1982/Mortal Kombat2021/Supergirl2026 checks matched
all three cards locally; historical response causes, entitlement and general
coverage remain unproven. No deployment or source-policy closure is implied.
Tavily basic Search is the [current M4 resolver provider](docs/m4-media-advice.md#tavily-search-replacement-2026-10-21)
for candidate URLs only, with the [bounded public title-search fallback](docs/m4-media-advice.md#five-film-automatic-results--2026-10-24)
on this branch. Five local controls do not establish general quality;
customer-app source-use conditions remain explicit. Brave research is preserved
historically. Gemini Grounding stays excluded from URL → HTML extraction;
no Brave/Gemini fallback or activation is introduced.
