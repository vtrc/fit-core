import { createClient } from 'npm:@insforge/sdk';
import type { ApprovedRoutine } from './schemas.ts';

const URL_BASE = Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app';

export async function saveRoutineToDb(
  client: ReturnType<typeof createClient>,
  userId: string,
  routine: ApprovedRoutine,
): Promise<string> {
  const name = routine.name?.trim();
  if (!name || !routine.exercises?.length) throw new Error('A name and at least one exercise are required');

  const exerciseIds = routine.exercises.map((e) => e.exercise_id);
  const { data: exercises, error: exerciseError } = await client.database.from('exercises').select('id').in('id', exerciseIds);
  if (exerciseError) throw new Error(exerciseError.message);
  if ((exercises ?? []).length !== new Set(exerciseIds).size) throw new Error('The routine contains an exercise that is not in the catalog');

  const { data: created, error: routineError } = await client.database
    .from('routines')
    .insert([{ user_id: userId, name, description: routine.description?.trim() || null }])
    .select('id')
    .single();
  if (routineError) throw new Error(routineError.message);

  const rows = routine.exercises.map((exercise, index) => ({
    user_id: userId,
    routine_id: created.id,
    exercise_id: exercise.exercise_id,
    position: exercise.position ?? index,
    planned_sets: exercise.planned_sets ?? null,
    planned_repetitions: exercise.planned_repetitions ?? null,
    planned_weight: exercise.planned_weight ?? null,
    planned_duration_seconds: exercise.planned_duration_seconds ?? null,
    planned_distance: exercise.planned_distance ?? null,
    rest_seconds: exercise.rest_seconds ?? null,
    notes: exercise.notes ?? null,
  }));
  const { error: insertError } = await client.database.from('routine_exercises').insert(rows);
  if (insertError) {
    await client.database.from('routines').delete().eq('id', created.id).eq('user_id', userId);
    throw new Error(insertError.message);
  }

  return created.id;
}

export async function persistRoutine(req: Request, userId: string, routine: ApprovedRoutine, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const anonKey = req.headers.get('apikey');
    if (!anonKey) return new Response(JSON.stringify({ error: 'Missing apikey' }), { status: 401, headers: corsHeaders });
    const client = createClient({ baseUrl: URL_BASE, anonKey });
    client.setAccessToken(req.headers.get('Authorization')!.slice(7));
    const id = await saveRoutineToDb(client, userId, routine);
    return new Response(JSON.stringify({ id }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
}
