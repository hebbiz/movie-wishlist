# Movie Wishlist v1.4.0

**Preparation record — November 11, 2026:** At that time, the annotated tag and
GitHub Release had not yet been created, and no publication date was recorded.
This records the preparation state, not their later publication status.

Movie Wishlist v1.4.0 records the limited streaming beta of **«Поради носіїв
Миколи»**. This adds media advice for a selected film to the existing Mykola
experience; it is not a new Mykola or a replacement for Social Advice or Advice
Room.

The streaming-beta code was already promoted through
[PR #234](https://github.com/hebbiz/movie-wishlist/pull/234), merged into `main`
on **2026-11-10 at 21:15:07 UTC**, at
`1e359a3b9d5250de911de9cd1da3bcba6a296e47`. That code promotion is separate
from preparing and publishing the v1.4.0 tag and release notes.

## Highlights

### Source-based digital media advice for Ukraine

For the selected film, Mykola brings together digital-service observations from
TMDb, Movie of the Night and Kinobaza, with bounded Tavily discovery of Kinobaza
cards. The interface distinguishes source-reported availability, Ukrainian audio
and Ukrainian subtitles, including negative, unknown and conflicting evidence.

These are **source claims**, not a viewing entitlement or a guarantee that an
offer is currently available to the user. Language observations do not establish
the tracks of every edition, access variant or linked offer. Film identity,
source provenance and uncertain offer binding remain explicit boundaries.

### Choose a link and transfer it to a movie card

Users can select a service and a suitable source link, inspect the transfer
preview and transfer the **exact selected address** into the movie card. The
ordinary Save action remains separate and retains the existing editing rights.

Apple TV / iTunes remains one user-facing service. Source-reported Apple TV+
subscription, Store purchase and rental remain distinct access variants inside
the data. Audio, subtitles, URLs and terms are not copied between unconfirmed
equivalent offers merely because they share a service name or domain.

### A maintained streaming-beta runtime

Production modules and useful regression fixtures are separated from the retired
local pilot. Static publication uses `.site-dist`, while Functions and operational
tools remain outside the public site. The TMDb logo and attribution are preserved
under `assets/`. The cleanup decisions are recorded in the
[runtime inventory](../../m4-runtime-separation.md).

## Access and scope boundaries

- Advice requires authenticated, non-anonymous access, an active global Beta
  switch and an active personal `mykola_media_advice` flag. Advice eligibility
  does not depend on a group, group role or editing rights for a particular film;
  the server checks current access during requests.
- Diagnostics retain their separate permission. Transfer and Save retain normal
  card-editing authorization; advice access does not grant editing rights.
- Region-driven flag assignment follows the existing backend policy. This release
  does not introduce a new browser-side definition of the Ukrainian region.
- Search remains bounded, identity-checked and without automatic source retries.
  A missing or unconfirmed result is not proof that a film or offer is absent.
- Physical-edition search is **deferred and not integrated** into the beta.
  The [physical-media handoff](../../m4-physical-media-handoff.md) preserves the
  retailer, edition/disc, language and evidence requirements for a separate
  future stage. The old Windows/LAN/Termius demo is no longer supported.

The dated [M4 runbook](../../m4-media-advice.md) retains the access-policy and
migration execution records. Historical pre-install and pilot commands are not
instructions to reinstall or reactivate this release.

## Validation and known limits

The owner confirmed the production flow for **«Форсаж 6» / Fast & Furious 6 (2013)**:
request advice → transfer a link → Save → reopen editing and inspect the link.
This is owner-reported production evidence for that scenario, not an independent
agent smoke test or validation of every provider, language claim, film or device.

The production diagnostic build stamp reports **`Commit: unknown`**. The known
Git promotion SHA above must not be substituted for an independently attested
runtime commit. This preparation makes no new live film-source requests and
does not independently revalidate production deployment or database state.

The [backup/restore playbook](../../recovery-playbook.md) records narrower
successful data/M4 comparisons, but the full restore result remains
**`verified:false`**, with outstanding ACL/schema differences. It is not proof
of complete Supabase-project, Auth, Storage, secret or service recovery.

Advice Room access-policy work remains a **separate follow-up**; it must not be
confused with the media-advice feature's global/personal access model. Remaining
debt can be considered for a later patch such as v1.4.1, but no patch scope or
delivery date is promised here.

## Release completion

This release-preparation change updates version metadata and documentation only.
It does not change runtime behavior, permissions, database schema, migrations,
flags, secrets or Netlify configuration, and does not run SQL, merge or deploy.

For release completion, follow the [Git workflow](../../git-workflow.md): confirm
the approved final release commit and deployment evidence before creating the
annotated `v1.4.0` tag and publishing the GitHub Release. Record actual completion
separately; do not infer the tag target from the earlier production-promotion
commit or record uncompleted steps as completed.
