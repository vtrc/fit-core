import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { form, FormField, required, validateTree } from '@angular/forms/signals';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import type { Exercise, ExerciseType } from '../../core/domain/models';
import { CatalogService, type CatalogFilter } from '../../core/catalog/catalog.service';
import {
  RoutinesService,
  type CreateRoutineInput,
  type RoutineDetail,
  validateRoutineInput,
} from './routines.service';

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
  | 'plannedDistance'
  | 'restSeconds';

@Component({
  selector: 'app-routine-editor-page',
  standalone: true,
  imports: [FormsModule, FormField, RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">{{ isEditMode() ? 'EDIT ROUTINE' : 'NEW ROUTINE' }}</p>
          <h1>{{ isEditMode() ? 'Refine your plan.' : 'Build a reusable routine.' }}</h1>
          <p class="lede">Elige ejercicios del catálogo, ordénalos y define tus objetivos.</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/routines">Volver a las rutinas</a>
          @if (isEditMode()) {
            <a [routerLink]="['/routines', routineId()]">Ver detalle</a>
          }
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
                <h2>Exercises seleccionados</h2>
                <p>{{ draft().exercises.length }} planned</p>
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
                          <p>{{ item.exercise.equipment || 'General equipment' }}</p>
                        </div>
                        <div class="stack actions">
                          <button type="button" (click)="moveExercise($index, -1)" [disabled]="$index === 0">Subir</button>
                          <button type="button" (click)="moveExercise($index, 1)" [disabled]="$index === draft().exercises.length - 1">Bajar</button>
                          <button type="button" class="danger" (click)="removeExercise($index)">Eliminar</button>
                        </div>
                      </div>

                      @if (item.exercise.type === 'strength') {
                        <div class="metrics">
                          <label class="field"><span>Series</span><input type="number" [ngModel]="displayNumber(item.plannedSets)" (ngModelChange)="updateExerciseNumber($index, 'plannedSets', $event)" /></label>
                          <label class="field"><span>Repeticiones</span><input type="number" [ngModel]="displayNumber(item.plannedRepetitions)" (ngModelChange)="updateExerciseNumber($index, 'plannedRepetitions', $event)" /></label>
                          <label class="field"><span>Peso</span><input type="number" step="0.5" [ngModel]="displayNumber(item.plannedWeight)" (ngModelChange)="updateExerciseNumber($index, 'plannedWeight', $event)" /></label>
                          <label class="field"><span>Rest (sec)</span><input type="number" [ngModel]="displayNumber(item.restSeconds)" (ngModelChange)="updateExerciseNumber($index, 'restSeconds', $event)" /></label>
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

          <aside class="card catalog">
            <div class="section-heading">
              <h2>Catálogo de ejercicios</h2>
              <p>Añade ejercicios de la lista compartida.</p>
            </div>

            <div class="filters">
              <label class="field">
                <span>Buscar</span>
                <input type="text" [formField]="filterForm.query" placeholder="Press de pecho" />
              </label>
              <label class="field">
                <span>Tipo</span>
                <select [formField]="filterForm.type">
                  <option value="">Todos</option>
                  <option value="strength">Fuerza</option>
                  <option value="cardio">Cardio</option>
                </select>
              </label>
              <label class="field">
                <span>Grupo muscular</span>
                <input type="text" [formField]="filterForm.muscleGroup" placeholder="cuádriceps" />
              </label>
              <label class="field">
                <span>Equipamiento</span>
                <input type="text" [formField]="filterForm.equipment" placeholder="máquina" />
              </label>
            </div>

            @if (catalogLoading()) {
              <p>Cargando catálogo…</p>
            } @else if (catalogError(); as catalogErrorMessage) {
              <div class="state">
                <p class="error">{{ catalogErrorMessage }}</p>
                <button type="button" (click)="loadCatalog()">Reintentar</button>
              </div>
            } @else if (filteredCatalog().length === 0) {
              <div class="empty-inline"><p>No catalog exercises match these filters.</p></div>
            } @else {
              <div class="catalog-list">
                @for (exercise of filteredCatalog(); track exercise.id) {
                  <article class="catalog-item">
                    <div style="display: grid;gap: 1rem;align-items: center;justify-content: space-between;grid-auto-columns: 1fr 1fr;grid-auto-flow: column;">
                    <div>
                      <p class="eyebrow">{{ exercise.type }}</p>
                      <h3>{{ exercise.name }}</h3>
                      <p>{{ exercise.equipment || 'General equipment' }}</p>
                      <p class="tags">{{ exercise.muscleGroups.join(' · ') || 'No muscle groups' }}</p>
                    </div>
                    @if (exercise.imageUrl) {
                      <img class="catalog-item-image" [src]="exercise.imageUrl" [alt]="exercise.name" />
                    }
                    </div>
                    
                    <button type="button" (click)="addExercise(exercise)">Añadir</button>
                  </article>
                }
              </div>
            }
          </aside>
        </div>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .hero-actions, .layout, .exercise-header, .actions, .form-actions { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { max-width: 48rem; margin: 0; color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .layout { align-items: start; flex-wrap: wrap; }
    .editor { flex: 1 1 40rem; }
    .catalog { flex: 0 0 min(24rem, 100%); }
    .card { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .section-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; margin-bottom: 1rem; }
    .section-heading h2, h3 { margin: 0; }
    .field { display: grid; gap: .35rem; margin-bottom: 1rem; }
    .field span { font-weight: 700; }
    input, textarea, select { width: 100%; border: 1px solid #c8bca7; border-radius: .75rem; padding: .8rem .9rem; font: inherit; background: #fff; }
    .selected { margin-top: 1.5rem; }
    .exercise-list, .catalog-list { display: grid; gap: .85rem; }
    .catalog-list { grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
    .catalog-item-image { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: .75rem; background: #fff; }
    .exercise-card, .catalog-item { border: 1px solid #ece4d8; border-radius: 1rem; padding: 1rem; background: #fff; }
    .exercise-header { justify-content: space-between; align-items: start; }
    .stack { display: grid; gap: .5rem; }
    .actions { align-items: start; }
    .metrics { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); margin: 1rem 0; }
    .filters { display: grid; gap: .75rem; margin-bottom: 1rem; }
    .catalog-item { display: grid; gap: .8rem; align-content: start; align-content: space-between; }
    .tags { color: #617064; font-size: .95rem; }
    .hero-actions a, button { border: 0; border-radius: .75rem; padding: .8rem 1rem; font: inherit; text-decoration: none; cursor: pointer; }
    .hero-actions a, button { background: #e8dfd0; color: #1f3028; }
    .primary { background: #1f3028; color: #fff; }
    .danger { background: #f7d9d5; color: #8d2d2d; }
    .banner { border-radius: 1rem; padding: .9rem 1rem; margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .banner.error { background: #fce9e6; }
    .banner ul { margin: .5rem 0 0; padding-left: 1.2rem; }
    .state, .empty-inline { border: 1px dashed #d7ccb7; border-radius: 1rem; padding: 1rem; background: #fbf7f0; }
    @media (max-width: 960px) { .catalog { flex-basis: 100%; } }
  `,
})
export class RoutineEditarorPage {
  private readonly routinesService = inject(RoutinesService);
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly catalogLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly attemptedSubmit = signal(false);
  protected readonly draft = signal<RoutineDraft>({ name: '', description: '', exercises: [] });
  protected readonly catalog = signal<Exercise[]>([]);
  protected readonly routineId = signal(this.route.snapshot.paramMap.get('id'));
  protected readonly isEditMode = computed(() => !!this.routineId());

  protected readonly filterModel = signal({
    query: '',
    type: '',
    muscleGroup: '',
    equipment: '',
  });

  protected readonly routineForm = form(this.draft, (p) => {
    required(p.name, { message: 'El nombre de la rutina es requerido.' });

    validateTree(p, ({ value }) => {
      const errors = validateRoutineInput(this.toInput(value()));
      return errors.length > 0 ? errors.map(message => ({ kind: 'routineValidation' as const, message })) : null;
    });
  });

  protected readonly filterForm = form(this.filterModel);

  protected readonly filteredCatalog = computed(() => {
    const query = this.filterModel().query.trim().toLowerCase();
    if (!query) {
      return this.catalog();
    }

    return this.catalog().filter((exercise) => {
      const haystack = [exercise.name, exercise.equipment ?? '', exercise.muscleGroups.join(' ')].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly validationErrors = computed(() => validateRoutineInput(this.toInput(this.draft())));

  constructor() {
    this.loadCatalog();
    const routineId = this.routineId();
    if (routineId) {
      this.loadRoutine(routineId);
    }

    effect(() => {
      const filters = this.filterModel();
      void filters.type;
      void filters.muscleGroup;
      void filters.equipment;
      this.loadCatalog();
    });
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

  protected displayNumber(value: number | null): string | number {
    return value ?? '';
  }

  protected async save(): Promise<void> {
    this.attemptedSubmit.set(true);
    this.saveError.set(null);

    const input = this.toInput(this.draft());
    if (validateRoutineInput(input).length > 0) {
      return;
    }

    this.saving.set(true);
    const request$ = this.isEditMode() && this.routineId()
      ? this.routinesService.update(this.routineId()!, input)
      : this.routinesService.create(input);

    request$.subscribe({
      next: async (routine) => {
        this.saving.set(false);
        await this.router.navigate(['/routines', routine.id], {
          queryParams: this.isEditMode() ? { saved: 1 } : { created: 1, saved: 1 },
        });
      },
      error: (error: unknown) => {
        this.saveError.set(this.toMessage(error, 'Save failed. Your changes were not confirmed as saved.'));
        this.saving.set(false);
      },
    });
  }

  protected loadCatalog(): void {
    this.catalogLoading.set(true);
    this.catalogError.set(null);

    const filters = this.filterModel();
    const request: CatalogFilter = {
      type: this.asExerciseType(filters.type),
      muscleGroup: this.normalizeFilter(filters.muscleGroup),
      equipment: this.normalizeFilter(filters.equipment),
    };

    this.catalogService.listExercises(request).subscribe({
      next: (exercises) => {
        this.catalog.set(exercises);
        this.catalogLoading.set(false);
      },
      error: (error: unknown) => {
        this.catalogError.set(this.toMessage(error, 'We could not load the shared exercise catalog.'));
        this.catalogLoading.set(false);
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

  private normalizeFilter(value: string): string | undefined {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  private toNullableNumber(rawValue: string | number): number | null {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return null;
    }

    const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private asExerciseType(value: string): ExerciseType | undefined {
    return value === 'strength' || value === 'cardio' ? value : undefined;
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
