# VeriMark authentication and permissions

Proposed least-privilege matrix. All tenant permissions require active membership in that organization; knowing an ID never grants membership. Roles are trusted database records, not user-editable profile metadata or a browser-selected tenant. Platform admin is a separate protected assignment with no automatic tenant owner privileges.

| Action | Owner | Issuer | Viewer | Platform admin | Recipient capability / anonymous |
| --- | --- | --- | --- | --- | --- |
| Read tenant operational records | Yes | Yes | Yes, exclude evidence/contact exports by default | No implicit access | No |
| Manage membership/settings | Yes, protect last owner | No | No | No implicit access | No |
| Edit templates/draft batches | Yes | Yes | No | No | No |
| Preview/basic approve/issue | Yes | Yes | No | No | No |
| Revoke/replace | Yes | Yes | No | No | No |
| Read private evidence | Yes | Yes for issuance duties | No | No implicit access | No |
| Export delivery links / regenerate capability | Yes | Yes | No | No | No |
| Read/download one delivered PDF | Yes | Yes | No by default | No implicit access | Scoped capability only |
| Read audit history | Tenant events | Tenant issuance events | No by default | Platform review/abuse events | No |
| Record issuer review / suspend issuer | No | No | No | Yes, audited | No |
| Public verification DTO | Yes | Yes | Yes | Yes | Anonymous endpoint only |

Reviewer is a reserved future role; no MVP privileges until explicitly implemented and tested. Basic approval is mandatory; self-approval vs distinct approver is an unresolved product decision. Issuer review criteria, invited-member verification, role granularity and exceptional support access require owner policy. No default platform-wide read of tenant PII is authorized.

## Identity and session flows

Use Supabase Auth for signup, verified email, sign-in, sign-out and password recovery with allowlisted redirect origins. Recovery tokens and sessions never enter logs. Expired/invalid sessions return 401 and require reauthentication; removal/demotion takes effect through current database membership even with an otherwise valid JWT. Account deletion must not cascade-delete issuance/audit history; resolve retention/redaction policy first. Invitations are single-use, expiring, bound to intended verified identity and organization; never allow the last active owner to leave without atomic transfer.

Tenant owner bootstrap is a transaction tied to auth.uid(); invitation acceptance and role transfer cannot let the caller assign platform authority. Member reads must avoid recursive membership RLS; any helper function must have constrained privileges and a pinned search_path. Reauthentication requirements for role changes, admin MFA and emergency support policy remain release decisions.

## Required negative tests

AUTH-01: two tenants, owner/issuer/viewer users in each plus outsider and anonymous; attempt every matrix action by direct Data API, RPC, Edge and Storage requests. AUTH-02: removed member and forged tenant/actor/role values fail with no writes. AUTH-03: tenant owner cannot assign platform admin or self-review issuer. AUTH-04: viewer cannot export contacts, delivery links, evidence or write lifecycle state. AUTH-05: invitation replay, recovery redirect abuse, expired session and last-owner removal are denied. AUTH-06: privileged server paths authenticate actor and check exact resource even when RLS is bypassed. All are planned tests, not executed evidence.
