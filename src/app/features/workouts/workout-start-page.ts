import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { Routine } from '../../core/domain/models';
import { RoutinesService } from '../routines/routines.service';
import { EntrenamientosService } from './workouts.service';

@Component({
  selector: 'app-workout-start-page',
  standalone: true,
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">ENTRENAMIENTOS</p>
          <h1>Inicia tu entrenamiento.</h1>
          <p class="lede">Elige una rutina guardada para comenzar.</p>
        </div>
      </header>

      @if (error(); as errorMessage) {
        <p class="banner error" role="alert">{{ errorMessage }}</p>
      }

      <section class="section-heading">
        <div>
          <p class="eyebrow">SAVED ROUTINES</p>
          <h2>Iniciar desde una rutina guardada</h2>
        </div>
      </section>

      @if (loading()) {
        <section class="card state"><p>Cargando rutinas…</p></section>
      } @else if (routines().length === 0) {
        <section class="card state">
          <h2>No hay rutinas todavía.</h2>
          <p>Crea una rutina para empezar a entrenar.</p>
        </section>
      } @else {
        <section class="grid">
          @for (routine of routines(); track routine.id) {
            <article class="card routine-card">
              <div>
                <p class="eyebrow">UPDATED {{ formatDate(routine.updatedAt) }}</p>
                <h3>{{ routine.name }}</h3>
                @if (routine.description) {
                  <p>{{ routine.description }}</p>
                }
              </div>
              <div class="inline-actions">
                <button type="button" (click)="startRoutine(routine)" [disabled]="saving() || startingRoutineId() === routine.id">
                  {{ startingRoutineId() === routine.id ? 'Starting…' : 'Empezar' }}
                </button>
              </div>
            </article>
          }
        </section>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .section-heading, .inline-actions { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { max-width: 48rem; margin: 0; color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .card, .banner { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .banner { margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .section-heading { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1rem; }
    .section-heading h2, .routine-card h3 { margin: .35rem 0; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); }
    .routine-card { display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; }
    .routine-card p:last-child { color: #435248; }
    .state { display: grid; gap: .75rem; justify-items: start; }
    .inline-actions { align-items: center; flex-wrap: wrap; }
    a, button { border: 0; border-radius: .75rem; padding: .85rem 1rem; font: inherit; text-decoration: none; cursor: pointer; background: #e8dfd0; color: #1f3028; }
    .primary, .routine-card button { background: #1f3028; color: #fff; }
    button:disabled { opacity: .65; cursor: not-allowed; }
  `,
})
export class WorkoutStartPage {
  private readonly routinesService = inject(RoutinesService);
  private readonly workoutsService = inject(EntrenamientosService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly routines = signal<Routine[]>([]);
  protected readonly startingRoutineId = signal<string | null>(null);
  protected readonly saving = this.workoutsService.saving;

  constructor() {
    this.loadRoutines();
  }

  protected loadRoutines(): void {
    this.loading.set(true);
    this.error.set(null);

    this.routinesService.listMine().subscribe({
      next: (routines) => {
        this.routines.set(routines);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'We could not load your routines.'));
        this.loading.set(false);
      },
    });
  }

  protected startRoutine(routine: Routine): void {
    if (this.saving()) {
      return;
    }

    this.startingRoutineId.set(routine.id);
    this.error.set(null);

    this.routinesService.getDetail(routine.id).subscribe({
      next: async (detail) => {
        this.workoutsService.startFromRoutine(detail);
        this.startingRoutineId.set(null);
        await this.router.navigate(['/workouts/session']);
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'We could not start this routine.'));
        this.startingRoutineId.set(null);
      },
    });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
