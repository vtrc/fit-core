import { Injectable, computed, inject, signal } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';

import type {
  CardioExerciseResult,
  Exercise,
  ExerciseResult,
  ExerciseType,
  StrengthExerciseResult,
  Workout,
  WorkoutResult,
} from '../../core/domain/models';
import { AuthService } from '../../core/auth/auth.service';
import { InsforgeClientService } from '../../core/insforge/insforge-client';
import type { RoutineDetail, RoutineExerciseDetail } from '../routines/routines.service';

export interface PlanificadosWorkoutExerciseSnapshot {
  exercise: Exercise;
  routineExerciseId: string | null;
  position: number;
  plannedSets: number | null;
  plannedRepetitions: number | null;
  plannedWeight: number | null;
  plannedDurationSeconds: number | null;
  plannedDistance: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface WorkoutSessionExercise extends PlanificadosWorkoutExerciseSnapshot {
  sessionExerciseId: string;
  skipped: boolean;
  result: ExerciseResult | null;
}

export interface WorkoutSessionDraft {
  id: string;
  routineId: string | null;
  routineName: string | null;
  startedAt: string;
  activeIndex: number;
  notes: string;
  exercises: WorkoutSessionExercise[];
  savedWorkout: Workout | null;
}

export interface SaveWorkoutSessionResult {
  workout: Workout;
  results: WorkoutResult[];
  summary: WorkoutSummaryModel;
}

export interface WorkoutSummaryModel {
  routineName: string;
  performedOn: string;
  plannedCount: number;
  completedCount: number;
  skippedCount: number;
  completionPercentage: number;
  durationSeconds: number | null;
}

interface WorkoutRow {
  id: string;
  user_id: string;
  routine_id: string | null;
  performed_on: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkoutResultRow {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  result: ExerciseResult;
  created_at: string;
  updated_at: string;
}

interface WorkoutResultInsertRow {
  user_id: string;
  workout_id: string;
  exercise_id: string;
  result: ExerciseResult;
}

type WorkoutMetricKey = 'sets' | 'repetitions' | 'weight' | 'duration' | 'distance' | 'speed';

const METRIC_ALIASES = new Map<string, WorkoutMetricKey>([
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
]);

function normalizeMetricKey(metric: string): WorkoutMetricKey | null {
  return METRIC_ALIASES.get(metric.trim().replace(/[\s_-]/g, '').toLowerCase()) ?? null;
}

export function validateExerciseResult(exerciseType: ExerciseType, result: ExerciseResult): string[] {
  const errors: string[] = [];

  if (exerciseType === 'strength') {
    if (result.kind !== 'strength') {
      return ['Strength exercises require a strength result.'];
    }

    for (const [label, value, integerOnly] of [
      ['sets completed', result.setsCompleted, true],
      ['total repetitions', result.repetitionsTotal, true],
      ['weight', result.weight, false],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`Enter a valid ${label} value.`);
      } else if (integerOnly && !Number.isInteger(value)) {
        errors.push(`${label} must be a whole number.`);
      }
    }

    if (result.setsCompleted <= 0 || result.repetitionsTotal <= 0) {
      errors.push('Strength results need at least one completed set and repetition.');
    }
  }

  if (exerciseType === 'cardio') {
    if (result.kind !== 'cardio') {
      return ['Cardio exercises require a cardio result.'];
    }

    if (!Number.isFinite(result.durationSeconds) || result.durationSeconds < 0 || !Number.isInteger(result.durationSeconds)) {
      errors.push('Enter a valid duration in seconds.');
    }

    if (!Number.isFinite(result.distance) || result.distance < 0) {
      errors.push('Enter a valid distance.');
    }

    if (result.durationSeconds <= 0 && result.distance <= 0) {
      errors.push('Cardio results need duration or distance completed.');
    }

    for (const [label, value] of [
      ['speed', result.speed],
      ['incline', result.incline],
      ['calories', result.calories],
      ['resistance', result.resistance],
    ] as const) {
      if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0)) {
        errors.push(`Enter a valid ${label} value.`);
      }
    }
  }

  return errors;
}

