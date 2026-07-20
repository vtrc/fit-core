export type UUID = string;
export type ISODateString = string;
export type ISODateTimeString = string;

export type ExerciseType = 'strength' | 'cardio';

export interface Exercise {
  id: UUID;
  name: string;
  type: ExerciseType;
  equipment: string | null;
  imageUrl: string | null;
  muscleGroups: string[];
  supportedMetrics: string[];
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface Routine {
  id: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  position: number | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface RoutineExercise {
  id: UUID;
  userId: UUID;
  routineId: UUID;
  exerciseId: UUID;
  position: number;
  plannedSets: number | null;
  plannedRepetitions: number | null;
  plannedWeight: number | null;
  plannedDurationSeconds: number | null;
  plannedDistance: number | null;
  restSeconds: number | null;
  notes: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface Workout {
  id: UUID;
  userId: UUID;
  routineId: UUID | null;
  performedOn: ISODateString;
  startedAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  notes: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface StrengthExerciseResult {
  kind: 'strength';
  weight: number;
  setsCompleted: number;
  repetitionsTotal: number;
  notes?: string | null;
}

export interface CardioExerciseResult {
  kind: 'cardio';
  durationSeconds: number;
  distance: number;
  speed?: number | null;
  incline?: number | null;
  calories?: number | null;
  resistance?: number | null;
  notes?: string | null;
}

export type ExerciseResult = StrengthExerciseResult | CardioExerciseResult;

export interface WorkoutResult {
  id: UUID;
  userId: UUID;
  workoutId: UUID;
  exerciseId: UUID;
  result: ExerciseResult;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
