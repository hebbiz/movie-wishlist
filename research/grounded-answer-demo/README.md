# MW-FUT-01: isolated grounded-answer demo

Local, owner-operated, display-only **Discovery** experiment, not a production
feature. This iteration starts from develop checkpoint
`a5d4f42149c616d4dc3cdac35c6086240b3fdacf`. The physical-only owner pilot and
historical implementation checks are preserved separately in the
[PR #174 checkpoint record](docs/checkpoint-174.md). They do not validate the
new digital or Amazon-region prompts. All revised scenarios are **live-unvalidated**.

No production integration, new provider, TMDb, chat/input, structured output,
normalization, scoring, response archive or analytics. PR #173 is not changed
or imported. This iteration makes no live API calls.

## Setup and server switches

Node.js 24 (tested with 24.19.0), modern desktop browser, no npm install/build
or new dependencies. Run from the repository root. No `.env` file is loaded.

| Environment | Values / purpose |
| --- | --- |
| `DEMO_MODE` | `synthetic` by default; explicitly `live` only for an owner-run request |
| `GEMINI_API_KEY` | Required only for live mode; server environment/header only, never in browser/source/URL |
| `DEMO_FILM` | `dune-part-two` (default), `coherence`, `blade-runner-final-cut` |
| `DEMO_DISCOVERY` | `physical` (default), `digital-ua` |
| `DEMO_AMAZON_REGION` | Optional, physical only: `us`, `uk`, `de`, `it`; unset for multi-store search |
| `DEMO_PORT` | Default 4317, range 1024–65535 |
| `DEMO_SYNTHETIC_SCENARIO` | `grounded` (default), `api-error`, `empty`, `ungrounded`; synthetic error/display tests only |

Unset means absent, not an empty/unknown value. Invalid film/discovery/region
or **any Amazon region with digital-ua** causes a clear startup error before
listening or making a provider request. All choices are resolved once at startup.
The browser cannot override film, discovery, region or prompt.

### 1. Physical default (safe synthetic display)

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_FILM = 'dune-part-two'
$env:DEMO_DISCOVERY = 'physical'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
node research/grounded-answer-demo/server.mjs
```

Open **http://127.0.0.1:4317**, not `localhost`, a LAN URL or a static server.
Review the film, director, discovery mode, region and full prompt before clicking.

### 2. Ukrainian digital scenarios (safe synthetic display)

Stop the server with Ctrl+C first. Unset the physical-only region:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
$env:DEMO_FILM = 'dune-part-two'
node research/grounded-answer-demo/server.mjs
```

For Coherence, stop the server, then:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
$env:DEMO_FILM = 'coherence'
node research/grounded-answer-demo/server.mjs
```

For Blade Runner (1982), specifically The Final Cut, stop the server, then:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
$env:DEMO_FILM = 'blade-runner-final-cut'
node research/grounded-answer-demo/server.mjs
```

### 3. One Amazon store (safe synthetic display)

After Ctrl+C, select a physical film and exactly one region:

```powershell
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'physical'
$env:DEMO_FILM = 'dune-part-two' # or coherence / blade-runner-final-cut
$env:DEMO_AMAZON_REGION = 'us' # us=amazon.com, uk=amazon.co.uk, de=amazon.de, it=amazon.it
node research/grounded-answer-demo/server.mjs
```

To test another region, stop the server, set `DEMO_AMAZON_REGION` to `uk`,
`de` or `it`, and run the same Node command again. No batch/automatic loop.
To return to the original store set, remove the environment variable as in step 1.

**Restart the server and reload the page after every configuration change.**
A reload alone cannot change the running server's switches. Restart invalidates
old in-memory tokens. Reload does not automatically make a model request.

### 4. Manual live mode — owner only, not run by the implementation agent

With the desired configuration selected, stop the synthetic server. Securely
configure `GEMINI_API_KEY` in the server environment (not source or terminal
history), then:

```powershell
$env:DEMO_MODE = 'live'
node research/grounded-answer-demo/server.mjs
```

Reload the local page, verify all displayed switches and prompt, then click once.
Missing key is explained without a provider call. Button and server token permit
one attempt, including failure, with no retry/continuation or second model call.
Another attempt requires an explicit reload. Do not expose the server through
a proxy/tunnel, publish it, or export/archive live answers, screenshots or HAR.

## Prompts, priorities and unchanged model

The exact prompt comes from the validated catalogue/builder in
[config.mjs](config.mjs) and is fully visible before the click. `/session` and
the API request use the same server configuration. No arbitrary browser prompt.

Model remains **`gemini-3.8-flash`**, `maxOutputTokens=4096`,
`thinkingLevel=low`, `googleSearch: {}`. No automatic output-limit increase.
One non-streaming GenerateContent REST call using built-in fetch; no new SDK.
The previously reviewed [Search guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search)
and [model parameters](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8)
are referenced; this iteration does not claim a new live API capability probe.

Physical keeps the three films and existing multi-store scope, but intentionally
revises prompt instructions to the newly agreed priorities (not byte-identical
to the earlier Dune prompt). Ordering is **availability → English audio →
UHD/Blu-ray/DVD → other details**. UHD existence is not assumed; edition year
does not replace film identity. Blade Runner must remain the 1982 film's
**Final Cut**, not a different cut or 2049; collections must establish inclusion
and unresolved cuts must be described as uncertain.

Without an Amazon region, HMV, Rarewaves and equal Amazon US/UK/DE/IT remain in
scope; one suitable available Amazon offer is sufficient. With a region, search
only that Amazon store, including Marketplace; no other Amazon store, HMV or
Rarewaves. Seller/condition are stated if known; Amazon is not assumed to be the
seller. Price alone does not prove stock; a sold-out price is not a success and
is not called historical without evidence. UHD and bundled Blu-ray details
must be distinguished, with citations tied to the exact edition/disc.
Delivery stays entirely outside scope.

Digital-ua searches Apple TV, Rakuten TV, Netflix, Prime Video, MEGOGO and
**HBO Max (formerly Max)**. The [official HBO Max brand changelog](https://brand.hbomax.com/changelog)
was checked October 18, 2026 for the current name; a brand name is **not evidence
of availability in Ukraine**. No live title/service availability claim is made.

Digital search and presentation order:

1. Ability to watch the exact film/cut in Ukraine.
2. Ukrainian audio track.
3. Ukrainian subtitles, separately from audio.
4. 4K, HDR10, Dolby Vision and HD, separately.
5. Subscription/rental/purchase, price/currency and other parameters; direct offer
   link when confirmed for the Ukrainian offer.

For each characteristic, the prompt asks to distinguish confirmed presence,
confirmed absence and unknown. A film page, Ukrainian interface or country URL
is insufficient playback evidence; negative search results do not prove absence.
Global/foreign specifications cannot be transferred to the Ukrainian offer.
4K does not imply HDR/Dolby Vision, nor do subtitles imply audio. An original
language or generic Atmos badge does not prove an offered Ukrainian track.

Among established UA-viewable offers, HD with Ukrainian audio beats 4K without
Ukrainian localization; without Ukrainian audio, Ukrainian subtitles beat better
video without localization. Missing evidence remains unknown, not confirmed
absence. These are **prompt instructions only**, not a filter, scoring system,
confidence normalizer or post-processing/re-ranking of the answer.

## Manual review: Ukrainian account, no VPN

For each explicitly owner-run digital request, inspect source links manually
using an account whose country is Ukraine, from Ukraine **without a VPN** or
other region bypass. Do not share credentials with the demo. If playback,
catalogue rights or account territory cannot be established, keep availability
unknown; do not purchase/subscribe just to complete this research.

Check the film and Final Cut identity first, then actual Ukrainian viewing
entitlement, Ukrainian audio and Ukrainian subtitles independently, then each
video format. Separate subscription, rental and purchase variants; verify any
price/currency and direct link in the proper territory/account context.
Record uncertainty in discussion without copying live text or creating an
evidence archive. Citations are attribution, not independent verification.

For physical region checks, verify the selected store, stock, English audio,
disc format/edition/cut, Marketplace seller/condition and disc-specific
characteristics. A search miss, title page, price or generic film-language
metadata is not sufficient evidence. Do not infer all regions were checked.

Latency can be timed manually from click to completed display for future
owner-run attempts. Token usage and actual API costs remain unmeasured here.
The owner currently reports **0 in the dashboard**; this does not establish
zero cost, a settled bill or free searches. Usage/cost measurement is not a
blocker for this iteration. One API request may involve multiple internal search
queries, and the output cap is not a complete spending cap.

## Display, privacy and limitations

Only the selected public-film prompt, configuration and authentication go to
Google; no Supabase, account data or movie lists. The response is held only in
active request/browser memory and DOM, with no-store headers. No logs of answers,
files, browser storage, cache, database, service worker, analytics or archive.
Provider/browser/OS handling outside the app is not a non-retention promise.

The complete visible answer remains in order as plain text (Markdown syntax
is not executed HTML), with citation markers using validated Part-local UTF-8
offsets per the [Segment reference](https://ai.google.dev/api/generate-content#Segment).
Citations/source URIs and the provider Search Suggestions HTML/CSS/targets are
not rewritten, resolved, tracked or fed to a second LLM. Suggestions render
alongside the answer in Shadow DOM, not an iframe. Empty/ungrounded/truncated
or unsupported attribution/active snippets fail visibly rather than display
an incomplete or uncited answer. No retailer fetching/crawling code is added.

The [Gemini terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)
and [Client Application Guidelines](https://support.google.com/adsense/answer/10926790)
remain relevant (original review October 17, 2026). Associated Search Suggestions
are kept; Google's processing/retention is separate from local non-persistence.
Google-supplied image resources can load as the snippet renders, and source/chip
clicks navigate directly under destination terms. No tracking/interstitials are
added by this app. Actual new prompt usefulness/UA rights/localization remains
live-unvalidated; no general accuracy or legal-permission claim is made.

## Offline validation

```powershell
node --test research/grounded-answer-demo/test/demo.test.mjs
```

Tests use mocked provider transport and loopback HTTP only. They check all 18
film/discovery/store configurations, invalid modes/regions/combinations (including
CLI rejection before listening), default physical scope, displayed/sent prompt
identity, browser-override rejection, single-use sessions, existing errors/UTF-8
attribution and non-persistence. Prompt tests do **not** measure search quality.

Browser tests use an already installed external Playwright and browser;
no production dependency or browser download is required:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:\path\to\playwright\index.mjs'
$env:PLAYWRIGHT_CHANNEL = 'msedge' # optional, else installed Playwright Chromium
node --test research/grounded-answer-demo/test/browser.test.mjs
```

The suite blocks non-loopback browser requests and uses synthetic/mocked answers.
It retains prior display/error/storage/reload tests and adds all three digital
films plus each Amazon region, visible switches/prompt, no browser inputs and
one-shot behavior. Without the external module path, browser tests are skipped
and must be reported as such. Synthetic fixtures explicitly establish **no real
viewing availability, localization, edition or stock**.

Current test results are reported in the PR/final handoff after execution.
Historical tests and owner outcomes remain in the separate checkpoint record.
No live response, screenshot, evaluation report or evidence archive is added.
