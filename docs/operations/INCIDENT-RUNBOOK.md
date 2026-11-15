# VeriMark incident and maintenance runbook

Maintainer is provisional incident owner; contacts and coverage must be assigned before pilot. No incident tooling configured.

- SEV1: private evidence/recipient leak, tenant authorization bypass, false valid status, compromised issuance or irreversible record loss.
- SEV2: verification unavailable, issuance/download failures, paused backend or quota exhaustion.
- SEV3: localized recoverable presentation/usability issue without data exposure.

Record start time, safe symptom evidence, affected environment/SHA, severity and owner. Stop risky changes; preserve sanitized logs and immutable lifecycle history. Determine provider outage/pause versus app failure. Show unable to verify during outage; never manufacture valid/not-found status.

Contain affected capability using approved controls; human approval is required for production rollback, credential rotation, shared migrations or destructive recovery. Do not delete credentials/audit to conceal damage or enable public evidence access as a workaround. Escalate costs rather than auto-upgrading. External notifications require authorized owner and privacy review; do not send messages autonomously.

Recover using ../delivery/DEPLOYMENT-AND-ROLLBACK.md: compatible artifact/forward fix, separately approved restore, reconcile post-backup issuance. Verify synthetic public states, private access denial, cross-tenant isolation, revoked/replaced freshness and PDF/link access before resuming. Record recovery evidence, residual risk and human decision. Postmortem records impact, timeline, cause or unknowns, owners/deadlines and prevention tests without personal data.

Weekly pilot: quotas, failed verification and recovery/export freshness. Monthly: dependencies/advisories, issuer access review, privacy-safe logging, accessibility regression and backup restore exercise into isolated environment. Before each schema release: compatibility/restore drill and immutable snapshot check. Cadences/RPO/RTO are proposals requiring owner acceptance; no backups have been created or tested.
