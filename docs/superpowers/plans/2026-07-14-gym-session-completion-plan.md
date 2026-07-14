# Gym Session Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a saved routine usable as a complete gym session: start it, mark exercises as completed or skipped, finish it, and clearly show the day's completion summary and history.

**Architecture:** Reuse the existing `WorkoutSessionDraft` state and `Workout`/`WorkoutResult` persistence. Improve the session UI and summary using the existing service boundaries; do not introduce a second workout state model. The first slice treats each exercise as completed when a valid result is recorded and treats skipped exercises separately.

**Tech Stack:** Angular 22 standalone components, Signals, RxJS, InsForge database, Vitest.

## Global Constraints

- Preserve the existing `workouts` and `workout_results` schema and RLS policies.
- Keep user-facing copy in the existing project language/style unless explicitly changed.
- Do not add session persistence across browser reloads in this slice.
- Do not count skipped exercises as completed.
- Use the existing `completed_at` timestamp when the session is finalized.

---

## Current State and Scope

Already available:

- `/workouts/start` lists saved routines and starts a routine session.
- `EntrenamientosService.startFromRoutine()` creates a session snapshot.
- `/workouts/session` displays planned exercises, records strength/cardio results, skips exercises, and counts completed exercises.
- `saveSession()` persists a workout and its results.
- `/workouts/summary` and `/history` already exist.

Remaining work:

- Make the session progress and completion state explicit and easy to understand in the gym.
- Show a useful final summary: routine, date, planned count, completed count, skipped count, and completion percentage.
- Ensure history exposes the completed session information consistently.
- Verify the complete flow manually in the running web application; do not add automated tests.

## File Map

- Modify `src/app/features/workouts/workout-session-page.ts` — session progress, completion controls, and accessible status copy.
- Modify `src/app/features/workouts/workout-summary-page.ts` — final workout summary and post-save navigation.
- Modify `src/app/features/workouts/workouts.service.ts` — expose skipped/count summary selectors and preserve finalization state.
- Modify `src/app/features/history/history-list-page.ts` — present completed sessions with clear exercise totals.
- Modify `src/app/features/history/history-detail-page.ts` — show per-exercise completion/skipped status.
- No automated test files will be created or modified.

## Task 1: Lock down session counting behavior

**Files:**
- Modify: `src/app/features/workouts/workouts.service.ts`

**Interfaces:**
- Produce readonly selectors: `plannedCount`, `completedCount`, `skippedCount`, and `remainingCount`.
- Preserve `WorkoutSessionExercise.result === null` as the source of truth for incomplete exercises.

- [ ] **Step 1: Implement selectors** as computed signals over `sessionState()`.
- [ ] **Step 2: Verify manually** that completed, skipped, pending, and remaining counts update correctly.
- [ ] **Step 3: Commit** with `feat: expose workout session progress counts`.

## Task 2: Improve the live gym session screen

**Files:**
- Modify: `src/app/features/workouts/workout-session-page.ts`

**Interfaces:**
- Consume the selectors from Task 1.
- Keep existing actions: result submission, skip, remove, exercise selection, and finish.

- [ ] **Step 1: Implement a compact progress header** with text such as `3 de 8 ejercicios completados` and a native progress bar using `completedCount / plannedCount`.
- [ ] **Step 2: Add explicit visual states** to the exercise navigation: pending, completed, and skipped.
- [ ] **Step 3: Change the finish action label** to indicate that it opens the final summary, while keeping it disabled when there are zero completed exercises.
- [ ] **Step 4: Add an accessible live status region** announcing count changes after result submission or skip.
- [ ] **Step 5: Verify manually** by recording and skipping exercises in the browser.
- [ ] **Step 6: Commit** with `feat: improve live workout session progress`.

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

## Task 5: End-to-end verification

**Files:**
- Modify: only files required by verification failures

- [ ] **Step 1: Run `npx tsc -p tsconfig.app.json --noEmit`.** Expected: no TypeScript errors.
- [ ] **Step 2: Run the Angular build.** If the existing esbuild deadlock persists, record it separately from feature failures and fix the toolchain before claiming completion.
- [ ] **Step 3: Manually verify:** start saved routine → record one result → skip one exercise → finish → inspect summary → inspect history.
- [ ] **Step 4: Perform a fresh review of the final diff before commit.**

## Explicit Non-Goals

- Persisting an in-progress session across browser refreshes or device changes.
- Editing the routine definition during an active workout.
- Adding set-by-set logging; the current first slice records aggregate sets/repetitions/weight per exercise.
- Adding a new analytics dashboard for weekly or monthly routine totals.
