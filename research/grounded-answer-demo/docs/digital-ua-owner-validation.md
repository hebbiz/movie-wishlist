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
