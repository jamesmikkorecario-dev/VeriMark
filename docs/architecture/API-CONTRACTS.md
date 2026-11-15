# VeriMark API contracts

Proposed v1 design for implementation, not existing endpoints. Edge paths below are logical routes under the configured Supabase Functions origin. Zod/schema validation runs server-side. Reject unknown fields and malformed IDs; normalize Unicode/whitespace before digesting approved content. Proposed bounds: names/titles 200 characters, achievement 2,000, private reason 1,000; request JSON 256 KiB except CSV (2 MiB, 200 rows). Never accept caller-supplied actor, lifecycle status, issued_at or Storage path as authority.

## Shared behavior

Success: `{data: ..., request_id: string}`; errors: `{error:{code:string,message:string,retryable:boolean,fields?:[{field:string,code:string}]},request_id:string}`. Messages/fields contain no tokens, row contents, SQL or stack traces. 400 VALIDATION; 401 UNAUTHENTICATED; 403 FORBIDDEN for known membership action denial; 404 NOT_FOUND for inaccessible resources to avoid tenant discovery; 409 REVISION_CONFLICT / IDEMPOTENCY_CONFLICT / INVALID_TRANSITION / APPROVAL_REQUIRED / ISSUER_NOT_ELIGIBLE; 413 PAYLOAD_TOO_LARGE; 429 RATE_LIMITED with Retry-After; 503 UNABLE_TO_VERIFY or TEMPORARILY_UNAVAILABLE. Generic unexpected errors are 500 INTERNAL_ERROR. Never translate network/DB failure into not found or valid. UI distinguishes pending, empty list, not found, unauthorized, conflict, rate limited, retryable outage and terminal failure.

Authenticated endpoints require a validated Supabase access JWT (signature, issuer, audience and expiry), then current database membership/role for the target. Do not accept a publishable API key as user authentication. Public verify and delivery endpoints intentionally allow account-free callers but have endpoint-specific validation/throttling/capability checks. CORS allowlists approved frontend origins; it is not authorization. All private/public status responses use Cache-Control: no-store. Logs redact request bodies, bearer values and URL secrets.

Mutations use Idempotency-Key (UUID, scoped by actor+tenant+operation) and expected_revision/version where specified. An exact replay returns the committed original non-secret result; a changed normalized payload with the same key is 409. Safe replay must not regenerate delivery secrets or duplicate audit events. Retain dedupe protection through the supported retry window (proposed 24h); permanent domain uniqueness prevents later reissuance after receipt expiry. After timeout query operation status/replay with the same key; never blindly choose a new key.

## Operations

| Contract / transport | Input and authorization | Success / special failures |
| --- | --- | --- |
| API-01 POST /v1/organizations | JWT; display_name; atomic owner bootstrap | 201 organization ID, revision, pending review; no self-review |
| API-02 POST /v1/organizations/:id/members | owner; intended verified email, role issuer/viewer, expected_revision; protected invite flow | 201 invite reference, expiry; 409 last-owner or stale revision; owner transfer separate atomic RPC |
| API-03 POST /v1/issuer-reviews | platform admin only; organization ID, outcome, private reason, expected_revision | 201 review ID/current state; audit required; tenant owner denied |
| API-04 POST /v1/batches | tenant owner/issuer; template ID+revision, bounded single/CSV validated rows | 201 batch ID, revision, validation errors by row number+field only; no issuance; duplicate source rows rejected |
| API-05 POST /v1/batches/:id/preview | owner/issuer, expected_revision | 200 normalized comparison fields, row count, template revision, preview_digest; no public IDs until issued |
| API-06 POST /v1/batches/:id/approve | authorized MVP approver, expected_revision, preview_digest | 200 approval ID, actor/time, revision; changed content 409; separation policy must be resolved before enablement |
| API-07 POST /v1/batches/:id/issue | owner/issuer; expected_revision, approval ID; eligible reviewed issuer | 201 batch ID, credential references, pdf_state pending; atomic all rows; 409 stale/missing approval or already issued except exact replay |
| API-08 GET /v1/batches/:id/progress | tenant authorized member | 200 total, issued, pdf_pending/ready/failed counts and cursor of row states; no raw errors/contact list |
| API-09 POST /v1/credentials/:id/revoke | owner/issuer; expected_version, private reason | 200 credential ID, effective_status revoked, event ID/server time; no unrevocation; concurrent stale transition 409 |
| API-10 POST /v1/credentials/:id/replace | owner/issuer; expected_version, approved replacement draft ID, private reason | 201 new credential ID/public ID, predecessor reference, PDF pending; atomic predecessor event + successor issuance; no fork |
| API-11 POST /v1/credentials/:id/pdf-retry | owner/issuer; failed job ID, expected_version | 202 job ID/state; ready PDF returns current reference; active lease conflict 409; never issues another credential |
| API-12 POST /v1/credentials/:id/delivery | owner/issuer; lifetime selected under approved policy | 201 one-time returned secret delivery link; replay returns capability reference without plaintext secret; lost response requires explicit authorized regeneration with a new key, revoking prior capability; token hash only stored; export is sensitive |
| API-13 POST /v1/delivery/exchange | no account; secret capability in body, not public ID | 200 exact credential comparison details, public URL, pdf_state and short-lived delivery session; invalid/expired/revoked all 404 DELIVERY_UNAVAILABLE |
| API-14 POST /v1/delivery/download | scoped short-lived delivery session | 200 private signed PDF URL expiring in proposed 60 seconds; 409 PDF_PENDING / PDF_FAILED; no evidence access |
| API-15 POST /v1/verify | no account; exact public_id only | 200 public DTO below; 404 NOT_FOUND; 429 RATE_LIMITED; 503 UNABLE_TO_VERIFY |

