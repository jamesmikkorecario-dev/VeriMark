# Credential privacy decisions — PROPOSED

2026-11-18; task `task_7d7525c777ca`; base `bd640e4`.
All recommendations below are **PROPOSED**, require explicit human product/security approval before real recipient data or public release, and do not change D-011, D-013 or D-014. No legal compliance conclusion is made. No policy or runtime change is delivered by this audit.

## Observed behavior and evidence

| Surface | Current implementation / privacy implication |
| --- | --- |
| Public comparison | `supabase/migrations/20261116000000_verimark_core.sql`, `verify_credential`: exact 22-character public ID returns recipient display name, title, achievement, issuer snapshot/review state, dates, status, checked time, proof type and successor public ID. No recipient permission flag exists. Names and free-text achievements may themselves be sensitive; withholding email alone does not anonymize records. Public IDs provide discovery resistance, not confidentiality. Revocation/expiry does not hide these fields. |
| Replacement lineage | `replace_credential` preserves the predecessor and publishes a successor reference through verification. Repeated successor lookups reveal the chain, including corrected names and achievements. Private reasons are excluded; hiding reasons does not hide the relationship. Status precedence remains revoked > replaced > expired > valid (D-013). |
| Delivery | `create_delivery_link` requires tenant owner/issuer, locks the credential, creates a 32-byte random capability, stores only its hash, sets 30-day expiry and revokes previous links. Revoke/replace invalidates existing capabilities. `exchange_delivery` is repeatable until expiry/revocation, returns one record plus template/signatory fields, and uses one indistinguishable null result for bad/expired/revoked links. This is a bearer capability, not proof of recipient identity and not a single-use exchange or a viewer session. |
| Fragment | `src/features/delivery/ReceivePage.tsx` reads the fragment in an effect, replaces the history URL before exchange, validates the 43-character token, retains it only in a ref for retry, and renders generic errors. Copy/share and PDF generation use the public URL. `src/app/RemountOnFragment.tsx` remounts on a second fragment. Reload after removal requires reopening the original link. No demonstrated delivery-code defect was found; no code changed. |
| Headers/cache | `vercel.json` configures no-referrer/no-store for receive/invite; page also temporarily sets referrer metadata. These are source configuration, not hosted evidence. Verify has no explicit no-store override. Static HTML caching and PostgREST JSON caching are separate boundaries; a static-route header alone cannot establish RPC cache behavior. Inspect actual responses before release. |
| Storage/logs | Delivery page has no local/session storage or console calls. Supabase adapter persists issuer Auth sessions; that is distinct from recipient delivery. Demo adapter persists fictional state (including recipient records, hashes and audit labels) in sessionStorage; it must not process real data. RPC exchanges carry the secret in request bodies visible to browser tools and potentially infrastructure logging. Frontend silence does not prove provider/APM/log redaction. Browser extensions, clipboard managers, original sharing channels and screenshots remain exposure paths. |
| PDF | `src/lib/certificate/render.ts` creates a local PDF with recipient/achievement, issuer/signatory and public verification QR/URL. `download.ts` uses a public-ID filename, a blob URL and scheduled revocation. No delivery token, email, private reason or internal audit field is intentionally embedded. No custom author/title metadata is set; installed pdf-lib initializes producer/creator and creation/modification timestamps (`PDFDocument.updateInfoDict`). Thus absence of custom metadata is not absence of metadata. Downloaded copies cannot be recalled by rotating a link. No stored PDFs/Storage/Edge runtime in ADR-0005. |
| Retention | No cleanup/erasure workflow. Names/contact data persist in batch rows and credentials; audit target labels duplicate names/titles, while events can contain private reasons. Idempotency receipts persist indefinitely. Immutable-content and append-only triggers intentionally block ordinary edits/deletes. Region, backup/log retention and support access are unconfirmed. |

## P-01 — PROPOSED public identity and achievement permission (D-011)

Options: (A) keep all current comparison fields public with a documented issuer authorization/recipient permission process; simple comparison, highest ongoing exposure; (B) separately control publication of display name and achievement using an approved per-record public projection; more implementation and verifier UX work, less exposure; (C) publish status/issuer only; lowest exposure but weak document comparison.

**Recommendation:** B, with explicit informed publication choice for both name and achievement, an agreed minimal comparison display, and withdrawal handling. Do not infer permission from credential issuance or possession of a link. Until approved and implemented, keep real personal data out. Avoid sensitive free-text achievement content and explain that anyone with the public URL can reshare it; no name search/directory/export is proposed.

