## Task 1: Scaffold the Angular 22 workspace

**Files:**
- Create: `package.json`, `angular.json`, `tsconfig*.json`, `src/`
- Modify: `.gitignore`
- Test: Angular generated test configuration

**Interfaces:**
- Produces the Angular application shell and scripts consumed by all later tasks.

- [ ] **Step 1: Create the Angular 22 application in the repository root**

Run `npx @angular/cli@22 new fit-core --directory . --routing --style=scss --strict --skip-git`.

- [ ] **Step 2: Confirm the workspace is valid**

Run `npm test -- --watch=false`.
Expected: the generated test suite passes.

- [ ] **Step 3: Add project-specific ignore rules**

Ensure `.gitignore` excludes `.env.local`, `.insforge/`, `dist/`, and local Angular cache directories while retaining `training_catalog.json` and `.agents/skills/`.

- [ ] **Step 4: Commit the scaffold**

Run `git add fit-core && git commit -m "feat: scaffold angular application"`.

