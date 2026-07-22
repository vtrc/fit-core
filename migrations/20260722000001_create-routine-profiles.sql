create table public.routine_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age integer not null check (age between 14 and 99),
  weight_kg numeric not null check (weight_kg between 40 and 120),
  goal text not null check (goal in ('strength', 'cardio', 'fat_loss', 'general')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  days_per_week integer not null check (days_per_week between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routine_profiles enable row level security;

create policy routine_profiles_owner_select on public.routine_profiles
  for select to authenticated using (user_id = auth.uid());

create policy routine_profiles_owner_insert on public.routine_profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy routine_profiles_owner_update on public.routine_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.routine_profiles to authenticated;
