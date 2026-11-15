# M1 final scrolling and route refinement

Status: implemented, independently reviewed and verified (final results below). **M1 remains unapproved pending owner review.** No M2, redesign, new dependency, backend, push, main merge, cloud provisioning or deployment.

## Implemented behavior

Public How it works links (desktop/mobile/footer) and hero See how it works now point to **/#method**, the existing implemented method section. The stationary semantic region is named by its heading, has tabindex=-1, and receives focus with preventScroll. Pointer and keyboard actions have the same accessible destination. No unfinished product screen received elaborate motion.

Explicit React Router link state sectionScroll:true opts a same-page action into **native browser smooth scrolling**. The destination uses the current public header's measured height plus the shared16px --section-scroll-gap. Announcement height/current position is deliberately excluded because it scrolls away. No guessed breakpoint offset, global scroll-behavior:smooth, custom frame-loop, dependency or manual-scroll interception was introduced. Native smooth duration depends on browser/distance, not a fabricated fixed timing.

| Navigation | Behavior |
| --- | --- |
| Same-page explicit How it works / See how it works action | Smooth when motion is allowed; instant when reduced |
| Repeated action at the current hash | Still performs explicit section navigation |
| Initial direct /#method | Instant with measured offset and region focus |
| Cross-route link to /#method | Instant arrival with measured offset and region focus |
| New non-hash route | Instant top reset and main focus; existing content entrance plays |
| Browser POP with stored entry | Instant saved-coordinate restoration, never smooth |
| Native/skip hash without section intent | Immediate; no blanket smooth behavior |
| Manual wheel/touch/keyboard scrolling | Browser-controlled; no prevented events |

While an explicit smooth anchor is active, live reduction finishes immediately at the measured destination; active resize remeasures the header. scrollend or manual input clears active intent, preventing later preference/resize events from jumping back to an old target. No active reference survives a location change. Existing history scroll state and route focus remain in the same owner; no second scroll manager competes with them.

## Route motion and preservation

Landing and issuer overview already share the approved finite480ms route-content entrance and easing cubic-bezier(.22,.78,.23,1), including hero/credential and workspace/metric staging. Those consistent entrances are retained and verified on repeated route entry. No duplicated full-page fade, shell translation, exit wait, loading delay or blank-screen wrapper was added. Main receives focus while content is visible and the entrance is still running. Prior scroll reveals, shared controls, navigation fade/drawer, focus, scroll locking, safe cleanup and reduced-motion handling remain intact.

Placeholder and404 pages retain shared interaction feedback only, with no page CSS entrance animations. Their full motion design remains deferred until development of those features.

Changed source: src/app/RouteEffects.tsx/test; src/pages/LandingPage.tsx method target/hero CTA; src/components/layout/Layouts.tsx public link; src/styles/index.css gap token. The implementation source commit is **3188609**. No visual identity values or navigation-drawer lifecycle code changed.

## Review and verification

Coordinator implemented source in the existing integration worktree and obtained independent read-only source/browser review in one Orca child worktree. Q authored browser tests only. No source defect was found by independent review; a test-only placeholder assertion was corrected to distinguish shared transitions from page animations.

Focused route/scroll tests passed14/14; combined unit/component suite passed40/40 across6 files. Source checks typecheck/lint/build passed before independent dispatch. Coordinator initial actual440x956 sample showed normal0 ->1174 ->1600 scroll progression, reduced immediate destination, method top85.1875px beneath measured69px header, and1600 restored after workspace/back.

Q verified all seven configured widths:320/390/440x956/768/1024/1440/1920. Normal/reduced Enter activation, pointer footer repeated hash, current header measurement, announcement scroll-away, section focus, initial direct hash before polling, cross-route hash, POP/forward coordinates, live reduction/resize, manual wheel and interruption, no stale intent, route entrance replay/nonblank content, placeholders, and the original motion/navigation/axe suites are covered. Details and actual historical run counts are retained in M1-SCROLL-Q.md.

