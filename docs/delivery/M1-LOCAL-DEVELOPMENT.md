# M1 local development

Prerequisites: Node >=22.12 (tested 24.19.0), npm (tested 11.17.0), Git. Run in C:/Users/James/orca/workspaces/VeriMark/full-stack-implementation. Never switch primary checkout away from main.

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:3000. Vite prefers 3000 and may choose the next available port; use its printed URL. Never terminate unrelated processes. No .env or Supabase keys are needed. All records, people, organization and activity are fictional; no real authentication, issuance, verification or persistence occurs.

```powershell
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:e2e
```

Browser runtime instructions and exact evidence are in M1-A/final M1 handoff. Tests use port 3000 with reuseExistingServer=false; stop only your own server before testing, or configure another test port.

Structure: src/app owns URL routing/lifecycle; src/pages owns landing/dashboard/deferred/not-found; src/components/layout owns PublicLayout and IssuerWorkspaceLayout; src/components/ui and src/styles own shared presentation; src/data contains typed fictional fixtures/filtering; e2e contains browser checks.

Routes: / landing; /workspace demo overview; /workspace/:section future feature notice in workspace shell; /preview/:section public future feature notice; unknown routes show not-found with working return navigation. Vite supports development deep links. vercel.json declares future SPA rewrites, without deployment or Vercel runtime verification.

React/React DOM render UI; React Router handles navigation. Vite/TypeScript/ESLint provide local build/static checks; Vitest/jsdom/Testing Library test behavior; Playwright/axe test browser journeys. Query/form/backend dependencies are deferred (ADR-0004). Backend/RLS checks belong to later authorized slices.

See docs/ai/handoffs/M1.md for results, screenshots, risks and cleanup. Stop after M1 for owner review: no push, main merge, provisioning or deployment.

### Browser runtime on this machine

The downloaded headless shell reports spawn UNKNOWN. Installed Chrome works. In PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e -- --workers=4
```

Alternatively select edge with channel msedge, or set PLAYWRIGHT_EXECUTABLE_PATH to a compatible local executable; do not set both selectors. Without an override, Playwright uses its bundled Chromium (install with npx playwright install chromium on a supported machine). Default-shell failure is an environment limitation, not a passing check.

The coordinator left a local preview running at http://127.0.0.1:3001/ to avoid concurrent tests on port 3000. The normal dev command uses port 3000 when free.

### Motion review

See ../ai/handoffs/M1-MOTION.md and ../quality/evidence/m1-motion/README.md. Reproduce recorded desktop/mobile motion with powershell -File e2e/capture-motion.ps1 -EvidenceName review -Port 3107. Full browser runs can set PLAYWRIGHT_PORT to a free port; strictPort prevents silently testing another server. No unrelated process is killed or reused. Reduce mode intentionally removes playback and action displacement.
