# VeriMark local validation workflow

`pilot-validation.yml` runs typecheck, lint, unit/component tests, PGlite database/security tests, the production build, two-worker Chromium tests and the one-worker live **demo** rehearsal. It pins its actions and Node runtime, grants read-only repository access and persists no checkout credentials.

The workflow has no hosted Supabase credentials, provisioning, deployments or artifact uploads. Remote GitHub execution and branch-protection activation have not been observed; local passing checks are not release approval. Full dependency-audit findings remain a separate explicit release blocker.

See [free pilot readiness](../../docs/delivery/FREE-PILOT-READINESS.md) and [pre-production assessment](../../docs/ai/handoffs/PREPRODUCTION-HARDENING-2026-11-18.md). Historical proposals in `templates/github-actions/` are not active workflows. No push or deployment is authorized.
