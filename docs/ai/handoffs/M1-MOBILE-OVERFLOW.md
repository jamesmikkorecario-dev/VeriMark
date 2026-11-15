# VeriMark handoff: M1 mobile horizontal overflow and sticky header (task_246278037903)

- Status: ready for review. **No application defect confirmed; no CSS/source change made.** Regression guards added.
- Owner / independent reviewer: Orca worker (Claude) / OMP coordinator.
- Goal: investigate the reported Chrome Device Mode (iPhone 16 Pro Max 440x956, 50% preview zoom) sideways panning and header drift on public routes, fix only confirmed app defects, and add guards.
- Branch / worktree / base SHA: jamesmikkorecario-dev/m1-mobile-fix / m1-mobile-fix / ed673cf. Delivered SHA is reported separately in worker_done.
- Changed paths: `e2e/mobile-layout.spec.ts` (new regression guards); this handoff. Local evidence (gitignored, same convention as M1-MOTION-Q): `artifacts/mobile-overflow-sticky/` with `probes/`, `measurements/`, `screenshots/`.
- API/migration/env effects: none.

## Diagnosis

### A. Horizontal overflow: not a document defect

Measured in Playwright Chromium with mobile emulation (`isMobile`, `hasTouch`) at widths 320/375/390/440 × DSF 1/2/2.625/3, on `/`, `/preview/verify`, `/preview/about` and a 404 route (64 combinations). Also tested DevTools-style `Emulation.setDeviceMetricsOverride { scale: 0.5 }` (the 50% preview zoom), with menu open, primary-button hover, each `[data-reveal]` mid-reveal, and raw CDP touch drags in headless Chromium and installed Chrome.

| Measurement (every combination) | Value |
| --- | --- |
| innerWidth = documentElement.clientWidth = documentElement.scrollWidth = body.scrollWidth | equal to the viewport width (e.g. 440/440/440/440) |
| scrollX after load, after `scrollTo(500, …)`, after left/right touch drags | 0 |
| visualViewport width / offsetLeft / offsetTop / scale | viewport width / 0 / 0 / 1 |
| Elements with `getBoundingClientRect()` outside `[0, clientWidth]` | 0 |

Checked and ruled out: containers (`calc(100% - 34px)` and similar, no `100vw` on layout), the header, the credential preview (`.paper-bottom` negative margins stay inside the padded card), the mobile nav panel (`min(300px, 100vw - 34px)`, right-anchored), entrance and reveal transforms (vertical only), and the button hover `translateY`.

Likely cause of what was seen: with touch emulation, a **rightward horizontal swipe triggers Chrome's overscroll history-navigation gesture**. The page slides sideways and goes back; in measurement 05 the page navigated to `about:blank` from every width. That is browser behavior, not page overflow. Two DevTools effects can add to it. At 50% preview zoom one screen pixel is two CSS pixels, so drag deltas double (measurements 04/05: the same drags scrolled about 2× as far). Shift-drag pinch zoom also pans the visual viewport. **Classification: Chrome emulation/browser gesture artifact.** No `overflow-x: hidden` was added, because there is no overflow to hide.

### B. Sticky header: expected normal-flow-to-sticky transition, then stable

