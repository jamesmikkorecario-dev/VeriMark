# VeriMark definition of done

Documentation setup is ready for review when scoped docs match inputs, examples stay inactive, ownership/diff/link checks pass, sources/unknowns are recorded and coordinator independently reviews the commit. This does not mean the MVP works.

Implementation slices require applicable gates below. The owner-authorized M1 is frontend-only: server/RLS/lifecycle gates are deferred until those features exist, with no backend pass inferred. See docs/ai/handoffs/M1.md.

Implementation gates:

- Working acceptance cases including loading, empty, error, success and denied states.
- Server/database tenant isolation and private Storage policies passing direct negative tests.
- Immutable issued snapshots/history and audited replacement/revocation.
- Relevant unit/component/integration/E2E, a11y/visual/performance and full configured static checks with SHA/commands/results.
- Limited public fields, no directory, safe logs, PDF/QR comparison wording and database-only trust limitations reviewed.
- Updated API/schema/env/docs; migration compatibility, dependency/cost impact understood.
- Independent review resolving critical findings; deviations have owner/rationale/expiry. Missing harness is NOT CONFIGURED, never PASS.

Release additionally needs explicit human approval, privacy review (notice, minimum public fields, retention/correction, legitimate pilot permissions and applicable obligations), hosting eligibility, isolated restore drill, smoke/monitoring owner and compatible rollback. Privacy review is a release prerequisite, not a legal conclusion. No production-readiness claim without evidence.
