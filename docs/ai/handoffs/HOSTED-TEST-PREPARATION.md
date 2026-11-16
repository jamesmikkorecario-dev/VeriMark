# HOSTED-TEST-PREP — approval-gated automation

> Historical preparation checkpoint. Superseded target policy: the development database `otovaqtmodpqelwbrglj` is protected and must never receive hosted test migrations/accounts/data. Current local safety changes, test isolation and migration gates are recorded in `docs/database/DISPOSABLE-HOSTED-TEST-PLAN.md`. Earlier test results below remain historical evidence; invalid hosted configuration now fails rather than skips.

## Goal and ownership

Resume interrupted autonomous hosted testing preparation on `dev/full-stack-integration`, preserving all prior changes and the real administrator. Integration worktree only; primary `main`, historical branches/worktrees and hosted data unchanged. Acceptance: local API/browser harness rehearsal, explicit identity/write guards, independent native Orca review, reproducible commands/data projections, then stop for approval.

## Preserved checkpoint

Integration HEAD remains `742e03f` (no new commit in this resumed task). Initial inspection found 28 tracked modifications and six untracked entries, including pending hosted fixtures, browser suite, fragment fix and invitation migration. Existing changes were retained; no reset, cleanup, branch switch or destructive operation. Backup reference from interrupted preparation: `refs/backup/pre-hosted-e2e-20261116`. Existing released workers remained historical. New review workers were read-only in the primary Orca workspace but explicitly reviewed absolute integration paths; no checkout was edited by them.

## Prepared changes

- `supabase/hosted/fixtures.ts`: shared six fictional personas; explicit project/consent/publishable-key guard; exact confirmed account UUIDs and prefixed email identities; pinned test organization reuse; exact roles and member allowlist before writes; independent partial-bootstrap pinning; exact fixture-template content and seed fields.
- `supabase/hosted/hosted.test.ts`: real Auth/PostgREST authorization and shared rule scenario; errors cannot masquerade as empty RLS results; contradictory UPDATE/DELETE filters cannot match data; admin INSERT probe targets an already-existing fictional admin row.
- `e2e-live/`, `playwright.live.config.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `eslint.config.js`: separate hosted browser journey/quality suite with local-only demo rehearsal, one worker/no retries, memory-only session states and hosted secret-safe reporter. Hosted failure screenshots/video/traces disabled; runner output discarded; only static file/line/status summary retained.
- `src/app/RemountOnFragment.tsx`, test and `App.tsx`: fixes second native fragment link in the same tab leaving a new invitation/delivery secret unread and visible. Regression and browser delivery rehearsal pass.
- `supabase/migrations/20261116010000_invite_existing_member.sql`, organization/parity/scenario tests: SQL rejects already-member invitations, matching the current demo/UI contract. **Local-only correction, not approved/applied remotely.** Original migration unchanged.
- Hosted README, `e2e-live/README.md`, schema status and this handoff: approval prerequisites, counts, execution and limits. Unrelated interrupted changes remain preserved.

## Independent native Orca reviews

Run `run_693a93931d57`:
- Safety `ctx_84a3f0086d6a` and follow-ups `ctx_c0427f247355`, `ctx_4660acaf5d07`: identified broad mutation probes, name-only fixture scope, sensitive artifacts and bootstrap recovery issue; fixes reviewed, no remaining blocker in scoped final inspection.
- Coverage `ctx_fa39a222bc81`, follow-up `ctx_b1f74af34404`: confirmed corrected queries/mutation probes and independently projected 13 first-run credentials, 12 per combined repeat. All workers reported successful read-only completion; guide says completed workers close automatically. No worker created a branch/worktree or ran hosted calls/tests.

## Verification actually run

- `npm run test:live` (demo default): **22 passed, 12 intentional skips**, 1.6 minutes. Desktop creating journeys, 390px quality/navigation and 320px overflow/review.
- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm run test:db`: **161 passed**, eight files at full gate.
- `npm test -- --run`: **220 passed**, twenty files.
- After final fixture recovery correction: focused `npx vitest run --config vitest.db.config.ts supabase/tests/hosted-safety.test.ts`: **10 passed**; typecheck/lint passed again. Full DB gate was not repeated.
- `VM_HOSTED_TESTS='' npm run test:hosted`: one local configuration assertion passed; **four hosted tests skipped**.
- `LIVE_TARGET=hosted VM_HOSTED_TESTS='' npm run test:live`: expected exit 1 before any tests; secret-free summary contains failed status with zero tests. No configured hosted fixture run occurred.

Non-blocking local warnings: Node ignores NO_COLOR when FORCE_COLOR is set; Vitest suggests worker startup optimization. No changes made for these diagnostics.

## Approval gate / remaining risks

Complete plan: `e2e-live/README.md`, including exact private configuration and PowerShell commands. Needs approval for the separate invitation migration, six fictional confirmed users/profiles, one dedicated test-admin assignment and the proposed successful combined run: two organizations, five net memberships, two templates, thirteen credentials plus associated batches/approvals/events/audits, invites, reviews, delivery hashes, idempotency receipts and counters. No service-role key, personal password or database password belongs in the runner. One-time privileged provisioning method must be agreed before creation; automated feature journeys follow it.

No immutable-record cleanup exists. A failed write run can leave partial permanent state; inspect and pin before recovery, never blindly retry. Auth confirmation/recovery email delivery, real concurrency, network rate exhaustion, physical devices and hosted execution remain unverified. Hosted diagnostics intentionally omit potentially secret values; abrupt termination may leave sensitive temporary files. Do not upload ignored output. No push/deployment/main integration, hosted account/data creation, remote migration, real admin mutation or paid provisioning performed. Work is left uncommitted for review.
