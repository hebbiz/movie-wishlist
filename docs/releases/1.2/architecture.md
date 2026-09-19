# Movie Wishlist 1.2 — Architecture

**Version:** 1.2.0  
**Status:** Production  
**Release:** Movie Activities & PWA Notifications  
**Date:** September 2026

---

## 1. System overview

Movie Wishlist is a group-oriented movie catalog built as a lightweight web application.

Core stack:

- static HTML / CSS / JavaScript frontend
- Supabase PostgreSQL database
- Supabase Auth with Google OAuth
- Supabase Row Level Security
- Supabase Edge Functions
- PostgreSQL `pg_net`
- PostgreSQL `pg_cron`
- Web Push / PWA
- Netlify hosting
- GitLab source repository

Version 1.2 extends the existing Movie Wishlist architecture with a temporary Movie Activity layer and a PWA notification model.

The central design principle is that an activity is not permanent history.

It represents a current catalog change that may still be relevant to another participant.

---

## 2. Core catalog model

Movie metadata is stored globally in:

    movies

A movie's state inside a particular group is stored separately in:

    movie_group_lists

This separates the global identity of a movie from its group-specific catalog state.

The principal catalog statuses are:

    wishlist
    ordered
    owned
    watched

The UI represents these as:

    Хочу переглянути
    Замовлено
    Придбано
    Переглянуто

`Недоступні` is a derived UI list rather than a separate database status.

It represents movies where:

    status = wishlist
    recommended_medium = "Наразі недоступний"

---

## 3. Groups and users

Application users are represented by:

    auth.users
        ↓
    profiles

Group membership is represented by:

    groups
        ↓
    group_members

Group roles include:

    owner
    member
    visitor

The group model is also the basis for determining recipients of Movie Activity.

When a catalog activity is created, all current participants in the relevant group are eligible recipients except the user who performed the change.

The `is_group_subscriber` field is separate from Movie Activity recipient assignment and does not determine whether an activity recipient record is created.

---

## 4. Movie Activity model

Movie Wishlist 1.2 introduces two tables:

    movie_activity
    movie_activity_recipients

`movie_activity` represents the current relevant event.

`movie_activity_recipients` represents the delivery/seen state for each recipient.

Conceptually:

    movie_activity
        │
        ├── recipient A → unseen
        ├── recipient B → unseen
        └── recipient C → seen

This allows one activity to have an independent seen state for every participant.

---

## 5. Activity creation

Movie Activity begins with a change to:

    movie_group_lists

The database trigger:

    trg_movie_group_list_activity

runs after:

    INSERT
    UPDATE OF status

and invokes:

    handle_movie_group_list_activity()

For authenticated user operations, the function determines the actor using:

    auth.uid()

Technical/admin operations without an authenticated user do not create Movie Activity.

For an INSERT:

    from_status = NULL
    to_status   = new status

For an UPDATE, activity is created only when the movie status actually changes.

Changes to unrelated movie-list metadata do not create status activity.

---

## 6. Activity replacement

The central activity function is:

    replace_movie_catalog_activity()

Only one current `catalog_status` activity is retained for the same:

    group
    + movie
    + activity category

If another status change occurs before the previous activity has been consumed, the previous event is removed and replaced.

Therefore:

    old activity
        ↓
    obsolete
        ↓
    deleted

    newest status change
        ↓
    current activity

This prevents users from receiving a backlog of obsolete intermediate movie states.

The database additionally enforces this invariant through a unique constraint on:

    (group_id, movie_id, activity_category)

---

## 7. Recipient snapshot

When an activity is created, `replace_movie_catalog_activity()` creates recipient rows for all current `group_members` except the actor.

Example:

    Denys changes movie status
        ↓
    Movie Activity created
        ↓
    current group members inspected
        ↓
    Denys excluded
        ↓
    recipient records created for everyone else

This is a snapshot at the time of the event.

If there are no other recipients, the newly created activity is immediately removed because there is nobody to whom it needs to be delivered.

---

## 8. Unseen activity in the UI

The client loads unseen recipient records for the authenticated user.

Activity is represented in the interface in two principal ways:

    destination list → +N
    movie card       → Нове

The movie-card state is shown only when the user is inside the main list matching:

    activity.to_status

For example:

    activity.to_status = owned
        ↓
    Придбано
        ↓
    movie card shows Нове

Opening `Усі` does not consume the activity.

Derived views such as `Недоступні` also do not consume it.

This preserves the rule that activity is acknowledged in the context where the catalog change actually belongs.

---

## 9. Seen semantics

An activity is not considered seen merely because its destination list was opened.

The relevant movie card must actually become visible.

The frontend uses card visibility plus a dwell period before invoking:

    mark_movie_activity_seen(activity_id)

The production dwell period for Movie Wishlist 1.2 is approximately:

    1600 ms

This prevents rapid scrolling or merely opening a list from immediately consuming every unseen activity.

---

## 10. Activity completion

`mark_movie_activity_seen()` updates only the recipient row belonging to the authenticated user.

Conceptually:

    seen_at = NULL
        ↓
    user actually views card
        ↓
    seen_at = timestamp

After marking the recipient as seen, the function checks whether any unseen recipients remain.

If at least one remains:

    activity remains

If none remain:

    movie_activity is deleted
        ↓
    movie_activity_recipients deleted by ON DELETE CASCADE

Therefore fully consumed activity disappears automatically.

---

## 11. Activity expiration

Movie Activity is intentionally temporary.

An unseen event must not survive indefinitely simply because a participant stopped using the application.

The retention period is:

    30 days

