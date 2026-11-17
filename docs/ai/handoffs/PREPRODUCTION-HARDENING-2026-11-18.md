# Pre-production hardening — 2026-11-18

Status: **not approved for a public or real-person pilot**. Development milestone `bd640e4` is preserved. The candidate is assembled on retained branch `wf/pilot-hardening` in `pilot-hardening-integration`; the primary `main` checkout and the existing development/test worktrees are not modified. No cloud/database mutations, deployments, pushes, project changes, paid resources or workspace deletions are part of this task.

## Prioritized blockers

| Priority | Finding | Next action / approval |
|---|---|---|
| P1 pilot gate | Anonymous verify/delivery budgets are shared (600/120 per minute); one caller can exhaust everyone. Caller-controlled headers cannot provide trusted identity. | Approve an ingress architecture with direct-RPC bypass prevention, bounded per-client state and retained SQL ceiling; choose measured capacity/fairness. Do not merely hash spoofable IP headers or raise limits. [Rate audit](../../security/hardening/RATE-LIMITS.md). |
| P1 pilot gate | Public verification returns recipient name and achievement and links successor records; no publication-permission state exists. Revocation does not erase those fields. | Resolve D-011/D-013: separately authorized public projection, publication evidence/withdrawal, predecessor and successor handling. Until implemented, fictional records only. [Privacy P-01/P-02](../../security/hardening/PRIVACY-DECISIONS.md). |
| P1 pilot gate | No purpose-specific retention/erasure path; immutable snapshots, batch rows, audit labels, reasons and receipts duplicate PII. | Resolve retention/region/access/holds and replay-safe erasure design; no destructive cleanup or disabling immutable triggers by assumption. Privacy P-05. |
| P1 release gate | Private report channel and responsible responders are not activated/tested. | Select accountable owner/backup; authorize remote activation and external synthetic-report test before publishing a verified channel. [Reporting](../../security/hardening/SECURITY-REPORTING.md). |
| P1 feasibility gate | Real pilot email and Vercel Hobby eligibility are not established; free hosting subdomain does not confer an SMTP-verifiable sending domain. | Resolve D-010/D-012 with operator/purpose, domain/DNS authority, provider acceptance, delivery proof and no-billing limits. [Free readiness](../../delivery/FREE-PILOT-READINESS.md). |
| P2 engineering gate | Member-first writes could deadlock membership administration. Reproduced on real PostgreSQL; additive local migration fixes the demonstrated cycle. | Independently reviewed, local tests pass; applying migration to any hosted project still requires explicit approval. Broader concurrency schedules remain unexecuted. |
| P2 security gate | One unpatched picomatch ReDoS advisory propagates into 12 high dev-tool audit entries; production-only audit has zero findings. | Upstream patch plus verification or explicit exposure/risk decision; no force downgrades, suppression or inferred acceptance. [Dependency evidence](../../security/hardening/DEPENDENCIES.md). |
| P2 privacy gate | Delivery capability reusable for 30 days; downloaded PDFs cannot be recalled. | Owner chooses exact lifetime/recovery/rotation and existing-link treatment; shorter lifetime is proposed, not adopted. Privacy P-03/P-04. |
| P2 verification gate | CSP still permits inline styles required by existing previews; platform headers, RPC cache behavior and Firefox/WebKit/accessibility-device behavior unverified. | Static-style migration before removing exception; verify real hosting responses only after deployment approval. Chromium-only CI is not cross-browser proof. |

## Implemented local changes

