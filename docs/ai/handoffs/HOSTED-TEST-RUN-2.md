# Hosted test run 2 — credential cleanup, targeted rerun, sign-out scope

Date: 2026-11-18 (UTC 2026-11-17 17:4x–17:57). Worktree `test-supabase-integration`. Target: disposable project `jtcudtkranugrxhbigyl` (`verimark-test`). Protected development project `otovaqtmodpqelwbrglj` received read-only identity lookups only.

## 1. `verimark_hosted_tests` secret key revoked

| Step | Evidence |
|---|---|
| Target identity | Management API `GET /v1/projects/jtcudtkranugrxhbigyl`: name `verimark-test`, org `osftlurnkgdxcfiwjntp`, `ACTIVE_HEALTHY` |
| Key before | 5 keys: legacy `anon`, legacy `service_role`, publishable `default`, secret `default`, secret `verimark_hosted_tests` (`3f267335-1282-4ba7-9881-fa90c35e3767`, created 2026-11-16 14:17 UTC) |
| Ownership | The key in `.env.hosted-admin.local` matched the stored prefix of `3f267335…` only (boolean check, value never printed) |
| Delete | `DELETE /v1/projects/jtcudtkranugrxhbigyl/api-keys/3f267335-1282-4ba7-9881-fa90c35e3767` via `supabase-ops.mjs key-delete` (verifies id/name/type first) |
| Verification | Helper re-list: absent, other four keys intact. Independent `npx supabase projects api-keys --remote=jtcudtkranugrxhbigyl`: `legacy/anon, legacy/service_role, publishable/default, secret/default`, target absent |
| Local file | `.env.hosted-admin.local` deleted; it was git-ignored (`.gitignore:8 .env.*`) and has no history in any ref (`git log --all -- .env.hosted-admin.local` empty) |

The provisioning script can no longer run (no elevated key); that is intended.

## 2. Targeted rerun of `e2e-live/journeys.spec.ts:7` (one attempt, approved)

Command: `LIVE_TARGET=hosted npx playwright test --config playwright.live.config.ts e2e-live/journeys.spec.ts:7 --project=live-1440` (17:55:35–17:55:50 UTC). Result: **passed** (`test-results-live/hosted-summary.json`).

Before the run, the hosted harness gained failure-only diagnostics (navigations, Auth/REST method+path+status, failed requests, console/page errors; no query strings, headers or bodies), redacted by the safe reporter. They were not needed because the test passed. After review they were extended from the test's own page to every Stage page (persona and anonymous contexts), which 16 of the 18 hosted tests use.

Hosted Auth log (read-only, method/path/status/error_code only):

| Time (UTC) | Event |
|---|---|
| 17:55:37 | 6× `POST /token` 200 — global setup sign-ins |
| 17:55:46 | `POST /token` 400 `invalid_credentials` — wrong password reached Auth and was refused |
| 17:55:47 | `POST /token` 200 — viewer sign-in |
| 17:55:48 | `POST /logout` 204 — app Sign out |
| 17:55:48 | 6× teardown `POST /logout`: 5× 204, 1× 403 `session_not_found` |

The 403 is the global-setup viewer session, already revoked by the app's global-scope sign-out: direct evidence that ordinary Sign out ended the user's other sessions (fixed in §3).

Run-1 failure: not reproduced. In run 1 neither Auth request from this test reached Supabase; in run 2 both did. Root cause remains unproven; the new diagnostics will capture the page-side sequence if it recurs.

### Permanent records (read-only, before 17:54:11 / after 17:57:01)

| users | profiles | admins | orgs | members | invites | reviews | templates | batches | batch_rows | approvals | credentials | events | delivery | idempotency | audit | counters |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 → 6 | 6 → 6 | 1 → 1 | 2 → 2 | 5 → 5 | 3 → 3 | 2 → 2 | 2 → 2 | 11 → 11 | 13 → 13 | 10 → 10 | **13 → 13** | 17 → 17 | 4 → 4 | 13 → 13 | 54 → 54 | 2 → 2 |

`auth.sessions` 1 → 1 and unrevoked refresh tokens 1 → 1: every session the run created was ended. No application records were created.

## 3. Sign-out ends the current session only

`src/lib/api/supabaseAdapter.ts`: `client.auth.signOut()` (Supabase default `global`, revokes every session of the user) → `signOut({ scope: 'local' })` (revokes only this browser's session server-side and clears it locally). 401/403 (session already ended elsewhere) still count as signed out.

Regression: `src/lib/api/supabaseAdapter.signout.test.ts` drives the real Supabase client with a stubbed network: asserts one `POST /auth/v1/logout?scope=local` and a cleared stored session; and that a 403 still signs this browser out. Against the previous code the first test fails with `expected 'global' to be 'local'`.

Not verified on hosted: the fixed sign-out was not run against the disposable project (no additional hosted run approved). Expected effect on a future hosted run: the teardown `session_not_found` disappears.

## Open

- Delete `jtcudtkranugrxhbigyl` after results are reviewed — separate approval required.
- Email delivery, real concurrency and global rate budgets remain unverified (unchanged from run 1).
