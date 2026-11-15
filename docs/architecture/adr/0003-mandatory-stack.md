# ADR-0003 — Approved technology and budget constraints

- Status: Approved constraints by explicit user instruction, 2026-11-15. Detailed architecture remains proposed.
- Decision: React.js + TypeScript frontend, Vite build tool, Supabase backend, Supabase PostgreSQL database, Supabase Auth authentication, Vercel hosting/deployment, FREE TIERS ONLY.
- Conditional services: Supabase Storage is justified for private certificate/template/evidence assets; Edge Functions are justified for guarded public verification, private delivery and bounded PDF processing. Validate their free-tier feasibility before implementation/release claims.
- Exclusions: No Next.js, separate Node.js backend or additional cloud service without explicit new human approval. Local Node-based prototype generation/check scripts are development tools, not a hosted backend.
- Consequences: Stop affected release work if Vercel free-plan eligibility, Auth email delivery, recoverability or processing capacity cannot meet requirements. Do not substitute providers, add SMTP/cloud backup services or upgrade paid plans automatically. See COST-GUARDRAILS.md for researched vendor risks.
- Approval boundaries: This approves technology constraints only. Styling, color, typography, components and final visual direction remain open. No application implementation, provisioning, push or deployment is authorized.
- Supersedes: ADR-0001's option discussion is historical; alternatives are not authorized. Preserved setup inputs retain their original wording; this later explicit user decision governs the stack.
