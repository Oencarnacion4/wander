-- WANDER schema. Run once in the Supabase SQL editor (see SETUP.md).
-- Every table is protected by Row-Level Security: users can only see their own rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_label text,
  home_city text,
  home_region text,
  home_country text,
  home_lat double precision,
  home_lng double precision,
  default_interests text[] not null default '{}',
  default_transport text,
  updated_at timestamptz not null default now()
);

-- Saved plans from Explore My City and Take Me Somewhere.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('explore', 'trip')),
  title text not null,
  location_label text,
  lat double precision,
  lng double precision,
  plan_date date,
  query jsonb not null,          -- the search inputs, so a plan can be re-run
  stops jsonb not null,          -- snapshot of the stops (names, times, cost estimates)
  created_at timestamptz not null default now()
);
create index if not exists plans_user_idx on public.plans(user_id, created_at desc);

-- Places a user wants to go. One row per place.
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,        -- e.g. 'osm:node/123'
  place jsonb not null,          -- snapshot: name, category, kind, lat, lng, address
  city text,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

-- Visits are EVENTS, not checkboxes: the same place can be visited many times.
-- We record that you went to a specific place, never that an activity type is "done".
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  place jsonb not null,
  city text,
  visited_on date not null default current_date,
  rating smallint check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists visits_user_idx on public.visits(user_id, visited_on desc);
create index if not exists visits_place_idx on public.visits(user_id, place_id);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.wishlist enable row level security;
alter table public.visits enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "own plans" on public.plans;
create policy "own plans" on public.plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own wishlist" on public.wishlist;
create policy "own wishlist" on public.wishlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own visits" on public.visits;
create policy "own visits" on public.visits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create an empty profile automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
