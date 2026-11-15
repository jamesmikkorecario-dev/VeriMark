# VeriMark accessibility plan — approval pending

Target WCAG 2.2 AA for the future product. Visual direction/tokens remain provisional; no conformance claim or production implementation. Routes and states are specified in ROUTES-AND-STATES.md, component behaviors in COMPONENT-LIBRARY.md. The mandatory frontend is React.js + TypeScript with Vite; accessibility does not require additional cloud services or paid tooling.

## Journey acceptance and planned tests

| Stories / journey | Keyboard and assistive-technology acceptance | Narrow-screen / state acceptance |
| --- | --- | --- |
| US-001 workspace | Organization selector named; current scope announced; denied member action explains restriction without exposing another tenant | Organization context visible at 320px; empty/loading/denied are distinct; no stale previous-tenant data |
| US-002 templates | File control labels allowed formats and errors; preview has text equivalent; focus returns from preview to trigger | Unsupported-file error readable at 200% text; private asset failure distinct from empty template list |
| US-003 issue one | Logical form order; associated required/error text; review heading focused; edit restores field; approve pending/result announced once | No hidden comparison fields on mobile; preserve draft on conflict; timeout does not invite duplicate issuance |
| US-004 CSV | Row number/field errors in linked summary and table headers; duplicate/error status uses words; keyboard scroll region | 200-row review bounded/paginated; long data cannot push approval offscreen; partial PDF failure count readable |
| US-005 recipient | No account/wallet hurdle; capability unavailable announced generically; download has accessible name and explicit PDF state | Invalid/expired/revoked access indistinguishable; pending/failed/ready PDF differentiated; expired URL retry does not lose record context |
| US-006 verifier | ID entry works with Enter; result announced without unexpected focus move; details heading receives route focus | Compare recipient, achievement, issuer/date without truncation; valid/expired/revoked/replaced/not found/unable distinct in text and high contrast |
| US-007 lifecycle | Confirm/cancel/reason accessible; dialog focus contained and restored; replaced original and successor labels unambiguous | Revocation vs expiry visible without color; no auto-redirect to successor claims or stale valid badge |
| US-008 history | Filters and pagination labeled; loading announces completion; table headers associated; focus remains stable | Empty/error/denied separate; table scroll contained; seeded counts labeled fictional |
| US-009 pilot | Manual screen-reader and keyboard findings resolved/accepted with owner before real pilot | Representative users and consented records required; prototype audit cannot stand in for pilot evidence |

## Common acceptance

Use native links/buttons/inputs/selects with persistent labels, one H1, named distinct landmarks, skip-to-main and logical reading order. Provide visible focus with sufficient contrast and avoid obscuring focused controls. Text contrast target 4.5:1, large text 3:1 and essential control/focus indicators 3:1; evaluate the chosen palette before production token approval. Status needs words, not a green/red dot. Avoid seals implying accreditation. Explain QR as navigation and comparison as the verifier's task.

New route focuses main/heading; async inline messages use a polite status region. Validation focuses an error summary with field links; associate errors using aria-describedby/aria-invalid. Keep entered values on failure. Pending buttons prevent duplicate mutation without losing contextual feedback. No unsolicited autofocus on page load, keyboard traps or disappearing focused elements. Dialog Escape/cancel restores trigger focus; destructive confirmation names the record and consequences. Respect prefers-reduced-motion; no flashing or essential timed animation. Loading indicators have text; decorative icons are hidden from assistive technology.

Test 320px and 390px phones, 768px tablet, 1440px desktop, 200% text and 400% zoom/reflow (320 CSS-pixel equivalent). Targets should be at least 44px high with adequate spacing; verify links as well as buttons. Long names, identifiers, translated status text, orientation change and large OS text must retain comparison information. Tables may scroll within a named keyboard-accessible region; the whole page must not overflow. Check Windows forced colors and reduced motion, contrast in default/focus/disabled/error states, browser Back/refresh/deep links, and offline/retry announcements.

## Evidence and remaining gaps

Recorded prototype evidence is in prototypes/design/evidence/browser-checks.json and docs/ai/handoffs/INIT-C.md. Existing baseline rendered 36 screenshots at 390x844 and 1440x1000, ran 18 mobile-screen plus three post-journey axe audits with zero violations, and checked skip-link Enter focus on main. The current identity correction reruns and supersedes that baseline; handoff records actual new results. Axe success is not manual screen-reader review, full keyboard coverage or WCAG conformance. Production capability/PDF/replaced transitions, real mobile device, 320/768px, zoom, forced colors and screen-reader checks remain unrun. Proposed tests here are requirements, not passing results.

For each defect record story/screen/state, reproduction and viewport/AT version, impact, owner, fix commit and retest result. Lost recipient identity, inaccessible verification result or keyboard-blocked approval is release blocking. Coordinator independently reviews the correction; human visual choice and release approval remain separate gates.
