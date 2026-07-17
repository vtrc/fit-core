# Task 4: Routine card — mobile-friendly spacing & buttons

**Status:** DONE

## Changes made

- **`src/app/shared/routine-card/routine-card.scss`** — replaced entire file with plan's code:
  - Fixed `::ng` → `::ng-deep` (deep selector syntax)
  - Bumped button `min-height` from 40px → 44px (accessibility touch target)
  - Added `@media (max-width: 480px)` block:
    - Card padding: `var(--space-5)` → `var(--space-4)`
    - Card min-height: 10rem → 8rem
    - Button gap: `var(--space-3)` → `var(--space-2)`

## Verification

`npx ng build` — **SUCCESS** (4.8s, no errors). Pre-existing SCSS budget warnings on other files (ai-chat-page, workout-session-page) are unrelated.

## Commits

None — user did not request commits.