Approval needed: product owner and privacy/security reviewer must define allowed fields, how permission is established (including recipients unable to consent independently), verifier messaging and default behavior. Migration implications: add versioned public-disclosure state/projection and authorization/permission evidence separate from the immutable issuance snapshot; update RPC allowlists, adapters, UI, notices and negative tests together. Existing records must not be presumed opted in; backfill requires approved handling. No update of historical snapshot names or digest is proposed.

## P-02 — PROPOSED lineage disclosure (D-013)

Options: (A) keep public successor IDs; convenient continuity but exposes corrections and links identities; (B) show replaced status without successor ID by default, allow a separately authorized successor reference; protects corrected identities, adds sharing friction; (C) remove public predecessor lookup entirely; strongest concealment, loses withdrawal/status evidence.

**Recommendation:** B while preserving private linked history and public replaced status. Evaluate P-01 for predecessors as well as successors: removing only the forward link leaves the original wrong name visible. Keep database UTC precedence unchanged pending D-013 approval.

Approval needed: owner decides continuity versus correction privacy, old-record display and whether any opt-in lineage is acceptable. Migration implications: change the public projection/RPC, DTO contract, demo parity and verification UI/tests; retain internal lineage FKs and audit events. Existing public references, screenshots and PDFs cannot be withdrawn from third parties. New IDs alone cannot erase a previously published relationship.

## P-03 — PROPOSED bearer lifetime, rotation and recovery (D-011)

Options: (A) approve current reusable 30-day capability; easiest retrieval, longest stolen-link window; (B) fixed shorter window (candidate seven days) with issuer regeneration; less exposure, more support; (C) single-use exchange into a separately scoped short session; smaller reuse window but mail scanners/retries, session revocation and account-free recovery need design.

**Recommendation:** B for a bounded pilot, with the exact duration explicitly chosen by the owner; seven days is a discussion candidate, not an adopted default. Keep hash-only storage, fragment transport, issuer-scoped regeneration and invalidation of old capabilities. Preserve account-free retrieval. Recovery should use an issuer's established identity/contact process, never public ID knowledge alone. Warn issuer that regeneration invalidates an earlier link and that the new URL grants access to anyone holding it. Do not claim rotation revokes already downloaded data.

Approval needed: product/security owner chooses duration, repeatability, recovery evidence and authorized recovery operators; disclose residual stolen-link risk. Migration implications: a new migration only (never edit applied migrations), synchronized demo constant, expiry tests and notices; explicitly decide whether existing capabilities keep their expiry or are shortened/revoked and plan recipient communication. C requires additional session schema and all-session invalidation; it is not delivered. No new duration or recovery endpoint is implemented here.

## P-04 — PROPOSED browser, PDF and observability minimization

Options: (A) retain current app behavior with operational review; (B) add explicit cross-layer redaction/cache controls and PDF metadata policy; (C) introduce analytics/tracking of recipient downloads; greater collection and no demonstrated need.

**Recommendation:** B. Keep bearer values out of storage, analytics, URLs other than the incoming fragment, document titles, error reports and PDF metadata. Configure RPC-body redaction and restricted log access; do not record token hashes for routine analytics. Request no-store for sensitive JSON and public verification status to limit stale/disclosed data, and verify actual hosting/API responses. Use aggregate counters without person-level tracking. Define PDF metadata as generic producer/creator only, with no recipient/email/token metadata; decide whether generation timestamps are necessary. Visible recipient fields remain personal data regardless of metadata policy. Explain local download/shared-device handling.

Approval needed: security/operations owner approves logging fields/access/retention and metadata requirements; product approves notice text. Migration implications: normally hosting/client/generator and diagnostics configuration plus PDF parse assertions, not issuance schema; any person-level telemetry needs separate approval. Third-party log defaults and cached/downloaded copies require operational review, not a claim of app-level erasure. No external services or shared files changed.

## P-05 — PROPOSED retention and erasure preserving audit integrity (D-011)

Options: (A) indefinite retention; easy replay/history, excessive duplicated personal data; (B) purpose-specific schedules and a separate restricted personal-data envelope, with a minimized immutable event ledger; bounded exposure but needs schema redesign and recovery procedures; (C) delete whole credentials and audit events on request; breaks accountability and may allow unsafe replay or hide revocations.

**Recommendation:** B. Owner must approve exact periods and review triggers for abandoned drafts/CSV rows, optional contact email, active credential snapshots, delivery hashes, idempotency receipts, reasons/audit labels, diagnostics and backups. Do not substitute token expiry for data retention. Minimize name/title duplication in future audit labels; prefer opaque IDs and structured action/reason categories. A pseudonymous ID, digest or linkage can remain identifying and is not automatically anonymous.

