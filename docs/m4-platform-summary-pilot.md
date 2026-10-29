# M4 pilot: platform summaries and Rakuten inference

Owner feedback on Supergirl (2026), develop deploy 6ae2746cf949428fe03a9806, 2026-10-29: show a single result per streaming service, group purchase and rental labels, and hide price while the displayed currency needs investigation. A platform card may contain source observations from different offers; this is a presentation summary, not proof that those offers are identical. Preserve the original rows in the diagnostic report. Selecting a card transfers one explicitly chosen original link after preview and authorization checks; the policy still rejects unsupported destinations. No price/currency correction is claimed.

Rakuten only: when matched, non-conflicting Kinobaza observations of the same film include a Ukraine-context Rakuten link that passes the existing link policy, and a separate matched Kinobaza Rakuten localization block reports Ukrainian audio and/or subtitles, present and rank the reported languages on the combined platform card. Clearly disclose that the localization block's country and link/offer association are unverified. Known foreign-country blocks are excluded. Conflicting or negative block data cannot establish a positive claim. Never mutate source rows or apply this inference to other platforms.

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
