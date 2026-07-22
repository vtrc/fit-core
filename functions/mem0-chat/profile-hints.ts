export type ProfileHints = {
  age?: number;
  weightKg?: number;
  goal?: 'strength' | 'cardio' | 'fat_loss' | 'general';
  level?: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek?: number;
};

const NUMBER_WORDS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

export function extractProfileHints(message: string): ProfileHints {
  const text = normalize(message);
  const hints: ProfileHints = {};

  const age = findNumberBefore(text, /anos?/);
  if (age !== undefined) hints.age = age;

  const weight = findNumberBefore(text, /(?:kilos?|kg)/);
  if (weight !== undefined) hints.weightKg = weight;

  const days = findNumberBefore(text, /dias?/);
  if (days !== undefined) hints.daysPerWeek = days;

  if (/(?:perder|perdida|bajar|reducir) grasa|adelgazar/.test(text)) hints.goal = 'fat_loss';
  else if (/fuerza|musculo|muscular/.test(text)) hints.goal = 'strength';
  else if (/cardio|resistencia|resistir/.test(text)) hints.goal = 'cardio';
  else if (/mantener|general|forma/.test(text)) hints.goal = 'general';

  if (/principiante|inicial|basico/.test(text)) hints.level = 'beginner';
  else if (/intermedio|media/.test(text)) hints.level = 'intermediate';
  else if (/avanzado|experto/.test(text)) hints.level = 'advanced';

  return hints;
}

function findNumberBefore(text: string, unit: RegExp): number | undefined {
  const match = text.match(new RegExp(`(\\d+(?:[.,]\\d+)?|[a-z]+(?:\\s+y\\s+[a-z]+)?)\\s+${unit.source}`));
  if (!match) return undefined;
  return parseSpanishNumber(match[1]);
}

function parseSpanishNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);

  const parts = normalized.split(/\s+y\s+/);
  let total = 0;
  for (const part of parts) {
    const number = NUMBER_WORDS[part];
    if (number === undefined) return undefined;
    total += number;
  }
  return total;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
