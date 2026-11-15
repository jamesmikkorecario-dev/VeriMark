# Continuous Integration and Delivery

## PR pipeline

1. Install reproducibly from lockfile.
2. Lint and typecheck.
3. Run unit/component suite.
4. Build production artifact.
5. Run integration/RLS tests against isolated test environment when configured.
6. Run critical Playwright flows; upload test artifacts without secrets.
7. Security/dependency checks where available.

See `templates/github-actions/ci.example.yml` for a **nonactive template**; rename after verifying package scripts and branch strategy.

## Deploy flow

PR → Vercel Preview with **preview-safe** env/data → checks and human preview → approved merge to configured production branch → Vercel Production → post-deploy smoke/monitoring → rollback if gate fails.

Vercel may deploy automatically on pushes to the configured production branch. **Before connecting Git**, verify which branch triggers real production and set branch protection. An AI agent must not approve release for you.

## Secrets

Use provider environment settings, least-privilege tokens, separate preview/prod resources if feasible, no real secrets in CI logs/PR comments.
