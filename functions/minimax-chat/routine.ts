import { createClient } from 'npm:@insforge/sdk';
import { routineProfileSchema } from './schemas.ts';
import { loadCatalog, fillExerciseDetails } from './catalog.ts';
import { parseMiniMaxJson } from './utils.ts';
import { saveRoutineToDb } from './persistence.ts';
import type { ApprovedRoutine, CatalogEntry } from './schemas.ts';

const mmKey = Deno.env.get('MINIMAX_API_KEY') ?? '';
const URL_BASE = Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app';

function generateName(profile: { goal: string; level: string }): string {
  const goalLabels: Record<string, string> = { strength: 'Fuerza', cardio: 'Cardio', fat_loss: 'Pérdida de Grasa', general: 'General' };
  return `Rutina de ${goalLabels[profile.goal] ?? 'Entrenamiento'} - Nivel ${profile.level}`;
}

function generateDescription(profile: { goal: string; daysPerWeek: number }): string {
  const goalText = profile.goal === 'strength' ? 'ganar fuerza'
    : profile.goal === 'cardio' ? 'mejorar resistencia cardiovascular'
      : profile.goal === 'fat_loss' ? 'perder grasa'
        : 'mantenerse en forma';
  const days = profile.daysPerWeek;
  return `Rutina personalizada para ${goalText} entrenando ${days} día${days > 1 ? 's' : ''} por semana.`;
}

export async function generateRoutineProposal(profile: unknown, token: string, anonKey: string): Promise<unknown> {
  const validatedProfile = routineProfileSchema.parse(profile);

  const client = createClient({ baseUrl: URL_BASE, anonKey });
  client.setAccessToken(token);
  const { data: catalog, error: catalogError } = await client.database
    .from('exercises')
    .select('id, name, type, equipment, muscle_groups')
    .order('name', { ascending: true });
  if (catalogError) throw new Error(catalogError.message);
  const entries = (catalog ?? []) as CatalogEntry[];
  const nameToEntry = new Map(entries.map((e) => [e.name.toLowerCase().trim(), e]));
  const idToEntry = new Map(entries.map((e) => [e.id, e]));
  const availableNames = entries.map((e) => e.name).join(', ');

  const mmRes = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: 'Eres un entrenador personal. Devuelve SOLO JSON sin explicaciones.' },
        { role: 'user', content: `De estos ejercicios: ${availableNames}. Perfil: ${JSON.stringify(validatedProfile)}. Elige 5-8 ejercicios. Devuelve SOLO un array JSON con los nombres exactos.` },
      ],
    }),
  });
  const mmText = await mmRes.text();
  if (!mmRes.ok) throw new Error(`MiniMax API raw error: ${mmRes.status} ${mmText}`);
  const mmData = JSON.parse(mmText);
  const text = mmData?.choices?.[0]?.message?.content ?? '';
  const rawList: string[] = JSON.parse(text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '').trim());
  const selected: CatalogEntry[] = [];
  for (const raw of rawList) {
    const entry = nameToEntry.get(String(raw).toLowerCase().trim());
    if (entry) selected.push(entry);
  }
  if (selected.length === 0) throw new Error('No se pudieron seleccionar ejercicios');

  const exercises = selected.map((e, i) => fillExerciseDetails(e, validatedProfile, i));
  return {
    name: generateName(validatedProfile),
    description: generateDescription(validatedProfile),
    exercises: exercises.map((e) => ({ ...e, exercise_name: idToEntry.get(e.exercise_id)?.name ?? 'Ejercicio' })),
  };
}

export async function handleProposalFeedback(
  message: string,
  userId: string,
  proposal: unknown,
  profile: unknown,
  token: string,
  anonKey: string,
): Promise<unknown> {
  const prop = proposal as {
    name: string;
    description: string;
    exercises: Array<{
      exercise_name?: string;
      exercise_id: string;
      planned_sets: number | null;
      planned_repetitions: number | null;
      planned_weight: number | null;
      planned_duration_seconds: number | null;
      planned_distance: number | null;
      rest_seconds: number | null;
      notes: string | null;
      position: number;
    }>;
  };
  const currentNames = prop.exercises.map((e) => e.exercise_name).join(', ');

  const mmRes = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: 'Eres un entrenador personal. Responde SOLO JSON sin explicaciones.' },
        {
          role: 'user',
          content: `Rutina actual: ${currentNames} (${prop.exercises.length} ejercicios, nombre: "${prop.name}").
Usuario: "${message}"

Determina qué quiere hacer:
1. "approve" — si está conforme, quiere guardar, dice sí/correcto/está bien/me gusta/ok/guardar
2. "rename" — si quiere cambiar el nombre (ej: "llámala X", "nombre: X", "ponle X")
3. "modify" — si quiere cambiar los ejercicios (añadir/quitar/reemplazar)

Devuelve JSON:
- Si approve: {"intent":"approve"}
- Si rename: {"intent":"rename","name":"nuevo nombre"}
- Si modify: {"intent":"modify","exercises":["nombre1","nombre2",...]}`,
        },
      ],
    }),
  });
  const mmText = await mmRes.text();
  if (!mmRes.ok) throw new Error(`MiniMax API error: ${mmRes.status} ${mmText}`);
  const mmData = JSON.parse(mmText);
  const text = mmData?.choices?.[0]?.message?.content ?? '';
  const parsed = parseMiniMaxJson(text) as { intent: string; name?: string; exercises?: string[] };

  if (parsed.intent === 'approve') {
    const client = createClient({ baseUrl: URL_BASE, anonKey });
    client.setAccessToken(token);
    const id = await saveRoutineToDb(client, userId, prop as ApprovedRoutine);
    return { action: 'approve', id };
  }

  if (parsed.intent === 'rename' && parsed.name) {
    return { action: 'rename', proposal: { ...prop, name: parsed.name.trim() } };
  }

  if (parsed.intent === 'modify' && Array.isArray(parsed.exercises)) {
    const { nameToEntry, idToEntry } = await loadCatalog(token, anonKey);
    const selected: CatalogEntry[] = [];
    for (const raw of parsed.exercises) {
      const entry = nameToEntry.get(String(raw).toLowerCase().trim());
      if (entry) selected.push(entry);
    }
    if (selected.length === 0) {
      return {
        state: 'collecting_requirements',
        missing: ['exercises'],
        message: '¡Ups! No encontré ejercicios del catálogo que encajen con lo que pides. Intenta decirme los nombres de otro modo y los ajusto.',
      };
    }
    const validatedProfile = profile ? routineProfileSchema.parse(profile) : null;
    if (!validatedProfile) {
      return {
        state: 'collecting_requirements',
        missing: ['profile'],
        message: 'Necesito tus datos para ajustar la rutina. Cuéntame tu edad, peso, objetivo, nivel y días de entrenamiento.',
      };
    }
    const exercises = selected.map((e, i) => fillExerciseDetails(e, validatedProfile, i));
    return {
      action: 'modify',
      proposal: {
        name: prop.name,
        description: prop.description,
        exercises: exercises.map((e) => ({ ...e, exercise_name: idToEntry.get(e.exercise_id)?.name ?? 'Ejercicio' })),
      },
      profile: validatedProfile,
    };
  }

  return { action: 'modify', proposal };
}
