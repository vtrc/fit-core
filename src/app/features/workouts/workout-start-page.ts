import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { Routine } from '../../core/domain/models';
import { RoutinesService } from '../routines/routines.service';
import { EntrenamientosService } from './workouts.service';

@Component({
  selector: 'app-workout-start-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">WORKOUTS</p>
          <h1>Inicia tu entrenamiento.</h1>
          <p class="lede">Usa una rutina guardada como plan o empieza una sesión vacía y añade ejercicios sobre la marcha.</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/dashboard">Volver al panel</a>
          <button type="button" class="primary" (click)="startFreeWorkout()" [disabled]="saving()">Iniciar entrenamiento libre</button>
        </div>
      </header>

      @if (error(); as errorMessage) {
        <p class="banner error" role="alert">{{ errorMessage }}</p>
      }

      <section class="card free-card">
        <div>
          <p class="eyebrow">ENTRENAMIENTO LIBRE</p>
          <h2>¿No tienes rutina? No pasa nada.</h2>
          <p>Añade ejercicios de fuerza o cardio durante la sesión.</p>
        </div>
        <button type="button" class="primary" (click)="startFreeWorkout()" [disabled]="saving()">Iniciar sesión vacía</button>
      </section>

      <section class="section-heading">
        <div>
          <p class="eyebrow">SAVED ROUTINES</p>
          <h2>Iniciar desde una rutina guardada</h2>
        </div>
        <a routerLink="/routines/new">Crear rutina</a>
      </section>

      @if (loading()) {
        <section class="card state"><p>Cargando rutinas…</p></section>
      } @else if (routines().length === 0) {
        <section class="card state">
          <h2>No routines yet.</h2>
          <p>También puedes iniciar un entrenamiento libre o crear primero una rutina reutilizable.</p>
          <div class="inline-actions">
            <button type="button" class="primary" (click)="startFreeWorkout()" [disabled]="saving()">Iniciar entrenamiento libre</button>
            <a routerLink="/routines/new">Crear rutina</a>
          </div>
        </section>
      } @else {
        <section class="grid">
          @for (routine of routines(); track routine.id) {
            <article class="card routine-card">
              <div>
                <p class="eyebrow">UPDATED {{ formatDate(routine.updatedAt) }}</p>
                <h3>{{ routine.name }}</h3>
                <p>{{ routine.description || 'No description yet.' }}</p>
              </div>
              <div class="inline-actions">
                <a [routerLink]="['/routines', routine.id]">Ver</a>
                <button type="button" (click)="startRoutine(routine)" [disabled]="saving() || startingRoutineId() === routine.id">
                  {{ startingRoutineId() === routine.id ? 'Starting…' : 'Start' }}
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
    .hero, .hero-actions, .free-card, .section-heading, .inline-actions { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { max-width: 48rem; margin: 0; color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .card, .banner { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .banner { margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .free-card { justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 2rem; }
    .section-heading { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1rem; }
    .section-heading h2, .routine-card h3, .free-card h2 { margin: .35rem 0; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); }
    .routine-card { min-height: 13rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; }
    .routine-card p:last-child, .free-card p:last-child { color: #435248; }
    .state { display: grid; gap: .75rem; justify-items: start; }
    .hero-actions, .inline-actions { align-items: center; flex-wrap: wrap; }
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

  protected async startFreeWorkout(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.workoutsService.startFreeWorkout();
    await this.router.navigate(['/workouts/session']);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
