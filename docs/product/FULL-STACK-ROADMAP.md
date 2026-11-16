# Full-stack roadmap and status

Living status for the autonomous full-stack run. Scope and rules: `docs/ai/FULL-STACK-CONTRACT.md`. The eleven-milestone table in `MVP-ROADMAP.md` remains the product-level plan; this file tracks the engineering tasks that deliver its M03–M10 scope locally.

| Task | Delivers (roadmap) | Depends on | Status |
| --- | --- | --- | --- |
| FS-0 Contract, ADR-0005, scaffold, commit policy | – | M1 | done |
| FS-DB Schema, RLS, RPCs, database tests, Supabase adapter | M03, M04, M06, M08, M09 server side | FS-0 | done (5ee2ca7); 139 database tests |
| FS-A Demo adapter, auth, organizations, review | M03 UI | FS-0 | integrated (bab6e47) |
| FS-B Verification, delivery, certificate PDF/QR | M04, M07 UI | FS-0 | integrated (0cf578b) |
| FS-C Templates, issuance, credentials, lifecycle, history | M04–M06, M08, M09 UI | FS-0 | integrated (27ff4e2) |
| FS-E2E Browser journeys, accessibility, mobile | M10 | FS-A, FS-B, FS-C | integrated (831087a); no application defects found |
| FS-REVIEW Independent security review of FS-DB | M10 | FS-DB | done; five findings, all fixed (7c4e3d9) |
| FS-RC Setup docs, environment, release-candidate report | – | all | done; see docs/delivery/RELEASE-CANDIDATE.md |

Dependency notes: FS-A, FS-B and FS-C write disjoint paths and meet only at the frozen `VeriMarkApi` contract, so they run in parallel. FS-DB is written by the orchestrator. Integration order: FS-A (routing and demo adapter), then FS-B, then FS-C, then FS-DB, re-running the gates after each.

Not deliverable locally (needs owner approval or external resources): a hosted Supabase project and its Auth e-mail configuration, Vercel deployment, per-client rate limiting, restore rehearsal, privacy review, pilot (M11).

## Checkpoint 2026-11-16 07:30

- Integration branch `dev/full-stack-integration` at `5ee2ca7` (plus this documentation commit). M1 branch `feat/full-stack-implementation` at `c45bf28`; original head preserved at `backup/m1-pre-attribution-cleanup-20261116`.
- Gates at this checkpoint: typecheck pass, lint pass, unit/component 129/129, database 139/139, build pass. Browser suite not yet re-run on the integrated branch.
- **The application is not usable end to end yet.** `src/app/App.tsx` still has only the M1 routes and `createDemoApi()` is a placeholder, so the new pages are built and tested in isolation but not reachable. FS-A delivers routing, sign-in and the demo adapter.
- Active workers: FS-A (worktree `fs-a-auth-org`), FS-REVIEW (read-only in the integration worktree). Orca run `run_693a93931d57`.
- Next, in order: (1) review and integrate FS-A, re-run all gates and the browser suite with `--workers=2`; (2) act on FS-REVIEW findings with a test per fix; (3) FS-E2E browser journeys on the demo adapter (issue → verify → revoke → replace → receive, roles, 320 px, axe); (4) FS-RC: setup guide, `.env.example`, README status, release-candidate report.
- To resume in a new session: read this file, `docs/ai/FULL-STACK-CONTRACT.md`, `docs/ai/WORKTREE-REGISTRY.md`, then `orca orchestration run-use run_693a93931d57` and `orca orchestration worker-list`.

## Checkpoint 2026-11-16 16:40 — hosted Supabase preflight

- A Supabase Free development project exists and `.env.local` is configured in the integration worktree. **Nothing has been applied to it.** Plan and checklist: `docs/database/HOSTED-MIGRATION-PLAN.md`; hosted test: `supabase/hosted/README.md`.
- Preflight corrections: profile backfill for existing accounts, explicit `public` schema access for API roles, malformed identifiers reported as not found, browser suite pinned to the demonstration adapter.
- The integration worktree was re-checked-out after an interrupted deletion; `HEAD` was intact and nothing uncommitted was lost (snapshot kept at `refs/backup/preflight-20261116-worktree`). Local-only folders `artifacts/` and `dist/` were lost; they held only regenerable output.
- 16:44: with the owner's approval the migration was applied to the development project and verified read-only (record in `docs/database/HOSTED-MIGRATION-PLAN.md`). Waiting for separate approvals: first platform administrator, hosted test users, `npm run test:hosted`.

## Checkpoint 2026-11-16 08:15 — local release candidate

- All engineering tasks above are integrated on `dev/full-stack-integration`. Gates: typecheck, lint, 219 unit/component, 147 database, build, 283 browser (`--workers=2`) — all pass.
- No active workers. Worker worktrees remain on disk (see `docs/ai/WORKTREE-REGISTRY.md`).
- Nothing further can be done without the owner: see "Decisions that need the owner" in `docs/delivery/RELEASE-CANDIDATE.md`.
- Next engineering work once a Supabase project is approved: apply the migration, repeat the database scenarios there with real concurrent connections, exercise Auth e-mail flows, add a per-client rate limit.
