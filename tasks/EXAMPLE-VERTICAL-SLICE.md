# Example Only — TASK-EXAMPLE: User creates a private item

This is **not** a confirmed product requirement. Replace with your own first user journey.

- **Branch:** `feat/task-001-private-item`
- **Owner:** implementation agent; QA/reviewer separate.
- **Goal:** an authenticated user can create and view their own item, not another user's.
- **In scope:** schema migration with RLS; typed data service; create/list UI with errors/empty/loading; tests; docs.
- **Out of scope:** sharing, admin dashboard, notifications, payments.
- **Acceptance:** anonymous denied; owner create/list works; other user cannot read/update; validation rejects empty text; keyboard and narrow viewport usable.
- **Tests:** schema policy checks, service tests, UI component tests, one Playwright critical flow.
- **Handoff:** actual commands and outputs, changed paths, RLS policy evidence, PR link, risks.
- **Approval:** human approves merge and production release separately.
