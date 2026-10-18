# Proposed next experiment: regional card first

Architecture/feasibility record, updated October 18, 2026 after manual candidate
experiment A and the owner's choice of a narrow Kinobaza URL Context experiment.
MW-FUT-01 remains **Discovery**. The conceptual pipeline is not implemented;
only the isolated fixed-source demo extension below is implemented/offline-tested.
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
separate retrieval metadata. It is offline-tested and **live-unvalidated**.
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
