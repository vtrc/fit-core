import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { Routine } from '../../core/domain/models';
import { RoutinesService } from './routines.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';
import { RoutineCardComponent } from '../../shared/routine-card/routine-card';
import { SwipeToDeleteDirective } from './swipe-to-delete.directive';
import { PageHeaderComponent } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-routines-list-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, RoutineCardComponent, SwipeToDeleteDirective, PageHeaderComponent],
  templateUrl: './routines-list-page.html',
  styleUrl: './routines-list-page.scss',
})
export class RoutinesListPage {
  private readonly routinesService = inject(RoutinesService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly routines = signal<Routine[]>([]);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly pullToRefresh = signal(false);
  protected readonly pullTransform = signal('');
  protected readonly pullTransition = signal('');

  private touchStartY = 0;
  private touchCurrentY = 0;
  private isPulling = false;

  protected readonly flashMessage = computed(() => {
    const deleted = this.route.snapshot.queryParamMap.get('deleted');
    if (deleted === '1') return 'Routine deleted.';
    const created = this.route.snapshot.queryParamMap.get('created');
    return created === '1' ? 'Rutina guardada.' : null;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    const subscription = this.routinesService.listMine().subscribe({
      next: (routines) => {
        this.routines.set(routines);
        this.loading.set(false);
        this.pullDragEnd();
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'We could not load your routines.'));
        this.loading.set(false);
        this.pullDragEnd();
      },
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }

  protected deleteRoutine(id: string): void {
    if (this.deletingId()) return;
    if (!confirm('¿Eliminar esta rutina?')) return;

    this.deletingId.set(id);
    this.routinesService.delete(id).subscribe({
      next: () => {
        this.routines.update((list) => list.filter((r) => r.id !== id));
        this.deletingId.set(null);
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'No se pudo eliminar la rutina.'));
        this.deletingId.set(null);
      },
    });
  }

  protected onTouchStart(event: TouchEvent): void {
    if (window.scrollY > 0) return;
    this.touchStartY = event.touches[0].clientY;
    this.isPulling = false;
  }

  protected onTouchMove(event: TouchEvent): void {
    if (window.scrollY > 0) return;
    this.touchCurrentY = event.touches[0].clientY;
    const diff = this.touchCurrentY - this.touchStartY;

    if (diff > 0) {
      this.isPulling = true;
      this.pullTransition.set('');
      const damped = Math.min(diff * 0.4, 80);
      this.pullTransform.set(`translateY(${damped}px)`);
      this.pullToRefresh.set(damped >= 60);
    }
  }

  protected onTouchEnd(): void {
    if (!this.isPulling) return;

    if (this.pullToRefresh()) {
      this.pullTransition.set('transform 0.2s ease');
      this.pullTransform.set('translateY(0)');
      this.pullToRefresh.set(false);
      this.load();
    } else {
      this.pullDragEnd();
    }
  }

  private pullDragEnd(): void {
    this.pullTransition.set('transform 0.2s ease');
    this.pullTransform.set('translateY(0)');
    this.pullToRefresh.set(false);
    this.isPulling = false;
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
