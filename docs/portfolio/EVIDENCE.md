# VeriMark — evidence map

Every claim category in [CASE-STUDY.md](CASE-STUDY.md) mapped to repository evidence. Status labels:

- **V** — Implemented & verified (by the named automated test or recorded run).
- **L** — Implemented, not verified on hosted infrastructure (local/PGlite/demo evidence only).
- **P** — Planned / not built.

Counts below are those recorded in the cited documents at the time they were written; re-run the commands for current numbers. Before any test, blank both Supabase variables: `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY=`.

## Claim-to-evidence table

| # | Claim category | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Product scope and requirements (FR-001…FR-008) | V (local) | `docs/product/PRD.md`; `docs/ai/handoffs/RC-ASSESSMENT-2026-11-18.md` §3; `README.md` |
| 2 | Architecture decisions (single trust boundary, no Edge/Storage, browser PDFs, two adapters) | V | `docs/architecture/adr/0005-full-stack-release-candidate.md`; `docs/architecture/adr/0003-mandatory-stack.md`; `src/lib/api/types.ts`, `src/lib/api/index.ts` |
| 3 | Demo and Supabase adapters share one contract and rules | V | `supabase/tests/parity.test.ts` (failed against the earlier demo adapter, then passed: `PREPRODUCTION-HARDENING-2026-11-18.md`); `src/lib/api/demoAdapter.test.ts`, `src/lib/api/index.test.ts` |
| 4 | Roles (owner/issuer/viewer), platform admin, server-side enforcement via `app.require_role`; non-member `NOT_FOUND`, low role `FORBIDDEN` | V (PGlite); hosted role and cross-tenant journeys passed | `supabase/migrations/20261116000000_verimark_core.sql`; `supabase/tests/authorization.test.ts`, `organizations.test.ts`; `docs/backend/AUTH-AND-PERMISSIONS.md`; `docs/ai/handoffs/HOSTED-TEST-RUN-1.md` |
| 5 | Sign-out ends only the current session | V (hosted) | `src/lib/api/supabaseAdapter.ts`, `src/lib/api/supabaseAdapter.signout.test.ts`; `supabase/hosted/session-scope.ts`, `session-scope.test.ts`; `supabase/tests/session-scope.test.ts`; `HOSTED-TEST-RUN-2.md` §3 (defect found); `HOSTED-TEST-RUN-3.md` (two-session verification passed); `RC-ASSESSMENT-2026-11-18.md` §1 |
| 6 | RLS on all 17 tables, column-level grants, `anon` has no table access, privilege lockdown (`revoke all`, default privileges) | V (PGlite) | migration `20261116000000_verimark_core.sql` (RLS and privileges section); `supabase/tests/authorization.test.ts`; `docs/database/SCHEMA-AND-OPERATIONS.md` "Access model"; `supabase/tests/README.md` |
| 7 | `SECURITY DEFINER` RPCs with empty `search_path`; private `app` schema not exposed | V (PGlite) | migration core; `docs/database/SCHEMA-AND-OPERATIONS.md`; `supabase/tests/adapter.test.ts` (real adapter against real schema) |
| 8 | Immutable credentials, append-only events/audit/reviews/approvals, no delete/truncate | V (PGlite) | migration core (`credentials_guard_update`, `*_append_only`, `*_no_truncate` triggers); `supabase/tests/authorization.test.ts` ("immutable history") |
| 9 | Draft → preview digest → approval → idempotent issue; digest re-check at issue time | V (PGlite, journeys) | migration core (`preview_batch`, `approve_batch`, `issue_batch`); `supabase/tests/issuance.test.ts`; `e2e/app-journeys.spec.ts`; `e2e-live/journeys.spec.ts`; hosted run 1 (issuance, CSV, approvals passed) |
| 10 | Public verification allowlist; malformed and unknown IDs indistinguishable; status precedence revoked > replaced > expired > valid | V (PGlite, live site) | migration core (`verify_credential`, `app.credential_status`); `supabase/tests/lifecycle-public.test.ts`; `e2e/app-public.spec.ts`; `RELEASE-2026-11-20-PORTFOLIO-DEMO.md` (production smoke) |
| 11 | Revocation, replacement and lineage; audit trail | V (PGlite, journeys) | migration core (`revoke_credential`, `replace_credential`, `list_audit`); `supabase/tests/lifecycle-public.test.ts`; `e2e/app-journeys.spec.ts` (replacement lineage); hosted run 1 (revocation/replacement journeys) |
| 12 | Recipient delivery: hash-only bearer capability in URL fragment, rotation, generic failure | V (PGlite, browser) | migration core (`create_delivery_link`, `exchange_delivery`); `src/features/delivery/ReceivePage.tsx`, `ReceivePage.test.tsx`; `src/app/RemountOnFragment.test.tsx`; `lifecycle-public.test.ts`; `PRIVACY-DECISIONS.md` (observed behavior table) |
| 13 | Recipient PDF with QR to the public URL | V (unit, browser) | `src/lib/certificate/certificate.test.ts`; release record (PDF `%PDF` check on live site) |
| 14 | Strict CSP and security headers | V (config tests, live site) — hosted Supabase-mode headers **L** | `vercel.json`; `supabase/tests/http-security.test.ts`; `e2e/http-security.spec.ts`; `docs/security/hardening/HTTP-SECURITY.md`; release record "Production smoke verification" (11 routes) |
| 15 | Demo-only build compiles the backend out and scans output | V | `tools/build-demo.mjs`; `src/lib/api/index.test.ts`; `supabase/tests/http-security.test.ts` (pins `buildCommand`); CI step "Demo release build"; release record (9 asset files scanned) |
| 16 | Global rate budgets (600 verify / 120 delivery per minute) and committed misses | V (PGlite) | migration core (`app.rate_check`); `supabase/tests/public-rate-hardening.test.ts`; `docs/security/hardening/RATE-LIMITS.md` |
| 17 | Shared-budget limit: one client can exhaust it for all | Documented limitation | `RATE-LIMITS.md`; `PREPRODUCTION-HARDENING-2026-11-18.md` (P1 gate) |
| 18 | Per-client / trusted-ingress rate limiting | **P** | `RATE-LIMITS.md` (decision proposal); `ADR-0005` "Deviations" |
| 19 | Privacy decisions (public name, lineage, link lifetime, PDF metadata, retention/erasure) | Documented as proposals, **not adopted** | `docs/security/hardening/PRIVACY-DECISIONS.md`; `docs/delivery/DEMO-RELEASE-PLAN.md` |
| 20 | Retention and erasure workflow | **P** | `PRIVACY-DECISIONS.md` P-05; `SCHEMA-AND-OPERATIONS.md` "Known limits" |
| 21 | Storage, Edge Functions, stored PDFs, logo upload, reviewer role | **P** | `ADR-0005` "Deviations"; `RC-ASSESSMENT-2026-11-18.md` §3 |
| 22 | Production e-mail delivery (custom SMTP, sending domain) | **P** (hosted Auth e-mail unverified) | `PREPRODUCTION-HARDENING-2026-11-18.md`; `docs/delivery/FREE-PILOT-READINESS.md`; release record "Outstanding before any real pilot" |
| 23 | Unit/component tests | V | `npx vitest run`; 225/225 in release record; 222 in RC assessment |
| 24 | Database/security tests on real migration SQL (PGlite) | V (not hosted) | `npm run test:db`; `supabase/tests/*.test.ts`; 217 passed in `PREPRODUCTION-HARDENING-2026-11-18.md`; scope and limits in `supabase/tests/README.md` |
| 25 | Browser e2e (Playwright, multiple widths, a11y, navigation, motion) | V (Chromium only) | `npm run test:e2e -- --workers=2`; `e2e/*.spec.ts`; 287 passed, 0 failed in the hardening handoff; Linux CI runs below |
| 26 | Live user journeys | V (demo); hosted subset V | `e2e-live/journeys.spec.ts`, `quality.spec.ts`, `e2e-live/README.md`; 22 passed / 12 by-design skips (hardening handoff); 18/18 against the production site (release record) |
| 27 | Hosted integration on a disposable Supabase project (API 4/4; browser 21/1/12; targeted rerun; session scope) | V (disposable project only) | `supabase/hosted/hosted.test.ts`; `HOSTED-TEST-PREPARATION.md`; `HOSTED-TEST-RUN-1.md`, `HOSTED-TEST-RUN-2.md`, `HOSTED-TEST-RUN-3.md`; `DISPOSABLE-TEST-ISOLATION.md`; `DISPOSABLE-TEST-MIGRATION-APPLIED.md`; `supabase/tests/hosted-safety.test.ts`, `provisioning-safety.test.ts` (refuse the protected project) |
| 28 | Run-1 browser failure cause | Unproven (not reproduced) | `HOSTED-TEST-RUN-1.md` "Failure investigation"; `HOSTED-TEST-RUN-2.md` §2; `e2e-live/safe-reporter.ts`; `supabase/tests/safe-reporter.test.ts` |
| 29 | Real-PostgreSQL concurrency: deadlock reproduced (`40P01`) and fixed; duplicate issue yields one credential/event/receipt; three schedules only | V (local PostgreSQL 18, not hosted) | `tools/test-concurrency.mjs`; `supabase/migrations/20261118010000_concurrency_hardening.sql`; `supabase/tests/concurrency-hardening.test.ts`; `docs/security/hardening/CONCURRENCY.md` |
| 30 | Concurrency fix applied to a hosted project | **L** | `PREPRODUCTION-HARDENING-2026-11-18.md` ("applying migration to any hosted project still requires explicit approval") |
| 31 | CI: Linux GitHub Actions validation, pinned actions, least privilege | V | `.github/workflows/pilot-validation.yml`; `docs/delivery/CI-CD.md`; runs **44565879138** (dev, `02de9dd`, passed first attempt) and **44568170317** (main, `02de9dd`, passed first attempt); `RELEASE-2026-11-20-PORTFOLIO-DEMO.md` "Linux CI" |
| 32 | CI flake root-caused (failed runs 44522462946 attempt 1 and 44563431380) and fixed without weakening assertions | V | `RELEASE-2026-11-20-PORTFOLIO-DEMO.md` "Original failure, root cause and fix"; `src/features/credentials/CredentialDetailPage.test.tsx` |
| 33 | Vercel Hobby static deployment, no env vars, no integrations, rollback by promotion | V | `vercel.json`; `RELEASE-2026-11-20-PORTFOLIO-DEMO.md` "Vercel", "Rollback"; `docs/delivery/DEMO-RELEASE-PLAN.md`; live: <https://verimark-demo.vercel.app> |
| 34 | Release gates and release record | V | `docs/delivery/DEMO-RELEASE-PLAN.md` "Release sequence"; `docs/delivery/RELEASE-2026-11-20-PORTFOLIO-DEMO.md` |
| 35 | Engineering process: isolated worktrees, independent reviews, honest handoffs | V (documented) | `docs/ai/WORKFLOW.md`; `docs/ai/WORKTREE-REGISTRY.md`; `docs/ai/handoffs/*.md`; `INITIALIZATION-REVIEW.md`; "Independent review" in `PREPRODUCTION-HARDENING-2026-11-18.md`; `docs/delivery/COMMIT-POLICY.md` |
| 36 | Dependency posture | V (dev-tool advisory unresolved) | `docs/security/hardening/DEPENDENCIES.md` (production-only audit: 0 findings; GHSA-fc5q-39xc-vjpf open upstream) |
| 37 | Security reporting channel | Enabled, end-to-end test pending | `SECURITY.md`; `docs/security/hardening/SECURITY-REPORTING.md`; `DEMO-RELEASE-PLAN.md` |
| 38 | Cross-browser (Firefox/WebKit), assistive-technology and performance testing | **P** | `PREPRODUCTION-HARDENING-2026-11-18.md` (verification gate); `RC-ASSESSMENT-2026-11-18.md` §3, §6 |

## CI run index

| Run ID | Branch | Commit | Result |
| --- | --- | --- | --- |
| 44522462946 (attempt 1) | dev | `3dca68a` | failed (timing race in one unit test) |
| 44522462946 (attempt 2) | dev | `3dca68a` | passed |
| 44563431380 | main | `3dca68a` | failed (same test) |
| **44565879138** | dev | `02de9dd` | passed, all steps, first attempt |
| **44568170317** | main | `02de9dd` | passed, all steps, first attempt |

Source for all rows: `docs/delivery/RELEASE-2026-11-20-PORTFOLIO-DEMO.md`. Workflow steps: typecheck, lint, unit, database/security, build, demo build with scan, two-worker Chromium e2e, live demo journeys.

## How to re-verify locally

```text
npm ci
npm run typecheck && npm run lint
npx vitest run                      # unit and component
npm run test:db                     # real migrations in PGlite
npm run build:demo                  # demo-only build plus dist scan
PLAYWRIGHT_PORT=<free port> npm run test:e2e -- --workers=2
LIVE_PORT=<free port> npm run test:live
```

Hosted runs (`npm run test:hosted`, `LIVE_TARGET=hosted`) require an approved disposable project and are deliberately not part of this list.
