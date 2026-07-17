### Task 2: Shell — mobile padding, 44px nav tap targets

**Files:**
- Modify: `src/app/shared/shell/shell.scss`

**Produces:** Reduced horizontal padding on mobile (1rem vs 1.6rem). Bottom nav taller (4rem) with 44px min-height items. Nav label text smaller (0.65rem) to compensate.

- [ ] **Replace entire shell.scss**

```scss
.shell {
  --footer-height: calc(4rem + env(safe-area-inset-bottom));
  min-height: 100dvh;
  padding: 1rem 1rem;
  padding-bottom: var(--footer-height);
  background: var(--parchment);
}

.nav-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  border-top: 1px solid var(--border-default);
  background: var(--paper);
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.4rem 0;
  min-height: 44px;
  text-decoration: none;
  color: var(--ink-muted);
  font-size: 0.65rem;
  border-radius: 0;
  background: transparent;
  transition: color 0.15s;
}

.nav-item.active {
  color: var(--ink);
}

.nav-icon {
  width: 1.4rem;
  height: 1.4rem;
  display: block;
}

.nav-label {
  font-weight: 600;
}

@media (min-width: 640px) {
  .shell {
    padding: 1rem 1.6rem;
    padding-bottom: var(--footer-height);
  }
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

