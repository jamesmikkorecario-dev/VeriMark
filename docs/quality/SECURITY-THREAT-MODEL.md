# Security and Privacy Threat Model

## Assets and adversaries

Assets: accounts, private records, credentials, storage files, audit logs, billing/quota. Actors: anonymous users, authenticated users, attackers, privileged operators, external services.

## Attack surface inventory

| Boundary | Example threat | Mitigation | Test / owner |
| --- | --- | --- | --- |
| Browser ↔ DB | IDOR / cross-user record access | RLS + policy tests | [ID] |
| Browser ↔ Edge Function | unauthorized privileged call | verified identity & role | [ID] |
| Browser ↔ Storage | private file disclosure | bucket/path policy and signed URL expiry | [ID] |
| External integration | secrets leak / SSRF / retry storms | server-only secret, URL allowlist, limits | [ID] |
| CI/build | dependency or token compromise | pinned lockfile, least-privilege tokens | [ID] |

## Review list

Authorization by resource/action, injection, XSS, CSRF where cookies apply, rate limiting, brute force, user enumeration, data retention/deletion, auditability, dependency risks, webhook signature checks, safe logging/error responses.

## Release rule

No unresolved **critical/high** finding without explicit risk acceptance by the human owner; security scans alone do not prove safety. Review Supabase's current production checklist before public launch.
