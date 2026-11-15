# Hosting and Spend Guardrails

**Budget:** [e.g. strictly $0/month unless human explicitly approves spend].

- Inventory Vercel, Supabase and optional third-party project quotas, paid triggers, usage/cold-start limitations, expiration/inactivity behavior, and scaling costs.
- Verify **current provider pricing and fair-use/plan terms** before committing to a feature or architecture. Free-tier policies change.
- No billing details, upgrade, purchased domain, paid add-on, external API paid call, or irreversible cloud resource creation without written approval.
- Prefer resource-efficient queries, pagination, bounded uploads, rate limiting and image optimization.
- Configure usage alerts where offered, but do not assume every provider enforces a hard $0 limit.
- Pre-launch estimate: requests/user, DB/storage growth, egress, background jobs, authentication emails, external APIs.

**Escalation format:** action, provider, estimated ongoing and one-time cost, alternative, irreversible effects, requested approval.
