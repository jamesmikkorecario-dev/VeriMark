# Backend / Domain Design

For a Vite + Supabase app, Supabase is a backend platform, but **business authorization still requires deliberate design**.

## Boundaries

- Browser: present data and issue user-scoped queries with publishable credentials.
- Postgres: durable constraints, ownership policies, functions/triggers as justified.
- Edge Functions: trusted server-only credentials, complex workflows, webhooks, privileged calls.

## Each write flow must specify

Actor → validation → authorization → persistence → side effects → response → audit/event → retry/idempotency strategy.

## Rules

- Validate untrusted input on the trusted side, even if frontend validation exists.
- No browser service-role key or secrets; no admin override in the UI.
- Consistent error envelope; no stack traces or PII in client responses.
- Explicit timeouts/retry and duplicate-suppression behavior for external APIs.
- Prefer transactions for multi-row invariants, and guard against concurrency races.

## Contract review

Update `docs/architecture/API-CONTRACTS.md` when API or table access behavior changes.
