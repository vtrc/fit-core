# FitCore

FitCore is an Angular fitness tracker backed by InsForge. The app uses Google OAuth for authentication, protects private application routes with `authGuard`, and stores user-owned routines and workout history scoped to the signed-in user.

## Development server

To start a local development server, run:

```bash
ng serve
```

Open `http://localhost:4200/` after the server starts.

## Manual verification checklist

Use two different Google accounts when checking user isolation.

- [ ] Google auth: sign in with Google from `/login`; after OAuth, the app redirects to `/dashboard`.
- [ ] Route guard: while signed out, direct navigation to `/dashboard`, `/routines`, `/routines/new`, `/routines/:id`, `/routines/:id/edit`, `/workouts/start`, `/workouts/session`, `/workouts/summary`, `/history`, `/history/:id`, or `/statistics` redirects to `/login`.
- [ ] Routine creation: create a routine with at least one exercise, save it, and confirm it appears in the routines list.
- [ ] Routine workout: start a workout from a saved routine, enter strength/cardio results where applicable, save, and confirm the summary/history entry is created.
- [ ] Free workout: start a workout without a routine, add exercise results, save, and confirm it appears in history.
- [ ] Strength/cardio save: verify strength sets retain load/reps and cardio results retain duration/distance data after saving.
- [ ] History/statistics: confirm saved workouts appear in `/history`, detail pages open from `/history/:id`, and `/statistics` reflects the user's saved sessions.
- [ ] Two-user isolation: sign in as user A and create routines/workouts; sign in as user B and confirm user A's routines, history, details, and statistics are not visible or editable.
- [ ] Repository hygiene: confirm no credentials, API secrets, OAuth client secrets, or local environment files are committed.

## Security audit notes

- Google authentication is initiated through `AuthService.signInWithGoogle()` using InsForge OAuth and redirects successful sign-in to `/dashboard`.
- `authGuard` restores the session while auth state is loading and only allows access when `AuthService.user()` is present; otherwise it returns a `/login` URL tree.
- Protected routes currently include dashboard, routines, routine create/edit/detail, workout start/session/summary, history list/detail, and statistics. `/login` is intentionally public.
- Routine, workout, history, and statistics verification must include user scoping. Client services use the current authenticated user id for owned reads/writes, but this should also be enforced by backend RLS/policies because route guards are only client-side controls.
- No credentials were found in the repository root during this audit. Keep `.env.local`, InsForge keys, OAuth secrets, and service tokens out of git.

## Code scaffolding

Generate a component with:

```bash
ng generate component component-name
```

## Building

Build with:

```bash
ng build
```

## Running unit tests

Run unit tests with:

```bash
ng test
```

## Running end-to-end tests

Run e2e tests with:

```bash
ng e2e
```

## Additional resources

See the [Angular CLI documentation](https://angular.dev/tools/cli) for command details.
