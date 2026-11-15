# Test Strategy and Evidence

Tests prove user requirements at the lowest useful level, with a few well-chosen end-to-end flows.

| Layer | Coverage target | Example |
| --- | --- | --- |
| Static | lint, strict types, build | CI rejects invalid imports and types |
| Unit | pure domain logic, helpers | state transitions, validation rules |
| Component | accessible UI states | form errors, keyboard use, loading |
| Integration | Supabase queries, RLS, Edge Functions | owner succeeds / another user denied |
| E2E | critical user outcomes | sign in → create item → retrieve own item |
| Nonfunctional | accessibility, performance, security | axe + manual keyboard; budgets; auth abuse |

## Test case template

- Test ID and requirement: [T-001 → US-001]
- Setup and data isolation: [..]
- Given / When / Then: [..]
- Expected error behavior: [..]
- Actual result and evidence: [commit, command, output]
- Cleanup and independence: [..]

## CI gate (configure only after scripts exist)

Lint, TypeScript, unit tests, production build; integration/RLS on approved isolated DB; Playwright smoke test for critical journeys. Fail closed on required checks. Record coverage by risk and feature, not an arbitrary 100% target.

## Reporting

Use **PASS / FAIL / SKIPPED / NOT RUN** with the actual command, environment, commit SHA, summary and failures. Never conflate a code review with executing tests. Flag flaky tests explicitly.
