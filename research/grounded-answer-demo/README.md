# MW-FUT-01: isolated grounded-answer demo

Local, display-only Discovery experiment; not a Movie Wishlist feature. Based on
`develop` at `e92392856038e40e6d98c6c8744eed04c4e8dff9` (v1.3.1).
The separate offline harness in [PR #173](https://github.com/hebbiz/movie-wishlist/pull/173)
is neither changed nor imported. Three server-selected fixed scenarios are
available; no arbitrary film input or chat UI is added. This iteration makes no
live API calls and saves no live answers. Owner-reported scenario validation is
recorded separately below, not as general accuracy evidence.

## Setup and launch

Requires Node.js 24 (tested with 24.19.0) and a modern desktop browser. No npm
install, production dependency change, build step, Supabase or Netlify emulator.
Run from the repository root:

```powershell
# Safe default: invented fixture, no provider request, no key needed.
$env:DEMO_MODE = 'synthetic'
$env:DEMO_FILM = 'dune-part-two' # also the default when DEMO_FILM is unset
node research/grounded-answer-demo/server.mjs
```

Open **http://127.0.0.1:4317** directly (not `localhost`, a LAN address, or a
production/static-server URL). Click the button. The synthetic answer, source
and suggestion are prominently labelled and are not real shopping results.
Stop with Ctrl+C. Do not expose this server through a proxy/tunnel or publish it.

### Other fixed films

Stop the running server with Ctrl+C before each command block. Changing
`DEMO_FILM` requires a **server restart**, then a page reload; changing an
environment variable in another shell or merely reloading does not switch a
running server's film. A restarted server invalidates old session tokens.

Coherence (2013), James Ward Byrkit:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_FILM = 'coherence'
node research/grounded-answer-demo/server.mjs
```

Blade Runner (1982), Ridley Scott, specifically The Final Cut:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_FILM = 'blade-runner-final-cut'
node research/grounded-answer-demo/server.mjs
```

All these commands are offline synthetic displays. Fixtures name the selected
film but explicitly invent the display example: edition, format, cut and
availability remain unknown. They do not imply that UHD or Final Cut is
actually offered. Unknown values (including an empty string or typo) cause an
`Unknown DEMO_FILM` startup error listing the three valid IDs, before listening
or making any API request.

### Manual live mode (owner only)

For a **manual owner-run** real request, set `GEMINI_API_KEY` securely in the
server process environment, then restart:

```powershell
# GEMINI_API_KEY must already be present; never paste it into source or a URL.
$env:DEMO_MODE = 'live'
$env:DEMO_FILM = 'dune-part-two' # or coherence / blade-runner-final-cut
node research/grounded-answer-demo/server.mjs
```

The page never receives the key. Without it, the click explains the missing
`GEMINI_API_KEY` and makes no provider request. Live access depends on the
owner's eligible Google project, model access, quota and billing/terms setup;
these have not been independently checked by this iteration.

| Environment | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required only for live mode; server-side header only |
| `DEMO_MODE` | `synthetic` (default) or explicitly `live` |
| `DEMO_FILM` | `dune-part-two` (default when unset), `coherence`, `blade-runner-final-cut`; selected once at server startup |
| `DEMO_PORT` | Optional localhost port, default `4317`, range 1024–65535 |
| `DEMO_SYNTHETIC_SCENARIO` | `grounded` (default), `api-error`, `empty`, `ungrounded`; no effect on live answers |

No `.env` file is loaded. Do not record live responses via browser/network
exports, screenshots, terminal redirection, analytics or an external proxy.

## Request and exact prompt

Model **`gemini-3.8-flash`**, `maxOutputTokens=4096`, `thinkingLevel=low`,
`googleSearch: {}`. These are explicit constants in [config.mjs](config.mjs),
also shown on the page. One non-streaming REST GenerateContent request; no
structured-output schema, second model, URL Context or retailer-fetching code.
Google labels this still-documented API **Legacy**: see its
[Search guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search)
and [model parameters](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8).
API/model lifecycle changes may require a later explicit update.

Exact default Dune prompt (unchanged from review baseline `3337fc9`):

