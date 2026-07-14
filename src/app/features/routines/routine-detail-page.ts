import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { RoutineDetail } from './routines.service';
import { RoutinesService } from './routines.service';

@Component({
  selector: 'app-routine-detail-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">DETALLE DE LA RUTINA</p>
          <h1>{{ routine()?.name || 'Routine' }}</h1>
          <p class="lede">{{ routine()?.description || 'No description yet.' }}</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/routines">Volver a las rutinas</a>
          @if (routine(); as currentRoutine) {
            <a [routerLink]="['/routines', currentRoutine.id, 'edit']">Editar</a>
          }
        </div>
      </header>

      @if (route.snapshot.queryParamMap.get('saved') === '1') {
        <p class="banner success">Rutina guardada.</p>
      }

      @if (loading()) {
        <section class="card state"><p>Cargando la rutina…</p></section>
      } @else if (error(); as errorMessage) {
        <section class="card state">
          <p class="error">{{ errorMessage }}</p>
          <button type="button" (click)="load()">Reintentar</button>
        </section>
      } @else if (routine(); as currentRoutine) {
        <section class="layout">
          <article class="card summary">
            <div class="summary-row">
              <span>Exercises</span>
              <strong>{{ currentRoutine.exercises.length }}</strong>
            </div>
            <div class="summary-row">
              <span>Actualizada</span>
              <strong>{{ formatDate(currentRoutine.updatedAt) }}</strong>
            </div>
            <div class="danger-zone">
              @if (!confirmingDelete()) {
                <button type="button" class="danger" (click)="confirmingDelete.set(true)">Eliminar rutina</button>
              } @else {
                <div class="confirm-box">
                  <p>¿Eliminar esta rutina? Esta acción no se puede deshacer.</p>
                  <div class="confirm-actions">
                    <button type="button" class="danger" (click)="deleteRoutine()" [disabled]="deleting()">
                      {{ deleting() ? 'Deleting…' : 'Confirm delete' }}
                    </button>
                    <button type="button" (click)="confirmingDelete.set(false)">Cancelar</button>
                  </div>
                </div>
              }
              @if (deleteError(); as deleteMessage) {
                <p class="error">{{ deleteMessage }}</p>
              }
            </div>
          </article>

          <section class="exercise-list">
            @for (exercise of currentRoutine.exercises; track exercise.id) {
              <article class="card exercise-card">
                <div class="exercise-head">
                  <div>
                    <p class="eyebrow">{{ exercise.exercise.type }}</p>
                    <h2>{{ exercise.position + 1 }}. {{ exercise.exercise.name }}</h2>
                    <p>{{ exercise.exercise.equipment || 'General equipment' }}</p>
                  </div>
                </div>

                <div class="metrics">
                  @if (exercise.exercise.type === 'strength') {
                    <div><p>Series</p><strong>{{ displayMetric(exercise.plannedSets) }}</strong></div>
                    <div><p>Repeticiones</p><strong>{{ displayMetric(exercise.plannedRepetitions) }}</strong></div>
                    <div><p>Peso</p><strong>{{ displayMetric(exercise.plannedWeight) }}</strong></div>
                    <div><p>Descanso</p><strong>{{ formatRest(exercise.restSeconds) }}</strong></div>
                  } @else {
                    <div><p>Duración (seg.)</p><strong>{{ displayMetric(exercise.plannedDurationSeconds) }}</strong></div>
                    <div><p>Distancia</p><strong>{{ displayMetric(exercise.plannedDistance) }}</strong></div>
                  }
                </div>

                @if (exercise.notes) {
                  <p class="notes">{{ exercise.notes }}</p>
                }
              </article>
            }
          </section>
        </section>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .hero-actions, .layout, .confirm-actions { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { max-width: 48rem; margin: 0; color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .layout { align-items: start; flex-wrap: wrap; }
    .summary { flex: 0 0 min(20rem, 100%); }
    .exercise-list { display: grid; gap: 1rem; flex: 1 1 36rem; }
    .card { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .summary-row { display: flex; justify-content: space-between; gap: 1rem; padding: .5rem 0; }
    .danger-zone { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ece4d8; }
    .confirm-box { display: grid; gap: .75rem; }
    .confirm-actions { flex-wrap: wrap; }
    .exercise-card h2 { margin: .5rem 0; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .75rem; margin: 1rem 0 0; }
    .metrics div { padding: .85rem; border-radius: 1rem; background: #f7f1e6; }
    .metrics p { margin: 0; font-size: .85rem; color: #617064; }
    .metrics strong { display: block; margin-top: .35rem; }
    .notes { margin: 1rem 0 0; color: #435248; }
    .banner { border-radius: 1rem; padding: .9rem 1rem; margin: 0 0 1rem; }
    .success { background: #e7f4ec; color: #1d5b3d; }
    .error { color: #9d2f2f; }
    a, button { border: 0; border-radius: .75rem; padding: .8rem 1rem; font: inherit; text-decoration: none; cursor: pointer; background: #e8dfd0; color: #1f3028; }
    .danger { background: #f7d9d5; color: #8d2d2d; }
    .state { display: grid; gap: .75rem; justify-items: start; }
  `,
})
export class RoutineDetailPage {
  protected readonly route = inject(ActivatedRoute);

  private readonly routinesService = inject(RoutinesService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly routine = signal<RoutineDetail | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    const routineId = this.route.snapshot.paramMap.get('id');
    if (!routineId) {
      this.error.set('Routine not found.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.routinesService.getDetail(routineId).subscribe({
      next: (routine) => {
        this.routine.set(routine);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'We could not load this routine.'));
        this.loading.set(false);
      },
    });
  }

  protected async deleteRoutine(): Promise<void> {
    const routine = this.routine();
    if (!routine) {
      return;
    }

    this.deleting.set(true);
    this.deleteError.set(null);

    this.routinesService.delete(routine.id).subscribe({
      next: async () => {
        this.deleting.set(false);
        await this.router.navigate(['/routines'], { queryParams: { deleted: 1 } });
      },
      error: (error: unknown) => {
        this.deleteError.set(this.toMessage(error, 'Delete failed. The routine was not removed.'));
        this.deleting.set(false);
      },
    });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  protected formatRest(restSeconds: number | null): string {
    if (restSeconds === null) return '—';
    const min = Math.floor(restSeconds / 60);
    const sec = restSeconds % 60;
    return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
  }

  protected displayMetric(value: number | null): string | number {
    return value ?? '—';
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
