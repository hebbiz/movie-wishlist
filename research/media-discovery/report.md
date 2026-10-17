# MW-FUT-01 experiment report

Date: October 17, 2026. Status: **Discovery; offline work complete, live evaluation
not performed**. Recommendation: continue a narrower evidence-first experiment
after resolving API access and grounded-result usage rights. Do not expand to
15 films yet and do not approve a production feature on this evidence.

## Source and isolation

Branch created from `origin/develop` at
`e92392856038e40e6d98c6c8744eed04c4e8dff9`, identical to the approved v1.3.1
baseline. No intervening develop changes were found. The existing files inspected
were root README, baseline, Git workflow, package metadata, the two Netlify TMDb
functions and the relevant Mykola candidate code. No AGENTS.md or existing
research folder/test harness was present.

The PoC uses built-in Node APIs and adds files only under
`research/media-discovery/`. It neither imports nor changes production code.
No endpoint, schema, RLS/RPC, Edge Function, service worker, dependency manifest
or release note is changed. Source files are not referenced by the frontend and
export no Netlify handler. Generated output/environment files are ignored.
No deployment operation is part of this task.

## Identity verification

These IDs were observed in primary-source search results/pages, not guessed.
TMDb/IMDb API crosswalk verification remains unexecuted because TMDB_API_KEY
was absent. Identity source provenance is saved in [movies.json](fixtures/movies.json).

