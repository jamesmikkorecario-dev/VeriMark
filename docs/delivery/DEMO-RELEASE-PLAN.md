# Public portfolio demonstration — release plan

Status: **prepared, awaiting owner deployment approval**. Branch `wf/demo-release` (from `dev/full-stack-integration`). Nothing has been deployed, pushed or provisioned. Owner direction (2026-11-19): portfolio demonstration first, fictional data only, no paid infrastructure or purchased domain, real pilot later. Real-pilot privacy, retention, email and link-lifetime proposals stay documented and **not adopted** ([privacy proposals](../security/hardening/PRIVACY-DECISIONS.md), [pre-production assessment](../ai/handoffs/PREPRODUCTION-HARDENING-2026-11-18.md)).

## Architecture

A static React/Vite site on Vercel Hobby with **no backend**:

- The app already falls back to the in-browser demonstration adapter when no Supabase variables are set. `npm run build:demo` makes that a hard guarantee for the public build:
  - It builds with `VITE_DEMO_ONLY=true`, which compiles the Supabase adapter and client library out of the bundle. Only the two Supabase variables the app reads are referenced, so no other `VITE_*` variable is embedded in the bundle.
  - It refuses to start if any `VITE_*SUPABASE*` variable is set.
  - It runs the locked local TypeScript and Vite rather than `npx` downloads.
  - Afterwards it scans `dist/` and fails on Supabase-hosted URLs, Supabase API paths, project references, API keys, JWTs or client-library code. It cannot recognise a custom-domain Supabase URL by name; the compiled-out adapter is the primary guarantee.
  - `vercel.json` sets `installCommand: npm ci` and `buildCommand: npm run build:demo`, and a configuration test pins both. The browser CSP spec and the browser suite's dev server run in the same demo-only mode.
- All fictional state lives in each visitor's own browser tab (`sessionStorage`). Nothing is sent to or stored on a server, so there is no shared database to abuse, fill or leak, and no Supabase project is involved. Both existing projects (protected development and disposable test) stay untouched.
- Hosting: Vercel's free `*.vercel.app` subdomain; no domain purchase. Headers from `vercel.json`: strict CSP with no inline script/style, `no-store`, `no-referrer`, HSTS, framing denial, COOP/CORP same-origin and a restrictive Permissions-Policy.

## Demonstration content and accounts

- Seeded fictional organizations, people, records and five demo accounts (owner, issuer, viewer, platform admin, second organization). The sign-in page lists them and the shared demo password, and states that nothing is sent to a server and no email is delivered. Every workspace and record page carries a "Demonstration — fictional data" label.
- Full flows work in-browser: sign-in, organization review, template editing, single and CSV issuance with approval, public verification (valid / expired / revoked / replaced), revoke/replace, recipient links and PDF/QR certificates, activity and invitations. In the demonstration, "Open public page" opens in the same tab, because the demo state belongs to that tab.
- "Sign up" creates a fictional account in that browser tab only. There is no real registration: no server account and no email.
- Visitors could still type real names into issuance forms. That data never leaves their browser and is discarded when the tab closes, but the release should keep the visible "fictional data" notices. Optional hardening before release: add a sentence such as "Please use made-up names" to the issue form.

## Known demonstration limits (state these on the portfolio page)

- Seeded public verification links (fixed IDs in `src/lib/api/demo/state.ts`) work on any device, but always in their seeded state. Changes a visitor makes (new records, revocations, replacements, recipient links, QR codes for new records) exist only in that visitor's tab. A new tab, another browser or another device shows the seed: new records are "not found" and a seeded record the visitor revoked shows as valid again.
- Reloading keeps state within the tab.
- This demonstrates product flows and front-end security controls. It is not evidence of the hosted database's authorization rules; that evidence is the local PGlite suite and the disposable-project hosted runs.

## Security and abuse

- No server-side state, so the earlier P1 blockers (shared rate-limit exhaustion, public PII, retention, bearer-link lifetime, email) do not apply to this release. They apply to the later real pilot.
- Residual exposure: static asset bandwidth on Hobby (first 100 GB/month Fast Data Transfer). Vercel's default DDoS mitigation applies, and Attack Mode is available. No functions, edge middleware or image optimization are used.
- Dependency advisory `GHSA-fc5q-39xc-vjpf` affects development and build tooling only; the production-only audit is clean ([dependencies](../security/hardening/DEPENDENCIES.md)). Vercel installs with `npm ci` from the lockfile.
- Security reporting: the GitHub repository is public, and GitHub private vulnerability reporting is currently **disabled** (read-only API check, 2026-11-19). Recommended before release: enable it (a repository setting) and publish it in `SECURITY.md` after a test report ([procedure](../security/hardening/SECURITY-REPORTING.md)).
- CSP `connect-src` still lists `https://*.supabase.co` for the future pilot. Nothing in the demo bundle connects there; narrowing it is a pilot-phase task.

## Vercel Hobby eligibility

[Vercel Terms](https://vercel.com/legal/terms) §4: Hobby is for "personal or non-commercial use". A personal portfolio demonstration with fictional data and no paying users or business operator fits this. It would stop fitting if the deployment served an organization's real credentials, charged anyone, or was run for a business; that is the pilot-phase decision (D-012). §3: on Hobby, project content may be used for model training unless the owner opts out in Team settings. The content here is public code and fictional data, but the owner should decide on the opt-out. No account settings were read or changed.

## Release steps (each needs owner approval)

1. Merge `wf/demo-release` into `dev/full-stack-integration` (local).
2. Choose the deployment route:
   - **A. Git integration (recommended):** push a release branch (or `main` after the merge-to-main approval) to GitHub; import the repository in Vercel (Hobby, framework Vite). `vercel.json` supplies the install command, build command and output directory. Set **no** environment variables. Gives preview deployments and the CI workflow on push.
   - **B. Vercel CLI from a fresh clone:** `npx vercel` / `npx vercel --prod` (needs Vercel login). No GitHub push needed, but no CI run. Use a fresh clone, not a working checkout: the CLI uploads files that are only git-ignored (local `.env*`, `setup-inputs/`, test output), and the repository has no `.vercelignore`.
3. Choose the project name, which sets the `<name>.vercel.app` URL; availability can only be checked at creation.
4. Optional: enable GitHub private vulnerability reporting.
5. Smoke-check the live deployment: response headers on `/`, `/verify/<seeded id>`, `/app/credentials`, `/receive`, `/sign-in` and `/assets/*`. Then the demo flows in a browser (sign-in, issue, verify, revoke/replace, recipient link, PDF download, mobile navigation) with the console open for CSP violations. Then confirm no request goes to `supabase.co`.
6. Record the deployment URL, commit SHA and smoke evidence in a handoff.

Rollback: redeploy the previous deployment in Vercel (instant), or remove the project. No data migration is involved.

## Moving to the real pilot later

The demo-only build is deliberate and pinned. A real pilot needs an explicit change:

- set `buildCommand` back to `npm run build` and update the pinning test in `supabase/tests/http-security.test.ts`;
- set the pilot project's `VITE_SUPABASE_*` variables in the hosting environment;
- narrow CSP `connect-src` to that project's origin;
- resolve the deferred pilot decisions in the [pre-production assessment](../ai/handoffs/PREPRODUCTION-HARDENING-2026-11-18.md).

The Supabase adapter, database migrations and hosted test harness remain in the repository and keep their tests.
