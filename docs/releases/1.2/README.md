# Movie Wishlist 1.2

**Release:** Movie Wishlist 1.2 — Movie Activities & PWA Notifications  
**Version:** 1.2.0  
**Status:** Production  
**Release date:** September 2026

## Overview

Movie Wishlist 1.2 extends the stable Movie Wishlist 1.1 architecture with a lightweight movie activity and notification model.

The release introduces temporary per-user activity tracking for changes in group movie lists and integrates this model with the installed PWA experience.

The activity system is intentionally not an activity history or permanent event log. It represents current relevant changes that still need to be delivered to group participants.

## Main features

### Movie Activity

Changes to a movie's catalog status create a temporary activity event for the group.

Supported destination lists:

- Хочу переглянути
- Замовлено
- Придбано
- Переглянуто

Each relevant group participant receives their own unseen state. The user who caused the change is excluded from the recipients.

Only one current catalog-status activity can exist for the same movie in the same group. A newer status change supersedes the previous activity.

### Unseen activity UX

Main movie lists display `+N` counters for unseen activity.

A movie associated with unseen activity receives a `Нове` indicator only inside the main list corresponding to the activity's destination status.

The following views do not consume activity:

- Усі
- derived lists such as Недоступні
- other views that do not correspond to the activity destination status

Activity is marked as seen only after the relevant movie card has actually been visible to the user for the configured dwell period.

When unseen movies exist in a destination list, opening that list can bring the user to the relevant unseen activity rather than leaving the user at the normal recommendation-based top of the list.

### Cross-group activity

Movie Wishlist can indicate unseen activity in other groups so that users can discover relevant changes without manually checking every group.

### PWA behavior

When an installed PWA returns from the background, Movie Wishlist refreshes its current movie and activity data.

This prevents a long-running installed PWA session from remaining stale when another participant changes the catalog while the application is in the background.

### Notification model

Movie Activity provides the shared event model used by the PWA notification layer.

The notification flow is designed around the same temporary activity lifecycle rather than maintaining a separate permanent notification history.

### Activity lifecycle

A catalog-status activity remains active while at least one assigned recipient has not seen it.

When all recipients have seen an activity, the activity is deleted automatically together with its recipient records.

If the same movie changes status again before the previous activity has been fully consumed, the previous activity is replaced by the new current activity.

Activities older than 30 days are removed automatically by scheduled database cleanup.

## Data model

Core activity tables:

- `movie_activity`
- `movie_activity_recipients`

Core activity functions:

- `replace_movie_catalog_activity()`
- `mark_movie_activity_seen()`
- `cleanup_old_movie_activity()`

Movie status changes are connected to the activity model through a database trigger on `movie_group_lists`.

Scheduled cleanup is handled by PostgreSQL `pg_cron`.

## Design principles

Movie Wishlist 1.2 preserves the architecture and interaction model established in Movie Wishlist 1.0 and 1.1.

The activity system follows several principles:

- no permanent activity history
- no separate activity feed
- no unnecessary notification-management interface
- activity is tied to the current state of the group catalog
- newer movie status changes supersede obsolete ones
- seen activity disappears naturally
- stale unseen activity expires after 30 days
- the existing list-based mental model remains unchanged

## Release archive

Additional technical documentation for this release is stored alongside this file:

- `database.sql` — database structures and server-side logic introduced for the 1.2 activity/notification model
- `architecture.md` — architecture and lifecycle of Movie Activity and the PWA notification model

The Git tag `v1.2.0` identifies the complete source-code snapshot for this production release.
