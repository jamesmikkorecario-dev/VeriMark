# Hosted test run 1 — disposable project `jtcudtkranugrxhbigyl`

Date: 2026-11-17 (UTC 12:25–12:30). Worktree `test-supabase-integration`, branch `jamesmikkorecario-dev/test-supabase-integration`, run from `fd45e77`.
Protected development project `otovaqtmodpqelwbrglj` was not targeted by any command.

## Preflight (before any write)

- Target ref and URL in `.env.local` / `.env.hosted-test.local` match `jtcudtkranugrxhbigyl`; protected ref absent from both.
- Remote migration history: `20261116000000`, `20261116010000` (local = remote).
- 0 Auth users; all 17 application tables empty; `ensure_rls` event trigger present; email confirmation still required (`mailer_autoconfirm=false`).
- `.env.hosted-admin.local` git-ignored, contains only `VM_PROVISION_SECRET_KEY` (`sb_secret_` shape checked, value never printed).
- Guard tests: 19 passed (`provisioning-safety`, `hosted-safety`).

## Provisioning (once)

`node supabase/hosted/provision-users.ts` created six confirmed accounts at `@example.test`; `--check` and an independent SQL read confirmed email, UUID, confirmation, non-anonymous and trigger-created profile for each.

| Persona | UUID |
|---|---|
| owner | `2a512774-083c-431a-a574-6d5020d0c6eb` |
| issuer | `156cd25d-a71d-4846-b09e-2e80b529cca5` |
| viewer | `908c82d6-7c97-4950-a39d-fa89f448b47e` |
| other owner | `65e01f3b-f22a-4120-89dd-40cba77537bd` |
| admin | `488a597d-f903-4185-abfc-95139a1a75bf` |
| invitee | `1e444eaa-0e54-4f27-888a-d0ed4c1188ff` |

One `platform_admins` row inserted for the admin UUID only (guarded by matching email; CLI `--yes` for this single statement). The elevated key is not used by either suite.

Pinned organizations: main `82fc9b89-bb27-4ed4-a5ae-3160466150a2`, other `c3237c42-2939-4a31-93a6-f2d5670767a0`.

## Results

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| `npm run test:hosted` (API) | 4 | 0 | 0 |
| `LIVE_TARGET=hosted npm run test:live` (browser, 34 listed) | 21 | 1 | 12 |

The 12 skips are by design (record-creating journeys run only at 1440 px; three quality checks are width-specific).

Failed: `e2e-live/journeys.spec.ts:7` — "sign-in refuses a wrong password, returns to the requested page, and signs out".

## Failure investigation

- The original reporter discarded all error text, so no assertion message exists.
- Hosted Auth request logs (read-only, safe projection): the only browser-side `/token` calls are global setup's six sign-ins at 12:27:23 and one refresh at 12:29:23. Neither the wrong-password attempt nor the viewer sign-in from this test reached Supabase Auth; no 4xx/5xx Auth responses exist in the window. The test therefore failed before or at form submission, or the request failed in the browser before reaching Auth.
- Local reproduction in hosted mode (fake project URL, intercepted Auth) with missing, warm and stale-demo Vite caches: all steps pass, one page load, `/token` sent, correct alert. Not reproducible locally; a Vite dependency-reload hypothesis was tested and rejected.
- Not a product authorization defect observed: every other journey (issuance, CSV, approvals, invitations, revocation/replacement, delivery, admin review, cross-tenant denial) passed against the real backend.

## Correction made (local, not hosted)

`e2e-live/safe-reporter.ts` now records redacted, truncated error text instead of nothing: removes the test password and every global-setup session token, JWTs, `sb_` keys, link fragments and long tokens. Regression: `supabase/tests/safe-reporter.test.ts` (2 tests). Typecheck and lint pass.

## Permanent records (independent read-only count after both runs)

| Table | Rows |
|---|---|
| auth users / profiles | 6 / 6 |
| platform_admins | 1 |
| organizations | 2 |
| organization_members | 5 (owner 2, issuer 1, viewer 2) |
| organization_invites | 3 |
| issuer_reviews | 2 |
| credential_templates | 2 |
| credential_batches | 11 |
| batch_rows | 13 |
| batch_approvals | 10 |
| credentials | 13 |
| credential_events | 17 |
| delivery_capabilities | 4 |
| idempotency_receipts | 13 |
| audit_log | 54 |
| verification_counters | 2 |
| rate_windows | 7 |

Matches the planned first-run budget. No users outside the six fictional accounts; no memberships outside them.

## Not run / open

- No hosted rerun was performed. A targeted rerun of `journeys.spec.ts:7` alone needs renewed approval. With fixtures pinned, global setup reuses everything (no application writes); the test itself creates only Auth sessions, which it revokes on sign-out.
- The app's sign-out uses Supabase's default global scope, so signing out revokes the user's sessions on every device. Confirm this is intended.
- Email delivery, real multi-connection concurrency and the global anonymous rate budget remain unverified.

## Disposal

Keep the project until results are reviewed. Revoke the `verimark_hosted_tests` secret key and delete `.env.hosted-admin.local` now; no remaining step needs it. Deleting `jtcudtkranugrxhbigyl` (Dashboard → General settings → Delete project, re-checking the ref) requires explicit approval; never delete `otovaqtmodpqelwbrglj`.
