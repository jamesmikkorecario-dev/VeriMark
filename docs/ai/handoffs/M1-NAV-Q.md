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

## Final dependent verification (supersedes dependency-blocked status above)

- Status: ready for coordinator review; all assigned verification complete.
- Consumed implementation commits: ebe47444761509fdab704885710d9d2ccfd5c533, 0d8162da5252d2c2342ffc31200d35aea11bfbcc, ecdd77160398c1df42cfab426172843b6788db00 (local cherry-picks 5f8fcc7, e1cb0e3, efee616). Coordinator should integrate original I commits plus Q fb2ff7d and the final Q test/report commit reported through worker_done.
- Actual final commands: npm run typecheck PASS; npm run lint PASS; npm test -- --run PASS (5 files, 29 tests); npm run build PASS (34 modules); $env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e -- --workers=4 PASS (76 passed, 15 skipped, 91 total; 59.8 seconds).
- Width matrix: 320x900, 390x900, 440x956, 768x900, 1024x900, 1440x900, 1920x900. Five mobile-only cases skip at each desktop width 1024/1440/1920; retained desktop foundation/navigation screenshot regressions execute there. Stress cases independently use 400px viewport height.
- Exact axe counts: 36 scans, zero violations: 14 closed whole-page scans (public/workspace at seven widths), 14 focused skip-link scans, 8 open navigation scans (public/workspace at four mobile widths). Open/closed whole-page violations attached in Playwright report; skip-link results asserted directly.
- Found and escalated concrete source defect: body overflow shorthand erased preexisting overflow-x:clip on drawer dismissal, reproducing at all four mobile widths. Preserved exact restoration test; I fixed in ecdd771. The same four regressions now pass, including original inline style equality and scrollY=650 restoration after Escape.
- Test refinements: public initial first-link focus now asserted directly; stable aria-controls locator tolerates deliberate Open/Close accessible name changes; history now uses actual React Router links rather than synthetic history states; fixed-body lock asserts unchanged visual main top/x/width during lock and original scrollY after unlock. Stress changes span text within real icon/label structure. No source assertions removed to accommodate defects.
- Captures wait for actual entrance animation completion. Earlier left-clipped drawer captures were mid-animation capture artifacts, not settled layout defects. Final normal-motion run has no failures/retries or unresolved timing artifacts; reduced-motion cases pass.
- Source review: checked dialog top-layer behavior, explicit initial close focus, Tab wrapping, native background isolation, cancel/backdrop handling, location-key cleanup, desktop matchMedia cleanup, original inline attribute restoration and instant scroll restore. No remaining actionable source defect observed; restoring full original style assumes modal lock ownership of inline body styles as stated by I. No implementation edits by Q.
- Visual review: actually opened settled public mobile panels, workspace drawers at 320/390/440/768, desktop workspace captures at 1024/1440/1920, 440 closed workspace, and 320 short/long-label stress image. Headers/panels remain coherent; icons have consistent gap; stressed labels wrap within drawer and footer remains reachable through independent scrolling.
- Limits: installed desktop Chrome automation, no physical device/manual screen-reader claim; no server/RLS or cloud operations apply to this frontend-only correction. Coordinator independent integration review remains next; no human approval needed for local changes.

### Screenshot evidence

All 54 PNG files below are actual final-run ignored local artifacts under this worktree (not committed binaries). Playwright HTML report lives in playwright-report/index.html; local summary log nav-run.log is ignored. Mobile captures include closed, scrolled-closed and settled scrolled-open states; desktop has closed/scrolled states because mobile controls are intentionally absent.
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-1024/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-1024/workspace.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-1440/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-1440/workspace.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-1920/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-1920/workspace.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-320/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-320/workspace.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-390/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-390/workspace.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-440/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-440/workspace.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-768/landing.png
- test-results/foundation-public-and-work-c1469-cessibility-and-screenshots-chromium-768/workspace.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-1024/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-1024/desktop-scrolled.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-1440/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-1440/desktop-scrolled.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-1920/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-1920/desktop-scrolled.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-320/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-320/scrolled-closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-320/scrolled-open.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-390/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-390/scrolled-closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-390/scrolled-open.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-440/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-440/scrolled-closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-440/scrolled-open.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-768/closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-768/scrolled-closed.png
- test-results/navigation--sticky-header-controls-dismissal-and-screenshots-chromium-768/scrolled-open.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-1024/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-1024/desktop-scrolled.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-1440/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-1440/desktop-scrolled.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-1920/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-1920/desktop-scrolled.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-320/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-320/scrolled-closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-320/scrolled-open.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-390/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-390/scrolled-closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-390/scrolled-open.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-440/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-440/scrolled-closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-440/scrolled-open.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-768/closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-768/scrolled-closed.png
- test-results/navigation--workspace-stic-83537-s-dismissal-and-screenshots-chromium-768/scrolled-open.png
- test-results/navigation-short-drawer-sc-14f19-labels-under-reduced-motion-chromium-320/short-long-labels.png
- test-results/navigation-short-drawer-sc-14f19-labels-under-reduced-motion-chromium-390/short-long-labels.png
- test-results/navigation-short-drawer-sc-14f19-labels-under-reduced-motion-chromium-440/short-long-labels.png
- test-results/navigation-short-drawer-sc-14f19-labels-under-reduced-motion-chromium-768/short-long-labels.png
