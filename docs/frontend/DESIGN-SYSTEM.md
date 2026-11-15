# Frontend Design System — PROVISIONAL

Human visual selection is pending. No production tokens are finalized or approved. The placeholder token table below is a future specification template, not an implemented system. See [visual directions](../design/VISUAL-DIRECTIONS.md) and [design decisions](../design/DESIGN-DECISIONS.md) for the three original local prototypes; prototype CSS values must not be promoted to production defaults before a human chooses.

Proposed common behavior: labeled semantic controls, visible keyboard focus, textual status, 44px minimum target height, readable 390px single-column layout, and reduced-motion support. Prototype layouts switch below 700px; this is an experiment, not an approved breakpoint token. Typography ranges from 38–76px display headings with 17px base body text. Exact direction palettes, fonts, edges and grid proportions remain isolated inside the standalone exploration artifacts.

**Visual direction:** [brand personality e.g. monochrome editorial / warm utility].

## Tokens (record exact values after visual exploration)

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--color-bg` | [hex] | [hex] | app surface |
| `--color-surface` | [hex] | [hex] | cards and panels |
| `--color-text` | [hex] | [hex] | primary text |
| `--color-muted` | [hex] | [hex] | secondary text |
| `--color-accent` | [hex] | [hex] | actions and focus |
| `--color-danger` | [hex] | [hex] | errors |
| `--space-1` … `--space-8` | [scale] | same | rhythm |
| `--radius-sm/md/lg` | [values] | same | surfaces |
| `--font-body`, `--font-mono` | [font stacks] | same | typography |

Define a predictable type scale, max content widths, breakpoints, shadows and motion durations. Avoid inventing tokens in feature files.

## Interaction rules

- Semantics before styling; native buttons/links/forms where possible.
- Explicit default/hover/focus/disabled/pending/invalid/success states.
- Dark mode is optional; if built, test both themes and system preference.
- Support reduced motion, visible focus and sufficient contrast.
- Mobile-first layouts; use real content and long-string stress tests.

## Approval artifacts

Navigation map, responsive screen specs, state matrix, component inventory; record approved visual directions and unresolved designs. Do not present generated visuals as validated user research.
