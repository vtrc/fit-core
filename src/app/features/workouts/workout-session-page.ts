import { Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import type { CardioExerciseResult, Exercise, ExerciseType, StrengthExerciseResult } from '../../core/domain/models';
import { CatalogService, type CatalogFilter } from '../../core/catalog/catalog.service';
import { EntrenamientosService, type WorkoutSessionExercise } from './workouts.service';

interface StrengthResultDraft {
  setsCompleted: number | null;
  repetitionsTotal: number | null;
  weight: number | null;
  notes: string;
}

interface CardioResultDraft {
  durationSeconds: number | null;
  distance: number | null;
  speed: number | null;
  incline: number | null;
  calories: number | null;
  resistance: number | null;
  notes: string;
}

@Component({
  selector: 'app-workout-session-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">ENTRENAMIENTO EN CURSO</p>
          <h1>{{ session()?.routineName || 'Entrenamiento libre' }}</h1>
          <p class="lede">Registra un ejercicio cada vez. Puedes omitirlo, eliminarlo o añadir ejercicios sin cambiar las rutinas guardadas.</p>
        </div>
        <div class="hero-actions">
          @if (saving()) {
            <button type="button" disabled>Empezar de nuevo</button>
          } @else {
            <a routerLink="/workouts/start">Empezar de nuevo</a>
          }
          <button type="button" (click)="discard()">Descartar</button>
          <button type="button" class="primary" (click)="finish()" [disabled]="completedCount() === 0">Revisar resumen final</button>
        </div>
      </header>

      @if (!session()) {
        <section class="card state">
          <h2>No hay ningún entrenamiento activo.</h2>
          <p>Primero inicia un entrenamiento basado en una rutina o un entrenamiento libre.</p>
          <a class="primary" routerLink="/workouts/start">Iniciar entrenamiento</a>
        </section>
      } @else {
        @if (errors().length > 0) {
          <div class="banner error" role="alert">
            <p>Corrige estos problemas antes de registrar:</p>
            <ul>
              @for (errorMessage of errors(); track errorMessage) {
                <li>{{ errorMessage }}</li>
              }
            </ul>
          </div>
        }

        <section class="card progress-card" aria-labelledby="progress-heading">
          <div class="progress-heading">
            <h2 id="progress-heading">Progreso del entrenamiento</h2>
            <strong>{{ completedCount() }} de {{ plannedCount() }} ejercicios completados</strong>
          </div>
          <progress [value]="completedCount()" [max]="plannedCount() || 1" aria-label="Progreso de ejercicios completados"></progress>
        </section>
        <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveStatus() }}</p>

        <section class="stats">
          <article class="card stat"><span>Planificados</span><strong>{{ plannedCount() }}</strong></article>
          <article class="card stat"><span>Completados</span><strong>{{ completedCount() }}</strong></article>
          <article class="card stat"><span>Omitidos</span><strong>{{ skippedCount() }}</strong></article>
          <article class="card stat"><span>Pendientes</span><strong>{{ remainingCount() }}</strong></article>
          <article class="card stat"><span>Actual</span><strong>{{ currentPositionLabel() }}</strong></article>
        </section>

        <div class="layout">
          <aside class="card rail">
            <div class="section-heading">
              <h2>Ejercicios</h2>
              <button type="button" (click)="toggleCatalog()">{{ showCatalog() ? 'Ocultar panel de añadir' : 'Añadir ejercicio' }}</button>
            </div>

            @if (session()!.exercises.length === 0) {
              <p class="muted">Añade un ejercicio para comenzar este entrenamiento libre.</p>
            } @else {
              <div class="exercise-nav">
                @for (item of session()!.exercises; track item.sessionExerciseId; let index = $index) {
                  <button
                    type="button"
                    class="nav-item"
                    [class.active]="index === session()!.activeIndex"
                    [class.pending]="item.result === null && !item.skipped"
                    [class.completed]="item.result !== null"
                    [class.skipped]="item.skipped"
                    [attr.aria-label]="'Ejercicio ' + (index + 1) + ': ' + item.exercise.name + ', ' + exerciseStatus(item)"
                    (click)="selectExercise(index)"
                  >
                    <span>{{ index + 1 }}. {{ item.exercise.name }}</span>
                    <small>{{ exerciseStatus(item) }}</small>
                  </button>
                }
              </div>
            }
          </aside>

          <section class="card active-card">
            @if (activeExercise(); as item) {
              <div class="active-head">
                <div>
                   <p class="eyebrow">{{ exerciseTypeLabel(item.exercise.type) }}</p>
                  <h2>{{ item.exercise.name }}</h2>
                  <p>{{ item.exercise.equipment || 'Equipamiento general' }}</p>
                </div>
                <button type="button" class="danger" (click)="remove(item)">Eliminar</button>
              </div>

              <div class="targets">
                @if (item.exercise.type === 'strength') {
                  <span>Series: <strong>{{ displayMetric(item.plannedSets) }}</strong></span>
                  <span>Repeticiones: <strong>{{ displayMetric(item.plannedRepetitions) }}</strong></span>
                  <span>Peso: <strong>{{ displayMetric(item.plannedWeight) }}</strong></span>
                  <span>Descanso: <strong>{{ displayMetric(item.restSeconds) }}</strong></span>
                } @else {
                  <span>Duración: <strong>{{ displayMetric(item.plannedDurationSeconds) }}</strong></span>
                  <span>Distancia: <strong>{{ displayMetric(item.plannedDistance) }}</strong></span>
                }
              </div>

              @if (item.notes) {
                <p class="planned-note">Nota del plan: {{ item.notes }}</p>
              }

              @if (item.exercise.type === 'strength') {
                <form class="result-form" [formRoot]="strengthForm" (submit)="onSubmitStrength($event, item)">
                  <label class="field"><span>Series completadas</span><input type="number" [formField]="strengthForm.setsCompleted" /></label>
                  <label class="field"><span>Repeticiones totales</span><input type="number" [formField]="strengthForm.repetitionsTotal" /></label>
                  <label class="field"><span>Peso</span><input type="number" step="0.5" [formField]="strengthForm.weight" /></label>
                  <label class="field full"><span>Notas</span><textarea rows="3" [formField]="strengthForm.notes" placeholder="Nota opcional del resultado."></textarea></label>
                  <div class="form-actions">
                    <button type="button" (click)="skip(item)">Omitir</button>
                    <button type="submit" class="primary">Registrar resultado de fuerza</button>
                  </div>
                </form>
              } @else {
                <form class="result-form" [formRoot]="cardioForm" (submit)="onSubmitCardio($event, item)">
                  <label class="field"><span>Duración (seg.)</span><input type="number" [formField]="cardioForm.durationSeconds" /></label>
                  <label class="field"><span>Distancia</span><input type="number" step="0.1" [formField]="cardioForm.distance" /></label>
                   <label class="field"><span>Velocidad</span><input type="number" step="0.1" [formField]="cardioForm.speed" /></label>
                   <label class="field"><span>Inclinación</span><input type="number" step="0.1" [formField]="cardioForm.incline" /></label>
                   <label class="field"><span>Calorías</span><input type="number" step="1" [formField]="cardioForm.calories" /></label>
                   <label class="field"><span>Resistencia</span><input type="number" step="1" [formField]="cardioForm.resistance" /></label>
                  <label class="field full"><span>Notas</span><textarea rows="3" [formField]="cardioForm.notes" placeholder="Nota opcional del resultado."></textarea></label>
                  <div class="form-actions">
                    <button type="button" (click)="skip(item)">Omitir</button>
                    <button type="submit" class="primary">Registrar resultado de cardio</button>
                  </div>
                </form>
              }
            } @else {
              <div class="state">
                <h2>Añade un ejercicio para comenzar.</h2>
                <p>Los entrenamientos libres empiezan vacíos. Usa el catálogo para añadir ejercicios de fuerza o cardio.</p>
                <button type="button" class="primary" (click)="showCatalog.set(true)">Añadir ejercicio</button>
              </div>
            }
          </section>

          @if (showCatalog()) {
            <aside class="card catalog">
              <div class="section-heading">
                <h2>Añadir ejercicio</h2>
                <button type="button" (click)="loadCatalog()">Actualizar</button>
              </div>

              <div class="filters">
                <label class="field"><span>Buscar</span><input type="text" [formField]="searchForm.query" placeholder="Remo, sentadilla, cinta" /></label>
                <label class="field"><span>Tipo</span><select [formField]="searchForm.typeFilter"><option value="">Todos</option><option value="strength">Fuerza</option><option value="cardio">Cardio</option></select></label>
              </div>

              @if (catalogLoading()) {
                <p>Cargando catálogo…</p>
              } @else if (catalogError(); as catalogErrorMessage) {
                <p class="error">{{ catalogErrorMessage }}</p>
              } @else {
                <div class="catalog-list">
                  @for (exercise of filteredCatalog(); track exercise.id) {
                    <article class="catalog-item">
                      @if (exercise.imageUrl) {
                        <img class="catalog-item-image" [src]="exercise.imageUrl" [alt]="exercise.name" />
                      }
                      <div>
                         <p class="eyebrow">{{ exerciseTypeLabel(exercise.type) }}</p>
                        <h3>{{ exercise.name }}</h3>
                         <p>{{ exercise.equipment || 'Equipamiento general' }}</p>
                      </div>
                      <button type="button" (click)="addExercise(exercise)">Añadir</button>
                    </article>
                  } @empty {
                     <p class="muted">Ningún ejercicio coincide con este filtro.</p>
                  }
                </div>
              }
            </aside>
          }
        </div>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .hero-actions, .layout, .stats, .section-heading, .active-head, .form-actions, .progress-heading { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede, .muted, .planned-note { color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .card, .banner { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .banner { margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .progress-card { display: grid; gap: .75rem; margin-bottom: 1rem; }
    .progress-heading { justify-content: space-between; align-items: baseline; flex-wrap: wrap; }
    .progress-heading h2 { margin: 0; font-size: 1rem; }
    progress { width: 100%; height: .75rem; accent-color: #1f3028; }
    .stats { flex-wrap: wrap; margin-bottom: 1rem; }
    .stat { min-width: 9rem; display: grid; gap: .25rem; }
    .stat span { color: #617064; }
    .stat strong { font-size: 1.6rem; }
    .layout { align-items: start; flex-wrap: wrap; }
    .rail { flex: 0 0 min(19rem, 100%); }
    .active-card { flex: 1 1 32rem; }
    .catalog { flex: 0 0 min(24rem, 100%); }
    .section-heading, .active-head { justify-content: space-between; align-items: start; }
    .section-heading h2, .active-head h2, .catalog-item h3 { margin: .35rem 0; }
    .exercise-nav, .catalog-list, .filters { display: grid; gap: .75rem; }
    .catalog-list { grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); }
    .catalog-item-image { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: .75rem; background: #fff; }
    .nav-item { width: 100%; text-align: left; display: grid; gap: .25rem; background: #f4eadb; }
    .nav-item.active { outline: 2px solid #1f3028; }
    .nav-item.pending { background: #f4eadb; }
    .nav-item.completed { background: #e7f4ec; }
    .nav-item.skipped { background: #f5e2d5; }
    .targets { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); margin: 1rem 0; }
    .targets span { border-radius: 1rem; background: #f7f1e6; padding: .85rem; }
    .result-form { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
    .field { display: grid; gap: .35rem; }
    .field span { font-weight: 700; }
    .full { grid-column: 1 / -1; }
    input, textarea, select { width: 100%; border: 1px solid #c8bca7; border-radius: .75rem; padding: .8rem .9rem; font: inherit; background: #fff; }
    .form-actions { grid-column: 1 / -1; justify-content: end; flex-wrap: wrap; }
    .catalog-item { display: grid; gap: .75rem; align-content: start; border: 1px solid #ece4d8; border-radius: 1rem; padding: 1rem; background: #fff; }
    a, button { border: 0; border-radius: .75rem; padding: .8rem 1rem; font: inherit; text-decoration: none; cursor: pointer; background: #e8dfd0; color: #1f3028; }
    .primary { background: #1f3028; color: #fff; }
    .danger { background: #f7d9d5; color: #8d2d2d; }
    button:disabled { opacity: .65; cursor: not-allowed; }
    .state { display: grid; gap: .75rem; justify-items: start; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 1080px) { .rail, .catalog { flex-basis: 100%; } }
  `,
})
export class WorkoutSessionPage {
  private readonly workoutsService = inject(EntrenamientosService);
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);

  protected readonly session = this.workoutsService.session;
  protected readonly activeExercise = this.workoutsService.activeExercise;
  protected readonly plannedCount = this.workoutsService.plannedCount;
  protected readonly completedCount = this.workoutsService.completedCount;
  protected readonly skippedCount = this.workoutsService.skippedCount;
  protected readonly remainingCount = this.workoutsService.remainingCount;
  protected readonly saving = this.workoutsService.saving;
  protected readonly showCatalog = signal(false);
  protected readonly catalog = signal<Exercise[]>([]);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly liveStatus = signal('');

  protected readonly strengthModel = signal<StrengthResultDraft>({ setsCompleted: null, repetitionsTotal: null, weight: null, notes: '' });
  protected readonly cardioModel = signal<CardioResultDraft>({
    durationSeconds: null,
    distance: null,
    speed: null,
    incline: null,
    calories: null,
    resistance: null,
    notes: '',
  });
  protected readonly searchModel = signal({ query: '', typeFilter: '' });

  protected readonly strengthForm = form(this.strengthModel, (p) => {
    validate(p.setsCompleted, ({ value }) => {
      const v = value();
      if (v === null) return null;
      if (!Number.isFinite(v) || v < 0) return { kind: 'invalidNumber', message: 'Debe ser un número positivo' };
      if (!Number.isInteger(v)) return { kind: 'notInteger', message: 'Debe ser un número entero' };
      return null;
    });
    validate(p.repetitionsTotal, ({ value }) => {
      const v = value();
      if (v === null) return null;
      if (!Number.isFinite(v) || v < 0) return { kind: 'invalidNumber', message: 'Debe ser un número positivo' };
      if (!Number.isInteger(v)) return { kind: 'notInteger', message: 'Debe ser un número entero' };
      return null;
    });
    validate(p.weight, ({ value }) => {
      const v = value();
      if (v === null) return null;
      if (!Number.isFinite(v) || v < 0) return { kind: 'invalidNumber', message: 'Debe ser un número positivo' };
      return null;
    });
  });

  protected readonly cardioForm = form(this.cardioModel, (p) => {
    validate(p.durationSeconds, ({ value }) => {
      const v = value();
      if (v === null) return null;
      if (!Number.isFinite(v) || v < 0) return { kind: 'invalidNumber', message: 'Debe ser un número positivo' };
      if (!Number.isInteger(v)) return { kind: 'notInteger', message: 'Debe ser un número entero' };
      return null;
    });
    validate(p.distance, ({ value }) => {
      const v = value();
      if (v === null) return null;
      if (!Number.isFinite(v) || v < 0) return { kind: 'invalidNumber', message: 'Debe ser un número positivo' };
      return null;
    });
    for (const field of ['speed', 'incline', 'calories', 'resistance'] as const) {
      validate(p[field], ({ value }) => {
        const v = value();
        if (v === null) return null;
        if (!Number.isFinite(v) || v < 0) return { kind: 'invalidNumber', message: 'Debe ser un número positivo' };
        return null;
      });
    }
  });

  protected readonly searchForm = form(this.searchModel);

  protected readonly filteredCatalog = computed(() => {
    const query = this.searchModel().query.trim().toLowerCase();
    return this.catalog().filter((exercise) => {
      if (this.searchModel().typeFilter && exercise.type !== this.searchModel().typeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [exercise.name, exercise.equipment ?? '', exercise.muscleGroups.join(' ')].join(' ').toLowerCase().includes(query);
    });
  });

  constructor() {
    this.seedDrafts(this.activeExercise());
    this.loadCatalog();

    effect(() => {
      this.searchModel().typeFilter;
      this.loadCatalog();
    });
  }

  protected toggleCatalog(): void {
    this.showCatalog.update((value) => !value);
  }

  protected selectExercise(index: number): void {
    this.workoutsService.setActiveIndex(index);
    this.errors.set([]);
    this.seedDrafts(this.activeExercise());
  }

  protected addExercise(exercise: Exercise): void {
    this.workoutsService.addExercise(exercise);
    this.showCatalog.set(false);
    this.errors.set([]);
    this.seedDrafts(this.activeExercise());
  }

  protected remove(item: WorkoutSessionExercise): void {
    this.workoutsService.removeExercise(item.sessionExerciseId);
    this.errors.set([]);
    this.seedDrafts(this.activeExercise());
  }

  protected skip(item: WorkoutSessionExercise): void {
    this.workoutsService.skipExercise(item.sessionExerciseId);
    this.errors.set([]);
    this.announceProgress('Ejercicio omitido.');
    this.seedDrafts(this.activeExercise());
  }

  protected onSubmitStrength(event: Event, item: WorkoutSessionExercise): void {
    event.preventDefault();
    const draft = this.strengthModel();
    const result: StrengthExerciseResult = {
      kind: 'strength',
      setsCompleted: draft.setsCompleted ?? 0,
      repetitionsTotal: draft.repetitionsTotal ?? 0,
      weight: draft.weight ?? 0,
      notes: draft.notes,
    };

    this.record(item, result);
  }

  protected onSubmitCardio(event: Event, item: WorkoutSessionExercise): void {
    event.preventDefault();
    const draft = this.cardioModel();
    const result: CardioExerciseResult = {
      kind: 'cardio',
      durationSeconds: draft.durationSeconds ?? 0,
      distance: draft.distance ?? 0,
      speed: draft.speed,
      incline: draft.incline,
      calories: draft.calories,
      resistance: draft.resistance,
      notes: draft.notes,
    };

    this.record(item, result);
  }

  protected loadCatalog(): void {
    this.catalogLoading.set(true);
    this.catalogError.set(null);

    const filter: CatalogFilter = { type: this.asExerciseType(this.searchModel().typeFilter) };
    this.catalogService.listExercises(filter).subscribe({
      next: (exercises) => {
        this.catalog.set(exercises);
        this.catalogLoading.set(false);
      },
      error: (error: unknown) => {
        this.catalogError.set(this.toMessage(error, 'No se pudo cargar el catálogo de ejercicios.'));
        this.catalogLoading.set(false);
      },
    });
  }

  protected async finish(): Promise<void> {
    if (this.completedCount() === 0) {
      this.errors.set(['Completa al menos un ejercicio antes de guardar el entrenamiento.']);
      return;
    }

    await this.router.navigate(['/workouts/summary']);
  }

  protected async discard(): Promise<void> {
    if (this.workoutsService.saving()) {
      return;
    }

    this.workoutsService.clearSession();
    await this.router.navigate(['/workouts/start']);
  }

  protected currentPositionLabel(): string {
    const session = this.session();
    if (!session || session.exercises.length === 0) {
      return '—';
    }

    return `${session.activeIndex + 1}/${session.exercises.length}`;
  }

  protected displayMetric(value: number | null): string | number {
    return value ?? '—';
  }

  protected exerciseTypeLabel(type: ExerciseType): string {
    return type === 'strength' ? 'Fuerza' : 'Cardio';
  }

  private record(item: WorkoutSessionExercise, result: StrengthExerciseResult | CardioExerciseResult): void {
    const errors = this.workoutsService.recordResult(item.sessionExerciseId, result);
    this.errors.set(errors);
    if (errors.length === 0) {
      this.announceProgress('Resultado registrado.');
      this.seedDrafts(this.activeExercise());
    }
  }

  protected exerciseStatus(item: WorkoutSessionExercise): string {
    if (item.result !== null) {
      return 'Completado';
    }

    if (item.skipped) {
      return 'Omitido';
    }

    return 'Pendiente';
  }

  private announceProgress(prefix: string): void {
    this.liveStatus.set(`${prefix} ${this.completedCount()} completados, ${this.skippedCount()} omitidos y ${this.remainingCount()} pendientes.`);
  }

  private seedDrafts(item: WorkoutSessionExercise | null): void {
    if (!item) {
      this.strengthModel.set({ setsCompleted: null, repetitionsTotal: null, weight: null, notes: '' });
      this.cardioModel.set({ durationSeconds: null, distance: null, speed: null, incline: null, calories: null, resistance: null, notes: '' });
      return;
    }

    if (item.exercise.type === 'strength') {
      const result = item.result?.kind === 'strength' ? item.result : null;
      this.strengthModel.set({
        setsCompleted: result?.setsCompleted ?? item.plannedSets,
        repetitionsTotal: result?.repetitionsTotal ?? item.plannedRepetitions,
        weight: result?.weight ?? item.plannedWeight,
        notes: result?.notes ?? '',
      });
    }

    if (item.exercise.type === 'cardio') {
      const result = item.result?.kind === 'cardio' ? item.result : null;
      this.cardioModel.set({
        durationSeconds: result?.durationSeconds ?? item.plannedDurationSeconds,
        distance: result?.distance ?? item.plannedDistance,
        speed: result?.speed ?? null,
        incline: result?.incline ?? null,
        calories: result?.calories ?? null,
        resistance: result?.resistance ?? null,
        notes: result?.notes ?? '',
      });
    }
  }

  private asExerciseType(value: string): ExerciseType | undefined {
    return value === 'strength' || value === 'cardio' ? value : undefined;
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
