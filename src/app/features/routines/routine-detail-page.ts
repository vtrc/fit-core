import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { RoutineDetail } from './routines.service';
import { RoutinesService } from './routines.service';

@Component({
  selector: 'app-routine-detail-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './routine-detail-page.html',
  styleUrl: './routine-detail-page.scss',
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
