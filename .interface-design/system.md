# FitCore Design System

## Direction & Feel

Warm, physical, tactile — like a chalk-dusted gym floor at dawn. The palette comes from real gym materials: parchment for well-worn paper logs, rust for iron oxide on old plates, ink for permanent markers on whiteboards, moss and sage for the calm of a finished session.

## Tokens

```css
--parchment: #f5f1e8          /* page background */
--paper: #fffdf8               /* card surface */
--ink: #1f3028                 /* primary text, primary button */
--ink-secondary: #435248       /* body text, lede */
--ink-muted: #617064           /* metadata, placeholder */
--rust: #a44a2c                /* accent — eyebrows, timer, charts, type indicators */
--success: #1d5b3d             /* positive feedback */
--danger: #9d2f2f              /* destructive actions */
--success-bg: #eef7f1          /* completed card tint */
--danger-bg: #fce9e6           /* error state background */
--fill-soft: #f7f1e6           /* tag, metric chip background */
--fill-hover: #e8dfd0          /* button default, hover state base */
--border-subtle: rgba(31,48,40,0.07)  /* dividers, light separators */
--border-default: rgba(31,48,40,0.12) /* nav border, section dividers */
--border-strong: rgba(31,48,40,0.18)  /* catalog borders */
--border-input: rgba(31,48,40,0.2)    /* input outlines */
```

## Depth Strategy

**Elevation shadows + whisper borders.** Cards and modals use layered transparent shadows (adapt to any background). No solid borders on cards. Inputs keep subtle borders for scannability.

- `--elevation-card`: 3-layer shadow for cards, sidebars
- `--elevation-modal`: stronger shadow for modals, dialogs

## Spacing

4px base unit (`--space-1` = 0.25rem). Scale: 1/2/3/4/5/6/8/10/12.

- Micro (space-1/2): icon gaps, tag spacing
- Component (space-3/4): button padding, card internal gaps
- Section (space-5/6): between groups within a page
- Major (space-8/10/12): page padding, between sections

## Border Radius

- `--radius-sm`: 0.5rem — inputs, tags, chips, small controls
- `--radius-md`: 0.75rem — buttons, metric blocks
- `--radius-lg`: 1.25rem — cards, modals, panels

## Typography

Inter, system fallback. Hierarchy uses weight + color more than size.

- Headings: `text-wrap: balance`, tight line-height (~0.95)
- Eyebrow labels: 0.75rem / 800 weight / tracked 0.16em / `--rust`
- Body: `--ink-secondary`
- Metadata: `--ink-muted`
- Numeric values (counters, timers, weights): `font-variant-numeric: tabular-nums`

## Text Hierarchy

Four levels: primary (`--ink` / 600+), secondary (`--ink-secondary` / 500), muted (`--ink-muted` / 400), accent (`--rust` / 800 for labels).

## Page Layout

All pages share:
- `background: var(--parchment)`
- `padding: var(--space-8) clamp(var(--space-4), 4vw, var(--space-10)) var(--space-12)`
- Hero section with eyebrow + h1 (clamped responsive) + lede
- Cards via `box-shadow: var(--elevation-card)` on `var(--paper)`

## Key Component Patterns

**Cards:** `box-shadow: var(--elevation-card)` | radius `var(--radius-lg)` | bg `var(--paper)` | padding `var(--space-5)`. No solid borders.

**Buttons:** radius `var(--radius-md)` | bg `var(--fill-hover)` / `var(--ink)` for primary | padding `.8rem var(--space-4)`. Hover darkens fill slightly.

**Inputs:** border `1px solid var(--border-input)` | radius `var(--radius-sm)` | bg `var(--paper)`. Focus: border to `var(--ink)`.

**Progress:** Native `<progress>` styled with `accent-color: var(--ink)` and custom `::-webkit-progress-*` for the track/value backgrounds.

**Interactive states:** default → hover (background shift 10-15%) → active (no separate state yet) → focus-visible (outline) → disabled (opacity .65).
