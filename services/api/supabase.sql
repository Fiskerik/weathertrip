create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_location jsonb,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  default_adults integer not null default 2,
  default_children integer not null default 0,
  default_has_ev boolean not null default false,
  default_max_drive_hours numeric not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  brief_json jsonb not null,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.saved_trips enable row level security;

create policy "profiles are private" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "saved trips are private" on public.saved_trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
