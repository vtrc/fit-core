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

