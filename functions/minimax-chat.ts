import { createClient } from 'npm:@insforge/sdk';
import { z } from 'npm:zod';

const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

const AGE_MIN = 14;
const AGE_MAX = 99;
const WEIGHT_MIN = 40;
const WEIGHT_MAX = 120;
const DAYS_MIN = 1;
const DAYS_MAX = 7;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function extractUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.user_id || null;
  } catch {
    return null;
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

const SYSTEM_PROMPT = `Eres un asistente de fitness especializado en crear rutinas de entrenamiento personalizadas.
Tu objetivo es guiar al usuario para crear una rutina personalizada basada en sus objetivos, nivel de fitness y preferencias.

El proceso para crear una rutina:
1. Pregunta sobre los objetivos del usuario (perder peso, ganar músculo, resistencia, etc.)
2. Pregunta sobre su nivel de fitness (principiante, intermedio, avanzado)
3. Pregunta sobre cuántos días por semana puede entrenar
4. Crea una rutina personalizada con ejercicios específicos
5. Explica cada ejercicio y cómo hacerlo correctamente

Responde siempre en español y sé motivador y profesional.`;

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function stripThinkTags(delta: string, initialInThink: boolean): { cleaned: string; inThink: boolean } {
  let remaining = true;
  let inThink = initialInThink;
  let result = '';
  let cursor = delta;

  while (remaining && cursor.length > 0) {
    if (inThink) {
      const end = cursor.indexOf('</think>');
      if (end === -1) {
        remaining = false;
      } else {
        cursor = cursor.slice(end + 8);
        inThink = false;
      }
    } else {
      const start = cursor.indexOf('<think>');
      if (start === -1) {
        result += cursor;
        remaining = false;
      } else {
        result += cursor.slice(0, start);
        cursor = cursor.slice(start + 7);
        inThink = true;
      }
    }
  }

  return { cleaned: result, inThink };
}

interface ApprovedRoutine {
  name: string;
  description?: string | null;
  exercises: Array<{
    exercise_id: string;
    position?: number;
    planned_sets: number | null;
    planned_repetitions: number | null;
    planned_weight: number | null;
    planned_duration_seconds: number | null;
    planned_distance: number | null;
    rest_seconds: number | null;
    notes: string | null;
  }>;
}

const routineProfileSchema = z.object({
  age: z.number().int().min(AGE_MIN).max(AGE_MAX),
  weightKg: z.number().min(WEIGHT_MIN).max(WEIGHT_MAX),
  goal: z.enum(['strength', 'cardio', 'fat_loss', 'general']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().int().min(DAYS_MIN).max(DAYS_MAX),
});
const partialProfileSchema = routineProfileSchema.partial();

const routineProposalSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  exercises: z.array(z.object({
    exercise_id: z.string().uuid(), exercise_name: z.string().optional(), position: z.number().int().nonnegative(),
    planned_sets: z.number().int().positive().nullable(), planned_repetitions: z.number().int().positive().nullable(),
    planned_weight: z.number().nonnegative().nullable(), planned_duration_seconds: z.number().int().positive().nullable(),
    planned_distance: z.number().positive().nullable(), rest_seconds: z.number().int().nonnegative().nullable(), notes: z.string().nullable(),
  })).min(1),
});

type CatalogEntry = { id: string; name: string; type: string; equipment: string | null; muscle_groups: string[] };

function fillExerciseDetails(exercise: CatalogEntry, profile: z.infer<typeof routineProfileSchema>, position: number): z.infer<typeof routineProposalSchema>['exercises'][number] {
  const base = { exercise_id: exercise.id, position, notes: null };
  if (exercise.type === 'cardio') {
    return { ...base, planned_sets: null, planned_repetitions: null, planned_weight: null, planned_duration_seconds: profile.level === 'beginner' ? 600 : profile.level === 'intermediate' ? 900 : 1200, planned_distance: null, rest_seconds: null };
  }
  const isCompound = (exercise.muscle_groups?.length ?? 0) >= 2;
  const levelMultiplier = profile.level === 'beginner' ? 0.5 : profile.level === 'intermediate' ? 0.7 : 0.9;
  const bodyweightRatio = isCompound ? levelMultiplier : levelMultiplier * 0.35;
  const rawWeight = profile.weightKg * bodyweightRatio;
  const suggestedWeight = exercise.equipment ? Math.round(rawWeight / 2.5) * 2.5 : null;
  if (profile.goal === 'strength') {
    return { ...base, planned_sets: 4, planned_repetitions: profile.level === 'beginner' ? 8 : profile.level === 'intermediate' ? 6 : 5, planned_weight: suggestedWeight, planned_duration_seconds: null, planned_distance: null, rest_seconds: 90 };
  }
  if (profile.goal === 'fat_loss') {
    return { ...base, planned_sets: 3, planned_repetitions: profile.level === 'beginner' ? 12 : 15, planned_weight: suggestedWeight, planned_duration_seconds: null, planned_distance: null, rest_seconds: 45 };
  }
  return { ...base, planned_sets: 3, planned_repetitions: profile.level === 'beginner' ? 10 : 12, planned_weight: suggestedWeight, planned_duration_seconds: null, planned_distance: null, rest_seconds: 60 };
}