Erasure workflow proposal: authenticate requester through issuer-controlled evidence; inventory every linked copy; determine publication withdrawal, correction, erasure or restricted retention; check documented hold/appeal obligations with qualified privacy review; revoke delivery access and suppress approved public projection; purge eligible draft/contact data and derived copies; append a minimal erasure/restriction event with action, time, authority and opaque target, without copying erased data. Keep restricted historical claims only where an approved purpose requires them. If true deletion of immutable personal snapshots is required, design an expressly authorized maintenance path or future separated/encrypted data model rather than disabling triggers ad hoc. A new redaction event alone does not erase old labels, snapshots or reasons.

Preserve append-only lifecycle facts and replay safety: do not casually delete idempotency receipts then permit the same key to issue again; assess minimal tombstones/digests and an explicit replay horizon before pruning. Backup expiry must have an approved schedule and a restoration suppression ledger/process so deleted data is not silently reintroduced. Document residual copies on recipient devices and external sharing channels, backup/hold restrictions and request outcomes truthfully.

Approval needed: product/privacy/operations owners set purposes, periods, support access, holds, erasure exceptions, region/residency and backup policy before real data. Migration implications: classify existing personal columns and audit strings, separate projections/envelopes, introduce narrowly privileged audited maintenance and tested cleanup with tenant boundaries, define receipt replay behavior and restoration procedures. Restrict grants and test anonymous/wrong-role/cross-tenant denials. Backfill cannot silently rewrite issued snapshots; existing embedded PII may require an explicit exceptional migration approved by the owner. No cleanup job, deletion, region change or cryptographic-erasure claim is delivered.

## P-06 — PROPOSED approval and privacy operator boundaries (D-014)

Options: (A) retain owner/issuer self-approval and existing viewer reads; simplest, no second-person privacy check; (B) require a distinct approver for publication/recovery/exceptional erasure actions; reduces unilateral disclosure, more staffing; (C) build a full reviewer role now; wider authorization scope and outside this task.

**Recommendation:** B for sensitive publication and exceptional erasure, with scoped operator access; owner must decide whether issuance itself needs separate approval. Viewer audit-label visibility currently exposes names internally; review necessity rather than treating tenant membership as permission for every personal field. No reviewer role/grant or approval rule changed. Migration implications: synchronize policy, roles/RPC checks, restricted DTOs and negative authorization tests after D-014 is resolved; no existing role removed by proposal.

## Handoff (HANDOFF-TEMPLATE fields; kept here within assigned ownership)

- Status: ready for coordinator independent review; decisions remain pending.
- Owner: dispatched privacy worker; independent reviewer: coordinator to assign (no helper spawned).
- Goal/acceptance: audit specified privacy surfaces, propose explicit choices and migration consequences, narrowly fix demonstrated delivery defects only. No such defect demonstrated.
- Branch/worktree/base: `jamesmikkorecario-dev/hardening-privacy-codex`, `C:/Users/James/orca/workspaces/VeriMark/hardening-privacy-codex`, `bd640e4`; final commit sent separately.
- Changed path: only `docs/security/hardening/PRIVACY-DECISIONS.md`; no runtime/schema/API/env/dependency changes. Handoff embedded here because task ownership excludes the shared template and handoff directory.
- Inputs: README source matrix, PROJECT_DETAILS, PRD, AGENTS, M1 contract (historical scope superseded by explicit task), RC assessment, threat model, ADR-0005, decision log D-010–D-014 and source/tests cited above.

| Exact command | Actual result |
| --- | --- |
| `npm ci` | PASS: 290 packages added; audit reported 12 high vulnerabilities. No dependency changes/fixes attempted; coordinator dependency review needed. |
| `$env:VITE_SUPABASE_URL=''; $env:VITE_SUPABASE_PUBLISHABLE_KEY=''; npx vitest run src/features/delivery/ReceivePage.test.tsx src/app/RemountOnFragment.test.tsx src/app/RouteEffects.test.tsx src/lib/certificate/certificate.test.ts` | PASS: 4 files, 39 tests. Fragment stripping/remount, generic error/retry, public sharing and parseable PDF/QR behavior. Existing tests, no new runtime behavior. |
| `npm run test:db` (same shell, variables still blank) | PASS: 11 files, 176 tests in PGlite, including server/RLS negative authorization, public allowlist, hash-only links, rotation, expiry/revoke/replace invalidation and 30-day current-default assertion. Not hosted evidence. |
| typecheck / lint / build / browser / hosted | NOT RUN: documentation-only change; focused existing behavior and database evidence above. No browser proof needed, no remote operations permitted. |

Remaining risks: all proposed decisions require owner action; present public disclosure, reusable bearer access, downloaded copies, indefinite retained PII and unverified provider cache/log/backup behavior remain. No real data or deployment authorized. Coordinator should independently review this document and route proposals to product/privacy/security/operations owners before implementation; approval of this audit does not approve its policy recommendations.
