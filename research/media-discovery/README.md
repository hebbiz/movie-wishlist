# MW-FUT-01: isolated Media Discovery PoC

Status: **Discovery — offline pipeline evaluated; live research pending**.
Source baseline: `e92392856038e40e6d98c6c8744eed04c4e8dff9` (v1.3.1).
`origin/develop` matched this baseline when work began; the working tree was clean.

This Node CLI investigates grounded media discovery for three fixed films. It
does not integrate with Mykola or any production component. All code, fixtures,
tests and documentation live here, with no dependencies or root manifest edits.
See the [experiment report](report.md) and [official API review](docs/api-review.md).

## Setup and offline reproduction

Use Node.js 22 or newer with built-in fetch and node:test (tested on v24.19.0).
Run from the repository root; there is no install step:

```text
node --test research/media-discovery/test/poc.test.mjs
node research/media-discovery/cli.mjs --mode dry-run --movie all
node research/media-discovery/cli.mjs --mode offline --movie dune-part-two
node research/media-discovery/cli.mjs --mode offline --movie all
```

Movie IDs: `dune-part-two`, `coherence`, `blade-runner`, or `all`.
The default mode is dry-run. Offline uses deliberately synthetic API envelopes
from [fixtures/synthetic.mjs](fixtures/synthetic.mjs), including fake product
paths. They are not retailer findings. No network requests are made in either
mode. Every invocation creates a new ignored `runs/<timestamp>-<id>-<mode>/`.
No overwrite or automatic rerun loop is implemented.

## Live configuration and limits

Environment only; no dotenv loader and no secrets in fixtures or CLI flags:

| Variable | Requirement |
| --- | --- |
| `GEMINI_API_KEY` | Required for live Gemini calls. |
| `GEMINI_MODEL` | Required for live; use `gemini-3.8-flash`, reviewed on 2026-10-17. Dry-run defaults to that ID. |
| `GEMINI_GROUNDING_PERMISSION_REF` | Required reference to a genuine permission/contract covering research analysis, raw storage and modified/normalized use; see [terms review](docs/api-review.md). This is not a checkbox granting rights. |
| `TMDB_API_KEY` | Optional v3 API key, only read by the identity verifier when `--verify-tmdb` is requested. Absence is explicitly logged and does not block Gemini. |

Once credentials and a suitable contractual basis exist, start with one film:

```text
node research/media-discovery/cli.mjs --mode live --movie dune-part-two
```

Inspect raw response, normalized evidence and metrics before testing another
film. For a fresh three-film batch, `--mode live --movie all` runs Dune first,
then the other two sequentially only after the pilot response passes parsing,
schema checks and returns grounding. It stops on the first failure. Do not run
both the pilot and another full batch and call that one experiment; each CLI
invocation is separately metered. A valid no-listing response is not evidence
of unavailability and does not prove adequate search coverage.

Each film gets **one logical Gemini call**, with at most one retry for HTTP
429/500/502/503/504: at most **two HTTP attempts total**, retry included. There
is no second LLM normalization call. HTTP 4xx other than 429, invalid content,
schema/identity failures, and network/timeouts do not retry. A timeout has
unknown provider-side outcome and cost. Each attempt has a 90-second timeout.
There is no SDK retry layer. Internal Google searches are controlled by the
provider; application call count does not bound those searches.

`--verify-tmdb` adds one separately timed/countable TMDb request per film, with
`external_ids,credits` appended. An explicit identifier/director mismatch stops
the batch. Optional API transport errors are recorded and Gemini can continue
with the sourced fixtures. Watch Providers is not implemented in this PoC.

## Artifacts and schema

| Artifact | Content |
| --- | --- |
| `manifest.json` | Mode, selected fixture IDs, requested model, generation parameters, prompt/schema/fixture SHA-256 hashes, permission reference and live gate. |
| `<film>.request.json` | Exact prompt/body and requested model, excluding credential headers. |
| `<film>.raw-attempt-N.json` | Live HTTP status, elapsed time and redacted full API response, including errors, grounding and usage. |
| `<film>.raw-synthetic.json` | Clearly labelled manufactured offline response. |
| `<film>.normalized.json` | Schema 1.0.0, mode, fixture identity evidence, retrieval time, independent listings, claims, coverage, grounding, counts. |
| `<film>.tmdb.json` | Optional identity API response and contribution/call/elapsed metrics. |
| `metrics.jsonl` | One record per selected film, including blocked/not-run states, each attempt's usage/cost, stages and total per-film time. |
| `summary.json`, `report.md` | Overall elapsed time/call totals and a compact per-film table. |

Normalized listing fields include `store`, `kind`, `url`, `urlConfidence`,
`listingFound`, `availability`, `availabilityConfidence`, `cutMismatch`,
`identityMismatch`, `usableOffer` and `claims[]`. A found listing is at most a
cited candidate, not confirmation of inventory or playback rights. An offer is
usable only when available, its film identity and required cut are human
confirmed, and a physical offer's format is confirmed.

