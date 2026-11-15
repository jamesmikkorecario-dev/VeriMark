# Deployment, Verification, and Rollback Runbook

## Preflight

- [ ] Scope, commit SHA, PR and required reviews verified.
- [ ] Relevant tests, security, performance, RLS, accessibility gates passed or deviations approved.
- [ ] Environment vars/redirect URLs/webhooks checked; no credentials logged.
- [ ] Schema migration evaluated for backward compatibility and recovery.
- [ ] Backup/restore plan ready for data-impacting changes.
- [ ] Explicit human approval to deploy to production recorded.

## Controlled deployment

1. Confirm configured production branch and preview/prod separation.
2. Merge/push only after approval, then record deployed commit and deployment link.
3. Smoke test sign-in, primary journey, authorization-negative path, error behavior.
4. Inspect logs and user-facing reliability signals (excluding sensitive contents).
5. Report result as verified / failed / cannot verify with evidence.

## Recovery

- Revert or promote previous known-good frontend release when safe.
- **Code rollback does not automatically undo DB changes**; use forward fix or approved recovery procedure.
- Communicate impact and incident owner; verify successful recovery.

## Release record

Date, approver, commit, migrations, environment, checks, monitoring, incident/rollback link.