function generateName(profile: z.infer<typeof routineProfileSchema>): string {
  const goalLabels: Record<string, string> = { strength: 'Fuerza', cardio: 'Cardio', fat_loss: 'Pérdida de Grasa', general: 'General' };
  return `Rutina de ${goalLabels[profile.goal] ?? 'Entrenamiento'} - Nivel ${profile.level}`;
}

function generateDescription(profile: z.infer<typeof routineProfileSchema>): string {
  const days = profile.daysPerWeek;
  return `Rutina personalizada para ${profile.goal === 'strength' ? 'ganar fuerza' : profile.goal === 'cardio' ? 'mejorar resistencia cardiovascular' : profile.goal === 'fat_loss' ? 'perder grasa' : 'mantenerse en forma'} entrenando ${days} día${days > 1 ? 's' : ''} por semana.`;
}

async function generateRoutineProposal(profile: unknown, req: Request): Promise<unknown> {
  const validatedProfile = routineProfileSchema.parse(profile);
  const token = req.headers.get('Authorization')?.slice(7);
  const anonKey = req.headers.get('apikey');
  if (!token || !anonKey) throw new Error('Authentication required');
  const client = createClient({ baseUrl: Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app', anonKey });
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
  const mmKey = Deno.env.get('MINIMAX_API_KEY') ?? '';
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

async function loadCatalog(token: string, anonKey: string): Promise<{ entries: CatalogEntry[]; nameToEntry: Map<string, CatalogEntry>; idToEntry: Map<string, CatalogEntry> }> {
  const client = createClient({ baseUrl: Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app', anonKey });
  client.setAccessToken(token);
  const { data: catalog, error: catalogError } = await client.database
    .from('exercises')
    .select('id, name, type, equipment, muscle_groups')
    .order('name', { ascending: true });
  if (catalogError) throw new Error(catalogError.message);
  const entries = (catalog ?? []) as CatalogEntry[];
  return {
    entries,
    nameToEntry: new Map(entries.map((e) => [e.name.toLowerCase().trim(), e])),
    idToEntry: new Map(entries.map((e) => [e.id, e])),
  };
}

async function handleRoutineMessage(message: string, proposal?: unknown, profile?: unknown, token?: string, anonKey?: string, messages?: Array<{ role: string; content: string }>): Promise<unknown> {
  const mmKey = Deno.env.get('MINIMAX_API_KEY') ?? '';

  if (proposal) {
    const prop = proposal as { name: string; description: string; exercises: Array<{ exercise_name?: string }> };
    const currentNames = prop.exercises.map((e: { exercise_name?: string }) => e.exercise_name).join(', ');
    const mmRes = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mmKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'system', content: 'Eres un entrenador personal. Devuelve SOLO JSON sin explicaciones.' },
          { role: 'user', content: `Rutina actual: ${currentNames} (${prop.exercises.length} ejercicios). Usuario dice: "${message}". Respeta EXACTAMENTE lo que pide: si dice más ejercicios, añade; si dice menos, quita. Si pide un número concreto, ese número es OBLIGATORIO. Devuelve SOLO un array JSON con los nombres exactos del catálogo.` },
        ],
      }),
    });
    const mmText = await mmRes.text();
    if (!mmRes.ok) throw new Error(`MiniMax API error: ${mmRes.status} ${mmText}`);
    const mmData = JSON.parse(mmText);
    const text = mmData?.choices?.[0]?.message?.content ?? '';
    const rawList: string[] = JSON.parse(text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '').trim());
    const { nameToEntry, idToEntry } = await loadCatalog(token ?? '', anonKey ?? '');
    const selected: CatalogEntry[] = [];
    for (const raw of rawList) {
      const entry = nameToEntry.get(String(raw).toLowerCase().trim());
      if (entry) selected.push(entry);
    }
    if (selected.length === 0) return { state: 'collecting_requirements', missing: ['exercises'], message: 'Vaya, no encontré ejercicios que encajen con tu petición. Cuéntamelo de otra forma y lo ajusto.' };
    const validatedProfile = profile ? routineProfileSchema.parse(profile) : null;
    if (!validatedProfile) return { state: 'collecting_requirements', missing: ['profile'], message: 'Necesito tu perfil para ajustar la rutina con tus datos. Cuéntame edad, peso, objetivo, nivel y días.' };
    const exercises = selected.map((e, i) => fillExerciseDetails(e, validatedProfile, i));
    return {
      state: 'profile_ready',
      proposal: {
        name: prop.name,
        description: prop.description,
        exercises: exercises.map((e) => ({ ...e, exercise_name: idToEntry.get(e.exercise_id)?.name ?? 'Ejercicio' })),
      },
      profile: validatedProfile,
    };
  }

  const conversationContext = (messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');
  const extractPrompt = `De toda la conversación, extrae estos datos si aparecen: age, weightKg, goal (strength|cardio|fat_loss|general), level (beginner|intermediate|advanced), daysPerWeek. No inventes datos. Devuelve SOLO un objeto JSON con los campos que encuentres. Conversación:\n${conversationContext}\n\nMensaje actual: ${message}`;

  const mmRes = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: 'Eres un asistente de fitness. Devuelve SOLO JSON sin explicaciones.' },
        { role: 'user', content: extractPrompt },
      ],
    }),
  });
  const mmText = await mmRes.text();
  if (!mmRes.ok) throw new Error(`MiniMax API error: ${mmRes.status} ${mmText}`);
  const mmData = JSON.parse(mmText);
  const text = mmData?.choices?.[0]?.message?.content ?? '';
  const jsonMatch = text.match(/\{[^{}]*\}/);
  if (!jsonMatch) return { state: 'collecting_requirements', missing: ['profile'], message: `¡Casi! Para crear tu rutina personalizada necesito unos datos sobre ti:\n\n- Tu **edad** (${AGE_MIN}-${AGE_MAX} años)\n- Tu **peso** (${WEIGHT_MIN}-${WEIGHT_MAX} kg)\n- Tu **objetivo** (fuerza, cardio, perder grasa o general)\n- Tu **nivel** (principiante, intermedio o avanzado)\n- **Días** que puedes entrenar por semana (${DAYS_MIN}-${DAYS_MAX})\n\nEjemplo: *"25 años, 70kg, fuerza, intermedio, 3 días"*` };
  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const numericKeys = new Set(['age', 'weightKg', 'daysPerWeek']);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null) continue;
    if (numericKeys.has(key) && typeof value === 'string') {
      const n = Number(value);
      clean[key] = Number.isNaN(n) ? value : n;
    } else {
      clean[key] = value;
    }
  }
  const missing = Object.entries(routineProfileSchema.shape).filter(([key]) => clean[key] === undefined).map(([key]) => key);
  if (missing.length > 0) {
    const labels: Record<string, string> = {
      age: `la **edad** (${AGE_MIN}-${AGE_MAX} años)`,
      weightKg: `el **peso** (${WEIGHT_MIN}-${WEIGHT_MAX} kg)`,
      goal: 'el **objetivo** (fuerza/cardio/perder grasa/general)',
      level: 'el **nivel** (principiante/intermedio/avanzado)',
      daysPerWeek: `los **días por semana** (${DAYS_MIN}-${DAYS_MAX})`,
    };
    const list = missing.map((key) => labels[key] ?? key).join(', ');
    return { state: 'collecting_requirements', missing, message: `¡Voy bien! Solo me falta${missing.length > 1 ? 'n' : ''} ${list}.\n\nEj: *"25 años, 70kg, fuerza, intermedio, 3 días"*` };
  }
  const parsed = routineProfileSchema.safeParse(clean);
  if (!parsed.success) {
    const fieldLabels: Record<string, string> = { age: `la edad (entre ${AGE_MIN} y ${AGE_MAX} años)`, weightKg: `el peso (entre ${WEIGHT_MIN} y ${WEIGHT_MAX} kg)`, goal: 'el objetivo (fuerza/cardio/perder grasa/general)', level: 'el nivel (principiante/intermedio/avanzado)', daysPerWeek: `los días (de ${DAYS_MIN} a ${DAYS_MAX} por semana)` };
    const issues = parsed.error.issues.map((issue) => fieldLabels[issue.path[0] as string] ?? issue.path[0]).join(', ');
    return { state: 'collecting_requirements', missing: parsed.error.issues.map((issue) => String(issue.path[0])), message: `Ups, revisa ${issues}. Por ejemplo: *"25 años, 70kg, fuerza, intermedio, 3 días"*` };
  }
  return { state: 'profile_ready', profile: parsed.data };
}

