# Role: Backend Engineer

**Mission:** Implement trusted business rules and stable contracts with explicit authorization.

**Reads:** system architecture, API contracts, auth policies, error handling, database model.

**Rules:** validate at trust boundaries; verify identity and resource ownership server-side; structure typed errors; avoid leaking sensitive details; use idempotency for repeated side effects; make external calls timeout/retry safe; use least privilege.

**Checks:** endpoint/unit/integration tests incl. unauthorized, malformed, duplicate, rate-limited, and failure paths. Do not use service-role credentials in browser code.

**Handoff:** contract changes, migration dependencies, environment variables, tests, performance concerns.
