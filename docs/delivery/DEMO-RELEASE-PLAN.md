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
- Security reporting: GitHub private vulnerability reporting was enabled on 2026-11-19 (API `PUT`, confirmed `enabled: true` by a separate read) and is published in `SECURITY.md`. The end-to-end test report from a non-maintainer account is still pending; it is a gate for the real pilot, not for this fictional-data demo.
- CSP `connect-src` still lists `https://*.supabase.co` for the future pilot. Nothing in the demo bundle connects there; narrowing it is a pilot-phase task.

## Vercel Hobby eligibility

[Vercel Terms](https://vercel.com/legal/terms) §4: Hobby is for "personal or non-commercial use". A personal portfolio demonstration with fictional data and no paying users or business operator fits this. It would stop fitting if the deployment served an organization's real credentials, charged anyone, or was run for a business; that is the pilot-phase decision (D-012). On Hobby, AI model training on project code is **on by default**. The [opt-out](https://vercel.com/changelog/updates-to-terms-of-service-march-2026) is a dashboard toggle (Team Settings → Data Preferences, with per-project overrides); no API for it is documented. The owner chose to opt out; it must be set in the dashboard by the account owner **before importing**, because opting out is not retroactive.

## Release sequence (route A: GitHub + Vercel Hobby)

Vercel deploys the production branch (the repository default, `main`) **as soon as the project is imported**. `origin/main` is still the init commit `197711b`, which has no app and no `vercel.json`: imported now, Vercel would publish those repository files as a bare static site without the security headers. So `main` must hold the release commit before Vercel ever sees the repository. Each step needs the owner's release approval.

1. Merge `wf/demo-release` into `dev/full-stack-integration` (local). Done: `19b734a`.
2. First Ubuntu CI run without touching `main`: `git push origin 19b734a:refs/heads/dev/full-stack-integration`. Wait for **Pilot validation** to pass, and fix forward if it fails. It has never run on Linux.
3. Fast-forward `main` to the release commit: `git push origin 19b734a:refs/heads/main` (no `--force`; it is rejected if `origin/main` moved). Confirm with `git ls-remote origin main`. CI runs again on `main`.
4. In Vercel (Hobby): opt out of AI model training (Team Settings → Data Preferences) first. Then import `jamesmikkorecario-dev/VeriMark` as project `verimark-demo`:
   - root directory `./`, framework Vite, production branch `main`;
   - **no environment variables** (`build:demo` refuses any `VITE_*SUPABASE*` variable, so a mistake fails the build instead of shipping);
   - no paid add-ons.

   `vercel.json` supplies `npm ci`, `npm run build:demo` and `dist`. `verimark-demo.vercel.app` returned `DEPLOYMENT_NOT_FOUND` on 2026-11-19; if the name is taken, use `verimark-portfolio`, which also returned `DEPLOYMENT_NOT_FOUND`.
5. In the first build log, confirm `npm ci`, `npm run build:demo` and the line `build:demo: N files in dist/, demonstration adapter only…`.
6. Smoke-check the live deployment: response headers on `/`, `/verify/<seeded id>`, `/app/credentials`, `/receive`, `/sign-in` and `/assets/*`. Then the demo flows in a browser (sign-in, issue, verify, revoke/replace, recipient link, PDF download, mobile navigation) with the console open for CSP violations. Then confirm no request leaves the site's own origin.
7. Record the deployment URL, commit SHA and smoke evidence in a handoff, and update `README.md` (it still says nothing is deployed).
8. Optional afterwards: protect `main` and require the Pilot validation check.

Do not push a separate release branch and change Vercel's production branch afterwards: by then the import has already deployed the old `main`. Route B (Vercel CLI) is not selected. If it is ever used, run it from a fresh clone, because the CLI uploads git-ignored local files such as `.env*`, `dist/` and `test-results-live/`.

Rollback: redeploy the previous deployment in Vercel (instant), or remove the project. No data migration is involved.

## Moving to the real pilot later

The demo-only build is deliberate and pinned. A real pilot needs an explicit change:

- set `buildCommand` back to `npm run build` and update the pinning test in `supabase/tests/http-security.test.ts`;
- set the pilot project's `VITE_SUPABASE_*` variables in the hosting environment;
- narrow CSP `connect-src` to that project's origin;
- resolve the deferred pilot decisions in the [pre-production assessment](../ai/handoffs/PREPRODUCTION-HARDENING-2026-11-18.md).

The Supabase adapter, database migrations and hosted test harness remain in the repository and keep their tests.
