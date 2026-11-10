# Changelog

This file records user-visible and operational changes to Movie Wishlist. The
v1.3.1 section is derived from the repository diff between `v1.3.0` and the
reviewed production baseline.

## [1.4.0]

Prepared on **2026-11-11**. At that time, the versioned tag and GitHub Release
had not yet been created, and no publication date was recorded. The limited
streaming beta was already in production following
[#234](https://github.com/hebbiz/movie-wishlist/pull/234); this documentation and
version-metadata PR does not deploy it again.

### Added

- Added **«Поради носіїв Миколи»** in limited beta: discovery of digital offers
  in the Ukrainian context, source-reported Ukrainian audio/subtitle information,
  service/link selection and previewed transfer of the exact selected URL to a
  movie card. Ordinary Save and existing editing rights remain separate.
- Mykola himself and his other movie-selection/recommendation flows predate
  this release; v1.4.0 does not introduce them for the first time.

### Scope and evidence

- Availability and language information represents source claims, not viewing
  entitlement, guaranteed availability or independently verified tracks for an
  individual offer. Language/access conditions do not transfer automatically
  between unconfirmed offers.
- The owner confirmed the production **«Форсаж 6» / Fast & Furious 6** flow:
  advice, link transfer, card Save and the link's presence on reopening edit.
  This is not an independent or exhaustive source/device/scenario test.
- Physical-media search is deferred. The pilot's decisions, reported results
  and evidence limits remain in [the handoff](docs/m4-physical-media-handoff.md).

### Known limits and follow-up candidates

- Production diagnostics show `Commit: unknown`; the source merge is not a
  runtime-commit attestation from that report.
- Full restore verification remains `verified:false` due to ACL/schema
  differences. Matching M4 comparisons do not establish complete recovery.
- Advice Room access policy requires separate work, not a change made by this
  release-preparation PR.
- Technical debt may be considered for a later release, tentatively 1.4.1;
  no scope or delivery date is committed.
- Release notes: [docs/releases/1.4.0/README.md](docs/releases/1.4.0/README.md).

## [1.3.1] - 2026-10-17

### Added

- Added **Add to another group** as a second movie-card menu action after
  **Mark as watched**. The existing group picker is reused and groups that
  already contain the movie are not selectable.
- Added controlled metadata copying when the current user owns both the source
  and target groups. The target receives the source status, recommended medium,
  owned medium and purchase URL; a watched source becomes a wishlist target.
  Existing target records are never overwritten. Other writable combinations
  use the existing plain wishlist-add path without copying source metadata.
- Added owner-only group renaming through the existing group form. The current
  group type is displayed but disabled, and the `rename_owned_group` RPC updates
  only the trimmed non-empty name after checking owner membership.

### Changed

- Refined the recommendation rating control for narrow phones and larger mobile
  layouts. Labels remain on one line, the low label has a shorter narrow-screen
  form, and the label for rating 8 stays anchored at 36% across breakpoints.
- Added a restrained cinematic light treatment to the rating aperture, thumb
  and labels. The interpolation uses the Movie Wishlist red, gold and green
  status palette while preserving the dark visual hierarchy.

### Fixed

- Removed automatic focus and text selection when opening group editing. Mobile
  browsers now complete the form transition before the user explicitly opens
  the keyboard, matching the stable create-group flow.
- Corrected purchased-medium presentation in the movie edit form and purchase
  link label as part of the cross-group metadata flow.

### Database artifacts

- Added `015_copy_movie_between_owned_groups.sql`.
- Added `016_rename_owned_group.sql`.

The files are part of the repository history. Their presence alone is not
evidence that either migration has been applied in a specific Supabase project.

### Validation evidence

- The owner confirmed that the post-v1.3.0 changes were published and validated
  through real production use.
- This is owner-confirmed production validation, not an independent production
  smoke test or an independent verification of the deployed commit/migration
  ledger.

## [1.3.0] - 2026-09-27

- Introduced the global user-scoped Social Advice catalogue, shared social
  eligibility with Mykola, persistent discovery/unread state and Social Advice
  push handling.
- Full archived notes: [`docs/releases/1.3/README.md`](docs/releases/1.3/README.md).