`.public-header` has `position: sticky; top: 0`. It has no transform or transition, and its ancestors (div#root, body, html) all have `overflow: visible`, `transform: none` and `contain: none`. The green `.demo-ribbon` (30.390625px tall at every tested width) sits above it and is intentionally not sticky.

| scrollY | 0 | 10 | 20 | 30 | 32+ |
| --- | --- | --- | --- | --- | --- |
| header top (px) | 30.391 | 20.391 | 10.391 | 0.391 | 0 |

For the first ~30.4px of scroll the header rides up with the ribbon, then it pins at 0. Per-frame rAF sampling during touch-drag flings found the top **exactly 0 in every stuck frame**: 300–340 frames per run, 1× and 0.5× scale, all four widths, both headless Chromium and installed Chrome. Wheel down/up and smooth scroll down/up gave the same result. Return to top restores 30.391. **Classification: expected normal-flow-to-sticky transition.** No sticky defect was found. The fractional 30.39px ribbon height can render with sub-pixel snapping in a 50%-scaled DevTools screencast, which would be an emulation rendering effect only.

### Reproduction steps (Chrome Device Mode)

1. `npm run dev`, open `/`, then DevTools → Device Mode → iPhone 16 Pro Max (440x956) at 50% zoom.
2. Drag horizontally with the emulated touch cursor. The page slides with a back arrow (history gesture) or does not move. In the Console, `[scrollX, document.documentElement.scrollWidth, document.documentElement.clientWidth]` stays `[0, 440, 440]`.
3. Scroll down slowly. The header moves up about 30px with the green banner, then stays put: `document.querySelector('.public-header').getBoundingClientRect().top` reads `0` from then on.

## Regression tests

`e2e/mobile-layout.spec.ts` (20 tests) uses its own mobile matrix: 320x568@2, 375x812@2.625, 390x844@3, 440x956@3, with `isMobile`/`hasTouch`. It runs once, under the `chromium-440` project, and is skipped in the other width projects.
- 16 overflow tests (4 widths × `/`, `/preview/verify`, `/preview/about`, 404): `scrollWidth <= clientWidth`, `body.scrollWidth <= clientWidth`, `scrollX == 0`, no out-of-viewport boxes, and a programmatic sideways scroll stays at 0. Each is checked on load, at every 0.6-viewport step down the page (so reveals run), and with the mobile menu open.
- 4 sticky tests: header top equals `max(0, ribbon - scrollY)` within 0.5px. The test samples a 2px-step transition, 30 wheel-downs, 20 wheel-ups, per-frame smooth scroll down and up, and the return to top. The ribbon stays non-sticky. Each test writes `header-trace-<width>.json`.
- No defect was found, so there was nothing to show failing before a fix. Instead, the guards were checked by temporarily injecting `.hero-right{margin-right:-24px}` and `.public-header{top:2px}`. All 20 failed with offender lists (e.g. `scrollWidth 382 > 375`; `transition at scrollY 30: top 2`). The injected CSS was then reverted (`git checkout`).

## Results

| Actual command/check | Result | Evidence/environment |
| --- | --- | --- |
| `npm ci` | PASS | 0 vulnerabilities |
| `npm run typecheck` | PASS | exit 0 |
| `npm run lint` | PASS | exit 0 on tracked files. `eslint .` also lints gitignored `artifacts/**/*.cjs`: with the probe scripts present it reported 57 `no-undef` errors, all in the four probes. They are archived as `.cjs.txt` in the M1 worktree for that reason |
| `npm run test -- --run` | PASS | 6 files, 40/40 |
| `npm run build` | PASS | tsc + vite build, exit 0 |
| `PLAYWRIGHT_PORT=3431 npx playwright test e2e/mobile-layout.spec.ts --project=chromium-440` | PASS | 20/20, bundled Chromium headless shell |
| Guard mutation check (injected overflow and sticky offset) | FAIL as intended | 20/20 failed; reverted |
| `PLAYWRIGHT_PORT=3431 npm run test:e2e` (full suite, default 8 workers), run 1 | FAIL (flaky) | 185 passed, 2 failed, 135 skipped. Failures: motion.spec.ts:33 `/` and `/workspace` temporal entrance at 768 |
| Same, run 2 | FAIL (flaky) | 184 passed, 3 failed, 135 skipped. Different motion.spec temporal tests (440/768/1920) |
| Pre-existing specs only (foundation/motion/navigation/scroll), default workers | FAIL (flaky) | 161 passed, 6 failed, 15 skipped. Only temporal motion/scroll tests fail, so this flakiness exists without the new spec |
| `npx playwright test e2e/motion.spec.ts --project=chromium-768` | PASS | 7/7 when run alone |
| `PLAYWRIGHT_PORT=3431 npm run test:e2e -- --workers=2` | PASS | 187 passed, 0 failed, 135 skipped (4.6m); the new spec 20/20 in every run |

Environment: Windows 11, Playwright 1.65.1. Bundled full Chromium (`channel: 'chromium'`) is blocked by Windows Application Control. `Input.synthesizeScrollGesture`/`synthesizePinchGesture` do nothing in headless mode (measurement 03), so raw `Input.dispatchTouchEvent` drags were used. No real iPhone, Safari or headed DevTools-UI session was tested.

- Pre-existing risk: the temporal assertions in motion.spec.ts and scroll.spec.ts are timing-sensitive. At default parallelism on this machine they fail intermittently. This is unrelated to this task, which changed no source and no existing test.
- Security/privacy/design risks: none. No source, token or layout change; design, motion, anchor scrolling, menu, reduced-motion and focus behavior are unchanged.
- Open decisions / next owner: if the owner wants to suppress Chrome's horizontal swipe-back gesture, `overscroll-behavior-x: none` on `html` would do it. It changes browser navigation UX and does not affect iOS Safari edge swipe, so it needs an explicit owner decision. Not applied.
- Independent review status: reviewed by the OMP coordinator on e294e81. Diff read (new spec + this handoff only, no source change); `npm run typecheck` exit 0; `mobile-layout.spec.ts` 20/20 on `chromium-440`; measurements 01 and 05 spot-checked against the tables above. Unit tests, build, the full e2e suite and the guard mutation check were not rerun by the coordinator. Fast-forwarded into `feat/full-stack-implementation`.
- Human approvals still needed: owner review of the diagnosis; M1 remains unapproved pending owner review.
