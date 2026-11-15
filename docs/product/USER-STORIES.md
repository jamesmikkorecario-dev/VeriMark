# VeriMark user stories

Stable IDs map one-to-one to FR IDs in PRD.md. All are planned/backlog, not verified. US-001 through US-008 are P0 product scope; US-009 is the approved-pilot gate. Dependencies refer to capabilities, not permission to implement out of roadmap order.

## US-001 ? Authorized issuer workspace

As a **owner**, I want to **register and manage an organization and scoped members**.

Priority: P0. Dependencies: none. Milestone: M03. Status: backlog.

Acceptance: An authenticated owner creates a workspace; an authorized platform operator records issuer-review evidence; owner/issuer/reviewer/viewer permissions are enforced server-side; cross-tenant and anonymous private access fail.

Verification evidence ID: EV-US-001; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-002 ? Prepare certificate template

As a **issuer**, I want to **prepare a reusable certificate without exposing private assets**.

Priority: P0. Dependencies: US-001. Milestone: M05. Status: backlog.

Acceptance: An authorized issuer saves and previews a validated template; unsupported files and unauthorized reads fail; used template content is snapshotted for issuance.

Verification evidence ID: EV-US-002; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-003 ? Issue one credential

As a **issuer**, I want to **approve a reviewed credential and produce a defensible record**.

Priority: P0. Dependencies: US-001, US-002. Milestone: M04. Status: backlog.

Acceptance: An approved organization issues validated data once despite retries; identifier is unpredictable; claims become immutable; audit records actor/action/time; unapproved organizations and unauthorized roles are denied.

Verification evidence ID: EV-US-003; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-004 ? Preview and issue CSV batch

As a **issuer**, I want to **issue validated recipient rows without hidden partial failure**.

Priority: P0. Dependencies: US-003. Milestone: M06. Status: backlog.

Acceptance: Import reports row-level errors and duplicates before approval; preview shows intended records; retry does not duplicate issuance; partial failure is explicit and recoverable; no formula execution or email delivery.

Verification evidence ID: EV-US-004; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-005 ? Receive PDF and share link

As a **recipient**, I want to **access my individual certificate without creating an account**.

Priority: P0. Dependencies: US-003. Milestone: M07. Status: backlog.

Acceptance: An intended recipient uses a guarded individual access link to view/download a private PDF with official QR URL; invalid/revoked access fails without exposing others; public verification ID alone does not grant private asset access.

Verification evidence ID: EV-US-005; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-006 ? Verify official details

As a **public verifier**, I want to **compare a presented certificate with issuer records without signing in**.

Priority: P0. Dependencies: US-003. Milestone: M04. Status: backlog.

Acceptance: QR URL or ID lookup returns only approved public fields and issuer trust explanation; valid/expired/revoked/not found/unable to verify are distinct; outage is not reported as not found; requests are throttled and directories unavailable.

Verification evidence ID: EV-US-006; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-007 ? Revoke or replace issuance

As a **authorized issuer**, I want to **correct or withdraw an issued credential accountably**.

Priority: P0. Dependencies: US-003, US-006. Milestone: M08. Status: backlog.

Acceptance: Server enforces role and organization; revocation creates audit event; replacement links old/new records without editing old claims; retries cannot create duplicate replacements; expiry and precedence follow agreed contract.

Verification evidence ID: EV-US-007; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-008 ? Inspect issuance history and usage

As a **owner or organization viewer**, I want to **understand issued records and operational outcomes**.

Priority: P0. Dependencies: US-003, US-006, US-007. Milestone: M09. Status: backlog.

Acceptance: Permitted members see paginated own-organization history and basic issued/revoked/verification counts; restricted actors and tenants are denied; metrics exclude private data and distinguish seeded/demo data.

Verification evidence ID: EV-US-008; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## US-009 ? Operate a bounded pilot

As a **platform operator**, I want to **evaluate a consented real-world workflow honestly**.

Priority: P0. Dependencies: US-001 through US-008. Milestone: M11. Status: backlog.

Acceptance: Named issuer permission, lawful data handling and review gates precede pilot; issuance timing, verification outcomes and corrections are measured; no seed record is represented as real adoption; deployment requires explicit approval.

Verification evidence ID: EV-US-009; future unit/contract/integration tests plus critical browser journey at an identified commit. Every private operation includes anonymous, wrong-role and cross-tenant denial. UI must support loading, empty, validation/error, success and unauthorized states, keyboard focus and narrow screens. Exact commands are not configured yet.

Design: proposed issuer/recipient/verifier screens in ../../docs/design/ and ../../prototypes/design/; human approval pending. No wallet, signing or bulk email.

## Future stories (P2)

US-101 optional recipient portfolio; US-102 signed portable standards-based credentials; US-103 external/LMS APIs; US-104 multi-step approvals; US-105 bulk email/provider delivery; US-106 advanced branding/analytics. All are deferred; require new acceptance, privacy/security assessment and explicit scope authorization before implementation.
