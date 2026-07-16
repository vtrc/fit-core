# AI Routine Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript backend harness that collects requirements, selects real exercises, generates a routine draft, requires name confirmation, persists the routine, and navigates the user to its detail page.

**Architecture:** InsForge Functions own state, validation, MiniMax tool calls, and persistence. Angular renders messages and a typed routine preview but never chooses exercises or writes routine rows directly.

**Tech Stack:** Angular 22, TypeScript, Deno Edge Functions, MiniMax OpenAI-compatible API, InsForge Postgres, Zod schemas.

## Global Constraints

- All exercise IDs must come from `public.exercises`.
- A routine is not persisted until the authenticated user explicitly confirms its name.
- The model cannot execute persistence directly.
- The authenticated user ID comes from the Bearer JWT, never from request JSON.
- Existing free-form `/minimax-chat` streaming behavior must remain available.

---

### Task 1: Implement Typed Routine Domain and Exercise Tools

**Files:**
- Create: `functions/routine-domain.ts`
- Create: `functions/routine-tools.ts`

**Interfaces:**
- `Profile`: `{ age: number; weightKg: number; goal: Goal; level: Level; daysPerWeek: number }`.
- `RoutineExerciseDraft`: `{ exerciseId: string; position: number; plannedSets: number; plannedRepetitions: number; plannedWeight: number | null; restSeconds: number; notes: string | null }`.
- `searchExercises(profile: Profile): Promise<ExerciseCandidate[]>`.
- `validateRoutineDraft(draft): RoutineDraft`.

- [ ] **Step 1: Implement schemas and database-backed exercise lookup**

Use the InsForge service client in the function, filter by `type`, and return only `id`, `name`, `type`, `equipment`, `muscle_groups`, and `supported_metrics`.

- [ ] **Step 2: Verify valid profiles and exercise lookup**

Run the focused tests and a read-only query against the deployed exercise catalog.

- [ ] **Step 3: Commit**

```bash
git add functions/routine-domain.ts functions/routine-tools.ts
git commit -m "feat: add typed routine generation tools"
```

### Task 2: Implement the Routine Agent Harness

**Files:**
- Create: `functions/routine-agent.ts`
- Modify: `functions/minimax-chat.ts` only for shared auth/CORS extraction if needed

**Interfaces:**
- `handleRoutineMessage(input: { userId: string; draftId?: string; message: string }): Promise<RoutineAgentResponse>`.
- `RoutineAgentResponse`: `{ state; draftId; message; draft?: RoutineDraft }`.

- [ ] **Step 1: Implement the harness**

Load or create the user draft, use MiniMax structured/tool output only for extraction and generation, execute `searchExercises` server-side, validate all returned exercise IDs, save the draft, and return a preview. Never insert into `routines` here.

- [ ] **Step 2: Verify transitions and retry behavior**

Run focused tests and confirm malformed model output returns a recoverable message without changing the draft to `saved`.

- [ ] **Step 3: Commit**

```bash
git add functions/routine-agent.ts functions/minimax-chat.ts
git commit -m "feat: add guided routine agent harness"
```

### Task 3: Add Authenticated Routine Persistence Function

**Files:**
- Create: `functions/create-routine.ts`

**Interfaces:**
- Request: `{ draftId: string; name: string }`.
- Response: `{ id: string }`.

- [ ] **Step 1: Implement authenticated transactional persistence**

Read the Bearer JWT, load the draft by `id` and `user_id`, validate the final name and exercise IDs, insert `routines`, insert `routine_exercises`, then mark the draft `saved`.

- [ ] **Step 2: Verify database rows and ownership**

Run the function tests and query the created routine and exercise rows.

- [ ] **Step 3: Deploy the function**

```bash
npm run deploy:functions
```

### Task 4: Connect Angular Chat to the Harness

**Files:**
- Modify: `src/app/features/ai/ai-chat.service.ts`
- Modify: `src/app/features/ai/ai-chat-page.ts`
- Modify: `src/app/features/ai/ai-chat-page.html`
- Modify: `src/app/features/ai/ai-chat-page.scss`

**Interfaces:**
- `sendRoutineMessage(message, draftId?)` returns `RoutineAgentResponse`.
- `createRoutine(draftId, name)` returns `{ id: string }`.

- [ ] **Step 1: Implement the service methods**

Send the existing Bearer token and anon key to the new functions, parse JSON responses, and surface HTTP errors.

- [ ] **Step 2: Implement the page state, preview, and saved-routine link**

Keep the proposed routine and saved routine ID in signals. Render the preview using the validated exercise names and metrics returned by the backend. After `createRoutine` succeeds, render a `routerLink` to `/routines/:id`; do not navigate automatically.

- [ ] **Step 3: Verify the complete user flow locally**

Build the Angular app and manually execute: trigger wizard, answer all fields, edit/confirm name, save, and land on the routine detail route.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/ai
git commit -m "feat: connect chat to routine wizard"
```

### Task 5: Deploy and End-to-End Verify

**Files:**
- Modify: `docs/superpowers/specs/2026-07-16-ai-routine-wizard-design.md` if behavior changed during implementation

- [ ] **Step 1: Run the Angular build**

```bash
npm run build
```

Expected: build succeeds; existing budget warnings may remain.

- [ ] **Step 2: Deploy frontend and functions**

```bash
npm run deploy:functions
npm run deploy:angular
```

- [ ] **Step 3: Verify production flow**

Use an authenticated browser session and confirm the routine detail page contains the generated exercise rows and planned metrics.

- [ ] **Step 4: Commit any final documentation change**

```bash
git status
git push
```
