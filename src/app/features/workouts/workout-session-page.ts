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
  template: `
    <main class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">ENTRENAMIENTO EN CURSO</p>
          <h1>{{ session()?.routineName || 'Entrenamiento libre' }}</h1>
          <p class="lede">Marca los ejercicios según los completes.</p>
        </div>
        <div class="hero-actions">
          @if (saving()) {
            <button type="button" disabled>Empezar de nuevo</button>
          } @else {
            <a routerLink="/workouts/start">Empezar de nuevo</a>
          }
          <button type="button" class="primary" (click)="finish()" [disabled]="completedCount() === 0">Finalizar Entrenamiento</button>
        </div>
      </header>

      @if (!session()) {
        <section class="card state">
          <h2>No hay ningún entrenamiento activo.</h2>
          <p>Primero inicia un entrenamiento basado en una rutina o un entrenamiento libre.</p>
          <a class="primary" routerLink="/workouts/start">Iniciar entrenamiento</a>
        </section>
      } @else {
        <section class="card progress-card" aria-labelledby="progress-heading">
          <div class="progress-heading">
            <h2 id="progress-heading">Progreso del entrenamiento</h2>
            <strong>{{ completedCount() }} de {{ plannedCount() }} ejercicios completados</strong>
          </div>
          <progress [value]="completedCount()" [max]="plannedCount() || 1" aria-label="Progreso de ejercicios completados"></progress>
        </section>

        <section class="stats">
          <article class="card stat"><span>Planificados</span><strong>{{ plannedCount() }}</strong></article>
          <article class="card stat"><span>Completados</span><strong>{{ completedCount() }}</strong></article>
          <article class="card stat"><span>Pendientes</span><strong>{{ remainingCount() }}</strong></article>
        </section>

        <section class="exercise-list">
          @if (session()!.exercises.length === 0) {
            <article class="card state">
              <h2>No hay ejercicios en este entrenamiento.</h2>
              <p>Los entrenamientos libres empiezan vacíos. Vuelve a empezar con una rutina o añade ejercicios desde el inicio.</p>
              <a class="primary" routerLink="/workouts/start">Volver al inicio</a>
            </article>
          }

          @for (item of session()!.exercises; track item.sessionExerciseId) {
            <article
              class="card exercise-card"
              [class.completed]="item.result !== null"
              role="option"
              aria-selected="item.result !== null"
            >
              <label class="check-wrap">
                <input
                  type="checkbox"
                  class="check-input"
                  [checked]="item.result !== null"
                  (change)="toggleComplete(item)"
                  [attr.aria-label]="'Marcar ' + item.exercise.name + ' como ' + (item.result !== null ? 'pendiente' : 'completado')"
                />
                <span class="check-visual" aria-hidden="true">{{ item.result !== null ? '✓' : '' }}</span>
              </label>

              <div class="card-body">
                <div class="card-head">
                  <p class="eyebrow">{{ exerciseTypeLabel(item.exercise.type) }}</p>
                  <h3>{{ item.exercise.name }}</h3>
                  <p class="equip">{{ item.exercise.equipment || 'Equipamiento general' }}</p>
                </div>

                @if (item.exercise.type === 'strength') {
                  <div class="targets">
                    <span class="tag">Series <strong>{{ displayMetric(item.plannedSets) }}</strong></span>
                    <span class="tag">Repeticiones <strong>{{ displayMetric(item.plannedRepetitions) }}</strong></span>
                    <span class="tag">Peso <strong>{{ displayMetric(item.plannedWeight) }} kg</strong></span>
                    <span class="tag">Descanso <strong>{{ formatRest(item.restSeconds) }}</strong></span>
                  </div>
                } @else {
                  <div class="targets">
                    <span class="tag">Duración <strong>{{ displayMetric(item.plannedDurationSeconds) }} seg</strong></span>
                    <span class="tag">Distancia <strong>{{ displayMetric(item.plannedDistance) }}</strong></span>
                  </div>
                }

                @if (item.notes) {
                  <p class="notes">{{ item.notes }}</p>
                }
              </div>

              @if (item.restSeconds !== null && item.restSeconds > 0) {
                <button type="button" class="timer-btn" (click)="openTimer(item)" aria-label="Abrir temporizador de descanso" title="Temporizador">⏱</button>
              }
            </article>
          }
        </section>

        @if (timerState(); as timer) {
          <div class="timer-overlay" (click)="closeTimer()">
            <div class="timer-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Temporizador de descanso">
              <div class="timer-head">
                <h2>{{ timer.exerciseName }}</h2>
                <button type="button" class="timer-close" (click)="closeTimer()" aria-label="Cerrar temporizador">×</button>
              </div>

              <div class="timer-display" [class.timer-expired]="timer.remaining === 0">{{ formatTimer(timer.remaining) }}</div>

              <div class="timer-controls">
                @if (timer.remaining === 0) {
                  <p class="timer-done">¡Tiempo!</p>
                  <button type="button" class="primary" (click)="resetTimer()">Reiniciar</button>
                  <button type="button" (click)="closeTimer()">Cerrar</button>
                } @else {
                  @if (timer.running) {
                    <button type="button" class="primary" (click)="pauseTimer()">Pausa</button>
                  } @else {
                    <button type="button" class="primary" (click)="startTimer()">Iniciar</button>
                  }
                  <button type="button" (click)="resetTimer()">Reiniciar</button>
                  <button type="button" (click)="closeTimer()">Cerrar</button>
                }
              </div>
            </div>
          </div>
        }
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f5f1e8; color: #1f3028; }
    .page { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 4rem) 3rem; }
    .hero, .hero-actions, .stats, .progress-heading { display: flex; gap: 1rem; }
    .hero { justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .hero h1 { margin: .6rem 0; font-size: clamp(2.4rem, 7vw, 4.6rem); line-height: .95; }
    .lede { color: #435248; }
    .eyebrow { margin: 0; color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .card, .banner { border: 1px solid #ded6c7; border-radius: 1.25rem; background: #fffdf8; padding: 1.2rem; }
    .banner { margin: 0 0 1rem; }
    .error { color: #9d2f2f; }
    .progress-card { display: grid; gap: .75rem; margin-bottom: 1rem; }
    .progress-heading { justify-content: space-between; align-items: baseline; flex-wrap: wrap; }
    .progress-heading h2 { margin: 0; font-size: 1rem; }
    progress { width: 100%; height: .75rem; accent-color: #1f3028; }
    .stats { flex-wrap: wrap; margin-bottom: 1rem; }
    .stat { min-width: 9rem; display: grid; gap: .25rem; }
    .stat span { color: #617064; }
    .stat strong { font-size: 1.6rem; }
    .exercise-list { display: grid; gap: .7rem; }

    .exercise-card { display: flex; align-items: center; gap: 1rem; transition: background .12s; }
    .exercise-card.completed { background: #eef7f1; }

    .check-wrap { flex: 0 0 auto; display: grid; place-items: center; width: 2.5rem; height: 2.5rem; cursor: pointer; }
    .check-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .check-visual { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border: 2px solid #c8bca7; border-radius: 50%; font-size: 1.25rem; font-weight: 800; color: transparent; transition: all .12s; }
    .check-input:focus-visible + .check-visual { outline: 2px solid #1f3028; outline-offset: 2px; }
    .exercise-card.completed .check-visual { border-color: #1f3028; background: #1f3028; color: #fff; }

    .card-body { flex: 1; min-width: 0; display: grid; gap: .6rem; }
    .card-head h3 { margin: .15rem 0; }
    .equip { color: #435248; font-size: .87rem; margin: 0; }
    .targets { display: flex; flex-wrap: wrap; gap: .45rem; }
    .tag { padding: .4rem .7rem; background: #f7f1e6; border-radius: .6rem; font-size: .85rem; white-space: nowrap; }
    .tag strong { margin-left: .25rem; }
    .notes { color: #435248; font-size: .88rem; margin: 0; }

    .timer-btn { flex: 0 0 auto; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; padding: 0; font-size: 1.3rem; line-height: 1; margin-top: .15rem; }

    .timer-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(0,0,0,.45); animation: fadeIn .15s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .timer-modal { width: min(22rem, calc(100vw - 2rem)); display: grid; gap: 1.25rem; padding: 1.5rem; background: #fffdf8; border: 1px solid #ded6c7; border-radius: 1.5rem; box-shadow: 0 .5rem 2rem rgba(0,0,0,.15); animation: scaleIn .15s ease-out; }
    @keyframes scaleIn { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .timer-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .timer-head h2 { margin: 0; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timer-close { flex: 0 0 auto; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; padding: 0; font-size: 1.3rem; line-height: 1; border-radius: 50%; background: #e8dfd0; }
    .timer-display { text-align: center; font-size: clamp(2.5rem, 15vw, 4rem); font-weight: 800; letter-spacing: .05em; font-variant-numeric: tabular-nums; color: #1f3028; }
    .timer-display.timer-expired { color: #a44a2c; animation: pulse .5s ease-in-out 3; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
    .timer-controls { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
    .timer-controls button { min-width: 6rem; justify-content: center; }
    .timer-done { margin: 0; font-weight: 700; font-size: 1.1rem; color: #a44a2c; text-align: center; }

    a, button { border: 0; border-radius: .75rem; padding: .8rem 1rem; font: inherit; text-decoration: none; cursor: pointer; background: #e8dfd0; color: #1f3028; }
    .primary { background: #1f3028; color: #fff; }
    button:disabled { opacity: .65; cursor: not-allowed; }
    .state { display: grid; gap: .75rem; justify-items: start; }
    @media (max-width: 700px) {
      .page { padding: 1rem .75rem 2rem; }
      .hero { align-items: start; gap: .9rem; margin-bottom: 1rem; }
      .hero h1 { font-size: clamp(2rem, 11vw, 3rem); }
      .hero-actions { width: 100%; }
      .hero-actions a, .hero-actions button { flex: 1; text-align: center; }
      .stats { gap: .5rem; }
      .stat { min-width: 6rem; padding: .8rem; }
      .stat strong { font-size: 1.3rem; }
      .exercise-card { padding: .85rem; }
      .check-wrap { width: 2rem; height: 2rem; }
      .check-visual { width: 2rem; height: 2rem; font-size: 1rem; }
      .targets { gap: .35rem; }
      .tag { font-size: .8rem; padding: .3rem .55rem; }
    }
  `,
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
