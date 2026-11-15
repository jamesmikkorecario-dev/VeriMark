# ADR-0002 — Immutable issuance with transactional lifecycle and recoverable PDFs

- Status: Proposed implementation baseline, policy decisions explicitly pending.
- Date: 2026-11-15
- Context: Retries, concurrent edits and PDF failures must not duplicate issuance or silently change claims.
- Options: Mutable credential rows with synchronous batch rendering; immutable snapshots with atomic lifecycle RPC and separate bounded render jobs.
- Decision: Choose immutable snapshots, explicit basic approval of exact revision/digest, database transactions and idempotency receipts. Replacement issues a new identifier and preserves predecessor history. Revoke/replacement/expiry precedence uses server time. Render bounded leased jobs after issuance commit.
- Consequences: Durable recovery and auditable transitions require additional constraints/job state. Issued and PDF-ready are separate states. No multi-step review engine in MVP; self-approval policy remains unresolved. Worker execution feasibility must be measured before pilot.
- Revisit: Real batch/runtime measurements, approved multi-step approval or retention/erasure requirements incompatible with current data minimization.
- Related: INIT-B; BACKEND-DESIGN.md; DATA-MODEL.md; API-CONTRACTS.md.
