# Full-stack roadmap and status

Living status for the autonomous full-stack run. Scope and rules: `docs/ai/FULL-STACK-CONTRACT.md`. The eleven-milestone table in `MVP-ROADMAP.md` remains the product-level plan; this file tracks the engineering tasks that deliver its M03–M10 scope locally.

| Task | Delivers (roadmap) | Depends on | Status |
| --- | --- | --- | --- |
| FS-0 Contract, ADR-0005, scaffold, commit policy | – | M1 | done |
| FS-DB Schema, RLS, RPCs, database tests, Supabase adapter | M03, M04, M06, M08, M09 server side | FS-0 | in progress |
| FS-A Demo adapter, auth, organizations, review | M03 UI | FS-0 | in progress |
| FS-B Verification, delivery, certificate PDF/QR | M04, M07 UI | FS-0 | in progress |
| FS-C Templates, issuance, credentials, lifecycle, history | M04–M06, M08, M09 UI | FS-0 | in progress |
| FS-E2E Browser journeys, accessibility, mobile | M10 | FS-A, FS-B, FS-C | pending |
| FS-REVIEW Independent security review of FS-DB | M10 | FS-DB | pending |
| FS-RC Setup docs, environment, release-candidate report | – | all | pending |

Dependency notes: FS-A, FS-B and FS-C write disjoint paths and meet only at the frozen `VeriMarkApi` contract, so they run in parallel. FS-DB is written by the orchestrator. Integration order: FS-A (routing and demo adapter), then FS-B, then FS-C, then FS-DB, re-running the gates after each.

Not deliverable locally (needs owner approval or external resources): a hosted Supabase project and its Auth e-mail configuration, Vercel deployment, per-client rate limiting, restore rehearsal, privacy review, pilot (M11).