- HTTP configuration: default `Cache-Control: no-store` and `Referrer-Policy: no-referrer` across frontend documents, preserving immutable hashed assets, framing/MIME/device restrictions, SPA routing and existing CSP functionality. Twenty-seven configuration assertions are not deployed CDN evidence.
- Database: new `20261118010000_concurrency_hardening.sql` acquires organization SHARE before membership SHARE in `app.require_role`. Existing applied migrations, grants, error policy and public contracts are unchanged. Authorization now follows the same organization-first order before writes can later acquire organization FK locks.
- Real local runner: `tools/test-concurrency.mjs` uses independent PostgreSQL clients and observer-confirmed blocking barriers, fresh synthetic databases and loopback-only runtime. Baseline produced `40P01`; fixed version allowed both operations to commit. Duplicate exact issue produced one credential/event/receipt; issuance waiting behind member removal was denied without effects. This proves three schedules, not all races.
- Rate and authorization regressions: eight additional real-schema cases, with aggregate cross-minute counts, pinned boundary/cleanup transactions and specific permission-denial assertions. Six sequential lifecycle/revision/authorization regressions explicitly do not claim concurrency proof.
- CI: least-privilege local-only validation workflow with pinned actions, no credential persistence, no hosted execution or deployment. Remote Actions execution remains unobserved; see readiness report for commands and prerequisites.
- Explicit PROPOSED decisions cover D-010–D-014, public projection/lineage, lifetime/recovery, logging/PDF metadata, retention/erasure and sensitive-action approvers. No business-policy choice was silently implemented.

## Independent review

- Rate review found two test defects (minute rollover and generic database-error assertions); worker fixed both; re-review found none remaining.
- HTTP review found no actionable issues; deployment/header/CSP limitations are explicit.
- Concurrency review inspected every `require_role` caller, including cap paths that take organization UPDATE before authorization: no introduced SHARE-to-UPDATE upgrade found. Grants/RLS preserved; fresh-database cleanup scoped correctly.
- Privacy report reviewed by coordinator: options stay proposed, consent is not inferred, hash/opaque IDs are not claimed anonymous, recipient downloaded copies and restoration risks are explicit.
- CI review and final integrated verification evidence are recorded in the completion section below when observed.

## Strictly free architecture and transition

React/Vite static frontend on an eligible Vercel Hobby `vercel.app` origin; separate Supabase Free pilot project using default `supabase.co` URL; custom SMTP only with an eligible free quota and an already controlled/donated acceptable sending domain. No free sender domain or eligibility is promised. Keep issuer confirmation enabled. No paid add-ons, service signups or provisioning were performed.

[Supabase Free](https://supabase.com/pricing) permits two **active** projects and multiple paused projects. Preserve sanitized reports/migration fingerprints/counts, securely export data if approved, and rehearse restoration before requesting a pause of disposable testing to free an active slot. Pausing is not backup and is NOT authorized here. Keep development protected and create a separately approved pilot project; do not repurpose fixture data as real pilot data. Deletion is unnecessary for this recommendation and remains separately forbidden.

[Vercel terms](https://vercel.com/legal/terms), sections 3/4/10, require eligibility and privacy review; Hobby/trial model-training opt-out should be verified before approved use. No account settings were read or changed. [Supabase default SMTP](https://supabase.com/docs/guides/auth/auth-smtp) is team-address-only and currently two messages/hour, not a production mail solution. Free quotas do not establish a sender-domain right, provider acceptance or reliable delivery.

## Next release steps and approvals

1. Review/approve the proposed abuse boundary, privacy/publication/lineage, retention, exact bearer lifetime/recovery, operator roles and provider-eligibility decisions; then implement the chosen contracts with coordinated migrations/adapters/UI/tests.
2. Authorize private reporting activation/test and a sending-domain/provider feasibility check separately; keep all preparation fictional until those gates close.
3. Expand local concurrent schedules and browser coverage; obtain upstream dependency remediation or explicitly review residual dev-tool exposure. Do not claim clean full audit.
4. Review this isolated candidate before integrating into `dev/full-stack-integration`, particularly its pre-existing `vercel.json` worktree state. No merge to `main` or push is authorized.
5. Only with separate exact-ref approvals: export/restore evidence, pause test, provision Free pilot, configure Auth/SMTP and apply specified migration set. Neither hosted project was contacted by this hardening task.
6. Actual deployment/runtime headers/mail/negative authorization smoke and public launch require their own release approval. A green local workflow is not launch permission.