The function:

    cleanup_old_movie_activity()

deletes activity where:

    created_at < now() - interval '30 days'

A scheduled `pg_cron` job executes the cleanup daily.

Production schedule:

    15 3 * * *

Job name:

    cleanup-old-movie-activity

Deleting the parent activity automatically removes its recipient rows through `ON DELETE CASCADE`.

---

## 12. Activity lifecycle

The complete lifecycle is:

    movie_group_lists changes
                │
                ▼
    trg_movie_group_list_activity
                │
                ▼
    handle_movie_group_list_activity()
                │
                ▼
    replace_movie_catalog_activity()
                │
                ├── replaces obsolete activity
                │
                ├── creates current activity
                │
                └── creates recipient snapshot
                │
                ▼
          movie_activity
                │
                ├──────────────► PWA notification path
                │
                ▼
    movie_activity_recipients
                │
                ▼
       user opens destination list
                │
                ▼
       relevant card is visible
                │
                ▼
    mark_movie_activity_seen()
                │
          ┌─────┴─────┐
          │           │
    unseen remain   all seen
          │           │
       retain       delete
                      │
                      ▼
               cascade recipients

Independent retention path:

    activity age > 30 days
                │
                ▼
    cleanup_old_movie_activity()
                │
                ▼
             delete

---

## 13. PWA notification path

A newly created `movie_activity` also triggers:

    trg_movie_activity_push

which invokes:

    notify_movie_activity_push()

The database function retrieves the server-side secret:

    movie_wishlist_edge_secret

from Supabase Vault.

It then performs an HTTP request through `pg_net` to the deployed Edge Function:

    send-movie-activity-push

Conceptually:

    movie_activity INSERT
            │
            ▼
    trg_movie_activity_push
            │
            ▼
    notify_movie_activity_push()
            │
            ├── Supabase Vault
            │       └── edge secret
            │
            ▼
          pg_net
            │
            ▼
    send-movie-activity-push
            │
            ▼
       Web Push delivery

Secret values are not stored in the Git repository.

---

## 14. Push subscriptions

Browser/device push subscriptions are stored in:

    push_subscriptions

Each subscription belongs to an authenticated user.

Stored subscription data includes:

    endpoint
    p256dh
    auth
    expiration_time

RLS allows users to manage only their own push subscriptions.

The user-level notification preference is stored in:

    profiles.notifications_enabled

Push delivery and Movie Activity are related but remain separate concepts:

    Movie Activity
        = who has an unseen catalog change

    Push subscription/preferences
        = whether/how a device can receive Web Push

This separation allows the in-app activity model to continue functioning independently of push availability.

---

## 15. PWA foreground/resume behavior

The installed PWA may remain alive while backgrounded.

When it becomes visible again, Movie Wishlist refreshes its movie/activity state.

This ensures that a user returning to an already-running PWA sees changes made by other participants while the application was in the background.

The activity state therefore does not depend solely on a full page reload.

---

## 16. Security model

All 12 application tables in the `public` schema have Row Level Security enabled.

The application uses RLS for normal client-side access and `SECURITY DEFINER` functions for controlled server-side operations that require broader database access.

Important examples include:

    current_user_group_role()
    can_read_recommendation()
    replace_movie_catalog_activity()
    mark_movie_activity_seen()
    cleanup_old_movie_activity()
    notify_movie_activity_push()

Movie Activity tables expose recipient-specific read access through RLS.

The client does not directly mutate recipient seen state; this is handled through the controlled database function.

Secrets required for server-to-server notification delivery are stored outside the repository.

---

## 17. Recommendations and social visibility

Recommendations remain globally unique per:

    movie_id + user_id

`context_group_id` records the context in which the recommendation was made but does not define the full visibility boundary.

Recommendation visibility is determined through the application's social graph using:

    can_read_recommendation()

This model predates Movie Activity and remains part of the production 1.2 architecture.

---

## 18. Advice Rooms

Advice Rooms remain part of the production architecture introduced before 1.2.

Core tables:

    advice_rooms
    advice_room_participants

Core functions:

    enter_advice_room()
    finish_advice_room()
    get_advice_room_state()
    leave_advice_room()

The discussion window is:

    3 minutes

Movie Activity 1.2 does not replace or alter the conceptual purpose of Advice Rooms.

---

## 19. Architectural boundaries

Movie Wishlist 1.2 deliberately does not introduce:

- a permanent notification history
- a permanent activity feed
- a log of every intermediate movie status
- duplicate activity for the same current movie state
- activity consumption from generic or derived lists
- push delivery as a requirement for in-app unseen state

The Movie Activity layer is therefore a temporary synchronization and attention mechanism rather than an audit system.

---

## 20. Production components

The 1.2 production system consists of:

    GitLab repository
            │
            ▼
      Netlify frontend
            │
            ├──────────────┐
            ▼              ▼
    Supabase Auth     Service Worker / PWA
            │              │
            ▼              ▼
    PostgreSQL DB      Web Push
            │
            ├── RLS
            ├── Functions
            ├── Triggers
            ├── pg_cron
            ├── pg_net
            └── Vault
                    │
                    ▼
             Edge Function
             send-movie-activity-push

---

## 21. Release snapshot

The complete Movie Wishlist 1.2 release archive consists of:

    docs/releases/1.2/
        README.md
        database.sql
        architecture.md

`database.sql` records the production database structure and server-side logic.

`architecture.md` records the architectural intent and relationships between the components.

The source-code state corresponding to this architecture is identified by:

    v1.2.0

The Git tag should be created only after all release documentation has been committed.
