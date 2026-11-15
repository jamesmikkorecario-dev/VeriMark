# VeriMark observability

Planned signals only; no dashboards/alerts configured. Ops owner is the human project maintainer until explicitly assigned. Safe structured events include correlation ID, operation type, result category, duration, environment and artifact SHA. Do not log recipient names/emails, CSV rows, evidence/PDF content, credential or delivery URLs/tokens, auth headers, keys or raw request bodies. Minimize identifiers; aggregate product counts. Proposed technical log retention seven days requires privacy review.

| Signal | Proposed response threshold | Owner/action |
| --- | --- | --- |
| False valid status, private leak or tenant bypass | Any confirmed occurrence | Maintainer: SEV1, stop affected writes/access and seek approved containment |
| Verification/issuance failures | >5% for 5 min with >=20 requests, or two failed synthetic probes | Maintainer: inspect backend pause/provider failure, incident runbook |
| Verification latency | Warm p95 >1 s for 15 min, enough samples recorded | Maintainer: examine indexes/RLS, distinguish cold start |
| Storage/DB/egress/Auth/function quotas | 50/70/85/95% policy bands | Maintainer: COST-GUARDRAILS response; no upgrade |
| Issuance duplicates or untracked lifecycle changes | Any occurrence | Maintainer: stop issuance, preserve history, investigate |

Use approved synthetic records for public probes, never expose real recipient tokens in monitoring. Unknown/missing samples are not success. Pilot metrics: approved credentials issued (exclude seed), batch preparation-to-issuance duration, successful/failed verification counts and denominator, correction/error rate, and voluntary issuer feedback. Minimize collection and approve privacy/retention before analytics; do not fingerprint verifiers or publish recipient directories. Never fabricate adoption metrics.
