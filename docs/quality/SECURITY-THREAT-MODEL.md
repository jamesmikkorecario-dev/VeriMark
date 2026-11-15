# VeriMark security and privacy threat model

Status: proposed controls, 2026-11-15; no security test or deployment is asserted. Assets include account sessions, organization authority, immutable issuance claims, private recipients/evidence/PDFs, delivery secrets, audit history and platform resources. Adversaries include anonymous scrapers, malicious tenant members, other tenants, stolen-link holders and compromised privileged servers/operators.

| Threat/boundary | Required control | Planned evidence |
| --- | --- | --- |
| Tenant IDOR / forged relationship | RLS, current membership, composite tenant FKs, constrained RPC grants | AUTH-01/02, DB-01/02/05 |
| Privileged Edge call bypasses RLS | authenticate actor, authorize exact tenant/resource/action; internal worker scope distinct | AUTH-06, direct endpoint denial |
| Owner impersonates platform admin or issuer | protected admin assignment, separate audited issuer review, no self-review | AUTH-03 |
| Mutable/duplicate/false issuance | immutable snapshots, explicit approved revision, atomic RPC, digest/idempotency/locks, append-only audit | DB-03/04/06 |
| QR pasted onto forged PDF | display comparison fields/current status; tell verifier to compare document; no claim of cryptographic validation | CONTRACT-02 and E2E comparison |
| Public enumeration / PII leakage | high-entropy IDs, exact lookup only, DTO allowlist, no anon tables/listing, throttling/no-store | CONTRACT-01/02, DB-05 |
| Public ID downloads private PDF | separate secret capability/session, exact credential scope, private buckets, short download URL | STORAGE-01, CONTRACT-03 |
| Stolen link / signed URL exposure | no-referrer, fragment exchange, no analytics/logging, expiry/revocation and issuer regeneration; residual bearer risk | session/URL expiry tests |
| CSV injection / oversized import / malicious asset | server validation, byte/row/image limits, CSV export formula escaping, no HTML/SVG or remote URL templates | invalid CSV/file and SSRF tests |
| Batch exhausts Edge budget | bounded jobs/leases, attempt cap/backoff, fencing, progress/failed states and recovery | DB-07; runtime spike before pilot |
| Evidence or contact export leaks | role/purpose-specific Storage and column grants; protected export; no public evidence | AUTH-04/STORAGE-01 |
| Expiry race / stale cache / outage claims valid | DB time, explicit precedence, consistent query, no-store; unavailable distinct from not-found | CONTRACT-02 |
| Session theft / XSS / recovery abuse | escaped React text, no raw HTML templates, CSP at hosting, allowlisted redirects, auth boundary validation; clear tenant caches | AUTH-05, frontend security tests |
| Audit tampering / secrets in observability | append-only application privileges, minimal audit metadata; redact secrets/PII, restricted log access | DB-06, log/bundle review |
| Supply-chain or cloud credential compromise | reviewed pinned dependencies/lockfile, least-privilege CI/server secrets, secret scan, no browser service role | future CI and bundle inspection |

Anonymous verification intentionally exposes approved comparison fields to anyone holding the public URL. Unpredictability and throttling reduce discovery; neither supplies confidentiality. Bearer delivery links are independently scoped access secrets. Audit append-only controls constrain application actors; a database superuser remains trusted and requires operational controls/backups, not an absolute tamper-proof claim.

Unresolved high-impact policy: public recipient name/sharing choice, retention/erasure and exports, delivery-token lifetime/recovery, reviewer separation, issuer review criteria, support access and suspension effects on issued records. Do not use real personal data or launch until relevant decisions and notices are approved. Legal/free-tier verification belongs to quality/delivery worker and is not concluded here.

Before public release require an independent auth/database/storage review, negative tests across two tenants, concurrency/failure tests, current [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), restore rehearsal and documented incident response. No unresolved critical/high finding without explicit human risk acceptance. Reporting route is SECURITY.md; do not publish sensitive reproduction records. Platform references and date are in RLS-AND-MIGRATIONS.md.
