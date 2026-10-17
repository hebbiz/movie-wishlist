# Git workflow

This document records the release workflow used for the Movie Wishlist v1.3.1
baseline and the expected safeguards for subsequent work.

## Long-lived branches

- `main` is the release branch used by the production publication path.
- `develop` is the integration branch used before promotion to `main`.

The repository does not define Netlify branch-deploy settings. Confirm any
automatic deploy or preview mapping in Netlify instead of inferring it from
these branch roles.

Do not force-push either branch, rewrite shared history, or move release tags.

## Starting work

1. Fetch remote refs and inspect the working tree.
2. Resolve unexpected local changes or branch divergence before editing.
3. Create a short-lived task branch from the explicitly selected baseline.
4. Keep each commit limited to one reviewable concern.

For release-baseline work, the task branch starts from the current
`origin/main`, because the production source is the object being recorded. For
ordinary product work, confirm the intended base before branching rather than
assuming that local `main` or `develop` is current.

Example release-preparation start:

```text
git fetch --prune origin
git status --short --branch
git switch -c codex/<topic> origin/main
```

## Review path

1. Verify the task branch against its base.
2. Push the task branch without force.
3. Open a PR into `develop` with scope, validation evidence, operational steps
   and explicit non-goals.
4. Stop in review-ready state until the PR is approved.

The v1.3.1 preparation PR must not merge itself, create a tag or publish a
GitHub Release.

## Release completion

After review and validation:

1. Merge the release preparation into `develop`.
2. Validate the `develop` candidate through the configured preview/deployment
   path, if available, and verify any separately required Supabase operations.
3. Merge `develop` into `main` without rewriting history.
4. Confirm the production deploy.
5. Create annotated tag `v1.3.1` on the final release commit.
6. Publish the prepared GitHub Release notes.
7. Synchronize `develop` with the final `main` history and verify identical
   trees.

The final release commit and tag are recorded only after these operations; they
must not be guessed in the release candidate.

## Database and infrastructure changes

- A migration file in Git is not proof that SQL was applied.
- Record Supabase migration/Edge Function deployment separately from frontend
  deployment.
- Never place service-role keys, VAPID private keys, Vault values or other
  secrets in commits, PR descriptions or release notes.
- Production SQL execution, Edge Function deployment and changes to `main`
  require explicit release authorization.

## Rollback

Prefer a normal revert commit for a released Git change. Do not use force push
or history rewriting as rollback. Database rollback must be designed against
the actual environment state and must not be inferred from repository files.
