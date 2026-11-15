# VeriMark performance and resilience

Proposed budgets, not measured results or an SLA. No app/harness exists; measurements are NOT CONFIGURED. Validate in a bounded pilot.

| Surface | Initial budget / measurement |
| --- | --- |
| Mobile public verification | LCP p75 <=2.5 s, CLS <=0.1, INP p75 <=200 ms when field data exists; lab is only a proxy |
| Lookup | Warm p95 <=1 s at 10 concurrent synthetic verifiers; report cold/paused startup separately |
| Initial verification JS | Proposed <=200 KiB compressed; lazy-load issuer/PDF tools; baseline after scaffold |
| CSV/PDF | Proposed pilot cap 150 rows/batch, 2 MiB CSV, 5 MiB/evidence object; reconcile canonical upload contracts before implementation |
| Issuer lists | 25-record pagination, indexed tenant/status/date queries, no unbounded exports or N+1 requests |

Record baseline/candidate SHA, browser/hardware/network, tool versions, data size, concurrency, cold/warm state and at least five lab runs (median/range). Report adequate load sample size for p95. Use 0/1/150 synthetic recipients and long names. No paid load generation or production stress tests. Downloads/exports must be bounded, cancellable and show progress/errors without duplicate issuance.

Offline, timeout, throttle and paused backend show unable to verify with safe retry. Never infer authenticity or invalidity from outage. Bounded read backoff; write retries require server idempotency. Revocation freshness takes priority over cached valid status; check canonical API cache contract. Leaks or misreported status block release regardless of speed. Quota responses: ../delivery/COST-GUARDRAILS.md.
