# Release-candidate assessment — 2026-11-18

Branch `dev/full-stack-integration` at `0476110` (fast-forwarded from `485f13f`; 10 commits from `jamesmikkorecario-dev/test-supabase-integration`). Not pushed, not merged to `main`, not deployed. Status: **release gate — owner approvals required (§10).**

## 1. Hosted sign-out verification — passed

One approved run on disposable `jtcudtkranugrxhbigyl` (details: `HOSTED-TEST-RUN-3.md`). Same fictional account, two sessions; the app's Sign out on A sent `scope=local`; A's access token → `403 session_not_found`, A's refresh token → `400 refresh_token_not_found`; B `/user` 200, refresh 200 (same session), `/user` 200. All application and Auth counts unchanged (credentials 13 → 13, viewer sessions 0 → 0).

## 2. Integrated state

- Commits added: `59e95f6 … c3ac9ec`, `0476110`; all author `jamesmikkorecario-dev`, no AI attribution (`omp-flow check-commits`). No tracked `.env*` except `.env.example`; diff secret scan: no high-confidence secrets (fictional test passwords/tokens only).
- Integration by `git merge --ff-only` in the dedicated worktree. Its 19 pre-existing `M` entries are line-ending-only (CRLF worktree vs LF index; `git diff` empty), did not overlap incoming files and were byte-identical before/after each merge. `omp-flow integrate` refuses any dirty entry, so it was not used.
- Independent review of `485f13f..c3ac9ec`: no P0–P2; the P3 doc inaccuracy and a latent diagnostics truncation-before-redaction issue were fixed in `0476110`.

## 3. Feature completeness

PRD FR-001 – FR-008 implemented (workspace/auth/orgs/roles, platform review, templates (text/layout only), single and CSV issuance, recipient link + browser PDF/QR, public verification, revoke/replace, activity/metrics). FR-009 pilot out of scope. Not built per ADR-0005: Storage, Edge Functions, stored PDFs, logo upload, reviewer role (platform admin only). No performance budgets tested.

## 4. Evidence

Local, integrated worktree at `c3ac9ec` (full) and `0476110` (re-check of changed files), Vite Supabase variables blanked:

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run lint` | pass (both commits) |
| `npx vitest run` (unit/component, incl. sign-out scope regression) | 222/222 |
| `npm run test:db` (PGlite authorization/security, incl. session-scope checker, provisioning and reporter safety) | 176/176 |
| `npm run build` | pass |
| `PLAYWRIGHT_PORT=3511 npm run test:e2e -- --workers=2` (demo adapter; established setting) | 283 passed, 459 width-skipped, 0 failed, 0 flaky |
| `npm run test:live` (live journeys, demo rehearsal) | 22 passed, 12 by-design skips (both commits) |

Hosted (disposable project only): run 1 API 4/4, browser 21/1 failed/12 skipped; run 2 targeted auth test passed; run 3 sign-out scope passed. Run-1 failure not reproduced; cause unproven (diagnostics now captured on failure).

No failures in this cycle, so no defect/instability triage was needed. Known instability: motion/scroll specs above 2 workers (accepted setting `--workers=2`).

## 5. Security concerns remaining

- Global public rate budget (verify 600/min, delivery 120/min, `verimark_core.sql:1108,1129`): one client can exhaust it for all.
- Bearer delivery links (30-day default, D-011) and public recipient display name: owner decisions pending.
- `no-store` only on `/receive` and `/invite` (`vercel.json`); `/verify` responses cacheable. CSP allows `style-src 'unsafe-inline'`.
- Invitation identity relies on email confirmation; hosted projects have it on (`mailer_autoconfirm=false` on both), local `supabase/config.toml` has `enable_confirmations = false` (local only).
- Concurrency, lock order and quota races reviewed, not tested on real PostgreSQL.
- No retention/erasure; idempotency receipts kept forever.
- No private security-report channel (SECURITY.md: public-launch blocker). No independent production-checklist review; no restore rehearsal.
- Password minimum: app 10, local config 6; hosted value not read (helper redacts the field).

## 6. Product limitations

Demo adapter is single-tab and not evidence. Chromium only; no screen-reader/device testing. No CI workflow. Expiry: UI rejects today, database accepts it. Email delivery (sign-up, recovery, invitations) unverified; built-in SMTP sends only to team members, ~2/hour.

## 7. Supabase isolation

| | Dev `otovaqtmodpqelwbrglj` (protected) | Test `jtcudtkranugrxhbigyl` (disposable) |
|---|---|---|
| Migrations (read-only query 2026-11-18) | `20261116000000` only | `20261116000000`, `20261116010000` |
| Auth site URL / allow list | `http://localhost:3000` / empty | `http://127.0.0.1:3611` / `http://127.0.0.1:3611/**` |
| Email confirmation | required | required |
| Agent writes this cycle | none (read-only metadata/queries) | 1 key deletion (run 2), 3 approved test runs |

Hosted runners refuse the dev ref; `wf-guard` blocks mutating CLI/HTTP/SQL commands naming the dev ref or run where the CLI link points at it; the integration worktree's `.env.local` targets the dev project but both browser suites force the demo adapter. **Drift:** dev lacks `20261116010000`, so dev `create_invite` still accepts inviting an existing member (demo adapter and tests reject it).

## 8. Deployment prerequisites (none met)

Production Supabase project (Free, separate from dev/test); apply both migrations in order; Auth site URL + redirect allow list for the production origin (`/sign-in`, `/update-password`); email confirmation on; Data API `public` only; first platform admin; custom SMTP provider decision; Vercel project and Hobby-eligibility decision; `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` only; release record per `DEPLOYMENT-AND-ROLLBACK.md`; security-report channel; owner decisions D-010–D-014.

## 9. Retiring `jtcudtkranugrxhbigyl`

1. Keep until these results are reviewed; evidence is in `HOSTED-TEST-RUN-1/2/3.md` (no secrets).
2. Optional before deletion: one read-only export of record counts (already captured).
3. Approval naming the exact ref; re-verify name `verimark-test`, ref ≠ `otovaqtmodpqelwbrglj`, Free plan.
4. Delete with `npx supabase projects delete jtcudtkranugrxhbigyl` (blocked by `wf-guard` until approved; `supabase-ops.mjs` deliberately cannot delete projects). Confirm absence with `supabase-ops projects`, and confirm the dev project is still listed.
5. Then remove the test worktree's ignored `.env.local`, `.env.hosted-test.local`, `supabase/.temp/`, `test-results-live/` and the registry entry. No keys to revoke: `verimark_hosted_tests` already revoked; remaining keys die with the project.

## 10. Approvals required

1. Accept this RC assessment (release gate).
2. Merge `dev/full-stack-integration` → `main` (not done).
3. Push any branch to GitHub (not done).
4. Apply `20261116010000_invite_existing_member.sql` to dev `otovaqtmodpqelwbrglj` (protected; would fix the drift).
5. Delete disposable project `jtcudtkranugrxhbigyl` (§9).
6. Provision a production Supabase project, Vercel project/deployment, custom SMTP provider, domain.
7. Owner product/security decisions: D-010–D-014, rate-limit strategy, retention policy, security-report channel.
