update public.exercises
set muscle_groups = translated.groups,
    updated_at = now()
from (
  select exercises.id,
         array(
           select case muscle_group
             when 'quadriceps' then 'cuádriceps'
             when 'glutes' then 'glúteos'
             when 'hamstrings' then 'isquiotibiales'
             when 'adductors' then 'aductores'
             when 'abductors' then 'abductores'
             when 'gluteus medius' then 'glúteo medio'
             when 'calves' then 'gemelos'
             when 'chest' then 'pecho'
             when 'triceps' then 'tríceps'
             when 'shoulders' then 'hombros'
             when 'back' then 'espalda'
             when 'biceps' then 'bíceps'
             when 'abdominals' then 'abdominales'
             when 'lower back' then 'lumbares'
             when 'legs' then 'piernas'
             when 'arms' then 'brazos'
             else muscle_group
           end
           from unnest(exercises.muscle_groups) as muscle_group
         ) as groups
  from public.exercises
) as translated
where public.exercises.id = translated.id;
