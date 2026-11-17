# Supabase operations (agent-run)

Routine Supabase work — migrations, read-only inspection, logs, API-key lifecycle, hosted-test preparation — is done by the orchestrating agent through the CLI and the Management API, not by hand in the dashboard. The generic protocol is the user-level skill `wf-supabase-ops`; this file records VeriMark's projects and rules.

## Projects

| Ref | Name | Role | Agents may |
|---|---|---|---|
| `jtcudtkranugrxhbigyl` | `verimark-test` | disposable test | read; mutate only with an approval naming the operation (hosted tests, key lifecycle, approved migrations) |
| `otovaqtmodpqelwbrglj` | development | **protected** | read-only identity/metadata; never schema, data, keys, Auth or config changes |

The same roles are in `~/.omp/agent/workflow/supabase-projects.json`; the `wf-guard` extension blocks mutating commands that name the protected ref or run without an explicit target where the CLI link points at it (the `full-stack-integration` worktree is linked to `otovaqtmodpqelwbrglj`), project deletion and `api-keys --reveal`. Deleting the disposable project needs its own approval.

## Tools

- CLI: `npx supabase` (3.1.0, `package.json`). Always `--remote=<ref>`; never depend on `supabase/.temp/linked-project.json`.
  - Inspect: `npx supabase projects list`, `npx supabase projects api-keys --remote=<ref>` (metadata; never `--reveal`), `npx supabase db query --remote=<ref> --read-only -f <file.sql>`, `npx supabase logs --remote=<ref> --service auth --from <UTC> --to <UTC> --output-format json`.
- Management API helper: `node ~/.omp/agent/workflow/supabase-ops.mjs` (`help` for commands). Uses the existing CLI login from Windows Credential Manager; prints no tokens; refuses mutations on protected or unregistered refs and without `--confirm-ref`.
  - Example (revoking a test key): `node ~/.omp/agent/workflow/supabase-ops.mjs key-delete --ref jtcudtkranugrxhbigyl --id <uuid> --name <name> --type secret --confirm-ref jtcudtkranugrxhbigyl`.
- Auth Admin: only `supabase/hosted/provision-users.ts`, with an elevated key in the git-ignored `.env.hosted-admin.local` created for that one provisioning and revoked afterwards.

## Before and after every mutation

1. Confirm the approval covers this operation and ref.
2. `supabase-ops identify --ref <ref>`; read the exact object (id, name, type) to be changed.
3. Execute once; no automatic retry of writes.
4. Verify through a second path (helper + CLI, or helper + read-only SQL); for hosted test runs record read-only record counts before and after.
5. Record the evidence in `docs/ai/handoffs/` without secrets.

## Credentials

Local secrets stay in git-ignored `.env.*` files in the worktree that needs them (`.env.local`, `.env.hosted-test.local`). Never print, commit, copy to other worktrees or paste into chat. Check presence by variable name and shape only. If the CLI login is missing, the blocker is "run `npx supabase login`"; credentials are never requested in chat.
