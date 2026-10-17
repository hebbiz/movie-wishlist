# Movie Wishlist v1.3.1

Movie Wishlist v1.3.1 is a stabilization release that records the production
improvements made after v1.3.0. It does not introduce a new product milestone or
change the Social Advice ownership model established in v1.3.0.

## Highlights

### More reliable recommendation rating on mobile

The rating control keeps its labels readable across supported phone widths. The
rating-8 label remains at the same 36% anchor instead of moving between
breakpoints, while very narrow screens use the shorter low-rating label.

The aperture now carries a restrained cinematic light that follows the current
rating through the Movie Wishlist red, gold and green palette. The effect also
gently reaches the thumb and nearby labels without replacing the dark,
minimal interface.

### Add a movie to another group

A movie's action menu can open the existing group picker and add that movie to
another writable group.

When the user owns both groups, Movie Wishlist copies the source status,
recommended medium, owned medium and purchase URL. A watched source becomes a
wishlist item in the destination. For other writable role combinations, the
movie is added as a normal wishlist item without source metadata.

An existing destination record is never overwritten.

### Rename an existing group

Owners can rename a group through the existing create-group form. The current
group type remains visible but cannot be changed. The server-side operation
accepts only a non-empty trimmed name and checks owner membership before the
update.

The edit view no longer opens the mobile keyboard automatically, preventing the
viewport jump that could compete with the form's smooth transition.

## Database source added after v1.3.0

- `015_copy_movie_between_owned_groups.sql`
- `016_rename_owned_group.sql`

Migration files describe the required repository state but do not prove their
application in a particular Supabase environment. Check the target environment
before applying or reapplying database changes.

## Validation

The owner confirmed that these changes were published and validated through
real production use. Baseline preparation did not repeat a full production
smoke test and did not independently verify the Netlify deployment commit or
the Supabase migration ledger.

Repository-level release checks cover package metadata, documentation links,
version consistency, whitespace and final diff review.

## Scope boundaries

- No new runtime feature is introduced by the release-preparation commit.
- No RLS, RPC, Edge Function or database schema behavior is changed by the
  release-preparation commit.
- Historical v1.2 and v1.3 documentation remains unchanged.
- `MW-FUT-01` and `MW-FUT-02` remain Discovery work and are not included in
  v1.3.1.

## Release completion

After approval, merge the preparation through `develop` to `main`, validate the
production deploy, create tag `v1.3.1` on the final release commit, publish these
notes as the GitHub Release description, and synchronize `develop` with `main`.

The final release commit and tag are intentionally not recorded in this
candidate document before those operations occur.
