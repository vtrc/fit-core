### Task 4: Routine card — tighter mobile spacing, 44px buttons

**Files:**
- Modify: `src/app/shared/routine-card/routine-card.scss`

**Produces:** Card padding reduced on mobile, 44px min-height enforced on action buttons, smaller gap between action buttons.

- [ ] **Replace entire routine-card.scss**

```scss
:host {
  display: block;
}

.routine-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  min-height: 10rem;
}

.routine-body h2 {
  margin: var(--space-2) 0;
  font-size: 1.25rem;
  line-height: 1.3;
  text-wrap: balance;
}

.routine-desc {
  color: var(--ink-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  display: -webkit-box;
  overflow: hidden;
  margin-bottom: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.routine-actions {
  display: flex;
  gap: var(--space-3);
}

.routine-actions ::ng-deep > * {
  flex: 1;
  text-align: center;
  padding: 0.65rem var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 600;
  min-height: 44px;
  display: grid;
  place-items: center;
}

@media (max-width: 480px) {
  .routine-card {
    padding: var(--space-4);
    min-height: 8rem;
  }

  .routine-actions {
    gap: var(--space-2);
  }
}
```

- [ ] **Verify build**

```bash
npx ng build
```

---

