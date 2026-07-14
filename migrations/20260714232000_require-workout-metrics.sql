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
      or not (new.result ? 'weight')
      or not (new.result ? 'setsCompleted')
      or not (new.result ? 'repetitionsTotal')
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
      or not (new.result ? 'durationSeconds')
      or not (new.result ? 'distance')
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
