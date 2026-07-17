import { Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, debounce } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { EntrenamientosService, type WorkoutSummaryModel } from './workouts.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-workout-summary-page',
  standalone: true,
  imports: [FormField, RouterLink, PageHeaderComponent],
  templateUrl: './workout-summary-page.html',
  styleUrl: './workout-summary-page.scss',
})
export class WorkoutSummaryPage {
  private readonly workoutsService = inject(EntrenamientosService);
  private readonly router = inject(Router);

  protected readonly session = this.workoutsService.session;
  protected readonly saving = this.workoutsService.saving;
  protected readonly saveError = signal<string | null>(null);
  protected readonly completedCount = computed(() => this.session()?.exercises.filter((e) => e.result !== null).length ?? 0);
  protected readonly skippedCount = computed(() => this.session()?.exercises.filter((e) => e.skipped && e.result === null).length ?? 0);
  protected readonly summary = computed(() => this.createDraftSummary());

  protected readonly notesModel = signal({ notes: '' });
  protected readonly notesForm = form(this.notesModel, (p) => {
    debounce(p.notes, 300);
  });

  constructor() {
    effect(() => {
      const session = this.session();
      if (session) {
        if (this.notesModel().notes !== session.notes) {
          this.notesModel.set({ notes: session.notes });
        }
      }
    });

    effect(() => {
      const notes = this.notesModel().notes;
      if (this.session()?.notes !== notes) {
        this.workoutsService.updateNotes(notes);
      }
    });
  }

  protected save(): void {
    if (this.completedCount() === 0 || this.saving()) {
      return;
    }

    this.saveError.set(null);
    this.workoutsService.saveSession().subscribe({
      next: () => {
        this.saveError.set(null);
        this.router.navigate(['/history']);
      },
      error: (error: unknown) => {
        this.saveError.set(this.toMessage(error, 'Error al guardar. No se confirmó que el entrenamiento se haya guardado.'));
      },
    });
  }

  protected async discard(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.workoutsService.clearSession();
    await this.router.navigate(['/workouts/start']);
  }

  protected formatDate(value: string): string {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(value);
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date);
  }

  protected formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0 && remainingSeconds > 0) return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    if (minutes > 0) return `${minutes}:00`;
    return `0:${String(remainingSeconds).padStart(2, '0')}`;
  }

  private createDraftSummary(): WorkoutSummaryModel | null {
    const session = this.session();
    if (!session) {
      return null;
    }

    const plannedCount = session.exercises.length;
    const completedCount = this.completedCount();
    const skippedCount = this.skippedCount();
    return {
      routineName: session.routineName ?? 'Entrenamiento libre',
      performedOn: session.startedAt,
      plannedCount,
      completedCount,
      skippedCount,
      completionPercentage: plannedCount === 0 ? 0 : Math.round((completedCount / plannedCount) * 100),
      durationSeconds: null,
    };
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
