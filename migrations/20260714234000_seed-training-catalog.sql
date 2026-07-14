insert into public.exercises (name, type, equipment, muscle_groups, supported_metrics)
select source.name, source.type, source.equipment, source.muscle_groups, source.supported_metrics
from (values
  ('Leg Press', 'strength', 'Leg Press', array['quadriceps', 'glutes', 'hamstrings']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Leg Curl', 'strength', 'Leg Curl', array['hamstrings']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Leg Extension', 'strength', 'Leg Extension', array['quadriceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Glute Kickback', 'strength', 'Glute Master', array['glutes']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Adductor Machine', 'strength', 'Inner Thigh', array['adductors']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Abductor Machine', 'strength', 'Outer Thigh', array['abductors', 'gluteus medius']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Standing Calf Raise', 'strength', 'Standing Calf Raise', array['calves']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Chest Press', 'strength', 'Chest Press', array['chest', 'triceps', 'shoulders']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Pec Deck Fly', 'strength', 'Pec Fly', array['chest']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Shoulder Press', 'strength', 'Shoulder Press', array['shoulders', 'triceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Lat Pulldown', 'strength', 'Lat Pulldown', array['back', 'biceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Seated Cable Row', 'strength', 'Mid Row', array['back', 'biceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Assisted Pull-Up', 'strength', 'Chin/Dip Assist', array['back', 'biceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Assisted Dip', 'strength', 'Chin/Dip Assist', array['chest', 'triceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Biceps Curl', 'strength', 'Biceps Curl', array['biceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Triceps Dip', 'strength', 'Seated Dip', array['triceps', 'chest']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Abdominal Crunch', 'strength', 'Abdominal Machine', array['abdominals']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Back Extension', 'strength', 'Low Back', array['lower back', 'glutes', 'hamstrings']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Dumbbell Bench Press', 'strength', 'Dumbbells', array['chest', 'triceps', 'shoulders']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Dumbbell Goblet Squat', 'strength', 'Dumbbells', array['quadriceps', 'glutes']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Barbell Back Squat', 'strength', 'Smith Machine', array['quadriceps', 'glutes', 'hamstrings']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Cable Triceps Pushdown', 'strength', 'Cable Crossover', array['triceps']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Treadmill Walk', 'cardio', 'Treadmill', array['legs']::text[], array['duration_seconds', 'distance', 'speed', 'incline', 'calories']::text[]),
  ('Elliptical', 'cardio', 'Elliptical', array['legs', 'glutes']::text[], array['duration_seconds', 'distance', 'speed', 'resistance', 'calories']::text[]),
  ('Spin Bike', 'cardio', 'Spin Bike', array['legs']::text[], array['duration_seconds', 'distance', 'speed', 'resistance', 'calories']::text[]),
  ('Recumbent Bike', 'cardio', 'Recumbent Bike', array['legs']::text[], array['duration_seconds', 'distance', 'speed', 'resistance', 'calories']::text[]),
  ('TRX Row', 'strength', 'TRX', array['back', 'biceps', 'shoulders']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Box Step-Up', 'strength', 'Plyometric Box', array['quadriceps', 'glutes', 'hamstrings']::text[], array['weight', 'sets_completed', 'repetitions_total']::text[]),
  ('Boxing Bag', 'cardio', 'Heavy Bag', array['shoulders', 'arms', 'abdominals', 'legs']::text[], array['duration_seconds', 'calories']::text[])
) as source(name, type, equipment, muscle_groups, supported_metrics)
where not exists (
  select 1 from public.exercises existing where existing.name = source.name
);