Final coordinator results (installed Chrome, integration tests at **9eda3fd**; HEAD 0bd5c26 adds only Q report text, so no rerun was needed):

| Gate | Command | Result |
| --- | --- | --- |
| Full Chrome suite (motion, nav, axe, scroll, reduced motion, history) | npm run test:e2e (PLAYWRIGHT_CHANNEL=chrome) | **167 passed, 15 intentional desktop mobile-only skips, 0 failed** (3.7m) |
| TypeScript | npm run typecheck | pass (re-run at 0bd5c26) |
| ESLint | npm run lint | pass (re-run at 0bd5c26) |
| Unit/component | npx vitest run | **40/40 passed, 6 files** (re-run at 0bd5c26) |
| Production build | npm run build | pass (re-run at 0bd5c26) |
| Whitespace | git diff --check | pass |

The first combined run failed one reduced-motion temporal test because sampling began before React committed the anchor navigation. Q corrected it in a test-only change (84dfd14 -> 9eda3fd), which waits for method focus before the first sample and keeps the immediate-displacement assertions. That failing run is archived under artifacts/m1-scroll-coordinator-initial and is not used as passing evidence. The evidence manifest is docs/quality/evidence/m1-scroll/manifest.json (12 clips, 42 files). Physical-device, Safari and human screen-reader testing remain unrun; no hardware or full-conformance claim follows from Chrome automation. Cross-route hash behavior is supported by the explicit instant source branch plus settled browser geometry; direct hash and POP also have immediate assertions.

## Browser evidence

Coordinator examined actual video-derived anchor and route frame sequences and the scroll timelines, rather than claiming smoothness from a single screenshot. Normal-mode positions progress while the public header stays fixed; reduced mode holds the destination from its first recorded sample. A440 sample in Q's final-scroll capture reads1 ->918 ->1600, with method top85.1875/header69;1440 desktop reads header95/target top111.21875. Region focus is preserved. The16px design gap is measured within browser subpixel rounding, not a hardcoded header size.

The route filmstrip shows workspace -> landing -> workspace -> drawer -> landing -> Verify placeholder ->404. Existing route content remains visible during finite entrance and focus is immediate. Initial new-document loading frames are present in original recordings; the route-after-load montage excludes initial browser loading and is not offered as a frame-by-frame monitor recording.

Committed curated clips, snapshots and measured JSON are indexed in **docs/quality/evidence/m1-scroll/README.md**. Full independent artifacts/traces were copied to **artifacts/m1-scroll-worker/** before worker cleanup. Final coordinator raw browser artifacts remain in test-results, where later runs may replace them. Reproduce with installed Chrome and a free PLAYWRIGHT_PORT:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PLAYWRIGHT_PORT='3108'
npm run test:e2e -- e2e/scroll.spec.ts --workers=2
```

Each new scroll test records video.webm and trace.zip plus scenario-specific sampled frames/JSON. Use npx playwright show-trace with a retained trace path for replay. No unrelated server is killed or reused; strictPort rejects collisions.

## Git and boundary

Integration branch: **feat/full-stack-implementation**. Q branch: jamesmikkorecario-dev/m1-scroll-quality. Original test commits c68f9fc -> a46d60f,75b4165 ->7eb8fc7; report64bf758 ->f3b13ca. Coordinator reviewed actual test changes: public How it works intentionally changes expected URL from /preview/how to /#method and expects semantic-region focus; underlying menu dismissal/history/geometry assertions are retained.

All worker patches are integrated (focus-boundary fix 84dfd14 -> 9eda3fd, report e6639ab -> 0bd5c26), and the isolated worktree was clean at the contribution audit. Cleanup: the Q dispatch was released and its m1-scroll-quality worktree was removed. Its branch and copied artifacts are preserved. This closeout documentation is the final local commit on feat/full-stack-implementation; the commit is not pushed. Primary remains main at197711b with only original untracked artifacts/ and design-references/; active integration and historical init-quality-delivery remain retained. No production or remote action is authorized or performed. Stop for owner M1 approval.
