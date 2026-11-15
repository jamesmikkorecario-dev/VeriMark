# Authentication and Authorization Matrix

Authentication answers **who**, authorization answers **what they may do**. UI gates are convenience, not security.

| Resource/action | Anonymous | Owner | Other user | Moderator/admin |
| --- | --- | --- | --- | --- |
| Read public profile | [Y/N] | [Y/N] | [Y/N] | [Y/N] |
| Edit own record | N | Y | N | [policy] |
| Read private record | N | Y | N | [policy] |

## Flows to define and test

Signup, email confirmation, sign-in/out, password recovery, session expiry, refresh, account deletion, role changes, direct URL access, storage object access, invite/revoke (if applicable).

## Security gates

- Check JWT/session identity at the data/function boundary.
- Verify row/object ownership and privileged role from trusted state.
- Create separate test users for authorization-negative tests.
- Avoid logging tokens or passwords; rotate compromised secrets with approval.
- Test that anonymous/other-user callers cannot access restricted rows or files.
