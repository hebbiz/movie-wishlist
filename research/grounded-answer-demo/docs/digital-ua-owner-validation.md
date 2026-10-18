# Digital-UA and iPhone owner observations

Recorded October 18, 2026 from the owner's report for PR #175, following
implementation commit `80c6f2a32f3305458de81e6e62c92e47efe6e498`.
MW-FUT-01 remains **Discovery**. These are owner observations, not checks
independently performed by the implementation agent. No provider API was called
for this documentation update. No live answer, screenshot or evidence archive
is included; exact card URLs/IDs were not supplied in this report and are not
invented here. Prices and visible lists are observations at the owner's check,
not promises of current terms for all accounts. Request timestamps, account
settings and device/software versions were not independently captured.

## Owner-reported workflow validation

- iPhone/Safari: LAN HTTP + Basic Auth works.
- A synthetic request works after explicit SSH disconnection.
- Three digital-UA live scenarios were executed through iPhone: Coherence,
  Dune: Part Two and Blade Runner — Final Cut.

This validates that owner's tested setup, not arbitrary SSH/Windows/network
configurations. Keep the [iPhone workflow](iphone-windows.md), including trusted
home LAN only, synthetic first, hidden secrets, stop/restart/reload, and one
request per session. HTTP Basic still provides no transport encryption.

## Owner observations (not agent reproduction)

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

## Interpretation and unresolved questions

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
