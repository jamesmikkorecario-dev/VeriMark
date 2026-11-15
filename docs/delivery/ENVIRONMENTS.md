# Environment and Configuration Matrix

| Environment | UI URL | Database/Auth | Secrets location | Can write real user data? |
| --- | --- | --- | --- | --- |
| local | `localhost` | local/dev-only | local untracked `.env` | No |
| test / CI | isolated ephemeral | test-only | CI secret store | No |
| preview | Vercel PR preview | isolated/staging | Vercel Preview secrets | No |
| production | [domain] | production | Vercel/Supabase prod secrets | Yes, controlled |

## Rules

- Only `VITE_` variables intentionally public; **never** put Supabase service-role/secret keys in browser env.
- Document variable names, owner, purpose, whether public, and rotation plan; never document values.
- Ensure preview cannot accidentally mutate production data, process real webhooks, or send real email/SMS unexpectedly.
- Validate allowed redirect/callback URLs per environment.
- Freeze or de-risk migrations until backup/recovery and rollout order are approved.
