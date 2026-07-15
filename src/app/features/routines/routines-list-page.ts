import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { Routine } from '../../core/domain/models';
import { RoutinesService } from './routines.service';

@Component({
  selector: 'app-routines-list-page',
  standalone: true,
  imports: [RouterLink],
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
  protected readonly flashMessage = computed(() => {
    const deleted = this.route.snapshot.queryParamMap.get('deleted');
    if (deleted === '1') {
      return 'Routine deleted.';
    }

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
      },
      error: (error: unknown) => {
        this.error.set(this.toMessage(error, 'We could not load your routines.'));
        this.loading.set(false);
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

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
