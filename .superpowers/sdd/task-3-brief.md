## Task 3: Add InsForge client, Google authentication, and catalog access

**Files:**
- Create: `src/app/core/insforge/insforge-client.ts`
- Create: `src/app/core/auth/auth.service.ts`
- Create: `src/app/core/auth/auth.guard.ts`
- Create: `src/app/features/auth/login-page.*`
- Create: `src/app/core/catalog/catalog.service.ts`
- Modify: `src/app/app.routes.ts`
- Test: `src/app/core/auth/auth.service.spec.ts`, `src/app/core/catalog/catalog.service.spec.ts`

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

- [ ] **Step 6: Run tests and commit**

Run `npm test -- --watch=false`.
Expected: auth and catalog tests pass.

Commit with `git add fit-core/src/app && git commit -m "feat: add google auth and exercise catalog"`.

