import { Injectable, inject } from '@angular/core';
import { firstValueFrom, from, map, Observable, switchMap } from 'rxjs';

import type { Workout } from '../../core/domain/models';
import { HistoryService, type DateRange, type WorkoutDetails, type WorkoutResultDetail } from '../history/history.service';

export interface WorkoutTrendPoint {
  date: string;
  volume: number;
}

export interface MuscleGroupTotal {
  name: string;
  exercises: number;
}

export interface BestResult {
  exerciseId: string;
  exerciseName: string;
  type: 'strength' | 'cardio';
  value: number;
  unit: string;
}

export interface StatisticsOverview {
  workoutCount: number;
  workoutFrequencyPerWeek: number;
  strengthVolume: number;
  cardioDurationSeconds: number;
  cardioDistance: number;
  muscleGroups: MuscleGroupTotal[];
  bestResults: BestResult[];
  volumeTrend: WorkoutTrendPoint[];
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly history = inject(HistoryService);

  getOverview(range: DateRange): Observable<StatisticsOverview> {
    return this.history.listMine(range).pipe(
      switchMap((workouts) => from(this.loadDetails(workouts))),
      map((workouts) => this.calculateOverview(workouts, range)),
    );
  }

  private async loadDetails(workouts: Workout[]): Promise<WorkoutDetails[]> {
    return Promise.all(workouts.map((workout) => firstValueFrom(this.history.get(workout.id))));
  }

  private calculateOverview(workouts: WorkoutDetails[], range: DateRange): StatisticsOverview {
    const muscleGroups = new Map<string, number>();
    const bestResults = new Map<string, BestResult>();
    const volumeByDate = new Map<string, number>();
    let strengthVolume = 0;
    let cardioDurationSeconds = 0;
    let cardioDistance = 0;

    for (const workout of workouts) {
      let workoutVolume = 0;
      for (const resultDetail of workout.results) {
        this.addMuscleGroups(muscleGroups, resultDetail);
        if (resultDetail.result.kind === 'strength') {
          const volume = resultDetail.result.weight * resultDetail.result.repetitionsTotal;
          strengthVolume += volume;
          workoutVolume += volume;
          this.setBestResult(bestResults, resultDetail, volume, 'volume');
        } else {
          cardioDurationSeconds += resultDetail.result.durationSeconds;
          cardioDistance += resultDetail.result.distance;
          this.setBestResult(bestResults, resultDetail, resultDetail.result.distance, 'distance');
        }
      }
      volumeByDate.set(workout.performedOn, (volumeByDate.get(workout.performedOn) ?? 0) + workoutVolume);
    }

    return {
      workoutCount: workouts.length,
      workoutFrequencyPerWeek: this.calculateFrequency(workouts, range),
      strengthVolume,
      cardioDurationSeconds,
      cardioDistance,
      muscleGroups: [...muscleGroups.entries()]
        .map(([name, exercises]) => ({ name, exercises }))
        .sort((a, b) => b.exercises - a.exercises || a.name.localeCompare(b.name)),
      bestResults: [...bestResults.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),
      volumeTrend: [...volumeByDate.entries()]
        .map(([date, volume]) => ({ date, volume }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  private addMuscleGroups(groups: Map<string, number>, resultDetail: WorkoutResultDetail): void {
    for (const group of resultDetail.exercise.muscleGroups) {
      groups.set(group, (groups.get(group) ?? 0) + 1);
    }
  }

  private setBestResult(results: Map<string, BestResult>, detail: WorkoutResultDetail, value: number, unit: string): void {
    const current = results.get(detail.exerciseId);
    if (!current || value > current.value) {
      results.set(detail.exerciseId, {
        exerciseId: detail.exerciseId,
        exerciseName: detail.exercise.name,
        type: detail.exercise.type,
        value,
        unit,
      });
    }
  }

  private calculateFrequency(workouts: WorkoutDetails[], range: DateRange): number {
    if (workouts.length === 0) {
      return 0;
    }

    const start = range.from ?? workouts.reduce((earliest, workout) => (workout.performedOn < earliest ? workout.performedOn : earliest), workouts[0].performedOn);
    const end = range.to ?? workouts.reduce((latest, workout) => (workout.performedOn > latest ? workout.performedOn : latest), workouts[0].performedOn);
    const days = Math.max(1, Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1);
    return workouts.length / (days / 7);
  }
}
