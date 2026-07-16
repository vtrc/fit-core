# AI Routine Wizard — Spec

## Context

The AI chat currently gives generic fitness advice. It should instead collect user data, query the `exercises` table, generate a concrete routine with sets/reps/weight, and persist it to the database.

---

## User Flow

1. User opens `/ai` and sees the welcome screen.
2. User clicks a suggestion or types a message (e.g. "Quiero crear una rutina").
3. AI responds with a single questions: **edad, peso, objetivo, nivel, días/semana**.
4. User answers all fields at once (e.g. "tengo 35 años, peso 80kg, quiero ganar músculo, nivel intermedio, 4 días").
5. AI queries `exercises` filtered by `type` and `muscle_groups` to select appropriate exercises.
6. AI generates a routine: for each exercise it assigns **sets, reps, weight** (based on level).
7. AI proposes a name and asks for confirmation:
   > *"He creado tu rutina. ¿Quieres guardarla con el nombre 'Rutina Ganar Músculo - 16 jul'? Puedes cambiarlo si lo prefieres."*
8. User accepts or edits the name.
9. App inserts into `routines` and `routine_exercises`.
10. Chat shows a link to `/routines/:id`; it does not navigate automatically.

---

## Data to Collect

| Field | Options |
|-------|---------|
| Edad | integer (e.g. 25–70) |
| Peso | numeric kg (e.g. 60–150) |
| Objetivo | `ganar_musculo` / `perder_grasa` / `resistencia` / `general` |
| Nivel | `principiante` / `intermedio` / `avanzado` |
| Días/semana | 2–6 |

---

## Harness Architecture

The orchestration lives in TypeScript inside the InsForge Functions runtime. Angular is only a client for messages, preview, confirmation, and navigation.

The harness owns the state machine for the current chat session:

```text
idle -> collecting_requirements -> generating_preview
     -> awaiting_name_confirmation -> saved
```

MiniMax M2.7 is called through its OpenAI-compatible tool calling API. The model may extract data and request read-only tools, but it cannot persist a routine directly. The generated proposal remains in the active conversation state until the user approves it.

Tools:

- `extract_profile`: normalizes age, weight, goal, level, and days from free text.
- `search_exercises`: reads real records from `exercises` using the available gym equipment in that table.
- `build_routine_draft`: returns validated exercise IDs with sets, repetitions, weight, rest, and notes.
- `save_routine`: is not exposed to the model; it is executed only after explicit user confirmation.

The user message that triggers the wizard: anything containing "crear rutina", "generar rutina", or "nueva rutina".

---

## AI States (chat behavior)

| State | AI behavior |
|-------|-------------|
| `collecting_profile` | AI asks for the 5 fields. Accepts free-text answers and maps them. |
| `generating_preview` | Harness validates the profile, queries exercises, and asks MiniMax to produce a typed draft. |
| `confirming_name` | AI shows the generated routine summary + proposed name, asks to confirm/edit. |
| `idle` | Welcome screen with suggestions. |
| `saved` | Backend returns the routine ID and Angular shows a link to its detail page. |

---

## Routine Generation Logic

- **Ganar músculo**: type=`strength`, split by muscle group, 3–5 sets × 8–12 reps, progressive weight.
- **Perder grasa**: type=`cardio` + light strength, 3–4 sets × 15–20 reps, lower weight, more volume.
- **Resistencia**: type=`cardio`, 3–4 sets × 20+ reps, low weight.
- **General**: mix of strength + cardio.

Sets/reps per level:
- Principiante: 3 sets × 12 reps
- Intermedio: 4 sets × 10 reps
- Avanzado: 5 sets × 8 reps

---

## Database Changes

No new draft table. The existing routine tables remain the source of truth for saved routines:

```
routines(id, user_id, name, description, created_at, updated_at)
routine_exercises(id, routine_id, exercise_id, position, planned_sets, planned_repetitions, planned_weight, rest_seconds, notes, created_at, updated_at)
```

The proposed routine is held in the active TypeScript session state. It is not persisted until the user explicitly approves it. If the session is refreshed before approval, the proposal is discarded.

---

## API Design

### POST `/functions/routine-agent`

**Chat request:**
```json
{
  "action": "message",
  "conversation_state": "collecting_requirements",
  "message": "Tengo 35 años, peso 80 kg..."
}
```

**Response:**
```json
{
  "state": "awaiting_name_confirmation",
  "conversation_state": "awaiting_name_confirmation",
  "message": "He creado tu rutina...",
  "draft": { "proposed_name": "Rutina Ganar Músculo", "exercises": [] }
}
```

### POST `/functions/create-routine`

Called only by Angular after confirmation. It receives the approved routine payload and final name, validates the authenticated user and all exercise IDs, inserts `routines` and `routine_exercises` transactionally, and returns `{ id }`.

**Auth**: Requires Bearer token. Extracts `user_id` from JWT.

---

## Component Changes

### `ai-chat-page.ts`
- Add `wizardState = signal<'idle' | 'collecting_profile' | 'confirming_name'>('idle')`
- When `wizardState === 'idle'` and user sends a message → set `wizardState = 'collecting_profile'`
- After user answers all 5 fields → call `routine-agent`, show the generated proposal, and enter `confirming_name`
- Only after explicit user approval → call `create-routine` → show a link to `/routines/:id` without automatic navigation

### `ai-chat-page.html`
- When `wizardState === 'confirming_name'`: show routine summary + name input + confirm button
- Use a styled card instead of raw Markdown for the routine preview

### `ai-chat.service.ts`
- Add method `createRoutine(data)` that calls `POST /functions/create-routine`

### `functions/routine-agent.ts`
- Harness state transitions and tool loop in the active conversation.
- Zod validation of model output and user profile.
- Exercise query limited to existing database records.

### `functions/create-routine.ts`
- Authenticates the caller.
- Validates the approved exercise IDs and metrics.
- Persists the routine and its exercises atomically.

### `functions/minimax-chat.ts`
- Remains the compatibility streaming endpoint for free-form chat.
- It is not responsible for routine persistence.

---

## Routing

After saving: `router.navigate(['/routines', routineId])`

---

## Files to Change

```
functions/routine-agent.ts             — harness and MiniMax tools
functions/create-routine.ts            — authenticated transactional persistence
functions/minimax-chat.ts              — existing free-form chat compatibility
src/app/features/ai/ai-chat-page.ts      — wizard state management
src/app/features/ai/ai-chat-page.html    — confirm name UI
src/app/features/ai/ai-chat-page.scss     — routine preview card styles
src/app/features/ai/ai-chat.service.ts    — createRoutine() call
src/app/core/insforge/insforge-client.ts   — authenticated function client
No new migration                             — existing routine tables are sufficient
```

---

## Out of Scope

- Profile persistence (data only lives in the active chat session)
- Editing the generated routine in chat
- Suggestions for next workout based on history
- Multiple routines per conversation
