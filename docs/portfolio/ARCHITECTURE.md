# VeriMark — architecture diagrams

Diagrams use [Mermaid](https://mermaid.js.org/) and render on GitHub. They describe the repository as built; see [CASE-STUDY.md](CASE-STUDY.md) for reasoning and [EVIDENCE.md](EVIDENCE.md) for verification status.

## 1. System context

```mermaid
flowchart LR
  user["Visitor, issuer or recipient<br/>(browser)"]

  subgraph demo["Static demo mode (public site)"]
    vercel["Vercel Hobby<br/>static files plus security headers"]
    spa1["React SPA<br/>demo adapter only"]
    store[("sessionStorage<br/>fictional data, this tab only")]
    vercel --> spa1
    spa1 --> store
  end

  subgraph sb["Supabase mode (not connected to the public site)"]
    spa2["React SPA<br/>Supabase adapter"]
    auth["Supabase Auth"]
    rest["PostgREST<br/>public schema only"]
    pg[("PostgreSQL<br/>RLS, SECURITY DEFINER RPCs,<br/>private app schema")]
    spa2 -->|"sign-in, session"| auth
    spa2 -->|"RPC calls with JWT"| rest
    rest --> pg
    auth -.->|"auth.uid in JWT"| pg
  end

  user -->|"HTTPS"| vercel
  user -.->|"local or self-hosted build"| spa2
```

*Caption:* One React codebase talks to a single `VeriMarkApi` contract with two adapters. The public site is the static demo: `npm run build:demo` compiles the Supabase adapter out, so no request can leave the site's origin. The Supabase mode is tested locally on PostgreSQL and on a disposable hosted project; it is not deployed. Dashed arrows indicate paths not used by the public site.

## 2. Authorization flow for an issuer RPC

Example: `issue_batch`.

```mermaid
sequenceDiagram
  autonumber
  actor Issuer
  participant App as React app
  participant PR as PostgREST
  participant DB as PostgreSQL

  Issuer->>App: Issue approved batch
  App->>PR: POST /rpc/issue_batch with JWT, org, batch, approval, key
  PR->>DB: Run as role authenticated, JWT subject set
  Note over DB: SECURITY DEFINER, search_path empty
  DB->>DB: app.uid() reads auth.uid(), else UNAUTHENTICATED
  DB->>DB: Lock organization row (share)
  DB->>DB: app.require_role locks membership row, checks role
  alt not a member
    DB-->>PR: VM:NOT_FOUND
  else role too low
    DB-->>PR: VM:FORBIDDEN
  else authorized
    DB->>DB: Lock batch, check idempotency receipt
    DB->>DB: Approval revision and digest must match batch now
    DB->>DB: Organization must be reviewed
    DB->>DB: Insert credentials, events, audit rows
    DB->>DB: Store idempotency receipt
    DB-->>PR: credential references
  end
  PR-->>App: JSON result or error
  App->>App: Map VM code to ApiError
```

*Caption:* Authority is decided entirely inside the database. The client holds only a JWT; base tables have no write grants, and every function derives the caller from `auth.uid()` and a row-locked membership. Non-members and unknown objects are indistinguishable (`NOT_FOUND`). Lock order is organization, then membership, then batch or credential rows.

## 3. Credential lifecycle

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Draft: create_batch
  Draft --> Approved: approve_batch (exact preview digest and revision)
  Approved --> Valid: issue_batch (idempotent)
  Valid --> Expired: expires_at reached (derived at read time)
  Valid --> Revoked: revoke_credential
  Valid --> Replaced: replace_credential
  Expired --> Revoked: revoke_credential
  Expired --> Replaced: replace_credential
  Revoked --> [*]
  Replaced --> [*]
```

*Caption:* Issuance is a pipeline of explicit batch states (draft, approved, issued); `preview_batch` is a read that returns the digest the approval must match, and `issue_batch` re-checks that the approval's revision and digest still match the batch at issue time. After issue, status is computed at read time with precedence revoked, replaced, expired, valid. Revoke and replace each refuse a record that is already revoked or replaced (`INVALID_TRANSITION`), so those states are terminal and a revoked record can never read as valid again. Replacement also issues a successor record (next version in the same lineage) in the same transaction. Revoke and replace require a private reason and an idempotency key.

## 4. Recipient delivery

```mermaid
sequenceDiagram
  autonumber
  actor Issuer
  actor Recipient
  participant App as React app
  participant DB as PostgreSQL (RPCs)

  Issuer->>App: Create recipient link
  App->>DB: create_delivery_link (owner or issuer only)
  DB->>DB: Generate 256-bit secret, store SHA-256 hash only
  DB->>DB: Revoke earlier links for this record
  DB-->>App: Secret returned once
  App-->>Issuer: Link with secret in the URL fragment
  Issuer-->>Recipient: Shared manually (no email sent by VeriMark)

  Recipient->>App: Open /receive#secret
  Note over App: Fragment is not sent to any server
  App->>App: Read fragment, then replace history URL
  App->>DB: exchange_delivery(secret)
  DB->>DB: Rate check, hash secret, match active unexpired link
  alt invalid, expired or revoked
    DB-->>App: null (all cases identical)
    App-->>Recipient: Generic unavailable message
  else valid
    DB-->>App: One credential snapshot and template
    App-->>Recipient: Record, PDF download, QR to public verify URL
  end
```

*Caption:* The delivery link is a hash-only bearer capability. The secret never reaches the database in plain form at rest, never appears in a request line or referrer (it lives in the fragment), and is removed from browser history on load. It is repeatable until expiry (30 days default) and is not proof of identity; replacement or revocation disables it.

## 5. CI/CD and release pipeline

```mermaid
flowchart TD
  dev["Local worktrees<br/>isolated branches per task"] --> review["Independent review<br/>and handoff evidence"]
  review --> integ["Integration branch<br/>dev/full-stack-integration"]
  integ -->|"push, owner-approved"| ci1["GitHub Actions: Pilot validation<br/>(Ubuntu, Node 24.19.0)"]

  subgraph checks["Validation steps, no secrets, read-only token"]
    direction TB
    s1["typecheck, lint"] --> s2["unit tests"]
    s2 --> s3["PGlite database and security tests"]
    s3 --> s4["build"]
    s4 --> s5["build:demo with dist scan"]
    s5 --> s6["Playwright e2e, 2 workers"]
    s6 --> s7["live demo journeys"]
  end

  ci1 --> checks
  checks -->|"green"| gate{"Owner release approval"}
  gate -->|"fast-forward main, no force"| ci2["Pilot validation on main"]
  ci2 -->|"green"| vc["Vercel Hobby production build<br/>npm ci, npm run build:demo, dist<br/>no environment variables"]
  vc --> smoke["Production smoke:<br/>headers, asset scan, flows, journeys"]
  smoke --> live["verimark-demo.vercel.app"]
  live -.->|"rollback"| prev["Promote previous deployment"]
```

*Caption:* Nothing is deployed before the integration branch passes Linux CI, and `main` must hold the release commit before Vercel first imports the repository. Hosted Supabase tests are never part of CI; they are separate, individually approved runs against a disposable project. Run IDs and results are in [EVIDENCE.md](EVIDENCE.md).