| Film | TMDb | IMDb | Observed identity evidence |
| --- | --- | --- | --- |
| Dune: Part Two (2024) | [693134](https://www.themoviedb.org/movie/693134-dune-part-two) | [tt15239678](https://www.imdb.com/title/tt15239678/) | TMDb page: title/year, Villeneuve and cast. IMDb search result: matching title/year/cast; direct retrieval failed. |
| Coherence (2013) | [220289](https://www.themoviedb.org/movie/220289-coherence) | [tt2866360](https://www.imdb.com/title/tt2866360/?bypassRefViewPref=1) | TMDb page and IMDb search result agree on Byrkit, dinner/comet context and 2013 identity; TMDb also displays a 2014 regional release date. |
| Blade Runner (1982) | [78](https://www.themoviedb.org/movie/78-blade-runner/cast) | [tt0083658](https://www.imdb.com/title/tt0083658/) | TMDb cast/crew page: title/year, Scott and cast. IMDb search result: title/year; direct retrieval failed. These film IDs do not prove The Final Cut or a disc edition. |

This is agent-inspected identity evidence, not human validation of retailer
offers. No retailer claim was checked by a human in this experiment.

## Executed checks

Reproduction commands are in the [PoC README](README.md). Node v24.19.0 was used.
All 28 offline tests passed, including local review CLI integration and stopping
the batch after an invalid pilot. The suite covers unsupported assertions, unmatched URLs/citations, UK
streaming, locale-only Ukraine claims, sold-out/price contradictions, language
conflicts, wrong cuts, different identifiers, edition-year differences,
malformed API responses and bounded retries. It also checks that synthetic
reviews cannot contribute human-confirmed claims in offline mode.

Dry-run prepared all three prompts and exact request bodies with no network.
Single-film and three-film offline CLI runs succeeded. Test transports are
synthetic, including human-review test records; they provide no Gemini quality
or real retailer evidence. A missing-key live-mode check records all three films
as blocked and makes zero Gemini/TMDb requests.

## Offline results (manufactured fixtures only)

Representative three-film run: `2026-10-17T19-00-24-851Z-e4fefab4-offline`.
Raw synthetic envelopes, normalized JSON, metrics.jsonl, summary.json and the
run report remain in the local ignored runs directory. These artifact names
identify a local execution, not a published dataset.

| Film | Synthetic cited listings | Usable offers | Likely claims | Unknown fields | Conflicts | Unsupported claims | Human-confirmed claims |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dune: Part Two | 2 | 0 | 5 | 24 | 0 | 1 | 0 |
| Coherence | 1 | 0 | 3 | 12 | 2 | 0 | 0 |
| Blade Runner | 2 | 0 | 6 | 23 | 1 | 0 | 0 |

- Dune: a synthetic Amazon UK candidate stays likely. Unsupported Dolby Vision
  becomes unknown. A UK Apple TV offer cannot establish streaming in Ukraine.
- Coherence: an available assertion with sold-out text becomes conflict/unknown,
  although a price remains present. Contradictory language-specific audio claims
  are retained, with no selected value.
- Blade Runner: the theatrical cut is marked incompatible with the requested
  Final Cut. A separate Final Cut candidate with a 2007 listing year is retained;
  the year alone is not rejected. Its availability is still unknown.

| Film | Synthetic fixture/read ms | Normalize/write ms | Per-film total ms |
| --- | --- | --- | --- |
| Dune: Part Two | 2.36 | 9.62 | 14.17 |
| Coherence | 1.43 | 2.03 | 5.16 |
| Blade Runner | 1.47 | 25.74 | 28.77 |

Overall local run elapsed: 63.03 ms. These are one-run local processing timings,
not API latency or a benchmark; filesystem scheduling dominates some values.
Later verification runs may differ. Gemini application calls: 0; Gemini HTTP
attempts: 0; TMDb API calls: 0. Model execution, token usage, actual internal
searches and API charge were not measured. Cost fields are null, not invented.
The requested model in prepared requests is `gemini-3.8-flash`, with low thinking,
8192 output cap and a versioned structured schema/prompt. No model actually ran.

## Actual source coverage and live gaps

| Category | Actually checked for offers | Not checked |
| --- | --- | --- |
| Ukraine streaming | None | Apple TV, Rakuten TV, HBO Max, Netflix, Prime Video, MEGOGO |
| Physical | None | Amazon US, UK, Germany, Italy, HMV, Rarewaves |

Synthetic coverage indicators are test data only: Dune cites fake Amazon UK and
Apple TV paths; Coherence cites fake HMV; Blade Runner cites fake HMV/Rarewaves.
They must not be reported as actually visited stores. The normalized format
always lists all twelve sources, distinguishes model-reported coverage from
observed query/citation/page evidence, and preserves raw grounding.

No actual offer, stock status, Ukraine entitlement, price, barcode/ASIN,
disc-region compatibility, HDR, audio language/codec or subtitles was verified.
No claim about shipping or delivery is made. Three films would not establish
general accuracy even if the live experiment had completed.

## API findings, risks and next decision

The [official API review](docs/api-review.md) records current model support,
Search/structured-output compatibility, citations, usage, pricing and terms.
Two blockers remain: missing `GEMINI_API_KEY`, and unresolved permission for the
planned archival/normalization/evaluation of Google Search grounded results.
There is no live quality, latency, grounding coverage or cost result to assess.

Recommended next steps:

1. Establish a contractual basis for the evidence workflow or change provider/
   retrieval approach. Do not treat Search output as a freely reusable dataset.
2. Run one authorized Dune pilot. Check schema acceptance, returned model ID,
   actual source/claim alignment, Search Suggestions and complete usage fields.
   Stop on failure instead of adding model calls to repair malformed output.
3. Inspect evidence directly for a few claims, with timestamps and the exact
   listing/edition identity. Use the local review pass to record confirmations
   without additional model calls. If titles are discoverable but UA rights are
   not provable, narrow streaming output to candidate links/unknown availability.
4. Only after the pilot passes, run Coherence and Blade Runner once. Examine
   cut/edition and language-specific errors separately from search recall.
5. Consider 15 films only after recording observed precision gaps, manual review
   effort and per-film cost/latency. Include ambiguous names, regional dates,
   out-of-stock editions, multi-cut bundles and sparse Ukraine catalogues.

The current implementation is a testable research harness. It supports a
decision about what to measure next; it does not validate broad accuracy or
authorize MW-FUT-01 as a production capability. MW-FUT-02 is untouched.
