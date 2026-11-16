# VeriMark local release candidate

Branch `dev/full-stack-integration`. Prepared 2026-11-16 by the engineering orchestrator. **This is a locally verified candidate, not a deployed or production-proven system.** Nothing was pushed, merged to `main`, deployed or provisioned.

## What exists

| Requirement | Delivered | Where |
| --- | --- | --- |
| FR-001 Issuer workspace, roles | Sign-up/sign-in/recovery screens, organization creation, owner/issuer/viewer roles, invitations by one-time link, platform review of issuers | `src/features/auth`, `organizations`, `admin` |
| FR-002 Templates | Text-and-layout certificate templates with live preview, revisions, archive | `src/features/templates` |
| FR-003 Single issuance | Draft → preview → approve exact content → issue, idempotent | `src/features/issuance` |
| FR-004 CSV batch | Upload, per-row errors before anything is created, all-or-nothing issue, link export | `src/features/issuance`, `src/lib/csv` |
| FR-005 Recipient access | Private one-time-shown link, no account, PDF with QR generated in the browser | `src/features/delivery`, `src/lib/certificate` |
| FR-006 Public verification | `/verify`; valid / expired / revoked / replaced / not found / unable to verify, public fields only | `src/features/verification` |
| FR-007 Revoke and replace | Irreversible revoke; replacement creates a linked successor; originals never change | `src/features/credentials` |
| FR-008 History and counts | Audit history, status counts, verification-check count | `src/features/activity` |
| FR-009 Pilot | Not in scope; needs owner approval | – |

Backend: `supabase/migrations/20261116000000_verimark_core.sql` (tables, row level security, 30 functions). Frontend data access: `src/lib/api` with a Supabase adapter and a demonstration adapter.

## Differences from the earlier written design (ADR-0005)

No Edge Functions, no Storage, no server-rendered or stored PDFs, no template images, no per-client rate limiting, no TanStack Query / React Hook Form / Zod / Tailwind. Organization URLs are `/app/...`.

## Verification evidence

Run by the orchestrator on the integrated branch, Windows 11, Node 24.19.0, 2026-11-16, on the commit before this report.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS, 219 tests in 19 files (jsdom) |
| `npm run test:db` | PASS, 147 tests in 6 files (real PostgreSQL in-process, `anon` / `authenticated` roles) |
| `npm run build` | PASS; entry chunk 414 kB (123 kB gzip); the Supabase adapter (222 kB) and PDF library (428 kB) load only when used |
| `PLAYWRIGHT_PORT=3511 npm run test:e2e -- --workers=2` | PASS, 283 passed, 0 failed, 459 skipped (width-restricted specs), 5.2 min, bundled Chromium |

Additional checks:

- **Tests can fail:** three deliberate security holes injected into the migration (anonymous read, missing tenant check, viewer may revoke) were each caught by the database suite.
- **Independent security review** (Codex, read-only): no critical or high findings; five medium/low findings, all fixed. See `docs/database/SCHEMA-AND-OPERATIONS.md`.
- **Demonstration matches database:** `supabase/tests/parity.test.ts` runs one scenario of about 45 outcomes through both adapters and requires identical results.
- **Browser journeys** (`e2e/app-*.spec.ts`, demonstration adapter, 390 and 1440 px, plus 320 px reflow): sign-in and guards, single and CSV issuance, revoke, replace, recipient link and PDF download, roles, issuer review, verification states, axe scans with no serious or critical violations, keyboard-only sign-in and issuance, reduced motion.
- **Content security policy** from `vercel.json` applied to a local production build: no violations on public and signed-in pages; PDF download worked.
- **Commit messages:** no AI attribution anywhere in `main..dev/full-stack-integration`.

What the evidence does **not** cover:

- **No hosted Supabase project.** Supabase Auth (sign-up, e-mail confirmation, password recovery), the hosted Data API and its error codes were never exercised. The Supabase adapter's auth methods are untested against a real service.
- **No real concurrency.** Database tests run on one connection. Locking was reviewed by two parties, not raced.
- **No deployment.** `vercel.json` rewrites and headers were checked only by applying the same policy to a local production build.
- **Demonstration adapter is not security evidence.** Browser journeys prove the screens and flows; the database tests prove the rules.
- No screen-reader testing, no real mobile device, no load or performance testing, no cross-browser run (Chromium only).

## Known defects and limits

- The public rate budget is shared by all callers (600 verifications and 120 delivery exchanges per minute). One abusive client can use it up for everyone for up to a minute. A per-client limit needs an approved component in front of the database.
- Concurrency (deadlock freedom, quota races) is reviewed, not tested.
- In the demonstration, data lives in one browser tab: a recipient link created there cannot be opened in another tab or device. The screen says so.
- Some M1 motion and scroll timing tests fail intermittently above two parallel browser workers on this machine. `--workers=2` is the acceptance setting; the cause is in those tests' timing assumptions and is not fixed.
- The interface is slightly stricter than the database about expiry dates (it rejects today's date; the database accepts it).
- Templates are text and layout only; no logo or image upload.
- Idempotency receipts are never purged; there is no retention or erasure process.
- No CI workflow is enabled (`.github/workflows` is intentionally empty).

## Decisions that need the owner

1. Confirm or change the provisional product defaults in ADR-0005 (30-day delivery links; recipient name public; self-approval allowed; replacement link public; suspension leaves existing records as they are).
2. Approve creating a free-tier Supabase project, and decide how issuer accounts get e-mail: Supabase's built-in sender only delivers to project team addresses, so real sign-up and password recovery need an SMTP provider, which is an extra service not yet approved.
3. Vercel Hobby is for personal, non-commercial use; decide whether the intended use qualifies before deploying.
4. Privacy review, retention/erasure policy and backup/restore rehearsal are required before any real personal data.
5. Whether to merge `feat/full-stack-implementation` (M1) and then this branch into `main`, and whether to push.
6. Housekeeping: remove the finished worker worktrees listed in `docs/ai/WORKTREE-REGISTRY.md`; delete or keep the old branch `jamesmikkorecario-dev/m1-mobile-fix`, which still carries the removed co-author trailers.

## Steps to a hosted preview (after approval)

See "Applying to a Supabase project" in `docs/database/SCHEMA-AND-OPERATIONS.md`, then set the two `VITE_` variables in Vercel and deploy the static build (`npm run build`, output `dist`). Re-run the database scenarios against the project with two test organizations before inviting anyone.
