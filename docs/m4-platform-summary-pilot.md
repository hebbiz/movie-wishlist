# M4 pilot: compact service comparison and Kinobaza language interpretation

Owner feedback on Supergirl (2026), develop deploy 6ae2746cf949428fe03a9806, 2026-10-29: show a single result per streaming service, group purchase and rental labels, and hide price while the displayed currency needs investigation. A platform card may contain source observations from different offers; this is a presentation summary, not proof that those offers are identical. Preserve the original rows in the diagnostic report. Selecting a card transfers one explicitly chosen original link after preview and authorization checks; the policy still rejects unsupported destinations. No price/currency correction is claimed.

Historical #203 rule, superseded by the generalized rule below: Rakuten only required a matched Ukraine-context Kinobaza link plus a separate matched Rakuten localization block. The current rule no longer needs that separate UA pointer and applies to all supported services. Historical source rows are not rewritten.

The current presentation is the [compact service comparison](#compact-service-comparison--2026-10-29) below, replacing the earlier repeated cards without changing their original source observations. The existing 30-minute freshness indication, form-session lifetime, access checks, transfer preview, explicit ordinary Save and diagnostic report remain in effect. Identity/provider matching and server limits remain unchanged. Source data, entitlement, availability and chosen destination remain unverified; the reported Supergirl HBO link may lead to an American Sign Language version. Further pilot feedback will determine whether the simplification is useful.

## Link actions and compact preview — 2026-10-29

Follow-up implementation starts from merged #203, develop
`b752fba29b9407ca64255ea5b3b7f6c1d0cab83d`. Review only; no merge/deployment
or live source validation in this change.

The owner removed the separate tracking/affiliate checkbox **for M4**. An
already admitted URL may be opened by `Відкрити посилання` or transferred after
the explicit preview/apply action without another acknowledgement. The shared
URL classifier, exact original href (including query/fragment spelling), safe
host/path rules and original-row choice remain unchanged. No redirect resolution,
parameter stripping, automatic destination visit or source refresh is added.
`Про джерела та обмеження` instead says: «Деякі посилання можуть проходити через
сторонній сервіс, який враховує переходи». This is not a claim that all links are
paid affiliate links; historical research acknowledgement behavior is not changed.

Preview describes the local action rather than printing long before/after URLs:

- Same literal nonempty URL: «Посилання вже додано».
- Different URLs: «Посилання буде замінено».
- No existing URL and an admitted selected URL: «Посилання буде додано».
- Existing URL but no admitted selected URL: explicit clear confirmation remains
  required; without it **neither** medium nor URL changes.
- Neither URL: explain that no suitable link is present; medium-only transfer is
  possible without inventing a link.

Full exact addresses remain in collapsed `Повні адреси` details, rendered as text,
not auto-opened links. Equality is literal, not URL normalization. The original
form snapshot still guards both medium and URL after asynchronous authorization;
cancel/close/new context/access revocation and late replies cannot apply it.
Apply changes only the two local form fields; ordinary Save remains the sole
Wishlist write. Existing M4 isolation, retained session/scroll, stale-data warning,
Rakuten-only inference and server budgets/TTL are unchanged.

### Verification of the link UX update

- 42 targeted M4 unit/presentation/report/DOM checks passed;45 shared discovery
  and matching regressions passed, including unchanged research R1/R2 behavior.
- All three existing browser suites were **executed**, not carried over from
  #203's skipped browser results:30/30 passed,0 failed,0 skipped. Installed Edge,
  local Node24.22.0;1280×900,375×812,420×912 and820×1180 viewports.
- Real add/edit forms with mocked authentication/source/DB boundaries cover
  exact provider-native referral and opaque tracking opens without a checkbox,
  no automatic navigation, literal transfer, same/different/empty/missing URLs,
  collapsed/expanded long-URL mobile layout, explicit clear, normal Save,
  canceled/pending authorization and retained session/reopen/expiry/access guards.
  No assertion or timeout was weakened. Authored screenshots stay outside Git.
- Syntax/whitespace/scope and14 selected Markdown documents/454 local links/
  279 anchor references passed. The additional document in this validator scope
  is this existing #203 pilot record, not a new architecture document.
- Native Safari/iPhone/WebKit and deployed-runtime behavior were not tested;
  viewport emulation is not a real-device result. No live source/destination
  requests or real Wishlist writes. Full server/SQL/native PostgreSQL concurrency
  and Windows launcher lifecycle were not repeated: their dependencies did not
  change. This narrow diff does not modify initApp/global lifecycle/auth,
  presentation/Rakuten rules, server/shared policy, migrations, flags or secrets.

## Kinobaza service-language interpretation — 2026-10-29

Owner-approved M4 follow-up from develop
`e81b10c695cdfdb19db7f1737d95d5b1b21a2636` after merged #204. Implemented for
review, not merged/deployed or live-evaluated by this task.

For a matched film card, M4 treats a supported service's **own source block with
an admitted link and language claims** as relevant to that service's Ukrainian
region. This is an explicit application interpretation, **not** independently
verified platform availability, account entitlement or exact commercial-offer
track binding. It applies to Apple/iTunes, Prime Video, HBO Max, Netflix,
Rakuten TV and MEGOGO; no separate UA-country row is required.

The pure presentation view checks the existing parser-issued block ID and
association, exact original block/row href, mapped source provider label and
matched source identity. Known foreign territory, ambiguous/unsupported block
boundaries, unsafe/missing URLs, conflicting provider mapping or an unestablished
identity do not acquire this interpretation. The selected film ID scopes view
rows; mixed explicit film IDs without a selected context produce no combined
answer. Diagnostics retain the originals, including unknown source country.

Source precedence uses the existing extractor without modifying its rules:

- A recognized service table supplies its own field values. Missing/unknown/empty
  fields stay unknown; table presence does not invite a parenthetical fallback.
- Only a supported no-table service paragraph supplies its parenthesized tokens.
  An unmentioned language stays unknown, not negative.
- `+`, `−`, missing and conflicting values remain distinct. A named audio format's
  negative is not a universal absence claim; another positive named format can
  establish positive audio. Opposing signs for the same label remain conflicting,
  including across separate blocks whose aggregate states both happened to be
  positive. No codec, transliteration or format-alias inference is added.
- No transfer of fields to another platform/film or mutation of MOTN/TMDb rows,
  block country, base audio/subtitles, source availability or provenance.

The main card says, for example, «Українське аудіо та субтитри — за даними
Кінобази», not how tables/paragraphs were parsed. Negative named audio evidence
is scoped to the reported tracks; contradictory values remain visible as such.
The country label explicitly identifies the application rule. Mykola ranks
positive audio, then positive subtitles, then UA-context unknown-language options,
with stable equal-evidence order. A stronger independent source observation stays
separate and is not silently relabelled as Kinobaza evidence. Prices remain hidden.

The requested Dune: Part Two (2024) examples are covered by **authored**, not live,
HTML through the actual extractor and projection:

| Service | Audio | Subtitles | Authored source shape |
| --- | --- | --- | --- |
| Apple TV / iTunes | + | − | Own service table |
| Rakuten TV | + | + | Own service table |
| MEGOGO | + | + | Own no-table paragraph |

Copied diagnostics now distinguish `UA by application rule` from original
`territory unknown`, and retain bounded, sanitized source signs/labels and
explicit omissions. Collapsed source details also retain literal format evidence
and source provenance. No raw HTML, search snippets, URLs/credentials or automatic
report transmission/storage are added. This is not offer merging or a live
confirmation of Dune's current availability/tracks.

Original-row link open/preview/apply and ordinary Save are unchanged, including
#204's no-extra-checkbox policy and explicit clearing of an existing URL. No
direct URL search or JustWatch redirect resolution, new requests, budget/TTL
change, initApp/global lifecycle/auth change, other Mykola context, feature flag,
migration, production or owner-checkout/demo modification.

### Verification of the generalized language rule

- 133 targeted offline/mock checks passed, with0 failures/skips: presentation,
  report and exact transfer; all6 supported services; table/paragraph precedence;
  missing/empty/negative/conflicting fields; same-label conflicts across otherwise
  aggregate-positive blocks; different named formats; source/film/provider guards;
  original-row immutability; existing discovery/R1/R2 regressions.
- Existing three browser suites ran in installed Edge:30/30 passed,0 failed,
  0 skipped, including desktop1280×900, iPhone X-size375×812, iPhone Air-size420×912
  and tablet820×1180. The main real-form suite passed a further5/5 on finalized
  guards/summary logic. Authored Dune HTML is extracted/projected by the actual
  functions, then used by the browser mock: three short service cards, correct
  signs/priority, unchanged raw diagnostics, hidden prices, exact classified links,
  explicit preview/apply and ordinary Save only. Wrong-service/unresolved rows,
  cancel/pending apply, retained/reopened/stale/context/access boundaries remain
  covered. No timeout or assertion weakening.
- Copied diagnostics distinguish empty source values from missing fields, retain
  literal signs with explicit bounded omissions, and withhold URL/credential-shaped
  labels. Full normalized evidence remains in the read-only source detail panel.
- Local Node24.22.0; browser viewports are not native iPhone/Safari/WebKit tests.
  No live Dune page or platform validation was performed. Full server/SQL/native
  PostgreSQL concurrency and Windows launcher lifecycle were not repeated because
  their dependent code/contracts are unchanged. No production activation claimed.

## Compact service comparison — 2026-10-29

Owner-approved presentation update from develop
`c0bf202b1839667209445d081522e030115a0ad1` after merged #205. Implemented for
review; no merge/deployment or live discovery by this task.

Mykola gives a short evidence-based recommendation, then one comparison bubble
with a semantic three-column table: `Сервіс`, `Укр. аудіо`, `Укр. субтитри`.
It reuses the existing six service SVGs. One legend and a shared caution replace
the repeated card disclaimers. Technical sources, original fields, reason states
and per-observation provenance remain in the unchanged diagnostic report and
`Про джерела та обмеження`; prices stay hidden.

- Availability `◐`: the service's own admitted Kinobaza block on a matched film
  card is incomplete evidence, including a block with unknown languages. The
  #205 application-region rule is preserved, not promoted to a platform check.
- Availability `●`: a separate matched source record explicitly returns a UA
  option. This is still a source claim, not independently verified availability
  or entitlement, and is not attributed to Kinobaza. `◇` means a known other
  country; `?` means unknown.
- Languages `+` / `−` / `?` / `±` distinguish positive claims, explicit negative
  claims, unknown and differing/conflicting observations. Missing/unlisted fields
  are never negative. A negative only for named audio formats uses `?` overall,
  with a scoped accessible explanation: other Ukrainian tracks remain unknown.
- A positive original variant remains useful if another record is negative:
  display `±`, say that records/variants differ, do not invent a confirmed offer
  conflict or erase that positive variant. A field that is itself conflicting
  does not become positive. Unknown/foreign-country tracks cannot borrow UA from
  another row, and no track is silently bound to the selected URL.

Ordering is language category first: positive Ukrainian audio, then positive
Ukrainian subtitles without established audio, then unconfirmed languages.
Within each category use Apple TV → Rakuten TV → equal Netflix/HBO Max/Prime Video
→ MEGOGO; equal peers retain stable source order. The original row ordering,
identity gates and transfer eligibility are not rewritten to achieve that order.

Service names are keyboard/touch buttons selecting one shared action area. The
owner's #206 follow-up removes the original-record/offer selector: actions show
only distinct admitted **literal URLs** for that service. Zero/one URL needs no
selector; duplicate rent/buy/source records with the same href never become
repeated user choices. Multiple URLs use `Посилання 1`, etc. with their hostname;
the exact selected address can be inspected in collapsed text details, without
following it. No query/fragment/encoding normalization or redirect resolution is
performed to infer destination equivalence. Each choice retains one original
representative row, preferring the existing primary for its URL; all original
observations and disagreements remain in diagnostics. No offers or fields merge.
Opening requires an admitted exact original URL and an explicit click;
missing/unsafe links have no Open action. Choosing leads to preview → local transfer →
ordinary Save flow, including explicit clearing of an existing URL when needed.
Selecting a service/link neither opens a site nor writes or refreshes sources.
Symbols have screen-reader labels, table row/column headers and a single visible
legend; icons are decorative next to the service text. Session/reopen/scroll,
30-minute stale indication, authorization/pending apply and isolation are retained.

Validation uses authored examples and local mocked boundaries, not live platform
availability evidence. No initApp/global lifecycle/auth, other chat, server cap,
shared link policy, JustWatch URL, parser, retention, schema, flag or production
change. No source request, real Wishlist write or new persistence is introduced.

### Verification of the compact comparison

- 141/141 targeted offline/mock checks passed,0 failed/skipped: category-before-
  service ranking, stable equal peers, own-block/film guards, partial versus
  separate UA presence, missing/negative/format-negative/conflicting/mixed
  languages, immutable original rows, exact transfer/report and shared R1/R2.
- Three existing browser suites executed in installed Edge:30/30 passed,0
  failed/skipped. Desktop1280×900, iPhone X-size375×812, iPhone Air-size420×912,
  tablet820×1180; viewport emulation is not native iPhone/Safari/WebKit.
  The real add/edit forms use mocked authentication/source/DB boundaries.
  Authored eight-to-three and Dune cases check table/loaded SVGs/accessible
  symbols, all original variant choices, language/service order, exact opens,
  preview/local apply/ordinary Save, missing/unsafe links, copy fallback,
  no discovery replay, retained scroll/session and pending/stale/access guards.
- The browser conflict fixture exposed a lost warning in the simplified view:
  a matched known-service record with unestablished region and an explicit
  field conflict now shows scoped `±`, never a positive track or UA promotion.
  Its regression also proves that a separate UA record cannot repair that scope.
  The browser's option indices and SVG test-host MIME were updated for the new
  semantic table; assertions and timeouts were not weakened.
- Authored `compact-comparison-375.png` and `compact-comparison-420.png` were
  visually inspected outside Git/public artifacts. No live source/availability,
  deployed Node22 or real-device result is claimed. Local Node24.22.0/Edge.
- Syntax, whitespace/scope and14 selected Markdown documents/455 local links/
  280 anchor references/13 existing handoff sections passed. Compared with #205,
  the extra link/anchor is this record's compact-comparison section, same scope.
  Full server/SQL/native PostgreSQL concurrency and Windows launcher lifecycle
  were not repeated: no dependent code/schema/contracts changed.

### Follow-up: choose links, not source records — PR #206

The follow-up replaces the original-record selector described in the first
checkpoint's tests above. Current targeted offline/mock result:77/77 passed,
0 failed/skipped (presentation, link choice/preview, DOM and safe report). The
three browser suites were rerun:30/30 passed,0 failed/skipped, same four Edge
viewports. Authored Supergirl-shaped eight-to-three data keeps all eight rows in
diagnostics: four Rakuten rows with one URL show no chooser; four rows with three
distinct URLs show three link choices, not four rent/buy/source choices. Cases
with zero/one/multiple URLs, unsafe/refused addresses, exact non-primary open and
transfer, normal Save, pending apply, retained/reopened/stale/access boundaries
remain covered. Query/fragment/percent-encoding differences are not silently
normalized; original representative identity and all source fields are preserved.
Authored `compact-one-link-{375,420}.png` and
`compact-distinct-links-{375,420}.png` remain outside Git; mobile examples were
visually inspected. This is not real iPhone/Safari or live destination validation.
No assertions/timeouts weakened, no source calls or real Wishlist writes. Server,
source policies, reports, ranking and lifecycle/auth are unchanged. Syntax,
whitespace/scope and the same14-doc/455-link/280-anchor check passed; unrelated
server/SQL/Windows suites were not repeated.

### Mobile service emblems — 2026-10-30

From develop `146aa187709f1a2bf3cf9bef2d16a04a22d4ba5c` after merged #206:
at widths up to480px, a successfully loaded service emblem replaces its visible
name in the comparison's first column. The narrower80px service column frees
equal remaining space for centered audio/subtitle headings and values. Wider
screens retain emblem plus name. The full button name remains in `aria-label`,
the visually hidden text and a tooltip; selection still uses the existing gold
pressed state, focus outline and native44px touch/keyboard button. Availability
symbols remain separate, unchanged observations.

While an emblem is pending or if loading fails, the readable service name stays
visible. A failed image is hidden without retry or replacement request. Services
without an emblem also keep their text. This is presentation-only: no changes
to ranking, source fields, URL choice/deduplication, reports, transfer/Save,
session/TTL, initApp/global lifecycle/auth, server, flags or schema. No live
source/destination requests, owner checkout/demo changes, merge or deployment.

Validation:78/78 targeted offline/mock checks passed,0 failed/skipped. Browser
main suite5/5 passed at1280×900,375×812 (iPhone X-size),420×912 (iPhone Air-size),
820×1180; the unchanged pending/resume suites also passed25/25 on the same
runtime code. Tests verify mobile-only name hiding, visible desktop names,
accessible full button labels, centered headers/symbols,44px targets, no
horizontal overflow, actual failed SVG requests, visible fallback, keyboard
selection/preview, retained reopen, no extra discovery and ordinary Save only.
The layout helper waits for the existing180ms bubble animation to finish before
measuring; no runtime animation or assertion/timeout was weakened. The failure
fixture retains the selected film ID and uses a test-only local asset query to
avoid decoded-image cache reuse; production SVG addresses are unchanged.
Authored `mobile-service-icons-{375,420}.png` and
`mobile-service-fallback-{375,420}.png` were visually inspected outside Git.
These are Edge viewport tests, not real iPhone/Safari/VoiceOver validation.
Syntax, whitespace/scope and14-doc/455-link/280-anchor checks passed. Server/SQL,
native PostgreSQL and Windows lifecycle were not rerun: dependencies unchanged.
