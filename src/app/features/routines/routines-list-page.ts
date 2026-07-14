import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

import type { Routine } from '../../core/domain/models';
import { RoutinesService } from './routines.service';

@Component({
  selector: 'app-routines-list-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">ROUTINES</p>
          <h1>Tus planes de entrenamiento.</h1>
          <p class="lede">Crea, revisa y mejora sesiones reutilizables antes de entrenar.</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/dashboard">Volver al panel</a>
          <a class="primary" routerLink="/routines/new">Crear rutina</a>
        </div>
      </header>

      @if (flashMessage(); as message) {
        <p class="banner success">{{ message }}</p>
      }

      @if (loading()) {
        <section class="card state"><p>Cargando rutinas…</p></section>
      } @else if (error(); as errorMessage) {
        <section class="card state">
          <p class="error">{{ errorMessage }}</p>
          <button type="button" (click)="load()">Reintentar</button>
        </section>
      } @else if (routines().length === 0) {
        <section class="card state">
          <h2>No routines yet.</h2>
          <p>Empieza con un plan guardado para que tus próximos entrenamientos tengan estructura.</p>
          <a class="primary" routerLink="/routines/new">Crea tu primera rutina</a>
        </section>
      } @else {
        <section class="grid">
          @for (routine of routines(); track routine.id) {
            <article class="card routine-card">
              <div class="routine-copy">
                <p class="eyebrow">UPDATED {{ formatDate(routine.updatedAt) }}</p>
                <h2>{{ routine.name }}</h2>
                <p>{{ routine.description || 'No description yet.' }}</p>
              </div>
              <div class="routine-actions">
                <a [routerLink]="['/routines', routine.id]">Open</a>
                <a [routerLink]="['/routines', routine.id, 'edit']">Editar</a>
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
    .hero, .routine-card, .routine-actions, .hero-actions { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { max-width: 42rem; margin: 0; color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; }
    .hero-actions, .routine-actions { align-items: center; flex-wrap: wrap; }
    a, button { border: 0; border-radius: .75rem; padding: .85rem 1rem; font: inherit; text-decoration: none; cursor: pointer; }
    a, button { background: #e8dfd0; color: #1f3028; }
    .primary { background: #1f3028; color: #fff; }
    .banner, .card { border-radius: 1.2rem; border: 1px solid #ded6c7; background: #fffdf8; }
    .banner { margin: 0 0 1rem; padding: .9rem 1rem; }
    .success { color: #1d5b3d; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
    .card { padding: 1.2rem; }
    .state { display: grid; gap: .75rem; justify-items: start; }
    .routine-card { min-height: 14rem; flex-direction: column; justify-content: space-between; }
    .routine-copy h2 { margin: .5rem 0; }
    .routine-copy p:last-child { color: #435248; }
    .error { margin: 0; color: #9d2f2f; }
  `,
})
export class RoutinesListPage {
  private readonly routinesService = inject(RoutinesService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly routines = signal<Routine[]>([]);
  protected readonly flashMessage = computed(() => {
    const deleted = this.route.snapshot.queryParamMap.get('deleted');
    if (deleted === '1') {
      return 'Routine deleted.';
    }

    const created = this.route.snapshot.queryParamMap.get('created');
    return created === '1' ? 'Rutina guardada.' : null;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    const subscription = this.routinesService.listMine().subscribe({
      next: (routines) => {
        this.routines.set(routines);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'We could not load your routines.'));
        this.loading.set(false);
      },
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
