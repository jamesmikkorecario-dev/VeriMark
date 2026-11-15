# VeriMark repository structure

Proposed implementation layout; these application paths are not yet scaffolded.

```text
src/
  app/                    # router, providers, session bootstrap
  pages/                  # thin issuer, recipient and verification routes
  features/
    auth/
    organizations/
    templates/
    issuance/             # CSV validation, preview, approval, batch progress
    credentials/          # history, replacement and revocation
    verification/         # public allowlisted response only
    delivery/             # account-free capability exchange and download
  components/ui/          # shadcn primitives with shared accessibility rules
  components/layout/
  lib/                    # publishable Supabase client, errors, configuration
  styles/
  test/
supabase/
  migrations/             # reviewed future SQL; no migration in INIT-B
  functions/              # trusted endpoints and bounded PDF rendering
  tests/                  # RLS, RPC, storage and concurrency integration tests
  seed.sql                # synthetic local fixtures only
e2e/                     # future browser acceptance tests
docs/                    # current source of truth
```

Pages compose feature modules. Features own typed data adapters, schemas, components and tests. Shared UI must not import features. Browser validation types can be shared deliberately; server secrets, privileged clients and server modules must never enter the frontend dependency graph. Generate database types after reviewed migrations; never invent generated types as evidence of schema existence.

Public verification and private delivery use distinct routes and response types; do not place delivery tokens in query caches, analytics, persistent storage or verification URLs. Clear private caches on logout and tenant switch; include tenant ID in query keys. PDFs reference the configured official verification origin, not an arbitrary caller-supplied URL. Test fixtures use synthetic organizations, users and recipients.