```text
Help me find a physical edition of Dune: Part Two (2024), directed by Denis Villeneuve, using Google Search.
Prefer 4K UHD Blu-ray; if no suitable UHD edition is found, consider Blu-ray.
Look at HMV, Rarewaves, and Amazon US, UK, Germany and Italy. Treat all four Amazon regions equally; after finding one suitable available Amazon edition, you may stop looking at other Amazon regions.
Give me a natural-language answer with citations, identifying the specific edition, its availability and a direct product URL. Distinguish an actual available offer from a listing whose availability is unclear, sold out or preorder. Do not infer availability from a price alone.
Include price/currency, picture, audio languages/formats, subtitles, edition identifiers or disc region compatibility only when the cited sources support them for that exact edition and disc. State uncertainty instead of combining specifications from different editions. A store's year alone need not identify the film: consider the director and other identifying context.
Do not discuss shipping, delivery, delivery costs or delivery to Ukraine. Do not make purchases, sign in, bypass access restrictions, scrape sites, build a dataset or return structured data. This is a single answer for me to read, not a request for exhaustive collection.
```

The full selected prompt and film/director are visible before the click, with
the prompt panel initially open. [config.mjs](config.mjs) contains the fixed
catalogue: new prompts use the same common instructions as Dune, with their
film-specific first line and additional safeguards:

- `coherence`: James Ward Byrkit, original film year 2013 versus an edition's
  publication/reissue year; do not assume a UHD release exists. Fall back to
  Blu-ray if no suitable UHD is found, without claiming that none exists.
- `blade-runner-final-cut`: Ridley Scott's 1982 film, The Final Cut only; no
  theatrical/Director's Cut substitute or Blade Runner 2049. Verify inclusion
  in a collection and identify its disc where supported. An unconfirmed cut
  must be described as uncertain, not a confirmed Final Cut offer.

`/session` and the API request use the same server-selected catalogue entry.
The browser sends only its one-shot token; any body claiming a different film
or prompt is ignored. There is no browser film/prompt editor.

Only the selected fixed public-film prompt, configuration and authentication are sent
to Google by this demo; no user account, movie lists, cookies or Supabase data.
The provider can make multiple internal searches: **one API request is not one
search query**, and the output-token cap is not a total spending cap. No cost
or internal-query-count measurement is claimed. This demo has no tool to buy,
log in, crawl or research delivery. Store scope is a prompt instruction, not a
guarantee that the model follows it or checks every store.

## Display and lifetime

Documentation/terms reviewed October 17, 2026:

- The [Gemini grounding guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search)
  documents `groundingMetadata`, source links and inline citation placement.
