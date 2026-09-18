---
trigger: always_on
---

---

name: design-system-rule
description: Enforce non-negotiable adherence to custom design tokens, color palettes, typography systems, component styling, status badge conventions, and strict 3-screen view boundaries.
version: 1.0.0

---

# Operational Directives: Design System & Visual Architecture

## 1. Exclusive Design System Mandate

- **Zero External Utility Overrides:** You MUST build all user interface elements exclusively using the custom design tokens defined in `matisse-tokens-all.css`.
- **No Unapproved Component Libraries:** You are STRICTLY FORBIDDEN from importing or using unapproved external UI component libraries (e.g., shadcn/ui, Material UI, Chakra UI, Ant Design, or Bootstrap).
- **No Arbitrary Color Values:** Do NOT write raw hex codes (`#FFFFFF`), RGB values (`rgb(0,0,0)`), or standard generic Tailwind colors (e.g., `bg-blue-500`, `text-red-600`) inline. ALL colors must map strictly to your HSL variable tokens defined in the system.

## 2. Design Tokens & Styling Mapping (`matisse-tokens-all.css`)

All layouts, components, borders, and backgrounds MUST reference the design tokens emitted by the token converter (`node tokens-to-css.mjs`):

- **Primary Accent:** `var(--color-primary-color)`
- **Surface & Containers:** `var(--color-surface-container-color)`
- **Background:** `var(--color-background-color)`
- **Text & Contrast:** `var(--color-on-surface-color)`, `var(--color-on-surface-variant-color)`
- **Error States:** `var(--color-error-color)`
- **Borders & Radius:** `var(--border-radius-radius-md)` (standard component border-radius)

## 3. Status Badge Standard Specifications

Job execution state badges must strictly map to the status tokens defined in the design system:

- **`PENDING` State:** `background-color: var(--status-warning-surface); color: var(--status-warning-text); border: 1px solid var(--status-warning-border);`
- **`PROCESSING` State:** `background-color: var(--status-info-surface); color: var(--status-info-text); border: 1px solid var(--status-info-border);` with a subtle CSS pulsing animation (CSS keyframes only, no utility framework).
- **`DONE` State:** `background-color: var(--status-success-surface); color: var(--status-success-text); border: 1px solid var(--status-success-border);`
- **`FAILED` State:** `background-color: var(--status-error-surface); color: var(--status-error-text); border: 1px solid var(--status-error-border);`

## 4. Strict 3-Screen View Scope

You MUST restrict the UI to the 3 functional screens listed in `PRD.md`[cite: 2]. Do NOT invent secondary landing pages, headers, hero sections, footers, marketing copy, or extra dashboards[cite: 2]:

1. **Screen 1 (Upload View - `/`):** Single-file dropzone centered in the primary surface container[cite: 2].
2. **Screen 2 (Processing View - `/jobs/[id]`):** Active polling view with continuous state badge updates and a 60-second timeout error state[cite: 2].
3. **Screen 3 (Result View - `/jobs/[id]`):** Structured financial output grid, summary action drawer trigger, and single reset upload button[cite: 2].
