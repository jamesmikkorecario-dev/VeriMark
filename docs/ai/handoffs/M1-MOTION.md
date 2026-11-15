# M1 motion audit and refinement

Status: implemented, locally integrated and verified; **M1 remains unapproved pending owner review**. No M2, push, main merge, deployment, provisioning or backend changes. This report supersedes earlier M1 motion implementation claims.

## 1. Audit findings

Baseline 6fab432 source and actual installed Chrome playback were inspected, rather than inferring motion from screenshots alone. The shared CSS defined routeIn (480ms, opacity .5 to 1, translateY 8px to rest), but no React element applied .route-enter. Initial landing/workspace produced no document animations, no route-enter instances and no reveal markers. Independent temporal tests reproduced six expected failures. The baseline browser reported prefers-reduced-motion:false; absence of page motion was a wiring/implementation gap, not reduced-mode suppression in that session.

Previously implemented: button hover/press and icon transitions; visible focus rings; the corrected workspace drawer's 220ms entrance; global reduced-motion timing suppression. Missing: coordinated hero/credential entrance, dashboard/metric entrances, promotional scroll reveals, public panel transition and consistent row/link feedback. Existing short hover effects could be easy to miss; desktop hover does not demonstrate page-entry or scroll behavior. The unused entrance definition could neither trigger once nor replay on refresh/routes.

Browser/OS accessibility settings can influence the media query, and browser emulation can override it. We recorded the actual Chrome query result and explicitly tested reduce/no-preference, including live changes. We did not inspect or change the owner's OS settings and cannot infer the setting in a different browser session.

## 2. Changes and triggering behavior

- Landing: five coordinated hero children, separate credential-preview entrance, once-per-mount promotional method/feature/audience reveals. Closing CTA stays stationary to protect pointer targeting and restored scroll positions.
- Workspace: heading, metrics and dashboard content stage in on mount. Stable React identity prevents filtering from replaying the whole page. Record rows use restrained background feedback and action arrows move subtly.
- Shared: reusable duration tokens, existing Editorial Systems easing, consistent button/link feedback and immediate focus visibility. No animation dependency or backend library added.
- Navigation: public panel gains a fade-only entrance, preserving anchored geometry. Existing drawer slide uses the same action token. Close/Escape/route/resize dismissal remains synchronous so focus/background/scroll cleanup never waits for decoration.
- Progressive reveals: PromotionalReveals observes promotional targets, completes/unobserves each once, cleans up on unmount/StrictMode, and deliberately rearms on route remount. Pending content remains fully opaque/readable; it only has a 16px visual offset. No observer or initial reduced preference completes content without arming. Live reduction completes pending targets and they do not replay when reduction is disabled in that mount.

Entrances run on initial loading, refresh and route remount. They are finite, not continuous. Hover/press requires an actual pointer interaction; focus feedback is immediate. No root, sticky-header or dialog ancestor is translated. Essential copy and actions remain available, with no artificial interaction delay.

Modified source: src/pages/LandingPage.tsx, DashboardPage.tsx, pages.css; src/styles/index.css; src/components/layout/navigation.css; new src/components/motion/PromotionalReveals.tsx and tests. Existing navigation state/focus/scroll code and route lifecycle remain unchanged. E2E adds motion.spec.ts, motion-helpers.ts, capture-motion.ps1, legitimate finite-settle points before settled axe/layout assertions, and a strict configurable test port.

## 3. Timing and easing

All motion follows the approved reference's cubic-bezier(.22,.78,.23,1), using CSS opacity/transform and restrained color feedback.

| Motion | Duration | Stage delay / travel |
| --- | --- | --- |
| Hero text/CTA children | --motion-enter: 480ms | 0/40/80/120/160ms; 8px, opacity .5 to 1 |
| Credential preview | 480ms | 100ms; 8px, opacity .5 to 1 |
| Dashboard heading | 480ms | 0ms |
| Three metrics | 480ms | 60/110/160ms |
| Dashboard content | 480ms | 180ms |
| Promotional reveals | --motion-reveal: 650ms | 16px to rest, full opacity throughout |
| Buttons, row/navigation color, public panel/drawer entrance | --motion-action: 220ms | No interaction gating |
| Link/action icon feedback | --motion-icon: 250ms | 2px hover displacement; removed in reduced mode |