- The [API Segment reference](https://ai.google.dev/api/generate-content#Segment)
  specifies Part-local byte offsets. We validate UTF-8 boundaries and optional
  segment text; we do not treat offsets as JavaScript string indices.
- The [Gemini terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)
  require associated Search Suggestions and constrain modification, storage and
  link behavior. Google's own processing includes 30-day grounding retention;
  local non-persistence does not eliminate provider retention. The linked
  [Client Application Guidelines](https://support.google.com/adsense/answer/10926790)
  also apply. This owner-operated developer demo is not a public evaluation,
  archive, redistribution tool or general permission to collect results.

All visible answer text is retained in order, including Markdown syntax shown
as plain text (not executed HTML). Only citation markers are added, following
the API's source references; they are not independent evidence validation.
Source URIs, including Google redirect URIs, are not resolved or replaced.
Citation links navigate directly, without click handlers, tracking or previews.

The exact `searchEntryPoint.renderedContent` HTML/CSS is inserted next to the
answer in a same-width Shadow DOM host, **not an iframe**, with its own styles,
links and targets unchanged. No other search results, fabricated live chips,
branding substitutions or click interception are added. The provider snippet
is checked for unexpected active content before insertion; unsupported HTML
is rejected, not rewritten. CSP blocks scripts/handlers and cross-site fetches.
Google-supplied HTTPS image resources may load when the live snippet displays;
clicks navigate to their destinations under those sites' terms. No third-party
analytics is installed by this demo.

Empty/ungrounded, blocked/truncated, non-text or unsupported citation/snippet
formats produce a visible explanation **instead of a partial answer**. There
is no uncited fallback, continuation, retry or second call. Real response
compatibility and actual Google chip appearance have not been independently
tested by the implementation agent. The limited owner-reported offer checks
below do not establish general response accuracy or display compatibility.
If a future snippet requires blocked active content, this demo will refuse it
and needs review, not relaxed security or a home-made replacement.

The button and an in-memory server token permit one attempt per page session,
including errors. Reload explicitly creates a new session; pending tokens
expire after 30 minutes. The server binds only `127.0.0.1`, validates Host/Origin,
serves only four named public assets and never exposes environment/source files.
The response exists only in request/browser memory and the active DOM, with
`Cache-Control: no-store`. Navigation clears the DOM; reload does not rerun.
No response logs, files, browser storage, cache, database, service worker,
analytics, normalization or background tasks. Browser/OS/provider retention
outside this application's control is not a promise of this demo.

## Offline validation

```powershell
node --test research/grounded-answer-demo/test/demo.test.mjs
```

All provider transport in tests is injected/mocked. HTTP tests use loopback
only. Coverage includes synthetic attribution, UTF-8/multi-Part citations,
invalid offsets/response, missing key, API/network/JSON errors, one-shot gates,
no retries, fixed request parameters, cross-origin rejection and a source audit
for content persistence/logging hooks.

Optional browser tests use an **already installed external** Playwright and
browser, without adding production dependencies or downloading anything:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:\path\to\playwright\index.mjs'
$env:PLAYWRIGHT_CHANNEL = 'msedge' # optional; omit for installed Playwright Chromium
node --test research/grounded-answer-demo/test/browser.test.mjs
```

The browser suite blocks non-loopback traffic, tests all four synthetic
scenarios plus missing key, exact visible text, citation/suggestion hrefs,
unchanged suggestion target/CSS, narrow layout, repeat clicks, empty storage
and reload. Without `PLAYWRIGHT_MODULE_PATH`, this optional suite is skipped.
It does not verify retailer pages or Google's live chip rendering.

Implementation checks at `61ef317` (October 18, 2026): Node offline suite
**33 passed**; headless
installed Edge browser suite **11 passed**, no skips. The existing checks are
retained, with catalogue/default/invalid-startup tests, exact Dune prompt hash,
all-film synthetic displays and mocked requests matching the pre-click prompt,
fixed generation settings and rejection of browser overrides. No live API call
was made by the implementation agent during that iteration. No screenshot or
evidence archive was added.
Synthetic fixture markup is
invented, not an archived provider response. No public evaluation report or
accuracy conclusions are produced. Production files and PR #173 stay unchanged.

## Owner-reported validation

The following validation was performed and reported by the owner, **not the
implementation agent**. These are reports of manual checks, not independently
repeated tests or an automated evaluation.

| Scenario | Live requests | Owner-confirmed outcome |
| --- | --- | --- |
| Dune: Part Two | 2 | Core data of the available HMV offer confirmed by the owner. |
| Coherence | 1 | Rarewaves Blu-ray edition data and Sold Out status confirmed by the owner. |
| Blade Runner — Final Cut | 1 | Data of the available Rarewaves 4K + Blu-ray offer confirmed by the owner. |

Limits of this evidence:

- **Three scenarios and four requests**, not an assessment of general accuracy.
- Negative HMV/Amazon search results for Coherence were not independently
  confirmed. Failure to find an offer is not proof of unavailability.
- Dune technical-specification completeness differed between the two answers.
- Latency, token usage and actual API costs were not measured.
- Owner confirmation is limited to the outcomes above, not every generated
  claim, every citation or every disc-specific characteristic.

MW-FUT-01 remains **Discovery**. This documentation-only update makes no API
calls and includes no live response text, screenshots or evidence archive.
The earlier offline/browser results above are historical implementation checks,
not new tests or independent live validation performed for this update.

## Proposed next iteration — not implemented

The following are proposed refinements only. **Prompts and runtime are unchanged**
by this documentation update; these are not newly implemented guarantees:

- Do not restrict Amazon offers to direct/fulfilled listings only.
- Do not describe a sold-out item's displayed price as historical without
  supporting evidence.
- Distinguish UHD disc characteristics from those of the bundled Blu-ray.
- Check that citations refer to the exact edition being described.

## Next manual checks

For an explicitly owner-run request, check without exporting/archiving it:

- Before clicking: selected title/year, director, Final Cut target when relevant,
  and the full prompt are correct. One click consumes the session even on error;
  a reload is needed for another attempt, not an automatic request.
- Identity: Coherence's original year is not confused with edition/reissue year;
  UHD existence is not assumed. Blade Runner refers to the 1982 film's Final
  Cut, not another cut or 2049. A set explicitly includes Final Cut, or the
  response says that the cut is uncertain.
- Offer: follow citations/direct product links and check the exact edition,
  availability independently of price and disc-specific specifications.
  Unknown information should stay uncertain; details must not migrate between
  editions or discs. Do not infer that every store/region was checked.
- Scope/display: HMV, Rarewaves and equal Amazon US/UK/DE/IT scope, one suitable
  available Amazon option sufficient, no delivery research, natural-language
  answer with citations and associated Search Suggestions. A citation is
  attribution, not a guarantee; note missing/variable detail without drawing
  a general accuracy conclusion from this small manual sample.