Delivery sessions use independently random hashed server-side tokens scoped to credential+download, bounded by parent capability expiry, proposed maximum five minutes. Recheck parent revocation and current PDF readiness at each download. Lifetime proposals require policy acceptance; fail closed until configured. Recovery/regeneration requires issuer authorization; no email-only or name-only access. No account association/wallet in MVP. Use a fragment-based delivery link with immediate client removal from location, submit via POST, no third-party scripts/analytics on delivery pages and Referrer-Policy: no-referrer. Do not put delivery secret in public QR. A stolen bearer link grants its scope; communicate this to distributing issuers.

## Public verification DTO

`{public_id, status, issuer:{display_name,review_state}, recipient_display_name, title, achievement, issued_at, expires_at, checked_at, proof_type:"online_database", replacement_public_id?:string}`. Public name/display fields and successor-link disclosure require product privacy approval before publication; endpoint must remain disabled until approved field policy exists. Omit email, student ID, birthdate, contacts, private reasons, evidence, PDF URLs, internal IDs and audit actors. Issuer label means identity/authority review only, not accreditation. No cryptographic proof checked in MVP.

Public status enum is valid / expired / revoked / replaced. Precedence: revoked > replaced > expired > valid, evaluated from authoritative database state and time in one consistent query. `checked_at` is server UTC. `expires_at == checked_at` means expired. Replacement preserves predecessor URL and displays replacement status; never shows old credential as valid or automatically redirects to new claims. Not found and unable to verify remain distinct HTTP/UI outcomes. Historical issuer snapshot is preserved; current review state is labeled separately. Suspension impact on historical status remains a blocking policy decision; do not silently map suspension to revocation.

## Direct Data API and pagination

Authenticated safe projections for own profile, active memberships, templates, batches, credential snapshots and permitted events are subject to RLS and column grants (see database docs). Draft mutations may use narrow RPCs. No direct client writes to issued snapshots, lifecycle/audit rows, approval records, role grants or protected state. Every listing filters authorized organization_id, uses stable descending (created_at,id) or (issued_at,id) keyset cursor, default 25 / maximum 100, allowlisted filters and sort; cursor never grants access. No public search, wildcard lookup, recipient directory or anonymous GraphQL/base-table access.

## Throttling and acceptance

Proposed initial verify/delivery limit: 30/minute per trusted network identity plus global concurrency/request budget; tune in pilot. Store counters server-side with bounded retention; avoid retaining raw IP where possible. Never trust arbitrary forwarded headers. Return 429 with backoff, not an unlimited DB scan. If throttle dependency fails, fail closed with retryable 503. Add per-credential/token-hash and issuer export limits without revealing whether secrets exist. No CAPTCHA or paid limiter dependency is provisioned here.

Planned CONTRACT-01 covers every success/error schema and forbidden-field omission; AUTH/DB/STORAGE test IDs are in their canonical documents. CONTRACT-02 tests outage vs not-found, all status combinations/exact expiry, comparison instructions, no-store and throttling. CONTRACT-03 tests retries, conflicting keys/revisions, batch partial-failure rollback, PDF pending/failed recovery and capability replay/revocation. Before implementation resolve self-approval, delivery/public privacy policy and suspension behavior; transports may change only with an updated versioned contract and review.
