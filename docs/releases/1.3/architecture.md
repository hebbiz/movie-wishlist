# Movie Wishlist 1.3 — Architecture

**Version:** 1.3.0  
**Status:** Production  
**Release:** Social Advice  
**Date:** September 27, 2026

---

## 1. System overview

Movie Wishlist is a group-oriented movie catalogue implemented with:

- static HTML, CSS and JavaScript;
- Supabase PostgreSQL and Auth;
- Row Level Security;
- Supabase Edge Functions;
- PostgreSQL `pg_net`, Vault and `pg_cron`;
- Web Push and an installable PWA;
- Netlify hosting.

Version 1.3 adds a personal social-discovery layer named `Поради` without changing the ownership model of existing group lists.

The central boundary is:

    group lists → belong to a group
    Social Advice → belongs to a user

---

## 2. Product roles

Movie Wishlist 1.3 separates three related responsibilities:

    group lists
        store and organise movies for a group

    Поради
        browse socially recommended movies in breadth

    Mykola
        narrow the available pool and help select a movie

`Поради` and Mykola consume the same eligible social recommendation pool, but present it through different interaction models.

---

## 3. Ownership boundary

The existing catalogue model remains:

    movies
        ↓
    movie_group_lists
        ↓
    group-owned status and media metadata

Social Advice does not create records in `movie_group_lists` merely because a movie became eligible.

It is represented as:

    socially visible recommendations
        ↓
    eligibility projection
        ↓
    user-owned discovery state

Therefore `activeGroupId` is not an input to `get_social_advice_movies()`.

Every group-level `Поради` entry point opens the same catalogue and the same unread state.

---

## 4. Source of truth

The `recommendations` table remains the single source of recommendation content:

- recommender;
- movie;
- rating;
- comment;
- context group;
- creation time.

`context_group_id` records where the recommendation was made. It is contextual metadata rather than the complete visibility boundary.

Social visibility continues to be determined through the existing social graph.

---

## 5. Social visibility

The authenticated wrapper:

    can_read_recommendation()

and the explicit-viewer server helper:

    can_user_read_recommendation()

implement the same social-graph rule.

The explicit-viewer form is required because recommendation triggers calculate discovery for multiple possible recipients and cannot rely on the trigger author's `auth.uid()`.

The server helper is internal and is not exposed to normal browser clients.

---

## 6. Shared eligibility

The shared eligibility core is:

    get_eligible_social_movies_for_user(user, optional_movie)

The authenticated wrapper is:

    get_eligible_social_movies()

A movie is eligible when all of the following are true:

1. The viewer can see one or more recommendations through the social graph.
2. Recommendations from the viewer themself are excluded.
3. The aggregate average of non-null ratings is at least `7`.
4. At least one visible recommendation has a non-empty comment.

Eligibility is evaluated per movie and is not persisted as the catalogue itself.

The optional movie argument allows recommendation triggers to recalculate only the affected movie.

---

## 7. Dynamic catalogue presence

Eligibility determines whether a movie is currently present:

    average ≥ 7 and comment exists
        → currently eligible

    average falls below 7
        → absent from current catalogue

    average returns to 7 or more
        → present again

Current presence and historical discovery are deliberately separate concepts.

---

## 8. Persistent discovery state

The table:

    social_advice_discovery

contains:

    user_id
    movie_id
    became_eligible_at
    seen_at

Its primary key is:

    (user_id, movie_id)

This guarantees that a movie can become a new discovery for a specific user only once.

Lifecycle:

    first eligibility
        ↓
    insert discovery row
        ↓
    seen_at = NULL
        ↓
    user views the card
        ↓
    seen_at = timestamp

If the movie later leaves and re-enters eligibility, the existing discovery row prevents another unread event.

Discovery rows are not deleted when current eligibility changes.

---

## 9. Catalogue RPC

The browser loads Social Advice through:

    get_social_advice_movies()

The RPC:

- authenticates the caller;
- obtains the current eligible pool;
- creates missing first-discovery records with conflict protection;
- joins discovery/read state;
- returns the complete visible recommendation stack for each eligible movie;
- includes both commented recommendations and rating-only recommendations in the expanded archive context.

Current ordering is:

1. unseen discoveries first;
2. most recent `became_eligible_at`;
3. newest visible recommendation;
4. aggregate rating;
5. title.

The client preserves this server-provided Social Advice order.

---

## 10. Relationship with Mykola

Mykola consumes the same eligible pool through:

    get_mykola_social_candidates_v2(current_group)

Unlike the global catalogue, Mykola excludes movies already present in the current group.

The selection algorithm remains client-side weighted random selection. Aggregate quality gives a candidate a modest advantage without replacing randomness as the main selection mechanism.

Within one Mykola recommendation session, already shown local and social movies are excluded from repetition.

---

## 11. Social movie cards

The Social Advice view uses the standard Movie Wishlist grid and card identity.

Its social section receives the stronger visual hierarchy:

- a representative comment;
- recommender identity and source group;
- human-readable archive sentiment;
- a compact count action for the complete recommendation context.

Aggregate ratings are translated into Mykola's textual archive language rather than displayed as raw numbers.

