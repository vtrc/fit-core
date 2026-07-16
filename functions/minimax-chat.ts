import { createClient } from 'npm:@insforge/sdk';
import { generateText, Output, tool } from 'npm:ai';
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible';
import { z } from 'npm:zod';

const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

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
  age: z.number().int().min(13).max(100),
  weightKg: z.number().positive().max(400),
  goal: z.enum(['strength', 'cardio', 'fat_loss', 'general']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().int().min(1).max(7),
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

async function generateRoutineProposal(profile: unknown, req: Request): Promise<unknown> {
  const validatedProfile = routineProfileSchema.parse(profile);
  const token = req.headers.get('Authorization')?.slice(7);
  const anonKey = req.headers.get('apikey');
  if (!token || !anonKey) throw new Error('Authentication required');
  const client = createClient({ baseUrl: Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app', anonKey });
  client.setAccessToken(token);
  const searchExercises = tool({
    description: 'Returns real gym exercises from the catalog.',
    inputSchema: z.object({ type: z.enum(['strength', 'cardio']).optional() }),
    execute: async ({ type }) => {
      let query = client.database.from('exercises').select('id, name, type, equipment, muscle_groups, supported_metrics');
      if (type) query = query.eq('type', type);
      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const model = createOpenAICompatible({ name: 'minimax', baseURL: 'https://api.minimax.io/v1', headers: { Authorization: `Bearer ${Deno.env.get('MINIMAX_API_KEY') ?? ''}` } });
  const { output } = await generateText({
    model: model('MiniMax-M2.7'), tools: { searchExercises }, output: Output.object({ schema: routineProposalSchema }),
    prompt: `Crea una rutina usando exclusivamente ejercicios devueltos por searchExercises. Perfil: ${JSON.stringify(validatedProfile)}. Asigna series, repeticiones, peso y descansos según objetivo y nivel. Para cardio usa duración o distancia y deja fuerza a null. El nombre empieza por Rutina.`,
    stopWhen: ({ steps }) => steps.length >= 3,
  });
  const proposal = routineProposalSchema.parse(output);
  const { data: catalog } = await client.database.from('exercises').select('id, name').in('id', proposal.exercises.map((exercise) => exercise.exercise_id));
  const names = new Map((catalog ?? []).map((exercise) => [exercise.id, exercise.name]));
  return {
    ...proposal,
    exercises: proposal.exercises.map((exercise) => ({ ...exercise, exercise_name: names.get(exercise.exercise_id) ?? 'Ejercicio' })),
  };
}

async function handleRoutineMessage(message: string, req: Request): Promise<unknown> {
  const model = createOpenAICompatible({ name: 'minimax', baseURL: 'https://api.minimax.io/v1', headers: { Authorization: `Bearer ${Deno.env.get('MINIMAX_API_KEY') ?? ''}` } });
  const { output: profile } = await generateText({
    model: model('MiniMax-M2.7'),
    output: Output.object({ schema: partialProfileSchema }),
    prompt: `Extrae del mensaje los datos para crear una rutina. No inventes datos ausentes. Objetivos: strength, cardio, fat_loss o general. Niveles: beginner, intermediate o advanced. Mensaje: ${message}`,
  });
  const missing = Object.entries(routineProfileSchema.shape).filter(([key]) => profile[key as keyof typeof profile] === undefined).map(([key]) => key);
  if (missing.length > 0) {
    return { state: 'collecting_requirements', missing, message: 'Para crear tu rutina necesito: edad, peso, objetivo (fuerza/cardio), nivel y días por semana.' };
  }
  return { state: 'awaiting_approval', proposal: await generateRoutineProposal(profile, req) };
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
    const { messages, stream, action, routine, profile, message } = await req.json();

    if (action === 'routine_message') {
      return new Response(JSON.stringify(await handleRoutineMessage(message, req)), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
