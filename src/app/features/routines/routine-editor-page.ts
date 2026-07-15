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
  imports: [FormsModule, FormField, ExerciseCatalogComponent],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">{{ isEditMode() ? 'EDIT ROUTINE' : 'NEW ROUTINE' }}</p>
          <h1>{{ isEditMode() ? 'Refine your plan.' : 'Build a reusable routine.' }}</h1>
          <p class="lede">Elige ejercicios del catálogo, ordénalos y define tus objetivos.</p>
        </div>

      </header>

      @if (loading()) {
        <section class="card state"><p>Cargando el editor de rutinas…</p></section>
      } @else {
        <div class="layout">
          <section class="card editor">
            @if (saveError(); as errorMessage) {
              <p class="banner error" role="alert">{{ errorMessage }}</p>
            }

            @if (validationErrors().length > 0 && attemptedSubmit()) {
              <div class="banner error" role="alert">
                <p>Corrige estos problemas antes de guardar:</p>
                <ul>
                  @for (errorMessage of validationErrors(); track errorMessage) {
                    <li>{{ errorMessage }}</li>
                  }
                </ul>
              </div>
            }

            <label class="field">
              <span>Nombre</span>
              <input
                type="text"
                [formField]="routineForm.name"
                placeholder="Rutina de tren superior / inferior"
              />
            </label>

            <label class="field">
              <span>Descripción</span>
              <textarea
                rows="3"
                [formField]="routineForm.description"
                placeholder="Notas opcionales sobre intención, tempo o enfoque."
              ></textarea>
            </label>

            <section class="selected">
              <div class="section-heading">
                 <h2>Ejercicios seleccionados</h2>
                 <p>{{ draft().exercises.length }} planificados</p>
              </div>

              @if (draft().exercises.length === 0) {
                <div class="empty-inline"><p>Añade al menos un ejercicio del catálogo.</p></div>
              } @else {
                <div class="exercise-list">
                  @for (item of draft().exercises; track trackExercise($index, item.exercise.id)) {
                    <article class="exercise-card">
                      <div class="exercise-header">
                        <div>
                          <p class="eyebrow">{{ item.exercise.type }}</p>
                          <h3>{{ $index + 1 }}. {{ item.exercise.name }}</h3>
                           <p>{{ item.exercise.equipment || 'Equipamiento general' }}</p>
                        </div>
                        <div class="stack actions">
                           <button type="button" class="icon-button" (click)="moveExercise($index, -1)" [disabled]="$index === 0" aria-label="Subir ejercicio" title="Subir ejercicio">↑</button>
                           <button type="button" class="icon-button" (click)="moveExercise($index, 1)" [disabled]="$index === draft().exercises.length - 1" aria-label="Bajar ejercicio" title="Bajar ejercicio">↓</button>
                           <button type="button" class="icon-button danger" (click)="removeExercise($index)" aria-label="Eliminar ejercicio" title="Eliminar ejercicio">×</button>
                        </div>
                      </div>

                      @if (item.exercise.type === 'strength') {
                        <div class="metrics">
                          <label class="field">
                            <span>Series</span>
                            <select [ngModel]="displayNumber(item.plannedSets)" (ngModelChange)="updateExerciseNumber($index, 'plannedSets', $event)">
                              <option value="">—</option>
                              @for (v of seriesOptions; track v) {
                                <option [value]="v">{{ v }}</option>
                              }
                            </select>
                          </label>
                          <label class="field">
                            <span>Repeticiones</span>
                            <select [ngModel]="displayNumber(item.plannedRepetitions)" (ngModelChange)="updateExerciseNumber($index, 'plannedRepetitions', $event)">
                              <option value="">—</option>
                              @for (v of repOptions; track v) {
                                <option [value]="v">{{ v }}</option>
                              }
                            </select>
                          </label>
                          <label class="field">
                            <span>Peso (kg)</span>
                            <select [ngModel]="displayNumber(item.plannedWeight)" (ngModelChange)="updateExerciseNumber($index, 'plannedWeight', $event)">
                              <option value="">—</option>
                              @for (v of pesoOptions; track v) {
                                <option [value]="v">{{ v }}</option>
                              }
                            </select>
                          </label>
                          <label class="field">
                            <span>Descanso</span>
                            <div class="rest-group">
                              <select [ngModel]="restMinutes(item.restSeconds)" (ngModelChange)="updateRestMinutes($index, $event)">
                                <option value="">—</option>
                                @for (v of restMinOptions; track v) {
                                  <option [value]="v">{{ v }}</option>
                                }
                              </select>
                              <span class="rest-unit">min</span>
                              <select [ngModel]="restSecondsPart(item.restSeconds)" (ngModelChange)="updateRestSeconds($index, $event)">
                                <option value="">—</option>
                                @for (v of restSecOptions; track v) {
                                  <option [value]="v">{{ v.toString().padStart(2, '0') }}</option>
                                }
                              </select>
                              <span class="rest-unit">seg</span>
                            </div>
                          </label>
                        </div>
                      } @else {
                        <div class="metrics">
                          <label class="field"><span>Duración (seg.)</span><input type="number" [ngModel]="displayNumber(item.plannedDurationSeconds)" (ngModelChange)="updateExerciseNumber($index, 'plannedDurationSeconds', $event)" /></label>
                          <label class="field"><span>Distancia</span><input type="number" step="0.1" [ngModel]="displayNumber(item.plannedDistance)" (ngModelChange)="updateExerciseNumber($index, 'plannedDistance', $event)" /></label>
                        </div>
                      }

                      <label class="field">
                        <span>Notas</span>
                        <textarea rows="2" [ngModel]="item.notes" (ngModelChange)="updateExerciseNotes($index, $event)" placeholder="Indicaciones o notas de preparación opcionales."></textarea>
                      </label>
                    </article>
                  }
                </div>
              }
            </section>

            <div class="form-actions">
              <button type="button" class="primary" (click)="save()" [disabled]="saving()">
                {{ saving() ? 'Guardando…' : isEditMode() ? 'Guardar cambios' : 'Crear rutina' }}
              </button>
            </div>
          </section>

          <app-exercise-catalog
            label="Catálogo de ejercicios"
            filterMode="full"
            [selectedExerciseIds]="selectedCatalogIds()"
            (exerciseAdded)="addExercise($event)"
          />
        </div>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .layout, .exercise-header, .actions, .form-actions { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { max-width: 48rem; margin: 0; color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .layout { align-items: start; flex-wrap: wrap; }
    .editor { flex: 1 1 40rem; min-width: 0; }
    app-exercise-catalog { flex: 1 1 24rem; min-width: 0; }
    .card { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .section-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; margin-bottom: 1rem; }
    .section-heading h2, h3 { margin: 0; }
    .field { display: grid; gap: .35rem; margin-bottom: 1rem; }
    .field span { font-weight: 700; }
    input, textarea, select { width: 100%; border: 1px solid #c8bca7; border-radius: .75rem; padding: .8rem .9rem; font: inherit; background: #fff; }
    .selected { margin-top: 1.5rem; }
    .exercise-list { display: grid; gap: .85rem; }
    .exercise-card { border: 1px solid #ece4d8; border-radius: 1rem; padding: 1rem; background: #fff; }
    .exercise-header { justify-content: space-between; align-items: start; min-width: 0; }
    .exercise-header > div:first-child { min-width: 0; }
    .exercise-header h3, .exercise-header p { overflow-wrap: anywhere; }
    .stack { display: grid; gap: .5rem; grid-auto-flow: column; }
    .actions { align-items: start; }
    .rest-group { display: flex; gap: .35rem; align-items: center; }
    .rest-group select, .rest-group input { width: 5.5rem; }
    .rest-unit { color: #617064; font-size: .82rem; }
    .icon-button { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; padding: 0; font-size: 1.25rem; line-height: 1; border-radius: .75rem; }
    .icon-button:disabled { opacity: .35; cursor: not-allowed; }
    .metrics { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); margin: 1rem 0; }

    button { border: 0; border-radius: .75rem; padding: .8rem 1rem; font: inherit; cursor: pointer; background: #e8dfd0; color: #1f3028; }
    .form-actions button { width: 100%; margin-top: 1rem; }
    .primary { background: #1f3028; color: #fff; }
    .danger { background: #f7d9d5; color: #8d2d2d; }
    .banner { border-radius: 1rem; padding: .9rem 1rem; margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .banner.error { background: #fce9e6; }
    .banner ul { margin: .5rem 0 0; padding-left: 1.2rem; }
    .state { border: 1px dashed #d7ccb7; border-radius: 1rem; padding: 1rem; background: #fbf7f0; }
  `,
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

  protected readonly selectedCatalogIds = computed(() => new Set(this.draft().exercises.map((e) => e.exercise.id)));

  protected readonly seriesOptions = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly repOptions = Array.from({ length: 50 }, (_, i) => i + 1);
  protected readonly pesoOptions = Array.from({ length: 76 }, (_, i) => i + 45);
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
