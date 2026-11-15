# Data Model

## Entities (fill before implementation)

| Table | Purpose | Primary key | Owner/tenant key | Relationships | Retention |
| --- | --- | --- | --- | --- | --- |
| `profiles` | public/private user metadata | `id` | `id` = auth user | auth.users | [policy] |

## For each table

Define types, required fields, uniqueness, foreign keys, checks, deletion behavior, default values, indexes driven by actual query patterns, and whether the table is exposed through the Data API.

## Query and lifecycle inventory

- Reads/writes by actor and feature: [..]
- Expected query predicates and order: [..]
- Concurrent update behavior: [..]
- File metadata and storage mapping: [..]
- PII classification and deletion export requirements: [..]
- Seed/demo data policies (never production personal data): [..]

Coordinate with `docs/database/RLS-AND-MIGRATIONS.md`.
