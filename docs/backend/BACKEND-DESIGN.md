# VeriMark backend domain design

Proposed contracts only. Exact transports and failures: `docs/architecture/API-CONTRACTS.md`; persistence invariants: `docs/database/DATA-MODEL.md`.

## Issuance transaction

Actor -> trusted input validation -> current membership and organization review check -> locked batch/revision/approval check -> immutable credential snapshots and lifecycle events -> PDF job creation -> audit and idempotency receipt -> commit -> response. Never issue once per browser retry without a stable idempotency key. CSV row validation must complete before approval; invalid batches cannot partially issue. Single issuance uses the same pipeline with one row.

Lock ordering is organization, membership, batch, then credential IDs sorted consistently. Membership removal, owner transfer and issuer suspension must participate in compatible locking so authorization cannot race issuance. Compare expected_revision for edits and expected_version for lifecycle mutations. Unique constraints are the final duplicate guard; roll back all domain writes on failure. Store the normalized request digest with operation/tenant/actor/idempotency key; same key and different request is conflict. Receipt and domain rows commit together.

Approval records actor, timestamp, normalized preview digest and revision. Editing any recipient, public field or template invalidates approval. MVP requires one explicit approval step; whether self-approval is allowed is unresolved and must be chosen before issuance implementation. Reviewer role and multi-step approval are future extensions, not prerequisites for the basic MVP workflow.

## PDF recovery

Proposed app limits: at most 200 CSV rows, 2 MiB CSV, 5 MiB validated asset, one PDF per render attempt; three attempts before failed/manual retry. These are tunable design bounds, not verified provider limits. Use database-backed job leases, attempt counters, next_attempt_at and bounded exponential backoff with jitter. A crash releases work through lease expiry; a fencing token prevents an expired worker from finalizing a newer claim. Never require an Edge invocation to remain alive after its response.

Render from immutable versioned snapshot and pinned template asset/hash; server generates official-origin QR. Deterministic unique object path per credential/render version; upload privately, verify checksum/size then atomically mark ready if lease still valid. Orphan uploads are reconciled by a bounded maintenance operation. A failed PDF leaves credential verification intact, displays pdf_failed and allows authorized retry of that job only. Poll bounded progress pages; no silent automatic reissuance. Runtime budgets, invocation scheduling and real batch performance require a disposable-environment spike before pilot; no provisioned queue/cron is claimed.

## Files and integrations

Use private buckets for PDFs, evidence and template assets. Validate MIME, magic bytes, decoded image dimensions, size and normalized path; disallow active HTML/SVG and external template URLs in MVP. Do not fetch arbitrary URLs (SSRF). Evidence content does not enter public DTOs or PDFs. Restrict upload permissions and finalize metadata only after validation. No arbitrary client overwrite of final PDF objects.

Manual distribution uses protected generation/exports of recipient-specific delivery links; this is sensitive access material. Since only token hashes persist, later re-export regenerates and revokes previous capabilities with explicit issuer confirmation; original secrets cannot be retrieved. No bulk email, payment, signing-key service or public integration API in MVP. Auth email configuration is a separate release dependency. Structured operational logs contain request ID, safe error code, actor ID when appropriate and counters; never recipient rows, tokens, file URLs or secrets. Audit records are separate durable transaction data, not console logs.
