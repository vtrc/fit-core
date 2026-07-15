import { Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, debounce } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { EntrenamientosService, type WorkoutSummaryModel } from './workouts.service';

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

        <section class="layout">
          <aside class="card summary-card">
            <div class="summary-row"><span>Rutina</span><strong>{{ summary()!.routineName }}</strong></div>
            <div class="summary-row"><span>Fecha</span><strong>{{ formatDate(summary()!.performedOn) }}</strong></div>
            @if (summary()!.durationSeconds !== null) {
              <div class="summary-row"><span>Duración</span><strong>{{ formatDuration(summary()!.durationSeconds!) }}</strong></div>
            }
            <div class="summary-row"><span>Planificados</span><strong>{{ summary()!.plannedCount }}</strong></div>
            <div class="summary-row"><span>Completados</span><strong>{{ summary()!.completedCount }}</strong></div>
            <div class="summary-row"><span>Omitidos</span><strong>{{ summary()!.skippedCount }}</strong></div>
            <div class="summary-row"><span>Completitud</span><strong>{{ summary()!.completionPercentage }}%</strong></div>

            <label class="field">
              <span>Notas del entrenamiento</span>
              <textarea rows="4" [formField]="notesForm.notes" placeholder="Notas generales opcionales."></textarea>
            </label>

            @if (completedCount() === 0) {
              <p class="banner error">Completa al menos un ejercicio antes de guardar.</p>
            }

            <button type="button" class="primary save" (click)="save()" [disabled]="completedCount() === 0 || saving()">
              {{ saving() ? 'Guardando…' : 'Guardar entrenamiento' }}
            </button>
          </aside>
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
    .layout { display: block; }
    .summary-card { max-width: 40rem; display: grid; gap: 1rem; }
    .summary-row { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #ece4d8; padding-bottom: .75rem; }
    .field { display: grid; gap: .35rem; }
    .field span { font-weight: 700; }
    textarea { width: 100%; border: 1px solid #c8bca7; border-radius: .75rem; padding: .8rem .9rem; font: inherit; background: #fff; }
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
  protected readonly completedCount = computed(() => this.session()?.exercises.filter((e) => e.result !== null).length ?? 0);
  protected readonly skippedCount = computed(() => this.session()?.exercises.filter((e) => e.skipped && e.result === null).length ?? 0);
  protected readonly summary = computed(() => this.createDraftSummary());

  protected readonly notesModel = signal({ notes: '' });
  protected readonly notesForm = form(this.notesModel, (p) => {
    debounce(p.notes, 300);
  });

  constructor() {
    effect(() => {
      const session = this.session();
      if (session) {
        if (this.notesModel().notes !== session.notes) {
          this.notesModel.set({ notes: session.notes });
        }
      }
    });

    effect(() => {
      const notes = this.notesModel().notes;
      if (this.session()?.notes !== notes) {
        this.workoutsService.updateNotes(notes);
      }
    });
  }

  protected save(): void {
    if (this.completedCount() === 0 || this.saving()) {
      return;
    }

    this.saveError.set(null);
    this.workoutsService.saveSession().subscribe({
      next: () => {
        this.saveError.set(null);
        this.router.navigate(['/history']);
      },
      error: (error: unknown) => {
        this.saveError.set(this.toMessage(error, 'Error al guardar. No se confirmó que el entrenamiento se haya guardado.'));
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

  protected formatDate(value: string): string {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(value);
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date);
  }

  protected formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes} min ${remainingSeconds} s` : `${remainingSeconds} s`;
  }

  private createDraftSummary(): WorkoutSummaryModel | null {
    const session = this.session();
    if (!session) {
      return null;
    }

    const plannedCount = session.exercises.length;
    const completedCount = this.completedCount();
    const skippedCount = this.skippedCount();
    return {
      routineName: session.routineName ?? 'Entrenamiento libre',
      performedOn: session.startedAt,
      plannedCount,
      completedCount,
      skippedCount,
      completionPercentage: plannedCount === 0 ? 0 : Math.round((completedCount / plannedCount) * 100),
      durationSeconds: null,
    };
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
