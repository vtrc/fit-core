import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { Routine } from '../../core/domain/models';
import { RoutinesService } from '../routines/routines.service';
import { EntrenamientosService } from './workouts.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';
import { RoutineCardComponent } from '../../shared/routine-card/routine-card';

@Component({
  selector: 'app-workout-start-page',
  standalone: true,
  imports: [EmptyStateComponent, RoutineCardComponent],
  templateUrl: './workout-start-page.html',
  styleUrl: './workout-start-page.scss',
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

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
