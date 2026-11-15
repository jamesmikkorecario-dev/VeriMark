# M1-NAV targeted correction

Authority: owner mobile-navigation correction request, 2026-11-15. M1 only, no backend/M2/redesign/dependency/provisioning/push/main merge/deployment. Primary checkout remains main permanently. Base is db40d0f plus this contract commit on feat/full-stack-implementation.

## Reproduction and acceptance

At 440x956 on original M1, after scrollY=650 public header top=-619.61 while menu top=100; workspace header top=-650 while dropdown top=75. Both body overflow values remain visible. CSS lacks sticky headers and overrides anchored dropdown with viewport-fixed offsets below 580px. Shared disclosure applies public layout to issuer; .disclosure-links a display:block overrides .side-nav a flex, removing icon/label gap. State lacks route/desktop transition dismissal. Before screenshots live in integration artifacts/m1-navigation-before.

Public: announcement scrolls naturally, public header sticky top:0 with opaque canvas and coherent stacking. Icon-only trigger named Open navigation / Close navigation; aria-expanded and aria-controls=public-navigation with valid controlled element. Anchored header-relative panel or cohesive overlay without guessed header/banner offsets; sensible focus, Escape/restoration, destination/route/backdrop/desktop dismissal. Scroll behavior intentional; no detached panel or page/layout jumps.

Issuer: mobile sticky compact brand plus icon-only Open workspace navigation trigger (aria-controls=workspace-navigation). Detailed org/demo info belongs in drawer. Keep desktop header/sidebar visual behavior unchanged. Slide-in modal drawer named Workspace navigation with brand, organization, all existing routes, public website, active state, aligned icons, obvious Close workspace navigation control. Prefer platform dialog/top-layer where practical; otherwise correctly trap focus/inert background. Backdrop dismissal, body-scroll lock preserving scroll position and inline styles, independent overflow with dvh/safe-area, resize/route/history cleanup, reduced motion. No ARIA menu roles.

## Ownership

- Implementation I: src/components/layout/** (including meaningful component tests), src/pages/pages.css (remove obsolete disclosure rules rather than stacking brittle overrides), optional navigation-only src/components/layout/navigation.css; own docs/ai/handoffs/M1-NAV-I.md. No tooling/e2e changes.
- Quality Q: e2e/** and playwright.config.ts only; own docs/ai/handoffs/M1-NAV-Q.md. Add required 440x956 project; maintain previous widths and add required missing width(s) only. No implementation changes. Inspect independently and report concrete issues rather than weaken assertions.
- Coordinator: contracts/docs, integration, final checks and committed evidence; independent final read-only review if useful after integration. Shared source ownership means public and issuer fixes stay with I, avoiding parallel edits to shared files.

Both workers use Orca-created isolated worktrees, same committed baseline, no helpers. Local commits authorized; report exact SHA/checks/limits through worker_done. Q may initially create tests against agreed accessible contract then use supplied I commits in own worktree for meaningful verification. Integrate I then Q sequentially. Corrections return to source owner.

## Verification

Run npm ci as necessary, npm run typecheck, npm run lint, npm test -- --run, npm run build, and $env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e -- --workers=4. Bundled shell spawn UNKNOWN is known; installed Chrome works. Existing preview integration http://127.0.0.1:3001 may be used read-only; browser tests own port 3000 with reuseExistingServer=false. Never stop unrelated processes.

Q assertions cover sticky top after banner scroll; icon-only accessible names/controls; open/close/Escape/focus restoration; first focus and modal containment/background blocking; destination/route/POP/back-forward dismissal; backdrop; scroll lock and preserved position/no layout shift; independent drawer scroll; desktop resize dismissal/unlock; reduced motion; long org/label wrapping. Actual screenshots open/closed/scrolled for public and workspace at 320,390,440x956,768,1024 plus previous desktop regression widths, axe open/closed. Distinguish mobile behavior at desktop breakpoints. Add tests that catch original bugs, and adapt previous nonmodal assumptions to the intentional drawer design. No fabricated browser/screen-reader/physical-device evidence. Coordinator examines actual renders.
