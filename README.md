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
  — [deployment execution runbook](docs/m4-media-advice.md#activation--operation-plan-not-executed),
  prepared only; five pilot films still unselected.

M4 remains default-off: narrow #192 apply/deadline/queued-reservation fixes are
locally verified, including native PostgreSQL 17.6 concurrency. Cleanup is
prepared inactive; pilot activation and source-use review remain separate.
Tavily basic Search is the [current M4 resolver provider](docs/m4-media-advice.md#tavily-search-replacement-2026-10-21)
for candidate URLs only; quality remains live-unvalidated and customer-app
source-use conditions remain explicit. Brave research is preserved historically.
Gemini Grounding stays excluded from URL → HTML extraction; no provider fallback or activation.
