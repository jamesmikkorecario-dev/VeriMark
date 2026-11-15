# VeriMark CI/CD activation plan

Current: no package.json, lockfile or app scripts; CI is INACTIVE. .github/workflows contains documentation only. The example under templates/github-actions is outside workflow discovery; do not move it merely to display a green badge.

Activation needs a separately authorized scaffold, pinned runtime/lockfile, matching scripts passing locally, independent review, isolated synthetic fixtures and reviewed permissions/artifact retention. Pin actions to reviewed immutable SHAs at activation; example runtime is only a proposal. Do not skip missing scripts or use continue-on-error to bypass gates.

Future PR sequence: install; formatting/lint/types; unit/components; build; isolated DB/RLS/API/Storage negative tests; E2E/axe/reviewed visuals; performance; dependency and secret scanning. Create checks before making them branch requirements. Untrusted fork PRs receive no privileged secrets; never execute untrusted code under pull_request_target. Artifacts contain synthetic data only; proposed retention 7 days.

Preview publication and Git integration require approval, eligibility review and isolated backend. Before connecting Vercel Git, verify production branch and automatic deployment triggers; an approved merge may trigger release. Production follows DEPLOYMENT-AND-ROLLBACK.md. This setup connects no services.
