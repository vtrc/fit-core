### Task 2: Install `@angular/cdk` and add `updatePositions` method

**Files:**
- Modify: `package.json`
- Modify: `src/app/features/routines/routines.service.ts`

**Interfaces:**
- Consumes: `RoutineRow` with `position`, `Routine` with `position`
- Produces: `RoutinesService.updatePositions(items: { id: string; position: number }[]): Observable<void>`

- [ ] **Step 1: Install @angular/cdk**

```bash
npm install @angular/cdk
```

- [ ] **Step 2: Add `updatePositions()` to `RoutinesService`**

Add to `src/app/features/routines/routines.service.ts`, after `delete(id)` (line 341):

```typescript
updatePositions(items: { id: string; position: number }[]): Observable<void> {
  return from(this.requireUserId()).pipe(
    switchMap((userId) =>
      from(
        (async () => {
          for (const item of items) {
            const { error } = await this.insforge.client.database
              .from('routines')
              .update({ position: item.position })
              .eq('id', item.id)
              .eq('user_id', userId);

            if (error) {
              throw error;
            }
          }
        })(),
      ),
    ),
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json src/app/features/routines/routines.service.ts
git commit -m "feat: add @angular/cdk and updatePositions service method"
```

---

