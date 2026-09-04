begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  endpoint text not null unique,

  p256dh text not null,
  auth text not null,

  expiration_time bigint null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions
  enable row level security;

commit;

-- add RLS to push subscriptions table

create policy "Users can read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy "Users can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- create movie activity trigger for push notifications

create or replace function public.notify_movie_activity_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  edge_secret text;
  function_url text;
begin
  select decrypted_secret
  into edge_secret
  from vault.decrypted_secrets
  where name = 'movie_wishlist_edge_secret'
  limit 1;

  if edge_secret is null then
    raise warning 'movie_wishlist_edge_secret not found';
    return new;
  end if;

  function_url :=
    'https://mttkectgdqqmejpenkrn.supabase.co/functions/v1/send-movie-activity-push';

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', edge_secret
    ),
    body := jsonb_build_object(
      'activity_id', new.id
    )
  );

  return new;
end;
$$;

-- trigger

drop trigger if exists trg_movie_activity_push
on public.movie_activity;

create trigger trg_movie_activity_push
after insert
on public.movie_activity
for each row
execute function public.notify_movie_activity_push();
