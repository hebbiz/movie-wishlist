-- Create advice rooms table

create table advice_rooms (
    id uuid primary key default gen_random_uuid(),

    movie_id uuid not null
        references movies(id)
        on delete cascade,

    group_id uuid not null
        references groups(id)
        on delete cascade,

    created_by uuid not null
        references auth.users(id),

    status text not null
        check (status in ('waiting','discussion','summarizing','closed')),

    opened_at timestamptz not null default now(),

    expires_at timestamptz not null,

    closed_at timestamptz,

    result_generated boolean not null default false
);

-- Add index to advice_rooms

create index advice_rooms_lookup_idx
on advice_rooms(group_id,movie_id,status);

-- Add advice_room_participants table

create table advice_room_participants (

    id uuid primary key default gen_random_uuid(),

    room_id uuid not null
        references advice_rooms(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id),

    status text not null
        check (status in ('active','finished','left')),

    joined_at timestamptz not null default now(),

    finished_at timestamptz,

    last_seen_at timestamptz not null default now()
);

-- Ensure no duplicates in advice_room_participants

create unique index advice_room_unique_user
on advice_room_participants(room_id,user_id);
