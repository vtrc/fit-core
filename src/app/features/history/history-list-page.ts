import { Component, DestroyRef, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import type { Workout } from '../../core/domain/models';
import { HistoryService, type DateRange } from './history.service';

@Component({
  selector: 'app-history-list-page',
  standalone: true,
  imports: [FormField, RouterLink],
  template: `
    <main class="page">
      <header class="hero">
        <div><p class="eyebrow">HISTORIAL</p><h1>Tus entrenamientos completados.</h1><p class="lede">Revisa tus sesiones registradas por fecha.</p></div>
        <div class="actions"><a routerLink="/dashboard">Volver al panel</a><a routerLink="/statistics">Ver estadísticas</a></div>
      </header>

      <form class="card filters" (submit)="onSubmit($event)" aria-label="Filter workout history">
        <label><span>Desde</span><input type="date" [formField]="dateRangeForm.from" /></label>
        <label><span>Hasta</span><input type="date" [formField]="dateRangeForm.to" /></label>
        <button type="submit" [disabled]="loading()">Aplicar fechas</button>
        <button type="button" (click)="clearDates()" [disabled]="loading()">Limpiar</button>
      </form>

      @if (error(); as message) {
        <p class="banner error" role="alert">{{ message }}</p>
      }
      @if (loading()) {
        <section class="card state" aria-live="polite"><p>Cargando el historial de entrenamientos…</p></section>
      } @else if (workouts().length === 0) {
        <section class="card state"><h2>No se encontraron entrenamientos.</h2><p>Completa un entrenamiento para verlo en tu historial.</p><a class="primary" routerLink="/workouts/start">Iniciar entrenamiento</a></section>
      } @else {
        <section class="grid" aria-label="Workout history">
          @for (workout of workouts(); track workout.id) {
            <article class="card workout-card">
              <div><p class="eyebrow">{{ formatDate(workout.performedOn) }}</p><h2>{{ workout.routineId ? 'Entrenamiento de rutina' : 'Entrenamiento libre' }}</h2><p>{{ workout.notes || 'Sin notas del entrenamiento.' }}</p></div>
              <a [routerLink]="['/history', workout.id]" [attr.aria-label]="'Ver entrenamiento del ' + formatDate(workout.performedOn)">Ver detalles</a>
            </article>
          }
        </section>
      }
    </main>
  `,
  styles: `
    :host { display:block; min-height:100vh; background:#f5f1e8; color:#1f3028; } .page { padding:2rem clamp(1rem,4vw,4rem) 3rem; } .hero,.actions,.filters,.workout-card { display:flex; gap:1rem; } .hero { justify-content:space-between; align-items:end; flex-wrap:wrap; margin-bottom:1.5rem; } h1 { margin:.6rem 0; font-size:clamp(2.4rem,7vw,4.6rem); line-height:.95; } .lede { color:#435248; } .eyebrow { margin:0; color:#a44a2c; font-size:.75rem; font-weight:800; letter-spacing:.16em; text-transform:uppercase; } .card,.banner { border:1px solid #ded6c7; border-radius:1.2rem; background:#fffdf8; padding:1.2rem; } .filters { align-items:end; flex-wrap:wrap; margin-bottom:1rem; } label { display:grid; gap:.35rem; font-weight:700; } input { border:1px solid #c8bca7; border-radius:.65rem; padding:.65rem; font:inherit; } .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(17rem,1fr)); gap:1rem; } .workout-card { min-height:12rem; flex-direction:column; justify-content:space-between; } .workout-card h2 { margin:.45rem 0; } .workout-card p:last-child { color:#435248; } .state { display:grid; gap:.75rem; justify-items:start; } .actions { flex-wrap:wrap; } a,button { border:0; border-radius:.75rem; padding:.8rem 1rem; font:inherit; text-decoration:none; cursor:pointer; background:#e8dfd0; color:#1f3028; } .primary { background:#1f3028; color:#fff; } .banner { margin-bottom:1rem; } .error { color:#9d2f2f; } button:disabled { opacity:.65; cursor:not-allowed; }
  `,
})
export class HistoryListPage {
  private readonly history = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly workouts = signal<Workout[]>([]);

  protected readonly dateRangeModel = signal({ from: '', to: '' });
  protected readonly dateRangeForm = form(this.dateRangeModel);

  constructor() { this.load(); }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.load();
  }

  protected load(): void {
    this.loading.set(true); this.error.set(null);
    const range: DateRange = { from: this.dateRangeModel().from || null, to: this.dateRangeModel().to || null };
    const subscription = this.history.listMine(range).subscribe({
      next: (workouts) => { this.workouts.set(workouts); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(this.toMessage(error, 'We could not load your workout history.')); this.loading.set(false); },
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected clearDates(): void { this.dateRangeModel.set({ from: '', to: '' }); this.load(); }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)); }
  private toMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback; }
}
