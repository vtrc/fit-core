# Gym Training Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private multi-user Angular 22 gym training tracker backed by InsForge, supporting routines, free and routine-based workouts, strength and cardio summaries, history, and derived statistics.

**Architecture:** Angular 22 provides feature-based UI and client validation. InsForge provides Google authentication, PostgreSQL persistence, and RLS. The shared exercise catalog is read-only; user-owned routines and workouts are isolated by `user_id`. Statistics are derived from workout history instead of duplicated aggregates.

**Tech Stack:** Angular 22, TypeScript, InsForge SDK, InsForge CLI, PostgreSQL, RLS, manual browser verification, and direct backend checks.

## Global Constraints

### User Amendment (2026-07-14)

Do not create or run unit tests, integration tests, or end-to-end tests. Any earlier testing steps in this plan are superseded. Verification is limited to manual review, local production builds when available, and direct InsForge schema and flow checks.

- Authentication must use Google through InsForge.
- Personal routines and workouts must remain private to their owner.
- Strength and cardio are both supported.
- Exercise results are summaries, not individual-set logs.
- No automatic progression recommendations.
- No social sharing.
- The shared exercise catalog is read-only from the frontend.
- Never expose or commit `.insforge/project.json` credentials.

---

## Task 1: Scaffold the Angular 22 workspace

**Files:**
- Create: `package.json`, `angular.json`, `tsconfig*.json`, `src/`
- Modify: `.gitignore`
- Test: Angular generated test configuration

**Interfaces:**
- Produces the Angular application shell and scripts consumed by all later tasks.

- [ ] **Step 1: Create the Angular 22 application in the repository root**

Run `npx @angular/cli@22 new fit-core --directory . --routing --style=scss --strict --skip-git`.

- [ ] **Step 2: Confirm the workspace is valid**

Run `npm test -- --watch=false`.
Expected: the generated test suite passes.

- [ ] **Step 3: Add project-specific ignore rules**

Ensure `.gitignore` excludes `.env.local`, `.insforge/`, `dist/`, and local Angular cache directories while retaining `training_catalog.json` and `.agents/skills/`.

- [ ] **Step 4: Commit the scaffold**

Run `git add fit-core && git commit -m "feat: scaffold angular application"`.

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

## Task 3: Add InsForge client, Google authentication, and catalog access

**Files:**
- Create: `src/app/core/insforge/insforge-client.ts`
- Create: `src/app/core/auth/auth.service.ts`
- Create: `src/app/core/auth/auth.guard.ts`
- Create: `src/app/features/auth/login-page.*`
- Create: `src/app/core/catalog/catalog.service.ts`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- `AuthService.signInWithGoogle(): Promise<void>`
- `AuthService.signOut(): Promise<void>`
- `AuthService.currentUser(): Observable<AuthUser | null>`
- `CatalogService.listExercises(filter: CatalogFilter): Observable<Exercise[]>`

- [ ] **Step 1: Write failing auth and catalog tests**

Test that login delegates to the InsForge Google provider, protected routes reject unauthenticated users, and catalog filters combine type, muscle group, and equipment without exposing user-owned records.

- [ ] **Step 2: Configure the InsForge SDK**

Read the public app configuration from environment files. Keep admin/API credentials out of Angular bundles and out of public environment variables.

- [ ] **Step 3: Implement Google login and session restoration**

Use the InsForge SDK auth methods, expose a reactive current-user stream, and redirect authenticated users to the dashboard.

- [ ] **Step 4: Implement the route guard and login page**

Unauthenticated users go to `/login`; authenticated users can access private feature routes.

- [ ] **Step 5: Implement catalog filtering**

Load the shared catalog and provide filters for strength/cardio, muscle group, equipment, and machine.

- [ ] **Step 6: Run commit**

Commit with `git add fit-core/src/app && git commit -m "feat: add google auth and exercise catalog"`.

## Task 4: Implement routine creation and management

**Files:**
- Create: `src/app/features/routines/routines.service.ts`
- Create: `src/app/features/routines/routines-list-page.*`
- Create: `src/app/features/routines/routine-editor-page.*`
- Create: `src/app/features/routines/routine-detail-page.*`

**Interfaces:**
- `RoutinesService.listMine(): Observable<Routine[]>`
- `RoutinesService.create(input: CreateRoutineInput): Observable<Routine>`
- `RoutinesService.update(id: string, input: UpdateRoutineInput): Observable<Routine>`
- `RoutinesService.delete(id: string): Observable<void>`

- [ ] **Step 1: Write failing tests for routine validation and ownership**

Cover required name, at least one exercise, exercise ordering, planned strength/cardio fields, and service error propagation.

- [ ] **Step 2: Implement the service with InsForge queries**

