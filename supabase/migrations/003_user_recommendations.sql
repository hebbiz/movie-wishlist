-- Add table for recommendations & RLS

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),

  movie_id uuid not null references public.movies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  context_group_id uuid not null references public.groups(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique (movie_id, user_id)
);

alter table public.recommendations enable row level security;

create policy "Users can read own recommendations"
on public.recommendations
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "Users can create own recommendations in available group"
on public.recommendations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.group_members gm
    where gm.group_id = recommendations.context_group_id
      and gm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.movie_group_lists mgl
    where mgl.group_id = recommendations.context_group_id
      and mgl.movie_id = recommendations.movie_id
  )
);

create policy "Users can delete own recommendations"
on public.recommendations
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- =====================================================
-- 2026-06-18
-- Recommendations visibility
-- Allow users to see recommendations from socially
-- connected users (shared group membership)
-- =====================================================

drop policy if exists "Users can read visible recommendations"
on public.recommendations;

create policy "Users can read visible recommendations"
on public.recommendations
for select
to authenticated
using (
  user_id = auth.uid()

  or exists (
    select 1
    from public.group_members my_membership
    join public.group_members connected_membership
      on connected_membership.group_id = my_membership.group_id
    where my_membership.user_id = auth.uid()
      and connected_membership.user_id = recommendations.user_id
      and connected_membership.user_id <> auth.uid()
  )
);

-- Recommendations: allow users to read recommendations from socially connected groups
drop policy if exists "Users can read recommendations from socially connected groups"
on public.recommendations;

create policy "Users can read recommendations from socially connected groups"
on public.recommendations
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members my_groups
    join public.group_members connected_members
      on connected_members.group_id = my_groups.group_id
    join public.group_members connected_user_groups
      on connected_user_groups.user_id = connected_members.user_id
    join public.movie_group_lists connected_movies
      on connected_movies.group_id = connected_user_groups.group_id
    where my_groups.user_id = auth.uid()
      and connected_movies.movie_id = recommendations.movie_id
  )
);

-- Movie Wishlist
-- Дозволяє бачити профілі користувачів, чиї рекомендації доступні поточному користувачу

drop policy if exists "profiles_select_visible_recommendation_users" on profiles;

create policy "profiles_select_visible_recommendation_users"
on profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from recommendations r
    where r.user_id = profiles.id
  )
);

drop policy if exists "profiles_select_visible_recommendation_users"
on profiles;

-- Allowa reading profiles of the socially connected group users

drop policy if exists "profiles_select_visible_recommendation_users"
on profiles;

create policy "profiles_select_group_members"
on profiles
for select
to authenticated
using (
  id = auth.uid()

  or exists (
    select 1
    from group_members me
    join group_members other_member
      on other_member.group_id = me.group_id
    where me.user_id = auth.uid()
      and other_member.user_id = profiles.id
  )
)

-- Removed previous social recommendartion policies and created new final one

-- Movie Wishlist
-- Дозволяє читати рекомендації:
-- 1) власні;
-- 2) від користувачів, з якими поточний користувач має спільну групу;
-- 3) з груп, де є хоча б один користувач, з яким поточний користувач має спільну групу

drop policy if exists "Users can read visible social recommendations"
on public.recommendations;

create policy "Users can read visible social recommendations"
on public.recommendations
for select
to authenticated
using (
  user_id = auth.uid()

  or exists (
    select 1
    from public.group_members my_membership
    join public.group_members connected_user
      on connected_user.group_id = my_membership.group_id
    where my_membership.user_id = auth.uid()
      and connected_user.user_id = recommendations.user_id
  )

  or exists (
    select 1
    from public.group_members my_membership
    join public.group_members connected_user
      on connected_user.group_id = my_membership.group_id
    join public.group_members connected_user_other_groups
      on connected_user_other_groups.user_id = connected_user.user_id
    where my_membership.user_id = auth.uid()
      and connected_user_other_groups.group_id = recommendations.context_group_id
  )
);

-- Add recommendation comments

alter table recommendations
add column comment text;

-- Update social recommendations read policies model

drop policy if exists "Users can read visible recommendations"
on public.recommendations;

drop policy if exists "Users can read recommendations from socially connected groups"
on public.recommendations;

drop policy if exists "Users can read visible social recommendations"
on public.recommendations;

create or replace function public.can_read_recommendation(
  recommendation_user_id uuid,
  recommendation_group_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    recommendation_user_id = auth.uid()

    or exists (
      select 1
      from public.group_members me
      join public.group_members direct_user
        on direct_user.group_id = me.group_id
      where me.user_id = auth.uid()
        and direct_user.user_id = recommendation_user_id
    )

    or exists (
      select 1
      from public.group_members me
      join public.group_members bridge_user
        on bridge_user.group_id = me.group_id
      join public.group_members bridge_user_groups
        on bridge_user_groups.user_id = bridge_user.user_id
      join public.group_members second_level_user
        on second_level_user.group_id = bridge_user_groups.group_id
      where me.user_id = auth.uid()
        and second_level_user.user_id = recommendation_user_id
        and second_level_user.group_id = recommendation_group_id
    );
$$;

create policy "Users can read socially visible recommendations"
on public.recommendations
for select
to authenticated
using (
  public.can_read_recommendation(user_id, context_group_id)
);

-- Updated recommendations visibility function

create or replace function public.can_read_recommendation(
  recommendation_user_id uuid,
  recommendation_group_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    recommendation_user_id = auth.uid()

    or exists (
      select 1
      from public.group_members me
      join public.group_members shared_user
        on shared_user.group_id = me.group_id
      where me.user_id = auth.uid()
        and shared_user.user_id = recommendation_user_id
    )

    or exists (
      select 1
      from public.group_members me
      join public.group_members shared_user
        on shared_user.group_id = me.group_id
      join public.group_members shared_user_groups
        on shared_user_groups.user_id = shared_user.user_id
      join public.group_members second_level_user
        on second_level_user.group_id = shared_user_groups.group_id
      where me.user_id = auth.uid()
        and second_level_user.user_id = recommendation_user_id
    );
$$;

-- Add read policy for group metadata on socially visible recommendations

drop policy if exists "groups_select_visible_recommendation_contexts"
on public.groups;

create policy "groups_select_visible_recommendation_contexts"
on public.groups
for select
to authenticated
using (
  exists (
    select 1
    from public.recommendations r
    where r.context_group_id = groups.id
      and public.can_read_recommendation(
        r.user_id,
        r.context_group_id
      )
);

-- Add policy for users to updated their recommendations 

create policy "Users can update own recommendations"
on public.recommendations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Add ratings column into recommendations

alter table recommendations
add column rating_value numeric(3,1);

alter table recommendations
add constraint recommendations_rating_value_check
check (
  rating_value is null
  or (
    rating_value >= 1
    and rating_value <= 20
  )
);


