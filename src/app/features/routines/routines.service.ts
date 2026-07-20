import { Injectable, inject } from '@angular/core';
import { from, Observable, switchMap, map } from 'rxjs';

import type { Exercise, ExerciseType, Routine, RoutineExercise } from '../../core/domain/models';
import { AuthService } from '../../core/auth/auth.service';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface RoutineExerciseInput {
  exerciseId: string;
  exerciseType: ExerciseType;
  supportedMetrics: string[];
  plannedSets: number | null;
  plannedRepetitions: number | null;
  plannedWeight: number | null;
  plannedDurationSeconds: number | null;
  plannedDistance: number | null;
  restSeconds: number | null;
  notes?: string | null;
}

export interface CreateRoutineInput {
  name: string;
  description?: string | null;
  exercises: RoutineExerciseInput[];
}

export type UpdateRoutineInput = CreateRoutineInput;

export interface RoutineExerciseDetail extends RoutineExercise {
  exercise: Exercise;
}

export interface RoutineDetail extends Routine {
  exercises: RoutineExerciseDetail[];
}

interface RoutineRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
}

interface RoutineExerciseRow {
  id: string;
  user_id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  planned_sets: number | null;
  planned_repetitions: number | null;
  planned_weight: number | null;
  planned_duration_seconds: number | null;
  planned_distance: number | null;
  rest_seconds: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercise: ExerciseRow[] | null;
}

