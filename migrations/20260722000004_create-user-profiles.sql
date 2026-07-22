create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age int not null,
  weight_kg numeric not null,
  goal text not null,
  level text not null,
  days_per_week int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy user_profiles_owner_insert on public.user_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_profiles_owner_select on public.user_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy user_profiles_owner_update on public.user_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.user_profiles to authenticated;
