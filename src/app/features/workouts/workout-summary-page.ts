import { Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, debounce } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { EntrenamientosService } from './workouts.service';

@Component({
  selector: 'app-workout-summary-page',
  standalone: true,
  imports: [FormField, RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">RESUMEN DEL ENTRENAMIENTO</p>
          <h1>Revisa antes de guardar.</h1>
          <p class="lede">Solo se guardan los resultados de ejercicios completados. Los ejercicios omitidos o eliminados quedan fuera del entrenamiento guardado.</p>
        </div>
        <div class="hero-actions">
          @if (saving()) {
            <button type="button" disabled>Volver a la sesión</button>
          } @else {
            <a routerLink="/workouts/session">Volver a la sesión</a>
          }
          <button type="button" (click)="discard()" [disabled]="saving()">Descartar</button>
        </div>
      </header>

      @if (!session()) {
        <section class="card state">
          <h2>No hay ningún entrenamiento activo.</h2>
          <p>Inicia un entrenamiento antes de revisar el resumen.</p>
          <a class="primary" routerLink="/workouts/start">Iniciar entrenamiento</a>
        </section>
      } @else {
        @if (saveError(); as errorMessage) {
          <p class="banner error" role="alert">{{ errorMessage }}</p>
        }

        @if (savedWorkoutId(); as workoutId) {
          <p class="banner success">Workout saved. ID: {{ workoutId }}</p>
        }

        <section class="layout">
          <aside class="card summary-card">
            <div class="summary-row"><span>Origen</span><strong>{{ session()!.routineName || 'Entrenamiento libre' }}</strong></div>
            <div class="summary-row"><span>Started</span><strong>{{ formatDateTime(session()!.startedAt) }}</strong></div>
            <div class="summary-row"><span>Resultados completados</span><strong>{{ completedCount() }}</strong></div>
            <div class="summary-row"><span>Omitidos</span><strong>{{ skippedCount() }}</strong></div>

            <label class="field">
              <span>Notas del entrenamiento</span>
              <textarea rows="4" [formField]="notesForm.notes" placeholder="Notas generales opcionales."></textarea>
            </label>

            @if (completedCount() === 0) {
              <p class="banner error">Completa al menos un ejercicio antes de guardar.</p>
            }

            <button type="button" class="primary save" (click)="save()" [disabled]="completedCount() === 0 || saving() || !!savedWorkoutId()">
              {{ saving() ? 'Guardando…' : savedWorkoutId() ? 'Saved' : 'Save workout' }}
            </button>
          </aside>

          <section class="results">
            <h2>Resultados completados</h2>
            @for (item of completedExercises(); track item.sessionExerciseId) {
              <article class="card result-card">
                <div>
                  <p class="eyebrow">{{ item.exercise.type }}</p>
                  <h3>{{ item.exercise.name }}</h3>
                  <p>{{ item.exercise.equipment || 'General equipment' }}</p>
                </div>

                @if (item.result?.kind === 'strength') {
                  <div class="metrics">
                    <span>Series <strong>{{ item.result.setsCompleted }}</strong></span>
                    <span>Reps <strong>{{ item.result.repetitionsTotal }}</strong></span>
                    <span>Peso <strong>{{ item.result.weight }}</strong></span>
                  </div>
                  @if (item.result.notes) {
                    <p class="notes">{{ item.result.notes }}</p>
                  }
                }

                @if (item.result?.kind === 'cardio') {
                  <div class="metrics">
                    <span>Duración <strong>{{ item.result.durationSeconds }} sec</strong></span>
                    <span>Distancia <strong>{{ item.result.distance }}</strong></span>
                    @if (item.result.speed !== null && item.result.speed !== undefined) { <span>Speed <strong>{{ item.result.speed }}</strong></span> }
                    @if (item.result.incline !== null && item.result.incline !== undefined) { <span>Incline <strong>{{ item.result.incline }}</strong></span> }
                    @if (item.result.calories !== null && item.result.calories !== undefined) { <span>Calories <strong>{{ item.result.calories }}</strong></span> }
                    @if (item.result.resistance !== null && item.result.resistance !== undefined) { <span>Resistance <strong>{{ item.result.resistance }}</strong></span> }
                  </div>
                  @if (item.result.notes) {
                    <p class="notes">{{ item.result.notes }}</p>
                  }
                }
              </article>
            } @empty {
              <article class="card state">
                <h2>Todavía no hay resultados completados.</h2>
                <p>Vuelve a la sesión y registra al menos un resultado de ejercicio.</p>
                @if (saving()) {
                  <button type="button" class="primary" disabled>Volver a la sesión</button>
                } @else {
                  <a class="primary" routerLink="/workouts/session">Volver a la sesión</a>
                }
              </article>
            }

            @if (skippedExercises().length > 0) {
              <h2>Ejercicios omitidos</h2>
              @for (item of skippedExercises(); track item.sessionExerciseId) {
                <article class="card skipped-card">
                  <p>{{ item.exercise.name }}</p>
                </article>
              }
            }
          </section>
        </section>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .hero-actions, .layout { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede, .notes { color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .card, .banner { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .banner { margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .success { background: #e7f4ec; color: #1d5b3d; }
    .layout { align-items: start; flex-wrap: wrap; }
    .summary-card { flex: 0 0 min(24rem, 100%); display: grid; gap: 1rem; }
    .results { flex: 1 1 34rem; display: grid; gap: 1rem; }
    .results h2 { margin: .5rem 0 0; }
    .summary-row { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #ece4d8; padding-bottom: .75rem; }
    .field { display: grid; gap: .35rem; }
    .field span { font-weight: 700; }
    textarea { width: 100%; border: 1px solid #c8bca7; border-radius: .75rem; padding: .8rem .9rem; font: inherit; background: #fff; }
    .result-card { display: grid; gap: 1rem; }
    .result-card h3 { margin: .35rem 0; }
    .metrics { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }
    .metrics span { border-radius: 1rem; background: #f7f1e6; padding: .85rem; }
    .metrics strong { display: block; margin-top: .25rem; }
    .skipped-card { background: #fff8f1; }
    .state { display: grid; gap: .75rem; justify-items: start; }
    a, button { border: 0; border-radius: .75rem; padding: .8rem 1rem; font: inherit; text-decoration: none; cursor: pointer; background: #e8dfd0; color: #1f3028; }
    .primary { background: #1f3028; color: #fff; }
    .save { width: 100%; }
    button:disabled { opacity: .65; cursor: not-allowed; }
  `,
})
export class WorkoutSummaryPage {
  private readonly workoutsService = inject(EntrenamientosService);
  private readonly router = inject(Router);

  protected readonly session = this.workoutsService.session;
  protected readonly saving = this.workoutsService.saving;
  protected readonly saveError = signal<string | null>(null);
  protected readonly completedExercises = computed(() => this.session()?.exercises.filter((exercise) => exercise.result !== null) ?? []);
  protected readonly skippedExercises = computed(() => this.session()?.exercises.filter((exercise) => exercise.skipped && exercise.result === null) ?? []);
  protected readonly completedCount = computed(() => this.completedExercises().length);
  protected readonly skippedCount = computed(() => this.skippedExercises().length);
  protected readonly savedWorkoutId = computed(() => this.session()?.savedWorkout?.id ?? null);

  protected readonly notesModel = signal({ notes: '' });
  protected readonly notesForm = form(this.notesModel, (p) => {
    debounce(p.notes, 300);
  });

  constructor() {
    effect(() => {
      const session = this.session();
      if (session) {
        this.notesModel.set({ notes: session.notes });
      }
    });

    effect(() => {
      const notes = this.notesModel().notes;
      this.workoutsService.updateNotes(notes);
    });
  }

  protected save(): void {
    if (this.completedCount() === 0 || this.saving() || this.savedWorkoutId()) {
      return;
    }

    this.saveError.set(null);
    this.workoutsService.saveSession().subscribe({
      next: () => {
        this.saveError.set(null);
      },
      error: (error: unknown) => {
        this.saveError.set(this.toMessage(error, 'Save failed. The workout was not confirmed as saved.'));
      },
    });
  }

  protected async discard(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.workoutsService.clearSession();
    await this.router.navigate(['/workouts/start']);
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
