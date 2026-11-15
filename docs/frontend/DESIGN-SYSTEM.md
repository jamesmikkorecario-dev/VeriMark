# Editorial Systems design system

The owner approved **VeriMark - Editorial Systems** for M1 on 2026-11-15. [Committed reference package](../../design-references/verimark-visual-design/README.md) is authoritative; its proposal labels are preserved historical provenance. Earlier explorations remain under prototypes/design and preserved branches.

Tokens/shared controls live in src/styles/index.css and src/components/ui/index.tsx. Page composition lives in src/pages/pages.css. Plain CSS variables avoid unnecessary dependencies; Tailwind/shadcn are deferred.

| Token | Value / purpose |
| --- | --- |
| --canvas / --paper | #f6f5f0 / #fffefa: canvas and credential |
| --ink / --forest / --forest2 | #1d3730 / #143d32 / #0f3229: reading, action, sidebar |
| --mint / --surface2 | #c1e3ab / #e3e8df: accent and layers |
| --line | #d7dcd3: document rules |
| --muted | #59685f: darkened for readable secondary text |
| --serif | Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif |
| --sans | Segoe UI, Arial, sans-serif |
| --ease | cubic-bezier(.22,.78,.23,1) |

Preserve documentary credential objects, small corners, forest sidebar, thin rules and editorial headings. System font rendering varies by OS; no external fonts. Small shared buttons are at least 44px high. Status includes words, never color alone. Selected control/status text is raised from prototype for readability. Page breakpoints live in pages.css; shared container/credential thresholds are 768/480px. Acceptance widths: 320,390,768,1024,1440,1920px.

Finite 480ms page entrance and short hover/press feedback respect prefers-reduced-motion; all animation/transitions stop in reduce mode. Content stays accessible without reveal scripts or artificial delays.

See M1 handoff for actual browser/visual evidence and deviations. Presentation neither enforces authorization nor proves authenticity.

## Implemented M1 motion

Shared duration tokens are --motion-enter480ms, --motion-reveal650ms, --motion-action220ms and --motion-icon250ms, using --ease. Hero children stage0/40/80/120/160ms; credential100ms; dashboard heading/metrics/content0/60/110/160/180ms. Route entry classes must be applied to content, never sticky shell ancestors. Composed stage selectors protect delays from animation shorthand/load order. PromotionalReveals progressively observes targets once per mount with full-opacity copy, a16px travel reveal and no-observer/live-reduction fallback. Reduced mode removes interaction transforms as well as durations; decorative geometry stays intact. Focus feedback/dismissal remains immediate. See ../ai/handoffs/M1-MOTION.md and ../quality/evidence/m1-motion/README.md for actual temporal evidence.

## Purposeful section scrolling

Public How it works links and the hero secondary CTA target the stationary named method region. Link state sectionScroll:true opts same-page actions into native smooth behavior. RouteEffects measures actual public-header height plus --section-scroll-gap16px, focuses the region with preventScroll and honors reduced motion. No global smooth CSS or manual-scroll interception. Initial/cross-route hashes and POP restoration remain instant. Existing480ms implemented-route content entrances stay unchanged; placeholders keep shared feedback. See ../ai/handoffs/M1-SCROLL.md.
