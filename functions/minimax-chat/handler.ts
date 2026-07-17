import { routineProfileSchema } from './schemas.ts';
import { parseMiniMaxJson } from './utils.ts';
import { handleProposalFeedback } from './routine.ts';
import { AGE_MIN, AGE_MAX, WEIGHT_MIN, WEIGHT_MAX, DAYS_MIN, DAYS_MAX } from './constants.ts';

const mmKey = Deno.env.get('MINIMAX_API_KEY') ?? '';

export async function handleRoutineMessage(
  message: string,
  userId: string,
  proposal?: unknown,
  profile?: unknown,
  token?: string,
  anonKey?: string,
  messages?: Array<{ role: string; content: string }>,
): Promise<unknown> {
  if (proposal) {
    return handleProposalFeedback(message, userId, proposal, profile, token ?? '', anonKey ?? '');
  }

  const conversationContext = (messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const classifyPrompt = `
    Eres un entrenador personal. Responde SOLO JSON sin explicaciones.

    Conversación:
    ${conversationContext}

    Mensaje actual: "${message}"

    Determina si el usuario quiere CREAR O MODIFICAR una rutina, o es conversación GENERAL.

    RUTINA — si da datos de perfil (edad/peso/objetivo/nivel/días). Si el usuario mencionó un objetivo en la conversación anterior y NO lo está contradiciendo ahora, USA ese objetivo de la conversación:
      Extrae SOLO los campos que aparezcan (no inventes): age, weightKg, goal (strength|cardio|fat_loss|general), level (beginner|intermediate|advanced), daysPerWeek.
      Importante: Si el usuario solo está copiando un formato de ejemplo (como "25 años, 70kg, fuerza, intermedio, 3 días"), el objetivo puede ser el que YA mencionó antes, no el del ejemplo.
      → {"intent":"routine","age":...,"weightKg":...,"goal":"...","level":"...","daysPerWeek":...}

    CHAT — si es saludo, consejo, motivación, pregunta general, etc:
      → {"intent":"chat","response":"tu respuesta como entrenador en markdown"}
  `;

  const miniMaxRes = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: 'Eres un entrenador personal. Responde SOLO JSON sin explicaciones.' },
        { role: 'user', content: classifyPrompt },
      ],
    }),
  });
  const miniMaxText = await miniMaxRes.text();
  if (!miniMaxRes.ok) throw new Error(`MiniMax API error: ${miniMaxRes.status} ${miniMaxText}`);
  const mmData = JSON.parse(miniMaxText);
  const text = mmData?.choices?.[0]?.message?.content ?? '';
  const parsed = parseMiniMaxJson(text) as { intent: string; response?: string; age?: unknown; weightKg?: unknown; goal?: string; level?: string; daysPerWeek?: unknown };

  if (parsed.intent === 'chat') {
    return { action: 'chat', content: 'Soy un asistente especializado en crear rutinas de entrenamiento personalizadas 💪 Cuéntame tu objetivo, nivel y días disponibles y te preparo una rutina a medida. ¿Empezamos?' };
  }

  const raw = parsed.intent === 'routine' ? parsed : {};
  const clean = coerceNumericFields(raw);

  const missing = Object.entries(routineProfileSchema.shape)
    .filter(([key]) => clean[key] === undefined)
    .map(([key]) => key);

  if (missing.length > 0) {
    return buildMissingProfileResponse(missing);
  }

  const parsedIntent = routineProfileSchema.safeParse(clean);
  if (!parsedIntent.success) {
    return buildInvalidProfileResponse(parsedIntent.error);
  }

  return { state: 'profile_ready', profile: parsedIntent.data };
}

function coerceNumericFields(raw: Record<string, unknown>): Record<string, unknown> {
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
  return clean;
}

function buildMissingProfileResponse(missing: string[]): unknown {
  const labels: Record<string, string> = {
    age: `tu **edad** (${AGE_MIN}-${AGE_MAX} años)`,
    weightKg: `tu **peso** (${WEIGHT_MIN}-${WEIGHT_MAX} kg)`,
    goal: 'tu **objetivo** (fuerza/cardio/perder grasa/general)',
    level: 'tu **nivel** (principiante/intermedio/avanzado)',
    daysPerWeek: `los **días** que entrenas (${DAYS_MIN}-${DAYS_MAX})`,
  };
  const list = missing.map((key) => labels[key] ?? key).join(', ');
  return {
    state: 'collecting_requirements',
    missing,
    message: `¡Genial! Solo dime ${list} y terminamos.\n\nEjemplo: *"25 años, 70kg, fuerza, intermedio, 3 días"*`,
  };
}

function buildInvalidProfileResponse(error: { issues: Array<{ path: (string | number)[] }> }): unknown {
  const fieldLabels: Record<string, string> = {
    age: `la edad (tiene que ser entre ${AGE_MIN} y ${AGE_MAX})`,
    weightKg: `el peso (entre ${WEIGHT_MIN} y ${WEIGHT_MAX} kg)`,
    goal: 'el objetivo (fuerza/cardio/perder grasa/general)',
    level: 'el nivel (principiante/intermedio/avanzado)',
    daysPerWeek: `los días (de ${DAYS_MIN} a ${DAYS_MAX})`,
  };
  const issues = error.issues.map((issue) => fieldLabels[issue.path[0] as string] ?? issue.path[0]).join(', ');
  return {
    state: 'collecting_requirements',
    missing: error.issues.map((issue) => String(issue.path[0])),
    message: `Casi casi 🙌 Revisa ${issues}. Por ejemplo: *"25 años, 70kg, fuerza, intermedio, 3 días"*`,
  };
}
