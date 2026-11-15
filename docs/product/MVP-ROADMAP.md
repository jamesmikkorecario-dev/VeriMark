# MVP Scope and Roadmap

Prioritize usable **vertical slices** (UI + auth + database + tests), not months of disconnected frontend and backend work.

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0 — Discovery & foundation | Problem validated enough to scope, stack/ADR, repo and CI, data/auth plan | PRD approved, commands work, threat model started |
| 1 — Design system & shell | Tokens, app shell, navigation, core reusable components | responsive/a11y baselines verified |
| 2 — First end-to-end slice | One real user outcome using UI → data → permissions | automated acceptance + RLS negative tests pass |
| 3 — Complete MVP flows | Remaining P0 stories and edge states | all P0 tests and review gates pass |
| 4 — Hardening | Security, performance, observability, operations | launch checklist and rollback ready |
| 5 — Controlled launch | Production release with user approval | smoke checks, monitoring, user feedback plan |

## Backlog policy

- **P0:** required for product value/safety.
- **P1:** desirable for early users; not launch blocking without a reason.
- **P2:** defer; document rather than implement speculatively.

## Current sprint

- Goal: [ONE user outcome]
- Stories: [US-IDs]
- Explicit exclusions: [..]
- Owner, branch, deadline, dependencies: [..]
