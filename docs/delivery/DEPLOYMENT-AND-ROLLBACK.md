# VeriMark release and recovery

No deployment is authorized or verified. Release owner records approver, UTC time, commit/artifact SHA, environment, migration IDs, checks, backup reference and recovery owner.

## Preflight

1. Independent review and configured static, RLS-negative, lifecycle, E2E, a11y/visual/performance gates pass.
2. Privacy review, legitimate issuer/pilot permissions, limited public fields, retention/correction process and database-only verification wording are accepted. Do not infer accreditation or legal compliance.
3. COST-GUARDRAILS eligibility/quotas, production branch/automatic deploy triggers, env/callback isolation and safe logs are confirmed.
4. Encrypt off-site DB exports and private Storage objects separately with restricted access. Restore into isolated environment before real issuance. Proposed pilot RPO 24 h/RTO 1 working day need human acceptance; free availability is not guaranteed.
5. Record explicit production authorization; local commits never imply remote push/merge/deploy approval.

## Rollout and smoke

Approved additive schema precedes compatible app release. Published migrations are immutable; correct them with new migrations. Preserve issued snapshots, IDs, replacement links, lifecycle/audit events and status semantics across old/new versions. Delay destructive contraction until compatibility window and approved recovery plan.

After authorized release verify sign-in, synthetic approved-issuer issuance, PDF/QR, recipient-link export, public status, revoke/replace, cross-tenant denial and private evidence denial. Production probes need approved synthetic fixtures. Record deployment URL/result, status freshness and safe errors; release owner monitors at least 30 minutes.

## Recovery

Any leak, tenant bypass, duplicate issuance or false valid status blocks release and triggers incident response immediately. Proposed reliability trigger: >5% critical request failures for 5 minutes with >=20 requests, or two consecutive synthetic verification failures; no traffic does not prove recovery.

Human approves production rollback/promotion after confirming previous artifact works with current schema/API. Frontend rollback never undoes data/migrations. Prefer compatible forward fix; never erase legitimate issuance/revocation events to recover code. DB restore is exceptional approved recovery: reconcile post-backup issuance and preserve evidence/status before reopening writes. Repeat smoke/negative checks and record recovery/follow-up.
