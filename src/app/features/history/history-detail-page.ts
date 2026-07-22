import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { WorkoutDetails } from './history.service';
import { HistoryService } from './history.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-history-detail-page', standalone: true, imports: [RouterLink, PageHeaderComponent],
  templateUrl: './history-detail-page.html',
  styleUrl: './history-detail-page.scss',
})
export class HistoryDetailPage {
  private readonly history = inject(HistoryService); private readonly route = inject(ActivatedRoute); private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(true); protected readonly error = signal<string | null>(null); protected readonly workout = signal<WorkoutDetails | null>(null);
  constructor() { const id = this.route.snapshot.paramMap.get('id'); if (!id) { this.error.set('Los detalles del entrenamiento no están disponibles.'); this.loading.set(false); return; } const subscription = this.history.get(id).subscribe({ next: (workout) => { this.workout.set(workout); this.loading.set(false); }, error: (error: unknown) => { this.error.set(error instanceof Error && error.message ? error.message : 'No se pudo cargar este entrenamiento.'); this.loading.set(false); } }); this.destroyRef.onDestroy(() => subscription.unsubscribe()); }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(new Date(`${value}T00:00:00`)); }
  protected formatDuration(seconds: number): string { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${String(s).padStart(2, '0')}`; }
}