Two defects were found during review and fixed: reduced timing suppression alone left instant button/icon hover displacement; targeted reduced transform rules now remove it without altering decorative brand geometry. Separately, shared animation shorthand reset equally specific stage delay declarations; composed selectors now preserve actual credential 100ms and content 180ms delays, confirmed in Chrome CSS and active Web Animations timing. Metrics retained their ordered delays.

## 4. Actual browser evidence and temporal review

Final replayable evidence is committed under **docs/quality/evidence/m1-motion/**: 14 short WebM clips, sampled running/middle/settled PNGs, timeline/menu/reveal/coordination JSON, original baseline audit and a hash manifest. README.md indexes clips and reproduction commands. Each video records a real browser case; snapshots supplement the continuous clips and measured progression rather than replacing them.

Representative clips: landing-desktop.webm, landing-mobile.webm, workspace-mobile.webm, reveals-mobile.webm, interactions-desktop.webm, reduced-mobile.webm. Additional credential-stages and dashboard-stages clips/JSON verify coordination. The capture suite covers initial load, refresh, scroll reveals, real route reentry, filtering without entrance replay, menu opening and immediate closing/focus restoration, hover/press, and reduced mode with/without IntersectionObserver.

Coordinator examined actual temporal frame sequences on desktop hero/credential and mobile hero/dashboard, plus running/settled promotional reveal samples, alongside active timing JSON and browser records. Early opacity/translation changes settle to full opacity/transform:none; headers remain stationary. Q independently inspected the same temporal behaviors and source, reporting no unresolved defect after corrections. This does not claim physical-device playback or human screen-reader testing.

Example observed mobile temporal sample from the preserved pre-stage-adjustment run: opacity .611829 and translateY6.21074px at 29.943ms active time; .969807 and .483086px at 243.543ms; final opacity1/transform:none. Those samples prove actual playback, but only the refreshed stage-corrected-final recordings are cited for intended stage delays. Corrected coordination JSON reports one shared active clock with delays 0/60/110/160/180ms, duration480ms for each stage. Reveal JSON shows an intermediate translation then none, with no repeated-scroll replay. Measured initial layout-shift totals must be below .01 in the tests; overflow assertions pass.

All worker artifacts, including baseline, failed pre-correction and pre-stage recordings and traces, were copied before cleanup to **artifacts/m1-motion-worker/** in the integration worktree. The final replayable Playwright traces are in its stage-corrected-final case directories. These larger trace archives are local/ignored; the reviewed video/frame/JSON evidence is committed. Use npx playwright show-trace with a trace.zip path for interactive replay.

## 5. Reduced motion and accessibility

Tested initial reduce, live enabling while hovered/animating, disabling plus refresh, and observer-unavailable fallback. Reduced mode removes animations, staggered playback, transitions and interaction translation; content remains opaque and available. Decorative brand skew stays intact. Pending reveals complete on live reduction and do not strand or replay copy in that mount. Focus outlines stay immediate, and navigation dismissal does not wait for motion.

During implementation, low-opacity pending reveals caused below-fold axe contrast failures and a moving closing CTA interfered with targeting; those experiments were corrected, not waived. Final pending copy is full-opacity and the closing CTA is stationary. Settled accessibility checks await actual finite motion completion rather than fixed arbitrary delays; temporal tests separately assert motion runs and changes before settlement. Existing focus, backdrop, scroll lock/style restoration, browser history and breakpoint assertions were retained without weaker tolerances.

Final suite includes **36 axe scans with zero violations**: 14 settled closed-page, 14 focused skip-link and 8 settled open-navigation scans. These results and keyboard automation do not certify complete WCAG conformance. Physical devices/iOS Safari, human screen readers and the owner's OS configuration remain unrun/uninspected.

## 6. Final verification

Coordinator-tested integration commit: **1b0ea68**, final source correction **44a6838**. Subsequent commit is documentation/evidence only. Windows, Node24.19.0, npm11.17.0, installed Chrome. Bundled headless-shell spawn UNKNOWN remains a known environment limitation; passing evidence uses channel chrome.

| Actual command/check | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test -- --run | PASS: 6 files, 34 tests, 1.96 seconds |
| npm run build | PASS: 35 modules; CSS27.06kB; JS285.10kB / 89.57kB gzip |
| $env:PLAYWRIGHT_CHANNEL='chrome'; $env:PLAYWRIGHT_PORT='3108'; npm run test:e2e -- --workers=2 | PASS: 125 passed, 15 intentionally skipped, 0 failed, 2.2 minutes |
| Independent refreshed capture: powershell -File e2e/capture-motion.ps1 -EvidenceName stage-corrected-final -Port 3107 | PASS: 14/14, 34.7 seconds |
| git diff --check / staged whitespace | PASS |

Full suite: 140 cases at320/390/440x956/768/1024/1440/1920. Fifteen skips are unchanged mobile-only tests at desktop1024/1440/1920; desktop navigation/foundation checks still run. New motion cases test actual progression/settlement, refresh, route replay, no filter replay, once-only reveals, observer fallback, hover/press/row feedback, media changes and actual stage delays. The recent sticky public header/modal issuer drawer regressions remain passing.

Initial/intermediate failures are recorded in worker handoffs and archived artifacts, not counted as final passing checks. No live backend/RLS/security tests apply to this frontend-only change; no production-readiness claim.

## 7. Git, workers and cleanup

Integration branch remains **feat/full-stack-implementation**. Native Orca workers used disjoint source/test ownership, local commits and sequential integration; no helpers, remote operations or main checkout changes. Full details: M1-MOTION-I.md and M1-MOTION-Q.md.

| Worker / former isolated branch and worktree | Original commits -> integrated commits |
| --- | --- |
| I: jamesmikkorecario-dev/m1-motion-implementation; m1-motion-implementation | ae7f816 -> 62bcfba; 08df45a -> 133f779; 0d7464b -> dad5da2; 7c30374 -> 44a6838 |
| Q: jamesmikkorecario-dev/m1-motion-quality; m1-motion-quality | 2a266f8 -> d94b7f3; 9a9336f -> 8a17132; a4dab6c -> 40522fb; b0cffac -> d62e819; 5f90e81 -> 1b0ea68 |

Coordinator reviewed source/test diffs and temporal evidence. Q independently found the reduced hover defect; coordinator found the stage cascade defect. Both were returned to source owner, corrected and retested. All implementation patches are preserved. Q's duplicate source cherry-pick 0439c9b has a different patch ID due to resolving its absent handoff as a file addition; direct final tracked-tree comparison against integration is empty, proving no unique contribution was omitted.

After combined verification, both worktrees were clean. Worker artifacts were archived locally and curated evidence preserved. Exact owned terminals were released through Orca (closed_agent_terminal/transcript captured), then both corrective worktrees were removed through Orca without force or branch deletion. Branches remain preserved. Remaining worktrees: primary main at197711b; active integration; historical init-quality-delivery conservatively retained. Primary retains only its original untracked artifacts/ and design-references/.

## 8. Owner review boundary

No unresolved actionable defect remains in the tested motion scope. No physical-device/Safari/screen-reader or production claim. The public panel and drawer intentionally close immediately to preserve accessibility/scroll lifecycle behavior; entrances and interaction feedback animate. M1 remains **unapproved** until owner visual review. No M2 begins automatically.

Preview: http://127.0.0.1:3001/ and /workspace. Refresh with reduced motion off to see entrances; scroll reveals run once per mount. Normal npm run dev prefers port3000; tests may use PLAYWRIGHT_PORT to avoid occupied ports without killing/reusing unrelated processes.
