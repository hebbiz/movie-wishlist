# TMDb data probe — implementation handoff (design only)

## Context

MW-FUT-01 remains **Discovery**. This document accompanies the MOTN closeout in
PR #179, whose inspected implementation HEAD was `d3e32b0`, base #178 `30c3160`.
[Owner results](digital-ua-owner-validation.md#movie-of-the-night--two-completed-owner-run-results)
and the [adapter audit](regional-card-proposal.md#motn-closeout-identity-and-field-provenance)
are separate evidence. No TMDb runtime or live API test is implemented here.
Recheck instructions, branch/stack and docs before the follow-up task.

## Objective

In one short owner session, inspect two independent blocks for **Coherence** and
**Dune: Part Two**: A, identity/localized catalogue metadata; B, actual
country-keyed Watch Providers data for UA. Discover what is returned/missing,
not general accuracy, offer localization or account-specific entitlement.

## Current implementation

`research/grounded-answer-demo/` has fixed-film Search, Apple/Kinobaza URL Context,
Kinobaza HTML and MOTN modes; default synthetic, localhost/LAN auth, one-shot
session and text-only non-LLM display components. No TMDb mode exists.
Production Netlify lookup/search use TMDb, but are **context only**, not this
probe's transport or source of credentials. Do not change/call them.

## Scope

Fixed TMDb **220289 / IMDb tt2866360** and **693134 / IMDb tt15239678**, with
the [existing identifier evidence and crosswalk limits](../README.md#movie-of-the-night-api-probe).
No title search/ID guessing. Two blocks per film, under a separately approved
opt-in non-LLM mode (a possible name is `tmdb-data`, **not implemented**).

Official endpoints/fields checked **October 18, 2026** against the
[published OpenAPI](https://developer.themoviedb.org/openapi/tmdb-api.json):

| Block | Official reference / returned fields to inspect |
| --- | --- |
| A: core identity | [Movie Details](https://developer.themoviedb.org/reference/movie-details): `id`, `imdb_id`, `original_title`, `title`, `release_date`, `original_language`, `spoken_languages[].iso_639_1`. Request `language=uk-UA`, but do not assume the returned title is translated just because that was requested. |
| A: crosswalk | [External IDs](https://developer.themoviedb.org/reference/movie-external-ids): `id`, `imdb_id`; no social IDs needed. |
| A: aliases | [Alternative Titles](https://developer.themoviedb.org/reference/movie-alternative-titles): `titles[].iso_3166_1`, `title`, `type`; country-tagged aliases, not audio. |
| A: director | [Credits](https://developer.themoviedb.org/reference/movie-credits): `crew[]` where `job=Director`, retaining person `id`, `name`/`original_name`. Do not infer direction from `known_for_department`. |
| A: dates | [Release Dates](https://developer.themoviedb.org/reference/movie-release-dates): `results[].iso_3166_1`, nested `release_dates[].release_date`, `type`, `iso_639_1`; preserve UA context separately from core date. A digital-release event is not a current streaming offer. |
| A: localized text | [Translations](https://developer.themoviedb.org/reference/movie-translations): `translations[]` language/country and `data.title`; record field presence for translated overview/tagline without needing to display full prose. |
| B: providers | [Movie Watch Providers](https://developer.themoviedb.org/reference/movie-watch-providers): root `id`, actual `results.UA`, its `link` and returned buckets. Published examples have `flatrate`, `rent`, `buy`, `ads`; do not assume every bucket exists. Entries expose `provider_id`, `provider_name`, `logo_path`, `display_priority`. Do not fetch logos. |

## Non-goals

No provider deep-link generation/resolution, streaming-card requests, account
automation, TMDb catalogue search, TMDb language-to-offer inference, pricing,
quality/HDR/codec extraction, Mykola/other LLM, training/evaluation/improvement,
production/Netlify/Supabase changes, background workers, mass collection,
persisted responses or common offer-model implementation. Do not fix Kinobaza.

## Functional requirements

- Before clicking show film, fixed IDs, UA, requested metadata locale and exact
  planned URLs/request budget. Server catalogue only; no browser input/override.
- Primary TMDb ID must equal the configured ID. All returned IMDb values in
  details/external IDs must agree with the expected ID and with each other.
  Conflicting stable IDs are mismatch, never hidden by title/year similarity.
  Missing crosswalk stays unknown; an exact primary ID must not fail solely
  because dates or localized titles differ. Expose observed dates/aliases as
  context, not invented release-year explanations or a numeric confidence score.
- Keep A/B statuses separate. If primary identity is mismatched/unresolved,
  withhold B and label it **not requested**, not an empty UA catalogue. With a
  matched primary ID and missing IMDb, label IMDb crosswalk unknown explicitly.
- B uses only exact uppercase `results.UA`. Missing/null/empty UA, missing/empty
  bucket, malformed response and HTTP error are distinct. No missing result
  becomes unavailable. Do not copy any foreign-country provider into UA.
- Keep access buckets separate per provider, including multiple buckets for the
  same ID. Unknown future buckets stay labelled unknown rather than being
  silently reclassified. `display_priority` is a source ordering hint, not
  confidence, quality or entitlement.
- Country `link` is the **TMDb country watch page**, not a provider URL. No full
  deep links are promised by this endpoint. No offered audio/subtitle/price/video
  fields are documented here; do not invent them from other endpoints.
- Show source, receipt time and field-level reported/missing/invalid/not-evaluated
  states. Keep source labels/attribution and minimal values, no global raw JSON.

### Localization hypothesis to test explicitly

| Observed field | What it can directly establish | What it cannot establish |
| --- | --- | --- |
| `translations[].iso_639_1=uk` with nonempty `data.title` | TMDb explicitly labels that catalogue title as Ukrainian text. An entry with empty title does not prove a translated title. | Ukrainian dubbing/subtitles, provider offer or entitlement. |
| Details `title` after `language=uk-UA` | The title returned for that metadata request; compare with the explicit translation entry. | That Ukrainian text actually exists if a fallback was returned, or any audio track. |
| UA alternative title | A Ukraine-tagged alias in TMDb. Country is not a language declaration. | Ukrainian-language alias/track without more evidence. |
| `original_language`, `spoken_languages` | Film-level language metadata only. | Current provider audio/subtitles or Ukrainian localized distribution. |
| UA release date / release-language tag | A labelled release event, not a live offer. | A current UA subscription/rental/purchase or available track. |
| `results.UA` provider/bucket | TMDb/JustWatch country availability signal for that film. | Provider-localization details, current account entitlement or independent confirmation of Kinobaza's JustWatch-derived signal. |

Expected output is a **semantic distinction**, not expected factual answers for
these two films. If no explicit Ukrainian translation/UA provider data is returned,
record that limitation; never fill it from owner controls or a model.

## Technical constraints and current terms

Public docs reviewed October 18, 2026; no authenticated/API requests made:

- [Application authentication](https://developer.themoviedb.org/docs/authentication-application)
  supports an API Read Access Token as `Authorization: Bearer` for v3. Propose a
  separate server-side `TMDB_READ_ACCESS_TOKEN`, hidden helper prompt, never a
  query key, browser value, process argument or inherited production secret.
  This name/routing is a future implementation proposal, not existing support.
- [FAQ](https://developer.themoviedb.org/docs/faq) describes non-commercial
  developer use with attribution, commercial licensing via sales and no SLA.
  Do not infer a paid-plan need for a personal non-commercial probe or promise
  zero total cost. A revenue-generating use needs its own applicable agreement.
  Future UI must use an approved TMDb logo in About/Credits with the notice:
  "This product uses the TMDB API but is not endorsed or certified by TMDB."
  Watch Providers additionally requires **JustWatch** attribution. Resolve
  official logo availability during implementation, not by inventing artwork.
- **Current complete agreement unverified:** direct access to the
  [API Terms](https://www.themoviedb.org/api-terms-of-use) was denied by robots;
  no bypass attempted. The indexed first-party 2023 agreement is stale evidence,
  not a newly verified effective contract. Its AI/derivative/retention wording
  must not become a blanket inference ruling, a six-month cache licence or
  automatic approval/ban for this bounded non-LLM display probe.
- The proposed use is isolated, owner-operated, non-commercial, no LLM/data
  forwarding, no archive or redistribution. FAQ capability is not a substitute
  for applicable current terms. During normal owner setup review the current
  account/API agreement for **this exact scope**, including attribution and
  transient field display. If compatible, record that scoped basis; if a direct
  conflict applies, stop live activation and return a precise feasibility result.
  If still unavailable/ambiguous, finish synthetic work and leave live readiness
  conditional. Do not demand provider email merely because text was inaccessible,
  assume consent from existing production use or claim legal certainty. Future
  AI inference/derived offer models remain separate questions, not this probe.
- Keep timeout/body limits, LAN Basic Auth, exact Host/Origin, CSP/no-store,
  session consumption before awaiting, no retries/storage/logging/destinations.
  No cookie/login/browser automation of streaming accounts. API `429` is a stop
  per [rate-limit docs](https://developer.themoviedb.org/docs/rate-limiting), not
  a new polling/retry loop. No system/deployment changes.

## Approach

After implementation approval and the scoped live-terms gate, use the documented
[Append To Response](https://developer.themoviedb.org/docs/append-to-response)
support to minimize requests. One owner click per film, **at most two application
HTTP requests** (four total for both films), serial and no retry:

1. A: `GET /3/movie/{fixed-id}?language=uk-UA&append_to_response=external_ids,alternative_titles,credits,release_dates,translations`.
   These five movie subresources are documented above, below the Details limit
   of 20 appended items. Validate each returned object's ID/shape; missing
   subresource is a partial result, **not permission for extra fallback calls**.
2. B, only after primary ID passes: `GET /3/movie/{fixed-id}/watch/providers`.
   This method has no documented country query parameter: **do not invent
   `watch_region=UA` here**. Bound the response and project only `results.UA`.

Public docs support this design; this exact combined request has not been live
probed. A failure/omitted append is a finding, not automatic decomposition into
more requests. No `/find`, country enumeration or configuration API is needed
for two known IDs. Suggested 20-second/2-MiB per-request bounds, sequential
processing and total two-call cap. Never carry A's language fields into B offers.

## Verified components

Re-inspect before editing: `config.mjs`, `server.mjs`, `network.mjs`, `motn.mjs`,
`public/client.mjs`, `public/motn-display.mjs`, `windows/Start-Demo.ps1`,
`windows/Common.ps1`, `windows/Status-Demo.ps1`, `windows/Stop-Demo.ps1`, existing
offline/browser tests, `test/windows.test.ps1` and mock child fixture. Reuse only
appropriate controls; no TMDb adapter filename/API exists yet. Production
`netlify/functions/movie-search.js` and `movie-lookup.js` were inspected as
context; their query-key transport/arbitrary searches/error bodies must not be
copied as the new probe contract. Existing dependencies need no new SDK.

## Acceptance criteria

Both fixed films and exact requests are visible/matched to transport. At most
two calls per session, no calls on startup/reload/synthetic. Stable conflicts
block B explicitly; dates alone do not reject primary-ID identity. Actual UA
and bucket states retained without foreign leakage/deep-link invention. The
localization table's distinctions survive all UI states. Source/receipt time,
TMDb/JustWatch attribution and unknown fields visible on narrow Safari. No
secret/raw-body leakage, LLM, destination fetch, storage or previous-mode changes.
Implementation/offline checks/owner live evidence remain separately labelled.

## Test plan

Authored mocks only: stable-ID conflicts and missing IMDb crosswalk; localized
title fallback vs explicit `uk` translation with empty/nonempty title; UA alias
without language proof; original/spoken-language metadata not propagated to
provider audio; different country dates; absent/empty/null UA and access buckets;
multiple provider/access entries; unknown bucket; TMDb watch link vs provider
URL; malformed/oversized/slow responses; 401/403/404/429, no extra append fallback;
partial A/B and request cap; all auth/one-shot/secret/non-persistence controls.
Regression existing request bodies/browser modes. Temp-copy Windows key routing
and lifecycle; do not stop owner demo. Browser narrow viewport is not real iPhone.

Owner plan: **one short Termius → Safari session**, normal credential/terms setup
once, then one click per film (max four title-level HTTP requests overall).
No compulsory repeated synthetic/SSH-disconnect if that workflow is unchanged
and offline controls passed. Inspect new identity/translation/UA-bucket outputs;
no need to reopen already checked streaming cards. Only a concrete new material
discrepancy justifies a targeted card check. Ask for a concise summary, not full
JSON/screenshots. Stop on error/terms conflict; no second testing round by default.

## Documentation updates

Update existing README, canonical feasibility, iPhone guide and owner record;
do not create a parallel evaluation archive. Document actual commands only once
implemented, all switches reset after SSH reconnect, token hidden, source and
request budget shown. Record missing fields and localization hypothesis outcome
without provider-audio claims, confidence scores or general accuracy numbers.
Keep historical MOTN and streaming-card observations dated and attributed.

## Git workflow

Fetch, read instructions, inspect tracked/untracked state and PR stack. If #179
remains open, create a separate stacked feature PR based on its then-current
branch, with explicit dependency and **only the new diff**; if merged, start from
current develop after inspecting intervening changes. Preserve unrelated files,
including untracked `research/media-discovery/`; no PR #173/production changes.
Separate feature commit, tests, scope/link/whitespace checks, review-ready stop.
No force/history rewrite, merge, tag, release, live agent API or deployment.
