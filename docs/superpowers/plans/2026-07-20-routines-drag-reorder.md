# Routines Drag-and-Drop Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to reorder their routines via drag-and-drop on the `/routines` page, persisting the order to the database so it reflects on both `/routines` and `/workouts/start`.

**Architecture:** Add a `position` column to the `routines` table. Use `@angular/cdk/drag-drop` (`CdkDropList` + `CdkDrag`) on the routine card grid. On drop, reorder the local signal array and batch-update positions in the DB. The `/workouts/start` page reads the same data with the same order.

**Tech Stack:** Angular 22, `@angular/cdk` 22.x, InsForge SDK, CSS Grid, Signals

## Global Constraints

- Style conventions: standalone components, signals, SCSS
- All inserts use array syntax: `insert([{ ... }])`
- All queries filter by `user_id` for Row-Level Security
- No external state management — use signals and RxJS
- The RoutineCardComponent is shared between both `/routines` and `/workouts/start`

---

### Task 1: Database migration — add `position` column

**Files:**
- Create: `migrations/20260720000000_add-routines-position.sql`
- Modify: `src/app/core/domain/models.ts`
- Modify: `src/app/features/routines/routines.service.ts`

**Interfaces:**
- Consumes: existing `routines` table schema
- Produces: `routines.position` column (nullable integer), initial positions assigned

- [ ] **Step 1: Create the SQL migration file**

```sql
alter table public.routines
  add column position integer;

-- Set initial position for existing routines per user,
-- ordered by most recently updated first.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at desc, id
    ) - 1 as pos
  from public.routines
)
update public.routines r
  set position = ranked.pos
  from ranked
  where r.id = ranked.id;
```

- [ ] **Step 2: Add `position` to the `Routine` model**

Edit `src/app/core/domain/models.ts:19-26`:

```typescript
export interface Routine {
  id: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  position: number | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
```

- [ ] **Step 3: Add `position` to `RoutineRow` in the service**

Edit `src/app/features/routines/routines.service.ts:37-44` — add `position: number | null`:

```typescript
interface RoutineRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Update `mapRoutine` to include position**

Edit `src/app/features/routines/routines.service.ts:685-694`:

```typescript
private mapRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 5: Update `listMine()` to select and order by position**

Edit `src/app/features/routines/routines.service.ts:261-276`:

```typescript
listMine(): Observable<Routine[]> {
  return from(
    this.insforge.client.database
      .from('routines')
      .select('id, user_id, name, description, position, created_at, updated_at')
      .order('position', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false }),
  ).pipe(
    map(({ data, error }) => {
      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => this.mapRoutine(row as RoutineRow));
    }),
  );
}
```

- [ ] **Step 6: Assign position on routine creation**

Edit `src/app/features/routines/routines.service.ts` in `createRoutine` method (around line 359), before the insert, compute the next position:

```typescript
// After input validation, before the insert:
const maxPosResult = await this.insforge.client.database
  .from('routines')
  .select('position')
  .eq('user_id', userId)
  .order('position', { ascending: false, nullsFirst: false })
  .limit(1);

const maxPosition = (maxPosResult.data?.[0]?.position as number | null) ?? -1;
const nextPosition = maxPosition + 1;

// Then in the insert payload:
const { data, error } = await this.insforge.client.database
  .from('routines')
  .insert([
    {
      user_id: userId,
      name: input.name.trim(),
      description: this.normalizeText(input.description),
      position: nextPosition,
    },
  ])
  .select('id, user_id, name, description, position, created_at, updated_at')
  .single();
```

Also update the `select` return fields to include `position`.

- [ ] **Step 7: Update `getDetail()` select to include position**

In `getDetail()`, line 282, change select to include `position`:
```typescript
.select('id, user_id, name, description, position, created_at, updated_at')
```

In the `loadRoutineRow()` method (line 484), same change:
```typescript
.select('id, user_id, name, description, position, created_at, updated_at')
```

- [ ] **Step 8: Commit**

```bash
git add migrations/20260720000000_add-routines-position.sql src/app/core/domain/models.ts src/app/features/routines/routines.service.ts
git commit -m "feat: add position column to routines table"
```

---

### Task 2: Install `@angular/cdk` and add `updatePositions` method

**Files:**
- Modify: `package.json`
- Modify: `src/app/features/routines/routines.service.ts`

**Interfaces:**
- Consumes: `RoutineRow` with `position`, `Routine` with `position`
- Produces: `RoutinesService.updatePositions(items: { id: string; position: number }[]): Observable<void>`

- [ ] **Step 1: Install @angular/cdk**

```bash
npm install @angular/cdk
```

- [ ] **Step 2: Add `updatePositions()` to `RoutinesService`**

Add to `src/app/features/routines/routines.service.ts`, after `delete(id)` (line 341):

```typescript
updatePositions(items: { id: string; position: number }[]): Observable<void> {
  return from(this.requireUserId()).pipe(
    switchMap((userId) =>
      from(
        (async () => {
          for (const item of items) {
            const { error } = await this.insforge.client.database
              .from('routines')
              .update({ position: item.position })
              .eq('id', item.id)
              .eq('user_id', userId);

            if (error) {
              throw error;
            }
          }
        })(),
      ),
    ),
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json src/app/features/routines/routines.service.ts
git commit -m "feat: add @angular/cdk and updatePositions service method"
```

---

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

### Task 4: Verify and integrate

**Files:** none — verification steps

- [ ] **Step 1: Apply the database migration**

```bash
npx insforge migration apply
```

- [ ] **Step 2: Build the app to check for compilation errors**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A && git commit -m "chore: fix build issues after drag-drop implementation"
```
