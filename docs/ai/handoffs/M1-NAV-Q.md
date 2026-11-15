# VeriMark handoff: M1-NAV-Q

- Status: dependency blocked; regression draft ready for review, final implementation verification pending.
- Owner: Q; independent reviewer: coordinator, requested through orchestration.
- Goal: navigation correction browser regression coverage per M1-NAV-CONTRACT.
- Branch/worktree: jamesmikkorecario-dev/m1-nav-quality, C:/Users/James/orca/workspaces/VeriMark/m1-nav-quality; base 70f7c1c2a6dc4e39728ae593af81b9eeee830088.
- Changed paths: e2e/navigation.spec.ts adds behavioral regressions; e2e/foundation.spec.ts adapts keyboard expectations for deliberate modal drawer; playwright.config.ts adds 440x956 and preserves all prior widths.
- Inputs: README source matrix, PRD, M1-CONTRACT, M1-NAV-CONTRACT, actual Layouts.tsx and pages.css, existing tests. No API/schema/env or dependency changes.
- Coverage draft: sticky/banner relationships, icon-only controls, Escape/restoration, destination, backdrop, desktop resize, history, modal focus containment/background blocking, scroll/style preservation, layout stability, independent short viewport scrolling, long organization/labels, reduced motion, open axe and screenshots alongside retained closed axe/screenshots and desktop regressions.

| Actual command/check | Result | Evidence |
| --- | --- | --- |
| npm ci | PASS | 235 packages, 0 vulnerabilities |
| npm run typecheck | PASS | baseline plus new browser draft |
| npm run lint | PASS | baseline plus new browser draft |
| npm test -- --run | PASS | 5 files / 24 tests, baseline source |
| npm run build | PASS | Vite 8.3.8, 32 modules |
| Installed Chrome direct baseline preview :3001, 440x956, scrollY=650 | REPRODUCED | Public header y=-619.609375, panel y=100; workspace header y=-650, panel y=75; closed/scrolled-open screenshots captured under ignored test-results (later Playwright run replaces output) |
| $env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e -- --project=chromium-440 --grep 'sticky header' --workers=4 | EXPECTED FAIL | 2 failed at sticky assertion: -619.609375 and -650 versus expected 0; screenshot/trace/error-context and closed.png under test-results |
| Full Chrome suite against implementation | NOT RUN | I SHA not yet supplied; coordinator explicitly directed retaining tests and reporting dependency |

- Risks/limits: remaining contract assertions intentionally target incoming implementation and have not been verified against it. No source changes, no claim of browser/screen-reader/device compliance or server/RLS checks (frontend navigation only).
- Next owner: coordinator supplies implementation SHA, reopens Q for cherry-pick, real full verification, render inspection and correction findings. Do not treat baseline unit/build passes as navigation acceptance.
- Independent review: requested; pending coordinator. No push/main merge/deploy/cloud performed.
