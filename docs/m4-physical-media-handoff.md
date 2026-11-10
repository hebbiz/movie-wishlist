# Deferred physical-media search — M4 handoff

## Decision and intended result

The owner has retired the local Windows/LAN/Termius demo. Streaming beta is the
current release direction. Physical-edition discovery is deferred until a
separately approved stage on the then-current Mykola baseline; it is **not**
integrated, enabled or automatically triggered by this cleanup. This document
preserves the decisions and evidence needed to resume it without retaining the
old server/UI/launchers as a supported application.

The intended task is to help a person find a **specific physical edition** of a
selected film, with a direct product/offer URL and source-supported details.
Priority is **availability → English audio → 4K UHD Blu-ray / Blu-ray / DVD →
other details**. Do not assume that a UHD release exists; try Blu-ray and then
DVD when no suitable UHD is found. A search miss is not evidence that an
edition or offer does not exist. This was a single display-only answer, not
exhaustive collection, purchasing or a normalized offer database.

The historical scope was HMV, Rarewaves and Amazon **US (`amazon.com`), UK
(`amazon.co.uk`), DE (`amazon.de`), IT (`amazon.it`)**, including Marketplace.
The four Amazon regions had equal priority: one suitable available Amazon
edition was sufficient to stop looking in the other regions, not proof that
all were checked. Optional isolated-region scenarios selected only one of
these Amazon stores, excluding the other regions, HMV and Rarewaves.
**Those Amazon-region scenarios have no live validation.**

## Agreed interpretation and acceptance criteria

These are the retained requirements for future work, not claims that the old
model automatically satisfied them:

| Subject | Required distinction and evidence |
| --- | --- |
| Identity | Exact film, original film year, director, requested cut, edition and relevant disc. An edition/reissue year does not replace the film year. Do not merge characteristics between editions, sellers, offers or bundled discs without evidence of identity. |
| Stock | Separate currently available, preorder, sold out/unavailable and unknown. A price alone does not prove stock. A sold-out listing is not a successful available offer; its displayed price is not automatically historical. |
| Price | Report amount and currency only when supported for that specific offer. Unknown is not zero or an inferred local currency. |
| Seller / condition | Marketplace is allowed, not only Amazon-direct or Amazon-fulfilled. Report seller and condition if known; otherwise unknown. Do not infer that Amazon is the seller or that a disc is new. |
| English audio | Confirm the offered edition's actual disc track. English original film language is not proof of an English track. Audio languages/formats and subtitles are separate; presence, explicit absence and unknown remain distinct. |
| Format / edition | Prefer UHD, then Blu-ray, then DVD after availability/audio. Picture, audio, subtitles, edition identifiers and disc-region compatibility require source support for the exact edition/disc; UHD-disc specifications must not be borrowed from its bundled Blu-ray or vice versa. |
| Links / citations | Give the specific product/offer URL when established. Check that cited material concerns the exact film/cut/edition/offer. Attribution alone is not independent factual validation. |
| Unknowns / exclusions | Describe uncertainty, not inferred absence. No purchases, sign-in, bypassing access restrictions, scraping/dataset collection or research of shipping, delivery costs or delivery to Ukraine. **Ukraine shipping was outside the pilot.** |

For **Blade Runner (1982), Ridley Scott**, the target is **The Final Cut**:
neither the theatrical cut, Director's Cut, another version nor Blade Runner
2049 is a substitute. A collection/multi-version set is acceptable only when
The Final Cut's inclusion is established; identify its disc/version where the
source permits. If the cut is not established, report uncertain version, not a
confirmed Final Cut offer. Preserve the distinction between the 1982 film and
the later cut/edition date. Coherence similarly requires the 2013 James Ward
Byrkit film rather than identifying it by a retailer's edition year alone.

## What the PoC actually implemented

The original physical PoC was a local Node HTTP server, browser display and
three **server-selected fixed scenarios**: Dune: Part Two (2024), Denis
Villeneuve; Coherence (2013), James Ward Byrkit; and Blade Runner — The Final
Cut. The later Windows/LAN helpers were an operating convenience, not a source
adapter or a production deployment. There was no arbitrary-film physical
workflow connected to Movie Wishlist, Supabase, product flags or saving.

Its search path assembled a natural-language prompt from the selected film,
store scope, physical priorities and safety rules, then made one non-streaming
Gemini GenerateContent REST call with Google Search grounding. Historical
constants were `gemini-3.8-flash`, output limit `4096`, thinking `low`; these
record the old implementation, **not a current model/API recommendation**.
No application-owned retailer-specific fetching, stock parser, structured offer normalization,
semantic edition/citation validator or automatic physical identity gate was
implemented. The later digital adapters must not be mistaken for physical
retailer adapters.

Automatically checked implementation properties included startup validation of
film/mode/region, identical displayed/sent prompt, no browser prompt override,
one consumed page-session attempt before awaiting transport, replay/concurrency
refusal and no automatic retry/continuation. The Search response display
validated one completed text answer, grounding references and Part-local UTF-8
citation offsets; unsafe/unsupported citation/Suggestions structures failed
visibly instead of producing an uncited/partial fallback. The visible text and
provider source URLs were preserved, with associated Search Suggestions in
Shadow DOM rather than rewritten retailer links. Synthetic fixtures were
explicitly invented, not archived live offers.

The application used server-only credentials and transient request/browser
memory with no-store responses, no answer logs/files/browser storage/archive
or analytics. This was not a guarantee about provider/browser/OS retention.
One API call could contain multiple internal searches; the output cap was not
a total credit/spending cap. The physical field priorities, store restrictions,
Marketplace/stock/English-audio/edition rules were **prompt instructions**.
Tests verified their inclusion and transport/display behavior, not that a live
answer obeyed them, visited every store, reported true stock, or identified
the right disc. Future integration needs its own source/rights, identity,
field-provenance, unknown/conflict, budget and acceptance design.

