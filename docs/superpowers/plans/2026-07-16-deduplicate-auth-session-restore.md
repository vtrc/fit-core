# Deduplicate Auth Session Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent concurrent startup refresh calls from invalidating InsForge's rotating CSRF token.

**Architecture:** `AuthService` will own a single in-flight restoration promise. Its constructor and `authGuard` will continue using the same public `restoreSession()` method, but concurrent calls will await that shared promise. The promise will be cleared when settled so an explicit later restore still reaches the SDK.

**Tech Stack:** Angular 22, TypeScript, Vitest, `@insforge/sdk` 1.4.

## Global Constraints

- Do not change InsForge OAuth or backend CSRF configuration.
- Do not commit an InsForge anon key; existing environment placeholders remain unchanged.
- Keep the current behavior that 401 and 403 clear the user without setting a visible auth error.
- Preserve the public `restoreSession(): Promise<void>` API.

---

### Task 1: Serialize Session Restoration

**Files:**
- Modify: `src/app/core/auth/auth.service.spec.ts`
- Modify: `src/app/core/auth/auth.service.ts`

**Interfaces:**
- Consumes: `InsforgeClientService.client.auth.getCurrentUser(): Promise<{ data: { user: UserSchema | null } | null; error: unknown }>`.
- Produces: `AuthService.restoreSession(): Promise<void>` that shares one request while an earlier call is pending.

- [ ] **Step 1: Write the failing test**

Add this test after the existing restoration test in `src/app/core/auth/auth.service.spec.ts`:

```ts
it('shares an in-flight session restoration', async () => {
  let resolveUser!: (result: { data: { user: null }; error: null }) => void;
  getCurrentUser.mockImplementation(
    () => new Promise((resolve) => (resolveUser = resolve)),
  );

  const service = TestBed.inject(AuthService);
  const secondRestore = service.restoreSession();

  expect(getCurrentUser).toHaveBeenCalledTimes(1);

  resolveUser({ data: { user: null }, error: null });
  await secondRestore;
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx ng test --watch=false --include='src/app/core/auth/auth.service.spec.ts'`

Expected: FAIL because `getCurrentUser` is called twice: once by the constructor and once by `secondRestore`.

- [ ] **Step 3: Write the minimal implementation**

In `src/app/core/auth/auth.service.ts`, add an in-flight promise field and make `restoreSession()` reuse it:

```ts
private restoreSessionPromise: Promise<void> | null = null;

restoreSession(): Promise<void> {
  if (this.restoreSessionPromise) return this.restoreSessionPromise;

  this.restoreSessionPromise = this.restoreSessionInternal().finally(() => {
    this.restoreSessionPromise = null;
  });
  return this.restoreSessionPromise;
}

private async restoreSessionInternal(): Promise<void> {
  this.loading.set(true);
  const { data, error } = await this.insforge.client.auth.getCurrentUser();
  this.user.set(error ? null : (data?.user ?? null));
  this.error.set(this.isUnauthenticated(error) ? null : (error?.message ?? null));
  this.loading.set(false);
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx ng test --watch=false --include='src/app/core/auth/auth.service.spec.ts'`

Expected: PASS with the new concurrent restoration test and existing auth tests green.

- [ ] **Step 5: Run full verification**

Run: `npx ng test --watch=false && npx ng build`

Expected: all unit tests and the production Angular build pass.

- [ ] **Step 6: Commit only when explicitly requested**

If requested, stage only `src/app/core/auth/auth.service.ts`, `src/app/core/auth/auth.service.spec.ts`, and the approved design/plan documents, then commit using a conventional message such as `fix: serialize auth session restoration`.
