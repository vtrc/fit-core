alter table public.workouts
  drop constraint if exists workouts_routine_id_user_id_fkey;

alter table public.workouts
  add constraint workouts_routine_id_fkey
  foreign key (routine_id) references public.routines(id) on delete set null;

create or replace function public.validate_workout_result()
returns trigger
language plpgsql
as $$
declare
  exercise_type text;
  result_kind text;
begin
  select type into exercise_type
  from public.exercises
  where id = new.exercise_id;

  if exercise_type is null then
    raise exception 'Workout result exercise does not exist';
  end if;

  result_kind := new.result->>'kind';

  if exercise_type = 'strength' then
    if result_kind <> 'strength'
      or not (new.result ? 'weight')
      or not (new.result ? 'setsCompleted')
      or not (new.result ? 'repetitionsTotal')
      or (new.result->>'weight')::numeric < 0
      or (new.result->>'setsCompleted')::integer < 0
      or (new.result->>'repetitionsTotal')::integer < 0 then
      raise exception 'Invalid strength workout result';
    end if;
  elsif exercise_type = 'cardio' then
    if result_kind <> 'cardio'
      or not (new.result ? 'durationSeconds')
      or not (new.result ? 'distance')
      or (new.result->>'durationSeconds')::integer < 0
      or (new.result->>'distance')::numeric < 0 then
      raise exception 'Invalid cardio workout result';
    end if;
  end if;

  return new;
end;
$$;

create trigger workout_results_validate_result
before insert or update on public.workout_results
for each row execute function public.validate_workout_result();

create or replace function public.prevent_user_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end;
$$;

create trigger routines_prevent_user_id_change before update on public.routines
for each row execute function public.prevent_user_id_change();
create trigger routine_exercises_prevent_user_id_change before update on public.routine_exercises
for each row execute function public.prevent_user_id_change();
create trigger workouts_prevent_user_id_change before update on public.workouts
for each row execute function public.prevent_user_id_change();
create trigger workout_results_prevent_user_id_change before update on public.workout_results
for each row execute function public.prevent_user_id_change();
