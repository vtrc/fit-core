### Task 1: Enable View Transitions

**Files:**
- Modify: `src/app/app.config.ts`

**Produces:** `withViewTransitions()` enabled on router — `<router-outlet>` transitions get a crossfade by default without any extra CSS.

- [ ] **Add `withViewTransitions` import and option**

```ts
import { provideRouter, withViewTransitions } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
  ],
};
```

- [ ] **Verify build**

```bash
npx ng build
```

---

