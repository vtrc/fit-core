import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { form, FormField, required, validateTree } from '@angular/forms/signals';
import { Router, ActivatedRoute } from '@angular/router';

import type { Exercise } from '../../core/domain/models';
import {
  RoutinesService,
  type CreateRoutineInput,
  type RoutineDetail,
  validateRoutineInput,
} from './routines.service';
import { ExerciseCatalogComponent } from '../../shared/exercise-catalog/exercise-catalog';
import { PageHeaderComponent } from '../../shared/page-header/page-header';

interface ExerciseDraft {
  exercise: Exercise;
  plannedSets: number | null;
  plannedRepetitions: number | null;
  plannedWeight: number | null;
  plannedDurationSeconds: number | null;
  plannedDistance: number | null;
  restSeconds: number | null;
  notes: string;
}

interface RoutineDraft {
  name: string;
  description: string;
  exercises: ExerciseDraft[];
}

type NumericField =
  | 'plannedSets'
  | 'plannedRepetitions'
  | 'plannedWeight'
  | 'plannedDurationSeconds'
  | 'plannedDistance';

@Component({
  selector: 'app-routine-editor-page',
  standalone: true,
  imports: [FormsModule, FormField, ExerciseCatalogComponent, PageHeaderComponent],
  templateUrl: './routine-editor-page.html',
  styleUrl: './routine-editor-page.scss',
})
export class RoutineEditarorPage {
  private readonly routinesService = inject(RoutinesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly attemptedSubmit = signal(false);
  protected readonly draft = signal<RoutineDraft>({ name: '', description: '', exercises: [] });
  protected readonly routineId = signal(this.route.snapshot.paramMap.get('id'));
  protected readonly isEditMode = computed(() => !!this.routineId());

  protected readonly routineForm = form(this.draft, (p) => {
    required(p.name, { message: 'El nombre de la rutina es requerido.' });

    validateTree(p, ({ value }) => {
      const errors = validateRoutineInput(this.toInput(value()));
      return errors.length > 0 ? errors.map(message => ({ kind: 'routineValidation' as const, message })) : null;
    });
  });

  protected readonly validationErrors = computed(() => validateRoutineInput(this.toInput(this.draft())));

  protected hasExerciseError(index: number, field: string): boolean {
    if (!this.attemptedSubmit()) return false;
    const exercise = this.draft().exercises[index];
    if (!exercise) return false;

    const errors = validateRoutineInput(this.toInput(this.draft()));
    if (errors.length === 0) return false;

    const exerciseType = exercise.exercise.type;
    const exerciseIndex = index;

    if (field === 'plannedSets' || field === 'plannedRepetitions') {
      if (exerciseType === 'strength') {
        const value = field === 'plannedSets' ? exercise.plannedSets : exercise.plannedRepetitions;
        return value === null || value === undefined;
      }
      return false;
    }

    if (field === 'plannedDurationSeconds' || field === 'plannedDistance') {
      if (exerciseType === 'cardio') {
        const value = field === 'plannedDurationSeconds' ? exercise.plannedDurationSeconds : exercise.plannedDistance;
        return value === null || value === undefined;
      }
      return false;
    }

    return false;
  }

  protected readonly selectedCatalogIds = computed(() => new Set(this.draft().exercises.map((e) => e.exercise.id)));

  protected readonly seriesOptions = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly repOptions = Array.from({ length: 50 }, (_, i) => i + 1);
  protected readonly pesoOptions = Array.from({ length: 76 }, (_, i) => i + 5);
  protected readonly restMinOptions = Array.from({ length: 35 }, (_, i) => i + 1);
  protected readonly restSecOptions = Array.from({ length: 60 }, (_, i) => i);

  constructor() {
    const routineId = this.routineId();
    if (routineId) {
      this.loadRoutine(routineId);
    }
  }

  protected addExercise(exercise: Exercise): void {
    this.draft.update((draft) => ({
      ...draft,
      exercises: [
        ...draft.exercises,
        {
          exercise,
          plannedSets: null,
          plannedRepetitions: null,
          plannedWeight: null,
          plannedDurationSeconds: null,
          plannedDistance: null,
          restSeconds: null,
          notes: '',
        },
      ],
    }));
  }

  protected removeExercise(index: number): void {
    this.draft.update((draft) => ({
      ...draft,
      exercises: draft.exercises.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  protected moveExercise(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    this.draft.update((draft) => {
      if (targetIndex < 0 || targetIndex >= draft.exercises.length) {
        return draft;
      }

      const exercises = [...draft.exercises];
      const [item] = exercises.splice(index, 1);
      exercises.splice(targetIndex, 0, item);
      return { ...draft, exercises };
    });
  }

  protected trackExercise(index: number, exerciseId: string): string {
    return `${index}-${exerciseId}`;
  }

  protected updateExerciseNumber(index: number, field: NumericField, rawValue: string | number): void {
    const value = this.toNullableNumber(rawValue);
    this.draft.update((draft) => ({
      ...draft,
      exercises: draft.exercises.map((exercise, currentIndex) =>
        currentIndex === index ? { ...exercise, [field]: value } : exercise,
      ),
    }));
  }

  protected adjustNumber(index: number, field: NumericField, options: number[], direction: -1 | 1): void {
    const current = this.draft().exercises[index]?.[field] ?? null;
    const currentIndex = current === null ? -1 : options.indexOf(current);
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : -1) : Math.max(-1, Math.min(options.length - 1, currentIndex + direction));
    this.updateExerciseNumber(index, field, nextIndex < 0 ? '' : options[nextIndex]);
  }

  protected isFirstOption(value: number | string | null, options: number[]): boolean {
    return value === null || value === '' || value === options[0];
  }

  protected isLastOption(value: number | string | null, options: number[]): boolean {
    return value === options[options.length - 1];
  }

  protected updateExerciseNotes(index: number, value: string): void {
    this.draft.update((draft) => ({
      ...draft,
      exercises: draft.exercises.map((exercise, currentIndex) =>
        currentIndex === index ? { ...exercise, notes: value } : exercise,
      ),
    }));
  }

  protected restMinutes(restSeconds: number | null): string | number {
    return restSeconds !== null ? Math.floor(restSeconds / 60) : '';
  }

  protected restSecondsPart(restSeconds: number | null): string | number {
    return restSeconds !== null ? restSeconds % 60 : '';
  }

  protected updateRestMinutes(index: number, rawValue: string | number): void {
    const minutes = this.toNullableNumber(rawValue) ?? 0;
    this.draft.update((draft) => {
      const sec = draft.exercises[index].restSeconds ?? 0;
      const total = minutes * 60 + (sec % 60);
      return {
        ...draft,
        exercises: draft.exercises.map((ex, i) =>
          i === index ? { ...ex, restSeconds: total > 0 ? total : null } : ex,
        ),
      };
    });
  }

  protected updateRestSeconds(index: number, rawValue: string | number): void {
    const remainingSec = this.toNullableNumber(rawValue) ?? 0;
    this.draft.update((draft) => {
      const sec = draft.exercises[index].restSeconds ?? 0;
      const total = Math.floor(sec / 60) * 60 + remainingSec;
      return {
        ...draft,
        exercises: draft.exercises.map((ex, i) =>
          i === index ? { ...ex, restSeconds: total > 0 ? total : null } : ex,
        ),
      };
    });
  }

  protected adjustRestMinutes(index: number, direction: -1 | 1): void {
    const current = this.restMinutes(this.draft().exercises[index]?.restSeconds ?? null);
    const currentIndex = typeof current === 'number' ? this.restMinOptions.indexOf(current) : -1;
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : -1) : Math.max(-1, Math.min(this.restMinOptions.length - 1, currentIndex + direction));
    this.updateRestMinutes(index, nextIndex < 0 ? '' : this.restMinOptions[nextIndex]);
  }

  protected adjustRestSeconds(index: number, direction: -1 | 1): void {
    const current = this.restSecondsPart(this.draft().exercises[index]?.restSeconds ?? null);
    const currentIndex = typeof current === 'number' ? this.restSecOptions.indexOf(current) : -1;
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : -1) : Math.max(-1, Math.min(this.restSecOptions.length - 1, currentIndex + direction));
    this.updateRestSeconds(index, nextIndex < 0 ? '' : this.restSecOptions[nextIndex]);
  }

  protected displayNumber(value: number | null): string | number {
    return value ?? '';
  }

  protected async save(): Promise<void> {
    this.attemptedSubmit.set(true);
    this.saveError.set(null);

    const input = this.toInput(this.draft());
    const validationErrors = validateRoutineInput(input);
    if (validationErrors.length > 0) {
      this.saveError.set(validationErrors.join(' '));
      return;
    }

    this.saving.set(true);
    const request$ = this.isEditMode() && this.routineId()
      ? this.routinesService.update(this.routineId()!, input)
      : this.routinesService.create(input);

    request$.subscribe({
      next: async () => {
        this.saving.set(false);
        await this.router.navigate(['/routines'], {
          queryParams: this.isEditMode() ? { saved: 1 } : { created: 1, saved: 1 },
        });
      },
      error: (error: unknown) => {
        this.saveError.set(this.toMessage(error, 'Save failed. Your changes were not confirmed as saved.'));
        this.saving.set(false);
      },
    });
  }

  private loadRoutine(id: string): void {
    this.loading.set(true);
    this.routinesService.getDetail(id).subscribe({
      next: (routine) => {
        this.draft.set(this.mapDraft(routine));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.saveError.set(this.toMessage(error, 'We could not load this routine.'));
        this.loading.set(false);
      },
    });
  }

  private mapDraft(routine: RoutineDetail): RoutineDraft {
    return {
      name: routine.name,
      description: routine.description ?? '',
      exercises: routine.exercises.map((exercise) => ({
        exercise: exercise.exercise,
        plannedSets: exercise.plannedSets,
        plannedRepetitions: exercise.plannedRepetitions,
        plannedWeight: exercise.plannedWeight,
        plannedDurationSeconds: exercise.plannedDurationSeconds,
        plannedDistance: exercise.plannedDistance,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes ?? '',
      })),
    };
  }

  private toInput(draft: RoutineDraft): CreateRoutineInput {
    return {
      name: draft.name,
      description: draft.description,
      exercises: draft.exercises.map((exercise) => ({
        exerciseId: exercise.exercise.id,
        exerciseType: exercise.exercise.type,
        supportedMetrics: exercise.exercise.supportedMetrics,
        plannedSets: exercise.plannedSets,
        plannedRepetitions: exercise.plannedRepetitions,
        plannedWeight: exercise.plannedWeight,
        plannedDurationSeconds: exercise.plannedDurationSeconds,
        plannedDistance: exercise.plannedDistance,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
      })),
    };
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private toNullableNumber(rawValue: string | number): number | null {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return null;
    }

    const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    return Number.isFinite(numeric) ? numeric : null;
  }

}
