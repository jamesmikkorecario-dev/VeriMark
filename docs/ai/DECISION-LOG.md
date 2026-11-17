# VeriMark decisions and assumptions

2026-11-15. Source: INIT-A assignment and preserved PROJECT_DETAILS. Working decisions are not implementation evidence. Architectural detail belongs in ADRs.

| ID | State | Decision / owner / revisit |
| --- | --- | --- |
| D-001 | Approved constraint | React/TypeScript + Vite, Supabase backend/PostgreSQL/Auth, Vercel, FREE TIERS ONLY; user mandatory update, ADR-0003. Storage/Edge justified only; no Next.js, separate Node backend or added cloud services without explicit approval. Supporting UI libraries and visuals remain proposals. |
| D-002 | Confirmed boundary | Database-only MVP; wallet, crypto, bulk email deferred; product owner |
| D-003 | Requirement | Account-free recipient access and verification; architect defines secure retrieval |
| D-004 | Requirement | Issued claims immutable; linked replacement with audit; database/backend |
| D-005 | Requirement | Private assets/public allowlist; security validates |
| D-006 | Approved provider, unresolved feasibility | Vercel mandatory; free-plan eligibility and recovery/email constraints must be resolved before rollout. No provisioning, substitution or paid upgrade authorized. |
| D-007 | Pending | Human design approval; no finalized tokens |
| D-008 | Verified local fact | No package.json at initial inspection; scripts not configured |
| D-009 | Unverified | Native adapter compatibility/loading/permissions; integration owner validates |
| D-010 | Open | Pilot organization and issuer-review operator/evidence; human product owner |
| D-011 | Open | Recipient token lifetime/recovery, display-name permission, retention/region; product/security before API/schema freeze |
| D-012 | Open | Budget, provider terms, domain/name clearance and deadline; human before public pilot |
| D-013 | Proposed | Revoked > replaced > expired > valid using database UTC; replacement withdraws original atomically; confirm before M04 |
| D-014 | Open proposal | Requirements name reviewer among organization roles. Proposed MVP grants owner/issuer/viewer only, reserves reviewer with no grants; human must confirm reviewer scope and self-approval vs distinct approver before M03/M04. No role removal is approved by this proposal. |

No adoption, accreditation, legal compliance or vendor capacity is certified. No approval is inferred from a proposal or elapsed time.

## Pre-production proposals — 2026-11-18

The development milestone `bd640e4` does not approve deployment or these recommendations. D-010–D-014 remain unresolved above; no public-field, expiry, retention or approval-role policy is adopted here.

- **D-010:** name the pilot issuer, review operator and private incident-response owner before real users participate.
- **D-011:** [privacy proposals P-01–P-05](../security/hardening/PRIVACY-DECISIONS.md) cover explicit publication of names/achievements, bearer expiry/recovery, PDF/log handling, retention/erasure and region. Recommended direction: separately authorized public projections and purpose-specific retention; exact defaults need approval.
- **D-012:** [strictly free pilot readiness](../delivery/FREE-PILOT-READINESS.md) covers provider eligibility, SMTP/domain dependencies, project-slot transition and no-billing gates. Approval of a provider name is not approval to provision or transmit personal data.
- **D-013:** [P-02 lineage disclosure](../security/hardening/PRIVACY-DECISIONS.md#p-02--proposed-lineage-disclosure-d-013) recommends public replaced status without automatic successor disclosure, pending owner approval; current precedence is unchanged.
- **D-014:** [P-06 operator boundaries](../security/hardening/PRIVACY-DECISIONS.md#p-06--proposed-approval-and-privacy-operator-boundaries-d-014) proposes distinct approval for sensitive publication/exceptional erasure; no reviewer grants or existing roles changed.
- **Abuse architecture:** [rate-limit decision proposal](../security/hardening/RATE-LIMITS.md) recommends trusted ingress with direct-RPC bypass prevention and retained global SQL limits. Capacity, identity trust and bounded privacy-aware retention require approval before implementation.
