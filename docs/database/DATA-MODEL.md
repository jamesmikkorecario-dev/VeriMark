# VeriMark data model

Proposed schema, not applied SQL. All IDs are UUID unless specified; all timestamps timestamptz in UTC, server-generated. Required fields below are non-null unless marked optional. Tenant entities carry organization_id and unique (organization_id,id); child relationships use composite foreign keys including organization_id, never an unscoped child ID alone. Cross-tenant foreign-key injection must fail even inside privileged RPCs.

| Entity | Required fields / constraints and relationships |
| --- | --- |
| profiles | id references auth.users; minimal display metadata; no authority fields |
| organizations | id, display_name, review_state (pending/reviewed/suspended), revision, created_at; current review references protected review history |
| organization_members | organization_id, user_id, role (owner/issuer/viewer), active; unique organization/user; owner transfer protects last owner |
| platform_admins | user_id unique, active, granted_by, granted_at; protected non-client authority |
| issuer_reviews | id, organization_id, actor_id, outcome, reason, created_at; append-only; identity evidence private |
| credential_templates | id, organization_id, revision, name, validated configuration, asset reference/hash; edits create revision; issued snapshots pin revision |
| credential_batches | id, organization_id, revision, state (draft/approved/issued), template revision, created_by; immutable after issued |
| batch_rows | id, organization_id, batch_id, source_row, recipient_display_name, achievement, optional contact; unique (organization_id,batch_id,source_row); draft only |
| batch_approvals | id, organization_id, batch_id, revision, preview_digest, actor_id, created_at; append-only; approval applies only to exact digest |
| credentials | id, organization_id, batch_id, batch_row_id, public_id unique, issued_at, optional expires_at, lineage_id, version_number; unique batch_row_id within tenant; unique lineage/version |
| credential_versions | id, organization_id, credential_id unique, issuer/recipient/title/achievement snapshot, template revision/hash, snapshot_digest; immutable issued content, one snapshot per credential |
| credential_events | id, organization_id, credential_id, type (issued/revoked/replaced), actor_id, server_at, private reason, optional successor_id; append-only; at most one revoked and one replaced transition per credential |
| delivery_capabilities | id, organization_id, credential_id, token_hash unique, expires_at, optional revoked_at; token is separate from public_id; no plaintext token persistence |
| file_assets | id, organization_id, optional credential_id, purpose, bucket, path unique, MIME, bytes, digest, validation_state; references private object |
| pdf_jobs | id, organization_id, credential_id, render_version, state, attempts, lease_until, fencing_token, next_attempt_at, safe_error_code; unique credential/render_version |
| idempotency_receipts | organization_id, actor_id, operation, key, request_digest, response_reference; unique tenant/actor/operation/key; committed atomically |
| audit_logs | id, organization_id optional for platform event, actor_id, action, target reference, request_id, server_at, safe change metadata; append-only |

## Invariants

Public IDs use at least 128 bits from a cryptographically secure random generator, e.g. 16 random bytes encoded base64url; short illustrative VM codes are insufficient. Delivery secrets use at least 256 independent random bits; persist only a cryptographic hash and return plaintext only on creation/export through authorized response. Token lifetime/recovery and link distribution policy require product approval before real delivery.

expires_at is null or greater than issued_at. Issuance uses server transaction time; any separately displayed event/completion date is an approved snapshot claim, not an authority for system expiry. Issued snapshot rows reject UPDATE/DELETE; lifecycle changes append events. Replacement creates new public ID/version and immutable snapshot in the same transaction as predecessor replacement event. No cycles, cross-tenant successor, multiple successor or forks; serialize on lineage and constrain predecessor/successor uniqueness. Revocation is irreversible in MVP; further correction requires a new record. Replacing revoked/previously replaced records returns conflict; concurrent revoke/replace is serialized and loser re-evaluates state. Revocation of a replaced predecessor may still record withdrawal and takes public precedence; successor status is independent and shown separately.

Recipients' emails and optional student identifiers are private and minimized; no student numbers or birthdates needed by MVP. Public fields are governed by API-CONTRACTS.md. Raw CSV staging expires under a retention policy still to be set; never store entire imports in audit payloads. No cascading deletion of credentials, events or audits when membership/account/template is removed. Restrict destructive operations until retention and erasure policy is resolved; preserve attribution through non-sensitive actor references/tombstones where approved.

## Access and indexes

Tenant members query organization_id plus stable (created_at,id) cursor, with indexes on membership(user_id,organization_id,active), batches(organization_id,created_at,id), credentials(organization_id,issued_at,id), events(organization_id,credential_id,server_at,id), and jobs(state,next_attempt_at). Add indexes supporting foreign keys and RLS predicates; validate query plans on representative synthetic data. Global public_id lookup is server-only. Private contact fields, capability hashes, internal jobs/receipts and platform authority live outside client-exposed tables or behind restricted column grants and RPCs; RLS alone does not hide columns.

Retention periods, deletion/export procedure, issuer-suspension effect on historical verification and whether replacement links reveal successor comparison fields remain unresolved. Choose and test policy before pilot rather than inventing legal guarantees.
