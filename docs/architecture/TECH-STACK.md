# VeriMark technology decisions

Status: core stack APPROVED by mandatory user update, 2026-11-15 (ADR-0003); supporting libraries and detailed design remain proposals. No application dependencies are installed. Product authority: `setup-inputs/PROJECT_DETAILS.md` and `docs/product/PRD.md`. Documentation authorization does not authorize scaffolding or deployment.

| Layer | Choice and purpose |
| --- | --- |
| Client | React + TypeScript + Vite SPA; public verification loads live status |
| UI | Tailwind CSS + shadcn/ui proposed; styling, typography, colors and components remain exploratory |
| Navigation | React Router |
| Server state | TanStack Query; invalidate after lifecycle changes; never treat cached verification as current |
| Forms | React Hook Form + Zod; repeat validation at trusted boundary |
| Identity | Supabase Auth |
| Data | Supabase PostgreSQL, constraints, RLS and transactional RPC |
| Trusted HTTP | Supabase Edge Functions; explicit actor and resource authorization |
| Files | Supabase Storage private buckets |
| PDF / QR | Evaluate pdf-lib and a maintained QR library during implementation; pin reviewed versions then |
| Hosting | Vercel static frontend, mandatory; separate Node.js backend prohibited without explicit approval |
| Verification | Vitest, React Testing Library, Playwright and local database authorization tests, proposed only |
| Repository | GitHub, short-lived branches into protected main; npm with lockfile when scaffolded |

## Constraints and trade-offs

Online database verification depends on platform availability. QR codes locate records; they do not prove the presented PDF matches those records or that achievement claims are true. No accreditation or cryptographic-signature claim in MVP. Wallets, portable signatures, multi-step approvals and bulk recipient email are deferred. Basic preview and explicit approval remain required.

FREE TIERS ONLY. No Next.js, separate Node.js backend or additional cloud service without explicit approval. Supabase Storage is justified for private assets; Edge Functions for guarded verification/delivery and bounded rendering, subject to free-tier feasibility. No provisioning is authorized. Vendor tier eligibility, limits, privacy law and brand clearance are owned by quality/delivery documentation, not assumed here. Region, retention periods, capacity targets, issuer-review policy, public name/sharing policy and approval separation of duties remain human decisions. Proposed technical bounds are in API-CONTRACTS.md and need pilot measurement; they are not vendor quotas.

Versions and CLI commands must be selected at scaffolding time; no runnable build, test or lint gate exists yet. See ADRs for trade-offs and SYSTEM-ARCHITECTURE.md for boundaries.
