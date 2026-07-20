import { Component, DestroyRef, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { HistoryService, type DateRange, type WorkoutHistoryItem } from './history.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';
import { PageHeaderComponent } from '../../shared/page-header/page-header';
import { SwipeToDeleteDirective } from '../../shared/swipe-to-delete.directive';

@Component({
  selector: 'app-history-list-page',
  standalone: true,
  imports: [FormField, EmptyStateComponent, PageHeaderComponent, SwipeToDeleteDirective],
  templateUrl: './history-list-page.html',
  styleUrl: './history-list-page.scss',
})
export class HistoryListPage {
  private readonly history = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly workouts = signal<WorkoutHistoryItem[]>([]);
  protected readonly deletingId = signal<string | null>(null);

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
       error: (error: unknown) => { this.error.set(this.toMessage(error, 'No se pudo cargar tu historial de entrenamientos.')); this.loading.set(false); },
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected viewDetails(id: string): void { this.router.navigate(['/history', id]); }

  protected deleteWorkout(id: string): void {
    if (this.deletingId()) return;
    if (!confirm('¿Eliminar este entrenamiento del historial?')) return;

    this.deletingId.set(id);
    const subscription = this.history.delete(id).subscribe({
      next: () => {
        this.workouts.update((list) => list.filter((w) => w.id !== id));
        this.deletingId.set(null);
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'No se pudo eliminar el entrenamiento.'));
        this.deletingId.set(null);
      },
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected clearDates(): void { this.dateRangeModel.set({ from: '', to: '' }); this.load(); }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  private toMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback; }
}
