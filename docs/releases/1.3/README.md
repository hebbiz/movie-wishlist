# Movie Wishlist 1.3

**Release:** Movie Wishlist 1.3 — Social Advice  
**Version:** 1.3.0  
**Status:** Production  
**Release date:** September 27, 2026

## Overview

Movie Wishlist 1.3 introduces `Поради`: a global, user-scoped social-discovery catalogue built from recommendations that are already visible to the authenticated user through the existing social graph.

The release does not create another group-owned movie list and does not add another `movie_group_lists.status`. Recommendations remain the source of truth; `Поради` is a dynamic projection of eligible social recommendations plus persistent per-user discovery/read state.

## Main features

### Global Social Advice catalogue

`Поради` is available from every group, but all entry points open the same personal catalogue. Switching the active group does not create another copy of the list or reset its unread state.

Eligible movies are aggregated by `movie_id`. A movie appears once even when several socially connected users have recommended it.

### Shared eligibility with Mykola

The Social Advice catalogue and Mykola's social recommendation flow use the same eligibility core.

A movie is eligible when:

- at least one recommendation is socially visible to the current user;
- the aggregate average rating is at least `7` on the Movie Wishlist scale;
- at least one visible recommendation contains a non-empty comment.

Eligibility is dynamic. A movie can leave or re-enter the current catalogue when ratings or comments change.

### Persistent discovery and unread state

`social_advice_discovery` stores one permanent discovery record for each:

    user + movie

The record is created only the first time that movie becomes eligible for that user.

If the movie later becomes ineligible and then eligible again, the existing discovery record is reused and no second `+1` event is created.

### Social card experience

Social Advice uses the standard Movie Wishlist movie-card structure while giving visual priority to the social context:

- a representative recommendation comment;
- recommender and source-group context;
- Mykola's human-readable archive sentiment;
- a compact recommendation-count action leading to the complete recommendation context;
- dedicated double-speech-bubble iconography.

Raw aggregate rating numbers are not presented as the main user-facing signal.

### Unread UX

New discoveries contribute to a global `Поради (+N)` counter.

An unseen movie receives a `Нове` marker and highlight. Opening `Поради` scrolls to the first unseen movie. The discovery is marked as seen only after the relevant card remains visible for the configured dwell period.

The unread state is global for the user and is not repeated when switching groups.

### Add to a selected group

A Social Advice movie can be added to `Хочу переглянути` through a compact group picker.

The user explicitly selects the destination group. The application does not silently assume the currently active group.

Adding a movie creates a normal `movie_group_lists` wishlist entry and does not remove the movie from the global Social Advice catalogue.

### Push notifications

When a movie first becomes eligible for a user, Movie Wishlist can send one Web Push notification for that discovery.

The notification deep-links to `Поради`, opens the relevant movie and uses the existing `Нове`/seen interaction.

Push delivery is controlled by:

- the existing master notification preference;
- the new `Нові фільми у «Порадах»` category preference.

Disabling Social Advice push does not hide the catalogue or its in-app `+N` state.

### Advice Room suppression

Recommendations created in a multi-user Advice Room store their room context.

When at least two participants were present, those participants do not receive a redundant Social Advice push for the recommendation event they just took part in. Other eligible socially connected users remain valid push recipients.

## Data model

New user-owned state:

- `social_advice_discovery`

Extended state:

- `profiles.social_advice_notifications_enabled`
- `recommendations.advice_room_id`

Core Social Advice functions include:

- `get_eligible_social_movies_for_user()`
- `get_eligible_social_movies()`
- `get_social_advice_movies()`
- `mark_social_advice_movies_seen()`
- `add_social_advice_movie_to_wishlist()`
- `sync_social_advice_discovery_for_movie()`
- `get_social_advice_push_state_for_user()`
- `enqueue_social_advice_push()`

Recommendation mutations are connected to discovery synchronization through `trg_recommendation_social_advice`.

## Design principles

Movie Wishlist 1.3 follows these boundaries:

- recommendations remain the single source of truth;
- group lists remain group-owned;
- Social Advice remains user-owned and global;
- discovery history is separate from current eligibility;
- a movie is the primary UI entity, not an activity-feed event;
- no duplicate card is created for multiple recommendations;
- Mykola and `Поради` cannot diverge in eligibility;
- push delivery is optional and independent from catalogue availability;
- no permanent social activity feed is introduced.

## Release archive

Additional technical documentation for this release is stored alongside this file:

- `database.sql` — production database structures and server-side logic introduced or changed for Social Advice;
- `architecture.md` — product boundaries, eligibility, discovery lifecycle, UI integration, push flow and security model.

The Git tag `v1.3.0` identifies the complete source-code snapshot for this production release.
