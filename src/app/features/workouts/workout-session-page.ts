import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { ExerciseType } from '../../core/domain/models';
import { EntrenamientosService, type WorkoutSessionExercise } from './workouts.service';

interface TimerState {
  exerciseName: string;
  restSeconds: number;
  remaining: number;
  running: boolean;
}

@Component({
  selector: 'app-workout-session-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workout-session-page.html',
  styleUrl: './workout-session-page.scss',
})
export class WorkoutSessionPage {
  private readonly workoutsService = inject(EntrenamientosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly session = this.workoutsService.session;
  protected readonly plannedCount = this.workoutsService.plannedCount;
  protected readonly completedCount = this.workoutsService.completedCount;
  protected readonly remainingCount = this.workoutsService.remainingCount;
  protected readonly saving = this.workoutsService.saving;
  protected readonly timerState = signal<TimerState | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimerInterval());
  }

  protected toggleComplete(item: WorkoutSessionExercise): void {
    this.workoutsService.toggleComplete(item.sessionExerciseId);
  }

  protected openTimer(item: WorkoutSessionExercise): void {
    this.clearTimerInterval();
    this.timerState.set({
      exerciseName: item.exercise.name,
      restSeconds: item.restSeconds ?? 60,
      remaining: item.restSeconds ?? 60,
      running: true,
    });
    this.startTimer();
  }

  protected closeTimer(): void {
    this.clearTimerInterval();
    this.timerState.set(null);
  }

  protected startTimer(): void {
    this.timerState.update((state) => {
      if (!state || state.remaining === 0) return state;
      return { ...state, running: true };
    });

    this.clearTimerInterval();
    this.timerInterval = setInterval(() => {
      const current = this.timerState();
      if (!current || !current.running) return;

      if (current.remaining <= 1) {
        this.timerState.set({ ...current, remaining: 0, running: false });
        this.clearTimerInterval();
        this.beep();
      } else {
        this.timerState.set({ ...current, remaining: current.remaining - 1 });
      }
    }, 1000);
  }

  protected pauseTimer(): void {
    this.clearTimerInterval();
    this.timerState.update((state) => {
      if (!state) return state;
      return { ...state, running: false };
    });
  }

  protected resetTimer(): void {
    this.clearTimerInterval();
    this.timerState.update((state) => {
      if (!state) return state;
      return { ...state, remaining: state.restSeconds, running: false };
    });
  }

  protected formatTimer(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  protected async finish(): Promise<void> {
    if (this.completedCount() === 0) {
      return;
    }

    await this.router.navigate(['/workouts/summary']);
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

  protected exerciseTypeLabel(type: ExerciseType): string {
    return type === 'strength' ? 'Fuerza' : 'Cardio';
  }

  private clearTimerInterval(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private beep(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio not available
    }
  }
}
