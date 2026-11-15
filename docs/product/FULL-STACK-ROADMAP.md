# Full-stack roadmap and status

Living status for the autonomous full-stack run. Scope and rules: `docs/ai/FULL-STACK-CONTRACT.md`. The eleven-milestone table in `MVP-ROADMAP.md` remains the product-level plan; this file tracks the engineering tasks that deliver its M03–M10 scope locally.

| Task | Delivers (roadmap) | Depends on | Status |
| --- | --- | --- | --- |
| FS-0 Contract, ADR-0005, scaffold, commit policy | – | M1 | done |
| FS-DB Schema, RLS, RPCs, database tests, Supabase adapter | M03, M04, M06, M08, M09 server side | FS-0 | done (5ee2ca7); 139 database tests |
| FS-A Demo adapter, auth, organizations, review | M03 UI | FS-0 | in progress (paused 03:5x–07:26 by a provider usage limit, then resumed) |
| FS-B Verification, delivery, certificate PDF/QR | M04, M07 UI | FS-0 | integrated (0cf578b) |
| FS-C Templates, issuance, credentials, lifecycle, history | M04–M06, M08, M09 UI | FS-0 | integrated (27ff4e2) |
| FS-E2E Browser journeys, accessibility, mobile | M10 | FS-A, FS-B, FS-C | pending |
| FS-REVIEW Independent security review of FS-DB | M10 | FS-DB | in progress (Codex, read-only, dispatch ctx_fc440d6176a0) |
| FS-RC Setup docs, environment, release-candidate report | – | all | pending |

Dependency notes: FS-A, FS-B and FS-C write disjoint paths and meet only at the frozen `VeriMarkApi` contract, so they run in parallel. FS-DB is written by the orchestrator. Integration order: FS-A (routing and demo adapter), then FS-B, then FS-C, then FS-DB, re-running the gates after each.

Not deliverable locally (needs owner approval or external resources): a hosted Supabase project and its Auth e-mail configuration, Vercel deployment, per-client rate limiting, restore rehearsal, privacy review, pilot (M11).

## Checkpoint 2026-11-16 07:30

- Integration branch `dev/full-stack-integration` at `5ee2ca7` (plus this documentation commit). M1 branch `feat/full-stack-implementation` at `c45bf28`; original head preserved at `backup/m1-pre-attribution-cleanup-20261116`.
- Gates at this checkpoint: typecheck pass, lint pass, unit/component 129/129, database 139/139, build pass. Browser suite not yet re-run on the integrated branch.
- **The application is not usable end to end yet.** `src/app/App.tsx` still has only the M1 routes and `createDemoApi()` is a placeholder, so the new pages are built and tested in isolation but not reachable. FS-A delivers routing, sign-in and the demo adapter.
- Active workers: FS-A (worktree `fs-a-auth-org`), FS-REVIEW (read-only in the integration worktree). Orca run `run_693a93931d57`.
- Next, in order: (1) review and integrate FS-A, re-run all gates and the browser suite with `--workers=2`; (2) act on FS-REVIEW findings with a test per fix; (3) FS-E2E browser journeys on the demo adapter (issue → verify → revoke → replace → receive, roles, 320 px, axe); (4) FS-RC: setup guide, `.env.example`, README status, release-candidate report.
- To resume in a new session: read this file, `docs/ai/FULL-STACK-CONTRACT.md`, `docs/ai/WORKTREE-REGISTRY.md`, then `orca orchestration run-use run_693a93931d57` and `orca orchestration worker-list`.
