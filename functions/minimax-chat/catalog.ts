import { createClient } from 'npm:@insforge/sdk';
import type { CatalogEntry } from './schemas.ts';

interface ExerciseDetail {
  exercise_id: string;
  position: number;
  planned_sets: number | null;
  planned_repetitions: number | null;
  planned_weight: number | null;
  planned_duration_seconds: number | null;
  planned_distance: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

interface ProfileShape {
  goal: string;
  level: string;
  weightKg: number;
}

export async function loadCatalog(token: string, anonKey: string): Promise<{ entries: CatalogEntry[]; nameToEntry: Map<string, CatalogEntry>; idToEntry: Map<string, CatalogEntry> }> {
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

export function fillExerciseDetails(exercise: CatalogEntry, profile: ProfileShape, position: number): ExerciseDetail {
  const base = { exercise_id: exercise.id, position, notes: null };

  if (exercise.type === 'cardio') {
    return {
      ...base,
      planned_sets: null,
      planned_repetitions: null,
      planned_weight: null,
      planned_duration_seconds: profile.level === 'beginner' ? 600 : profile.level === 'intermediate' ? 900 : 1200,
      planned_distance: null,
      rest_seconds: null,
    };
  }

  const isCompound = (exercise.muscle_groups?.length ?? 0) >= 2;
  const levelMultiplier = profile.level === 'beginner' ? 0.5 : profile.level === 'intermediate' ? 0.7 : 0.9;
  const bodyweightRatio = isCompound ? levelMultiplier : levelMultiplier * 0.35;
  const rawWeight = profile.weightKg * bodyweightRatio;
  const suggestedWeight = exercise.equipment ? Math.round(rawWeight) : null;

  const setsReps = getGoalSetsAndReps(profile);
  return {
    ...base,
    planned_sets: setsReps.sets,
    planned_repetitions: setsReps.reps,
    planned_weight: suggestedWeight,
    planned_duration_seconds: null,
    planned_distance: null,
    rest_seconds: setsReps.rest,
  };
}

function getGoalSetsAndReps(profile: ProfileShape): { sets: number; reps: number; rest: number } {
  if (profile.goal === 'strength') {
    return {
      sets: 4,
      reps: profile.level === 'beginner' ? 8 : profile.level === 'intermediate' ? 6 : 5,
      rest: 90,
    };
  }
  if (profile.goal === 'fat_loss') {
    return {
      sets: 3,
      reps: profile.level === 'beginner' ? 12 : 15,
      rest: 45,
    };
  }
  return {
    sets: 3,
    reps: profile.level === 'beginner' ? 10 : 12,
    rest: 60,
  };
}
