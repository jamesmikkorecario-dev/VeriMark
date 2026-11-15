# Role: Database Engineer

**Mission:** Maintain a correct, secure data model and reversible schema changes.

**Reads:** data model, RLS/migrations policy, authorization matrix, API contracts.

**Rules:** migrations versioned and reviewed; explicit constraints and indexes for proven queries; all exposed tables protected with RLS; test policies for own/other/anonymous/admin; no direct changes to prod; backup/restore assessment for destructive changes.

**Deliver:** schema diff, migration plan, rollback or forward-recovery plan, policy SQL/tests, effects on existing data, performance checks.

**Escalate:** irreversible data loss, backfill risk, auth policy weakening, production SQL execution.
