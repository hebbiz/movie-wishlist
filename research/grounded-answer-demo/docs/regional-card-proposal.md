# Proposed next experiment: regional card first

Architecture/feasibility record, updated October 18, 2026 after manual candidate
experiment A and the owner's choice of a narrow Kinobaza URL Context experiment.
MW-FUT-01 remains **Discovery**. The conceptual pipeline is not implemented;
the isolated fixed-source demo extensions below are implemented/offline-tested,
with subsequent owner-run results recorded separately. The HTML pilot is now
complete for two films; its limits and Movie of the Night feasibility are below.
Existing Search/Apple prompts and all model/generation settings stay unchanged.
The [owner observations](digital-ua-owner-validation.md) motivate narrower
questions, not an accuracy claim or a production recommendation. The current
record distinguishes completed manual research, public-document feasibility and
the newly selected URL-only hypothesis. The existing PoC guide contains runtime
scope and owner tests; no general discovery pipeline or product handoff.

## Proposed sequence and evidence boundaries

1. Discover a concrete regional card, not just a film/platform name. The owner
   independently locates the Ukrainian card in Safari; do not invent an ID or
   accept interface language/country URL alone as entitlement evidence.
2. Check film identity: title, film year, director and, for Blade Runner, explicit
   Final Cut identification. A different Apple ID requires reconciliation, not
   automatic acceptance/rejection. An unresolved cut remains unknown.
3. Check each aspect separately in its regional/account context: viewing
   availability; audio languages/formats; subtitle languages/types; 4K, HD,
   HDR10 and Dolby Vision individually; subscription/rental/purchase and price.
4. Retain **unknown** where evidence is missing or cannot be reproduced. A
   search miss is not unavailability; an incomplete list is not proven absence;
   an inaccessible URL is not proof of invalidity. Do not substitute typical
   distribution formats for direct evidence.
5. Keep original film language distinct from offered audio, an account's Play
   button distinct from new rental/purchase, and catalogue metadata distinct
   from that account's viewing entitlement. Never transfer global/foreign
   properties to the Ukrainian offer.

These are manual review questions, not a normalized schema, confidence engine,
automatic ranking or extraction pipeline. Keep audio before subtitles, then
video; preserve the existing Ukrainian-localization priorities.

## Agreed auxiliary discovery source

Owner-agreed documentation checkpoint, October 18, 2026: **Кінобаза (Kinobaza)**
is an additional source of Ukrainian film titles and candidate URLs, not a new
integration or a final authority on an offer.

Proposed future flow (not the current runtime):

TMDb / Кінобаза / web search → candidate regional cards → film/cut identity and
offer-characteristic checks → Mykola recommendation.

Кінобаза is not final evidence of offer availability/entitlement, current prices,
audio or video format of a particular provider offer/edition. General film
localization does not establish localization at a provider. Its data may
originate from JustWatch and may not be independent of TMDb. Shared upstream
information is not independent
corroboration; titles/links are leads to verify against the exact regional card,
not grounds for transferring characteristics between offers or editions.

API availability, automated-access permission, attribution requirements and
retention remain **open questions**, not approved capabilities or rights. No
automatic integration, scraping or discovery-to-fetch pipeline is added. This
conceptual flow does not authorize collecting grounded links into a fetch queue.
MW-FUT-01 remains Discovery. The current [URL-only PoC](url-context-poc.md) keeps
its fixed server-side catalogue. The opt-in Kinobaza extension reads only two
explicitly configured source cards; no discovered destination populates the
catalogue or triggers a follow-up request.

## Next experiment: current Ukrainian availability

