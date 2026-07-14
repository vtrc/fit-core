import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import type { Exercise, ExerciseResult, ExerciseType, Workout, WorkoutResult } from '../../core/domain/models';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface WorkoutResultDetail extends WorkoutResult {
  exercise: Exercise;
}

export interface WorkoutHistoryItem extends Workout {
  routineName: string;
  plannedCount: number;
  completedCount: number;
  skippedCount: number;
  completionPercentage: number;
}

export interface WorkoutExerciseStatus {
  exercise: Exercise;
  status: 'completed' | 'skipped';
  result: WorkoutResultDetail['result'] | null;
}

export interface WorkoutDetails extends WorkoutHistoryItem {
  results: WorkoutResultDetail[];
  exercises: WorkoutExerciseStatus[];
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

interface RoutineExerciseHistoryRow {
  exercise_id: string;
  position: number;
  exercise: ExerciseRow;
}

interface RoutineRow {
  name: string;
}

interface WorkoutResultRow {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  result: ExerciseResult;
  created_at: string;
  updated_at: string;
  exercise: ExerciseRow[] | ExerciseRow | null;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly auth = inject(AuthService);
  private readonly insforge = inject(InsforgeClientService);

  listMine(range: DateRange): Observable<WorkoutHistoryItem[]> {
    return from(this.requireUserId()).pipe(
      switchMap((userId) => from(this.loadEntrenamientos(userId, range))),
    );
  }

  get(id: string): Observable<WorkoutDetails> {
    return from(this.requireUserId()).pipe(
      switchMap((userId) =>
        from(
          this.insforge.client.database
            .from('workouts')
            .select('id, user_id, routine_id, performed_on, started_at, completed_at, notes, created_at, updated_at')
            .eq('id', id)
            .eq('user_id', userId)
            .single(),
        ).pipe(
          switchMap(({ data, error }) => {
            if (error) {
              throw error;
            }

            return from(this.loadHistoryDetails(userId, this.mapWorkout(data as WorkoutRow))).pipe(
              map(({ history, results, exercises }) => ({ ...history, results, exercises })),
            );
          }),
        ),
      ),
    );
  }

  private async loadEntrenamientos(userId: string, range: DateRange): Promise<WorkoutHistoryItem[]> {
    let query = this.insforge.client.database
      .from('workouts')
      .select('id, user_id, routine_id, performed_on, started_at, completed_at, notes, created_at, updated_at')
      .eq('user_id', userId)
      .order('performed_on', { ascending: false })
      .order('created_at', { ascending: false });

    if (range.from) {
      query = query.gte('performed_on', range.from);
    }
    if (range.to) {
      query = query.lte('performed_on', range.to);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return Promise.all((data ?? []).map((row) => this.loadHistoryItem(userId, this.mapWorkout(row as WorkoutRow))));
  }

  private async loadHistoryItem(userId: string, workout: Workout): Promise<WorkoutHistoryItem> {
    const [routine, routineExercises, results] = await Promise.all([
      this.loadRoutine(userId, workout.routineId),
      this.loadRoutineExercises(userId, workout.routineId),
      this.loadResultRows(userId, workout.id),
    ]);
    const plannedCount = routineExercises.length || results.length;
    const completedCount = results.length;

    return {
      ...workout,
      routineName: routine?.name ?? 'Entrenamiento libre',
      plannedCount,
      completedCount,
      skippedCount: Math.max(0, plannedCount - completedCount),
      completionPercentage: plannedCount === 0 ? 0 : Math.min(100, Math.round((completedCount / plannedCount) * 100)),
    };
  }

  private async loadHistoryDetails(
    userId: string,
    workout: Workout,
  ): Promise<{ history: WorkoutHistoryItem; results: WorkoutResultDetail[]; exercises: WorkoutExerciseStatus[] }> {
    const [history, results, routineExercises] = await Promise.all([
      this.loadHistoryItem(userId, workout),
      this.loadResultDetails(userId, workout.id),
      this.loadRoutineExercises(userId, workout.routineId),
    ]);
    const resultsByExerciseId = new Map<string, WorkoutResultDetail[]>();
    for (const result of results) {
      const matchingResults = resultsByExerciseId.get(result.exerciseId) ?? [];
      matchingResults.push(result);
      resultsByExerciseId.set(result.exerciseId, matchingResults);
    }
    const matchedResultIds = new Set<string>();
    const exercises = routineExercises.map((routineExercise) => {
      const matchingResults = resultsByExerciseId.get(routineExercise.exercise_id);
      const result = matchingResults?.shift();
      if (result) {
        matchedResultIds.add(result.id);
      }
      return {
        exercise: this.mapExercise(routineExercise.exercise),
        status: result ? 'completed' as const : 'skipped' as const,
        result: result?.result ?? null,
      };
    });
    for (const result of results) {
      if (!matchedResultIds.has(result.id)) {
        exercises.push({ exercise: result.exercise, status: 'completed', result: result.result });
      }
    }

    return { history, results, exercises };
  }

  private async loadResultDetails(userId: string, workoutId: string): Promise<WorkoutResultDetail[]> {
    const rows = await this.loadResultRows(userId, workoutId);
    return rows.map((row) => this.mapWorkoutResultDetail(row));
  }

  private async loadResultRows(userId: string, workoutId: string): Promise<WorkoutResultRow[]> {
    const { data, error } = await this.insforge.client.database
      .from('workout_results')
      .select(
        'id, user_id, workout_id, exercise_id, result, created_at, updated_at, exercise:exercises(id, name, type, equipment, muscle_groups, supported_metrics, created_at, updated_at)',
      )
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as WorkoutResultRow[];
  }

  private async loadRoutine(userId: string, routineId: string | null): Promise<RoutineRow | null> {
    if (!routineId) {
      return null;
    }

    const { data, error } = await this.insforge.client.database
      .from('routines')
      .select('name')
      .eq('id', routineId)
      .eq('user_id', userId)
      .single();
    if (error) {
      throw error;
    }
    return data as RoutineRow;
  }

  private async loadRoutineExercises(userId: string, routineId: string | null): Promise<RoutineExerciseHistoryRow[]> {
    if (!routineId) {
      return [];
    }

    const { data, error } = await this.insforge.client.database
      .from('routine_exercises')
      .select('exercise_id, position, exercise:exercises(id, name, type, equipment, image_url, muscle_groups, supported_metrics, created_at, updated_at)')
      .eq('routine_id', routineId)
      .eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => {
      const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
      if (!exercise) {
        throw new Error('Faltan los detalles del ejercicio de un ejercicio de la rutina.');
      }
      return { ...row, exercise } as RoutineExerciseHistoryRow & { exercise: ExerciseRow };
    });
  }

  private async requireUserId(): Promise<string> {
    if (this.auth.loading()) {
      await this.auth.restoreSession();
    }

    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión para ver el historial de entrenamientos.');
    }

    return userId;
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

  private mapWorkoutResultDetail(row: WorkoutResultRow): WorkoutResultDetail {
    const exerciseRow = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
    if (!exerciseRow) {
      throw new Error('Faltan los detalles del ejercicio de un resultado del entrenamiento.');
    }

    return {
      id: row.id,
      userId: row.user_id,
      workoutId: row.workout_id,
      exerciseId: row.exercise_id,
      result: row.result,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      exercise: this.mapExercise(exerciseRow),
    };
  }

  private mapExercise(row: ExerciseRow): Exercise {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      equipment: row.equipment,
      imageUrl: row.image_url,
      muscleGroups: row.muscle_groups ?? [],
      supportedMetrics: row.supported_metrics ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
