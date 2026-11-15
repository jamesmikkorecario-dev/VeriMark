# ADR-0001 — Online tenant-scoped credential authority

- Status: Proposed implementation baseline; documentation authorized for INIT-B.
- Date: 2026-11-15
- Deciders: Human project owner must accept implementation policy gates.
- Context: Small issuers need accountable issuance and account-free verification without a separate server fleet or portable-signature infrastructure.
- Options: React SPA with Supabase RLS/RPC/Edge; separate Express backend; SSR framework; portable signed credentials.
- Decision: Use TECH-STACK.md baseline, online authoritative database verification, tenant membership and separate platform review authority. Public verification uses a throttled allowlisted server endpoint with no anonymous base-table access. Account-free private delivery uses an independent secret capability.
- Consequences: Fewer services, but RLS, privileged actor checks and online availability are critical. QR alone does not authenticate document content. No wallet, crypto signing or bulk email in MVP. Public field consent, token lifetime and issuer suspension remain policy gates.
- Revisit: Measured SSR/discoverability need, unavailable hosting eligibility, proven runtime limits or approved portable credential requirements.
- Related: INIT-B; SYSTEM-ARCHITECTURE.md; API-CONTRACTS.md.