The expanded recommendation context uses the regular archive model and includes rating-only entries with the established no-comment treatment.

---

## 12. Unread and seen semantics

The global unread count is derived from eligible discovery rows where:

    seen_at IS NULL

Selecting `Поради` does not immediately consume the whole counter.

The client observes individual unseen cards. A card must remain sufficiently visible for the configured dwell period before the client invokes:

    mark_social_advice_movies_seen(movie_ids)

The production dwell period is approximately:

    1600 ms

After acknowledgement the card performs the standard Movie Wishlist settling animation and the global `+N` decreases.

---

## 13. Adding a movie to a group

Social Advice is global, so adding a movie cannot silently rely on the active group.

The client presents a group picker containing writable owner/member groups.

The selected movie is added through:

    add_social_advice_movie_to_wishlist(target_group, movie)

which reuses the validated Mykola social-add path.

The resulting record is a normal group-owned wishlist entry:

    movie_group_lists.status = wishlist

The Social Advice discovery remains present because social discovery and group membership are independent.

---

## 14. Server-side discovery synchronization

The database trigger:

    trg_recommendation_social_advice

runs after recommendation:

- insert;
- delete;
- relevant updates to movie, context group, rating or comment.

It invokes:

    handle_recommendation_social_advice()
        ↓
    sync_social_advice_discovery_for_movie()

The synchronization function recalculates only the affected movie for all profiles and inserts missing eligible discovery rows with:

    ON CONFLICT DO NOTHING

Only successfully inserted rows are eligible for a first-discovery push enqueue.

This covers rating/comment changes, including a recommendation that initially falls below the threshold and later becomes eligible.

---

## 15. Social Advice push path

For a newly inserted discovery row:

    enqueue_social_advice_push()
        ↓
    Supabase Vault secret
        ↓
    pg_net HTTP request
        ↓
    send-social-advice-push
        ↓
    Web Push

The Edge Function verifies that:

- the discovery row still exists;
- it is still unseen;
- the movie is still currently eligible;
- the master notification preference is enabled;
- the Social Advice category preference is enabled;
- at least one active push subscription exists.

The payload deep-links to the corresponding Social Advice movie.

---

## 16. Notification preferences

The master preference remains:

    profiles.notifications_enabled

The Social Advice category preference is:

    profiles.social_advice_notifications_enabled

Both must be enabled for a Social Advice push.

The category preference does not affect:

- catalogue eligibility;
- catalogue visibility;
- discovery creation;
- the in-app `+N` counter.

This preserves the distinction between passive in-app discovery and active device interruption.

---

## 17. Advice Room push suppression

Recommendations created through the Advice Room flow store:

    recommendations.advice_room_id

The recommendation trigger validates that the referenced room:

- matches the same movie;
- matches the recommendation context group;
- contains the recommendation author as a participant.

If the validated room contains at least two participating/submitted users, discovery is still created normally, but push enqueue is skipped for recipients who participated in that room.

Users outside the room remain valid recipients.

This avoids telling participants about a social event they just completed themselves while preserving global discovery state.

---

## 18. Security model

`social_advice_discovery` has Row Level Security enabled.

Authenticated clients may select only their own rows. They cannot insert, delete or reset discovery history directly.

Seen-state changes and group additions are performed through controlled `SECURITY DEFINER` functions.

Server-only helpers are revoked from browser roles. The push-state helper is executable by `service_role` only.

Push delivery uses the existing Vault secret and does not expose service credentials, VAPID private keys or push-subscription credentials in the repository.

---

## 19. Architectural boundaries

Movie Wishlist 1.3 deliberately does not introduce:

- another `movie_group_lists.status`;
- user ownership fields in `movie_group_lists`;
- duplicated recommendation content;
- separate Social Advice catalogues for each group;
- an Instagram/Letterboxd-style activity feed;
- one card per recommendation event;
- repeated unread events after eligibility re-entry;
- push delivery as a requirement for the in-app catalogue.

The primary UI entity remains the movie.

---

## 20. Known operational boundary

The existing production `send-movie-activity-push` function remains unchanged to avoid risking the stable Movie Activity path.

A normal group-activity push can therefore temporarily set the operating-system app badge without the Social Advice unread contribution. Opening or resuming the PWA recalculates the combined badge from current application state.

This does not affect in-app `+N`, discovery records, notification delivery or seen semantics.

---

## 21. Production components

The 1.3 production system adds these components to the 1.2 architecture:

    recommendations
          │
          ▼
    eligibility core
          │
          ├──────────────► Mykola candidates
          │
          ▼
    social_advice_discovery
          │
          ├──────────────► Поради UI / +N / Нове
          │
          ▼
    recommendation trigger
          │
          ▼
    pg_net + Vault
          │
          ▼
    send-social-advice-push
          │
          ▼
       Web Push

---

## 22. Release snapshot

The Movie Wishlist 1.3 release archive consists of:

    docs/releases/1.3/
        README.md
        database.sql
        architecture.md

`database.sql` records the production database structures and server-side logic relevant to the 1.3 milestone.

`architecture.md` records the product boundaries and interaction between eligibility, discovery, Mykola, UI, group addition and notifications.

The corresponding production source state is identified by:

    v1.3.0