Each claim has `field`, `value`, `reportedValue`, `reportedValues`, original
`assertions`, `confidence`, `conflict`, `sourceUrls`, `citationRefs`,
`evidenceNote`, `retrievedAt`, `territory`, `provenance` and `humanVerified`.
`value` is null when evidence is unknown; reported alternatives remain visible.
Confidence is `confirmed`, `likely` or `unknown`. Availability is `available`,
`preorder`, `unavailable` or `unknown`; no result is never converted to sold out.
Core unknown fields are materialized even when the model omits them.

The model-output schema is [RESPONSE_SCHEMA](config.mjs). It deliberately uses
separate string-valued assertions rather than a merged catalogue object.
Technical claims should be disc/language-specific, e.g. `uhd.hdr`,
`bluray.audio.uk.codec`, `uhd.audio.en.codec`. A generic `audio` value cannot
populate these fields. Film original language is not used to infer a track.

## Evidence and human review

- A source must be linked to that field through actual API grounding chunks and
  support text to reach `likely`. A model-written URL without this chain is
  insufficient. Redirect citations that cannot be matched to a direct listing
  remain unknown; the PoC does not resolve them by guessing a destination.
- API grounding is labelled `search_result`; the app has not read the retailer
  page. Even a valid citation is not proof that the assertion is correct.
- The model cannot return an effective `confirmed` flag. Human review must
  provide the exact listing/edition URL, field/value, directly read excerpt,
  evidence note, reviewer, source kind and timestamp. Reviews expire after
  24 hours for this run; output remains a timestamped historical observation.
- Streaming availability in UA requires a reviewed `territory=UA` claim with
  `territoryCountry=UA` and basis `explicit_entitlement` or `provider_api`.
  Language, URL locale, generic country support and a UK title offer do not
  meet that rule. Confirmation still does not guarantee every account's rights.
- Conflicting values stay unknown, including sold-out text paired with an
  available claim. A price is independent from stock. Blade Runner cuts stay
  separate; different years alone are not identity conflicts.
- Reviews for other URLs/editions cannot be imported, even from another shop
  selling a similar-looking edition. This conservative first PoC supports only
  primary evidence at the exact listing URL, not cross-site specification joins.

The optional `--reviews <local-json-path>` accepts an array of review records:

```json
[
  {
    "listingId": "actual-listing-id-from-output",
    "field": "territory",
    "value": "UA",
    "sourceUrl": "https://provider.example/exact-title-offer",
    "editionUrl": "https://provider.example/exact-title-offer",
    "sourceKind": "page_content",
    "reviewer": "actual reviewer",
    "checkedAt": "actual ISO timestamp",
    "excerpt": "exact short directly observed evidence including UA",
    "evidenceNote": "how this proves entitlement for this title/offer",
    "territoryCountry": "UA",
    "territoryBasis": "explicit_entitlement"
  }
]
```

This is a schema illustration, not evidence. Only an actual allowlisted listing
and matching observed value can pass. After obtaining appropriate research and
storage rights, use a separate local review pass with **zero new API calls**:

```text
node research/media-discovery/review.mjs --run research/media-discovery/runs/<live-run> --reviews research/media-discovery/runs/<reviews.json>
```

The command requires the permission reference, preserves original retrieval time
and a hash/reference to the input, and writes a new ignored review directory.
Original attempts, usage and cost remain in the source run. Review files/outputs
must stay local under ignored `runs/`; never commit private review notes,
contracts or live evidence. Human assertions remain subject to review: this
tool is not a truth oracle.

Coverage includes all twelve allowlisted store/market entries. Statuses are
`not_observed`, `search_query_observed`, `grounding_result_observed` and
`page_manually_reviewed`. Model-reported searches are retained separately;
their claims of no_result/blocked are not silently treated as actual page reads.
Not checking remaining Amazon regions after a good edition is permitted but
not forced; all regions have equal priority in the prompt. The single-call
design cannot mechanically stop internal searches at that point.

## Metrics, limits and isolation

Raw usage and requested/returned model IDs are preserved. Missing usage is
null. Token cost is a partial estimate using the dated [pricing snapshot](docs/api-review.md);
reported query count is not labelled the exact billed/internal count. Both
actual charge and complete cost remain null without sufficient data. Failed
attempts retain their own usage; they are not omitted from the journal.

This folder is outside `netlify/functions/` and `supabase/functions/`, exports
no server handler, and has no imports from production or frontend entrypoints.
It has no HTML entrypoint, deploy command, cache, database writes or service
worker registration. A future static root publish may expose tracked research
source as files; that is not production integration, but review publication
scope before any future merge. Generated outputs and environment files are
ignored. PR previews may still be triggered automatically by the repository's
existing Netlify integration; this PoC does not invoke deployment operations.

Delivery to Ukraine, shipping cost/timing, purchases and automatic movie edits
are excluded. Three films cannot establish general accuracy. MW-FUT-01 remains
Discovery; expansion or production integration needs a separate decision.
