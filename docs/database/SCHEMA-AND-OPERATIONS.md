# VeriMark schema and trusted operations (implemented)

Source of truth: `supabase/migrations/20261116000000_verimark_core.sql`. Decisions: ADR-0005. Tests: `supabase/tests/README.md`. `DATA-MODEL.md` and `RLS-AND-MIGRATIONS.md` describe the earlier, larger proposal; where they differ, this file and the migration describe what exists.

Status: applied and tested only on a local in-process PostgreSQL. No hosted database exists.

## Access model

| Caller | Tables | Functions |
| --- | --- | --- |
| `anon` | none | `verify_credential`, `exchange_delivery` |
| `authenticated` | SELECT on safe columns of `organizations`, `organization_members`, `credential_templates`, `credentials`, `credential_events`, `audit_log`, limited by RLS to the caller's organizations. No INSERT/UPDATE/DELETE anywhere. | every other `public` function |
| platform administrator | same as `authenticated`; no implicit access to tenant data | additionally passes the checks in `list_review_queue` and `record_issuer_review` |

Every function is `security definer` with `search_path = ''`, reads the caller from `auth.uid()`, and checks the caller's current membership row (locked for the transaction). A non-member gets `NOT_FOUND`; a member with too low a role gets `FORBIDDEN`. The application uses only the functions; the table grants exist as defence in depth and for future read paths.

Never granted to clients: recipient e-mail, revocation/replacement reasons, actor IDs, token hashes, invitations, batches and rows, approvals, idempotency receipts, review records, platform administrators, counters.

## Operations

| Area | Functions | Who |
| --- | --- | --- |
| Organizations | `my_memberships`, `create_organization`, `get_organization`, `list_members` | any signed-in user / members |
| | `rename_organization`, `set_member_role`, `remove_member`, `list_invites`, `create_invite`, `revoke_invite` | owner |
| | `accept_invite` | signed-in user whose confirmed e-mail matches the invitation |
| Platform review | `is_platform_admin`, `list_review_queue`, `record_issuer_review` | platform administrator (not for an organization they belong to) |
| Templates | `list_templates` (members); `save_template`, `archive_template` | owner, issuer |
| Issuance | `create_batch`, `preview_batch`, `approve_batch`, `issue_batch` | owner, issuer; `issue_batch` also needs a reviewed organization |
| Credentials | `list_credentials`, `get_credential`, `list_audit`, `get_metrics` | members |
| | `revoke_credential`, `replace_credential`, `create_delivery_link` | owner, issuer |
| Public | `verify_credential`, `exchange_delivery` | anyone |

Errors raised for clients have the message `VM:<CODE>` (codes in `src/lib/api/types.ts`). `VM:VALIDATION` carries a JSON list of `{field, code, row?}` in DETAIL; `VM:RATE_LIMITED` carries the retry delay in seconds.

## Invariants enforced in the database

- Issued content cannot change: an update trigger on `credentials` allows only `revoked_at`, `replaced_at` and `replaced_by` to be set, once. Rows cannot be deleted or truncated.
- `credential_events`, `audit_log`, `issuer_reviews` and `batch_approvals` are append-only.
- One `issued`, at most one `revoked` and one `replaced` event per credential; one successor per predecessor; unique `(lineage, version)`.
- Child rows carry `organization_id` and reference parents through composite keys, so a cross-tenant link cannot be stored.
- Issuance needs an approval whose revision and digest match the batch as it is at issue time. The digest covers the pinned template and every row.
- `issue_batch`, `revoke_credential` and `replace_credential` are idempotent per (organization, actor, operation, key); the same key with a different request is refused.
- Status is computed at read time: revoked > replaced > expired (`expires_at <= now()`) > valid.
- Public IDs are 128 random bits (22 characters). Delivery and invitation secrets are 256 random bits; only SHA-256 hashes are stored. A new delivery link, a revocation or a replacement disables earlier links. Delivery links last 30 days, invitations 7.
- The last owner of an organization cannot be removed or demoted.
- Platform administrators are created only by an operator with direct database access; no function writes `platform_admins`.

## Limits

Organization, template name and template text fields 120 characters (body prefix 200); recipient name and title 200; achievement 2000; reasons 1000; 1–200 rows and 2 MiB per batch; 5 organizations per account; 200 templates per organization; 50 invitations per organization per day. Public lookups share a budget of 600 verifications and 120 delivery exchanges per minute across all callers.

## Known limits of this design

- The rate budget is global, not per client: one abusive caller can exhaust it for everyone for up to a minute. A per-client limit needs something in front of the database.
- Idempotency receipts and the oldest rate windows are the only data ever deleted; there is no retention or erasure process yet.
- Lock ordering (organization → membership → batch/credential) was reviewed but not exercised under real concurrent connections.
- `auth.users.email_confirmed_at` is trusted for invitation matching, so e-mail confirmation must stay enabled in Supabase Auth.

## Applying to a Supabase project (requires owner approval; not done)

1. Create the project (free tier) and keep e-mail confirmation enabled.
2. Apply the migration with the Supabase CLI (`supabase db push`) or the SQL editor.
3. Make sure the Data API exposes only the `public` schema (the default). Never expose `app`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the frontend. Never put a service-role key in any `VITE_` variable.
5. Add the site URL and `/update-password`, `/sign-in` to the Auth redirect allow-list.
6. Create the first platform administrator in the SQL editor: `insert into public.platform_admins (user_id) values ('<auth user id>');`
7. Re-run the scenarios in `supabase/tests` against the project with two test organizations before real use.
