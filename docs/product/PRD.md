# VeriMark product requirements

Status: initialization draft, 2026-11-15. Product decision owner: human project owner (name not supplied). Primary requirements: ../../setup-inputs/PROJECT_DETAILS.md, read completely; explicit user decisions prevail over generic setup prompts; derived proposals never override the primary product input. This document describes planned behavior, not shipped functionality or validated demand.

## Problem and hypothesis

Small student organizations, university departments, training providers and community groups issue editable PDFs and maintain fragmented spreadsheets. Manual verification requires contacting officers; recipients struggle to retrieve/share achievements. These pains are supplied product hypotheses, not completed interview findings.

If authorized organizations can issue identifiable, auditable records and verifiers can compare official attributes without an account, then administrative work and verification friction should fall. Validate this with one willing issuer before expansion. VeriMark recognizes issuance/status under its records and controls; it does not accredit organizations or independently prove achievement quality. QR codes are links, not proofs; a genuine QR can be pasted onto a forged certificate.

## Personas and journeys

| ID | Persona / context | Job / accessibility and privacy needs |
| --- | --- | --- |
| P-01 | Student-organization officer / small issuer | Review organization, prepare template and recipient data, preview, approve, issue, export links; clear errors and keyboard/mobile use |
| P-02 | Recipient / student or trainee | Retrieve an individual credential and PDF without signup, share verification, contact issuer for correction; no public email/student number |
| P-03 | Employer/recruiter/administrator | Scan QR or enter ID, compare official fields, understand status/trust level without registration; fast readable mobile states |
| P-04 | Owner/reviewer/viewer | Manage scoped membership, audit issuance and withdraw/replace mistakes; permissions explained, enforced server-side |
| P-05 | Platform review operator | Record issuer identity/authority review and handle abuse; reviewed status must explain limits, not imply accreditation |

Main journey: issuer registration ? authority review ? scoped members/template ? single or CSV validation/preview ? guarded issuance ? private PDF and recipient links ? account-free recipient retrieval ? public comparison/status ? expiry/revocation or tracked replacement ? audit.

## MVP requirements

All are P0 unless noted; detailed acceptance and dependencies are in USER-STORIES.md.

| Requirement | Story | Planned result |
| --- | --- | --- |
| FR-001 | US-001 | Authorized issuer workspace |
| FR-002 | US-002 | Prepare certificate template |
| FR-003 | US-003 | Issue one credential |
| FR-004 | US-004 | Preview and issue CSV batch |
| FR-005 | US-005 | Receive PDF and share link |
| FR-006 | US-006 | Verify official details |
| FR-007 | US-007 | Revoke or replace issuance |
| FR-008 | US-008 | Inspect issuance history and usage |
| FR-009 | US-009 | Operate a bounded pilot |

MVP includes accessible responsive navigation, Supabase authentication for issuer staff, organization registration and authority review, owner/issuer/viewer roles under the proposed least-privilege matrix; reviewer remains a reserved role with no grants pending D-014, at least one template, single/CSV issuance, unpredictable IDs, PDFs/QR links, account-free recipient retrieval/verification, expiry/revocation/replacement, history/basic metrics and security tests. Formal multi-step approvals are future; basic review/confirmation before issuance is MVP.

## Security, privacy and lifecycle acceptance

Issued content is immutable; correction creates a linked replacement with protected audit events. Server/database operations enforce organization/role checks, idempotency and valid transitions. No anonymous access to tenant tables or asset buckets. Template assets, evidence and PDFs remain private, accessed through authorized short-lived delivery. Public allowlist proposal: credential ID, title/achievement, permitted recipient display name, issuer display identity/review explanation, issue/expiry dates, lifecycle status and limited replacement reference. Confirm display-name permission and replacement disclosure before schema freeze. Never expose emails, student IDs, birthdates, private reasons/evidence, directories or internal audit details.

Public outcomes: valid, expired, revoked, replaced, not found, unable to verify. Replaced is the proposed explicit presentation of the required replacement lifecycle, subject to D-013. Service failure must remain distinguishable from missing records. Public endpoint uses exact lookup, throttling and unpredictable IDs, not browse/search-by-person. Proposed precedence is revoked > replaced > expired > valid, using database time; confirm D-013 before implementation.

Target WCAG 2.2 AA, semantic keyboard/focus patterns, readable mobile layouts and explicit loading/empty/error/success/unauthorized states; target is not a compliance claim. Security gates include anonymous, wrong-role and cross-tenant database/storage denial tests. No performance/SLA promises yet: M01 defines representative batch sizes and baseline budgets; M10 measures them. No production reliability or unlimited free-tier promise.

Minimize collected data and logs. Retention, access-token recovery/lifetime, region, incident contacts and privacy notice require product/security decisions. Relevant Philippine privacy obligations need qualified review before real data; this is not a legal compliance finding. Vercel and Supabase are proposals subject to current terms and explicit approval before provisioning.

## Future scope and non-goals

P2: optional recipient wallet/accounts; signed portable credentials and W3C/Open Badges research; LMS/external APIs; multi-step approval; advanced analytics/branding; sophisticated correction/dispute processes; bulk email after provider/budget review. No payments, blockchain or accreditation service in MVP. No signing-key infrastructure in database-only MVP.

## Validation and launch evidence

| Measure | Definition / collection plan |
| --- | --- |
| Batch effort | Minutes from validated list ready to approved issuance; compare issuer's existing workflow with same agreed batch size |
| Verification reliability | Successful completed checks / attempts, with outages and unknown IDs counted separately; minimize identifying logs |
| Data quality | Issuance errors, corrections/replacements and revocations per issued credential; record reason categories privately |
| Usability | Observed completion of issuer/recipient/verifier tasks and consented feedback; no invented satisfaction targets |
| Adoption | Real authorized organizations and genuine issued credentials counted separately from fixtures |

MVP acceptance: an approved issuer issues and delivers a real guarded credential; recipient retrieves without signup; verifier compares official fields/status without signup; issuer revokes/replaces with an audit trail; unauthorized tenants/roles cannot access records/assets; configured E2E/security gates pass on an identified release. Production/pilot release additionally requires explicit approval and observed smoke evidence.

Open decisions: D-007 and D-010 through D-013 in ../ai/DECISION-LOG.md. Deadlines, pilot partner and measured baselines are unknown. No demand, competitor gap, trademark clearance or provider eligibility is asserted.
