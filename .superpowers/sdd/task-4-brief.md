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

