## Task 3: Build the final completion summary

**Files:**
- Modify: `src/app/features/workouts/workout-summary-page.ts`
- Modify: `src/app/features/workouts/workouts.service.ts`

**Interfaces:**
- Consume the saved session result from `saveSession()`.
- Produce a stable summary model containing `routineName`, `performedOn`, `plannedCount`, `completedCount`, `skippedCount`, and `completionPercentage`.

- [ ] **Step 1: Implement the summary model** without duplicating database queries.
- [ ] **Step 2: Render routine name, date, duration when available, counts, and percentage.**
- [ ] **Step 3: Render a clear empty/error state** if the user navigates to the summary without an active session.
- [ ] **Step 4: Keep the existing save operation idempotent** so refresh or repeated submit does not duplicate workouts/results.
- [ ] **Step 5: Verify manually** with a session containing completed and skipped exercises.
- [ ] **Step 6: Commit** with `feat: add workout completion summary`.

