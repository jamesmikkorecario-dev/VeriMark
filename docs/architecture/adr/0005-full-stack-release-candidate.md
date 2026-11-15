# ADR-0005: Full-stack release-candidate architecture

Status: accepted for the local release candidate, 2026-11-16, by the engineering orchestrator under the owner's autonomous-engineering authorization. Items marked **owner decision** are provisional defaults that must be confirmed before real data or deployment.

## Context

M1 delivered a frontend-only demonstration. The PRD (FR-001..008) needs authentication, organizations, issuance, public verification, delivery, lifecycle and history on the mandatory stack (React/Vite, Supabase, Vercel, free tiers only). No Supabase project may be provisioned and no local Supabase stack (Docker) is running on the development machine.

## Decisions

1. **One trust boundary: PostgreSQL.** Every privileged operation is a `security definer` function with a pinned empty `search_path`, explicit `auth.uid()` checks and current membership lookups. Base tables have RLS enabled, are read-only for members through policies, and have no client write grants. `anon` has no table access at all.
2. **No Edge Functions and no Storage in this release candidate.** The earlier design proposed Edge endpoints and stored PDFs. RPCs give the same atomicity and authorization without a second runtime to secure, and neither Edge nor Storage can be verified locally here. Consequences are listed under "Deviations".
3. **Public verification is the RPC `verify_credential(public_id)`**, executable by `anon`. It returns only the public allowlist, computes status in one statement from database time, and has a database-side global rate budget that fails closed. Malformed and unknown IDs are indistinguishable (not found).
4. **Certificates are rendered in the browser** from the immutable snapshot (`pdf-lib` + `qrcode`). The PDF is a convenience copy; the online record is the authority. The QR encodes only the official verification URL.
5. **Delivery capability** = 256-bit random secret, shown once, stored as SHA-256 hash, carried in the URL fragment (`/receive#<token>`), exchanged by POST-style RPC. Creating a new link revokes earlier ones. Invalid, expired and revoked are indistinguishable.
6. **Invitations** use the same pattern (hashed single-use token, 7-day expiry, bound to the invited e-mail, manual link sharing). VeriMark sends no e-mail of its own.
7. **Issuance pipeline** is draft → preview → approve exact digest → issue. Issue is atomic and idempotent (stable key + request digest). Single issuance is a one-row batch. Replacement issues a successor and marks the predecessor in one transaction.
8. **Frontend talks only to `VeriMarkApi`** (`src/lib/api/types.ts`). Two adapters: Supabase (when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set) and a clearly labelled in-memory demo. The demo adapter mirrors the rules for local use and browser tests; it is never evidence of backend security.
9. **Database tests run against real PostgreSQL in-process (PGlite)** with a small shim for Supabase's roles and `auth` schema. This exercises the actual migration SQL, RLS and grants under `anon`/`authenticated` roles. It is not a test of a hosted Supabase project.
10. **No new state/form libraries.** TanStack Query, React Hook Form and Zod stay deferred; forms use the existing UI kit with explicit validation, and the server re-validates everything.

## Provisional owner decisions (defaults used locally)

| Decision | Default in this release candidate |
| --- | --- |
| D-011 delivery link lifetime | 30 days; regeneration revokes the old link |
| D-011 public recipient name | The recipient display name entered by the issuer is public on the verification page |
| D-013 status precedence | revoked > replaced > expired > valid, database UTC; `expires_at <= now` is expired |
| D-013 replacement disclosure | The predecessor's public page links to the successor's public ID |
| D-014 roles and approval | owner / issuer / viewer only; the issuer who prepared a batch may approve it (self-approval) |
| Suspension effect | A suspended or pending issuer cannot issue; existing records keep their own status and the page shows the issuer's current review state |

## Deviations from the earlier proposed design

- No `pdf_jobs`, `file_assets`, Storage buckets, template image assets, or signed download URLs. Templates are structured text/layout settings only.
- No per-network-identity throttling. PostgREST cannot provide a trustworthy client address to SQL. The global budget limits abuse but one abusive client can exhaust it for everyone until the window resets. A per-client limiter (Edge Function or hosting layer) is a pre-pilot item.
- Idempotency receipts are kept indefinitely (small rows); the proposed 24-hour window is not implemented.
- Organization-scoped URLs (`/organizations/:id/...`) are replaced by `/app/...` with the active organization held in the session.

## Consequences

The whole security model lives in one reviewed migration plus tests. Hosted behaviour (Auth e-mail, JWT settings, PostgREST exposure, rate limits) remains unverified until a Supabase project is approved and the same tests are repeated there.