@Injectable({ providedIn: 'root' })
export class EntrenamientosService {
  private readonly auth = inject(AuthService);
  private readonly insforge = inject(InsforgeClientService);
  private savePromise: Promise<SaveWorkoutSessionResult> | null = null;

  private readonly sessionState = signal<WorkoutSessionDraft | null>(null);
  readonly session = this.sessionState.asReadonly();
  readonly activeExercise = computed(() => {
    const session = this.sessionState();
    return session?.exercises[session.activeIndex] ?? null;
  });
  readonly plannedCount = computed(() => this.sessionState()?.exercises.length ?? 0);
  readonly completedCount = computed(() => this.sessionState()?.exercises.filter((exercise) => exercise.result !== null).length ?? 0);
  readonly skippedCount = computed(() => this.sessionState()?.exercises.filter((exercise) => exercise.skipped && exercise.result === null).length ?? 0);
  readonly remainingCount = computed(
    () => this.sessionState()?.exercises.filter((exercise) => exercise.result === null && !exercise.skipped).length ?? 0,
  );
  readonly saving = signal(false);

  startFromRoutine(routine: RoutineDetail): WorkoutSessionDraft {
    if (this.saving()) {
      return this.sessionState() ?? this.createSession(null, null, []);
    }

    const draft = this.createSession(
      routine.id,
      routine.name,
      routine.exercises.map((exercise) => this.snapshotRoutineExercise(exercise)),
    );
    this.sessionState.set(draft);
    return draft;
  }

  startFreeWorkout(): WorkoutSessionDraft {
    if (this.saving()) {
      return this.sessionState() ?? this.createSession(null, null, []);
    }

    const draft = this.createSession(null, null, []);
    this.sessionState.set(draft);
    return draft;
  }

  clearSession(): void {
    if (this.saving()) {
      return;
    }

    this.savePromise = null;
    this.saving.set(false);
    this.sessionState.set(null);
  }

  updateNotes(notes: string): void {
    this.sessionState.update((session) => (session ? { ...session, notes } : session));
  }

  setActiveIndex(index: number): void {
    this.sessionState.update((session) => {
      if (!session || index < 0 || index >= session.exercises.length) {
        return session;
      }

      return { ...session, activeIndex: index };
    });
  }

  addExercise(exercise: Exercise): void {
    this.sessionState.update((session) => {
      const currentSession = session ?? this.createSession(null, null, []);
      const nextExercise: WorkoutSessionExercise = {
        sessionExerciseId: this.createLocalId(),
        routineExerciseId: null,
        position: currentSession.exercises.length,
        exercise,
        plannedSets: null,
        plannedRepetitions: null,
        plannedWeight: null,
        plannedDurationSeconds: null,
        plannedDistance: null,
        restSeconds: null,
        notes: null,
        skipped: false,
        result: null,
      };

      return {
        ...currentSession,
        activeIndex: currentSession.exercises.length,
        exercises: [...currentSession.exercises, nextExercise],
      };
    });
  }

  removeExercise(sessionExerciseId: string): void {
    this.sessionState.update((session) => {
      if (!session) {
        return session;
      }

      const targetIndex = session.exercises.findIndex((exercise) => exercise.sessionExerciseId === sessionExerciseId);
      if (targetIndex === -1) {
        return session;
      }

      const exercises = session.exercises
        .filter((exercise) => exercise.sessionExerciseId !== sessionExerciseId)
        .map((exercise, index) => ({ ...exercise, position: index }));
      const activeIndex = exercises.length === 0 ? 0 : Math.min(session.activeIndex > targetIndex ? session.activeIndex - 1 : session.activeIndex, exercises.length - 1);

      return { ...session, activeIndex, exercises };
    });
  }

  skipExercise(sessionExerciseId: string): void {
    this.sessionState.update((session) => {
      if (!session) {
        return session;
      }

      const targetIndex = session.exercises.findIndex((exercise) => exercise.sessionExerciseId === sessionExerciseId);
      if (targetIndex === -1) {
        return session;
      }

      const exercises = session.exercises.map((exercise) =>
        exercise.sessionExerciseId === sessionExerciseId ? { ...exercise, skipped: true, result: null } : exercise,
      );

      return { ...session, activeIndex: this.nextIndex(targetIndex, exercises.length), exercises };
    });
  }

