import {describe, expect, it} from 'vitest';
import type {CardioExerciseResult, StrengthExerciseResult, WorkoutResult} from './models';

describe('training tracker domain models', () => {
  it('models strength results with the required strength metrics', () => {
    const result: StrengthExerciseResult = {
      kind: 'strength',
      weight: 82.5,
      setsCompleted: 4,
      repetitionsTotal: 32,
      notes: 'Felt controlled',
    };

    expect(result.kind).toBe('strength');
    expect(result.weight).toBe(82.5);
    expect(result.setsCompleted).toBe(4);
    expect(result.repetitionsTotal).toBe(32);
  });

  it('models cardio results with duration, distance, and máquina-specific optional metrics', () => {
    const result: CardioExerciseResult = {
      kind: 'cardio',
      durationSeconds: 1_800,
      distance: 5.2,
      speed: 10.4,
      incline: 2,
      calories: 410,
      resistance: 6,
      notes: 'Steady pace',
    };

    expect(result.kind).toBe('cardio');
    expect(result.durationSeconds).toBe(1_800);
    expect(result.distance).toBe(5.2);
    expect(result.speed).toBe(10.4);
    expect(result.incline).toBe(2);
    expect(result.calories).toBe(410);
    expect(result.resistance).toBe(6);
  });

  it('uses the result kind as a discriminator for workout result details', () => {
    const strengthWorkoutResult: WorkoutResult = {
      id: '9a42b7bd-2efd-4db5-b05e-2d9d02f5428e',
      workoutId: '9c4513cc-bbda-4599-b7b4-0b4e97310e0e',
      exerciseId: '15cfb9ef-f628-49fa-89d7-c8763f4c70e1',
      userId: '67b4a9b3-f3de-4fbb-970f-146564164d7e',
      result: {
        kind: 'strength',
        weight: 100,
        setsCompleted: 5,
        repetitionsTotal: 25,
      },
      createdAt: '2026-07-14T10:00:00.000Z',
      updatedAt: '2026-07-14T10:00:00.000Z',
    };

    const describeResult = (result: WorkoutResult): string => {
      switch (result.result.kind) {
        case 'strength':
          return `${result.result.setsCompleted} sets / ${result.result.repetitionsTotal} reps`;
        case 'cardio':
          return `${result.result.durationSeconds} seconds / ${result.result.distance} km`;
      }
    };

    expect(describeResult(strengthWorkoutResult)).toBe('5 sets / 25 reps');
  });
});
