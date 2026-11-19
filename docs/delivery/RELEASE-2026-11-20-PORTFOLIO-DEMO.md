# Release record — public portfolio demonstration (2026-11-20)

**Live URL: https://verimark-demo.vercel.app**

Fictional-data, backend-free demonstration. Released under the owner's approval of commit `02de9ddc50981cc0259cedc033444892efe55335`, which replaced the earlier approval of `3dca68a` (see the CI section).

## Source

| Item | Value |
|---|---|
| Release commit | `02de9ddc50981cc0259cedc033444892efe55335` (`test: wait for error-summary focus before typing the replacement reason`) |
| GitHub `main` | fast-forwarded `197711b` → `3dca68a` → `02de9dd`, pushed without force |
| GitHub `dev/full-stack-integration` | `02de9dd` |
| Commits since `197711b` | 127, all `jamesmikkorecario-dev`, no AI attribution (`omp-flow check-commits`) |

The owner's local primary checkout was deliberately left at `197711b`. Its untracked `artifacts/` and `design-references/` include 40 files the release also tracks, all content-identical. A local fast-forward would refuse to overwrite them, so `main` was advanced on GitHub only.

## Linux CI

Workflow **Pilot validation** (`.github/workflows/pilot-validation.yml`, Ubuntu, Node 24.19.0). It runs: typecheck, lint, unit, database/security, build, `build:demo`, two-worker Chromium e2e, and live demo journeys.

| Run | Branch | Commit | Result |
|---|---|---|---|
| 44522462946 attempt 1 | dev | `3dca68a` | **failed** — unit test `CredentialDetailPage.test.tsx` › "replaces with prefilled values…" |
| 44522462946 attempt 2 | dev | `3dca68a` | passed |
| 44563431380 | main | `3dca68a` | **failed** — same test |
| 44565879138 | dev | `02de9dd` | **passed**, all steps, first attempt |
| 44568170317 | main | `02de9dd` | **passed**, all steps, first attempt |

### Original failure, root cause and fix

- **Symptom:** the replace dialog was called with reason `"N"` instead of `"Name corrected"`. The test expected the full reason. It never failed on Windows (including 40 repeats under CPU load) but failed 2 of 3 GitHub runs of `3dca68a`.
- **Reproduction:** a fresh clone of `3dca68a` on Ubuntu 24.04 (WSL, Node 24.19.0) failed 2 of 3 runs with the same `"N"`.
- **Root cause:** after the first submit fails validation, the dialog moves focus to its error summary on the next animation frame. On the slower Linux runner that frame fired after the test had typed the first character into the reason field, so the remaining keystrokes went to the summary. This was a race in the test only: a person cannot type within one frame of clicking submit, and the application behaviour is correct.
- **Fix (`02de9dd`, test-only, 5 lines added and 1 removed in one file):** wait for the error summary to receive focus before typing, as a person would. On Linux it passed 25 of 25 repeat runs and the full unit suite (225/225). No test was weakened; the assertions are unchanged.

## Vercel

| Setting | Value (read back from the Vercel API after creation) |
|---|---|
| Account / plan | `jamesmikkorecario-dev`, **Hobby** (free) |
| AI-model training | team `dataSharingConsent: refused` (set by the owner before the project existed); project inherits it |
| Project | `verimark-demo`, framework Vite, root `./` |
| Git | `jamesmikkorecario-dev/VeriMark`, production branch `main` |
| Install / build / output | `npm ci` / `npm run build:demo` / `dist` |
| Environment variables | **none** (0) |
| Integrations | none; no Supabase, no database, no add-ons |
| Deployment | production, `READY`, built from `main` @ `02de9dd`; aliases `verimark-demo.vercel.app`, `verimark-demo-jamesmikkorecario-dev.vercel.app`, `verimark-demo-git-main-jamesmikkorecario-dev.vercel.app` |

Build log highlights:

