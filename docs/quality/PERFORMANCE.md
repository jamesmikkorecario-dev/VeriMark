# Performance and Reliability Targets

Define budgets from target device/network and user value, then measure. Suggested starting objectives (customize):

- LCP p75 ≤ 2.5 s on target devices/connections.
- CLS p75 ≤ 0.1; INP p75 ≤ 200 ms if measurable in real-user monitoring.
- JavaScript bundle: set a measured maximum after baseline; avoid unnecessary libraries.
- API latency: document p95 target per critical endpoint and expected load.
- Database queries: examine slow queries, indexes, pagination and RLS overhead.

## Verification

Record baseline vs candidate, test hardware/network, commit, data size, tool and result. Test empty and high-volume states. Avoid optimizing based on single unrepeatable runs.

## Resilience

Decide how the UI handles timeout, rate limiting, stale data, retries, duplicate submit, offline/reconnect, and failed background work. Define feature flags only when necessary.
