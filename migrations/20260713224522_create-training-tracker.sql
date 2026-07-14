create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('strength', 'cardio')),
  equipment text,
  muscle_groups text[] not null default '{}',
  supported_metrics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null,
  exercise_id uuid not null references public.exercises(id),
  position integer not null check (position >= 0),
  planned_sets integer check (planned_sets is null or planned_sets >= 0),
  planned_repetitions integer check (planned_repetitions is null or planned_repetitions >= 0),
  planned_weight numeric check (planned_weight is null or planned_weight >= 0),
  planned_duration_seconds integer check (planned_duration_seconds is null or planned_duration_seconds >= 0),
  planned_distance numeric check (planned_distance is null or planned_distance >= 0),
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, position),
  foreign key (routine_id, user_id) references public.routines(id, user_id) on delete cascade
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid,
  performed_on date not null default current_date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  unique (id, user_id),
  foreign key (routine_id, user_id) references public.routines(id, user_id) on delete set null
);

create table public.workout_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null references public.exercises(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(result) = 'object'),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade
);

create index exercises_type_idx on public.exercises(type);
create index exercises_muscle_groups_idx on public.exercises using gin(muscle_groups);
create index routines_user_id_idx on public.routines(user_id);
create index routine_exercises_user_id_idx on public.routine_exercises(user_id);
create index routine_exercises_routine_id_idx on public.routine_exercises(routine_id);
create index workouts_user_id_performed_on_idx on public.workouts(user_id, performed_on desc);
create index workout_results_user_id_idx on public.workout_results(user_id);
create index workout_results_workout_id_idx on public.workout_results(workout_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();
create trigger routines_set_updated_at before update on public.routines
for each row execute function public.set_updated_at();
create trigger routine_exercises_set_updated_at before update on public.routine_exercises
for each row execute function public.set_updated_at();
create trigger workouts_set_updated_at before update on public.workouts
for each row execute function public.set_updated_at();
create trigger workout_results_set_updated_at before update on public.workout_results
for each row execute function public.set_updated_at();

alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_results enable row level security;

create policy exercises_read_authenticated on public.exercises
for select to authenticated using (true);

create policy routines_owner_access on public.routines
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy routine_exercises_owner_access on public.routine_exercises
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy workouts_owner_access on public.workouts
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy workout_results_owner_access on public.workout_results
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on public.exercises to authenticated;
grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_exercises to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_results to authenticated;
