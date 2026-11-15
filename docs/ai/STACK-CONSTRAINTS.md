# Mandatory stack update ? 2026-11-15

Source: direct coordinator dispatch task_775d04d2074b. Supersedes earlier proposed-stack language in INIT-A without restarting its compliant work.

Approved mandatory stack: React.js + TypeScript, Vite, Supabase backend/PostgreSQL/Auth, and Vercel hosting, FREE TIERS ONLY. Supabase Storage and Edge Functions require a documented use-case justification. No Next.js, separate Node backend or extra cloud service without explicit approval. Styling, colors, typography and components remain exploratory; Tailwind/shadcn are not visual approval. React Router, TanStack Query, React Hook Form and Zod remain working implementation proposals. Stack approval does not authorize production features, packages, provisioning, pushes or deployment.

## Conflict register ? unverified provider capabilities

These are feasibility questions, not current provider quota or policy claims. No provider terms/pricing or installed service behavior was checked in this correction; consult current primary sources before launch. Do not substitute services or infer paid/external approval.

| Potential conflict | Required resolution / owner |
| --- | --- |
| Vercel free-plan eligibility for intended organizational/commercial pilot | Human/coordinator checks current Vercel terms against intended use; if ineligible, report blocker rather than selecting another host or upgrading |
| Supabase Auth signup/recovery email delivery and SMTP requirements | Architect/operator checks free built-in delivery suitability and recipient restrictions; external SMTP is an extra service needing explicit approval, paid delivery conflicts with free-only constraint |
| Backup/restore retention and recovery promises | Database/DevOps validates free-plan recovery capabilities and proposes an approved local recovery rehearsal; external backup cloud or paid backup plan is not authorized; unresolved recovery requirements block launch claims |
| Storage for private templates/PDFs | Justify private persistence versus approved alternatives within Supabase; validate access controls, capacity and retention before implementation; no extra storage provider |
| Edge Functions for privileged issuance/PDF/public throttling | Justify each function where Postgres/RPC cannot safely satisfy requirements; validate free-tier execution limits; no separate Node server or extra cloud compute |
| Free-tier capacity, regions and inactivity/availability | Define bounded workload and service expectations after current primary-source checks; do not promise free unlimited or production SLA |

Primary sources to consult before service decisions: https://vercel.com/docs/plans/hobby, https://vercel.com/legal/terms, https://supabase.com/pricing, https://supabase.com/docs/guides/auth/auth-smtp, https://supabase.com/docs/guides/platform/backups. Links are research starting points, not verified supporting evidence in this task.

The coordinator owns canonical architecture/delivery reconciliation. Prior role guides read AGENTS.md and inherit this constraint; eligibility maps do not authorize implementation or provisioning. Design remains exploratory; no approval inferred from mandatory stack selection.
