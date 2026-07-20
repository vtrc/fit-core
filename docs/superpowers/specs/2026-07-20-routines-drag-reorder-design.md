# Drag-and-Drop Reordering for Routines

## Problem

Users need to reorder their routines. Currently routines are listed by `updated_at DESC` with no way to change the order. Both `/routines` and `/workouts/start` show the same list.

## Solution

Add a `position` column to the `routines` table and implement drag-and-drop reordering on the `/routines` page using `@angular/cdk/drag-drop`. The `/workouts/start` page automatically reflects the same order.

## Scope

One shared order between both screens. DnD only on `/routines`.

## Database

- Add `position integer` column (nullable) to `routines` table
- Migration to set initial positions for existing routines based on `updated_at DESC`
- The `listMine()` query changes to `order('position', { ascending: true }).order('updated_at', { ascending: false })` so new routines (null position) appear at the end

## Service Layer

`RoutinesService.updatePositions(items: { id: string; position: number }[])` — batch-updates positions via a single SDK call (InsForge `.upsert()` with all rows).

## Component: RoutinesListPage

- Import `CdkDropListModule` from `@angular/cdk/drag-drop`
- Wrap grid container in `cdkDropList` with `cdkDropListDropped` handler
- Each card in `cdkDrag`
- On drop: reorder local array + persist immediately via `updatePositions()` (no debounce — the operation is fast since it only touches a handful of rows)
- On save failure: revert local array to previous order + show flash error

## UX

- Lifted card with elevated shadow during drag
- Smooth reorder animation (CDK built-in)
- No visual change or layout break; grid stays as-is

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `@angular/cdk` |
| New SQL migration | Add `position` to `routines` |
| `core/domain/models.ts` | Add `position` to `Routine` type |
| `features/routines/routines.service.ts` | Add `updatePositions()` |
| `features/routines/routines-list-page.ts` | Add DnD logic + error handling |
| `features/routines/routines-list-page.html` | Add `cdkDropList`/`cdkDrag` |
| `features/routines/routines-list-page.scss` | Drag state styles |

## Not In Scope

- Drag-and-drop on `/workouts/start` (uses same order)
- Reordering exercises within a routine (already exists via up/down buttons)
