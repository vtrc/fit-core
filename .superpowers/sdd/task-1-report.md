# Task 1 Report — Add `position` column to routines table

## What was implemented

- **`migrations/20260720000000_add-routines-position.sql`**: SQL migration adding nullable `position integer` column to `public.routines` with a CTE-based backfill that assigns initial positions per user (ordered by most recently updated first).
- **`src/app/core/domain/models.ts`**: Added `position: number | null` to the `Routine` interface.
- **`src/app/features/routines/routines.service.ts`**:
  - Added `position: number | null` to `RoutineRow` interface.
  - Updated `mapRoutine()` to map `position`.
  - `listMine()`: select includes `position`, ordered by `position ASC (nulls first false)` then `updated_at DESC`.
  - `createRoutine()`: queries max position for the user, computes next, inserts with `position`, select includes `position`.
  - `getDetail()`: select includes `position`.
  - `updateRoutine()`: select includes `position`.
  - `loadRoutineRow()`: select includes `position`.

## Build results

✅ Build passes with no errors. Two pre-existing SCSS budget warnings are unrelated.

## Files changed

```
migrations/20260720000000_add-routines-position.sql            (new)
src/app/core/domain/models.ts                                  (modified)
src/app/features/routines/routines.service.ts                  (modified)
```

## Self-review findings

- All selects that go through `mapRoutine()` now include `position` — checked `listMine`, `getDetail`, `createRoutine`, `updateRoutine`, `loadRoutineRow`.
- `restoreRoutineParent` doesn't use `mapRoutine` so it doesn't need the column.
- `delete` doesn't select, no changes needed.

## Commits

- `a006a86` feat: add position column to routines table

## Issues or concerns

None.
