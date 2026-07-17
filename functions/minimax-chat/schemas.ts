import { z } from 'npm:zod';
import { AGE_MIN, AGE_MAX, WEIGHT_MIN, WEIGHT_MAX, DAYS_MIN, DAYS_MAX } from './constants.ts';

export interface ApprovedRoutine {
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

export const routineProfileSchema = z.object({
  age: z.number().int().min(AGE_MIN).max(AGE_MAX),
  weightKg: z.number().min(WEIGHT_MIN).max(WEIGHT_MAX),
  goal: z.enum(['strength', 'cardio', 'fat_loss', 'general']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().int().min(DAYS_MIN).max(DAYS_MAX),
});

export const partialProfileSchema = routineProfileSchema.partial();

export const routineProposalSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  exercises: z.array(z.object({
    exercise_id: z.string().uuid(), exercise_name: z.string().optional(), position: z.number().int().nonnegative(),
    planned_sets: z.number().int().positive().nullable(), planned_repetitions: z.number().int().positive().nullable(),
    planned_weight: z.number().nonnegative().nullable(), planned_duration_seconds: z.number().int().positive().nullable(),
    planned_distance: z.number().positive().nullable(), rest_seconds: z.number().int().nonnegative().nullable(), notes: z.string().nullable(),
  })).min(1),
});

export type CatalogEntry = { id: string; name: string; type: string; equipment: string | null; muscle_groups: string[] };