  recordResult(sessionExerciseId: string, result: ExerciseResult): string[] {
    const session = this.sessionState();
    const targetIndex = session?.exercises.findIndex((exercise) => exercise.sessionExerciseId === sessionExerciseId) ?? -1;
    const target = targetIndex >= 0 ? session?.exercises[targetIndex] : null;

    if (!session || !target) {
      return ['No active workout exercise was found.'];
    }

    const errors = validateExerciseResult(target.exercise.type, result);
    if (errors.length > 0) {
      return errors;
    }

    this.sessionState.set({
      ...session,
      activeIndex: this.nextIndex(targetIndex, session.exercises.length),
      exercises: session.exercises.map((exercise) =>
        exercise.sessionExerciseId === sessionExerciseId ? { ...exercise, skipped: false, result: this.sanitizeResult(result) } : exercise,
      ),
    });

    return [];
  }

  saveSession(): Observable<SaveWorkoutSessionResult> {
    return from(this.getOrCreateSavePromise());
  }

  private getOrCreateSavePromise(): Promise<SaveWorkoutSessionResult> {
    const session = this.sessionState();
    if (!session) {
      return Promise.reject(new Error('Start a workout before saving.'));
    }

    if (session.savedWorkout) {
      return Promise.resolve({ workout: session.savedWorkout, results: [], summary: this.createSummary(session, session.savedWorkout) });
    }

    if (this.savePromise) {
      return this.savePromise;
    }

    this.savePromise = this.persistSession(session).finally(() => {
      this.savePromise = null;
    });

    return this.savePromise;
  }

