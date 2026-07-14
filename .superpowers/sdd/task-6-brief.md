# Task 6 Brief — History and Statistics

Implement authenticated workout history and derived statistics.

## Scope
- `src/app/features/history/history.service.ts`
- `src/app/features/history/history-list-page.ts`
- `src/app/features/history/history-detail-page.ts`
- `src/app/features/statistics/statistics.service.ts`
- `src/app/features/statistics/statistics-page.ts`
- `src/app/app.routes.ts`

## Required behavior
- List only the authenticated user's workouts, newest first.
- Support date range filtering and empty states.
- Load workout details with exercise results.
- Calculate frequency, strength volume, cardio duration, cardio distance, muscle-group distribution, and best results from history without duplicated aggregate rows.
- Show accessible history cards/tables and simple trend visualizations.
- Do not present recommendations.
- Do not create or run unit, integration, or end-to-end tests.
- Verify with MCP graph inspection, manual review, and production build only.
