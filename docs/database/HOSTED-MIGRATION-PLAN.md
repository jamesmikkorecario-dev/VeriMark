# Hosted Supabase migration plan (development project)

Status 2026-11-16: **preflight only. Nothing has been applied to the hosted project.** Every step marked APPROVAL needs the owner's explicit go-ahead. Never paste a key, password or token into a commit, an issue or a chat.

## Preflight findings

Observed through the project's public endpoints with the publishable key (read-only):

| Check | Result |
| --- | --- |
| `.env.local` | Two variables only; URL has the standard `https://<ref>.supabase.co` shape; key is a new-format publishable key; file is ignored by git and has never been committed |
| Project reachable, key accepted | Yes |
| VeriMark objects present | None (`verify_credential` and `profiles` are unknown to the API) |
| Auth | E-mail sign-up enabled; e-mail confirmation required (`mailer_autoconfirm` false); no phone, anonymous or social sign-in |
| GraphQL endpoint | Enabled. After migration it exposes exactly what the REST API does, under the same grants and policies |

Not observable without database access: PostgreSQL version, objects that exist but are not exposed, existing accounts, and the project's default privileges.

## Is the migration ready?

Yes for a development project, after the three corrections made in this preflight (all covered by tests in `supabase/tests/hosted-readiness.test.ts`):

1. **Accounts that already exist get a profile.** Without this, anyone who signed up before the migration could not create an organization.
2. **The migration grants the API roles access to the `public` schema itself** instead of relying on the project default. It already granted every table column and function explicitly, so it suits a project with automatic table exposure switched off.
3. **A malformed identifier is "not found"**, not "temporarily unavailable" (adapter only).

Compatibility with the project's settings:

- *Automatic exposure off:* no reliance on default grants. `anon` gets two functions and nothing else; `authenticated` gets read access to listed columns of six tables plus the member functions.
- *Automatic row level security on:* the migration also enables it on all 17 tables; doing so twice is harmless (tested).
- Later migrations inherit "no client access by default".

Known side effects and limits to accept before applying:

- `alter default privileges revoke execute on functions from public` is not limited to one schema: functions that the migration role creates later **in any schema** are not callable by other roles until granted. That is intended, but remember it if you later add your own functions or an extension whose functions clients should call.
- Supabase's Security Advisor is expected to report (a) tables with row level security and no policy — eleven tables are reachable only through functions, by design — and (b) `SECURITY DEFINER` functions callable by `anon`/`authenticated` — these functions are the API. Anything else it reports should be looked at.
- Deleting a user in the dashboard fails once that user has a profile referenced by records (no cascading delete of history, by design). There is no erasure procedure yet.
- The local test engine is PostgreSQL 18; the hosted version is unknown. The SQL uses nothing newer than PostgreSQL 13 features as far as reviewed, but this is only proven by applying it.
- Whether the CLI applies a migration file atomically was not verified. If it stops part-way, do not re-run; see "If it fails".
- Rate limiting is one shared budget, not per client. Concurrency was reviewed, not raced.

## Tooling

The Supabase CLI is not installed, Docker is not running, and no access token or database password is available to the orchestrator. Therefore **no dry run was performed**. Flags below are from CLI documentation for earlier major versions; confirm each with `--help` on the installed version before use.

### Step 0 — install the CLI locally (APPROVAL: adds a development dependency)

```powershell
cd C:\Users\James\orca\workspaces\VeriMark\full-stack-integration
npm install --save-dev --save-exact supabase
npx supabase --version
npx supabase init          # creates supabase/config.toml locally; answer "no" to editor settings
```

### Step 1 — authenticate and link (owner does this; it needs your Supabase login and the database password)

```powershell
npx supabase login                               # opens the browser; token is stored in your user profile
npx supabase link --project-ref <project-ref>    # the 20-character ref from the project URL; prompts for the database password
```

### Step 2 — read-only checks

```powershell
npx supabase migration list          # expect: local 20261116000000, remote empty
npx supabase db push --dry-run       # prints what would be applied; changes nothing
```

Stop if the remote already lists migrations, or the dry run shows anything other than `20261116000000_verimark_core.sql`.

Optional, in the dashboard SQL editor (a read-only query, run by the owner): confirm nothing collides.

```sql
select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where (n.nspname = 'public' and c.relkind in ('r','v','m')) or n.nspname = 'app';
select count(*) as existing_accounts from auth.users;
select version();
```

Expect no rows from the first query.

### Step 3 — apply (APPROVAL)

```powershell
npx supabase db push
npx supabase migration list          # expect local and remote both 20261116000000
```

Alternative without the CLI: paste the whole migration file into the SQL editor and run it once. It works, but leaves no migration history, so the CLI route is preferred.

### Step 4 — first platform administrator (APPROVAL; SQL editor)

```sql
insert into public.platform_admins (user_id) select id from auth.users where email = '<your reviewer account>';
```

### Step 5 — verify

```powershell
npm run test:db                      # local suite, unchanged: must still pass
npm run test:hosted                  # after supabase/hosted/README.md; writes test data to the project
npm run dev -- --host 127.0.0.1      # .env.local present => the app uses Supabase
```

### If it fails

Do not re-run and do not reset the database. Capture the error text (it contains no secrets), run the first query in Step 2 to see what was created, and stop for a decision. A cleanup script would drop only VeriMark's own objects and needs separate approval.

## Hosted testing checklist

Automated (`npm run test:hosted`): anonymous and member table denial, private columns, tenant separation, platform administrator isolation, and the pinned outcomes of the end-to-end scenario.

Manual, in the running app against the project:

- [ ] Sign up with an address that can receive mail; the confirmation e-mail arrives; the link returns to `/sign-in`; sign-in works only after confirming. (The built-in sender only delivers to the project's team members and is limited to a few messages an hour.)
- [ ] Password reset: request, e-mail arrives, link opens `/update-password`, new password works, old one does not.
- [ ] Authentication → URL configuration lists `http://127.0.0.1:3000` (and `http://localhost:3000`) with `/sign-in` and `/update-password`.
- [ ] A user created before the migration can sign in and create an organization.
- [ ] Create an organization; it is "pending"; issuing is refused with an explanation.
- [ ] Reviewer account sees `/app/review`, marks the organization reviewed; a non-reviewer cannot open that page's data.
- [ ] Template → single issue → record appears; `/verify/<id>` in a private window shows it valid with public fields only.
- [ ] CSV with one bad row is refused with the row named; a clean CSV issues all rows.
- [ ] Recipient link opens in another browser, removes the secret from the address bar, downloads a PDF whose QR code opens the verification page.
- [ ] Revoke and replace behave as in the demonstration; old recipient links stop working.
- [ ] Invite a second real account as issuer and as viewer; each sees only what its role allows; an invitation opened by a different address is refused.
- [ ] Sign in as a member of a second organization: none of the first organization's records are reachable by address.
- [ ] Dashboard → Table editor shows row level security enabled on all 17 tables; Security Advisor shows only the two expected categories above.
- [ ] Dashboard → API settings: only `public` (and `graphql_public`) are exposed; `app` is not.
- [ ] Usage page stays within free-tier limits; no paid add-on is enabled.

Still not covered after all of the above: real concurrent load, rate-limit exhaustion, backup and restore, privacy review. These remain release prerequisites, not development blockers.
