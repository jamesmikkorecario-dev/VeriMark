# Git Branching and Parallel AI Work

## Default: short-lived branches against protected `main`

`main` is stable/production. Implement from updated `main` in `feat/<ticket>-<slug>`, `fix/<ticket>-<slug>`, `refactor/`, `test/`, `docs/`, or `chore/`; open PRs into `main`. No direct pushes to protected branches. Use a separate Git worktree for concurrent coding agents, each with one owner/branch, and avoid simultaneous edits to shared files.

## Optional `dev` integration branch

Only if you need staged integration: feature → PR to `dev` → release PR `dev` → `main`. Keep `dev` up to date with `main`; do not assume preview deployments use production credentials. Complexity costs time: for a solo MVP, direct PRs into `main` are usually simpler.

## PR quality gate

- Scoped task + acceptance checklist; diff references requirement IDs.
- Lint/type/build, relevant tests and authorized integration/E2E evidence.
- Independent review, especially security/schema changes.
- Docs, migration and env changes identified.
- No secrets, generated artifacts or unrelated formatting churn.
- Human approval before merging / deploying.

## Commit convention

Examples: `feat(auth): add email sign-in flow`, `fix(rls): restrict document reads`, `test(forms): cover invalid inputs`. Small coherent commits; no fabricated co-author attribution.

## Worktree rule

The orchestrator assigns an explicit branch and owned file paths; integration owner reconciles changes. Never reset, clean, rebase, delete, or force-push another agent's worktree without permission.
