# VeriMark security policy

The public site is a portfolio demonstration: fictional data that stays in each visitor's browser, with no backend. No disclosure SLA is claimed. Never place credentials, real recipient data, delivery links or private evidence in public issues or commits. Security testing is limited to explicitly authorized local/disposable environments; do not load-test or attack the hosted demonstration.

Report vulnerabilities privately through GitHub: open this repository's **Security** tab and choose **Report a vulnerability** (GitHub private vulnerability reporting, enabled 2026-11-19). Do not post exploit details in public issues, discussions or pull requests. An end-to-end test of this channel from a non-maintainer account is still pending, and remains a gate before any real pilot.

A report should provide affected component/version, impact and minimal synthetic reproduction steps without secrets or real records. The owner must triage, contain exposure, preserve restricted audit evidence, coordinate remediation and communicate safely; no guaranteed response period is invented. Secret rotation, production operations and destructive recovery require explicit owner approval.

See `docs/quality/SECURITY-THREAT-MODEL.md`, `docs/backend/AUTH-AND-PERMISSIONS.md` and `docs/database/RLS-AND-MIGRATIONS.md` for planned controls and negative tests. Verification confirms issuer records and status; it does not establish accreditation, achievement truth or portable cryptographic proof.
