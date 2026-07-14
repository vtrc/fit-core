# Task 2 Report — Training Tracker Schema and Domain Models

## Summary

Implemented the first training tracker schema migration and matching TypeScript domain models for exercises, routines, routine exercises, workouts, and workout results.

## Files Changed

- `migrations/20260713224522_create-training-tracker.sql`
  - Initial schema migration.
  - Added shared `exercises` catalog table.
  - Added user-owned `routines`, `routine_exercises`, `workouts`, and `workout_results` tables with UUID primary keys and exposed `user_id` ownership.
  - Added foreign keys, timestamps, non-negative planned metric checks, indexes, RLS policies, and grants.

- `migrations/20260714230000_harden-training-tracker.sql`
  - Adds result validation by exercise type, immutable ownership, and a safe routine deletion foreign key.

- `migrations/20260714231000_validate-training-ownership.sql`
  - Rejects null and non-numeric required result metrics and enforces routine/workout ownership consistency.

- `migrations/20260714232000_require-workout-metrics.sql`
  - Explicitly requires all mandatory strength/cardio result keys and numeric values.

- `migrations/20260714233000_add-exercise-lookup-indexes.sql`
  - Adds lookup indexes for routine and workout results by exercise.

- `src/app/core/domain/models.ts`
  - Added domain models for `Exercise`, `Routine`, `RoutineExercise`, `Workout`, and `WorkoutResult`.
  - Added discriminated unions for `StrengthExerciseResult` and `CardioExerciseResult` through the `kind` discriminator.

- `src/app/core/domain/models.spec.ts`
  - Added TDD coverage for strength result shape, cardio result shape, and discriminator narrowing through `WorkoutResult`.

## TDD / Verification

### RED

Command attempted before `models.ts` existed:

```bash
npm test -- --include src/app/core/domain/models.spec.ts --watch=false
```

Result: failed as expected because `./models` did not exist.

### GREEN

Command:

```bash
npm test -- --include src/app/core/domain/models.spec.ts --watch=false
```

Result: passed. `1` test file passed, `3` tests passed.

### Broader Local Verification

Command:

```bash
npm test -- --watch=false
```

Result: passed. `2` test files passed, `5` tests passed. Re-run after the migration integrity trigger update also passed with the same result.

## InsForge Migration Apply Status

All five migrations were applied successfully to the linked InsForge project with:

```bash
npx @insforge/cli db migrations up --all
```

Output confirmed:

```text
Applied migration files:
- 20260713224522_create-training-tracker.sql
- 20260714230000_harden-training-tracker.sql
- 20260714231000_validate-training-ownership.sql
- 20260714232000_require-workout-metrics.sql
- 20260714233000_add-exercise-lookup-indexes.sql
```

Schema verification with the InsForge query command returned all five expected tables: `exercises`, `routine_exercises`, `routines`, `workout_results`, and `workouts`.

The local migration uses the required top-level `migrations/` directory and timestamped lowercase kebab-case filename.
