import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { type StatisticsOverview, StatisticsService } from './statistics.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';
import { PageHeaderComponent } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-statistics-page', standalone: true, imports: [DecimalPipe, FormField, RouterLink, EmptyStateComponent, PageHeaderComponent],
  templateUrl: './statistics-page.html',
  styleUrl: './statistics-page.scss',
})
export class StatisticsPage {
  private readonly statistics = inject(StatisticsService); private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(true); protected readonly error = signal<string | null>(null); protected readonly overview = signal<StatisticsOverview | null>(null); protected readonly maxTrendVolume = computed(() => Math.max(...(this.overview()?.volumeTrend.map((point) => point.volume) ?? [0]), 0));

  protected readonly dateRangeModel = signal({ from: '', to: '' });
  protected readonly dateRangeForm = form(this.dateRangeModel);

  constructor() { this.load(); }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.load();
  }

  protected load(): void { this.loading.set(true); this.error.set(null); const subscription = this.statistics.getOverview({ from: this.dateRangeModel().from || null, to: this.dateRangeModel().to || null }).subscribe({ next: (overview) => { this.overview.set(overview); this.loading.set(false); }, error: (error: unknown) => { this.error.set(error instanceof Error && error.message ? error.message : 'No se pudieron calcular las estadísticas.'); this.loading.set(false); } }); this.destroyRef.onDestroy(() => subscription.unsubscribe()); }
  protected clearDates(): void { this.dateRangeModel.set({ from: '', to: '' }); this.load(); } protected trendWidth(value: number): number { const max = this.maxTrendVolume(); return max === 0 ? 0 : (value / max) * 100; } protected muscleBarWidth(exercises: number): number { const groups = this.overview()?.muscleGroups; if (!groups || groups.length === 0) return 0; const max = Math.max(...groups.map((g) => g.exercises)); return max === 0 ? 0 : (exercises / max) * 100; } protected formatDuration(seconds: number): string { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`; } protected formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
}
