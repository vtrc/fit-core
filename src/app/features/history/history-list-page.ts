import { Component, DestroyRef, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { HistoryService, type DateRange, type WorkoutHistoryItem } from './history.service';

@Component({
  selector: 'app-history-list-page',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './history-list-page.html',
  styleUrl: './history-list-page.scss',
})
export class HistoryListPage {
  private readonly history = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly workouts = signal<WorkoutHistoryItem[]>([]);

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

  protected clearDates(): void { this.dateRangeModel.set({ from: '', to: '' }); this.load(); }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)); }
  private toMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback; }
}
