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
