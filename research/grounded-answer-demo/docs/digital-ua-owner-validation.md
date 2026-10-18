# Digital-UA and iPhone owner observations

Initial Search observations recorded October 18, 2026 for PR #175, following
implementation commit `80c6f2a32f3305458de81e6e62c92e47efe6e498`.
MW-FUT-01 remains **Discovery**. These are owner observations, not checks
independently performed by the implementation agent. No provider API was called
for this documentation update. No live answer, screenshot or evidence archive
is included. Exact card URLs/IDs were not supplied in the initial Search report;
the later URL-only experiment uses the [verified fixed catalogue](url-context-poc.md#verified-catalogue-not-expected-answers).
Prices and visible lists are observations at the owner's check,
not promises of current terms for all accounts. Request timestamps, account
settings and device/software versions were not independently captured.

## Initial Search pilot: owner-reported workflow validation

- iPhone/Safari: LAN HTTP + Basic Auth works.
- A synthetic request works after explicit SSH disconnection.
- Three digital-UA live scenarios were executed through iPhone: Coherence,
  Dune: Part Two and Blade Runner — Final Cut.

This validates that owner's tested setup, not arbitrary SSH/Windows/network
configurations. Keep the [iPhone workflow](iphone-windows.md), including trusted
home LAN only, synthetic first, hidden secrets, stop/restart/reload, and one
request per session. HTTP Basic still provides no transport encryption.

## Initial Search pilot: owner observations (not agent reproduction)

### Coherence (2013)

- Apple TV Ukraine: purchase and rental available, HD.
- The shown audio list contained only Russian Dolby 5.1/AAC.
- Ukrainian subtitles were **not checked**.
- Gemini did not find an available offer.
- The owner's Netflix search reported the film absent. The citation did not
  reproduce the message Gemini claimed it supported.

### Dune: Part Two (2024)

- MEGOGO: MEGOPACK subscription, Full HD, Ukrainian audio including 5.1,
  Ukrainian regular and forced subtitles.
- Apple TV: purchase **$7.99**, rental **$3.99**, 4K Dolby Vision, Ukrainian
  Dolby 5.1/AAC. Dollar amounts are recorded as reported; the currency code
  was not independently verified.
- Ukrainian subtitles were not listed in the visible Apple TV list.
- Gemini omitted Apple TV localization/video metadata. Its Apple ID differed
  from the owner's card. Its URL did not open in a separately reported check;
  this is **not conclusive proof that the URL is invalid**.
- A reported web retrieval of MEGOGO from an **unknown region** showed
  unavailable, while the owner confirmed the Ukrainian offer above.

### Blade Runner (1982) — The Final Cut

- Apple TV: the description confirmed the required cut; the owner had a
  **Play** button. This does **not** confirm a new purchase/rental or its price.
- 4K Dolby Vision; English Dolby 5.1/AAC.
- Ukrainian audio/subtitles were not listed in the shown lists.
- Gemini omitted 4K/Dolby Vision and justified HD using a typical distribution
  format rather than offer-specific evidence.

## Initial Search pilot: interpretation and unresolved questions

These are research implications of the report, not additional verified facts:

- Coherence exposes a missed available Apple TV offer in this scenario, not a
  measured general false-negative rate. The Netflix observation applies to the
  owner's search; the failed citation reproduction is an attribution gap, not
  independent proof of the cited statement or full catalogue absence.
- A missing item in a shown list is not universal proof of absence. Coherence's
  Ukrainian subtitles remain unchecked; the Dune and Blade Runner lists do not
  establish Ukrainian-subtitle/audio absence across all offers or accounts.
- Dune's differing Apple IDs require exact-card identity checks. One failed
  opening does not settle validity, redirects or regional/account accessibility.
  Unknown-region MEGOGO retrieval must not override Ukrainian owner evidence.
- Blade Runner's account playback, public metadata and ability to make a new
  transaction are distinct. An original film language or typical release format
  does not establish a track or video format on the particular offer.

This is **three digital scenarios**, not an accuracy estimate or full review of
all six platforms. There is no demonstrated general reliability. Latency, token
usage and actual API costs were not measured. The earlier dashboard-zero report
is not proof of zero cost. Amazon US/UK/DE/IT region-specific scenarios remain
**live-unvalidated**. Keep the earlier physical pilot (three scenarios, four
requests) separate in [checkpoint-174.md](checkpoint-174.md); its Dune metadata
variability and unconfirmed negative HMV/Amazon results remain historical limits.

Next steps are proposed only in the [regional-card design](regional-card-proposal.md).
No prompt, runtime, model/settings or integration changes accompany this record.

## URL Context evaluation checkpoint — two owner-run live tests

Recorded October 18, 2026 following documentation checkpoint
`0d02ed3c78d09e1911b4d63efe940da41963bd2b` in PR #176. **Owner-reported only**:
the implementation agent did not repeat these requests, inspect the owner's
account or independently verify the outputs. Exact execution timestamps and
runtime commit were not independently captured. This section is separate from
the three Search scenarios above, not a retest or pooled accuracy sample.

### Reported observations: Coherence

- One live URL Context answer was received through iPhone/Safari. Provider
  metadata reported **SUCCESS for the configured Apple TV UA URL**.
- Film identity was correct. Original Audio: English was correctly separated
  from the available-audio list: Russian Dolby 5.1 / AAC.
- Ukrainian audio was not listed; this is not universal absence evidence.
  Subtitles remained unknown.
- Availability, purchase/rental, pricing and HD remained **unknown** in the
  answer. Earlier, the owner confirmed purchase/rental and HD in the application;
  those are separate owner observations, not facts established by URL Context.
- Gemini's explanation that the displayed year 2020 meant a regional release,
  addition or reissue is **unverified interpretation**. The meaning of that year
  has not been established; do not repeat the explanation as a source fact.

### Reported observations: Dune: Part Two

- One live URL Context answer was received through iPhone/Safari. Provider
  metadata reported **SUCCESS for the configured Apple TV UA URL**.
- Film identity and Ukrainian AAC / Dolby 5.1 were correctly identified.
- Ukrainian subtitles were not listed in the returned list; this does not prove
  their universal absence across offers/accounts or at other times.
- Availability, purchase/rental, prices, 4K and Dolby Vision remained **unknown**.
- The earlier application check by the owner showed purchase $7.99, rental
  $3.99, 4K, Dolby Vision and Ukrainian Dolby 5.1 / AAC. These remain historical
  observations at that manual check, not current guaranteed prices or fields
  independently recovered by URL Context. Currency-code limits remain as above.

### Interpretation and limits of this checkpoint

In **these two tests**, URL Context supplied useful identity/audio metadata but
did not establish full characteristics of an available Ukrainian offer. This is
not general accuracy, method superiority, exhaustive platform coverage or proof
that URL Context improved search in general. SUCCESS and grounding attribution
do not prove correctness, completeness, freshness or entitlement.

The complete content retrieved by the provider is unavailable to us. **The cause
of the omissions is not established**; neither missing source fields nor a
retrieval/rendering/model limitation has been demonstrated as the cause. Unknown
in the answer is not unavailable in Ukraine, a confirmed absent feature or
proof that the original page lacked it. Public metadata and account-only
transaction/playback evidence remain distinct.

The report confirms two owner URL-only live scenarios through Safari, not an
independent device test or an explicit new-mode SSH-disconnect test after the
launcher fix. No full answers or raw metadata are copied into Git. No new calls,
runtime tests or automatic evaluation were run for this Markdown checkpoint.
Latency, token usage and actual cost are not established here; usage/cost is not
a blocker and zero cost is not asserted. Amazon-region live checks remain
pending. The next step is **design only**, in the existing
[regional-card proposal](regional-card-proposal.md#next-experiment-current-ukrainian-availability).

## Kinobaza candidate discovery — manual experiment A completed

Recorded October 18, 2026 after checkpoint
`8e629b3979239514703a898ea98dc2eee75a904d`. The owner manually followed
Кінобаза links and checked offers in a Ukrainian context. **Owner-reported,
not independently repeated by the implementation agent.** Exact execution
times and account settings were not supplied; the record date is not a test
timestamp. This is a manual experiment, not another Gemini/API run.

### Reported observations: Coherence candidates

- Кінобаза → Apple TV led to the correct card, ID
  `umc.cmc.hdoayzcx3u9ofxfawjrt3hgc`, matching the existing
  [fixed Apple card](url-context-poc.md#verified-catalogue-not-expected-answers).
  The displayed year is **2020**; its meaning remains unestablished.
- Кінобаза also supplied this [Prime Video candidate](https://www.primevideo.com/detail/0IIIN33QO51PY805B0ZI7HT6RY/).
  The owner confirmed Coherence availability in Ukraine and **Ukrainian audio
  on this Prime Video offer**. No access type, price, subtitles, video format
  or actual playback was reported for this check.
- This differs from the earlier Apple TV offer: its available-audio list
  contained Russian Dolby 5.1/AAC. Original Audio: English was a separate
  metadata field, not proof of an offered English track. Earlier Apple TV
  purchase/rental and HD observations remain in the initial Search section;
  they are not newly established by this candidate-discovery check.

### Reported observations: Dune: Part Two candidates

- The owner confirmed correct Кінобаза transitions to **Apple TV, MEGOGO,
  HBO Max and Rakuten TV**. Exact new destination URLs were not supplied;
  none are reconstructed here. The existing fixed Apple URL is documented
  separately, not substituted for an unreported redirect trace.
- Ukrainian audio was confirmed by the owner for the **HBO Max** and
  **Rakuten TV** offers. No further availability/access-type, price,
  subtitle/video specifications or playback claim is added for these offers.
- Separately, the owner's **Prime Video** check found no Ukrainian audio.
  Its URL and discovery provenance were not supplied: **do not attribute this
  Prime Video link to Кінобаза**, or infer that the film itself was unavailable.
- Preserve the earlier Apple TV / MEGOGO observations above as their own
  historical checks, not a fresh confirmation of their prices or metadata.

### Evidence separation and interpretation

| Evidence stage | What this owner report establishes |
| --- | --- |
| Link found | Кінобаза supplied the reported Apple/Prime candidates for Coherence and four provider transitions for Dune. Dune Prime provenance is unreported. |
| Identity checked | The owner reported the correct Coherence Apple card/Prime offer and correct Dune destinations; no independent agent recheck is claimed. |
| Availability checked | Coherence Prime Video availability in Ukraine was explicitly confirmed by the owner. Other newly reported transitions/audio checks are not expanded into entitlement or transaction claims. Earlier Apple/MEGOGO checks retain their own scope. |
| Offer characteristics checked | Coherence Prime Ukrainian audio; Dune HBO Max/Rakuten Ukrainian audio and the separately checked Dune Prime lack of Ukrainian audio, all owner-reported and provider-specific. |

The previous proposal's **manual experiment A is completed for these two films**.
Кінобаза helped locate correct cards and an additional useful Coherence offer
with Ukrainian audio. This supports its usefulness as a candidate source in
these cases, not general accuracy, completeness, API feasibility or integration
reliability. Кінобаза alone is not final evidence of availability or
offer-specific localization. No new prices, subtitles/video, access types,
account settings, timestamps or playback results are inferred.

The separate [integration feasibility review and next-step proposal](regional-card-proposal.md#candidate-integration-feasibility)
uses public documentation, not these observations as evidence of API rights.
No full Gemini responses, raw metadata, screenshots or evidence archive are
stored. Usage/cost remains unmeasured, not zero; Amazon-region live checks
remain pending. MW-FUT-01 remains Discovery.

## Kinobaza URL Context — two completed owner-run tests

Recorded October 18, 2026 following implementation checkpoint
`54d1a9fe13591faa4620cb51155137c95a2642d2` in PR #177. **Owner-reported only**;
the implementation agent did not repeat the Gemini requests. Exact execution
timestamps, runtime commit, request count and retrieval-status values were not
supplied in this checkpoint. This is separate from the earlier manual source/
provider checks and Apple URL Context tests.

| Reported result | Coherence | Dune: Part Two |
| --- | --- | --- |
| Film identity | Correct | Correct |
| Platform names | Obtained | Obtained |
| Territory separation | Partial | Obtained |
| Exact provider URLs | Not obtained | Not obtained |

The platform names/territory result are recorded at the granularity supplied
by the owner, not an independent verification of every name or territory.
Neither answer returned a provider URL. **The current URL Context scenario is
not suitable as an automatic candidate-link generator on this evidence.** This
does not establish general accuracy, universal inability to read hrefs or
impossibility of a different Kinobaza integration. The cause of the missing
hrefs remains undetermined.

### Separate provenance anomaly: Dune external citation source

The owner reported a `citationSources` entry with host **`m.vkino.com.ua`** in
the Dune answer. The exact URI, attributed passage/offsets and complete metadata
were not provided or archived. This is **not proof that Gemini navigated to or
retrieved that site**, and also does not confirm exclusive Kinobaza provenance
for the entire answer. Do not silently treat the entry as a Kinobaza source,
proof of a Search fallback, a verified additional source or an established
explanation for missing hrefs.

The [independent initial-HTML inspection and terms assessment](regional-card-proposal.md#initial-html-inspection-after-the-owner-tests)
is separate evidence: a later public HTTP response is not a reconstruction of
what Gemini saw during these tests. No repeated Gemini calls, full answers,
screenshots or raw metadata are included. Requesting another live run is not
the next step. Existing iPhone instructions remain available as historical
reproduction steps, not a recommendation to rerun this failed hypothesis.
MW-FUT-01 remains Discovery.

## Kinobaza HTML — completed owner-run checkpoint

Recorded October 18, 2026 after implementation checkpoint
`8e369374f99f34c66ee399a1eba298d325616ede` in PR #178. **Owner-reported only**:
the owner says the narrow HTML PoC worked for both films and manual testing of
this stage is complete. The implementation agent did not repeat source/provider
requests or independently inspect the live results. Exact run timestamps and
runtime commit were not supplied; the reference commit is the implementation
checkpoint, not a claimed execution trace.

| Reported result | Coherence | Dune: Part Two |
| --- | --- | --- |
| Narrow candidate extraction | Completed successfully according to the owner; the full candidate list, HTTP/identity status and issues were not supplied in this report. | HTTP 200, identity `matched`, no issues. |
| Explicit Ukraine section | Apple TV, clarified by the owner's subsequent API-probe context; not independently repeated. | Rakuten TV, HBO Max. |
| Outside country sections | Not itemized in this report. | iTunes, Rakuten, MEGOGO; retain **territory unknown**, not inferred Ukraine. |
| Foreign sections | Not itemized in this report. | Separated from Ukraine; one YouTube search URL is a search transition, **not an exact film card**. |
| Known gap | Prime Video candidate was missed, compared with the owner's earlier manual discovery. | Search-transition versus exact-card distinction is not implemented. |

This establishes owner-observed retrieval of candidate links **without Gemini**
for these two cases. Availability, entitlement, audio/subtitles, video format,
prices and access type were **not tested by this HTML experiment**. Earlier
provider observations remain separate; no missing URL, status or characteristic
is filled in from them. No general accuracy, complete coverage or production
readiness follows. A parser `candidate`/`ok` status is not semantic verification
of an exact offer. No full results, HTML, screenshots or evidence archive added.

The missing Prime link does not negate the earlier owner-confirmed Prime offer;
its omission mechanism is not established from the retained evidence. The
[code/fixture diagnosis and separate API feasibility](regional-card-proposal.md#html-checkpoint-diagnosis-no-parser-expansion)
do not require another owner run. The report does not separately confirm a new
HTML-mode SSH-disconnect survival test; earlier workflow validation retains its
own scope. Usage/latency/cost were not measured here. MW-FUT-01 remains Discovery.

## Owner-reported platform coverage and next sequence

Recorded October 18, 2026 with the API-probe authorization. The owner reports
Movie of the Night coverage for **Apple TV, Prime Video, Netflix** and JustWatch
coverage for **Apple TV, Netflix, Rakuten TV, HBO Max**. These are platform-level
owner observations, **not** guarantees of API access, complete film catalogues,
locale/video fields or offer accuracy. No independent new offer check by the
implementation agent is implied. MEGOGO is a future direct-adapter candidate,
not implemented here. Obtaining JustWatch tracking links through Kinobaza does
not establish direct JustWatch Partner API access or rights.

Agreed sequence: Movie of the Night non-LLM probe → comparison with Kinobaza/
JustWatch → MEGOGO adapter feasibility → shared offer model. Authorized workers
are a separate conditional direction, not current implementation. At that
authorization checkpoint no Movie of the Night live result was recorded. The dated earlier manual observations
remain controls, not guaranteed current prices/entitlements. Only new/materially
conflicting observations need another exact-card check; no request to repeat
the completed streaming-card/HTML tests. No full responses or screenshots added.

## Movie of the Night — two completed owner-run results

Recorded October 18, 2026 following implementation checkpoint
`d3e32b004067351406124dade89d0a911b058aeb` in PR #179. **Owner-reported**, not
independently repeated by the implementation agent. Exact execution timestamps
and running commit were not captured. This includes clarification of earlier
manual controls: they were the **owner's** Apple/Prime observations, not an
independent agent verification. No full API responses were retained or added.

### Coherence

- Owner reported HTTP 200, title Coherence, year **2014**, IMDb **tt2866360**.
  Demo showed `identity-unresolved`; UA options were not established/displayed.
- The owner separately checked the MOTN website: it also showed 2014 and no
  Ukrainian offers. This is a website observation, **not proof that the API
  returned an empty `streamingOptions.ua`**. The demo's identity gate could
  withhold existing options before inspecting that field.
- Earlier owner validation established Coherence on Prime Video in Ukraine with
  Ukrainian audio, in that manual context. It is a dated control, not guaranteed
  current catalogue coverage. Why MOTN reports 2014 is not established; no
  regional-release/reissue explanation is inferred.

### Dune: Part Two

Owner reported HTTP 200, identity matched, year 2024, IMDb **tt15239678**.
The Apple URL/card identity matched the already known card; no new URL is guessed.

| Offer / field | Reported demo/API observation | Earlier owner control (separate, dated) |
| --- | --- | --- |
| Prime rental / purchase | UHD; Ukrainian audio/subtitles not noted; prices **2.99 / 3.99 UAH**. | Owner previously reported no Ukrainian audio on the checked Prime offer; not an independent agent or universal absence finding. |
| Apple rental / purchase | Correct known card; HD; empty audio/subtitle lists; **3.99 / 7.99 UAH**. | Rental **3.99 USD**, purchase **7.99 USD**; 4K Dolby Vision; Ukrainian Dolby 5.1 / AAC. USD is explicit in this owner clarification, not inferred from a dollar symbol. |

The matching Apple amounts with a different currency are a **material anomaly**,
not a reason to relabel UAH as USD. Prime currency also needs the same provenance
distinction. Neither the control nor the aggregator is assumed current for all
accounts/times. Empty lists are not proof of missing Ukrainian tracks; a quality
code is not proof of HDR/DV, and missing subtitle evidence remains unknown.

### What is established at this checkpoint

MOTN looks useful for **candidate links and access types** in these cases, but
the two tests did not establish completeness/reliability of language lists,
quality, currency/prices or catalogue coverage. This is not a general accuracy
assessment. Coherence's gated result must not count as an API-negative UA result.

The [independent code/provenance audit](regional-card-proposal.md#motn-closeout-identity-and-field-provenance)
proved a year-only identity rejection defect and correct direct mapping of the
audited fields in the reviewed code. It did not independently inspect the live
responses or establish the upstream cause of the anomalies. Only the proven
identity/status defect is corrected; no USD/UHD/audio substitutions are made.
The correction is offline-tested, not revalidated live. **No repeat owner run or
streaming-card check requested.** The next step was the
[TMDb data-probe handoff](tmdb-probe-handoff.md), subsequently approved for
isolated implementation. MW-FUT-01 remains Discovery.

## TMDb data probe — completed owner checkpoint

October 18, 2026 implementation checkpoint, initially **not owner-run evidence**:
`tmdb-data` now supports the same fixed two films, A identity/catalogue metadata
separate from B actual `results.UA`, max two serial HTTP requests per film.
Only authored synthetic/mocks were executed by the implementation agent. The
subsequent Coherence observation below is **owner-reported**, not an independent
agent repeat. Dune subsequently completed the stage after the fix, as below.
The applicable current terms/readiness
condition remains in the [implementation/terms record](tmdb-probe-handoff.md#implementation-record).

### Coherence — first owner-run result

Recorded October 18, 2026 after implementation `0fcb1d2` in #180; exact execution
timestamp/running commit not captured. No live response body archived or inspected
by the agent. Owner reported:

- Two HTTP requests, both **200**; identity matched, TMDb **220289**, Details
  IMDb **tt2866360**.
- `title` **Зв’язок**, `original_title` **Coherence**, `release_date`
  **2014-04-06**; original/spoken language **en**. The meaning of the different
  film/release year is not inferred. Requested Ukrainian title by itself does
  not independently establish an explicit `uk` translation entry or provider tracks.
- All five appended resources (`external_ids`, `alternative_titles`, `credits`,
  `release_dates`, `translations`) were displayed as **invalid**. Their original
  shapes/IDs/field values are not known from this summary; this is not proof
  that the API omitted the resources or their nested IDs.
- **B succeeded:** actual `results.UA` showed **Apple TV Store [2]** in **rent**
  and **buy**, with **flatrate/ads missing**. Preserve this useful UA access-type
  signal; the A validation issue does not negate it. Missing buckets are not
  evidence of no subscription elsewhere or no UA availability. No provider
  deep link, price, quality, audio/subtitles or account entitlement is established.

The [separate code/schema diagnosis](tmdb-probe-handoff.md#appended-resource-validation-correction)
proves an over-strict repeated-ID validator defect, not the exact original live
body. It is compatible with the reported symptoms; their complete live mechanism
cannot be confirmed without retained response shape. Fix is offline-tested,
not live-revalidated. B transport/projection is unchanged.

### Dune after the fix — owner reports stage complete

Recorded October 18, 2026 after correction checkpoint `dcbd3c5`; exact execution
timestamp/running SHA, HTTP status codes and raw response shapes were not supplied
in this completion summary. **Owner-reported, not independently repeated.**
Dune passed A and B, and all five appended resources were read. This confirms
practical post-fix compatibility in this scenario, not the exact original
Coherence response shape. Coherence was **not rerun** and need not be rerun now.

The owner reports explicit Ukrainian catalogue **title, overview and tagline**
metadata in this completed probe; the demo projects overview/tagline presence,
not full prose. This does not establish Ukrainian audio/subtitles on any provider.
Language was empty in the displayed UA release events; an empty release-language
field supplies no track evidence. Do not retroactively claim that Coherence's
previously invalid translation append was independently read or revalidated.
No literal translation text, event dates or provider IDs are invented here.

### Cross-source complementarity — observations, not independent entitlement

| Film | TMDb / JustWatch | MOTN | Kinobaza HTML |
| --- | --- | --- | --- |
| Coherence | Apple TV Store: rent / buy in UA. | API options not established because of the initial identity gate; owner's separate website check showed no UA results. Not a proven empty API list. | Apple candidate URL in UA section. |
| Dune: Part Two | HBO Max: subscription; Rakuten: rent / buy in UA. | Apple and Prime: rent / buy; characteristic/currency limitations remain in the earlier record. | HBO Max / Rakuten candidate URLs in UA; Apple / MEGOGO outside territory sections, territory unknown. |

These bounded source observations demonstrate useful **complementarity**, not
general accuracy, complete coverage, independent corroboration or account
entitlement. TMDb and the corresponding Kinobaza sections share **JustWatch**
lineage. Kinobaza's unscoped MEGOGO link does not acquire UA territory from an
earlier separate owner MEGOGO observation. Prices and localization stay bound
to the original provider/context; no current offer has been rechecked here.

Resulting roles: **TMDb** for identity, names/catalogue text and additional UA
provider/access signals; **MOTN** for additional offers/direct links with cautious
characteristics; **Kinobaza** for additional provider URLs, including MEGOGO.
Original/spoken language, country release events and catalogue localization are
not provider track metadata. Historical owner checks above remain dated controls.

**Manual stage complete: no further owner tests requested.** The next work is
the [shared observation model](regional-card-proposal.md#shared-offer-observation-model--design-only)
and [narrow MEGOGO proposal](regional-card-proposal.md#megogo-one-card-adapter-proposal--not-implemented),
not a new integration or testing round. MW-FUT-01 remains Discovery. No full live
answers, API bodies, metadata or screenshots are archived.

## MEGOGO initial HTML — owner-run parse-policy rejection

Recorded October 18, 2026 from the owner's summary, **not independently repeated**.
Exact execution timestamp/running SHA and original response bytes were not
supplied or retained. The owner reports **HTTP 200**, `unsupported-markup`,
issue `ambiguous-html-tokenization`; identity and all fields were unknown.
No offer characteristics, actual initial-HTML layout or entitlement were
established by this run. HTTP 200 alone does not identify the returned page.

The [code diagnosis](regional-card-proposal.md#megogo-owner-failure--parse-policy-diagnosis)
locates that issue before identity evaluation: any of the first 20 parser errors
other than `missing-doctype` caused the early return. Thus unknown identity is
**not evaluated**, not evidence of a film mismatch or missing identity fields.
The old output did not retain error codes; it cannot establish whether the live
document had harmless recoverable syntax, meaningful structural problems or a
different/blocked page. No precise live cause is claimed from authored fixtures.

The diagnostic-only correction at `03a472e` supplied content-free structural/
error-code diagnostics and a truthful policy-rejection label; it did **not** relax parsing/identity gates or
claim to repair the unknown live layout. At that checkpoint no new owner GET,
card/app tour, raw HTML/metadata/screenshots, API call or owner-demo restart was
requested. Extraction usefulness remains unvalidated. MW-FUT-01 remains Discovery.

The subsequent owner-approved [HTML acceptance policy](regional-card-proposal.md#megogo-html-acceptance-policy--scoped-recovery-v1)
supersedes the blanket parse gate, not this historical observation. It is
offline/mock-tested at checkpoint `06c69ef` and prepared one final owner GET
returning useful fields and structural diagnostics together. The subsequent
owner result is recorded below, not an independent agent check.

### Second owner attempt — 30 duplicate attributes, identity not evaluated

Owner reports HTML retrieved/tree built, **30 `duplicate-attribute` events**,
canonical link, JSON-LD and **two H1s**. Policy classified damage as identity
scope and stopped before evaluating identity. Exact event attributes/values/
locations, H1 texts/positions, execution timestamp/running SHA and a new HTTP
status code were not provided in this summary. None inferred or fetched.

These counts prove neither conflicting identity nor absent offer metadata.
They do not establish that the H1s were in the selected main/usable scope or
that the duplicates were class, href, content or native ID. The
[offline correction](regional-card-proposal.md#megogo-duplicate-attribute-scope--offline-correction-v2)
proves/fixes over-broad tag/count vetoes with authored examples, not their
application to the original live page. MEGOGO remains **unresolved**, with no
new owner/agent GET, raw body/archive or diagnostic request. Other completed
source experiments need not wait for it to support an architecture conclusion.