Persist routines and ordered routine exercises using the authenticated user's ownership context. Never accept a client-supplied `user_id` as authority.

- [ ] **Step 3: Implement the routine editor**

Allow searching the catalog, filtering exercises, adding/removing exercises, reordering them, and configuring planned fields.

- [ ] **Step 4: Implement list and detail states**

Include loading, empty, error, save-success, and delete-confirmation states.

- [ ] **Step 5: Run tests and commit**

Run the focused routine tests and the full unit suite, then commit with `git commit -m "feat: add routine management"`.

## Task 5: Implement routine-based and free workouts

**Files:**
- Create: `src/app/features/workouts/workouts.service.ts`
- Create: `src/app/features/workouts/workout-start-page.*`
- Create: `src/app/features/workouts/workout-session-page.*`
- Create: `src/app/features/workouts/workout-summary-page.*`

**Interfaces:**
- `WorkoutsService.startFromRoutine(routineId: string): Observable<WorkoutDraft>`
- `WorkoutsService.startFree(): Observable<WorkoutDraft>`
- `WorkoutsService.save(input: SaveWorkoutInput): Observable<Workout>`
- `WorkoutsService.discard(draftId: string): void`

- [ ] **Step 1: Write failing tests for both workout modes**

Cover loading a routine snapshot, adding exercises to a free workout, skipping/removing an exercise, strength summary validation, cardio metric validation, and save/discard behavior.

- [ ] **Step 2: Implement workout draft state**

Keep the active workout in a focused state service until the user saves or discards it. Preserve planned values as a snapshot so later routine edits do not rewrite history.

- [ ] **Step 3: Implement the workout session UI**

Show one exercise at a time, provide type-specific forms, allow add/remove/skip actions, and require at least one completed result before final save.

- [ ] **Step 4: Implement persistence**

Save the workout and its summary results in one controlled operation, surface failures with retry, and prevent duplicate submission.

- [ ] **Step 5: Run tests and commit**

Run focused workout tests and the full unit suite, then commit with `git commit -m "feat: add workout tracking"`.

## Task 6: Implement history and derived statistics

**Files:**
- Create: `src/app/features/history/history.service.ts`
- Create: `src/app/features/history/history-list-page.*`
- Create: `src/app/features/history/history-detail-page.*`
- Create: `src/app/features/statistics/statistics.service.ts`
- Create: `src/app/features/statistics/statistics-page.*`

**Interfaces:**
- `HistoryService.listMine(range: DateRange): Observable<Workout[]>`
- `HistoryService.get(id: string): Observable<WorkoutDetails>`
- `StatisticsService.getOverview(range: DateRange): Observable<StatisticsOverview>`

- [ ] **Step 1: Write failing aggregation tests**

Test frequency, strength volume (`weight × repetitions_total`), cardio duration, cardio distance, muscle-group distribution, and best recorded results using fixed fixtures.

- [ ] **Step 2: Implement history queries**

Return only the authenticated user's workouts, ordered newest first, with detail loading for exercise results.

- [ ] **Step 3: Implement statistics calculations**

Calculate metrics from history at query/service level without writing duplicated aggregate rows. Return empty-safe values when the user has no workouts.

- [ ] **Step 4: Implement history and statistics screens**

Show date filters, empty states, accessible tables/cards, and simple trend visualizations without presenting recommendations.

- [ ] **Step 5: Run tests and commit**

Run focused history/statistics tests and the full unit suite, then commit with `git commit -m "feat: add history and statistics"`.

## Task 7: Manual verification and security audit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Prepare manual verification data**

Use safe development accounts and catalog data without storing credentials in the repository.

- [ ] **Step 2: Verify the critical journey**

Run Google login with the configured test method, create a routine, start a routine workout, record a strength result, save it, and verify it in history.

- [ ] **Step 3: Verify free workout and cardio**

Start a free workout, record a cardio result with machine-specific metrics, save it, and verify the summary.

- [ ] **Step 4: Verify isolation**

Use two test users and confirm that routines and workouts are inaccessible across users through both the UI and direct SDK queries.

- [ ] **Step 5: Run release checks**

Run the production build and manually verify the critical flows. Resolve all critical failures before release.

- [ ] **Step 6: Commit verification documentation**

Commit with `git commit -m "docs: document manual training tracker verification"`.

## Self-Review

- Spec coverage: authentication, private ownership, catalog, routines, routine/free workouts, strength, cardio, summary logging, history, statistics, validation, errors, and tests each have explicit tasks.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation step is used.
- Type consistency: service interfaces use the domain entities introduced in Task 2; workout summaries distinguish strength and cardio metrics.
- Scope: the plan is split into independently testable vertical slices and excludes recommendations, sharing, and per-set logging as agreed.
