# Task 5 Brief — Workout Tracking

Implement routine-based and free workout flows for the Angular 22 + InsForge app.

## Scope
- `src/app/features/workouts/workouts.service.ts`
- `src/app/features/workouts/workout-start-page.ts`
- `src/app/features/workouts/workout-session-page.ts`
- `src/app/features/workouts/workout-summary-page.ts`
- `src/app/app.routes.ts`

## Required behavior
- Start from a saved routine using a snapshot of planned values.
- Start a free workout and add exercises on demand.
- Show one exercise at a time with type-specific strength/cardio forms.
- Support skip/remove/add actions.
- Require at least one completed result before save.
- Persist workout and results through InsForge with duplicate-submit protection.
- Allow discard without persistence.
- Do not add or run unit, integration, or end-to-end tests.
- Use manual review and production build only for verification.
