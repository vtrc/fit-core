# FitCore Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Migrate the FitCore Angular application from the current light parchment visual system to the dark, high-contrast FitCore system defined in `design.md`.

**Architecture:** Establish one global token layer first, then migrate shared components, then migrate feature pages in isolated work units. Feature agents must consume shared tokens and avoid editing files owned by other agents. A final integration pass validates contrast, responsive behavior, accessibility, and build output.

**Tech Stack:** Angular standalone components, SCSS, CSS custom properties, Angular CDK, native responsive CSS.

## Global Constraints

- Base surface is `#121317`; reserve `#000000` for overlays only.
- Primary action is electric lime `#c3f400` with dark text.
- Use Anybody for headlines/metrics, Lexend for body text, and JetBrains Mono for technical labels.
- Use 4px spacing units and small radii from `2px` to `12px`.
- Prefer tonal surfaces and subtle outlines over decorative shadows.
- Preserve existing Angular behavior, routes, data flow, and accessibility semantics.
- Do not change Spanish user-facing copy unless required for visual states.
- All interactive targets remain at least 44px on touch layouts.
- Every migrated page retains loading, empty, error, disabled, focus, and reduced-motion states.

## Task 1: Foundation and Shared Components

**Files:** `src/styles.scss`, `src/app/shared/shell/*`, `src/app/shared/page-header/*`, `src/app/shared/empty-state/*`, `src/app/shared/routine-card/*`, `src/app/shared/exercise-catalog/*`.

- Replace legacy parchment tokens with semantic dark tokens and aliases.
- Load the three design fonts with a resilient fallback strategy.
- Migrate global cards, banners, buttons, inputs, skeletons, page layout, and focus states.
- Remove global visual styling from generic `a, button` selectors where it conflicts with semantic links and icon buttons.
- Migrate shell, page header, empty state, routine card, and exercise catalog without changing their public Angular APIs.
- Preserve drag, swipe, router-link, form, and content-projection behavior.
- Run `npm run build` and commit as `feat: establish fitcore visual foundation`.

## Task 2: Dashboard

**Files:** `src/app/features/dashboard/dashboard-page.html`, `src/app/features/dashboard/dashboard-page.scss`.

- Apply the shared dark surfaces and Anybody/Lexend hierarchy.
- Preserve hero behavior, route navigation, image fallback, safe-area spacing, and reduced motion.
- Validate 320px, 768px, and 1280px layouts.
- Run `npm run build` and commit as `feat: migrate dashboard to fitcore design`.

## Task 3: Routines

**Files:** `src/app/features/routines/*` only.

- Migrate list, detail, and editor layouts to the shared system.
- Preserve reorder, swipe delete, card navigation, start workout, catalog filtering, validation, and save/delete flows.
- Style drag preview, swipe reveal, editor controls, metrics, empty, loading, and error states.
- Run `npm run build` and commit as `feat: migrate routines to fitcore design`.

## Task 4: Workouts

**Files:** `src/app/features/workouts/*` only.

- Migrate start, active session, and summary screens.
- Prioritize readable workout metrics, 44px targets, completed/skipped states, progress, timer overlay, and save/failure states.
- Preserve click/checkbox/timer event separation and all session behavior.
- Run `npm run build` and commit as `feat: migrate workouts to fitcore design`.

## Task 5: History

**Files:** `src/app/features/history/*` only.

- Migrate filters, history cards, swipe delete, detail metrics, completed/skipped states, and empty/error states.
- Preserve date/time formatting, navigation, confirmation, and deletion behavior.
- Run `npm run build` and commit as `feat: migrate history to fitcore design`.

## Task 6: Statistics

**Files:** `src/app/features/statistics/*` only.

- Migrate metric tiles, trends, muscle groups, best results, filters, skeletons, and no-data states.
- Use lime for primary progress and reserve orange for alert/burn semantics.
- Preserve number formatting and responsive chart readability.
- Run `npm run build` and commit as `feat: migrate statistics to fitcore design`.

## Task 7: Integration Review

**Files:** any migrated files required for corrections; no new feature behavior.

- Verify no legacy parchment/rust hardcoded colors remain in migrated UI.
- Verify contrast, focus-visible, reduced motion, safe-area padding, footer coverage, and responsive layouts.
- Run `npm run build` and inspect `git diff` for accidental behavior changes.
- Commit corrections as `fix: polish fitcore design system integration`.
