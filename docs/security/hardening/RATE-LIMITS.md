# Public rate-limit audit and decision proposal

Task `task_1ff7c1f17bdd`, 2026-11-18. Owner: dispatched rate worker. Independent coordinator review requested at handoff. Base: `bd640e4`; branch `jamesmikkorecario-dev/hardening-rate`. Scope: `app.rate_check`, `public.verify_credential`, `public.exchange_delivery`; actual migrations exercised through PGlite, no hosted operations.

## Findings

The existing fixed-minute global budgets remain 600 verification calls and 120 delivery exchanges. Both anonymous and authenticated callers share each budget. Neither RPC consumes caller headers as identity. Changing `X-Forwarded-For`, `X-Real-IP`, tokens or public IDs cannot create additional buckets or escape the shared budget. This prevents header-driven cardinality abuse but permits one caller to deny service to everyone until the next window. Separate endpoint buckets prevent verification from directly consuming delivery capacity.

Malformed, null and unknown inputs return SQL NULL after incrementing the counter, so normal committed RPC calls count unsuccessful guesses. Over-budget requests raise `VM:RATE_LIMITED` and roll back their increment; the counter remains at its limit and subsequent requests still fail. Retry detail is clamped to at least one second. Other statement failures and transaction rollbacks also undo admitted increments. This limiter is transactional, not a durable count of every attempted HTTP request. SQL cannot commit independently inside these RPC transactions. Do not replace NULL misses with exceptions or claim this implements upstream traffic control. Direct SQL transaction rollback is demonstrated by tests; arbitrary transaction control through PostgREST is not asserted.

Only two constant bucket keys are reachable through the public endpoints. API roles cannot read/write counters or execute the internal helper directly. Each active bucket adds at most one row per minute. Its first admitted insertion deletes windows older than one hour across both buckets. With ordinary forward-moving database time, active traffic leaves roughly an hour of rows (at most 122 minute/bucket entries); idle rows persist until traffic resumes. This is logical cardinality, not a disk-space guarantee: MVCC, WAL, vacuum, contention and execution costs remain operational concerns. Large payloads and repeated denied calls still consume transport/database resources. Fixed windows permit bursts across a minute boundary. One global row per endpoint serializes updates; PGlite tests do not establish production concurrency or throughput.

No new migration is justified: no proven local defect can safely solve the missing trusted-client boundary while preserving the public contracts and global safeguard. No lifetime, public fields, capacity limits, adapter behavior, grants or existing migrations changed. This is an audit with regression evidence, not a completed per-client abuse defense.

## Decision proposal (owner approval required before pilot)

| Option | Tradeoff / required approval |
| --- | --- |
| Keep global-only budgets temporarily | Smallest deployment; shared exhaustion and resource abuse remain. Requires explicit owner risk acceptance and capacity/availability expectations. |
| Trusted ingress limiter plus retained SQL global safeguard (recommended) | Define a proxy that overwrites client identity, blocks bypass to the RPC route and bounds key cardinality/retention. Requires architectural approval, free-tier feasibility, privacy/retention decision and measured per-client and global capacities. |
| Increase global budgets | May improve normal capacity but increases abuse allowance and does not isolate clients. Requires measured load and owner capacity decision; not a security fix. |

Vercel frontend hosting alone does not prevent direct Supabase RPC access. An Edge/proxy design must explain how clients are prevented from bypassing it and how trusted metadata reaches SQL; a caller-supplied header, even hashed, is insufficient. NAT/shared networks and IPv6 rotation need explicit fairness decisions. Do not add unbounded IP-keyed rows. Keep a bounded global guard even after client isolation. No new provider, deployment or paid resource is authorized by this recommendation.

## Handoff and verification

Ownership supersedes the generic handoff-template path: this report records its fields without editing unassigned docs. Acceptance covers committed misses, shared limit boundaries, exception rollback, explicit transaction rollback, spoofed headers, cleanup and direct permission denials against real migrations. Test inputs are synthetic. Hosted PostgREST/proxy behavior and concurrent real PostgreSQL load remain unverified. Coordinator must arrange independent review before integration; product owner must approve the ingress/capacity policy.

All checks ran locally with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set to empty strings before tests.

| Exact command | Observed result |
| --- | --- |
| `npm ci` | Passed; 290 packages installed; audit reported 12 high-severity vulnerabilities. No package changes made; dependency remediation belongs to coordinator. |
| `npx vitest run --config vitest.db.config.ts supabase/tests/public-rate-hardening.test.ts` | Passed: 1 file, 8 tests, 0 failures. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed. |

Full DB/unit suites, builds and browser suites were not run: this task requests focused checks once at end, with no browsers; no application or schema behavior changed. No remote commands, environment files, secrets or real recipient data were used. Changed paths: this report and `supabase/tests/public-rate-hardening.test.ts` only. No migration was created. Remaining risks: shared exhaustion, rollback/non-HTTP counting, boundary bursts, database contention and unmeasured provider resource limits. Review status: pending independent coordinator review.

### Review correction: task `task_52c6d0bbc281`

Review of `7f84927` identified minute-rollover sensitivity in the committed-miss and changing-header loops and a weak authorization assertion that accepted unrelated database failures. Those loops now assert `SUM(hits) GROUP BY bucket` across committed windows; the existing pinned transaction limit-boundary test retains its exact row assertion. Cleanup previously preserved the seeded delivery row across ordinary minute rollover, but its description as a *current* budget could become inaccurate; it now pins transaction time for setup, RPC and assertion with rollback in `finally`. Direct counter/helper denial assertions now require `/permission denied/` using the same pattern as existing authorization tests rather than accepting generic `DATABASE` errors.

Verification after all test fixes, run once with both Vite Supabase variables blank: `npx vitest run --config vitest.db.config.ts supabase/tests/public-rate-hardening.test.ts` passed 1 file, 8/8 tests, 0 failures (2.46 seconds). `git diff --check` passed before commit. Only this report and the assigned test changed; no hosted operations, package edits or schema changes. Independent re-review remains requested.
