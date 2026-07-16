# Deduplicate Auth Session Restore

Startup will issue at most one InsForge session refresh. This prevents concurrent refresh calls from racing over InsForge's rotating CSRF token and makes an expired or absent session resolve cleanly to the login page.

## Quick Path

1. `AuthService.restoreSession()` reuses an in-flight request instead of starting another refresh.
2. The shared request always clears after it settles, so a later restoration can run normally.
3. A unit test proves concurrent callers invoke `getCurrentUser()` only once.

## Details

| Topic | Decision |
| --- | --- |
| Root cause | `AuthService` starts restoration in its constructor while `authGuard` requests restoration during initial navigation. |
| Concurrency | Store the in-flight `Promise<void>` privately and return it to every concurrent caller. |
| Error behavior | Retain the current behavior: 401/403 produces no visible auth error and clears the user. |
| Configuration | Do not add an anon key to source control. The placeholder must be replaced through local/deployment configuration separately. |

## Checklist

- [ ] Two concurrent `restoreSession()` calls make one SDK request.
- [ ] A completed restoration allows a later restoration.
- [ ] The focused auth tests and Angular build pass.
- [ ] No InsForge key is committed.

## Out Of Scope

- Changing InsForge OAuth or CSRF backend configuration.
- Adding a committed credential or changing the existing environment secret-delivery mechanism.
