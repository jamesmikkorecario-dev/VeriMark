# Observability and Product Feedback

## Technical signals

Monitor deployment success, runtime errors, request failures and latency, auth failures, database slow queries, storage growth, quotas, and cost. Use minimal privacy-safe structured logs with correlation IDs; avoid logging credentials or PII.

## Product signals

Define events around value, not vanity: onboarding completed, first successful task, repeat successful task, task abandonment. Specify naming, consent/privacy basis, retention, and metric denominators. Do not fabricate usage data.

## Operational owner

| Signal | How measured | Threshold | Owner | Response |
| --- | --- | --- | --- | --- |
| critical journey failures | [source] | [threshold] | [name] | incident runbook |

Add dashboards only when their data and response plan are defined.
