# VeriMark security policy

VeriMark is currently a documentation-stage project; no supported deployed version or disclosure SLA is claimed. Never place credentials, real recipient data, delivery links or private evidence in public issues or commits. Security testing is limited to explicitly authorized local/disposable environments.

A private reporting contact has not yet been designated. Until the repository owner publishes a tested private channel, contact the owner privately through an already trusted channel and request a secure report destination; do not post exploit details publicly. Designating and testing this channel is a public-launch blocker.

A report should provide affected component/version, impact and minimal synthetic reproduction steps without secrets or real records. The owner must triage, contain exposure, preserve restricted audit evidence, coordinate remediation and communicate safely; no guaranteed response period is invented. Secret rotation, production operations and destructive recovery require explicit owner approval.

See `docs/quality/SECURITY-THREAT-MODEL.md`, `docs/backend/AUTH-AND-PERMISSIONS.md` and `docs/database/RLS-AND-MIGRATIONS.md` for planned controls and negative tests. Verification confirms issuer records and status; it does not establish accreditation, achievement truth or portable cryptographic proof.