async function persistRoutine(req: Request, userId: string, routine: ApprovedRoutine, corsHeaders: Record<string, string>): Promise<Response> {
  const name = routine.name?.trim();
  if (!name || !routine.exercises?.length) {
    return new Response(JSON.stringify({ error: 'A name and at least one exercise are required' }), { status: 400, headers: corsHeaders });
  }

  const anonKey = req.headers.get('apikey');
  if (!anonKey) return new Response(JSON.stringify({ error: 'Missing apikey' }), { status: 401, headers: corsHeaders });

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app',
    anonKey,
  });
  client.setAccessToken(req.headers.get('Authorization')!.slice(7));

  const exerciseIds = routine.exercises.map((exercise) => exercise.exercise_id);
  const { data: exercises, error: exerciseError } = await client.database.from('exercises').select('id').in('id', exerciseIds);
  if (exerciseError) return new Response(JSON.stringify({ error: exerciseError.message }), { status: 500, headers: corsHeaders });
  if ((exercises ?? []).length !== new Set(exerciseIds).size) {
    return new Response(JSON.stringify({ error: 'The routine contains an exercise that is not in the catalog' }), { status: 400, headers: corsHeaders });
  }

  const { data: created, error: routineError } = await client.database
    .from('routines')
    .insert([{ user_id: userId, name, description: routine.description?.trim() || null }])
    .select('id')
    .single();
  if (routineError) return new Response(JSON.stringify({ error: routineError.message }), { status: 500, headers: corsHeaders });

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
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ id: created.id }), { status: 200, headers: corsHeaders });
}

