# VeriMark free-tier and spend guardrails

Budget policy: free-tier first, $0 approved recurring spend. No billing details, upgrade, domain purchase, paid add-on, billable provisioning or cloud resource creation without human approval. No accounts/resources were inspected. Snapshot researched 2026-11-15 from primary vendor sources; recheck pricing, terms and dashboard quotas before any launch. Eligibility is unresolved, not legal advice.

| Vendor fact at research date | VeriMark implication / source |
| --- | --- |
| Supabase Free: 500 MB DB, 1 GB files, 50,000 MAU, 5 GB egress plus 5 GB cached egress; two active projects | Local development avoids multiplying hosted environments; PDF/evidence growth and repeat downloads consume quotas. [Pricing](https://supabase.com/pricing) |
| Low-activity Free projects may pause after seven days | Verification availability cannot be promised; outage shows unable to verify. No synthetic activity scheme to evade policy. [Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) |
| Supabase recommends Free users export data off-site; paid daily backups are plan dependent; DB backups omit Storage objects | Establish separate private object backup/restore and encrypted exports before real issuance. [Backups](https://supabase.com/docs/guides/platform/backups) |
| Default Auth SMTP only sends to project team addresses, currently two messages/hour, best effort without SLA | Real issuer onboarding/reset needs approved custom SMTP, with provider/domain/deliverability cost review; this is separate from deferred bulk credential mail. [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| Vercel Hobby is for personal non-commercial use | Do not assume student/organizational/potential SaaS use qualifies; owner reviews eligibility before connecting/deploying, selects eligible alternative or requests paid approval. [Pricing](https://vercel.com/pricing), [Terms](https://vercel.com/legal/terms) |
| Hobby includes 100 GB fast transfer, 10 GB origin transfer, 1M CDN requests, 4 CPU-hours and 1M function invocations; limits may cause waiting before service resumes | Static hosting still has quotas; monitor separately from Supabase egress. [Hobby plan](https://vercel.com/docs/plans/hobby) |

Paid upgrades can add compute, usage overages, seats and add-ons; do not treat subscription base price, alerts or a spend cap as a universal hard $0 guarantee. Future auth SMTP and backups may invalidate a zero-cost production assumption. Evaluate these before promising a real pilot. No automated bulk credential email MVP: downloadable PDFs and authorized recipient-link exports. Consider bounded on-demand PDFs instead of retaining every render; private evidence stays private.

## Proposed operating policies (not vendor limits or configured enforcement)

Ops owner reviews quotas weekly in pilot, daily after warning. At 50% of any included quota forecast runway; at 70% warn human; at 85% stop new bulk issuance, large uploads and optional exports until reviewed; at 95% freeze nonessential writes/download generation and investigate abuse while preserving status verification where feasible. No automatic paid upgrade. Record whether controls are manual or implemented before pilot; dashboards/alerts alone do not enforce caps.

Pilot caps proposed: one approved organization, 150 recipients/batch, 2 MiB CSV, 5 MiB/evidence object; align with canonical contracts before implementing. Preflight each batch using remaining quota and measured average sizes. Estimate DB rows+indexes+audit growth, evidence/PDF bytes, downloads x bytes, auth messages, Edge invocation volume, preview/build usage and off-site backup retention. Report estimates as assumptions until measured.

Escalation includes provider/action, current usage, one-time/recurring/overage cost, free alternative, privacy/irreversibility impact and requested approval. Stop on unknown eligibility, missing recovery, projected quota exhaustion or unavailable budget; never silently widen spend.
