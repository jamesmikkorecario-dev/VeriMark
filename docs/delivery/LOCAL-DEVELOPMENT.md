# VeriMark local development (full stack)

Supersedes `M1-LOCAL-DEVELOPMENT.md` for the `dev/full-stack-integration` branch. Nothing here deploys, pushes or creates cloud resources.

## Prerequisites

Node 22.12 or newer (tested on 24.19.0), npm, Git. No Docker, no Supabase account and no `.env` file are needed for the demonstration mode.

```powershell
npm ci
cp tools/hooks/commit-msg "$(git rev-parse --git-common-dir)/hooks/commit-msg"   # once per clone; see COMMIT-POLICY.md
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:3000 (Vite prints the real port if 3000 is taken).

## Two modes

| Mode | When | What it is |
| --- | --- | --- |
| Demonstration | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` not set | An in-memory adapter in the browser with fictional data. It follows the same rules as the database (roles, approval, idempotency, status precedence) but it is not a security boundary and nothing is stored beyond the browser tab. Every screen is labelled as a demonstration. |
| Supabase | both variables set in `.env.local` | Calls the functions in `supabase/migrations` on your project. Requires the steps in `docs/database/SCHEMA-AND-OPERATIONS.md`. **Not yet exercised against a real project.** |

Demonstration accounts (password `demo-password-1` for all; all fictional):

| E-mail | Role |
| --- | --- |
| `owner@demo.verimark.test` | Owner of Fieldwork Collective (reviewed, can issue) |
| `issuer@demo.verimark.test` | Issuer, Fieldwork Collective |
| `viewer@demo.verimark.test` | Viewer, Fieldwork Collective (read only) |
| `admin@demo.verimark.test` | Platform reviewer, no organization |
| `north@demo.verimark.test` | Owner of Northgate Guild (pending review, cannot issue) |

Demonstration record IDs for `/verify/<id>`: `demoValidRecord0000001`, `demoExpiredRecord00001`, `demoRevokedRecord00001`, `demoReplacedRecord0001`.

## Routes

Public: `/`, `/verify`, `/verify/:publicId`, `/receive#<secret>`, `/sign-in`, `/sign-up`, `/reset-password`, `/update-password`, `/invite#<secret>`. Signed in: `/app` (overview), `/app/credentials`, `/app/credentials/:id`, `/app/issue`, `/app/templates`, `/app/activity`, `/app/organization`, `/app/review` (platform reviewers), `/app/onboarding`. The M1 showcase remains at `/workspace` and `/preview/:section`.

## Checks

```powershell
npm run typecheck
npm run lint
npm test -- --run          # unit and component tests (jsdom)
npm run test:db            # schema, RLS and function tests on in-process PostgreSQL; see supabase/tests/README.md
npm run build
$env:PLAYWRIGHT_PORT='3441'; npm run test:e2e -- --workers=2
```

Use `--workers=2` for the browser suite: some M1 motion and scroll timing tests fail intermittently at higher parallelism on this machine (tracked as a known defect of those tests, not of the application). If the bundled Chromium cannot start, set `PLAYWRIGHT_CHANNEL=chrome`.

## Layout

`src/lib/api` is the only door to data: `types.ts` (contract), `supabaseAdapter.ts`, `demoAdapter.ts`. `src/features/*` hold the pages. `src/lib/certificate` renders the PDF and QR code in the browser. `src/lib/csv` parses and writes CSV. `supabase/migrations` is the whole backend; `supabase/tests` proves its rules.

## Not available locally

Supabase Auth e-mails (confirmation, password reset), hosted Data API behaviour, per-client rate limiting, deployment. These need an approved Supabase project and Vercel project.