export default async function(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || 'https://4af6r2tm.insforge.site';
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const userId = extractUserIdFromToken(authHeader);
  const token = authHeader?.slice(7);
  const anonKey = req.headers.get('apikey') ?? '';

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!checkRateLimit(userId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { messages, stream, action, routine, profile, message, proposal } = await req.json();

    if (action === 'routine_message') {
      return new Response(JSON.stringify(await handleRoutineMessage(message, proposal, profile, token, anonKey, messages as Array<{ role: string; content: string }> | undefined)), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_routine') {
      const proposal = await generateRoutineProposal(profile, req);
      return new Response(JSON.stringify({ state: 'awaiting_approval', proposal }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve_routine') {
      return persistRoutine(req, userId, routine, corsHeaders);
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('MINIMAX_API_KEY');

    const minimaxResponse = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: stream ?? false,
      }),
    });

    if (!minimaxResponse.ok) {
      const errorText = await minimaxResponse.text();
      return new Response(
        JSON.stringify({ error: `MiniMax API error: ${minimaxResponse.status} ${errorText}` }),
        { status: minimaxResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (stream) {
      let inThink = false;

      const stripStream = new TransformStream<string, string>({
        transform(chunk, controller) {
          const { cleaned, inThink: newInThink } = stripThinkTags(chunk, inThink);
          inThink = newInThink;
          if (cleaned) controller.enqueue(cleaned);
        },
        flush(controller) {
          if (!inThink) controller.enqueue('');
        },
      });

      const streamingBody = minimaxResponse.body!
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(stripStream)
        .pipeThrough(new TextEncoderStream());

      return new Response(streamingBody, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const apiResponse = await minimaxResponse.json();

    if (apiResponse?.choices?.[0]?.message?.content) {
      apiResponse.choices[0].message.content = apiResponse.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
    }

    return new Response(
      JSON.stringify(apiResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('minimax-chat runtime error', e);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