## Historical evidence — not current stock or general accuracy

The owner reported the following manual checks at PR #174. They were **not
independently repeated by the implementation agent**:

| Scenario | Owner live requests | Reported outcome |
| --- | ---: | --- |
| Dune: Part Two | 2 | Core data of an available HMV offer confirmed. Technical-specification completeness differed between the two answers. |
| Coherence | 1 | Rarewaves Blu-ray edition data and **Sold Out** status confirmed; this was not an available offer success. Negative HMV/Amazon search results were not independently confirmed. |
| Blade Runner — The Final Cut | 1 | Data of an available Rarewaves 4K + Blu-ray offer confirmed. This does not validate every bundled-disc characteristic. |

This is three cases/four requests, not an accuracy rate, representative coverage
or validation of every generated claim/citation. No live response text,
screenshots or evidence archive was committed. Latency, token consumption and
actual API costs were not measured; a reported zero dashboard amount did not
prove zero cost. The later PR #175 priority/Marketplace/disc/citation prompt
revision added **no new physical live evidence**, and its isolated Amazon-region
configurations remain live-unvalidated. Digital-UA owner observations are a
different experiment and do not enlarge this physical evidence.

Historical offline checks at `61ef317baaf631a4123c438488742b5acfd9719d` were
33 Node plus 11 installed-Edge checks, all mocked/loopback. The later tests
covered all 18 film/mode/region configurations (15 physical, three digital),
prompt contents, invalid startup, one-shot requests and display boundaries.
They did not assess real search quality. The cleanup itself makes **zero live
film-source requests**; its current test results belong in the cleanup PR,
not in this historical evidence table.

## Exact recovery references

Git history is the archive; do not copy the full pilot into another permanent
directory. All links below are commit-pinned, including files removed from the
current tree:

- [PR #174](https://github.com/hebbiz/movie-wishlist/pull/174): original demo
  `3337fc945af3d952e346d0f8766fd9336f16afd5`, fixed-film implementation
  `61ef317baaf631a4123c438488742b5acfd9719d`, owner-check documentation
  `093b39d2e0eebfd0d581178870e03b26e926af13`; merge checkpoint
  `a5d4f42149c616d4dc3cdac35c6086240b3fdacf`.
- [PR #175](https://github.com/hebbiz/movie-wishlist/pull/175): physical
  priority/Marketplace and isolated Amazon-region implementation
  `3f0ef98e344d485f78a123847c2fb6c60bd67e3a`; merge checkpoint
  `014014337ef5d2eb9ab95db09c334cef42d4b2fa`. Its later LAN/Windows revisions
  and digital observations do not validate physical-region searches.
- At `3f0ef98…`: [config / prompt builder](https://github.com/hebbiz/movie-wishlist/blob/3f0ef98e344d485f78a123847c2fb6c60bd67e3a/research/grounded-answer-demo/config.mjs),
  [README / scope and manual criteria](https://github.com/hebbiz/movie-wishlist/blob/3f0ef98e344d485f78a123847c2fb6c60bd67e3a/research/grounded-answer-demo/README.md),
  [server / one-shot transport](https://github.com/hebbiz/movie-wishlist/blob/3f0ef98e344d485f78a123847c2fb6c60bd67e3a/research/grounded-answer-demo/server.mjs),
  [display / citation boundaries](https://github.com/hebbiz/movie-wishlist/blob/3f0ef98e344d485f78a123847c2fb6c60bd67e3a/research/grounded-answer-demo/public/display.mjs),
  [offline prompt/transport tests](https://github.com/hebbiz/movie-wishlist/blob/3f0ef98e344d485f78a123847c2fb6c60bd67e3a/research/grounded-answer-demo/test/demo.test.mjs),
  [mock browser tests](https://github.com/hebbiz/movie-wishlist/blob/3f0ef98e344d485f78a123847c2fb6c60bd67e3a/research/grounded-answer-demo/test/browser.test.mjs).
- Last pre-retirement tree `f534dacba1b7377637fe4f00bf995e8145adcc8f`:
  [checkpoint-174 / physical owner ledger](https://github.com/hebbiz/movie-wishlist/blob/f534dacba1b7377637fe4f00bf995e8145adcc8f/research/grounded-answer-demo/docs/checkpoint-174.md),
  [config](https://github.com/hebbiz/movie-wishlist/blob/f534dacba1b7377637fe4f00bf995e8145adcc8f/research/grounded-answer-demo/config.mjs),
  [README](https://github.com/hebbiz/movie-wishlist/blob/f534dacba1b7377637fe4f00bf995e8145adcc8f/research/grounded-answer-demo/README.md),
  [physical-fallback backlog, not an implementation](https://github.com/hebbiz/movie-wishlist/blob/f534dacba1b7377637fe4f00bf995e8145adcc8f/research/grounded-answer-demo/docs/regional-card-proposal.md#m3-owner-checkpoint--offline-findings-and-next-boundary).

For inspection, use `git show <full-SHA>:<historical-path>`. Verify the object
exists with `git cat-file -e <full-SHA>^{commit}`; a shallow clone may need an
explicit fetch of that SHA first. Recover a **complete commit** in a separate
detached worktree (`git worktree add --detach <new-empty-path> <full-SHA>`),
then follow that commit's dependency/setup instructions in synthetic mode.
Do not restore isolated files over the current runtime: later revisions share
root fixtures/runtime modules and need their matching checkout. These are
archival inspection/offline-reproduction instructions, not permission to expose
a historical LAN server, reuse credentials, run live queries or resume old
model/terms assumptions. The current tree no longer supports starting that
demo; physical product work resumes from current Mykola under a new design.
