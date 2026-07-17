# Routines Mobile-Friendly — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/routines` list page and shell navigation fully mobile-friendly with native-feel touch interactions, optimized layout, skeleton loading, and view transitions.

**Architecture:** Enhance existing Angular 22 components with native touch events for pull-to-refresh and swipe-to-delete. CSS-driven responsive improvements. No new dependencies — use native Touch Events API and CSS View Transitions API.

**Tech Stack:** Angular 22, SCSS, native Touch Events, CSS View Transitions API

**Global Constraints:**
- No tests of any kind
- No new npm dependencies
- Use existing design tokens (`--ink`, `--parchment`, `--fill-soft`, etc.)

---

## File Structure

| Action | File |
|---|---|
| Modify | `src/app/app.config.ts` |
| Modify | `src/styles.scss` |
| Modify | `src/app/shared/shell/shell.scss` |
| Modify | `src/app/features/routines/routines-list-page.html` |
| Modify | `src/app/features/routines/routines-list-page.scss` |
| Modify | `src/app/features/routines/routines-list-page.ts` |
| Modify | `src/app/shared/routine-card/routine-card.scss` |
| Create | `src/app/features/routines/swipe-to-delete.directive.ts` |

---

### Task 1: Enable View Transitions

**Files:**
- Modify: `src/app/app.config.ts`

**Produces:** `withViewTransitions()` enabled on router — `<router-outlet>` transitions get a crossfade by default without any extra CSS.

- [ ] **Add `withViewTransitions` import and option**

```ts
import { provideRouter, withViewTransitions } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
  ],
};
```

- [ ] **Verify build**

```bash
npx ng build
```

---

### Task 2: Shell — mobile padding, 44px nav tap targets

**Files:**
- Modify: `src/app/shared/shell/shell.scss`

**Produces:** Reduced horizontal padding on mobile (1rem vs 1.6rem). Bottom nav taller (4rem) with 44px min-height items. Nav label text smaller (0.65rem) to compensate.

- [ ] **Replace entire shell.scss**

```scss
.shell {
  --footer-height: calc(4rem + env(safe-area-inset-bottom));
  min-height: 100dvh;
  padding: 1rem 1rem;
  padding-bottom: var(--footer-height);
  background: var(--parchment);
}

.nav-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  border-top: 1px solid var(--border-default);
  background: var(--paper);
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.4rem 0;
  min-height: 44px;
  text-decoration: none;
  color: var(--ink-muted);
  font-size: 0.65rem;
  border-radius: 0;
  background: transparent;
  transition: color 0.15s;
}

.nav-item.active {
  color: var(--ink);
}

.nav-icon {
  width: 1.4rem;
  height: 1.4rem;
  display: block;
}

.nav-label {
  font-weight: 600;
}

@media (min-width: 640px) {
  .shell {
    padding: 1rem 1.6rem;
    padding-bottom: var(--footer-height);
  }
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

### Task 3: Global responsive + skeleton styles

**Files:**
- Modify: `src/styles.scss`

**Produces:** 480px breakpoint (hide lede, tighter hero). Skeleton shimmer keyframes + `.skeleton-card` / `.skeleton-line` classes for loading state.

- [ ] **After the `@media (max-width: 640px)` block (~line 229), add 480px breakpoint**

```scss
@media (max-width: 480px) {
  .hero .lede {
    display: none;
  }

  .hero {
    margin-bottom: var(--space-4);
  }
}
```

- [ ] **After the buttons section (~line 351), add skeleton styles**

```scss
/* ── Skeleton loading ──────────────────────────────────── */

.skeleton {
  background: var(--fill-soft);
  border-radius: var(--radius-md);
  animation: shimmer 1.5s ease-in-out infinite;
  background-image: linear-gradient(
    90deg,
    var(--fill-soft) 0%,
    var(--fill-hover) 50%,
    var(--fill-soft) 100%
  );
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  min-height: 10rem;
  box-shadow: var(--elevation-card);
  border-radius: var(--radius-lg);
  background: var(--paper);
}

