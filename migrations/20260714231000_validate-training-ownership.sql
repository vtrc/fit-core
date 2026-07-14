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

  if exercise_type is null or jsonb_typeof(new.result) <> 'object' then
    raise exception 'Invalid workout result exercise or payload';
  end if;

  result_kind := new.result->>'kind';

  if exercise_type = 'strength' then
    if result_kind <> 'strength'
      or jsonb_typeof(new.result->'weight') <> 'number'
      or jsonb_typeof(new.result->'setsCompleted') <> 'number'
      or jsonb_typeof(new.result->'repetitionsTotal') <> 'number'
      or (new.result->>'weight')::numeric < 0
      or (new.result->>'setsCompleted')::integer < 0
      or (new.result->>'repetitionsTotal')::integer < 0 then
      raise exception 'Invalid strength workout result';
    end if;
  elsif exercise_type = 'cardio' then
    if result_kind <> 'cardio'
      or jsonb_typeof(new.result->'durationSeconds') <> 'number'
      or jsonb_typeof(new.result->'distance') <> 'number'
      or (new.result->>'durationSeconds')::integer < 0
      or (new.result->>'distance')::numeric < 0 then
      raise exception 'Invalid cardio workout result';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_workout_routine_owner()
returns trigger
language plpgsql
as $$
declare
  routine_owner uuid;
begin
  if new.routine_id is not null then
    select user_id into routine_owner
    from public.routines
    where id = new.routine_id;

    if routine_owner is null or routine_owner <> new.user_id then
      raise exception 'Workout routine ownership does not match workout owner';
    end if;
  end if;
  return new;
end;
$$;

create trigger workouts_validate_routine_owner
before insert or update on public.workouts
for each row execute function public.validate_workout_routine_owner();
