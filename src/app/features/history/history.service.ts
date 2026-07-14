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

export interface WorkoutDetails extends Workout {
  results: WorkoutResultDetail[];
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

  listMine(range: DateRange): Observable<Workout[]> {
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

            return from(this.loadResultDetails(userId, id)).pipe(
              map((results) => ({ ...this.mapWorkout(data as WorkoutRow), results })),
            );
          }),
        ),
      ),
    );
  }

  private async loadEntrenamientos(userId: string, range: DateRange): Promise<Workout[]> {
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

    return (data ?? []).map((row) => this.mapWorkout(row as WorkoutRow));
  }

  private async loadResultDetails(userId: string, workoutId: string): Promise<WorkoutResultDetail[]> {
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

    return (data ?? []).map((row) => this.mapWorkoutResultDetail(row as WorkoutResultRow));
  }

  private async requireUserId(): Promise<string> {
    if (this.auth.loading()) {
      await this.auth.restoreSession();
    }

    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Your session expired. Sign in again to view workout history.');
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
      throw new Error('A workout result is missing its exercise details.');
    }

    return {
      id: row.id,
      userId: row.user_id,
      workoutId: row.workout_id,
      exerciseId: row.exercise_id,
      result: row.result,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      exercise: {
        id: exerciseRow.id,
        name: exerciseRow.name,
        type: exerciseRow.type,
        equipment: exerciseRow.equipment,
        imageUrl: exerciseRow.image_url,
        muscleGroups: exerciseRow.muscle_groups ?? [],
        supportedMetrics: exerciseRow.supported_metrics ?? [],
        createdAt: exerciseRow.created_at,
        updatedAt: exerciseRow.updated_at,
      },
    };
  }
}
