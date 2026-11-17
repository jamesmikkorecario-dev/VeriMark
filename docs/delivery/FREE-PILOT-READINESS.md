# Free pilot readiness

Assessment date: 2026-11-18. Status: **blocked pending owner decisions and observed operational evidence**. This document proposes D-012 options; it does not approve D-012, change its open/proposed state, or authorize provisioning, pausing, deletion, signups or deployment. Sources below are official pages observed on this date; re-check terms and quotas immediately before any approved pilot.

## Provider feasibility

| Boundary | Observed constraint | Consequence / owner gate |
| --- | --- | --- |
| Supabase Free | [Pricing](https://supabase.com/pricing) and [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq): two active Free projects; paused projects do not consume this quota. Pricing permits manual pause and multiple paused projects; inactivity can pause Free projects after a week. | The assessment records dev and disposable test projects; that is historical evidence, not a fresh remote inventory. A third simultaneously active Free production project cannot be assumed available. No uptime guarantee. |
| Vercel Hobby | [Terms section 4](https://vercel.com/legal/terms): personal or non-commercial use; [fair-use guidance](https://vercel.com/docs/limits/fair-use-guidelines) restricts Hobby to non-commercial personal use and directs uncertain users to support. | An educational/community issuer or absence of fees does not establish eligibility. Owner must document the actual operator, purpose and commercial connections and resolve ambiguity with Vercel before launch. Paid upgrade or platform substitution is not authorized. |
| Supabase Auth email | [Custom SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp): built-in sending is restricted to project-team addresses, currently two emails/hour; custom SMTP is supported, including on Free. | Default mail is not a public signup/recovery solution. Keep email confirmation enabled. SMTP configuration alone proves neither provider approval nor inbox delivery. |
| Candidate SMTP: Resend | [SMTP prerequisites](https://resend.com/docs/send-with-smtp) require a verified domain and API key. [Domain rules](https://resend.com/docs/dashboard/domains/introduction) require an owned domain rather than a shared/public domain. [Free quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits): 100/day and 3,000/month, sent and received combined. | A candidate for Auth transactional mail, not an approved service. Account acceptance, domain verification, sending permission and deliverability remain untested. No bulk credential email is added. |
| Web and email domains | Vercel [assigns a vercel.app deployment domain](https://vercel.com/docs/domains/working-with-domains). That gives a web origin, not ownership of the shared parent domain or DNS authority for email-provider verification. | Do not equate a free web subdomain with a usable SMTP identity. A donated/existing organization-owned domain or delegated subdomain may work only with DNS authority and provider acceptance. No free registrable domain, renewal, brand clearance or sender eligibility is promised. |

Inference: a zero-spend web demo is feasible locally, but a real free pilot may be blocked by Hobby eligibility or email-domain/provider eligibility. A free email quota does not solve domain control. Verify any proposed delegated subdomain with the provider and domain owner; do not use shared-domain testing senders for real recipient delivery.

The Vercel [terms](https://vercel.com/legal/terms) (last updated October 19, 2026), section 3, permit Hobby/trial content use and sharing for model training, with an opt-out through Team settings; section 10.1 requires proper consent for exposing personal data. Before production, the owner must review privacy/data-processing implications and document opt-out verification and required consent. No account setting was read or changed, and no consent is asserted; keep all pilot preparation data fictional until these and product/privacy decisions are accepted.

## D-012 proposal and evidence-preserving transition

Options: (A) remain local/demo while eligibility is unresolved, preserving isolation but offering no real pilot; (B) after separate owner approval, preserve test evidence and pause the disposable project to free an active slot for a separate pilot, preserving dev isolation but requiring tested export/restore and a plan for restoring test within the active-project cap; (C) reuse dev/test for real pilot data, reducing isolation and invalidating fixture assumptions; (D) delete test, losing easy recovery. Recommend A now and B only after all gates pass; do not recommend C or require D. D-012 remains proposed, not approved.

Before any approved transition: preserve sanitized hosted-run reports, exact migration/version inventory and fixture counts; owner arranges a secure export with recovery instructions and a restore rehearsal. Never commit raw dumps or secrets. Existing evidence in the RC assessment is retained. Name and independently verify the target project and protected dev exclusion immediately before an explicitly approved operation. Pausing has availability/recovery tradeoffs and is not a backup. No project was inspected remotely, modified, paused or deleted by this task.

## CI and browser evidence boundary

The assigned workflow runs on pull requests, selected branch pushes and manual dispatch, using a GitHub-hosted ephemeral Ubuntu runner, Node 22.14, pinned checkout/setup-node actions, contents-read permission and checkout credential persistence disabled. It uses no repository secrets, environment approval credentials, OIDC, Supabase CLI, hosted runner, deployment or artifact upload. Dependency/browser downloads need network access; local-only means the application/tests use demo data and in-process PGlite, not an offline supply-chain guarantee. Owner must confirm GitHub Actions free allowance/runner eligibility and budget settings before enabling; workflow presence does not prove a remote run or branch-protection requirement.

Commands: npm ci; npm run typecheck; npm run lint; npx vitest run; npm run test:db; npm run build; npx playwright install --with-deps chromium; npm run test:e2e -- --workers=2. Both VITE Supabase variables are explicitly blank. Negative authorization tests run through PGlite, not hosted Auth/PostgREST. The browser configuration uses Chromium at widths 320, 390, 440, 768, 1024, 1440 and 1920, with width-specific skips. Chromium emulation is not real-device, Safari, Firefox or screen-reader coverage. CI retries can hide first-attempt failures; reviewers must inspect flaky/retry summaries.

Optional nonblocking Firefox/WebKit matrix is deferred: merely installing those binaries or adding a matrix variable would still execute the hardcoded Chromium projects. A separately authorized config owner must add real browser projects, install each engine and establish results with two workers before an optional continue-on-error exploration job is useful. Do not claim either browser ran. Promote coverage to blocking only after failures are triaged; Chromium remains blocking. No shared Playwright config is changed here.

## Owner release gates

Resolve D-010 through D-014 and public data/retention/region choices; confirm pilot operator and provider eligibility; approve only free resources and DNS/provider changes; establish Auth signup/confirmation, recovery, invitation and redirect smoke evidence using synthetic accounts before real data; verify sending limits/failure handling and secret storage outside the frontend. Complete independent security review, rate-abuse/concurrency checks, restore rehearsal and the [private reporting activation test](../security/hardening/SECURITY-REPORTING.md). Explicit merge, push and deployment approvals remain separate. Local checks cannot close these gates.

## Scoped handoff and verification

Task task_7de1d8c30947; branch jamesmikkorecario-dev/hardening-ci; base bd640e4; owner: CI/readiness worker; independent review requested from coordinator at delivery. Acceptance: local-only least-privilege CI, two-worker Chromium and truthful provider/reporting gates. Paths: .github/workflows/pilot-validation.yml, docs/delivery/FREE-PILOT-READINESS.md, docs/security/hardening/SECURITY-REPORTING.md. This scoped record follows docs/ai/HANDOFF-TEMPLATE.md fields without editing an unowned shared template. No package, application, schema or policy-default changes. Actual command results are recorded below after execution; GitHub workflow execution and private-report activation are not performed.

| Actual command/check (local Windows, base bd640e4 plus assigned files) | Result |
| --- | --- |
| npm ci | Exit 0; 290 packages installed; audit reported 12 high-severity vulnerabilities. No audit fix or dependency changes made; release remains blocked pending owner review of dependency findings. |
| npm run typecheck; npm run lint | Both passed. |
| npx vitest run | 222 passed, 21 files. |
| npm run test:db | 176 passed, 11 files; includes negative authorization checks. |
| npm run build | Passed. |
| git diff --check | Passed. |
| git ls-remote for actions/checkout v4.2.2 and actions/setup-node v4.4.0 | Both tag SHAs match workflow pins. |
| YAML parser probes | Not available: Python absent; installed Node packages include neither yaml nor js-yaml. Manual workflow inspection performed; no actionlint or remote Actions execution claimed. |

Deviation: .github/workflows/README.md still has historical no-package/activation-warning text; this explicit workflow assignment supersedes that template stop rule. It was not edited because it is outside ownership. SECURITY.md also contains historical documentation-stage wording; updating the public policy after channel activation belongs to the coordinator/owner. Optional issue configuration omitted because no verified private destination exists. No hosted checks, browser matrix, deployment, provider activation or policy-default changes performed.

Local verification used blank VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before every test command. Linux browser provisioning (`npx playwright install --with-deps chromium`) was not run on this Windows worker; the browser suite uses its already available Chromium. Ubuntu provisioning and complete workflow semantics require the first owner-approved GitHub run. No remote run is implied by local success.

Additional command: `$env:LIVE_TARGET='demo'; $env:LIVE_PORT='3872'; npm run test:live` (with both VITE variables blank) passed: 22 passed, 12 by-design skipped, zero failed (1.7m), Chromium demo rehearsal only.

Local toolchain: Node v24.19.0, npm 11.17.0 on Windows; workflow uses Node 22.14.0 (meets package engines >=22.12). The Ubuntu/Node-22 combination is not established by these Windows results. Remaining risks include dependency audit findings, untested remote CI/Firefox/WebKit/device/assistive-technology behavior, unresolved D-012/email eligibility, and unactivated reporting/restore gates. Independent review is pending coordinator review before integration.

Coordinator dependency assessment (reported 2026-11-18, separate worker commit f3a09f6, DEPENDENCIES.md): the 12 high dev-tool findings propagate picomatch advisory GHSA-fc5q-39xc-vjpf; the assessed latest release has no fix. That worker reports a zero production-only audit, which does not clear the full audit or authorize acceptance. This CI workflow does not add an audit gate, override dependencies or suppress findings; green local-validation status is not a clean dependency audit or a release authorization. The known full-audit blocker remains visible until explicitly resolved or owner-reviewed under the release policy.

Final browser command: `$env:PLAYWRIGHT_PORT='3871'; npm run test:e2e -- --workers=2` (both VITE variables blank) passed: 283 passed, 459 width-specific skipped, zero failed, zero flaky (6.4m), local Chromium demo only.
