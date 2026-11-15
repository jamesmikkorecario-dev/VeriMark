# M1-SCROLL-Q independent verification

- Task: task_eb5b0f8ed832 / M1-SCROLL-Q; independent source/browser reviewer, coordinator owns implementation and final integration review.
- Goal: verify explicit anchor smooth intent, instant reduced/route/hash/history behavior, measured sticky geometry, focus, interruption, and preserved route entrances without expanding M1.
- Worktree: C:/Users/James/orca/workspaces/VeriMark/m1-scroll-quality; branch jamesmikkorecario-dev/m1-scroll-quality; source base 318860923c98041523d2a5b3821594dd3d93c9d6.
- Tests: c68f9fc (six browser regressions plus intentional public link expectation adaptation), 75b416517e499b1560cdd5fbb3db2d65db2dcedb (immediate direct-hash offset assertion and whitespace cleanup).
- Paths: e2e/scroll.spec.ts, e2e/navigation.spec.ts, this handoff; ignored local artifacts/m1-scroll. No source/config/dependency changes. npm ci installed the existing lockfile; zero audit vulnerabilities reported.
- Inputs: AGENTS, README source matrix, PRD, PROJECT_DETAILS, M1 and M1-SCROLL contracts, HANDOFF-TEMPLATE, RouteEffects, LandingPage, Layouts, existing navigation/motion/foundation tests and CSS.

## Evidence

All browser checks use installed Chrome, workers=2, widths 320/390/440/768/1024/1440/1920 (440 height956, others900). PLAYWRIGHT_PORT selected free local 3017/3018/3019; no existing server reused or unrelated process terminated.

| Command | Actual result |
| --- | --- |
| npm ci | PASS: 235 packages; audited236; zero vulnerabilities |
| npm run typecheck | PASS |
| npm run lint | PASS, including final tests |
| npm test -- --run | PASS: 6 files, 40 tests |
| npm run build | PASS: 35 modules |
| npm run test:e2e -- --workers=2 --output=artifacts/m1-scroll/full | PASS:153 passed,15 existing desktop skips,5.0m; original140-case suite125 passed/15 skipped plus28 new cases loaded at launch |
| npm run test:e2e -- e2e/scroll.spec.ts --workers=2 --output=artifacts/m1-scroll/final-scroll | PASS:42 tests, 2.4m; all six new tests across7 widths (final-scroll run loaded c68f9fc tests before75b4165 strengthening, followed by7/7 strengthened direct-hash cases) |
| npm run test:e2e -- e2e/scroll.spec.ts --grep 'direct and cross-route' --workers=2 --output=artifacts/m1-scroll/instant-final | PASS:7 tests on75b4165, immediate initial hash geometry asserted before settlement |

Initial bare gates failed because this isolated worktree had no node_modules; installed via authorized npm ci and repeated successfully. Exploratory additional run:11 passed/3 failed because placeholder assertion incorrectly counted shared CSS transitions; corrected to exclude CSSTransition while requiring no CSSAnimation, preserving shared feedback per contract. Final results supersede that test-only defect; no source fix requested.

## Coverage and actual render inspection

- Normal/reduced keyboard Enter activation; semantic method region focus with preventScroll; stationary region transform; measured actual header+16px alignment within2px; announcement scroll-away; pointer footer repeated current-hash activation.
- Direct hash initial offset before polling and100ms stability; cross-route footer destination, saved700px POP and forward0px, mobile menu closure/history and focus preserved in existing navigation tests.
- Active reduction/resize completion, native wheel displacement and no stale jump on subsequent reduction/resize; separate wheel interruption during active smooth movement.
- Two workspace/landing route entries replay finite480ms animations, focus main while entrance runs, immediate top, visible opacity; placeholders/404 no CSS entrance animations. Full existing stagger/reduced/reveal/axe/menu geometry checks unchanged.
- At440 in full/scroll-anchor-temporal-no--e96b8--keyboard-and-repeated-hash-chromium-440/scroll-timeline.json: normal y1 ->1064 ->1600; final top85.1875/header69 (16.1875px gap), method focused throughout. Reduced counterpart y1600 at every sample. At1440 normal y0 ->670 ->1102, header95/top111.21875 (16.21875px gap). At320 normal y0 ->421 ->1765; reduced fixed1765; header69/top84.984375.
- Inspected anchor-middle.png at320 and actual video-derived anchor-filmstrip.png at390: readable content moves under fixed header, then outlined method region aligns; footer movement in last frames is intentional Playwright scroll-into-view for repeated footer link activation.
- Inspected video-derived route-after-load-filmstrip.png at440: workspace -> landing -> workspace -> drawer -> landing -> Verify placeholder ->404; content visible during entrance, no blank route transition. Initial browser navigation loading frames excluded from route-after-load filmstrip, retained in original videos.
- Workspace440 entry-replay.json opacities0.661386/0.549706, both running480ms. Source routeIn starts at opacity0.5, so content does not wait invisible for animation completion.
- Video/trace/screenshots/timelines: artifacts/m1-scroll/full/{motion-*,scroll-*}/; final-scroll/scroll-*/; instant-final/scroll-*/. Every new test keeps video.webm and trace.zip; temporal tests also save start/middle/end PNG and JSON. Local filmstrips: artifacts/m1-scroll/anchor-filmstrip.png and route-after-load-filmstrip.png (ffmpeg logs adjacent). Artifacts are ignored/local, not committed.

Unique final coverage:182 configured cases = original140 plus42 new;167 pass/15 existing skips across the full and final-scroll runs, with direct-hash strengthening independently7/7 on final test SHA. All commands exited0 for final verification.

## Review findings and limits

No concrete implementation defect found in read-only RouteEffects/LandingPage/Layouts/CSS review or completed browser scenarios. No source edit, backend/API/schema/env effect, cloud action or real recipient data. RLS/server negative authorization is not applicable to this frontend-only change; no backend security claim. Browser coverage is Chrome only, without hardware touch/assistive technology claims; temporal screenshot sampling is not a frame-by-frame monitor recording. Cross-route hash samples assert settled offset; immediate path is additionally supported by source review (instant branch), whereas direct initial hash and POP are asserted before polling. Tests use header measurement rather than breakpoint constants, preserving geometry tolerances. All original140 cases retained;15 desktop-only skips are existing mobile cases.

Coordinator: please independently review test commits and this evidence, then integrate if accepted. Owner visual approval of M1 remains outstanding; no M2 or release authorization inferred.

