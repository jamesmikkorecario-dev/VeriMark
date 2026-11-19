# Private security reporting activation

Prepared 2026-11-18; process proposal, not a live reporting channel. The repository owner's identity/contact and remote GitHub private vulnerability reporting state have not been verified. SECURITY.md remains the public policy authority; its private-channel launch blocker is unresolved. Do not post exploit details in public issues, discussions, pull requests or CI logs.

## Owner activation and testing gate

1. The owner chooses accountable triage and backup operators and a restricted report store, with access limited to those responding. Define retention, acknowledgement/escalation expectations and coverage explicitly; no response SLA is promised here.
2. Prefer GitHub private vulnerability reporting if the repository is public and eligible. The owner must enable it in repository Settings > Security and quality > Advanced Security, then verify the Security tab exposes Report a vulnerability to an external reporter. See [GitHub activation instructions](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository). This task changes no remote settings.
3. Alternatively designate an owner-controlled private inbox/form with restricted access and a secure attachment route. Do not publish a guessed address. An already trusted private conversation may request a destination but is not a publicly discoverable reporting channel.
4. Before launch, submit a harmless synthetic report from a non-maintainer account; verify private visibility, owner and backup notifications, acknowledgement/reply, attachment permissions, escalation and closure. Record date, responsible humans and sanitized evidence privately; publish only the verified channel and expectations in SECURITY.md after separate authorization to edit that file.
5. Re-test after ownership/settings changes. Status 2026-11-19: GitHub private vulnerability reporting is enabled and published in `SECURITY.md`; the synthetic non-maintainer report (step 4) is still pending. That test gates the real pilot. It does not gate the fictional-data portfolio demonstration, which has no backend or personal data.

## Handling a report

Request affected release/commit, component, impact, minimal synthetic reproduction and reporter reply preference. Never request real recipient records, passwords, JWTs, SMTP keys, invitation/delivery capabilities or unrestricted database exports. If such material arrives, restrict access, preserve only necessary evidence and ask the owner to approve containment/rotation; do not forward it to public tickets or test artifacts.

Assign a private case ID, confirm scope and severity, reproduce locally with fictional data, record affected boundaries and appoint a remediation owner. Tenant isolation, anonymous disclosure, credential mutability and session compromise require prompt owner escalation. Preserve original evidence under restricted access with timestamps; coordinate an approved fix, negative regression checks and independent review. Track affected versions and safe disclosure timing with the reporter; publish a redacted advisory only when authorized. Hosted containment, secret rotation and destructive recovery require explicit owner authorization.

## Handoff (HANDOFF-TEMPLATE fields, scoped to assigned ownership)

Task task_7de1d8c30947; owner: hardening-ci worker; independent reviewer: coordinator requested at delivery. Goal: prepare an honest private-reporting process, without inventing contact details or remote activation. No API, migration, environment or cloud changes; decisions above remain proposals. Remaining gate: owner selects operators/channel and completes the external synthetic-report test; no reporting SLA or production support claim is made.
