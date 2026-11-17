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
| P2 verification gate | Platform headers, Supabase RPC cache behavior and Firefox/WebKit/accessibility-device behavior unverified; CSP `connect-src` still allows any `*.supabase.co`. | Verify real hosting responses only after deployment approval; narrow `connect-src` to the production project origin once chosen. Chromium-only CI is not cross-browser proof. (The inline-style CSP exception was removed; see below.) |

## Implemented local changes

- HTTP configuration: default `Cache-Control: no-store` and `Referrer-Policy: no-referrer` across frontend documents, preserving immutable hashed assets and SPA routing. Follow-up: CSP is now strict (`style-src 'self'`, no `'unsafe-inline'` anywhere, `frame-src 'none'`, `upgrade-insecure-requests`), with `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy: same-origin` and a wider `Permissions-Policy`. The one markup-style write (`Navigation.tsx`) now uses CSSOM. Config assertions plus a production-build Chromium spec (`e2e/http-security.spec.ts`, zero CSP violations across all main flows) back this; neither is deployed CDN evidence.
- Demo/database parity: the demo adapter now withdraws recipient links on replacement, refuses links for replaced records, and keeps the issuer-name snapshot like the database. The shared demo/database/hosted scenario checks both link rules and failed against the previous demo adapter. Reported by the quota-interrupted privacy attempt (`jamesmikkorecario-dev/hardening-privacy`, `b0b088a`, retained, not merged; its alternative policy recommendations are available for the owner's comparison).
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

## Completion evidence

Candidate implementation merge: `f67da59` on `wf/pilot-hardening`, followed by documentation `8b06774`, demo parity fix `0238d60` and strict CSP `9809f0a`. `dev/full-stack-integration` remains at `bd640e4`; `main` remains protected. No existing worktree/branch was deleted or its uncommitted work incorporated.

| Observed check | Result |
|---|---|
| `npm run typecheck`; `npm run lint` | Passed initially and after final integration, with both Vite Supabase variables blank. |
| `npx vitest run` | 21 files, 222 unit/component tests passed. |
| `npm run test:db` after concurrency integration | 14 files, 217 database/security tests passed. |
| `npm run build` | Passed; production assets generated locally. |
| `PLAYWRIGHT_PORT=3671 npm run test:e2e -- --workers=2 --reporter=line` | 282 passed, **1 flaky**, 459 width-specific skips. Chromium initially failed `Page.captureScreenshot` at `e2e/motion.spec.ts:40`; the configured retry passed. No application assertion failed on that initial attempt. |
| `PLAYWRIGHT_PORT=3673 npm run test:e2e -- e2e/motion.spec.ts:33 --project=chromium-320 --grep '/workspace temporal' --workers=2 --retries=0 --output=test-results-motion-diagnostic --reporter=line` | Exact case passed once, no retries (4.9 seconds). Evidence supports intermittent capture/runtime instability, not proof that the cause is resolved. Diagnostic-only output removed; original run evidence retained by the session artifact. |
| `LIVE_PORT=3672 npm run test:live` | 22 passed, 12 by-design skips, demo-only; no hosted run. |
| Worker `node tools/test-concurrency.mjs <temporary-runtime> --expect-deadlock`, then after migration without the flag | Three barrier-controlled schedules passed in each mode on loopback PostgreSQL 18.6; baseline deadlock reproduced, fixed schedule committed. Cluster stopped; binaries/cluster/logs retained outside repository. |
| CI YAML parse + semantic checks in temporary external tooling | Passed; explicit demo live step, read-only permissions and pinned Node/actions verified. All 213 declared Node engine ranges accept Node 24.19.0. Ubuntu/GitHub execution remains unrun. |
| `omp-flow check-commits bd640e4..HEAD` at `f67da59` | 17 commits use configured Git identity; no AI attribution. |
| `omp-flow scan-diff bd640e4 HEAD` at `f67da59` | No high-confidence secrets. |

Follow-up round (parity fix `0238d60` and strict CSP `9809f0a`), Vite Supabase variables blank:

| Observed check | Result |
|---|---|
| `npx vitest run --config vitest.db.config.ts supabase/tests/parity.test.ts supabase/tests/adapter.test.ts` | 4 passed. The same parity test against the previous demo adapter failed on `linkAfterReplace` (`OK` vs `INVALID_TRANSITION`) and, after reordering to avoid masking, on `replacedLink` (`OK` vs `DELIVERY_UNAVAILABLE`). |
| `npx vitest run`; `npm run test:db`; `npm run build` | 223 unit/component passed; 217 database/security passed; build passed. |
| `npx playwright test e2e/http-security.spec.ts --project=chromium-1440 --retries=0` (after review fixes) | 4 passed: zero CSP violations under `style-src 'self'`; inline script, `<style>` and style attributes refused; CSSOM `cssText` allowed. |
| `npx playwright test e2e/navigation.spec.ts --workers=2 --retries=0` | 34 passed, 15 skipped, 0 failed (covers inline-style restoration). |
| `npm run test:e2e -- --workers=2` while other local browser checks ran concurrently | 283 passed, **4 flaky** (navigation resize 320, accessibility `/app/activity` and `/app/organization` 1440, motion 1440), 483 skips. |
| Same full suite rerun with no other load (`HTTP_SECURITY_PORT=3686 PLAYWRIGHT_PORT=3687`) | **287 passed, 0 failed, 0 flaky**, 483 width skips. The four flakes did not reproduce; consistent with load contention. The new spec adds an in-suite production build at 1440, which raises CPU load during that project. |
| `npm run test:live` | 22 passed, 12 by-design skips. |
| Independent reviews | Parity fix: no findings. Strict CSP (security reviewer): no P0–P2; P3-1 (force demo build env), P3-3 (probe `cssText`) and P3-4 (explicit priority checks) fixed; P3-2 (Supabase adapter under CSP with a mocked backend) remains open and documented. |

CI independent review found Node 22.14 incompatible with locked jsdom/undici engine requirements. Worker pinned Node 24.19.0, retained earlier evidence, and re-review found no actionable issue. No review findings remain unaddressed in delivered fixes; the explicitly listed architecture/privacy/deployment limitations remain blockers, not silently accepted risks.

Completed Orca agent terminals were released without deleting their worktrees or branches. Two Claude attempts hit the provider's weekly limit and were fenced and not retried; both later completed on their own (`b0b088a`, `d9db9e2`). Their branches and worktrees are retained unmerged: verified findings from them were ported (parity gaps, CSSOM finding, stricter headers, browser CSP spec) and weaker choices were not. The integration branch is explicitly retained; cleanup ran dry-run only. No services were provisioned and neither Supabase project was modified or tested during hardening.

Browser flake: `e2e/motion.spec.ts:33` (`/workspace temporal entrance`) flaked once in each of two full runs on this branch (Chromium `captureScreenshot` protocol error at 320; page-lifecycle error at 1024), passing on retry. Ten repeats per width with no retries: candidate 1 failure in 70 ("execution context was destroyed"), baseline `bd640e4` 0 in 70. That difference is not statistically meaningful; the errors are around the test's own reload rather than application assertions, and no candidate change touches motion or workspace UI. Recorded as an unresolved timing flake in the already-known unstable motion class, neither proven nor excluded as a regression.
