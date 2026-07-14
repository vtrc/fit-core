import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { WorkoutDetails } from './history.service';
import { HistoryService } from './history.service';

@Component({
  selector: 'app-history-detail-page', standalone: true, imports: [RouterLink],
  template: `
    <main class="page"><header class="hero"><div><p class="eyebrow">DETALLE DEL ENTRENAMIENTO</p><h1>Registro del entrenamiento.</h1></div><a routerLink="/history">Volver al historial</a></header>
      @if (loading()) { <section class="card state" aria-live="polite"><p>Cargando los detalles del entrenamiento…</p></section> }
      @else if (error(); as message) { <section class="card state"><p class="error" role="alert">{{ message }}</p><a routerLink="/history">Volver al historial</a></section> }
      @else if (workout(); as item) { <section class="card summary"><p class="eyebrow">{{ formatDate(item.performedOn) }}</p><h2>{{ item.routineId ? 'Entrenamiento de rutina' : 'Entrenamiento libre' }}</h2><p>{{ item.notes || 'Sin notas del entrenamiento.' }}</p></section><section class="results" aria-label="Resultados de ejercicios"><h2>Resultados de ejercicios</h2>@for (detail of item.results; track detail.id) { <article class="card result"><div><p class="eyebrow">{{ detail.exercise.type }}</p><h3>{{ detail.exercise.name }}</h3><p>{{ detail.exercise.muscleGroups.join(', ') || 'Sin grupos musculares registrados' }}</p></div>@if (detail.result.kind === 'strength') { <dl><div><dt>Series</dt><dd>{{ detail.result.setsCompleted }}</dd></div><div><dt>Repeticiones</dt><dd>{{ detail.result.repetitionsTotal }}</dd></div><div><dt>Peso</dt><dd>{{ detail.result.weight }}</dd></div></dl> } @else { <dl><div><dt>Duración</dt><dd>{{ formatDuration(detail.result.durationSeconds) }}</dd></div><div><dt>Distancia</dt><dd>{{ detail.result.distance }}</dd></div></dl> } @if (detail.result.notes) { <p>{{ detail.result.notes }}</p> }</article> } @empty { <section class="card state"><p>No se guardaron resultados de ejercicios para este entrenamiento.</p></section> }</section> }
    </main>`,
  styles: `:host{display:block;min-height:100vh;background:#f5f1e8;color:#1f3028}.page{padding:2rem clamp(1rem,4vw,4rem) 3rem}.hero{display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}h1{margin:.6rem 0;font-size:clamp(2.4rem,7vw,4.6rem);line-height:.95}.eyebrow{margin:0;color:#a44a2c;font-size:.75rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.card{border:1px solid #ded6c7;border-radius:1.2rem;background:#fffdf8;padding:1.2rem}.summary{margin-bottom:1rem}.summary h2,.result h3{margin:.45rem 0}.results{display:grid;gap:1rem}.result{display:grid;gap:1rem}.result p{color:#435248}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:.75rem;margin:0}dl div{background:#f7f1e6;border-radius:.8rem;padding:.75rem}dt{font-size:.8rem}dd{margin:.25rem 0 0;font-size:1.1rem;font-weight:700}.state{display:grid;gap:.75rem;justify-items:start}.error{color:#9d2f2f}a{border-radius:.75rem;padding:.8rem 1rem;text-decoration:none;background:#e8dfd0;color:#1f3028}`,
})
export class HistoryDetailPage {
  private readonly history = inject(HistoryService); private readonly route = inject(ActivatedRoute); private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(true); protected readonly error = signal<string | null>(null); protected readonly workout = signal<WorkoutDetails | null>(null);
  constructor() { const id = this.route.snapshot.paramMap.get('id'); if (!id) { this.error.set('Workout details are unavailable.'); this.loading.set(false); return; } const subscription = this.history.get(id).subscribe({ next: (workout) => { this.workout.set(workout); this.loading.set(false); }, error: (error: unknown) => { this.error.set(error instanceof Error && error.message ? error.message : 'We could not load this workout.'); this.loading.set(false); } }); this.destroyRef.onDestroy(() => subscription.unsubscribe()); }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${value}T00:00:00`)); }
  protected formatDuration(seconds: number): string { const minutes = Math.floor(seconds / 60); return `${minutes}m ${seconds % 60}s`; }
}
