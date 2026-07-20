### Task 3: Implement drag-and-drop on the routines list page

**Files:**
- Modify: `src/app/features/routines/routines-list-page.ts`
- Modify: `src/app/features/routines/routines-list-page.html`
- Modify: `src/app/features/routines/routines-list-page.scss`

**Interfaces:**
- Consumes: `RoutinesService.updatePositions()`, `Routine.position`
- Produces: draggable routine card grid with persisted reorder

- [ ] **Step 1: Add CDK DragDrop imports to the component**

Edit `src/app/features/routines/routines-list-page.ts`:

Import `CdkDropListGroup` and `CdkDropList, CdkDrag, CdkDropListModule`:

```typescript
import { CdkDropList, CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';
```

Add to `@Component.imports`:
```typescript
imports: [RouterLink, EmptyStateComponent, RoutineCardComponent, SwipeToDeleteDirective, PageHeaderComponent, CdkDropList, CdkDrag],
```

Add a `savingReorder` signal and the drop handler method + a snapshot for rollback:

```typescript
import type { Routine } from '../../core/domain/models';

// ... existing code ...

protected readonly savingReorder = signal(false);

private routinesBeforeReorder: Routine[] = [];

protected onDrop(event: CdkDragDrop<Routine[]>): void {
  if (event.previousIndex === event.currentIndex) return;

  this.routinesBeforeReorder = [...this.routines()];

  this.routines.update((list) => {
    const updated = [...list];
    const [moved] = updated.splice(event.previousIndex, 1);
    updated.splice(event.currentIndex, 0, moved);
    return updated;
  });

  this.savingReorder.set(true);

  const reordered = this.routines().map((r, i) => ({ id: r.id, position: i }));

  this.routinesService.updatePositions(reordered).subscribe({
    error: () => {
      this.routines.set(this.routinesBeforeReorder);
      this.savingReorder.set(false);
    },
    complete: () => {
      this.savingReorder.set(false);
    },
  });
}
```

- [ ] **Step 2: Update the template with cdkDropList and cdkDrag**

Edit `src/app/features/routines/routines-list-page.html`.

Replace the `<section class="grid">` in the `@else` block (lines 43-56):

```html
<section
  class="grid"
  cdkDropList
  (cdkDropListDropped)="onDrop($event)"
>
  @for (routine of routines(); track routine.id) {
    <app-routine-card
      cdkDrag
      [cdkDragDisabled]="savingReorder()"
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
```

No changes needed to the swipe directive — CDK drag events take priority over swipe touch handlers during drag.

- [ ] **Step 3: Add drag-drop styles**

Edit `src/app/features/routines/routines-list-page.scss`, append:

```scss
// ── Drag-and-drop ──────────────────────────────────────────

.cdk-drop-list-dragging .cdk-drag {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}

.cdk-drag-animating {
  transition: transform 300ms cubic-bezier(0, 0, 0.2, 1);
}

.cdk-drag-preview {
  box-shadow: var(--elevation-modal);
  border-radius: var(--radius-lg);
  opacity: 0.95;
}

.cdk-drag-placeholder {
  opacity: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/routines/routines-list-page.ts src/app/features/routines/routines-list-page.html src/app/features/routines/routines-list-page.scss
git commit -m "feat: implement drag-and-drop reorder for routines list"
```

---

