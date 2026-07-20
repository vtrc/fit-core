---
name: FitCore
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b1f'
  surface-container: '#1e1f23'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343539'
  on-surface: '#e3e2e7'
  on-surface-variant: '#c4c9ac'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3034'
  outline: '#8e9379'
  outline-variant: '#444933'
  surface-tint: '#abd600'
  primary: '#ffffff'
  on-primary: '#283500'
  primary-container: '#c3f400'
  on-primary-container: '#556d00'
  inverse-primary: '#506600'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#5e1700'
  tertiary-container: '#ffdbd0'
  on-tertiary-container: '#b83500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c3f400'
  primary-fixed-dim: '#abd600'
  on-primary-fixed: '#161e00'
  on-primary-fixed-variant: '#3c4d00'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59e'
  on-tertiary-fixed: '#3a0b00'
  on-tertiary-fixed-variant: '#852400'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343539'
typography:
  display-metrics:
    fontFamily: Anybody
    fontSize: 64px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Anybody
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Anybody
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
This design system is built for a high-intensity fitness environment, focusing on energy, motion, and peak performance. The brand personality is motivating and authoritative, designed to push users toward their goals with a "no-excuses" visual clarity.

The style is **High-Contrast / Bold** with elements of **Minimalism** to ensure data density doesn't lead to cognitive overload. It utilizes deep blacks to create a focused environment where vibrant accent colors pop, highlighting progress and actionable items. The emotional response is one of urgency and empowerment—professional enough for elite athletes but accessible enough for beginners.

## Colors
The palette is centered around a "Dark Mode First" philosophy to minimize eye strain during early morning or late-night workouts.

- **Primary (Electric Lime):** Used for primary actions, success states, and key progress metrics. It symbolizes energy and growth.
- **Secondary (Obsidian):** The foundation of the UI. Used for background surfaces to provide deep contrast for the primary accents.
- **Tertiary (Neon Orange):** Reserved for high-alert data, heart rate zones, or "burn" phases. It provides a heat-map contrast against the Lime.
- **Neutral:** A scale of cool grays used for secondary text and borders to maintain a professional, technical aesthetic.

## Typography
Typography is the primary driver of the "athletic" feel. We use a three-font system to differentiate between data, prose, and technical labels.

- **Anybody (Headlines/Metrics):** Chosen for its variable weight and aggressive, expansive width. Use the Bold or ExtraBold weights for "Display Metrics" to make progress feel monumental.
- **Lexend (Body):** Used for exercise descriptions and instructions. Its hyper-legibility is critical when a user is moving or fatigued.
- **JetBrains Mono (Labels/Technical Data):** Used for timestamps, rep counts, and technical specs. The monospaced nature keeps data columns aligned and feels like high-end sports equipment instrumentation.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for quick glances. We use a 4px base unit to maintain tight, technical alignment.

- **Mobile:** 4-column layout with 20px outside margins. Content blocks (cards) should stack vertically to maximize width for charts.
- **Desktop/Tablet:** 12-column grid. Use "Dashboard" layouts where progress metrics are pinned to a side rail while workout videos or schedules occupy the center.
- **Spacing Rhythm:** Use tight spacing (`stack-sm`) for related data points (e.g., weight + reps) and generous spacing (`stack-lg`) between distinct workout blocks to provide visual breathing room.

## Elevation & Depth
In this dark, high-energy environment, depth is created through **Tonal Layers** rather than heavy shadows.

- **Surface Levels:** The base background is true black (#000000). Cards and containers use a slightly elevated dark gray (#1A1A1A).
- **Outlines:** Instead of shadows, use **Low-contrast outlines** (1px solid #2C2C2E) to define card boundaries. This maintains a clean, "pro-gear" aesthetic.
- **Active State Glow:** Primary elements (like active toggle switches or "Start" buttons) may use a subtle, high-blur outer glow in the primary color to simulate an LED display.

## Shapes
The shape language is **Soft (Level 1)**. While the typography is aggressive, the UI elements use a subtle 4px–8px corner radius. This prevents the interface from feeling "sharp" or "dangerous," maintaining a professional fitness tool feel.

- **Standard Buttons:** 4px radius (Soft).
- **Cards/Containers:** 8px radius (rounded-lg).
- **Data Tags/Chips:** Full pill-shape to contrast against the rectangular grid of the workout cards.

## Components
- **Buttons:** Primary buttons are solid Electric Lime with black text. Secondary buttons use a heavy 2px outline. All buttons should use `label-caps` for a "command" feel.
- **Workout Cards:** Use a flat background (#1A1A1A) with a subtle top-border in the primary color if the workout is "Active." Metrics inside the card should use `JetBrains Mono`.
- **Progress Rings:** Use a 12px stroke width. The "unfilled" portion of the ring should be a dark gray (#2C2C2E) to keep the focus on the vibrant Lime progress.
- **Inputs:** Dark fields with a bright bottom-border on focus. Use `Lexend` for user input text to ensure clarity.
- **Chips:** Small, high-contrast labels for "Leg Day," "HIIT," or "Recovery." Backgrounds should be low-opacity versions of the accent colors to keep text legible.
- **Metric Tiles:** Large, centered `display-metrics` for the most important number (e.g., Heart Rate), with a small `label-caps` descriptor underneath.