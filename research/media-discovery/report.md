# MW-FUT-01 experiment report

Date: October 17, 2026. Status: **Discovery; review correction validated offline,
live evaluation not performed**. Recommend separate retrieval and structuring,
with Brave as a conditional contractual candidate; see the
[retrieval decision](docs/retrieval-decision.md). The owner/provider decision is
pending. Do not expand to 15 films yet.

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
The original 28 tests at reviewed commit `e80431a` passed but missed a citation
attribution defect. A new regression test first failed against that code:
`available` inherited `likely` from `This different edition is unavailable`.
The initial confidence results were not a reliable attribution validation.

All **46** tests now pass. The original guarantees remain covered, plus different
listings/fields/editions with equal values, wide/missing/invalid offsets, exact
positive ranges, escaped JSON, Unicode, thought/multiple Parts and duplicate keys.
The suite covers unsupported assertions, unmatched URLs/citations, UK
streaming, locale-only Ukraine claims, sold-out/price contradictions, language
conflicts, wrong cuts, different identifiers, edition-year differences,
malformed API responses and bounded retries. It also checks that synthetic
reviews cannot contribute human-confirmed claims in offline mode.

Dry-run prepared all three prompts and exact request bodies with no network.
Single-film and three-film offline CLI runs succeeded. Test transports are
synthetic, including human-review test records; they provide no Gemini quality
or real retailer evidence. A missing-key live-mode check records all three films
as blocked and makes zero Gemini/TMDb requests. Another test supplies fake
credentials and a permission-reference string and proves real transport remains
blocked by `LIVE_RESEARCH_ENABLED=false`. Unmocked fetch is disabled in tests.

## Citation correction and remaining limitation

The matcher no longer searches `segment.text` for a reported value. It maps exact
validated byte ranges in the original JSON Part to `listings[i].claims[j]` and
checks the source reference for that assertion and its exact listing URL. No
cross-edition or cross-site identity is inferred. The
[API contract](docs/api-review.md#segment-attribution-contract) uses byte offsets;
Unicode tests demonstrate why JavaScript string indices are not interchangeable.

Only a whole assertion object/value token/full encoded value content can be
accepted. Broad or ambiguous support remains unknown; there is no word-boundary
or negation-list fallback. Attribution placement is not source truth. Independent
human confirmation, the UA territory gate and edition/disc boundaries remain.

Positive attribution here is synthetic. Actual grounded structured JSON may not
provide atomic supports, in which case the corresponding fields stay unknown.
This limitation supports separating retrieval from structuring rather than
claiming field-level accuracy from schema compatibility.

## Offline results (manufactured fixtures only)

Post-correction three-film run: `2026-10-17T19-35-39-408Z-032b51cb-offline`.
Raw synthetic envelopes, normalized JSON, metrics.jsonl, summary.json and the
run report remain in the local ignored runs directory. These artifact names
identify a local execution, not a published dataset.
Synthetic supports now contain explicit Part indices and per-assertion UTF-8
byte ranges. These replace the initial fixture's broad all-claims segments;
they are intentionally precise examples, not observed API behavior.

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
| Dune: Part Two | 2.65 | 10.39 | 15.29 |
| Coherence | 2.06 | 5.28 | 8.75 |
| Blade Runner | 1.28 | 4.17 | 12.40 |

Overall local run elapsed: 47.67 ms. These are one-run local processing timings,
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
Credentials are still absent (`GEMINI_API_KEY`, optional `TMDB_API_KEY` checked
by presence only). Retrieval decision/approval and applicable rights for the
planned archival/normalization/evaluation also remain unresolved.
There is no live quality, latency, grounding coverage or cost result to assess.

The [decision document](docs/retrieval-decision.md) records confirmed permissions,
explicit restrictions and unresolved interpretations for Gemini original display,
Brave, Tavily and Exa. Storage-plan marketing alone is insufficient; report
publication and external-LLM/derived-field rights also matter. No new provider
adapter or framework was added. A paid plan does not itself clear the blockers.

After approval and rights resolution, the recommended next experiment is a
physical-first Dune pilot with separately identified retrieval evidence and one
structuring pass. Retain the two-total-attempt budget, count any retry, and inspect
the actual edition/claims manually before the other two films. Keep UA streaming
availability unknown without entitlement evidence. Option A would instead be a
separately scoped original-response display demo with citations/suggestions, not
this research archive. Reconsider 15 films only after measured pilot evidence.

The current implementation is a testable research harness. It supports a
decision about what to measure next; it does not validate broad accuracy or
authorize MW-FUT-01 as a production capability. MW-FUT-02 is untouched.
