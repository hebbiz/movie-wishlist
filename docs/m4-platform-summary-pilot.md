# M4 pilot: platform summaries and Kinobaza language interpretation

Owner feedback on Supergirl (2026), develop deploy 6ae2746cf949428fe03a9806, 2026-10-29: show a single result per streaming service, group purchase and rental labels, and hide price while the displayed currency needs investigation. A platform card may contain source observations from different offers; this is a presentation summary, not proof that those offers are identical. Preserve the original rows in the diagnostic report. Selecting a card transfers one explicitly chosen original link after preview and authorization checks; the policy still rejects unsupported destinations. No price/currency correction is claimed.

Historical #203 rule, superseded by the generalized rule below: Rakuten only required a matched Ukraine-context Kinobaza link plus a separate matched Rakuten localization block. The current rule no longer needs that separate UA pointer and applies to all supported services. Historical source rows are not rewritten.

The existing 30-minute freshness indication, form-session lifetime, access checks, transfer preview, explicit ordinary Save and diagnostic report remain in effect. Identity/provider matching and server limits remain unchanged. Source data, entitlement, availability and chosen destination remain unverified; the reported Supergirl HBO link may lead to an American Sign Language version. Further pilot feedback will determine whether the simplification is useful.

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
