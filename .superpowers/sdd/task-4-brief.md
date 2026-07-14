## Task 4: Make history answer “what did I do today?”

**Files:**
- Modify: `src/app/features/history/history-list-page.ts`
- Modify: `src/app/features/history/history-detail-page.ts`
- Modify: `src/app/features/history/history.service.ts` only if the existing query lacks the required result counts

**Interfaces:**
- Consume persisted `Workout` and `WorkoutResult` records.
- Display completed sessions, not routine definitions, as the history unit.

- [ ] **Step 1: Extend the history read model** with counts derived from persisted results and workout exercises.
- [ ] **Step 2: Render the date, routine name, total exercises, completed exercises, and completion percentage.**
- [ ] **Step 3: Show per-exercise result status on the detail page.**
- [ ] **Step 4: Verify manually** by opening the saved workout from history.
- [ ] **Step 5: Commit** with `feat: clarify workout history completion totals`.

