-- Movie_Group_Lists create table SQL

create table if not exists public.movie_group_lists (
  id uuid primary key default gen_random_uuid(),

  movie_id uuid not null references public.movies(id) on delete cascade,

  group_id uuid not null references public.groups(id) on delete cascade,

  status text not null default 'wishlist',

  recommended_medium text,
  owned_medium text,

  purchase_url text,

  added_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (movie_id, group_id)
);

-- Seed Movies into Group Lists SQL

insert into public.movie_group_lists (
  movie_id,
  group_id,
  status,
  recommended_medium,
  owned_medium,
  purchase_url,
  added_by
)
select
  id,
  '2481bff1-a26f-4173-8a47-f1b16029079d',
  status,
  recommended_medium,
  owned_medium,
  purchase_url,
  added_by
from public.movies
on conflict (movie_id, group_id) do nothing;

-- Access Control for User’s Group Lists

create policy "Users can read own group lists"
on public.movie_group_lists
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);

