# API and Integration Contracts

For Supabase direct queries, document tables/views/RPCs and authorization. For Edge Functions, document HTTP contracts.

## Contract template

### API-001 — [Operation]

- **Caller / purpose:** [role and use case]
- **Transport:** [table query / RPC / GET/POST / Edge Function]
- **Auth:** [JWT required? roles/ownership checks?]
- **Input schema:** [fields, types, constraints]
- **Output schema:** [success body]
- **Failure codes:** `400` validation, `401` unauthenticated, `403` unauthorized, `404` hidden/nonexistent, `409` conflict, `429` throttled, `500` safe fallback (as applicable)
- **Pagination/filter/sort:** [limits, stable order]
- **Idempotency/retries:** [if side effects]
- **Version compatibility:** [migration implications]
- **Test references:** [IDs]

## External integrations

Document owner, API scopes, secrets location, request limits, timeouts, failure fallback, user data transmitted, and deletion/retention promises. No secret values here.
