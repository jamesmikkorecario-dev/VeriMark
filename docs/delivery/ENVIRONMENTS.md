# VeriMark environment boundaries

All environments are planned; no resources/domains/credentials were provisioned or verified.

| Environment | Backend/data | Boundary |
| --- | --- | --- |
| Local | Future local Supabase and synthetic fixtures | Untracked .env.local; no outbound recipient mail |
| Test/CI | Disposable isolated DB/Auth/Storage | Synthetic tenants; no production keys or shared DB resets |
| Preview | Approved isolated preview backend | Exact callback origins, no prod data, private evidence, no real bulk mail |
| Production | Separate controlled backend/domain | Human provisioning/release approval, privacy/eligibility/restore gates |

Use local tests rather than consuming hosted projects per branch. Never assume paid Supabase branching or unlimited free projects. Separate credentials, buckets and redirect allowlists. Untrusted previews receive no privileged tokens; never copy prod secrets/data into preview.

.env.example proposes only browser names: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are intentionally public, maintained by application owner. RLS still enforces authorization. Service-role/secret keys, DB passwords and SMTP credentials must never use VITE_ or enter browser builds. Future trusted secrets belong in approved server/provider stores; record owner and rotation procedure without values. Rotation/production changes require approval. Domains, regions, account owners and retention remain release decisions.
