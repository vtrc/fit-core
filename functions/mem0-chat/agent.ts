import { generateText } from 'npm:ai';
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible';
import { createClient } from 'npm:@insforge/sdk';
import { loadUserProfile, saveUserProfile } from './mem0.ts';
import { routineProfileSchema } from './schemas.ts';
import type { Profile } from './schemas.ts';

const mmKey = Deno.env.get('MINIMAX_API_KEY') ?? '';
const URL_BASE = Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app';

const minimax = createOpenAICompatible({
  name: 'minimax',
  apiKey: mmKey,
  baseURL: 'https://api.minimax.io/v1',
});

type ClassifyResult = {
  intent: 'chat' | 'routine';
  response?: string;
  profile?: Partial<Profile>;
};

const LABELS: Record<string, string> = {
  age: 'edad (14-99 años)',
  weightKg: 'peso (40-120 kg)',
  goal: 'objetivo (fuerza/cardio/perder grasa/general)',
  level: 'nivel (principiante/intermedio/avanzado)',
  daysPerWeek: 'días (1-7)',
};

export async function classifyIntent(
  message: string,
  existingProfile: Profile | null,
  profileDraft: Partial<Profile> | null = null,
): Promise<ClassifyResult> {
  const existingBlock = [
    existingProfile ? `Perfil completo ya guardado: ${JSON.stringify(existingProfile)}` : '',
    profileDraft ? `Datos parciales recogidos anteriormente: ${JSON.stringify(profileDraft)}` : '',
  ].filter(Boolean).length > 0
    ? `\n${[
      existingProfile ? `Perfil completo ya guardado: ${JSON.stringify(existingProfile)}` : '',
      profileDraft ? `Datos parciales recogidos anteriormente: ${JSON.stringify(profileDraft)}` : '',
    ].filter(Boolean).join('\n')}\nUsa estos datos para completar lo que falta, salvo que el mensaje actual los cambie.\n`
    : '';

  const prompt = `Eres un entrenador personal. Responde SOLO JSON sin explicaciones.

${existingBlock}
Mensaje actual: "${message}"

Determina qué quiere el usuario:

ROUTINE — si está dando datos personales o quiere crear una rutina.
  Extrae del mensaje los campos que aparezcan. Convierte números escritos en español: "cuarenta"=40, "setenta y cinco"=75, "dos"=2. Convierte "perder grasa" a fat_loss, "fuerza" a strength, "resistencia/cardio" a cardio y "mantenerse en forma" a general.
  age (14-99), weightKg (40-120), goal (strength|cardio|fat_loss|general), level (beginner|intermediate|advanced), daysPerWeek (1-7).
  Si ya hay perfil o datos parciales guardados y el usuario no los contradice, úsalos para completar los campos faltantes.
  No inventes datos.
  → {"intent":"routine","profile":{"age":40,"weightKg":75,"goal":"fat_loss","level":"intermediate","daysPerWeek":3}}

CHAT — si es saludo, consejo, motivación o cualquier otra cosa no relacionada con rutinas:
  → {"intent":"chat","response":"mensaje en español"}

REGLAS:
- Si el usuario saluda o pregunta algo que no sea crear rutinas → CHAT
 - Si da datos personales aunque sean parciales → ROUTINE con los campos que aparezcan
 - Si el mensaje completa datos parciales anteriores, → ROUTINE
- Si ya hay perfil guardado y el usuario dice "crea una rutina" → ROUTINE incluyendo el perfil existente
- Si el usuario solo dice "sí" o "vale" sin datos nuevos → ROUTINE con perfil existente (si lo hay) o CHAT si no hay perfil`;

  const { text } = await generateText({
    model: minimax('MiniMax-M2.7'),
    system: 'Responde SOLO JSON sin explicaciones.',
    prompt,
  });

  return parseFirstJsonObject(text) as ClassifyResult;
}

export async function extractProfile(
  userId: string,
  token: string,
  anonKey: string,
  partial: Partial<Profile>,
): Promise<Profile> {
  const client = createClient({ baseUrl: URL_BASE, anonKey });
  client.setAccessToken(token);
  const existing = await loadUserProfile(userId, client) ?? {} as Profile;
  const merged = { ...existing, ...partial };
  const parsed = routineProfileSchema.safeParse(merged);
  if (!parsed.success) {
    const missing = Object.entries(routineProfileSchema.shape)
      .filter(([key]) => merged[key as keyof Profile] === undefined)
      .map(([key]) => key);
    if (missing.length === 0) throw new InvalidProfileError(parsed.error.issues);
    throw new MissingProfileError(missing);
  }
  await saveUserProfile(userId, parsed.data, client);
  return parsed.data;
}

export class MissingProfileError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Faltan datos: ${missing.join(', ')}`);
    this.missing = missing;
  }
}

export class InvalidProfileError extends Error {
  issues: Array<{ path: Array<string | number> }>;
  constructor(issues: Array<{ path: Array<string | number> }>) {
    super('Los datos del perfil no son válidos.');
    this.issues = issues;
  }
}

export function buildMissingMessage(missing: string[]): string {
  const list = missing.map((k) => LABELS[k] ?? k).join(', ');
  return `Para crear tu rutina necesito ${list}.\n\nEjemplo: *"25 años, 70kg, fuerza, intermedio, 3 días"*`;
}

export function buildInvalidProfileMessage(issues: Array<{ path: Array<string | number> }>): string {
  const labels: Record<string, string> = {
    age: 'la edad (14-99 años)',
    weightKg: 'el peso (40-120 kg)',
    goal: 'el objetivo',
    level: 'el nivel',
    daysPerWeek: 'los días (1-7)',
  };
  const fields = [...new Set(issues.map(issue => labels[String(issue.path[0])] ?? String(issue.path[0])))];
  return `Revisa ${fields.join(', ')}. Ejemplo: *"40 años, 75 kilos, perder grasa, intermedio, 2 días"*`;
}

function parseFirstJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '').trim();
  let start = cleaned.indexOf('{');
  while (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < cleaned.length; index++) {
      const character = cleaned[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth++;
      else if (character === '}') {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(cleaned.slice(start, index + 1));
            if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
          } catch {
            break;
          }
        }
      }
    }
    start = cleaned.indexOf('{', start + 1);
  }
  throw new Error(`MiniMax returned invalid JSON: ${text}`);
}
