# VeriMark RLS and migration policy

Design only; no SQL migration or deployed policy exists. RLS plus grants and transactional invariants enforce authorization. Enable RLS explicitly on every exposed table; deny anonymous SELECT/INSERT/UPDATE/DELETE on all base tables. No anonymous listing view, RPC or Storage bucket. Public verification uses the restricted server endpoint exclusively.

| Resource | Authenticated read predicate | Writes |
| --- | --- | --- |
| Own profile | auth.uid() = id | own safe metadata only; no authority columns |
| Organization/membership | active membership for same organization; safe column projection | guarded owner RPC; current owner and last-owner checks |
| Templates/batches/rows | active member, tenant equality; viewer safe fields only | draft operations for owner/issuer, USING and WITH CHECK tenant/revision restrictions |
| Credentials/snapshots/events | tenant active member, safe projections | domain RPC only; no direct lifecycle writes |
| Evidence/files | same tenant plus role and object-purpose authorization | validated upload/finalization only; final PDFs worker-only |
| Audit | scoped authorized role and same tenant; platform events separate | transaction-owned append only; no client update/delete |
| Reviews/platform authority | restricted platform admin operations | protected audited RPC; tenant owner cannot grant authority |
| Delivery hashes/jobs/receipts | no direct client access | narrowly scoped server operations |

Member-policy helpers must avoid recursion, use trusted membership state and reject null auth.uid(). Default security invoker functions preserve RLS. Where security definer is necessary, pin empty or safe search_path, fully qualify objects, use a minimal owner, revoke default PUBLIC/anon execution, grant only intended callers, and authenticate/authorize internally. Definer and service-role calls can bypass policies; neither is a substitute for actor checks. Views must preserve invoker policies where supported or be inaccessible to clients. Do not enable realtime on sensitive tables by default.

## Storage

Private buckets only. Object paths are server-normalized organization_id/purpose/credential-or-asset-id/version; path prefix alone is not authority. Policies join validated file metadata with current membership and permitted purpose. Reject cross-tenant paths, bucket changes, traversal, oversized/wrong-type uploads, arbitrary overwrite and list/download of another tenant. A delivery capability is checked server-side for the exact credential and ready PDF, never mapped to evidence. Return a short signed URL (proposed 60 seconds); possession permits access until expiration, so prevent logging/referrers/caching. Capability revocation cannot invalidate an already distributed signed URL immediately. Prefer proxy download if immediate revocation becomes a requirement.

## Migration / validation gate

Future numbered migrations are immutable once applied. Review constraints, role grants, function execute privileges, view security, Storage policies and all foreign keys together. Test on disposable local Supabase with synthetic identities, apply from empty and prior schema, verify generated types, check indexes/locks, and document forward fix/backfill and recovery. Never run destructive/shared/production migration without explicit approval; verify backup/restore capability rather than assuming a tier provides it.

Planned DB-01: two-tenant positive/negative CRUD matrix including anonymous and authenticated outsider. DB-02: composite FK rejection of cross-tenant batch/template/successor/file links. DB-03: concurrent same-key issuance yields one receipt and credential set; different payload same key conflicts; rollback creates none. DB-04: stale approval and simultaneous edit/issue, revoke/replace, owner removal and issuance cannot bypass invariants. DB-05: base-table anonymous list, private columns, definer execute and view bypass attempts denied. DB-06: audit/snapshot update/delete denied, including direct API. DB-07: PDF lease crash/retry/fencing and duplicate upload reconcile without duplicate credentials. STORAGE-01: direct bucket access, forged paths, public-ID-only PDF download, expired/revoked capabilities and evidence access denied. Test expired credential at exact boundary with server time and revoked+expired precedence.

## Primary technical sources

Checked 2026-11-15; these explain platform capabilities, not evidence that VeriMark has configured them:

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): policies, auth.uid(), service-key bypass and view caveats.
- [Database functions](https://supabase.com/docs/guides/database/functions): invoker/definer security, search_path and execution grants.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): storage.objects policies and service-key bypass.
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth): distinguish user JWT authentication from privileged server credentials; implement endpoint-specific authorization explicitly.

Recheck platform behavior against pinned implementation versions before enabling public access.
