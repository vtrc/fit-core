# Mobile-Friendly: Rutinas Page

**Date:** 2026-07-17
**Scope:** `/routines` list page + shell navigation
**Skill:** interface-design + angular-developer

---

## Intent

The user is in or between workouts — one hand, maybe sweating, on a phone (320–430px width). They need to browse, start, or manage their routines quickly. Miss-taps are frustrating. Everything must be generous to touch without looking childish.

## Direction

Warm analog notebook feel (existing parchment/ink/rust tokens). Cards as sticky notes. Interactions that feel physical — pull down to refresh, swipe to discard. No cold Material blue, no generic spinners.

## Domain

- Notebook / logbook
- Workout cards / sticky notes
- Ink, paper, rust, pencil annotations
- Physical interaction (flip, pull, swipe)

## Changes

### 1. Shell & Bottom Nav

- `.shell` padding: `1.6rem` → `1rem` horizontal on mobile (<640px)
- Bottom nav: height `3.5rem` → `4rem` + safe-area
- `.nav-item`: add explicit `min-height: 44px` for tap targets
- `.nav-label`: `0.7rem` → `0.65rem` to compensate taller nav
- Footer height variable uses `max()` for safe-area handling

### 2. Hero Section

- `h1` mobile: `clamp(1.8rem, 10vw, 2.4rem)` → `clamp(1.5rem, 8vw, 2.2rem)`
- Lede hidden below 480px (user knows what routines are)
- Hero margin-bottom: `--space-8` → `--space-4` on mobile
- "Crear rutina" button: `min-height: 48px` on mobile

### 3. Routine Cards

- Card padding: `--space-5` → `--space-4` on mobile
- Action buttons: `min-height: 44px`, gap `--space-3` → `--space-2`
- Card `min-height`: `10rem` → `8rem` on mobile (tighter, less wasted space)

### 4. Loading State (Skeleton)

- 3 skeleton cards with shimmer animation
- Same dimensions as real cards
- Background: gradient animation over `var(--fill-soft)`

### 5. Pull-to-Refresh

- Angular CDK drag or native `touch` events
- Custom spinner in parchment style (not Material)
- Only on the routines list

### 6. Swipe-to-Delete

- `@angular/cdk/drag-drop` for horizontal swipe
- Swipe left reveals red "Borrar" action
- Undo toast (replaces `confirm()` dialog)
- Card snaps back if swipe incomplete

### 7. View Transitions

- CSS View Transitions API (Angular `withViewTransitions`)
- Subtle slide-up when opening a routine detail

### 8. Responsive Breakpoints

| Breakpoint | Change |
|---|---|
| `<480px` | Hide hero lede |
| `<480px` | Tighter card padding |
| `<640px` | Reduced shell padding, 1-col grid |
| `>=640px` | Multi-column grid (existing) |

## Files to Change

| File | Changes |
|---|---|
| `src/styles.scss` | Add 480px breakpoint, skeleton keyframes, adjust hero mobile |
| `src/app/shared/shell/shell.scss` | Padding reduction, nav height, 44px tap targets |
| `src/app/features/routines/routines-list-page.html` | Skeleton cards, pull-to-refresh wrapper |
| `src/app/features/routines/routines-list-page.scss` | Mobile spacing, skeleton styles |
| `src/app/features/routines/routines-list-page.ts` | Pull-to-refresh handler |
| `src/app/shared/routine-card/routine-card.scss` | Mobile padding, 44px buttons |
| `src/app/app.ts` or `app.config.ts` | Enable `withViewTransitions` |

## Out of Scope

- Virtual scroll (routines rarely exceed 20-30)
- Service worker / offline (separate effort)
- Gesture on other pages (follow-up after /routines)
