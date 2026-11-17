# Hosted test run 3 — sign-out ends the current session only

Date: 2026-11-18 (UTC 2026-11-17 18:19:26–18:19:30). One approved targeted run, no retry. Target `jtcudtkranugrxhbigyl` (`verimark-test`); protected `otovaqtmodpqelwbrglj` not contacted.

## Test

`supabase/hosted/session-scope.ts` (checker) + `supabase/hosted/session-scope.test.ts` (hosted runner), using the existing fictional viewer account and the production adapter (`createSupabaseApi(...).signOut()`):

1. Sign in twice → sessions A and B (distinct `session_id`).
2. App Sign out on A; record the `scope` of every `/logout` request.
3. A's old access token → `/user`; A's old refresh token → `/token?grant_type=refresh_token`.
4. B → `/user`, refresh, `/user` again (same `session_id` after refresh).
5. B signed out locally; nothing left behind.

Local validation before the hosted run (`supabase/tests/session-scope.test.ts`, fake Auth server with GoTrue logout/refresh semantics): passes with the current adapter; fails with the pre-fix adapter (`logoutScopes ['global']`, B ended); refuses the protected ref before any request; refuses without hosted consent.

## Preflight

- Management API identity: `verimark-test`, org `osftlurnkgdxcfiwjntp`, `ACTIVE_HEALTHY`, registry role `disposable-test`.
- `.env.hosted-test.local`: `VM_TEST_PROJECT_REF` and URL contain the disposable ref; protected ref absent. Hosted-safety guard tests: 16 passed.

## Result: passed

`npx vitest run --config vitest.hosted.config.ts supabase/hosted/session-scope.test.ts` → 1 passed (logout scopes `['local']` asserted client-side).

Auth log for the window (method, path, status, error code only; the log omits query strings):

| Step | Request | Result |
|---|---|---|
| Sign in A, B | 2× `POST /token` (password) | 200, 200 |
| App Sign out on A | `POST /logout` | 204 |
| A's old access token | `GET /user` | **403 `session_not_found`** |
| A's old refresh token | `POST /token` (refresh) | **400 `refresh_token_not_found`** |
| B still signed in | `GET /user` | **200** |
| B refresh | `POST /token` (refresh) | **200** |
| B after refresh | `GET /user` | **200** |
| Cleanup B | `POST /logout` | 204 |

## Records (read-only, before 18:19:19 / after 18:19:59 UTC)

All unchanged: users 6, profiles 6, platform_admins 1, organizations 2, members 5, invites 3, reviews 2, templates 2, batches 11, batch_rows 13, approvals 10, credentials 13, events 17, delivery 4, idempotency 13, audit 54, counters 2, rate_windows 7. `auth.sessions` 1 → 1, viewer sessions 0 → 0, unrevoked refresh tokens 1 → 1.

## Notes

- The test's own console summary was not captured in the run output filter; the assertions and the Auth log above are the evidence. Not rerun (one run approved).
- `npm run test:hosted` now also picks up this file; it writes no application records.