.skeleton-card .skeleton-line {
  height: 0.7rem;
  border-radius: var(--radius-sm);
}

.skeleton-card .skeleton-line:first-child {
  width: 35%;
}

.skeleton-card .skeleton-line:nth-child(2) {
  width: 65%;
  height: 1.2rem;
}

.skeleton-card .skeleton-line:nth-child(3) {
  width: 45%;
}

.skeleton-card .skeleton-line:last-child {
  width: 30%;
  height: 2.5rem;
  margin-top: auto;
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

### Task 4: Routine card — tighter mobile spacing, 44px buttons

**Files:**
- Modify: `src/app/shared/routine-card/routine-card.scss`

**Produces:** Card padding reduced on mobile, 44px min-height enforced on action buttons, smaller gap between action buttons.

- [ ] **Replace entire routine-card.scss**

```scss
:host {
  display: block;
}

.routine-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  min-height: 10rem;
}

.routine-body h2 {
  margin: var(--space-2) 0;
  font-size: 1.25rem;
  line-height: 1.3;
  text-wrap: balance;
}

.routine-desc {
  color: var(--ink-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  display: -webkit-box;
  overflow: hidden;
  margin-bottom: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.routine-actions {
  display: flex;
  gap: var(--space-3);
}

.routine-actions ::ng-deep > * {
  flex: 1;
  text-align: center;
  padding: 0.65rem var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 600;
  min-height: 44px;
  display: grid;
  place-items: center;
}

@media (max-width: 480px) {
  .routine-card {
    padding: var(--space-4);
    min-height: 8rem;
  }

  .routine-actions {
    gap: var(--space-2);
  }
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

### Task 5: Swipe-to-delete directive

**Files:**
- Create: `src/app/features/routines/swipe-to-delete.directive.ts`

**Produces:** Reusable directive that emits `swiped` when user swipes left >80px. Card visually follows finger, snaps back if under threshold.

- [ ] **Create swipe-to-delete directive**

```ts
import { Directive, ElementRef, EventEmitter, inject, Output } from '@angular/core';

@Directive({
  selector: '[appSwipeToDelete]',
  standalone: true,
})
export class SwipeToDeleteDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  @Output() swiped = new EventEmitter<void>();

  private startX = 0;
  private currentX = 0;
  private isDragging = false;
  private readonly threshold = 80;

  constructor() {
    const el = this.el.nativeElement;
    el.addEventListener('touchstart', (e) => this.onStart(e), { passive: true });
    el.addEventListener('touchmove', (e) => this.onMove(e), { passive: true });
    el.addEventListener('touchend', () => this.onEnd());
    el.addEventListener('touchcancel', () => this.onCancel());
  }

  private onStart(e: TouchEvent): void {
    this.startX = e.touches[0].clientX;
    this.isDragging = true;
    this.el.nativeElement.style.transition = 'none';
  }

  private onMove(e: TouchEvent): void {
    if (!this.isDragging) return;
    this.currentX = e.touches[0].clientX;
    const diff = this.startX - this.currentX;
    if (diff > 0) {
      this.el.nativeElement.style.transform = `translateX(${-Math.min(diff, 120)}px)`;
    }
  }

  private onEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const diff = this.startX - this.currentX;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';
    if (diff > this.threshold) {
      this.el.nativeElement.style.transform = 'translateX(-120px)';
      this.swiped.emit();
      setTimeout(() => {
        this.el.nativeElement.style.transform = 'translateX(0)';
      }, 400);
    } else {
      this.el.nativeElement.style.transform = 'translateX(0)';
    }
  }

  private onCancel(): void {
    this.isDragging = false;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';
    this.el.nativeElement.style.transform = 'translateX(0)';
  }
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

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
