## Task 2: Define the InsForge schema and security policies

**Files:**
- Create: `insforge/migrations/001_training_tracker.sql`
- Create: `src/app/core/domain/models.ts`
- Test: `src/app/core/domain/models.spec.ts`

**Interfaces:**
- Produces tables and TypeScript models for `exercises`, `routines`, `routine_exercises`, `workouts`, and `workout_results`.
- Every user-owned record exposes `user_id` and uses UUID identifiers.

- [ ] **Step 1: Write model tests for strength and cardio result shapes**

Cover that strength results accept `weight`, `sets_completed`, and `repetitions_total`, while cardio results accept `duration_seconds`, `distance`, and machine-specific optional metrics.

- [ ] **Step 2: Add the SQL migration**

Create the shared catalog tables and user-owned tables with foreign keys, timestamps, exercise type checks (`strength` or `cardio`), and non-negative numeric checks. Add indexes on `user_id`, workout date, and exercise ID.

- [ ] **Step 3: Add RLS policies**

Enable RLS on all tables. Allow authenticated users to read the shared catalog. Allow users to select, insert, update, and delete routines and workouts only when `user_id = auth.uid()`; enforce the same ownership through related routine and workout records.

- [ ] **Step 4: Add matching TypeScript domain models**

Define discriminated unions for `StrengthExerciseResult` and `CardioExerciseResult`, plus `Exercise`, `Routine`, `RoutineExercise`, `Workout`, and `WorkoutResult`.

- [ ] **Step 5: Apply and verify the migration**

Run `npx @insforge/cli db migrations apply` and then query the schema with `npx @insforge/cli db query "select table_name from information_schema.tables where table_schema = 'public' order by table_name" --json`.

- [ ] **Step 6: Commit the schema**

Run `git add fit-core/insforge fit-core/src/app/core/domain && git commit -m "feat: add training tracker schema"`.