interface RoutineExerciseMutationRow {
  id: string;
  user_id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  planned_sets: number | null;
  planned_repetitions: number | null;
  planned_weight: number | null;
  planned_duration_seconds: number | null;
  planned_distance: number | null;
  rest_seconds: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RoutineExerciseInsertRow {
  user_id: string;
  routine_id: string;
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

interface ExerciseRow {
  id: string;
  name: string;
  type: ExerciseType;
  equipment: string | null;
  image_url: string | null;
  muscle_groups: string[] | null;
  supported_metrics: string[] | null;
  created_at: string;
  updated_at: string;
}

interface RoutineExerciseRestoreRow extends RoutineExerciseInsertRow {
  id: string;
}

type RoutineMetricKey =
  | 'sets'
  | 'repetitions'
  | 'weight'
  | 'duration'
  | 'distance'
  | 'speed'
  | 'incline'
  | 'resistance'
  | 'calories';

const STRENGTH_METRICS = new Set<RoutineMetricKey>(['sets', 'repetitions', 'weight', 'duration']);
const CARDIO_METRICS = new Set<RoutineMetricKey>(['duration', 'distance', 'speed', 'incline', 'resistance', 'calories']);
const METRIC_ALIASES = new Map<string, RoutineMetricKey>([
  ['set', 'sets'],
  ['sets', 'sets'],
  ['setscompleted', 'sets'],
  ['rep', 'repetitions'],
  ['reps', 'repetitions'],
  ['repetition', 'repetitions'],
  ['repetitions', 'repetitions'],
  ['repetitionstotal', 'repetitions'],
  ['weight', 'weight'],
  ['duration', 'duration'],
  ['durationseconds', 'duration'],
  ['distance', 'distance'],
  ['speed', 'speed'],
  ['incline', 'incline'],
  ['resistance', 'resistance'],
  ['calories', 'calories'],
]);

function normalizeMetricKey(metric: string): RoutineMetricKey | null {
  return METRIC_ALIASES.get(metric.trim().replace(/[\s_-]/g, '').toLowerCase()) ?? null;
}

export function validateRoutineInput(input: CreateRoutineInput): string[] {
  const errors: string[] = [];
  const name = input.name.trim();

  if (name.length === 0) {
    errors.push('El nombre de la rutina es requerido.');
  }

  if (input.exercises.length === 0) {
    errors.push('Añade al menos un ejercicio antes de guardar.');
  }

  input.exercises.forEach((exercise, index) => {
    const label = `Ejercicio ${index + 1}`;
    const normalizedMetrics = new Set<RoutineMetricKey>();
    const unknownMetrics: string[] = [];

    for (const metric of exercise.supportedMetrics ?? []) {
      const normalizedMetric = normalizeMetricKey(metric);

      if (normalizedMetric) {
        normalizedMetrics.add(normalizedMetric);
      } else {
        unknownMetrics.push(metric);
      }
    }

    if (!exercise.exerciseId) {
      errors.push(`${label} no tiene referencia de ejercicio.`);
    }

    if (unknownMetrics.length > 0) {
      errors.push(`${label} tiene metadatos de métricas no soportados: ${unknownMetrics.join(', ')}.`);
    }

    if (exercise.exerciseType !== 'strength' && exercise.exerciseType !== 'cardio') {
      errors.push(`${label} tiene un tipo de ejercicio no soportado.`);
      return;
    }

    const allowedMetrics = exercise.exerciseType === 'strength' ? STRENGTH_METRICS : CARDIO_METRICS;
    const crossTipoMetrics = [...normalizedMetrics].filter((metric) => !allowedMetrics.has(metric));

    if (crossTipoMetrics.length > 0) {
      errors.push(`${label} tiene metadatos de ${exercise.exerciseType} mezclados con métricas de ${crossTipoMetrics.join(', ')}.`);
    }

    for (const [field, value, integerOnly] of [
      ['series planificadas', exercise.plannedSets, true],
      ['repeticiones planificadas', exercise.plannedRepetitions, true],
      ['peso planificado', exercise.plannedWeight, false],
      ['duración planificada', exercise.plannedDurationSeconds, true],
      ['distancia planificada', exercise.plannedDistance, false],
      ['segundos de descanso', exercise.restSeconds, true],
    ] as const) {
      if (value === null) {
        continue;
      }

      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${label} tiene un valor de ${field} no válido.`);
        continue;
      }

      if (integerOnly && !Number.isInteger(value)) {
        errors.push(`${label} requiere que ${field} sea un número entero.`);
      }
    }

    if (exercise.exerciseType === 'strength') {
      if (exercise.plannedDistance !== null) {
        errors.push(`${label} es un ejercicio de fuerza y no puede usar objetivos de distancia.`);
      }

      if (
        exercise.plannedSets === null &&
        exercise.plannedRepetitions === null &&
        exercise.plannedWeight === null &&
        exercise.plannedDurationSeconds === null &&
        exercise.restSeconds === null
      ) {
        errors.push(`${label} necesita al menos un objetivo de fuerza válido.`);
      }
    }

    if (exercise.exerciseType === 'cardio') {
      const plannedDuration = exercise.plannedDurationSeconds ?? null;
      const plannedDistance = exercise.plannedDistance ?? null;
      const canUseDuration = normalizedMetrics.size === 0 || normalizedMetrics.has('duration');
      const canUseDistance = normalizedMetrics.size === 0 || normalizedMetrics.has('distance');

      if (
        exercise.plannedSets !== null ||
        exercise.plannedRepetitions !== null ||
        exercise.plannedWeight !== null ||
        exercise.restSeconds !== null
      ) {
        errors.push(`${label} es un ejercicio de cardio y no puede usar objetivos de fuerza.`);
      }

      if ((plannedDuration === null || !canUseDuration) && (plannedDistance === null || !canUseDistance)) {
        errors.push(`${label} necesita al menos un objetivo de cardio válido.`);
      }
    }
  });

  return errors;
}

@Injectable({ providedIn: 'root' })
export class RoutinesService {
  private readonly auth = inject(AuthService);
  private readonly insforge = inject(InsforgeClientService);

  listMine(): Observable<Routine[]> {
    return from(
      this.insforge.client.database
        .from('routines')
        .select('id, user_id, name, description, position, created_at, updated_at')
        .order('position', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false }),
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }

        return (data ?? []).map((row) => this.mapRoutine(row as RoutineRow));
      }),
    );
  }

  getDetail(id: string): Observable<RoutineDetail> {
    return from(
      this.insforge.client.database
        .from('routines')
        .select('id, user_id, name, description, position, created_at, updated_at')
        .eq('id', id)
        .single(),
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) {
          throw error;
        }

        return from(
          this.insforge.client.database
            .from('routine_exercises')
            .select(
              'id, user_id, routine_id, exercise_id, position, planned_sets, planned_repetitions, planned_weight, planned_duration_seconds, planned_distance, rest_seconds, notes, created_at, updated_at, exercise:exercises(id, name, type, equipment, image_url, muscle_groups, supported_metrics, created_at, updated_at)',
            )
            .eq('routine_id', id)
            .order('position', { ascending: true }),
        ).pipe(
          map(({ data: exerciseData, error: exerciseError }) => {
            if (exerciseError) {
              throw exerciseError;
            }

            return {
              ...this.mapRoutine(data as RoutineRow),
              exercises: (exerciseData ?? []).map((row) => this.mapRoutineExercise(row as RoutineExerciseRow)),
            };
          }),
        );
      }),
    );
  }

  create(input: CreateRoutineInput): Observable<Routine> {
    return from(this.requireUserId()).pipe(
      switchMap((userId) => from(this.createRoutine(userId, input))),
    );
  }

  update(id: string, input: UpdateRoutineInput): Observable<Routine> {
    return from(this.requireUserId()).pipe(
      switchMap((userId) => from(this.updateRoutine(userId, id, input))),
    );
  }

  delete(id: string): Observable<void> {
    return from(this.requireUserId()).pipe(
      switchMap((userId) =>
        from(
          this.insforge.client.database.from('routines').delete().eq('id', id).eq('user_id', userId).select('id'),
        ).pipe(
          map(({ error }) => {
            if (error) {
              throw error;
            }
          }),
        ),
      ),
    );
  }

  updatePositions(items: { id: string; position: number }[]): Observable<void> {
    return from(this.requireUserId()).pipe(
      switchMap((userId) =>
        from(
          (async () => {
            for (const item of items) {
              const { error } = await this.insforge.client.database
                .from('routines')
                .update({ position: item.position })
                .eq('id', item.id)
                .eq('user_id', userId);

              if (error) {
                throw error;
              }
            }
          })(),
        ),
      ),
    );
  }

  private async requireUserId(): Promise<string> {
    if (this.auth.loading()) {
      await this.auth.restoreSession();
    }

    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Your session expired. Sign in again before managing routines.');
    }

    return userId;
  }

  private async createRoutine(userId: string, input: CreateRoutineInput): Promise<Routine> {
    this.assertValidInput(input);

    const maxPosResult = await this.insforge.client.database
      .from('routines')
      .select('position')
      .eq('user_id', userId)
      .order('position', { ascending: false, nullsFirst: false })
      .limit(1);

    const maxPosition = (maxPosResult.data?.[0]?.position as number | null) ?? -1;
    const nextPosition = maxPosition + 1;

    const { data, error } = await this.insforge.client.database
      .from('routines')
      .insert([
        {
          user_id: userId,
          name: input.name.trim(),
          description: this.normalizeText(input.description),
          position: nextPosition,
        },
      ])
      .select('id, user_id, name, description, position, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    const routine = this.mapRoutine(data as RoutineRow);

    try {
      await this.replaceRoutineExercises(userId, routine.id, input.exercises);
    } catch (error) {
      await this.insforge.client.database.from('routines').delete().eq('id', routine.id).eq('user_id', userId);
      throw error;
    }

    return routine;
  }

  private async updateRoutine(userId: string, id: string, input: UpdateRoutineInput): Promise<Routine> {
    this.assertValidInput(input);
    const originalRoutine = await this.loadRoutineRow(userId, id);

    const { data, error } = await this.insforge.client.database
      .from('routines')
      .update({
        name: input.name.trim(),
        description: this.normalizeText(input.description),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, user_id, name, description, position, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    try {
      await this.replaceRoutineExercises(userId, id, input.exercises);
    } catch (replaceError) {
      const restoreError = await this.restoreRoutineParent(userId, id, originalRoutine);
      const replaceMessage = this.formatDatabaseError(replaceError);

      if (restoreError) {
        throw new Error(
          `Failed to replace routine exercises after routine details were updated, and restoring the original routine details also failed. Routine "${id}" may need manual repair. Replacement error: ${replaceMessage} Restore error: ${this.formatDatabaseError(restoreError)}`,
        );
      }

      throw new Error(`Failed to replace routine exercises. Original routine name and description were restored. ${replaceMessage}`);
    }

    return this.mapRoutine(data as RoutineRow);
  }

  private async replaceRoutineExercises(userId: string, routineId: string, exercises: RoutineExerciseInput[]): Promise<void> {
    const currentRows = await this.loadRoutineExerciseRows(userId, routineId);
    const positionOffset =
      currentRows.length > 0 ? Math.max(...currentRows.map((row) => row.position)) + exercises.length + 1 : 0;
    const payload = this.buildRoutineExercisePayload(userId, routineId, exercises, positionOffset);

    const insertResult = await this.insforge.client.database
      .from('routine_exercises')
      .insert(payload)
      .select(
        'id, user_id, routine_id, exercise_id, position, planned_sets, planned_repetitions, planned_weight, planned_duration_seconds, planned_distance, rest_seconds, notes, created_at, updated_at',
      );

    if (insertResult.error) {
      throw new Error(
        `Failed to replace routine exercises. Original records were preserved (${this.describeRoutineExerciseRows(currentRows)}). ${this.formatDatabaseError(insertResult.error)}`,
      );
    }

    const insertedRows = (insertResult.data ?? []) as RoutineExerciseMutationRow[];
    const insertedIds = insertedRows.map((row) => row.id);

    if (currentRows.length > 0) {
      const deleteResult = await this.insforge.client.database
        .from('routine_exercises')
        .delete()
        .in('id', currentRows.map((row) => row.id))
        .eq('routine_id', routineId)
        .eq('user_id', userId)
        .select('id');

      if (deleteResult.error) {
        const cleanupMessage = await this.cleanupInsertedRoutineExercises(userId, routineId, insertedIds);
        const rollbackSuffix = cleanupMessage ? ` Cleanup warning: ${cleanupMessage}` : '';
        throw new Error(
          `Failed to replace routine exercises. Original records were preserved (${this.describeRoutineExerciseRows(currentRows)}). ${this.formatDatabaseError(deleteResult.error)}${rollbackSuffix}`,
        );
      }
    }

    const reorderError = await this.reorderRoutineExercises(userId, routineId, insertedRows);
    if (reorderError) {
      const rollbackMessage = await this.rollbackRoutineExerciseReplacement(userId, routineId, insertedIds, currentRows);

      if (!rollbackMessage) {
        throw new Error(
          `Failed to replace routine exercises because reordering failed. Replacement rows were removed and original records were restored (${this.describeRoutineExerciseRows(currentRows)}). ${this.formatDatabaseError(reorderError)}`,
        );
      }

      throw new Error(
        `Failed to replace routine exercises because reordering failed, and rollback was incomplete. Manual repair may be required. Original records before replacement: ${this.describeRoutineExerciseRows(currentRows)}. Reorder error: ${this.formatDatabaseError(reorderError)} Rollback error: ${rollbackMessage}`,
      );
    }
  }

  private async loadRoutineRow(userId: string, id: string): Promise<RoutineRow> {
    const { data, error } = await this.insforge.client.database
      .from('routines')
      .select('id, user_id, name, description, position, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data as RoutineRow;
  }

  private async loadRoutineExerciseRows(userId: string, routineId: string): Promise<RoutineExerciseMutationRow[]> {
    const { data, error } = await this.insforge.client.database
      .from('routine_exercises')
      .select(
        'id, user_id, routine_id, exercise_id, position, planned_sets, planned_repetitions, planned_weight, planned_duration_seconds, planned_distance, rest_seconds, notes, created_at, updated_at',
      )
      .eq('routine_id', routineId)
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as RoutineExerciseMutationRow[];
  }

  private buildRoutineExercisePayload(
    userId: string,
    routineId: string,
    exercises: RoutineExerciseInput[],
    positionOffset = 0,
  ): RoutineExerciseInsertRow[] {
    return exercises.map((exercise, index) => {
      const sanitizedExercise = this.sanitizeRoutineExerciseInput(exercise);

      return {
        user_id: userId,
        routine_id: routineId,
        exercise_id: sanitizedExercise.exerciseId,
        position: positionOffset + index,
        planned_sets: sanitizedExercise.plannedSets,
        planned_repetitions: sanitizedExercise.plannedRepetitions,
        planned_weight: sanitizedExercise.plannedWeight,
        planned_duration_seconds: sanitizedExercise.plannedDurationSeconds,
        planned_distance: sanitizedExercise.plannedDistance,
        rest_seconds: sanitizedExercise.restSeconds,
        notes: this.normalizeText(sanitizedExercise.notes),
      };
    });
  }

  private sanitizeRoutineExerciseInput(exercise: RoutineExerciseInput): RoutineExerciseInput {
    if (exercise.exerciseType === 'strength') {
      return {
        ...exercise,
        plannedDurationSeconds: null,
        plannedDistance: null,
      };
    }

    if (exercise.exerciseType === 'cardio') {
      return {
        ...exercise,
        plannedSets: null,
        plannedRepetitions: null,
        plannedWeight: null,
        restSeconds: null,
      };
    }

    return exercise;
  }

  private async cleanupInsertedRoutineExercises(userId: string, routineId: string, insertedIds: string[]): Promise<string | null> {
    if (insertedIds.length === 0) {
      return null;
    }

    const { error } = await this.insforge.client.database
      .from('routine_exercises')
      .delete()
      .in('id', insertedIds)
      .eq('routine_id', routineId)
      .eq('user_id', userId)
      .select('id');

    return error ? this.formatDatabaseError(error) : null;
  }

  private async restoreRoutineParent(userId: string, id: string, originalRoutine: RoutineRow): Promise<unknown | null> {
    const { error } = await this.insforge.client.database
      .from('routines')
      .update({
        name: originalRoutine.name,
        description: originalRoutine.description,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    return error ?? null;
  }

  private async rollbackRoutineExerciseReplacement(
    userId: string,
    routineId: string,
    insertedIds: string[],
    originalRows: RoutineExerciseMutationRow[],
  ): Promise<string | null> {
    const cleanupMessage = await this.cleanupInsertedRoutineExercises(userId, routineId, insertedIds);

    if (cleanupMessage) {
      return `Inserted replacement cleanup failed: ${cleanupMessage}`;
    }

    return this.restoreRoutineExerciseRows(originalRows);
  }

  private async restoreRoutineExerciseRows(originalRows: RoutineExerciseMutationRow[]): Promise<string | null> {
    if (originalRows.length === 0) {
      return null;
    }

    const restorePayload: RoutineExerciseRestoreRow[] = originalRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      routine_id: row.routine_id,
      exercise_id: row.exercise_id,
      position: row.position,
      planned_sets: row.planned_sets,
      planned_repetitions: row.planned_repetitions,
      planned_weight: row.planned_weight,
      planned_duration_seconds: row.planned_duration_seconds,
      planned_distance: row.planned_distance,
      rest_seconds: row.rest_seconds,
      notes: row.notes,
    }));

    const { error } = await this.insforge.client.database.from('routine_exercises').insert(restorePayload).select('id');

    return error ? this.formatDatabaseError(error) : null;
  }

  private async reorderRoutineExercises(
    userId: string,
    routineId: string,
    insertedRows: RoutineExerciseMutationRow[],
  ): Promise<unknown | null> {
    for (const [index, row] of insertedRows.entries()) {
      const { error } = await this.insforge.client.database
        .from('routine_exercises')
        .update({ position: index })
        .eq('id', row.id)
        .eq('routine_id', routineId)
        .eq('user_id', userId)
        .select('id')
        .single();

      if (error) {
        return error;
      }
    }

    return null;
  }

  private describeRoutineExerciseRows(rows: RoutineExerciseMutationRow[]): string {
    if (rows.length === 0) {
      return 'no prior exercise rows';
    }

    return `count=${rows.length}; ids=${rows.map((row) => row.id).join(', ')}`;
  }

  private formatDatabaseError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown database error.';
  }

  private assertValidInput(input: CreateRoutineInput): void {
    const errors = validateRoutineInput(input);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
  }

  private normalizeText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private mapRoutine(row: RoutineRow): Routine {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRoutineExercise(row: RoutineExerciseRow): RoutineExerciseDetail {
    const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise ?? null;

    if (!exercise) {
      throw new Error('Routine exercise is missing its catalog exercise.');
    }

    return {
      id: row.id,
      userId: row.user_id,
      routineId: row.routine_id,
      exerciseId: row.exercise_id,
      position: row.position,
      plannedSets: row.planned_sets,
      plannedRepetitions: row.planned_repetitions,
      plannedWeight: row.planned_weight,
      plannedDurationSeconds: row.planned_duration_seconds,
      plannedDistance: row.planned_distance,
      restSeconds: row.rest_seconds,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      exercise: {
        id: exercise.id,
        name: exercise.name,
        type: exercise.type,
        equipment: exercise.equipment,
        imageUrl: exercise.image_url,
        muscleGroups: exercise.muscle_groups ?? [],
        supportedMetrics: exercise.supported_metrics ?? [],
        createdAt: exercise.created_at,
        updatedAt: exercise.updated_at,
      },
    };
  }
}
