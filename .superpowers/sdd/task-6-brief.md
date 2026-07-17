### Task 6: Routines list — mobile layout, skeleton, pull-to-refresh

**Files:**
- Modify: `src/app/features/routines/routines-list-page.html`
- Modify: `src/app/features/routines/routines-list-page.scss`
- Modify: `src/app/features/routines/routines-list-page.ts`

**Produces:** Full mobile-friendly list: skeleton cards while loading, pull-to-refresh via touch events, swipe-to-delete wired up on each card, tighter spacing.

- [ ] **Replace routines-list-page.html**

```html
<main
  (touchstart)="onTouchStart($event)"
  (touchmove)="onTouchMove($event)"
  (touchend)="onTouchEnd($event)"
  [style.transform]="pullTransform()"
  [style.transition]="pullTransition()"
>
  <header class="hero">
    <div>
       <p class="eyebrow">RUTINAS</p>
       <h1>Tus rutinas.</h1>
      <p class="lede">Crea, revisa y mejora sesiones reutilizables antes de entrenar.</p>
    </div>
    <div class="hero-actions">
      <a class="btn-primary" routerLink="/routines/new">Crear rutina</a>
    </div>
  </header>

  @if (flashMessage(); as message) {
    <p class="banner success">{{ message }}</p>
  }

  @if (pullToRefresh()) {
    <div class="ptr-indicator">
      <span class="ptr-spinner"></span>
    </div>
  }

  @if (loading()) {
    <section class="grid">
      <div class="skeleton-card"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>
      <div class="skeleton-card"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>
      <div class="skeleton-card"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>
    </section>
  } @else if (error(); as errorMessage) {
    <section class="card state">
      <p class="error">{{ errorMessage }}</p>
      <button type="button" (click)="load()">Reintentar</button>
    </section>
  } @else if (routines().length === 0) {
    <app-empty-state
      title="Aún no tienes rutinas."
      description="Empieza con un plan guardado para que tus próximos entrenamientos tengan estructura."
      actionText="Crea tu primera rutina"
      actionRoute="/routines/new"
    />
  } @else {
    <section class="grid">
      @for (routine of routines(); track routine.id) {
        <app-routine-card
          appSwipeToDelete
          (swiped)="deleteRoutine(routine.id)"
          [eyebrow]="'Actualizada ' + formatDate(routine.updatedAt)"
          [name]="routine.name"
          [description]="routine.description"
        >
          <a class="btn-primary" [routerLink]="['/routines', routine.id, 'edit']">Ver rutina</a>
          <button type="button" class="btn-secondary" (click)="deleteRoutine(routine.id)" [disabled]="deletingId() === routine.id">Borrar</button>
        </app-routine-card>
      }
    </section>
  }
</main>
```

- [ ] **Replace routines-list-page.ts**

```ts
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { Routine } from '../../core/domain/models';
import { RoutinesService } from './routines.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';
import { RoutineCardComponent } from '../../shared/routine-card/routine-card';
import { SwipeToDeleteDirective } from './swipe-to-delete.directive';

@Component({
  selector: 'app-routines-list-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, RoutineCardComponent, SwipeToDeleteDirective],
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
```

- [ ] **Replace routines-list-page.scss**

```scss
:host {
  display: block;
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
}

.success {
  color: var(--success);
  background: var(--success-bg);
}

.banner {
  padding: 0.9rem var(--space-4);
}

.error {
  margin: 0;
  color: var(--danger);
}

.ptr-indicator {
  display: flex;
  justify-content: center;
  padding: var(--space-3) 0;
}

.ptr-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--ink);
  border-radius: 50%;
  animation: ptr-spin 0.6s linear infinite;
}

@keyframes ptr-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .banner {
    padding: 0.75rem var(--space-3);
    font-size: 0.9rem;
  }
}
```

- [ ] **Verify build**

```bash
npx ng build
```