The [two reported URL-only tests](digital-ua-owner-validation.md#url-context-evaluation-checkpoint--two-owner-run-live-tests)
provided identity/audio metadata but left availability and transaction fields
unknown. The provider's full retrieved content is unavailable; the cause of
omissions remains unresolved. Retrieval SUCCESS is not truth or entitlement.

The previous **manual experiment A is now completed for Coherence and Dune**:
see the [owner candidate-discovery record](digital-ua-owner-validation.md#kinobaza-candidate-discovery--manual-experiment-a-completed).
Kinobaza led to useful cards, including owner-confirmed Coherence availability
and Ukrainian audio on Prime Video. Dune audio observations remain tied to
HBO Max, Rakuten TV and separately checked Prime Video; no missing URL/provenance
or access type is invented. Earlier Apple/MEGOGO checks remain historical.

This is evidence for candidate-source utility in two cases, not completeness,
general accuracy or automatic-integration feasibility. The next question is
how to obtain candidate links responsibly without confusing an aggregator
signal with a current Ukrainian offer. The comparison below replaces the old
A-first recommendation. The later owner-selected URL-only scope is recorded
below; it does not authorize an automatic end-to-end pipeline.

## Candidate integration feasibility

Public documentation checked **October 18, 2026**. This review used read-only
public pages and official documentation, including the downloadable OpenAPI
document, **not Gemini/TMDb API calls**. No private endpoints, account automation,
cookies, scraping or bypass. Public access and robots.txt are not permission.

### TMDb: documented capability versus Ukraine coverage

- [Movie Watch Providers](https://developer.themoviedb.org/reference/movie-watch-providers)
  documents country-keyed, per-film provider availability supplied through
  JustWatch. It explicitly does **not** return full provider deep links: the
  country `link` is a **TMDb watch-page link**, not the exact provider offer.
  JustWatch attribution is explicitly required.
- The [official OpenAPI document](https://developer.themoviedb.org/openapi/tmdb-api.json)
  shows country examples with access buckets `flatrate`, `rent`, `buy` and
  `ads` when present. Provider entries describe
  `provider_id`, `provider_name`, `logo_path` and `display_priority`.
  These are aggregator/provider signals, not account entitlement. This response
  does not document offer prices, offered audio/subtitles or video formats.
- [Movie Providers](https://developer.themoviedb.org/reference/watch-providers-movie-list)
  allows country filtering with `watch_region`;
  [Available Regions](https://developer.themoviedb.org/reference/watch-providers-available-regions)
  documents the method for discovering countries with provider data. The
  [Discover Movie reference](https://developer.themoviedb.org/reference/discover-movie)
  and its OpenAPI parameters separate territory from monetization filters
  (`flatrate/free/ads/rent/buy`); language is not an offered-audio filter.
- **Ukraine is not verified by this review.** The inspected static OpenAPI
  movie example, its country-specific example schema and available-regions
  example do not contain `UA`. Examples are not a current exhaustive coverage
  guarantee or proof of non-support. Do not promise Ukrainian provider results
  for either film, invent a provider list or translate absent data into
  unavailable. A future separately approved API probe would first establish
  current region support and then inspect each film's `results.UA`, if present.
  No such probe was run here.

### TMDb: permission, attribution, retention and cost

- **Documented general terms, not AI clearance:** the
  [developer FAQ](https://developer.themoviedb.org/docs/faq) describes
  non-commercial API use as free with attribution, commercial licensing through
  sales (no price established here), and no SLA. It requires an approved TMDb
  logo and prominent non-endorsement notice in About/Credits. Watch-provider
  data additionally requires the JustWatch attribution above. Neither billing
  category nor the applicable agreement for this project is settled here.
- **Explicit restriction signal; current legal text needs verification:** an
  indexed first-party version of the
  [API Terms of Use](https://www.themoviedb.org/api-terms-of-use?language=en-CA)
  (labelled October 20, 2023; search index crawled over a year before this review)
  prohibits API/content use in connection with AI/ML applications, not only
  training. It also restricts derivatives, caching beyond six months and
  requires purging content on termination. Direct reading of the current legal
  page was blocked by robots; these are **indexed terms, not a fresh verification
  of the effective agreement**. They are a reason to hold, not a license for
  six-month storage or an assertion about a newly checked contract.
- **Unresolved:** applicable current agreement and any exception for candidate
  discovery in an AI-connected product, downstream transfer to another model,
  normalization/derived fields and retention. Do not pass TMDb data/links to
  Mykola or another LLM based on the FAQ's general free-use statement. Resolve
  this scope before an automatic experiment; this review neither contacts the
  provider nor changes existing production TMDb use.
- Provider API rights would not automatically grant rights to the destination
  sites' content. The existing [tool/source-rights review](url-context-poc.md#official-capabilities-display-and-terms-review)
  remains separate; Google Search reuse rules are not automatically applied to
  every URL-only route, nor treated as permission to harvest grounded links.

The later **bounded non-LLM** implementation proposal, current documentation
recheck and precise remaining agreement gate are in the
[TMDb data-probe handoff](tmdb-probe-handoff.md#technical-constraints-and-current-terms).
The older indexed AI wording is not a blanket decision on that new scope or
inference, nor a freshly verified current agreement.

### Kinobaza: what was and was not found

- [About](https://kinobaza.com.ua/about) describes a Ukrainian film catalogue
  with ordinary title search. The
  [Dune: Part Two public title page](https://kinobaza.com.ua/titles/dune-part-two)
  visibly contains Ukrainian title/provider links and country sections.
  Its watch section credits JustWatch; some links target
  `click.justwatch.com`. This checks public source/provenance presentation,
  **not** the owner's provider availability/audio observations.
- TMDb explicitly credits JustWatch and Kinobaza visibly uses it in this block.
  Thus overlapping provider signals may share upstream data and are not
  independent corroboration. This does not establish that every Kinobaza
  title/localization field comes from JustWatch or is copied from TMDb.
- **Not found:** a public documented movie/provider-link API or another
  explicitly supported automated export/interface, with authentication,
  fields, coverage and usage contract. Review scope: public About, Terms,
  Privacy, the title page and site-scoped searches for API/developer
  documentation. This is **not a finding that no API exists**; no undocumented
  endpoints were tested.
- [Privacy](https://kinobaza.com.ua/privacy) mentions RSS/API distribution of
  public discussion/user contributions. That is not a documented catalogue/
  provider-link interface or permission for our automated access.
- [Terms](https://kinobaza.com.ua/terms) apply to registered and unregistered
  users and place responsibility for use/third-party rights on the user.
  The reviewed pages do **not establish** automated access, redistribution to
  another model, extraction/normalization, attribution rules for an integration
  or retention/cache rights for movie/provider data. These remain unresolved;
  silence and public accessibility are not grants. No supported plan, API
  tariff, limits or SLA were found; costs are **unknown**, not zero.
- Manual discovery is owner-agreed research, not authorization for scraping or
  future public redistribution. Provider-specific prices, localization and
  entitlement still require their own offer/context checks.

## Options for the next technical step (design only)

| Option | Value and coverage limits | Complexity and dependencies | Known costs and unresolved questions |
| --- | --- | --- | --- |
| **A. TMDb provider discovery + manual exact URLs** | Structured country/provider/access-type leads; exact destinations still manual. Current UA/two-film coverage unverified; no offer audio/video/price or entitlement guarantee. | Small isolated server-side API step plus manual link entry, only after permission and UA capability checks. Needs owner credential, attribution and error/unknown handling; no direct-URL resolver inferred. | FAQ's free non-commercial category is conditional, commercial quote unknown; not a zero-cost project estimate. Current AI-use/transfer/cache agreement unresolved. No API call approved here. |
| **B. TMDb + documented supported Kinobaza interface** | Could add Ukrainian titles/exact-link candidates if the interface actually exposes them; shared JustWatch signals are not independent. Coverage/fields unknown. | Cannot size or select transport: supported public interface was **not found**. Depends on authoritative documentation/permission, fields, access limits, attribution and retention, plus A's gates. | No established plan/tariff; cost and maintenance unknown. Not feasible to implement on current evidence; do not substitute internal endpoints or scraping. |
| **C. Kinobaza as a manual auxiliary source** | Already useful for these two films; owner chooses exact regional cards and checks offers. Human coverage is bounded, not complete or automatically current. | Lowest complexity: no provider adapter. A proposed owner-curated link-only preview could exercise navigation/provenance separation without source-site fetching or model calls. Depends on ordinary owner access and manual identity checks. | Owner time/device/network and any provider/account charges are not measured; no automatic-integration tariff established. Redistribution/retention/AI forwarding of source data remains unapproved. |

Unknown usage/cost is not a blocker and is not zero. No integration is chosen
from the absence of documentation. The conceptual multi-source architecture
above is retained, not implemented or expanded on assumptions.

## Kinobaza URL Context decision

### Selected scope versus the previous recommendation

At checkpoint `714a176`, C (manual auxiliary discovery) was recommended, with a
possible owner-curated candidate preview. **That preview is not being built.**
The owner instead selected a smaller, different hypothesis: can the existing
Gemini URL Context tool expose provider hrefs from one exact Kinobaza card,
without reading destinations? The A/B/C review above remains about future
integration and its unresolved gates, not proof that this PoC is impossible
without a Kinobaza API.

The [implemented opt-in mode](url-context-poc.md#kinobaza-candidate-link-experiment)
uses fixed Coherence/Dune source URLs, original natural-language display and
separate retrieval metadata. It is offline-tested; two later
[owner-run tests](digital-ua-owner-validation.md#kinobaza-url-context--two-completed-owner-run-tests)
returned no provider URLs. The current scenario is not a suitable automatic
link generator on this evidence; the omission cause remains unresolved.
No TMDb data/API, new provider, Search, scraper, destination follow-up,
normalization, response archive or Mykola integration. No model/settings change.
Existing Search and Apple request bodies stay unchanged. This does not
retroactively validate the completed manual experiment as automated retrieval.

### Current first-party review: October 18, 2026

- **Technical capability:** [URL Context documentation](https://ai.google.dev/gemini-api/docs/generate-content/url-context)
  explicitly supports `gemini-3.8-flash`, public HTML and URL-only requests. It
  says only supplied URLs are retrieved, not nested links; retrieval can use
  an index cache before live fetching. This supports the one-source experiment,
  not freshness or an exact HTML/href-access guarantee.
- **Href visibility is a separate unknown:** the guide describes content
  extraction, not preservation of every anchor, tracking href, country heading
  or dynamic section. The provider's full retrieved content is unavailable.
  SUCCESS can coexist with missing URLs/territory. We cannot distinguish source
  omission, provider transformation and model omission from that status alone.
- **Google applicability:** [Gemini Additional Terms](https://ai.google.dev/gemini-api/terms)
  (effective March 23, 2026) cover developer use, generated content and paid/
  unpaid processing; Google retention differs from this app's no-storage.
  Its Search-specific subsection governs Google Search results, not
  automatically this URL-only mode. The URL guide prescribes no Search
  Suggestions for URL-only; keep returned attribution/text/metadata unchanged.
- **Concrete content restrictions, not a blanket grant:**
  [Google APIs Terms §5(a), §5(e), §6(b)](https://developers.google.com/terms#section_5_content)
  reserve third-party rights, restrict scraping/permanent copies, content
  redistribution/modification absent permission/law, and require applicable
  attribution. This PoC adds none of those archives/public redistribution/
  scraping mechanisms; whether the particular link-reading use has the
  necessary source rights is not settled by tool support. Do not strip source
  notices, normalize/reuse results in a dataset or forward them to another LLM.
- **Source terms:** [Kinobaza Terms](https://kinobaza.com.ua/terms) §1 applies
  to all users; §3 places responsibility for information use and third-party
  claims on the user. [Privacy](https://kinobaza.com.ua/privacy) does not license
  catalogue extraction via its public-discussion API mention. No express rule
  specifically approving or forbidding this exact third-party URL-only,
  transient owner display was identified in the reviewed pages. **Unresolved
  interpretation, not permission or a legal guarantee:** automated page access
  by the provider, source-content use, attribution and any future retention.
  Owner must resolve applicable rights before live use; stop if a restriction
  applies. No CAPTCHA/login/technical restriction bypass.
- **Public source identity only:** [Coherence](https://kinobaza.com.ua/titles/coherence)
  and [Dune: Part Two](https://kinobaza.com.ua/titles/dune-part-two) were opened
  read-only to check titles/directors and normal public card accessibility.
  This is not a Gemini retrieval probe, destination check, new owner-offer
  validation or proof of stable link coverage. No page contents archived.
- **TMDb stays separate:** no TMDb calls or data are needed. The older indexed
  TMDb legal text above is not a freshly verified effective agreement and
  neither authorizes nor blocks this independent source experiment.

### Acceptance and stop boundary

Success for the narrow hypothesis means the owner can reconcile returned
provider/link/territory with the exact source card, preserving redirect hrefs
without model-reconstructed destinations. Missing href/territory stays unknown;
a general Ukrainian film-localization badge is not provider localization.
A candidate link is not availability, access type, price or entitlement.
Incorrect identity, invented hrefs, foreign-section leakage, retrieval failure
or inaccessible source are recorded as failures/unresolved, not silently fixed.

The [owner comparison plan](url-context-poc.md#owner-comparison-not-run-by-the-implementation-agent)
and [standalone Termius commands](iphone-windows.md#kinobaza-url-context-one-line-owner-commands)
cover synthetic first and then one manual live request per film, without
automatically visiting returned links. Stop after two cases, an applicable
restriction, blocked source or identity ambiguity. No output archive, raw
metadata/screenshots or accuracy score. Usage/cost is unknown rather than zero
and is not a blocker. No integration is selected from this experiment alone.

## Initial HTML inspection after the owner tests

### Method and independently observed source facts

Checked **October 18, 2026**, after the owner's report. This was a bounded manual
inspection of ordinary public HTML, **not another Gemini test or an implemented
scraper**. Two direct GETs per fixed source card used PowerShell
`Invoke-WebRequest -UseBasicParsing`, no login/account cookies or browser session,
no JavaScript/asset execution, no automatic redirects and no destination URLs
opened/resolved. Both passes returned HTTP 200 and `text/html; charset=UTF-8`.
Only in-memory source inspection was used; no HTML, extraction script, candidate
dataset or response archive was added to the repository.

| Source card | Observed in the initial HTTP response, before JavaScript |
| --- | --- |
| [Coherence](https://kinobaza.com.ua/titles/coherence) | The `availabilityAccordion` / `collapseUA` markup under the explicit Ukraine heading contained one ordinary anchor labelled Apple TV Store, with an actual `href` to `click.justwatch.com`. |
| [Dune: Part Two](https://kinobaza.com.ua/titles/dune-part-two) | The explicit `collapseUA` block contained two ordinary anchors, Rakuten TV and HBO Max, with actual `click.justwatch.com` hrefs. Additional iTunes/Apple and MEGOGO hrefs were present before that accordion; their position alone is not an explicit UA territory label. |

These were actual `<a href="…">` attributes, not merely provider names,
JavaScript-only URL placeholders or strings awaiting a destination lookup.
The JustWatch hrefs contain long encoded tracking/redirect query parameters;
they were neither decoded into guessed final URLs nor followed. Bootstrap
collapse markup can control visibility, but does not need to create these
already-present anchors. Dune also has later foreign-country blocks: a
page-wide provider match would conflate territories.

This establishes **at least these links in the inspected initial responses**,
not a complete permanent inventory. The inspected Coherence UA block did not
establish the owner's earlier Prime Video candidate. A generic Prime navigation
link elsewhere on a page is not a title-specific offer. Do not erase the earlier
owner observation, infer unavailability, or claim that all users/times receive
the same card content. No current entitlement, audio, prices or final provider
destinations were checked by this inspection.

### What this resolves, and what it does not

For the observed anchors, **JavaScript is not a prerequisite for href presence**.
The broad explanation "the source HTML contains no provider hrefs" is not
supported by these responses. A technical read of initial HTML could encounter
candidate hrefs; that is a capability observation, not approval to build it.
No post-JavaScript browser comparison was necessary for this positive finding
or performed; additional/different dynamic links remain unassessed.

These are later unauthenticated responses, not the provider's hidden payload
or its response at the owner's execution time. Source variants/cache age,
provider content processing/href omission and model selection/response behavior
remain possible but **unestablished** explanations. The
[URL Context guide](https://ai.google.dev/gemini-api/docs/generate-content/url-context)
documents cached/live retrieval and metadata, not preservation of every href.
The current failure therefore does not isolate a specific Gemini defect or
prove that another integration is impossible. No repeated model request was
made to choose a cause.

### External citation anomaly: keep attribution distinct from retrieval

The Dune `m.vkino.com.ua` entry is an **owner-reported anomaly**, documented in
the owner record, not an independently examined response. Google's
[Candidate / CitationMetadata reference](https://ai.google.dev/api/generate-content#CitationMetadata)
describes source attribution; the Candidate field can include recitation
information. It is distinct from
[`UrlContextMetadata`](https://ai.google.dev/api/generate-content#UrlContextMetadata),
which describes tool retrieval. This distinction explains why a citation entry
is not a network trace; it does **not** establish recitation as this anomaly's
cause. No attributed passage/offsets or exact external URI were supplied.

The literal `m.vkino.com.ua` string was not present in either sampled initial
HTML response. That narrow negative finding neither proves an external fetch
nor proves the answer was derived only from Kinobaza, and does not audit all
scripts, nested resources, earlier page versions or Google's index. The
external host was not contacted. One configured source URL/tool is not proof
of exclusive provenance for all generated text. Do not treat this as evidence
of an actual Search fallback or make an unsupported security diagnosis.

### Access terms: separate from HTML feasibility

Rechecked public first-party pages October 18, 2026:

- [Kinobaza Terms](https://kinobaza.com.ua/terms), §1/§3, apply to public users
  and place responsibility for information use/third-party rights on the user.
  No clause expressly granting or expressly prohibiting this exact bounded
  initial-HTML inspection was identified. This is an **unresolved permission
  question**, not a legal conclusion or a general automated-access license.
- [Kinobaza Privacy](https://kinobaza.com.ua/privacy) mentions public discussion
  RSS/API distribution, not a catalogue/provider-link extraction contract.
  No documented permission for repeated harvesting, transfer to an LLM,
  redistribution, source-data retention or an attribution scheme for a future
  HTML integration was established. Public accessibility, HTTP 200 and
  robots.txt are not grants. Existing JustWatch labels/sponsored redirect
  links do not license us to reuse the partner's feed or private interfaces.
- [Google APIs Terms §5(a/e), §6(b)](https://developers.google.com/terms#section_5_content)
  constrain content copying/scraping/attribution; the earlier Google review
  remains applicable to Google-delivered content, not a source-site license.
  Search-specific restrictions are not automatically applied to this URL-only
  path or to ordinary HTML inspection. No source/Google rights guarantee is
  inferred, and no TMDb data/API is needed for this feasibility finding.

### Feasibility conclusion / next decision

**Do not promote the current URL Context scenario into an automatic URL
generator or repeat the two live requests now.** Relevant hrefs exist without
client JavaScript in these source responses, so an eventual permission-reviewed
initial-HTML approach is technically plausible for these anchors. Reliability,
stable coverage, supported access, source/JustWatch rights, attribution and
retention are not established. No scraper, parser module, new endpoint,
integration, model/prompt change or implementation handoff is produced here.

At that checkpoint, supported access and permissible candidate-link use needed
clarification before a prototype. The subsequent owner request approves only
the bounded experiment below after a fresh public-rules check, **without an
email prerequisite**. It does not approve regular/commercial integration or
silently replace URL Context. Preserve no archive, no availability-from-link
inference and no general accuracy/cost claim.

## Owner-approved HTML extraction PoC

### Public rules checked before implementation — October 18, 2026

- [Terms](https://kinobaza.com.ua/terms) §1 applies to public/registered users;
  §2 lists prohibited site-user conduct, not an automated-access authorization;
  §3 leaves information-use and third-party-rights responsibility with the user;
  §4 allows the terms to change. No direct provision prohibiting this specific
  two-card, manually initiated, transient link-reading experiment was found.
  **Absence of a found ban is not an established license** for regular fetching,
  commercial reuse, redistribution, attribution practice or retention.
- [robots.txt](https://kinobaza.com.ua/robots.txt), read directly as text (HTTP
  200), has generic-group exclusions for movie/series query pages, comments,
  search and certain person subpages; none matches the two exact `/titles/...`
  source paths. Commented-out title rules are not active. The separate
  `meta-externalagent` group denies all paths; our descriptively identified
  `MovieWishlistResearchPoC/0.1` client is not that agent. **Robots is not a
  license**, and no user-agent disguise or technical bypass is approved.
- [About](https://kinobaza.com.ua/about) says this is film information, not
  hosting online films. [Privacy](https://kinobaza.com.ua/privacy) distinguishes
  external sites and public-discussion RSS/API, not a catalogue-reuse agreement.
  The earlier public HTML inspection found JustWatch attribution/sponsored
  redirect notices: keep source/label provenance; no partner feed/private API
  access or claim of independently confirmed offers follows from those links.

**Decision:** no direct applicable conflict or technical block was identified
in this public-rule review. Proceed within the owner's narrow approval; email
is not a precondition merely because broader rights remain unestablished.
Redirect/403/429/CAPTCHA or changed rules are stop conditions, not retry/bypass
instructions. No current live card extraction was performed by the agent for
this iteration. The rules read is not live validation. TMDb/Google content terms
do not govern this non-LLM transport by automatic inheritance.

### Implemented experiment and parser choice

`DEMO_RETRIEVAL=kinobaza-html` reuses validated fixed sources, LAN auth,
Host/Origin and one-shot `/answer` gating. No arbitrary URL or crawler. One
manual click → one GET; no cookies, redirects, retries, scripts/assets, model
or destination/tracking requests. A 15-second whole-read deadline and 2 MiB
body limit bound input. Error bodies, HTML and credentials are never logged,
stored or sent to the browser. The result is session-page memory only.

[parse5](https://parse5.js.org/) **8.0.1** is pinned in the demo's private
`package.json`/lockfile, with locked `entities` transitive dependency; root
production manifests are untouched. It provides HTML tree parsing and source
attribute locations without a browser/script engine. This avoids a home-grown
whole-page-regex parser or resource-loading browser DOM. It is lazy-loaded, so
existing Gemini modes need no parser installation. Missing parser is reported
before a live source GET. Use `npm ci --prefix research/grounded-answer-demo
--ignore-scripts --no-audit --no-fund`; no install scripts or new service.

The source-specific adapter requires unambiguous observed heading/original
title/year/director, then explicit country heading → target → matching panel
relationships. It currently recognizes UA, PL, CZ and DE labels from the
inspected layout; unsupported/duplicate/mismatched markup yields a visible
unsupported result, not a different territory guess. Only recognized provider
markers count; navigation/trailers/ads and JustWatch attribution are excluded.
Recognized pre-accordion film badges are shown separately with territory null.
No global localization transfer or availability/price/audio inference.

`href` retains the parsed attribute value; `rawHref` retains source spelling,
so entity decoding is visible while percent/query/tracking encoding is never
reconstructed or resolved. Relative hrefs stay relative. Unsafe schemes,
credentialled absolute URLs and invalid values are withheld/unresolved. Missing
hrefs retain an unresolved provider entry. Ambiguous film identity stops the
candidate list. This intentionally fails closed and is not a complete generic
provider discovery API. Partial results are not absence evidence.

### Evidence and boundaries for the new mode

At implementation checkpoint `8e36937`, the mode was synthetic/mock-tested and
live-unvalidated. The subsequent [two-film owner-run HTML checkpoint](digital-ua-owner-validation.md#kinobaza-html--completed-owner-run-checkpoint)
completes manual testing of this stage, not independent agent validation or
proof of complete coverage. Existing Gemini results and earlier initial-HTML
checks remain historical, separate evidence. Neither author-written fixtures
nor rules retrieval establish card compatibility, link validity or entitlement.
No new candidate-preview product, production/Mykola integration, cache, database,
response archive or regular/commercial extraction is approved.

The [HTML owner workflow](iphone-windows.md#kinobaza-html-owner-workflow) specifies
synthetic first, then one owner-run live GET per film, without API key. Those
manual source tests are now complete; the commands are reproduction instructions,
**not a request to rerun** them for this documentation checkpoint.
Verify identity, explicit UA/foreign/unknown groups and exact/raw href spelling
against the source card, without resolving destinations. Record unresolved and
blocked results as such; no raw HTML/screenshots/output archive in Git. Recheck
rules before a later run if they change. Real iPhone/SSH-disconnect survival for
this new mode remains owner-validation pending. No merge/deployment or system
changes accompany this experiment.

### Independent checks for this iteration (not live validation)

- Node 24.22.0 offline/HTTP suites: **107 passed, no failures/skips**. Authored
  synthetic HTML covers UA/foreign/unscoped links, attribute/entity/percent
  encoding and relative URLs, exclusions, missing/unsafe hrefs, identity and
  markup ambiguity, status errors, timeout/body limits and one-shot/auth gates.
- All **22 Gemini request bodies** were independently compared with Git
  checkpoint `a4dbbab` and pinned in a golden-hash regression: unchanged Search,
  Apple and Kinobaza URL Context prompts/tools/generation settings.
- Final bounded sequential installed-Edge/browser suites: **60 passed,
  4 skipped, no failures**. Skips: three missing WebKit checks and optional
  same-host LAN without a supplied test IP. Narrow Edge is not real Safari.
  Synthetic/mock display verifies no raw-HTML insertion, destination requests,
  browser storage, response logs or automatic second click/request.
- The initial parallel browser run stalled in a test worker; terminating only
  its verified headless test browser produced closed-browser failures. That run
  is **not counted as passed**; its stall cause is unresolved. Standalone HTML
  and two bounded sequential full reruns passed without relaxing assertions or
  application security. Prefer the documented sequential/time-limited command.
- Windows PowerShell 7: separate temporary copies/free ports passed HTML,
  Search, Apple and Kinobaza Gemini helper start/status/duplicate/safe-stop/
  restart tests. HTML also parsed synthetic markup in the detached child, then
  restarted in live **readiness only** without a key prompt or source GET.
  No `/answer` call in live Windows mode; owner process untouched. Actual
  Termius disconnect and PowerShell 5.1 remain unverified for this new mode.

No agent live extraction, model API or production call at that implementation
checkpoint. Dependency installation and public-rules retrieval are setup/research,
not evidence of live extraction. The checks above remain historical results,
not rerun test claims for the Markdown-only checkpoint below.

## HTML checkpoint diagnosis: no parser expansion

Checked October 18, 2026 against `8e36937`, using [html-source.mjs](../html-source.mjs),
[the authored fixture](../synthetic.mjs), existing tests and the retained
[initial-HTML inspection](#initial-html-inspection-after-the-owner-tests).
**No new Kinobaza/provider request, owner test or destination resolution.**

**Coherence → Prime:** the earlier independent inspection established an Apple
anchor in `collapseUA`, not a title-specific Prime anchor. It did not establish
whether such an anchor existed elsewhere/dynamically or in the owner's response.
The live HTML was deliberately not archived, and this owner report has no DOM
location/attributes for the omitted link. Thus a specific source-vs-parser root
cause **cannot be established** from the available evidence.

The adapter has no Prime-specific denylist: `providerName()` accepts any exact
`Дивитись / Купити на …` title (with matching image alt), including Prime Video.
It additionally recognizes a short explicit badge vocabulary, including
`prime video`, **not** `prime`. Only supported country panels and pre-accordion
film badges are searched; bare provider text, differently labelled anchors and
anchors outside these ranges may be omitted without an issue. These are concrete
coverage limits, not proof that one caused the observed omission. Generic Prime
navigation must not be promoted to an offer to fill the gap.

Four in-memory, no-network authored-fixture probes confirmed: a properly labelled
Prime UA anchor is accepted; a bare Prime link and unsupported short `prime`
badge are not; a labelled YouTube `/results?search_query=…` URL is accepted as
an absolute candidate. The fixture's separate relative-link issue remains
unrelated to those UA checks. These are code-behavior probes, not live evidence.

**Search URLs:** `candidate()` checks HTTP(S), syntax, unsafe values and JustWatch
attribution, but `hrefKind` distinguishes only absolute/relative/missing. Neither
it nor the display establishes a destination type or film identity at that URL.
This explains why a provider-labelled YouTube search transition can survive
without an issue. It is not an exact regional-card/offer result. A tracking URL
may conceal the destination type; without resolving it the type stays unknown,
not guessed from a provider logo. No search URL is followed or reconstructed.

**Decision:** freeze the completed narrow PoC; no parser broadening or new owner
tests in this checkpoint. A later separately reviewed change could distinguish
observed search-transition / exact-card-unverified / redirect-unknown types,
with small authored fixtures and preserved exact hrefs. It must justify each
source marker, retain unknowns and avoid destination GETs. It would not by itself
recover Prime or validate offers. No automatic discovery pipeline is approved.

## Movie of the Night: bounded feasibility only

Official public materials checked **October 18, 2026**; no account creation,
subscription, credential use, API call or adapter. This is separate from Kinobaza
owner results and Google tool terms. Sources describe a capability, not measured
coverage or accuracy for our two films.

### Ukraine coverage and fields

The [Countries & Services guide, Ukraine](https://docs.movieofthenight.com/guide/countries-and-services#ukraine)
lists `netflix`, `prime`, `apple` (plus Mubi, Curiosity Stream, Crunchyroll).
For our six-platform allowlist:

| Platform | Published UA API coverage |
| --- | --- |
| Netflix / Prime Video / Apple TV | Listed; actual two-film offers/field completeness not tested. |
| Rakuten TV / MEGOGO / HBO Max | Not listed for UA; do not substitute global/foreign coverage or infer service unavailability. |

The official [OpenAPI 4.1.0 schema](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)
defines country-keyed `streamingOptions`, `link` (web offer page), optional
`videoLink`, `type` (free/subscription/rent/buy/addon), price amount/currency,
audio locales and subtitle locales/closed captions. `quality` is optional
sd/hd/qhd/uhd. No HDR10/Dolby Vision, audio codec/channel layout or cut field is
documented in these models. Missing/empty data stays unknown, not confirmed
absence. Schema presence does not establish Ukrainian audio completeness or
account entitlement; `availableSince` is detection time, not a fresh playback
check. Title/director/year/IMDb/TMDb fields support identity checks, not cut proof.

### Access plan and applicable terms

The [official pricing page](https://www.movieofthenight.com/about/api/pricing)
lists all endpoints/catalogues on Free: **$0/month, 1,000 requests/month**, no
payment details; Starter **$49/25,000**, Growth **$99/100,000**, Scale
**$299/1,000,000**, USD/month. Free would suffice for a tiny non-AI capability
probe if separately approved; no paid plan is needed merely to unlock fields.
Account/API key required. Quota is a hard stop without overage, not permission
to retry. Recheck at signup; these prices are not an experiment cost estimate.

The current [portal Terms](https://developers.movieofthenight.com/terms-and-conditions)
were read from its publicly referenced
[terms module](https://developers.movieofthenight.com/assets/terms-and-conditions-By-pMztN.js)
without executing it: portal HTML is a JS shell; this session had no browser
surface. The official schema/README link to these portal terms. The older GitHub
`TERMS.md` differs and is **not substituted as the current agreement**.

- §3 permits app/end-user display, including commercial products, subject to
  restrictions on standalone redistribution/data services and competing products.
- §4 requires visible attribution/link to the API for display and written
  publications; §5 reserves third-party content rights, with notice/takedown
  duties. Attribution is not a third-party licence.
- §6 permits functional caching/storage and post-subscription retention subject
  to the other terms; this research still adds no archive. §2 disclaims data
  completeness/accuracy. §§7/9 cover quotas and subscription billing.
- **§10 explicitly prohibits using the data to train, fine-tune, evaluate or
  improve ML models/AI systems.** Do not use it as Gemini evaluation ground truth.
  Sending data to Mykola/another LLM for inference is not explicitly resolved by
  these provisions; no permission is inferred. Clarification would be needed
  before such a proposal, not a new adapter now.

### Recommendation and limits

At documentation checkpoint `30c3160`, the recommendation was to treat this as
a **partial non-LLM API candidate**, not a six-platform replacement
or approved Mykola integration. First decide whether coverage of three of six
platforms and absent HDR/audio-format fields is useful. If so, separately approve
a tiny owner-operated, display-only UA capability probe under the current terms:
country/service check plus the two already identified films, with attribution,
no LLM, no destination fetching or public dataset. Success would mean country/
identity-scoped API-reported links and explicit available/missing fields, not
account availability or model accuracy. Stop on access/terms conflict, quota,
identity mismatch or need for unsupported providers/fields; no fallback scraping.
Do not ask the owner to repeat the completed streaming-card checks. No integration
choice, implementation handoff or additional test was executed at that checkpoint.

## Approved non-LLM API probe

Subsequent owner authorization, October 18, 2026: implement a minimal direct
Movie of the Night probe for **Coherence and Dune, country UA**, not a new
six-platform integration or evaluation of an AI system. Current implementation
uses `DEMO_RETRIEVAL=motn-api`; at implementation it was **live-unvalidated**.
The [later two owner runs and closeout](#motn-closeout-identity-and-field-provenance)
are now complete, not independent validation or a post-fix retest. Existing
Search/URL Context/HTML modes and prompts are not changed.

### Current contract and rules recheck

- The current official [OpenAPI](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)
  is 4.1.0 on the `/v4` transport. `GET /shows/{id}` accepts the documented IMDb
  `tt…` form; `country=ua` asks for only Ukraine. Key from the direct
  [developer portal](https://developers.movieofthenight.com/) uses `X-API-Key`,
  not a RapidAPI key. No `/countries` or search request is added. Exact fixed
  IDs and prior evidence limits are in the [README](../README.md#movie-of-the-night-api-probe).
- [Published UA service coverage](https://docs.movieofthenight.com/guide/countries-and-services#ukraine)
  remains Netflix/Prime/Apple among our scope; this is not measured offer-level
  completeness. In the schema, `apple.rent`/`apple.buy` and subscription/addon
  types are distinct: the service ID/name is not an Apple TV subscription claim.
  No hidden subscription-only filter. Source `link`, access/addon, locales,
  optional quality and price are kept separate; no HDR/DV/codecs inferred.
- [Direct pricing](https://www.movieofthenight.com/about/api/pricing) rechecked:
  **Free $0 / 1,000 requests/month**, all endpoints/catalogues, no payment details.
  Optional Starter $49/25,000, Growth $99/100,000, Scale $299/1,000,000 USD/month.
  Free is sufficient for the two manually initiated title requests; no paid
  subscription chosen. Quota hard stop/no overage; signup/billing must still be
  checked by owner. A free advertised plan is not a zero total-cost claim.
- [Current Terms](https://developers.movieofthenight.com/terms-and-conditions)
  and their public route module linked above were re-read (not the older GitHub
  agreement). **§3** permits app/end-user use subject to standalone-data-product,
  redistribution and competing-service restrictions; this local owner-only UI
  does not offer a public dataset/API. **§4** attribution is visible before and
  after the request. **§5** third-party rights remain separate, so no logos,
  posters/descriptions or redistribution are introduced. **§6** permits functional
  retention subject to other terms, but the probe keeps none. **§10** AI training,
  evaluation/improvement prohibition is respected: no LLM receives any result,
  and data is not AI ground truth. It is not read as an automatic decision about
  inference rights, which are outside scope. No direct conflict with this narrow
  non-LLM manual capability probe was identified; this is not a legal guarantee
  or permission for a future pipeline. Stop on a concrete applicable conflict.

### Implemented boundary and original owner plan

Minimal built-in-fetch adapter, no SDK/dependency. One title GET per token,
20-second/2-MiB bounds, no redirects/retries/continuations/cookies/destinations.
Server-side secret header; safe content-free errors. Only UA fields projected;
foreign catalogue, descriptions/images and raw body never reach the page.
Identity mismatch stops offer display. Missing/empty UA is not unavailable.
Missing language versus an array without Ukrainian are distinguished, but list
completeness is not established: neither becomes confirmed absence. Provider
metadata is not account entitlement. Live output is neither logged nor archived.

The original plan was **one request per film**, now completed, not an automatic batch or new check of
every streaming card. Historical dated manual observations are controls, not
current guaranteed truth. Ask for a concise useful/missing-field summary; only
new or materially conflicting results merit another exact-card check. No full
JSON/metadata request unless an error actually requires diagnosis; never secrets.
[Termius/Safari commands](iphone-windows.md#movie-of-the-night-api-owner-workflow)
retain existing safeguards. No repeat SSH-disconnect test is mandated: detached
launch/auth mechanics are unchanged; the new key routing is tested in an isolated
mock-only Windows child, not inferred from Start-Process alone.

Agreed next sequence, **not an implemented pipeline**: Movie of the Night probe
→ compare with Kinobaza/JustWatch → MEGOGO direct-adapter feasibility → common
offer model. The [owner-reported platform coverage](digital-ua-owner-validation.md#owner-reported-platform-coverage-and-next-sequence)
does not guarantee API fields/catalogue completeness. Kinobaza's JustWatch
redirects are not a direct Partner API integration. Authorized workers remain
a separate conditional research direction; no credentials/accounts/worker or
new downstream adapter is provisioned. MW-FUT-01 remains Discovery.

## MOTN closeout: identity and field provenance

Audit October 18, 2026 against actual PR #179 HEAD `d3e32b0`, base #178
`30c3160`. Tracked tree was clean; no changes from the deliberately interrupted
turn were present. Owner's [two completed runs](digital-ua-owner-validation.md#movie-of-the-night--two-completed-owner-run-results)
are not independently repeated. No provider/model/destination request or full
response archive. Public documentation reads are not live data validation.

### Proven adapter defects and minimal correction

`normalizeMotn()` required `releaseYear === expected.year` even with exact
IMDb and agreeing supplied TMDb ID. A new authored fixture with Coherence's
reference identity and a differing integer year failed before the fix; currency/
language provenance checks passed unchanged. Thus the gate could reject a
stable-ID match solely over 2013/2014. **Corrected:** year variance is retained
as a visible warning, not an identity veto or a guessed explanation of the year.
The fixed catalogue/IDs, request URL/country, transport and field values stay
unchanged.

Explicit valid stable-ID conflict (including movie/TV namespace), or returned
series type, is now `mismatch`; missing/invalid required identity or other
ambiguous metadata stays `unresolved`. Both withhold options with
`optionsState=withheld-identity` and do not evaluate UA. Matched identity with
an actually empty array is `reported-empty`; missing UA is `not-reported`.
The display distinguishes these, not an invented negative availability result.
The correction does **not** reveal what Coherence's live API options contained;
no post-fix live run is requested. No confidence score or general matching engine.

### Field trace: source, adapter, display

Paths below start at `response.streamingOptions.ua[i]`. The official
[MOTN OpenAPI](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)
documents price strings/currency, optional quality, audio locales and subtitle
locale/CC objects. Code paths are [motn.mjs](../motn.mjs), the unchanged MOTN
branch of [server.mjs](../server.mjs), and [display](../public/motn-display.mjs).

| Source | Adapter → display | Finding / limits |
| --- | --- | --- |
| `price.amount`, `price.currency` | `priceField()` → each `stringField()` → `Price/currency` joins those values. | No country-based UAH default, conversion, price inference or lookup. Missing/null currency remains not reported. `price.formatted` is **not used** to recover/change either field. Applies identically to Apple and Prime, separately per offer. |
| `quality` | Validate returned sd/hd/qhd/uhd → display value. | No HD default or UHD/HDR inference; missing/null is not reported, unsupported code withheld. |
| `audios` | `languageField()` checks each returned locale → Ukrainian matches / returned locales. | `ukr`/explicit `uk`, not original language or country. Missing and null both become not reported; raw missing-vs-null is not retained. Empty array remains `[]`, not listed with completeness unknown. |
| `subtitles` | Same, using each `locale` and optional `closedCaptions`. | Independent of audio; identical missing/null/empty distinctions. No subtitle/audio substitution or proven completeness. |

**No field-mapping defect demonstrated** in these paths at the inspected HEAD.
Authored regressions preserve USD, UAH and EUR in the same UA context, omit
currency/quality without defaults, and distinguish empty lists from not reported.
Browser mocks verify literal amount/currency/HD and withheld-vs-empty messages.
The synthetic values are authored examples, not reconstructions of live data.

### Source discrepancies versus unknown causes

Owner-reported Apple HD/empty lists and UAH prices differ from the owner's dated
4K/DV, Ukrainian-audio and USD observations; Prime prices raise the same currency
question. In the inspected code, these displayed fields can only come from the
corresponding response fields. However no full live response/running-commit
trace exists to independently prove those original values, compare `formatted`,
or diagnose upstream currency/catalogue/region/age/metadata processing. **The
exact cause remains unestablished**, not a proven upstream bug or agent retest.
No USD, UHD, Ukrainian audio or negative availability is substituted from controls.

Close this manual stage: useful candidate links/access types in these cases;
language, video, prices/currency and coverage not established as complete or
reliable. Two films do not support a general accuracy conclusion. No new owner
test. The [TMDb handoff](tmdb-probe-handoff.md) was subsequently approved and
implemented as an isolated follow-up; its live run remains conditional. Other demo modes, native
Windows/auth controls, Kinobaza parser and production are unchanged.

## Approved TMDb data probe — implementation, not live findings

The owner approved the bounded two-film handoff after #179 `9e4bf4f`. Separate
`tmdb-data` mode now implements A identity/catalogue metadata and B actual
`results.UA`, maximum two serial HTTP requests per film, with fixed IDs and no
search/fallback/LLM/destination requests. This is not a shared offer model or
new availability truth source. MOTN and Kinobaza modes/parsers are unchanged.

Canonical endpoint/schema/terms assessment, localization hypothesis and actual
implementation limits remain in the [existing handoff/record](tmdb-probe-handoff.md#implementation-record),
not duplicated here. The official TMDb FAQ/Watch Providers docs were rechecked
October 18, 2026. Full current API Terms remain robots-inaccessible, so
**live readiness is conditional on owner review of the applicable agreement**,
not a permission/ban inferred from an old index or a compulsory email. No paid
plan selected. The official documentation SVG/notice and JustWatch attribution
are local display assets, not response evidence or branding certification.

Initial implementation + synthetic/offline checks did not answer which real
fields/UA providers are returned. The [first owner Coherence run](digital-ua-owner-validation.md#coherence--first-owner-run-result)
subsequently reported Apple TV Store rent/buy in UA and invalid appended objects.
The [separate validator diagnosis/fix](tmdb-probe-handoff.md#appended-resource-validation-correction)
does not independently establish the original live shape. The owner subsequently
confirmed Dune A/B and all five appends passed; the manual stage is complete.
In particular film-level TMDb language/UA aliases do
not fill MOTN's provider-track/quality/currency gaps. Explicit `uk` catalogue
translation and JustWatch aggregate buckets are different evidence classes;
shared JustWatch lineage is not independent corroboration. No additional owner
tests or Coherence/card/synthetic/SSH-disconnect repeat requested.
[Completed owner checkpoint](digital-ua-owner-validation.md#tmdb-data-probe--completed-owner-checkpoint).

## Shared offer observation model — design only

Motivated by the [completed two-film source comparison](digital-ua-owner-validation.md#cross-source-complementarity--observations-not-independent-entitlement).
This is a **proposed logical contract**, not implemented types, normalization,
runtime aggregation, storage, LLM forwarding or a production feature. Start with
digital offers; physical disc/cut models and automated Mykola recommendations
remain separate work. No arbitrary confidence score or global verified badge.

Keep **film catalogue metadata**, **candidate links**, **source offer claims**
and **account-specific observations** distinct. A candidate can exist without
an offer; a source availability signal can exist without a provider deep link.
One provider can have multiple rental/purchase/subscription/package offers.

| Component | Minimal proposed fields and meaning |
| --- | --- |
| Subject | Expected/observed TMDb, IMDb and provider-native IDs with namespaces; identity matched/mismatch/unresolved + basis; title/year/director; cut/version unknown unless established. Dates alone cannot veto exact agreed stable IDs. Catalogue original/localized title, description/tagline **presence** and film languages live here, not in provider tracks. |
| Candidate | Exact observed href, source card, provider name/namespace ID, link kind (exact card / tracking-redirect / search / relative / unknown), explicit territory + basis or unknown. Never reconstruct/resolve a destination automatically. A search URL is not an exact card; a TMDb country watch page is not a provider link. |
| Offer scope | Subject + provider + country/basis + access type/source bucket + package/offer/version ID if supplied. Unknown access/package/cut remains unknown. Country from a section/API key is a source context, not proof of account entitlement. |
| Field observation | Field path, value, state (reported / explicit-negative / unknown / invalid), source/URL or endpoint, evidence method, receipt time and observation time separately; review provenance (not reviewed / owner-reported check / independent check), context and short evidence note. Missing/null/empty distinctions preserved where supplied. No invented timestamps or account settings. |
| Availability / entitlement | Availability value available / preorder / unavailable / unknown, always scoped to the reporting source/context. Separate listing/link found, aggregator claim, direct public-page claim, account Play-button observation and new rental/purchase terms. A Play button is not a new purchase price; reported availability is not independently verified playback. No search miss or missing UA becomes unavailable. |
| Characteristics | Separate audio locales, subtitle locales/types, video resolution, HDR10, Dolby Vision, price amount/currency, access type and package. Audio codec/channels attach to a specific locale only with evidence. Track-list completeness defaults unknown; original_language and Ukrainian catalogue text never fill offered tracks. UHD is not HDR/DV. |
| Provenance / limitations | Source and upstream lineage (e.g. JustWatch), retrieval status, identity/territory context, field conflicts, missingness/completeness, attribution and allowed-use/retention status. Unknown rights are unresolved, not permission. A retrieval SUCCESS/HTTP 200 is not claim truth or freshness. |

**Combining policy, proposed not implemented:** group observations only after
identity/provider/country/access/package/version compatibility is established.
Provider IDs are namespaced per source; Apple TV Store must not be conflated
with an Apple subscription/channel merely because the brand name matches.
Unknown scopes can be displayed alongside, not silently merged. Preserve each
source assertion with its own provenance; do not choose a universal winner or
count TMDb + JustWatch-derived Kinobaza as two independent confirmations.
Conflicting claims stay separate with a conflict flag; observation time does not
automatically establish freshness/priority. Do not overwrite MOTN UAH/HD/empty
lists with owner USD/4K/Ukrainian audio, nor transfer a Kinobaza unscoped MEGOGO
link into UA just because a separate owner observation was Ukrainian.

### Proposed source mapping and acceptance

| Existing source | Contribution | Must not imply |
| --- | --- | --- |
| TMDb Details/translations | Stable identity, names/aliases/directors/dates, explicit Ukrainian catalogue text evidence. | Offered audio/subtitles from spoken/original language, title/overview/tagline or an empty UA release-language field. |
| TMDb / JustWatch results.UA | Country provider/access-bucket observations; TMDb watch-page link separately. | Exact provider URL, account entitlement, current offer characteristics or independence from Kinobaza's JustWatch sections. |
| MOTN | Additional provider URLs and access types; literal per-offer metadata with provenance. | Complete language lists, reliable price currency/quality or absence from empty/missing data; no automatic correction or AI forwarding permission. |
| Kinobaza HTML | Additional exact/tracking href candidates and explicit section territories; otherwise unknown. Includes MEGOGO candidate. | Availability, localization, entitlement, resolved tracking destinations or UA territory from a loose page location. |
| Owner observations | Field/context-specific manual controls with owner attribution; no account credentials. | Agent validation, universal truth, current guaranteed price or whole-platform verification. |

Future acceptance tests (authored data only): same provider rent/buy stay separate;
unknown territory/package/cut never auto-merges; search/relative/tracking remain
distinct; conflicting currency/quality retains both assertions; empty languages
never become absence; film localization never becomes provider audio; shared
JustWatch lineage never raises an independent-confirmation count. No persistence
or real-source-derived archive is authorized by this design. Implement the model
only in a separately scoped task after source-specific usage/attribution/transfer
conditions are established; do not retrofit current adapters now.

<a id="megogo-one-card-adapter-proposal--not-implemented"></a>

## MEGOGO one-card HTML PoC

**Status: implemented / offline-tested / live-pending.** This section replaces
the earlier proposal in place; the legacy anchor preserves historical links.
Starting from #180 `b9f3c65`, the owner approved the same bounded experiment
model as Kinobaza HTML: one fixed public card, explicit manual action, transient
display. This is not approval of regular/commercial integration. The shared
offer model above remains design-only; other adapters and prior observations
are unchanged. Hypothesis: the initial HTML might provide useful offer-local
metadata missing from aggregators. Earlier owner Dune/MEGOGO observations are
dated controls, not seeded fixtures, current expected facts or a retest request.

### Public interface / terms review

Read-only official sources checked **October 18, 2026**; no streaming-card or API
request. [Partnership](https://megogo.net/ua/partnership) and
[contacts](https://megogo.net/ua/contacts) describe cooperation, not a public
metadata API contract. Public supported API endpoints/auth/fields/quota/pricing
were **not found** in the inspected official pages/search, not proven nonexistent.
No private endpoints inferred from apps or third-party libraries.

**Current bounded-scope recheck, October 18, 2026:** the web reader again returned
a Polish MEGOGO.PL agreement from [the exact rules URL](https://megogo.net/ua/rules).
An ordinary direct HTTP read of that same URL, without cookies, login, proxy,
region pinning or redirect following, returned the **Ukrainian agreement**, naming
ТОВ «МЕГОГО», EDRPOU 38347009 (§1.1), service territory Ukraine (§1.8), edition
**June 4, 2026**. Do not substitute the Polish edition or infer fetcher geography
from either representation. No film-card GET was performed by the agent.

- **Applicable prohibitions preserved:** §2.4/§9.3 prohibit technical/protection/
  territorial circumvention and disruptive conduct. No such path is implemented;
  redirect, access block, CAPTCHA or rate limit terminates the request.
- **Rights not established:** §1.6 defines content broadly; §9.1–9.2 reserve
  service/content intellectual-property and reproduction/display rights. They
  are not an extraction/normalization licence. No precise, expressly applicable
  prohibition of this single non-commercial factual-metadata GET/transient
  display was established in the inspected text; this is **absence of a found
  direct conflict, not affirmative permission or a legal guarantee**. Applicability
  of reserved rights to particular metadata/outputs remains unresolved. No
  general attribution/retention licence or redistribution/LLM rights inferred.
- [robots.txt](https://megogo.net/robots.txt), HTTP 200 on the same date, has a
  `User-agent: *` group disallowing, among other paths, search/account/service
  paths and `/*?`. The exact fixed `/ua/view/22027436-dyuna-chastina-druga.html`
  path **without query** was not disallowed. It is not a licence; no query,
  alternate endpoint or user-agent evasion is added to bypass restrictions.
- **Decision:** no direct applicable conflict or rules-read technical block was
  established, so proceed only within the owner's explicit bounded approval.
  An extraction-time block is a result, never bypassed. Unavailable public API
  docs/affirmative licence do not alone require an email; no email, signup,
  purchase or legal-clearance claim. Future recurring/commercial use requires a
  separate review; costs are unmeasured, not asserted zero.

### Narrow approach and decision gates

Implemented opt-in `megogo-html`: only Dune, `digital-ua`, URL source/Amazon
region unset; default remains synthetic. One owner click consumes one session
token before any await and permits at most one GET. **20-second total network/
body timeout, 2 MiB decoded-response cap**, manual redirects, UTF-8 HTML only,
no retry, cookies, scripts/assets, destinations, endpoints, credentials upstream
or model. API key not required. Existing parser dependency `parse5` is reused
without a new dependency or general crawler/framework. Fixed source is
<https://megogo.net/ua/view/22027436-dyuna-chastina-druga.html>, expected native
ID `22027436`; existing catalogue TMDb `693134`, IMDb `tt15239678`. No TMDb call.

The source-specific parser supports declarative [Schema.org Movie](https://schema.org/Movie)
and [Offer](https://schema.org/Offer) JSON-LD (including optional labelled
PropertyValues), and labelled `dt/dd` / two-cell table fields in a unique main
with matching H1. These standards document the grammar, **not what MEGOGO's
current HTML actually contains**. No live page/markup inspection or validation
was performed. Unknown layouts, multiple film objects, malformed embedded JSON
or missing fields stay unresolved/partial/unsupported; there is no JS evaluation,
endpoint probing or account fallback. Source-native ID/title/year or exact
IMDb establish identity; supplied native/TMDb/IMDb conflicts block attribution.
Configured IDs alone do not constitute retrieved identity evidence.

### Acceptance, stop criteria and future test plan

UI shows fixed source/film/mode/operation, limits and fetcher geography **unknown**
before click. Projection/display is text-only, no raw HTML or executable/linked
content. Source/receipt time/retrieval/identity statuses and field evidence
kind/locator accompany reported, unknown and conflicting values. Literal
public-card claims and individual JSON-LD offers remain separate, with no
cross-offer track/format propagation. Language clauses must bind codec/channels
or subtitle types explicitly; list completeness remains unknown. HD does not
exclude 4K, UHD does not imply HDR10/DV, and locale is not codec. Price requires
explicit amount and ISO currency. No historical owner facts are substituted.

**Public characteristics are separate from account entitlement:** expose
supported page fields even without login proof; account entitlement stays unknown.
Regional messages and explicit eligible/ineligible regions are source claims
with evidence, not a geolocation/entitlement verdict. `/ua/`, interface language
and LAN RFC1918 IP establish neither UA viewing rights nor egress region. No
geolocation request is made; server HTML may differ from owner Safari in Ukraine.
Missing fields do not prove absence, and public access is not verified playback.

Authored synthetic tests cover identity matched/mismatch/unknown and stable-ID
conflicts; partial/missing/conflicting fields, per-language formats, subtitle
types, separate access/package/price offers, explicit regions, unsafe text,
malformed JSON, redirect/403/429/451/CAPTCHA, timeout (headers and body), size
limits and unsupported content/UTF-8; one-shot/auth/Host/Origin and no follow-ups.
Browser checks use mock responses at 390×844, not real iPhone validation;
Windows lifecycle uses temporary copies and mock-only transport, not owner demo.
Parser absence is explicit before a live fetch. Do not equate mocks/public-rules
reads with live extraction validation or promise needed fields will be found.

**Owner plan: at most one new live GET Dune**, after offline gates, using the
[standalone Termius/Safari workflow](iphone-windows.md#megogo-initial-html-owner-workflow).
No compulsory synthetic/SSH-disconnect repeat or streaming-app tour: those
mechanics are unchanged. Request only concise statuses and new/missing/conflicting
fields, no full HTML/JSON/screenshots. Stop on blocks/identity ambiguity/unsupported
or JS/login-only fields; do not retry or expand endpoints. Live validation remains
pending; useful/unknown metadata, not general accuracy, is the experiment outcome.

### Implementation checks — October 18, 2026

- **215 offline/HTTP tests passed**, zero failures/skips, including 27 MEGOGO
  cases and the existing 22 Gemini-body golden regressions. Existing adapters,
  prompts/model/settings/dependencies and production were not changed.
- Full sequential Edge/mobile regression: **102 passed / 7 skipped** (six absent
  WebKit engines, optional explicit-IP LAN not configured), zero failures. A
  final standalone MEGOGO rerun: 8 passed / 1 absent-WebKit skip. Initial parallel
  browser invocation stalled and was interrupted, not counted as success;
  cause not isolated. Sequential/standalone runs passed without weakened checks.
- PowerShell 7 temporary-copy lifecycle passed for MEGOGO and all six previous
  configurations: parent-exit survival, fixed switch inheritance, duplicate
  start, forged/unrelated PID refusal, safe stop/restart. MEGOGO mock-live restart
  needed no API key, made one mock GET, and rejected replay. Owner demo untouched.
  Actual SSH disconnect, real iPhone/WebKit and PowerShell 5.1 were not rerun;
  earlier owner workflow validation is separate evidence.
- 135 local links / 102 anchors valid across eight Markdown files; scope/diff/
  whitespace checked. Only isolated demo files changed; existing untracked
  `research/media-discovery/` preserved. No full source/body/credentials archive.
- No live MEGOGO extraction, API call, destination request, system change,
  merge/tag/release or deployment. Public rules/robots and schema documentation
  reads only; these are not extraction validation. MW-FUT-01 remains Discovery.
