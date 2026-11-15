# VeriMark handoff: FS-E2E

- Status: ready for independent review; known demo limitation retained as expected failure.
- Owner: dispatched FS-E2E worker; independent reviewer: coordinator (requested on completion).
- Goal: requested browser journeys 1–13 against the fictional demonstration adapter.
- Branch: jamesmikkorecario-dev/fs-e2e-journeys; worktree: C:/Users/James/orca/workspaces/VeriMark/fs-e2e-journeys; base: 29d253c8a3e6ae1dbd8cbca5646481b51f54707a. Delivered SHA sent separately.
- Changed paths: e2e/app-helpers.ts (shared login/issuance/keyboard helpers), e2e/app-journeys.spec.ts (issuance, CSV/download, lifecycle, roles, eligibility, tenant unavailable, delivery), e2e/app-public.spec.ts (verification, axe, reflow, keyboard, reduced motion), this report.
- Inputs: AGENTS, README source matrix, PRD, FULL-STACK-CONTRACT, COMMIT-POLICY, LOCAL-DEVELOPMENT, API types, seed state, existing auth/mobile specs and Playwright configuration. No API, migration, environment, dependency or application changes.
- Coverage: single issuance through detail/public/list/audit; invalid then valid three-row CSV and exported verification URLs; required revoke reason/Escape/focus/privacy; corrected replacement version and public successor; fresh-context delivery honest expected failure; separate signed-out same-tab PDF signature test; rotated/garbage link identical unavailable message; viewer/issuer restrictions; pending issuer approval through same-context account changes; unknown foreign ID non-disclosure; verification form/status/not-found; axe WCAG 2 A/AA and 2.1 AA serious/critical threshold on all requested pages and review step; independent route reflow checks at 390 and 320; mobile navigation keyboard/Escape; keyboard-only sign-in and issuance with primary focus indicators; reduced motion without settling animations before inspection.
- Constraints: fresh default Playwright context per test; no arbitrary waits, no source edits, no backend/cloud operations. Only chromium-390 and chromium-1440 execute; mobile matrix executes only under chromium-390. Random internal ID exercises unavailable state; no seeded cross-tenant credential exists.

## Defects found

| Severity | Route | Steps | Expected | Actual | Suspected file/line |
| --- | --- | --- | --- | --- | --- |
| Medium (demo limitation; blocks requested cross-context delivery journey) | /receive#token | Issuer creates recipient link on cred_demo_valid, then open that link in a fresh browser context | Fragment removed, certificate shown and PDF downloadable without account | Fragment removed, but Access link unavailable: fresh context has no issuer-created token | src/lib/api/demoAdapter.ts:31 (sessionStorage), :655 (exchangeDelivery); src/lib/api/demo/state.ts:140 (seed contains no deliveries) |

The cross-context test uses test.fail with one-line reason and retains the certificate/PDF success assertions. A separate same-tab signed-out test proves the successful PDF bytes begin with %PDF without concealing the context limitation. No other application defect confirmed.

## Verification

PowerShell command for each browser run: `$env:PLAYWRIGHT_PORT='3461'; npx playwright test e2e/app-journeys.spec.ts e2e/app-public.spec.ts --workers=2`.

Exploratory run: 10 failed, 74 passed, 294 skipped; test errors corrected (CSV label strictness, innerText comparison, retained auth redirect, pending flow preparation expectation, duplicate Issue link). Next run: 86 passed, 299 skipped; next: 1 failed, 85 passed, 299 skipped (keyboard test failed to wait for route main focus). Final stability runs recorded below.

| Actual command/check | Result | Evidence |
| --- | --- | --- |
| npm ci (first command) | PASS | 282 packages, zero vulnerabilities |

- Security/privacy/design risks: demonstration is not a server/RLS security boundary; UI negative role checks do not establish database authorization. No real recipient information or secrets added. Generated recipient tokens remain transient in tests.
- Open decisions / next owner: coordinator should independently review these specs and decide whether demo cross-context sharing is intentionally unsupported or should be addressed in adapter architecture.
- Independent review: requested from coordinator; not performed by this worker.
- Human approvals: no push, merge or deployment performed or requested.


## Final stability evidence

| Actual command/check | Result | Evidence |
| --- | --- | --- |
| Browser stability run 1: command above | PASS | 86 passed, 299 skipped, 0 unexpected failures, 1.9m; TEMP/fs-e2e-final1.txt |
| Browser stability run 2: command above | PASS | 86 passed, 299 skipped, 0 unexpected failures, 1.9m; TEMP/fs-e2e-final2.txt |

| Browser stability run 3: command above | PASS | 86 passed, 299 skipped, 0 unexpected failures, 1.9m; TEMP/fs-e2e-final3.txt |
| npm run typecheck (after all three runs) | PASS | tsc --noEmit, exit 0 |
| npm run lint (after all three runs) | PASS | eslint ., exit 0 |

Each final browser run collected 385 cases: 299 intentionally skipped by project restrictions, 84 ordinary successes and two expected-failure successes (one per target project for fresh-context demo delivery), reported by Playwright as 86 passed. All three runs used the final behavior assertions; no application changes were made between runs. Artifacts are local Playwright output and temporary command logs; no screenshots or recipient tokens committed. Tests of actual database/RLS authorization and the whole suite were outside this assignment and were not run.
