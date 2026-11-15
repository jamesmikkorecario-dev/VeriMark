# Incident Response / Maintenance

## Severity

- SEV1: privacy/security exposure, widespread outage, irreversible data risk.
- SEV2: major feature failure or high error rate.
- SEV3: localized, recoverable defect.

## Response

1. Identify owner, impact, start time, severity; stop risky changes.
2. Preserve evidence without secrets; confirm known-good deployment and DB state.
3. Contain: disable affected capability, revoke exposed credential *with authorization*, or roll back code safely.
4. Communicate status and user impact; escalate if third-party incident.
5. Verify recovery with primary journey and negative authorization checks.
6. Write a factual blameless postmortem: timeline, root cause (or unknown), action owners, prevention tests, follow-up deadline.

## Maintenance cadence

Monthly dependencies/security/quotas, periodic backup restore exercises, accessibility regression, user-feedback review. Set cadence based on risk and actual users.
