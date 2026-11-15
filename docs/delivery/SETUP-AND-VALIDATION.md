# VeriMark setup and validation

As of 2026-11-15 this repository is a documentation foundation. No application has been initialized: no package.json or lockfile, no installed app dependencies, no verified cloud deployment. Latest initialization authorization permits scoped documentation/prototypes/local commits and supersedes the older setup prompt's no-write gate; it does not permit application scaffolding, packages or remote/cloud actions.

## Verified local checks

Run from the current assigned worktree; never inspect .env contents:

```powershell
git status --short
git branch --show-current
git diff --check
Test-Path package.json
Get-ChildItem .github/workflows -File
```

INIT-D observed its isolated branch jamesmikkorecario-dev/init-quality-delivery, clean initial state and package.json=False. Workflows must contain no .yml/.yaml while scripts do not exist. Record exact evidence and commit in docs/ai/handoffs/INIT-D.md; combined integration/link validation belongs to coordinator.

| Future command | Current status / prerequisite |
| --- | --- |
| npm ci | NOT CONFIGURED; package.json and committed matching lockfile first |
| npm run dev | NOT CONFIGURED; scaffold and script first |
| npm run lint / typecheck / format:check | NOT CONFIGURED; implement matching tools/scripts |
| npm run test / test:integration | NOT CONFIGURED; harness and isolated DB fixtures |
| npm run test:e2e / test:a11y / test:visual / test:performance | NOT CONFIGURED; scripts, synthetic app fixtures and browser setup |
| npm run build | NOT CONFIGURED; app/runtime/build config |

These are proposed names, not executable promises. Do not run installs or report checks as passing because docs mention them. Later scaffold must verify actual scripts, pin runtime/dependencies and update this inventory before enabling CI. No deploy CLI is part of current setup.

## Orca maintenance (validated version 1.4.259)

Read the installed orchestration SKILL.md at C:/Users/James/.agents/skills/orchestration/SKILL.md, then load the guide from the exact selected executable. Resolve once: ORCA_CLI_COMMAND if set; otherwise orca-dev when ORCA_DEV_REPO_ROOT is present; otherwise orca-ide on Linux outside managed terminals; otherwise orca. Never fall through to another executable on error or use bare orca on unmanaged Linux.

This managed Windows session selected C:/Users/James/AppData/Local/Programs/orca/resources/bin/orca.exe through ORCA_CLI_COMMAND. The following read-only commands executed successfully on 2026-11-15:

```powershell
& $env:ORCA_CLI_COMMAND skills get orchestration
& $env:ORCA_CLI_COMMAND --version
& $env:ORCA_CLI_COMMAND status --json
```

Guide was loaded successfully (initial bare orca resolved to installed guide); version returned 1.4.259 and status reported running/ready/reachable, live caller. These establish CLI connectivity, not app correctness. Re-resolve on another machine; paths/session IDs are not portable. Before updates use installed --help and human-directed application update flow; no speculative update commands, upgrades or restarts were run.

Dispatched workers follow task/dispatch preamble: ask coordinator then end turn; send worker_done exactly once with observed outcome and evidence; stop after acknowledgment. No polling/watch loops or own helper workers. Coordinator starts independent workers and ends turn so Orca can wake it; use orchestration send instead of typing into workers' terminals. Load version-matched conditional references for recovery/remote placement; uncertain liveness never authorizes destructive recovery. Do not open/restart Orca merely to retry transient runtime errors. No new workers or lifecycle mutations were exercised in INIT-D.

## Approval and release boundary

## Initialization artifact maintenance

From repository root, run `node tools/validate-initialization.cjs` for tracked local Markdown targets, starter markers, three preview files, inactive CI and tracked-content boundaries. Run `git diff --check` for whitespace. These are documentation checks, not runtime security or application tests. Open `prototypes/design/index.html` for the offline comparison and see its README for browser evidence reproduction; the optional browser check requires the already installed Orca browser executable and does not install dependencies.

After committing the reviewed workflow, run `powershell -NoProfile -File tools/Export-Workflow.ps1`. It exports committed allowlisted workflow, input, configuration, documentation and prototype paths into ignored `artifacts/VeriMark-workflow.zip`, prints SHA-256, and excludes `.git`, actual environment secrets, dependencies and unrelated working files. Rerun after a later documentation commit to refresh the archive. It does not export uncommitted changes. Inspect the ZIP entry list before sharing; the archive includes clearly fictional prototype data and an example environment file only.

Local isolated tests/docs are permitted within scope; integration coordinator reviews and cherry-picks sequentially. No main merge, push, service connection/provisioning, deployment, paid activity, production secrets or shared migrations without explicit approval. Complete privacy/eligibility and restore gates before real pilot; current documents do not establish legal clearance or production readiness.

## Mandatory stack update

React.js + TypeScript, Vite, Supabase backend/PostgreSQL/Auth and Vercel hosting are approved requirements, with FREE TIERS ONLY. Storage/Edge Functions are conditional on documented need. No Next.js, separate Node backend, substituted host or extra cloud service without explicit approval. Styling, colors, typography and components remain exploratory; no visual approval has been granted. This authorization permits no production features, provisioning, push or deployment.

Vercel Hobby eligibility for organizational use remains unresolved. Default Auth SMTP is unsuitable for general production email-based onboarding/reset; no external SMTP service is approved. Free recovery must cover DB exports and any private Storage objects without assuming a paid backup or extra cloud service. Report these conflicts and block dependent release work rather than substituting services or treating approval as implicit.
