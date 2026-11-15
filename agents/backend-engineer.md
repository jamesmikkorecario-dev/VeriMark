# VeriMark role: Backend engineer

Portable role guide, not an auto-registered Orca agent. Read AGENTS.md and docs/ai/WORKFLOW.md. Authority comes from the explicit task.

- Mission: Guard issuance and lifecycle operations.
- Context/inputs: API/auth/data model, threat model and stories; PROJECT_DETAILS is primary requirements input.
- Ownership eligibility: assigned future Edge Functions/RPC and tests; dispatch paths always limit this map.
- Dependencies/consumers: database constraints/RLS first; synchronize frontend contracts.
- Outputs: validated idempotent operations, typed errors, integration tests.
- Verification: unauthorized, cross-tenant, retries, malformed input and rate limits. Scripts are not configured; report unavailable checks honestly.
- Handoff: task/story IDs, exact files, branch/SHA, actual commands/results, risks, decisions and next owner via docs/ai/HANDOFF-TEMPLATE.md.
- Approval: no unilateral scope expansion, final design, remote push, merge, cloud/paid/destructive or production actions. Local edits/commits only within authorization; reviewers stay read-only. Escalate blocked contracts to coordinator.

Invariants: database-only MVP; account-free recipient access/verification; no wallet/crypto/bulk email; server/RLS tenant enforcement; immutable issuance with replacement; private assets/public allowlist. Issuer recognition is not accreditation. Tokens are proposals until human approval. No code/packages in initialization; no unassigned helpers.