```
Cloning github.com/jamesmikkorecario-dev/VeriMark (Branch: main, Commit: 02de9dd)
Running "install" command: `npm ci`...
added 290 packages, and audited 291 packages in 6s
> verimark@0.1.0 build:demo
> node tools/build-demo.mjs
vite v8.3.8 building client environment for production...
✓ built in 569ms
build:demo: 10 files in dist/, demonstration adapter only, no Supabase client, host, key or token.
Build Completed in /vercel/output [17s]
```

The build log also showed two warnings, neither affecting this release:
- **Node version:** `engines: >=22.12.0` will auto-upgrade Node on new major releases (project default 26.x; CI uses 24.19.0).
- **npm config:** npm warns about Vercel's `cache-dir` environment config.

## Production smoke verification (live URL)

All checks ran with Playwright (Chromium) and `curl` against `https://verimark-demo.vercel.app`.

- **Headers on 11 document routes** (`/`, `/verify`, `/verify/<seeded>`, `/app/credentials`, `/receive`, `/invite`, `/sign-in`, `/sign-up`, `/reset-password`, `/update-password`, an unknown route): all 200 HTML with exactly the strict CSP (`script-src 'self'; style-src 'self'`, no `unsafe-*`). Also present on each: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `nosniff`, HSTS (2 years), COOP/CORP `same-origin` and the restrictive Permissions-Policy. No inline script or style in the HTML.
- **Assets:** `public, max-age=31536000, immutable`. All 9 asset files scanned. They contain no Supabase URL, API path, key, JWT, client library or project ref, and no Vercel environment values. The demo adapter is present.
- **Desktop (1440) and mobile (390) flows**, each verified with zero requests leaving the site's origin and zero console errors or CSP violations:
  - home page renders with its title and the demonstration ribbon;
  - the sign-in notice that data is fictional and tab-only;
  - issue a record, then open the public page in the same tab and verify it;
  - create a recipient link, open it and download the PDF (`%PDF` header);
  - replace, then revoke;
  - mobile navigation open and close with Escape;
  - no horizontal overflow.
- **Existing journey suite** (`e2e/app-journeys.spec.ts`) at 1440 and 390 against production: **18 passed, 0 failed**. It covers single and CSV issuance with CSV export, revoke, replacement lineage, delivery-link rotation, role controls, platform review, foreign-record denial and the recipient PDF. The production smoke spec passed 4 of 4.
- **Edge caching:** Vercel serves the static shell from its CDN (`X-Vercel-Cache: HIT`) even though it sends `Cache-Control: no-store`. This is harmless here because the shell is identical for every visitor and contains no user data. The real pilot must not rely on `no-store` alone for per-user responses.

## Known demonstration limits

- All data is fictional and lives in the visitor's own browser tab (`sessionStorage`). A new tab, browser or device shows the seed again: records issued elsewhere are "not found", and seeded records a visitor revoked show as valid.
- Demo accounts and their shared password are listed on the sign-in page. "Sign up" is local to the tab, and no email is ever sent.
- The demo shows product flows and front-end security controls. It is not evidence of hosted database authorization; that evidence is the PGlite suite and the disposable-project hosted runs.

## Outstanding before any real pilot

See [pre-production assessment](../ai/handoffs/PREPRODUCTION-HARDENING-2026-11-18.md) and [privacy proposals](../security/hardening/PRIVACY-DECISIONS.md). In summary:
- public-data, lineage, link-lifetime, retention/erasure and region decisions;
- trusted-ingress rate limiting;
- production email (custom SMTP and an owned sending domain);
- a production Supabase project (two-active-project Free limit);
- narrowing CSP `connect-src` to that project;
- the non-maintainer test of GitHub private vulnerability reporting;
- the unpatched dev-tool advisory GHSA-fc5q-39xc-vjpf;
- per-response caching rules for the Vercel edge.

Neither Supabase project was modified by this release (both listed `ACTIVE_HEALTHY` afterwards, read-only check).

## Rollback

Promote the previous deployment in Vercel, or remove the project. There is no data migration.