  private async persistSession(session: WorkoutSessionDraft): Promise<SaveWorkoutSessionResult> {
    const completedExercises = session.exercises.filter((exercise) => exercise.result !== null);
    if (completedExercises.length === 0) {
      throw new Error('Complete at least one exercise before saving the workout.');
    }

    this.saving.set(true);

    try {
      const userId = await this.requireUserId();
      const completedAt = new Date().toISOString();
      const { data, error } = await this.insforge.client.database
        .from('workouts')
        .insert([
          {
            user_id: userId,
            routine_id: session.routineId,
            performed_on: completedAt.slice(0, 10),
            started_at: session.startedAt,
            completed_at: completedAt,
            notes: this.normalizeText(session.notes),
          },
        ])
        .select('id, user_id, routine_id, performed_on, started_at, completed_at, notes, created_at, updated_at')
        .single();

      if (error) {
        throw error;
      }

      const workout = this.mapWorkout(data as WorkoutRow);

      try {
        const results = await this.insertResults(userId, workout.id, completedExercises);
        this.sessionState.update((currentSession) => (currentSession?.id === session.id ? { ...currentSession, savedWorkout: workout } : currentSession));
        return { workout, results, summary: this.createSummary(session, workout) };
      } catch (resultsError) {
        await this.insforge.client.database.from('workouts').delete().eq('id', workout.id).eq('user_id', userId).select('id');
        throw resultsError;
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async insertResults(
    userId: string,
    workoutId: string,
    completedExercises: WorkoutSessionExercise[],
  ): Promise<WorkoutResult[]> {
    const payload: WorkoutResultInsertRow[] = completedExercises.map((exercise) => ({
      user_id: userId,
      workout_id: workoutId,
      exercise_id: exercise.exercise.id,
      result: exercise.result!,
    }));

    const { data, error } = await this.insforge.client.database
      .from('workout_results')
      .insert(payload)
      .select('id, user_id, workout_id, exercise_id, result, created_at, updated_at');

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => this.mapWorkoutResult(row as WorkoutResultRow));
  }

  private createSummary(session: WorkoutSessionDraft, workout: Workout): WorkoutSummaryModel {
    const plannedCount = session.exercises.length;
    const completedCount = session.exercises.filter((exercise) => exercise.result !== null).length;
    const skippedCount = session.exercises.filter((exercise) => exercise.skipped && exercise.result === null).length;
    const durationSeconds = session.startedAt && workout.completedAt
      ? Math.max(0, Math.round((new Date(workout.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000))
      : null;

    return {
      routineName: session.routineName ?? 'Entrenamiento libre',
      performedOn: workout.performedOn,
      plannedCount,
      completedCount,
      skippedCount,
      completionPercentage: plannedCount === 0 ? 0 : Math.round((completedCount / plannedCount) * 100),
      durationSeconds,
    };
  }

  private async requireUserId(): Promise<string> {
    if (this.auth.loading()) {
      await this.auth.restoreSession();
    }

    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Your session expired. Sign in again before saving workouts.');
    }

    return userId;
  }

  private createSession(
    routineId: string | null,
    routineName: string | null,
    exercises: PlanificadosWorkoutExerciseSnapshot[],
  ): WorkoutSessionDraft {
    return {
      id: this.createLocalId(),
      routineId,
      routineName,
      startedAt: new Date().toISOString(),
      activeIndex: 0,
      notes: '',
      exercises: exercises.map((exercise, index) => ({
        ...exercise,
        sessionExerciseId: this.createLocalId(),
        position: index,
        skipped: false,
        result: null,
      })),
      savedWorkout: null,
    };
  }

  private snapshotRoutineExercise(exercise: RoutineExerciseDetail): PlanificadosWorkoutExerciseSnapshot {
    return {
      routineExerciseId: exercise.id,
      position: exercise.position,
      exercise: { ...exercise.exercise, muscleGroups: [...exercise.exercise.muscleGroups], supportedMetrics: [...exercise.exercise.supportedMetrics] },
      plannedSets: exercise.plannedSets,
      plannedRepetitions: exercise.plannedRepetitions,
      plannedWeight: exercise.plannedWeight,
      plannedDurationSeconds: exercise.plannedDurationSeconds,
      plannedDistance: exercise.plannedDistance,
      restSeconds: exercise.restSeconds,
      notes: exercise.notes,
    };
  }

  private sanitizeResult(result: ExerciseResult): ExerciseResult {
    if (result.kind === 'strength') {
      return {
        kind: 'strength',
        setsCompleted: Math.trunc(result.setsCompleted),
        repetitionsTotal: Math.trunc(result.repetitionsTotal),
        weight: result.weight,
        notes: this.normalizeText(result.notes),
      } satisfies StrengthExerciseResult;
    }

    return {
      kind: 'cardio',
      durationSeconds: Math.trunc(result.durationSeconds),
      distance: result.distance,
      speed: this.nullableNumber(result.speed),
      incline: this.nullableNumber(result.incline),
      calories: this.nullableNumber(result.calories),
      resistance: this.nullableNumber(result.resistance),
      notes: this.normalizeText(result.notes),
    } satisfies CardioExerciseResult;
  }

  private nextIndex(currentIndex: number, total: number): number {
    if (total === 0) {
      return 0;
    }

    return Math.min(currentIndex + 1, total - 1);
  }

  private nullableNumber(value: number | null | undefined): number | null {
    return value === undefined ? null : value;
  }

  private normalizeText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private createLocalId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private mapWorkout(row: WorkoutRow): Workout {
    return {
      id: row.id,
      userId: row.user_id,
      routineId: row.routine_id,
      performedOn: row.performed_on,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapWorkoutResult(row: WorkoutResultRow): WorkoutResult {
    return {
      id: row.id,
      userId: row.user_id,
      workoutId: row.workout_id,
      exerciseId: row.exercise_id,
      result: row.result,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  supportsMetric(exercise: Exercise, metric: WorkoutMetricKey): boolean {
    const metrics = new Set(exercise.supportedMetrics.map((value) => normalizeMetricKey(value)).filter((value): value is WorkoutMetricKey => value !== null));
    return metrics.size === 0 || metrics.has(metric);
  }
}
