# VeriMark decisions and assumptions

2026-11-15. Source: INIT-A assignment and preserved PROJECT_DETAILS. Working decisions are not implementation evidence. Architectural detail belongs in ADRs.

| ID | State | Decision / owner / revisit |
| --- | --- | --- |
| D-001 | Working | React/TS/Vite, Tailwind/shadcn, Router, Query, RHF/Zod; Supabase RLS/Edge/RPC; architect reconciles stack before scaffold |
| D-002 | Confirmed boundary | Database-only MVP; wallet, crypto, bulk email deferred; product owner |
| D-003 | Requirement | Account-free recipient access and verification; architect defines secure retrieval |
| D-004 | Requirement | Issued claims immutable; linked replacement with audit; database/backend |
| D-005 | Requirement | Private assets/public allowlist; security validates |
| D-006 | Proposed | Vercel; no provisioning/eligibility verification; human before launch |
| D-007 | Pending | Human design approval; no finalized tokens |
| D-008 | Verified local fact | No package.json at initial inspection; scripts not configured |
| D-009 | Unverified | Native adapter compatibility/loading/permissions; integration owner validates |
| D-010 | Open | Pilot organization and issuer-review operator/evidence; human product owner |
| D-011 | Open | Recipient token lifetime/recovery, display-name permission, retention/region; product/security before API/schema freeze |
| D-012 | Open | Budget, provider terms, domain/name clearance and deadline; human before public pilot |
| D-013 | Proposed | Revoked > replaced > expired > valid using database UTC; replacement withdraws original atomically; confirm before M04 |
| D-014 | Open proposal | Requirements name reviewer among organization roles. Proposed MVP grants owner/issuer/viewer only, reserves reviewer with no grants; human must confirm reviewer scope and self-approval vs distinct approver before M03/M04. No role removal is approved by this proposal. |

No adoption, accreditation, legal compliance or vendor capacity is certified. No approval is inferred from a proposal or elapsed time.
