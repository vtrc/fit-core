### Task 3: Global responsive + skeleton styles

**Files:**
- Modify: `src/styles.scss`

**Produces:** 480px breakpoint (hide lede, tighter hero). Skeleton shimmer keyframes + `.skeleton-card` / `.skeleton-line` classes for loading state.

- [ ] **After the `@media (max-width: 640px)` block (~line 229), add 480px breakpoint**

```scss
@media (max-width: 480px) {
  .hero .lede {
    display: none;
  }

  .hero {
    margin-bottom: var(--space-4);
  }
}
```

- [ ] **After the buttons section (~line 351), add skeleton styles**

```scss
/* ── Skeleton loading ──────────────────────────────────── */

.skeleton {
  background: var(--fill-soft);
  border-radius: var(--radius-md);
  animation: shimmer 1.5s ease-in-out infinite;
  background-image: linear-gradient(
    90deg,
    var(--fill-soft) 0%,
    var(--fill-hover) 50%,
    var(--fill-soft) 100%
  );
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  min-height: 10rem;
  box-shadow: var(--elevation-card);
  border-radius: var(--radius-lg);
  background: var(--paper);
}

.skeleton-card .skeleton-line {
  height: 0.7rem;
  border-radius: var(--radius-sm);
}

.skeleton-card .skeleton-line:first-child {
  width: 35%;
}

.skeleton-card .skeleton-line:nth-child(2) {
  width: 65%;
  height: 1.2rem;
}

.skeleton-card .skeleton-line:nth-child(3) {
  width: 45%;
}

.skeleton-card .skeleton-line:last-child {
  width: 30%;
  height: 2.5rem;
  margin-top: auto;
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

