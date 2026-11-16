-- VeriMark core schema, row level security and trusted operations (ADR-0005).
--
-- Trust model
--   * Clients never write tables. `anon` has no table access. `authenticated` may SELECT a few
--     safe columns of its own organizations' rows through RLS; nothing else.
--   * Every mutation and every public lookup is a SECURITY DEFINER function with an empty
--     search_path that authenticates with auth.uid() and authorizes from current membership rows.
--   * Issued credential content is immutable and history tables are append-only (triggers).
--   * Errors raised for clients have the message `VM:<CODE>`; DETAIL carries a JSON field list
--     for VM:VALIDATION and the retry delay in seconds for VM:RATE_LIMITED.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id),
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 120),
  review_state text not null default 'pending' check (review_state in ('pending', 'reviewed', 'suspended')),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id),
  role text not null check (role in ('owner', 'issuer', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id, organization_id);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('issuer', 'viewer')),
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz
);
create index organization_invites_org_idx on public.organization_invites (organization_id, created_at desc);
create unique index organization_invites_outstanding_idx on public.organization_invites (organization_id, email)
  where accepted_at is null and revoked_at is null;

-- Platform authority is granted only by an operator with direct database access. No function writes this table.
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id),
  granted_at timestamptz not null default now()
);

create table public.issuer_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  actor_id uuid not null references public.profiles (id),
  outcome text not null check (outcome in ('pending', 'reviewed', 'suspended')),
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index issuer_reviews_org_idx on public.issuer_reviews (organization_id, created_at desc);

create table public.credential_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(name) between 1 and 120),
  revision integer not null default 1 check (revision > 0),
  config jsonb not null,
  archived boolean not null default false,
  created_by uuid not null references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index credential_templates_org_idx on public.credential_templates (organization_id, updated_at desc);

create table public.credential_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  template_id uuid not null,
  template_revision integer not null,
  template_name text not null,
  template_config jsonb not null,           -- pinned copy; later template edits never change a batch
  source text not null check (source in ('single', 'csv')),
  state text not null default 'draft' check (state in ('draft', 'approved', 'issued')),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, template_id) references public.credential_templates (organization_id, id)
);
create index credential_batches_org_idx on public.credential_batches (organization_id, created_at desc, id);

create table public.batch_rows (
  organization_id uuid not null,
  batch_id uuid not null,
  source_row integer not null check (source_row between 1 and 200),
  recipient_display_name text not null check (char_length(recipient_display_name) between 1 and 200),
  title text not null check (char_length(title) between 1 and 200),
  achievement text not null check (char_length(achievement) between 1 and 2000),
  recipient_email text check (char_length(recipient_email) <= 254),
  expires_at timestamptz,
  primary key (batch_id, source_row),
  foreign key (organization_id, batch_id) references public.credential_batches (organization_id, id)
);

create table public.batch_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  revision integer not null,
  preview_digest text not null,
  actor_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, batch_id) references public.credential_batches (organization_id, id)
);
create index batch_approvals_batch_idx on public.batch_approvals (batch_id);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  batch_id uuid,
  source_row integer,
  public_id text not null unique check (public_id ~ '^[A-Za-z0-9_-]{22}$'),
  lineage_id uuid not null,
  version_number integer not null check (version_number > 0),
  issued_at timestamptz not null,
  expires_at timestamptz,
  issuer_display_name text not null,
  recipient_display_name text not null check (char_length(recipient_display_name) between 1 and 200),
  title text not null check (char_length(title) between 1 and 200),
  achievement text not null check (char_length(achievement) between 1 and 2000),
  recipient_email text,
  template_config jsonb not null,
  snapshot_digest text not null,
  revoked_at timestamptz,
  replaced_at timestamptz,
  replaced_by uuid,
  unique (organization_id, id),
  unique (batch_id, source_row),
  unique (lineage_id, version_number),
  unique (replaced_by),
  check (expires_at is null or expires_at > issued_at),
  check ((replaced_at is null) = (replaced_by is null)),
  foreign key (organization_id, batch_id) references public.credential_batches (organization_id, id),
  foreign key (organization_id, replaced_by) references public.credentials (organization_id, id)
);
create index credentials_org_issued_idx on public.credentials (organization_id, issued_at desc, id desc);

create table public.credential_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  credential_id uuid not null,
  type text not null check (type in ('issued', 'revoked', 'replaced')),
  actor_id uuid not null references public.profiles (id),
  at timestamptz not null default now(),
  reason text check (char_length(reason) between 1 and 1000),
  successor_id uuid,
  foreign key (organization_id, credential_id) references public.credentials (organization_id, id),
  foreign key (organization_id, successor_id) references public.credentials (organization_id, id)
);
-- At most one of each lifecycle transition per credential.
create unique index credential_events_once_idx on public.credential_events (credential_id, type);
create index credential_events_org_idx on public.credential_events (organization_id, credential_id, at, id);

create table public.delivery_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  credential_id uuid not null,
  token_hash bytea not null unique,          -- SHA-256 of the secret; the secret itself is never stored
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, credential_id) references public.credentials (organization_id, id)
);
create index delivery_capabilities_credential_idx on public.delivery_capabilities (credential_id);

create table public.idempotency_receipts (
  organization_id uuid not null references public.organizations (id),
  actor_id uuid not null references public.profiles (id),
  operation text not null,
  key uuid not null,
  request_digest text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, actor_id, operation, key)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id),
  actor_id uuid not null references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  target_label text not null default '',
  at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, id desc);

create table public.verification_counters (
  organization_id uuid primary key references public.organizations (id),
  checks bigint not null default 0
);

create table public.rate_windows (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (schema app is not exposed through the Data API)
-- ---------------------------------------------------------------------------------------------

create function app.fail(p_code text, p_detail text default '') returns void
language plpgsql set search_path = '' as $$
begin
  raise exception 'VM:%', p_code using errcode = 'P0001', detail = coalesce(p_detail, '');
end $$;

create function app.uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED'); end if;
  return v_uid;
end $$;

-- Lock order for every operation: organization row, then membership row, then batch or credential rows.
-- Returns the caller's role after locking the membership row, so removal or demotion cannot race the caller's transaction.
-- Non-members get NOT_FOUND (no tenant discovery); members without a listed role get FORBIDDEN.
create function app.require_role(p_org uuid, p_roles text[]) returns text
language plpgsql set search_path = '' as $$
declare v_uid uuid := app.uid(); v_role text;
begin
  select m.role into v_role from public.organization_members m
   where m.organization_id = p_org and m.user_id = v_uid for share;
  if v_role is null then perform app.fail('NOT_FOUND'); end if;
  if not (v_role = any (p_roles)) then perform app.fail('FORBIDDEN'); end if;
  return v_role;
end $$;

create function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m where m.organization_id = p_org and m.user_id = auth.uid());
$$;

create function app.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

create function app.clean(p_text text) returns text
language sql immutable set search_path = '' as $$ select normalize(btrim(p_text), NFC); $$;

-- Validation code for one JSON text value, or null when acceptable.
create function app.text_error(p_value jsonb, p_max integer, p_required boolean) returns text
language plpgsql immutable set search_path = '' as $$
declare v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return case when p_required then 'REQUIRED' end;
  end if;
  if jsonb_typeof(p_value) <> 'string' then return 'INVALID'; end if;
  v_text := app.clean(p_value #>> '{}');
  if v_text = '' then return case when p_required then 'REQUIRED' end; end if;
  if char_length(v_text) > p_max then return 'TOO_LONG'; end if;
  if v_text ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then return 'INVALID'; end if;
  return null;
end $$;

-- 'YYYY-MM-DD' means valid through the end of that UTC day. Returns null for absent input; raises on malformed input.
create function app.expiry_from_date(p_value jsonb) returns timestamptz
language plpgsql immutable set search_path = '' as $$
declare v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  if jsonb_typeof(p_value) <> 'string' then raise exception 'invalid date'; end if;
  v_text := btrim(p_value #>> '{}');
  if v_text = '' then return null; end if;
  if v_text !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date'; end if;
  return ((v_text::date + 1)::timestamp at time zone 'UTC');
end $$;

-- All validation problems of one recipient row as a JSON array of {field, code, row}.
create function app.row_errors(p_row jsonb, p_number integer) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_code text;
  v_email text;
  v_expires timestamptz;
begin
  if p_row is null or jsonb_typeof(p_row) <> 'object' then
    return jsonb_build_array(jsonb_build_object('field', 'row', 'code', 'INVALID', 'row', p_number));
  end if;
  if exists (select 1 from jsonb_object_keys(p_row) k
              where k not in ('recipientDisplayName', 'title', 'achievement', 'recipientEmail', 'expiresOn')) then
    v_errors := v_errors || jsonb_build_object('field', 'row', 'code', 'UNKNOWN_FIELD', 'row', p_number);
  end if;
  v_code := app.text_error(p_row -> 'recipientDisplayName', 200, true);
  if v_code is not null then v_errors := v_errors || jsonb_build_object('field', 'recipientDisplayName', 'code', v_code, 'row', p_number); end if;
  v_code := app.text_error(p_row -> 'title', 200, true);
  if v_code is not null then v_errors := v_errors || jsonb_build_object('field', 'title', 'code', v_code, 'row', p_number); end if;
  v_code := app.text_error(p_row -> 'achievement', 2000, true);
  if v_code is not null then v_errors := v_errors || jsonb_build_object('field', 'achievement', 'code', v_code, 'row', p_number); end if;

  v_code := app.text_error(p_row -> 'recipientEmail', 254, false);
  if v_code is null and jsonb_typeof(p_row -> 'recipientEmail') = 'string' then
    v_email := app.clean(p_row ->> 'recipientEmail');
    if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_code := 'INVALID'; end if;
  end if;
  if v_code is not null then v_errors := v_errors || jsonb_build_object('field', 'recipientEmail', 'code', v_code, 'row', p_number); end if;

  begin
    v_expires := app.expiry_from_date(p_row -> 'expiresOn');
    if v_expires is not null and v_expires <= now() then
      v_errors := v_errors || jsonb_build_object('field', 'expiresOn', 'code', 'PAST_DATE', 'row', p_number);
    end if;
  exception when others then
    v_errors := v_errors || jsonb_build_object('field', 'expiresOn', 'code', 'INVALID', 'row', p_number);
  end;
  return v_errors;
end $$;

create function app.template_config_ok(p_config jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(p_config) k
              where k not in ('heading', 'bodyPrefix', 'signatoryName', 'signatoryTitle', 'accent', 'orientation')) then return false; end if;
  if app.text_error(p_config -> 'heading', 120, true) is not null then return false; end if;
  if app.text_error(p_config -> 'bodyPrefix', 200, true) is not null then return false; end if;
  if app.text_error(p_config -> 'signatoryName', 120, true) is not null then return false; end if;
  if app.text_error(p_config -> 'signatoryTitle', 120, true) is not null then return false; end if;
  if coalesce(p_config ->> 'accent', '') not in ('forest', 'ink', 'ochre') then return false; end if;
  if coalesce(p_config ->> 'orientation', '') not in ('landscape', 'portrait') then return false; end if;
  return true;
end $$;

create function app.clean_template_config(p_config jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'heading', app.clean(p_config ->> 'heading'), 'bodyPrefix', app.clean(p_config ->> 'bodyPrefix'),
    'signatoryName', app.clean(p_config ->> 'signatoryName'), 'signatoryTitle', app.clean(p_config ->> 'signatoryTitle'),
    'accent', p_config ->> 'accent', 'orientation', p_config ->> 'orientation');
$$;

create function app.sha256_hex(p_text text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(p_text, 'UTF8'), 'sha256'), 'hex');
$$;

create function app.token_hash(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

-- URL-safe random identifier: 16 bytes -> 22 characters (128 bits), 32 bytes -> 43 characters (256 bits).
create function app.random_token(p_bytes integer) returns text
language sql volatile set search_path = '' as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), E'+/\n', '-_'), '=');
$$;

create function app.credential_status(p_revoked timestamptz, p_replaced timestamptz, p_expires timestamptz, p_now timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case when p_revoked is not null then 'revoked'
              when p_replaced is not null then 'replaced'
              when p_expires is not null and p_expires <= p_now then 'expired'
              else 'valid' end;
$$;

-- Digest of exactly what an approver reviews: pinned template and every normalized row.
create function app.batch_digest(p_batch uuid) returns text
language sql stable set search_path = '' as $$
  select app.sha256_hex(jsonb_build_object(
    'template', b.template_id, 'templateRevision', b.template_revision, 'config', b.template_config,
    'rows', coalesce((select jsonb_agg(jsonb_build_array(r.source_row, r.recipient_display_name, r.title, r.achievement,
                                                         coalesce(r.recipient_email, ''), coalesce(extract(epoch from r.expires_at)::bigint, 0))
                                       order by r.source_row)
                        from public.batch_rows r where r.batch_id = b.id), '[]'::jsonb))::text)
    from public.credential_batches b where b.id = p_batch;
$$;

create function app.audit(p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_label text) returns void
language sql set search_path = '' as $$
  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, target_label)
  values (p_org, auth.uid(), p_action, p_target_type, p_target_id, left(coalesce(p_label, ''), 200));
$$;

-- Returns the stored response for an exact replay, null when the key is new, and fails when the key was used for a different request.
create function app.receipt_get(p_org uuid, p_operation text, p_key uuid, p_digest text) returns jsonb
language plpgsql set search_path = '' as $$
declare v_receipt public.idempotency_receipts;
begin
  if p_key is null then perform app.fail('VALIDATION', '[{"field":"idempotencyKey","code":"REQUIRED"}]'); end if;
  select * into v_receipt from public.idempotency_receipts r
   where r.organization_id = p_org and r.actor_id = auth.uid() and r.operation = p_operation and r.key = p_key;
  if not found then return null; end if;
  if v_receipt.request_digest <> p_digest then perform app.fail('IDEMPOTENCY_CONFLICT'); end if;
  return v_receipt.response;
end $$;

create function app.receipt_put(p_org uuid, p_operation text, p_key uuid, p_digest text, p_response jsonb) returns void
language sql set search_path = '' as $$
  insert into public.idempotency_receipts (organization_id, actor_id, operation, key, request_digest, response)
  values (p_org, auth.uid(), p_operation, p_key, p_digest, p_response);
$$;

-- Fixed one-minute window shared by all callers. Fails closed: any error here aborts the calling lookup.
create function app.rate_check(p_bucket text, p_limit integer) returns void
language plpgsql set search_path = '' as $$
declare v_window timestamptz := date_trunc('minute', now()); v_hits integer;
begin
  insert into public.rate_windows as w (bucket, window_start, hits) values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = w.hits + 1
  returning w.hits into v_hits;
  if v_hits = 1 then
    delete from public.rate_windows where window_start < v_window - interval '1 hour';
  end if;
  if v_hits > p_limit then
    perform app.fail('RATE_LIMITED', greatest(1, ceil(extract(epoch from (v_window + interval '1 minute' - clock_timestamp()))))::integer::text);
  end if;
end $$;

create function app.organization_json(o public.organizations) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'displayName', o.display_name, 'reviewState', o.review_state, 'revision', o.revision, 'createdAt', o.created_at);
$$;

create function app.template_json(t public.credential_templates) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'organizationId', t.organization_id, 'name', t.name, 'revision', t.revision,
                            'config', t.config, 'archived', t.archived, 'updatedAt', t.updated_at);
$$;

create function app.credential_summary_json(c public.credentials, p_now timestamptz) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'publicId', c.public_id, 'recipientDisplayName', c.recipient_display_name, 'title', c.title,
    'achievement', c.achievement, 'issuedAt', c.issued_at, 'expiresAt', c.expires_at,
    'status', app.credential_status(c.revoked_at, c.replaced_at, c.expires_at, p_now), 'versionNumber', c.version_number);
$$;

-- ---------------------------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------------------------

create function app.reject_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'VM:INVALID_TRANSITION' using errcode = 'P0001', detail = tg_table_name || ' is append-only';
end $$;

create function app.guard_credential_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'revoked_at' - 'replaced_at' - 'replaced_by') is distinct from (to_jsonb(old) - 'revoked_at' - 'replaced_at' - 'replaced_by') then
    raise exception 'VM:INVALID_TRANSITION' using errcode = 'P0001', detail = 'issued content is immutable';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'VM:INVALID_TRANSITION' using errcode = 'P0001', detail = 'revocation is irreversible';
  end if;
  if old.replaced_at is not null and (new.replaced_at is distinct from old.replaced_at or new.replaced_by is distinct from old.replaced_by) then
    raise exception 'VM:INVALID_TRANSITION' using errcode = 'P0001', detail = 'replacement is irreversible';
  end if;
  return new;
end $$;

create trigger credentials_guard_update before update on public.credentials for each row execute function app.guard_credential_update();
create trigger credentials_no_delete before delete on public.credentials for each row execute function app.reject_change();
create trigger credentials_no_truncate before truncate on public.credentials for each statement execute function app.reject_change();
create trigger credential_events_append_only before update or delete on public.credential_events for each row execute function app.reject_change();
create trigger credential_events_no_truncate before truncate on public.credential_events for each statement execute function app.reject_change();
create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function app.reject_change();
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function app.reject_change();
create trigger issuer_reviews_append_only before update or delete on public.issuer_reviews for each row execute function app.reject_change();
create trigger batch_approvals_append_only before update or delete on public.batch_approvals for each row execute function app.reject_change();
create trigger issuer_reviews_no_truncate before truncate on public.issuer_reviews for each statement execute function app.reject_change();
create trigger batch_approvals_no_truncate before truncate on public.batch_approvals for each statement execute function app.reject_change();

-- A profile row for every account. Only a display name is taken from user-editable metadata; never authority.
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(app.clean(new.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Member'), 120))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger verimark_on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- Accounts created before this migration (for example while setting the project up) get the same profile row.
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(app.clean(u.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Member'), 120)
  from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Organizations, members, invitations
-- ---------------------------------------------------------------------------------------------

create function public.my_memberships() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := app.uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('organizationId', o.id, 'organizationName', o.display_name, 'role', m.role, 'reviewState', o.review_state)
                                    order by o.created_at, o.id)
                     from public.organization_members m join public.organizations o on o.id = m.organization_id
                    where m.user_id = v_uid), '[]'::jsonb);
end $$;

create function public.create_organization(p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_name text := app.clean(coalesce(p_display_name, '')); v_org public.organizations;
begin
  if app.text_error(to_jsonb(v_name), 120, true) is not null then
    perform app.fail('VALIDATION', jsonb_build_array(jsonb_build_object('field', 'displayName', 'code', app.text_error(to_jsonb(v_name), 120, true)))::text);
  end if;
  -- Serialize per user so the cap below cannot be raced.
  perform 1 from public.profiles p where p.id = v_uid for update;
  if (select count(*) from public.organizations o where o.created_by = v_uid) >= 5 then perform app.fail('RATE_LIMITED', '86400'); end if;
  insert into public.organizations (display_name, created_by) values (v_name, v_uid) returning * into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org.id, v_uid, 'owner');
  insert into public.verification_counters (organization_id) values (v_org.id);
  perform app.audit(v_org.id, 'organization.created', 'organization', v_org.id, v_org.display_name);
  return app.organization_json(v_org);
end $$;

create function public.get_organization(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org public.organizations;
begin
  perform app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  select * into v_org from public.organizations o where o.id = p_org;
  return app.organization_json(v_org);
end $$;

create function public.rename_organization(p_org uuid, p_display_name text, p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_name text := app.clean(coalesce(p_display_name, '')); v_org public.organizations;
begin
  select * into v_org from public.organizations o where o.id = p_org for update;
  perform app.require_role(p_org, array['owner']);
  if app.text_error(to_jsonb(v_name), 120, true) is not null then
    perform app.fail('VALIDATION', jsonb_build_array(jsonb_build_object('field', 'displayName', 'code', app.text_error(to_jsonb(v_name), 120, true)))::text);
  end if;
  if v_org.revision is distinct from p_expected_revision then perform app.fail('REVISION_CONFLICT'); end if;
  update public.organizations o set display_name = v_name, revision = o.revision + 1 where o.id = p_org returning * into v_org;
  perform app.audit(p_org, 'organization.renamed', 'organization', p_org, v_name);
  return app.organization_json(v_org);
end $$;

create function public.list_members(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  return coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'displayName', p.display_name, 'role', m.role, 'joinedAt', m.created_at)
                                    order by m.created_at, m.user_id)
                     from public.organization_members m join public.profiles p on p.id = m.user_id
                    where m.organization_id = p_org), '[]'::jsonb);
end $$;

-- Membership changes lock the organization row first, so the last-owner rule cannot be raced.
create function public.set_member_role(p_org uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_current text;
begin
  perform 1 from public.organizations o where o.id = p_org for update;
  perform app.require_role(p_org, array['owner']);
  if p_role is null or p_role not in ('owner', 'issuer', 'viewer') then
    perform app.fail('VALIDATION', '[{"field":"role","code":"INVALID"}]');
  end if;
  select m.role into v_current from public.organization_members m where m.organization_id = p_org and m.user_id = p_user for update;
  if v_current is null then perform app.fail('NOT_FOUND'); end if;
  if v_current = p_role then return; end if;
  if v_current = 'owner' and (select count(*) from public.organization_members m where m.organization_id = p_org and m.role = 'owner') <= 1 then
    perform app.fail('INVALID_TRANSITION', 'last owner');
  end if;
  update public.organization_members m set role = p_role where m.organization_id = p_org and m.user_id = p_user;
  perform app.audit(p_org, 'member.role_changed', 'member', p_user, p_role);
end $$;

create function public.remove_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_current text;
begin
  perform 1 from public.organizations o where o.id = p_org for update;
  perform app.require_role(p_org, array['owner']);
  select m.role into v_current from public.organization_members m where m.organization_id = p_org and m.user_id = p_user for update;
  if v_current is null then perform app.fail('NOT_FOUND'); end if;
  if v_current = 'owner' and (select count(*) from public.organization_members m where m.organization_id = p_org and m.role = 'owner') <= 1 then
    perform app.fail('INVALID_TRANSITION', 'last owner');
  end if;
  delete from public.organization_members m where m.organization_id = p_org and m.user_id = p_user;
  perform app.audit(p_org, 'member.removed', 'member', p_user, v_current);
end $$;

create function public.list_invites(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_role(p_org, array['owner']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'expiresAt', i.expires_at, 'createdAt', i.created_at)
                                    order by i.created_at desc, i.id)
                     from public.organization_invites i
                    where i.organization_id = p_org and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()), '[]'::jsonb);
end $$;

create function public.create_invite(p_org uuid, p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_email text := lower(app.clean(coalesce(p_email, ''))); v_token text; v_invite public.organization_invites;
begin
  -- Serializes the daily cap and the supersession of earlier invitations for the same address.
  perform 1 from public.organizations o where o.id = p_org for update;
  perform app.require_role(p_org, array['owner']);
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform app.fail('VALIDATION', '[{"field":"email","code":"INVALID"}]');
  end if;
  if p_role is null or p_role not in ('issuer', 'viewer') then
    perform app.fail('VALIDATION', '[{"field":"role","code":"INVALID"}]');
  end if;
  if (select count(*) from public.organization_invites i where i.organization_id = p_org and i.created_at > now() - interval '1 day') >= 50 then
    perform app.fail('RATE_LIMITED', '3600');
  end if;
  update public.organization_invites i set revoked_at = now()
   where i.organization_id = p_org and i.email = v_email and i.accepted_at is null and i.revoked_at is null;
  v_token := app.random_token(32);
  insert into public.organization_invites (organization_id, email, role, token_hash, expires_at, created_by)
  values (p_org, v_email, p_role, app.token_hash(v_token), now() + interval '7 days', v_uid) returning * into v_invite;
  perform app.audit(p_org, 'invite.created', 'invite', v_invite.id, p_role);
  return jsonb_build_object('id', v_invite.id, 'email', v_invite.email, 'role', v_invite.role, 'expiresAt', v_invite.expires_at,
                            'createdAt', v_invite.created_at, 'token', v_token);
end $$;

create function public.revoke_invite(p_org uuid, p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.organizations o where o.id = p_org for update;
  perform app.require_role(p_org, array['owner']);
  update public.organization_invites i set revoked_at = now()
   where i.organization_id = p_org and i.id = p_invite and i.accepted_at is null and i.revoked_at is null;
  if not found then perform app.fail('NOT_FOUND'); end if;
  perform app.audit(p_org, 'invite.revoked', 'invite', p_invite, '');
end $$;

-- The invite is bound to the invited address: only an account whose confirmed e-mail matches can accept it.
create function public.accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_invite public.organization_invites; v_email text; v_org public.organizations; v_role text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then perform app.fail('NOT_FOUND'); end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;
  -- Find the organization without locking, lock it (lock order), then re-read the invitation under the lock.
  perform 1 from public.organizations o
   where o.id = (select i.organization_id from public.organization_invites i where i.token_hash = app.token_hash(p_token))
   for update;
  select * into v_invite from public.organization_invites i
   where i.token_hash = app.token_hash(p_token) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
   for update;
  if not found or v_email is null or v_invite.email <> v_email then perform app.fail('NOT_FOUND'); end if;
  update public.organization_invites i set accepted_at = now(), accepted_by = v_uid where i.id = v_invite.id;
  insert into public.organization_members (organization_id, user_id, role) values (v_invite.organization_id, v_uid, v_invite.role)
  on conflict (organization_id, user_id) do nothing;      -- an existing member keeps the current role
  select m.role into v_role from public.organization_members m where m.organization_id = v_invite.organization_id and m.user_id = v_uid;
  select * into v_org from public.organizations o where o.id = v_invite.organization_id;
  perform app.audit(v_org.id, 'invite.accepted', 'member', v_uid, v_role);
  return jsonb_build_object('organizationId', v_org.id, 'organizationName', v_org.display_name, 'role', v_role, 'reviewState', v_org.review_state);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Platform review
-- ---------------------------------------------------------------------------------------------

create function public.is_platform_admin() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.uid();
  return app.is_admin();
end $$;

create function public.list_review_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.uid();
  if not app.is_admin() then perform app.fail('FORBIDDEN'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('organizationId', o.id, 'displayName', o.display_name, 'reviewState', o.review_state,
                                                       'revision', o.revision, 'createdAt', o.created_at,
                                                       'lastReviewAt', (select max(r.created_at) from public.issuer_reviews r where r.organization_id = o.id))
                                    order by (o.review_state = 'pending') desc, o.created_at, o.id)
                     from public.organizations o), '[]'::jsonb);
end $$;

-- An administrator who belongs to the organization cannot review it (no self-review).
create function public.record_issuer_review(p_org uuid, p_outcome text, p_reason text, p_expected_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_reason text := app.clean(coalesce(p_reason, '')); v_org public.organizations;
begin
  if not app.is_admin() then perform app.fail('FORBIDDEN'); end if;
  if p_outcome is null or p_outcome not in ('pending', 'reviewed', 'suspended') then
    perform app.fail('VALIDATION', '[{"field":"outcome","code":"INVALID"}]');
  end if;
  if app.text_error(to_jsonb(v_reason), 1000, true) is not null then
    perform app.fail('VALIDATION', jsonb_build_array(jsonb_build_object('field', 'reason', 'code', app.text_error(to_jsonb(v_reason), 1000, true)))::text);
  end if;
  select * into v_org from public.organizations o where o.id = p_org for update;
  if not found then perform app.fail('NOT_FOUND'); end if;
  if exists (select 1 from public.organization_members m where m.organization_id = p_org and m.user_id = v_uid) then
    perform app.fail('FORBIDDEN', 'self review');
  end if;
  if v_org.revision is distinct from p_expected_revision then perform app.fail('REVISION_CONFLICT'); end if;
  update public.organizations o set review_state = p_outcome, revision = o.revision + 1 where o.id = p_org;
  insert into public.issuer_reviews (organization_id, actor_id, outcome, reason) values (p_org, v_uid, p_outcome, v_reason);
  perform app.audit(p_org, 'organization.review_recorded', 'organization', p_org, p_outcome);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------------------------

create function public.list_templates(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  return coalesce((select jsonb_agg(app.template_json(t) order by t.updated_at desc, t.id)
                     from public.credential_templates t where t.organization_id = p_org), '[]'::jsonb);
end $$;

create function public.save_template(p_org uuid, p_id uuid, p_name text, p_config jsonb, p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_name text := app.clean(coalesce(p_name, '')); v_errors jsonb := '[]'::jsonb; v_template public.credential_templates;
begin
  if p_id is null then
    perform 1 from public.organizations o where o.id = p_org for update;   -- serializes the template cap
  end if;
  perform app.require_role(p_org, array['owner', 'issuer']);
  if app.text_error(to_jsonb(v_name), 120, true) is not null then
    v_errors := v_errors || jsonb_build_object('field', 'name', 'code', app.text_error(to_jsonb(v_name), 120, true));
  end if;
  if not app.template_config_ok(p_config) then v_errors := v_errors || jsonb_build_object('field', 'config', 'code', 'INVALID'); end if;
  if jsonb_array_length(v_errors) > 0 then perform app.fail('VALIDATION', v_errors::text); end if;
  if p_id is null then
    if (select count(*) from public.credential_templates t where t.organization_id = p_org) >= 200 then perform app.fail('RATE_LIMITED', '86400'); end if;
    insert into public.credential_templates (organization_id, name, config, created_by)
    values (p_org, v_name, app.clean_template_config(p_config), v_uid) returning * into v_template;
    perform app.audit(p_org, 'template.created', 'template', v_template.id, v_name);
  else
    select * into v_template from public.credential_templates t where t.organization_id = p_org and t.id = p_id for update;
    if not found then perform app.fail('NOT_FOUND'); end if;
    if v_template.revision is distinct from p_expected_revision then perform app.fail('REVISION_CONFLICT'); end if;
    update public.credential_templates t
       set name = v_name, config = app.clean_template_config(p_config), revision = t.revision + 1, updated_at = now()
     where t.id = p_id returning * into v_template;
    perform app.audit(p_org, 'template.updated', 'template', v_template.id, v_name);
  end if;
  return app.template_json(v_template);
end $$;

create function public.archive_template(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  perform app.require_role(p_org, array['owner', 'issuer']);
  update public.credential_templates t set archived = true, revision = t.revision + 1, updated_at = now()
   where t.organization_id = p_org and t.id = p_id and not t.archived returning t.name into v_name;
  if not found then
    if not exists (select 1 from public.credential_templates t where t.organization_id = p_org and t.id = p_id) then perform app.fail('NOT_FOUND'); end if;
    return;
  end if;
  perform app.audit(p_org, 'template.archived', 'template', p_id, v_name);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Issuance: draft -> preview -> approve exact digest -> issue (atomic, idempotent)
-- ---------------------------------------------------------------------------------------------

create function public.create_batch(p_org uuid, p_template uuid, p_source text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.uid(); v_template public.credential_templates; v_batch public.credential_batches;
  v_errors jsonb := '[]'::jsonb; v_count integer; v_row jsonb; v_number integer;
begin
  perform app.require_role(p_org, array['owner', 'issuer']);
  if p_source is null or p_source not in ('single', 'csv') then perform app.fail('VALIDATION', '[{"field":"source","code":"INVALID"}]'); end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then perform app.fail('VALIDATION', '[{"field":"rows","code":"INVALID"}]'); end if;
  if octet_length(p_rows::text) > 2097152 then perform app.fail('PAYLOAD_TOO_LARGE'); end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 then perform app.fail('VALIDATION', '[{"field":"rows","code":"REQUIRED"}]'); end if;
  if v_count > 200 or (p_source = 'single' and v_count <> 1) then perform app.fail('VALIDATION', '[{"field":"rows","code":"TOO_MANY"}]'); end if;
  select * into v_template from public.credential_templates t where t.organization_id = p_org and t.id = p_template and not t.archived for share;
  if not found then perform app.fail('NOT_FOUND'); end if;

  for v_row, v_number in select e.value, e.ordinality::integer from jsonb_array_elements(p_rows) with ordinality e loop
    v_errors := v_errors || app.row_errors(v_row, v_number);
  end loop;
  if jsonb_array_length(v_errors) = 0 then
    -- Duplicate rows (same recipient, title and achievement) are reported on the later row.
    select coalesce(jsonb_agg(jsonb_build_object('field', 'row', 'code', 'DUPLICATE', 'row', d.n) order by d.n), '[]'::jsonb) into v_errors
      from (select e.ordinality::integer as n,
                   row_number() over (partition by lower(app.clean(e.value ->> 'recipientDisplayName')), lower(app.clean(e.value ->> 'title')),
                                                   lower(app.clean(e.value ->> 'achievement')) order by e.ordinality) as occurrence
              from jsonb_array_elements(p_rows) with ordinality e) d
     where d.occurrence > 1;
  end if;
  if jsonb_array_length(v_errors) > 0 then perform app.fail('VALIDATION', v_errors::text); end if;

  insert into public.credential_batches (organization_id, template_id, template_revision, template_name, template_config, source, created_by)
  values (p_org, v_template.id, v_template.revision, v_template.name, v_template.config, p_source, v_uid) returning * into v_batch;
  insert into public.batch_rows (organization_id, batch_id, source_row, recipient_display_name, title, achievement, recipient_email, expires_at)
  select p_org, v_batch.id, e.ordinality::integer, app.clean(e.value ->> 'recipientDisplayName'), app.clean(e.value ->> 'title'),
         app.clean(e.value ->> 'achievement'), nullif(lower(app.clean(coalesce(e.value ->> 'recipientEmail', ''))), ''),
         app.expiry_from_date(e.value -> 'expiresOn')
    from jsonb_array_elements(p_rows) with ordinality e;
  perform app.audit(p_org, 'batch.created', 'batch', v_batch.id, v_count::text || ' row(s)');
  return jsonb_build_object('batchId', v_batch.id, 'revision', v_batch.revision, 'rowCount', v_count);
end $$;

create function public.preview_batch(p_org uuid, p_batch uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_batch public.credential_batches;
begin
  perform app.require_role(p_org, array['owner', 'issuer']);
  select * into v_batch from public.credential_batches b where b.organization_id = p_org and b.id = p_batch;
  if not found then perform app.fail('NOT_FOUND'); end if;
  return jsonb_build_object('batchId', v_batch.id, 'revision', v_batch.revision, 'templateId', v_batch.template_id,
    'templateRevision', v_batch.template_revision, 'templateName', v_batch.template_name,
    'rowCount', (select count(*) from public.batch_rows r where r.batch_id = v_batch.id),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('sourceRow', r.source_row, 'recipientDisplayName', r.recipient_display_name, 'title', r.title,
                                                         'achievement', r.achievement, 'expiresAt', r.expires_at) order by r.source_row)
                        from public.batch_rows r where r.batch_id = v_batch.id), '[]'::jsonb),
    'previewDigest', app.batch_digest(v_batch.id));
end $$;

create function public.approve_batch(p_org uuid, p_batch uuid, p_expected_revision integer, p_preview_digest text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_batch public.credential_batches; v_approval public.batch_approvals;
begin
  perform app.require_role(p_org, array['owner', 'issuer']);
  select * into v_batch from public.credential_batches b where b.organization_id = p_org and b.id = p_batch for update;
  if not found then perform app.fail('NOT_FOUND'); end if;
  if v_batch.state = 'issued' then perform app.fail('INVALID_TRANSITION'); end if;
  if v_batch.revision is distinct from p_expected_revision or app.batch_digest(v_batch.id) is distinct from p_preview_digest then
    perform app.fail('REVISION_CONFLICT');
  end if;
  insert into public.batch_approvals (organization_id, batch_id, revision, preview_digest, actor_id)
  values (p_org, v_batch.id, v_batch.revision, p_preview_digest, v_uid) returning * into v_approval;
  update public.credential_batches b set state = 'approved' where b.id = v_batch.id;
  perform app.audit(p_org, 'batch.approved', 'batch', v_batch.id, '');
  return jsonb_build_object('approvalId', v_approval.id, 'approvedAt', v_approval.created_at);
end $$;

create function public.issue_batch(p_org uuid, p_batch uuid, p_approval uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.uid(); v_org public.organizations; v_batch public.credential_batches; v_approval public.batch_approvals;
  v_digest text; v_response jsonb; v_now timestamptz := now(); v_row public.batch_rows; v_id uuid; v_public text; v_refs jsonb := '[]'::jsonb;
begin
  -- Lock order: organization, membership, batch. A concurrent suspension or member removal waits or wins cleanly.
  select * into v_org from public.organizations o where o.id = p_org for share;
  perform app.require_role(p_org, array['owner', 'issuer']);
  select * into v_batch from public.credential_batches b where b.organization_id = p_org and b.id = p_batch for update;
  if not found then perform app.fail('NOT_FOUND'); end if;

  v_digest := app.sha256_hex(p_batch::text || ':' || coalesce(p_approval::text, ''));
  v_response := app.receipt_get(p_org, 'issue_batch', p_key, v_digest);
  if v_response is not null then return v_response; end if;

  if v_batch.state = 'issued' then perform app.fail('INVALID_TRANSITION'); end if;
  if v_batch.state <> 'approved' then perform app.fail('APPROVAL_REQUIRED'); end if;
  select * into v_approval from public.batch_approvals a where a.id = p_approval and a.batch_id = v_batch.id and a.organization_id = p_org;
  if not found or v_approval.revision <> v_batch.revision or v_approval.preview_digest is distinct from app.batch_digest(v_batch.id) then
    perform app.fail('APPROVAL_REQUIRED');
  end if;
  if v_org.review_state <> 'reviewed' then perform app.fail('ISSUER_NOT_ELIGIBLE'); end if;
  if exists (select 1 from public.batch_rows r where r.batch_id = v_batch.id and r.expires_at is not null and r.expires_at <= v_now) then
    perform app.fail('VALIDATION', '[{"field":"expiresOn","code":"PAST_DATE"}]');
  end if;

  for v_row in select * from public.batch_rows r where r.batch_id = v_batch.id order by r.source_row loop
    v_id := gen_random_uuid();
    v_public := app.random_token(16);
    insert into public.credentials (id, organization_id, batch_id, source_row, public_id, lineage_id, version_number, issued_at, expires_at,
      issuer_display_name, recipient_display_name, title, achievement, recipient_email, template_config, snapshot_digest)
    values (v_id, p_org, v_batch.id, v_row.source_row, v_public, gen_random_uuid(), 1, v_now, v_row.expires_at,
      v_org.display_name, v_row.recipient_display_name, v_row.title, v_row.achievement, v_row.recipient_email, v_batch.template_config,
      app.sha256_hex(jsonb_build_array(v_org.display_name, v_row.recipient_display_name, v_row.title, v_row.achievement,
                                       coalesce(extract(epoch from v_row.expires_at)::bigint, 0), v_batch.template_config)::text));
    insert into public.credential_events (organization_id, credential_id, type, actor_id, at) values (p_org, v_id, 'issued', v_uid, v_now);
    perform app.audit(p_org, 'credential.issued', 'credential', v_id, v_row.recipient_display_name || ' — ' || v_row.title);
    v_refs := v_refs || jsonb_build_object('id', v_id, 'publicId', v_public, 'sourceRow', v_row.source_row);
  end loop;
  update public.credential_batches b set state = 'issued' where b.id = v_batch.id;
  v_response := jsonb_build_object('batchId', v_batch.id, 'credentials', v_refs);
  perform app.receipt_put(p_org, 'issue_batch', p_key, v_digest, v_response);
  return v_response;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Credentials and lifecycle
-- ---------------------------------------------------------------------------------------------

create function public.list_credentials(p_org uuid, p_search text default null, p_status text default 'all', p_cursor text default null, p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now(); v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_pattern text; v_after_at timestamptz; v_after_id uuid; v_items jsonb; v_next text; v_count integer;
begin
  perform app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  if coalesce(p_status, 'all') not in ('all', 'valid', 'expired', 'revoked', 'replaced') then
    perform app.fail('VALIDATION', '[{"field":"status","code":"INVALID"}]');
  end if;
  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    if char_length(p_search) > 200 then perform app.fail('VALIDATION', '[{"field":"search","code":"TOO_LONG"}]'); end if;
    v_pattern := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if p_cursor is not null then
    begin
      v_after_at := split_part(p_cursor, '|', 1)::timestamptz;
      v_after_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      perform app.fail('VALIDATION', '[{"field":"cursor","code":"INVALID"}]');
    end;
  end if;
  with page as (
    select c as cred, c.issued_at, c.id from public.credentials c
     where c.organization_id = p_org
       and (v_pattern is null or c.recipient_display_name ilike v_pattern or c.title ilike v_pattern or c.public_id ilike v_pattern)
       and (coalesce(p_status, 'all') = 'all' or app.credential_status(c.revoked_at, c.replaced_at, c.expires_at, v_now) = p_status)
       and (v_after_at is null or (c.issued_at, c.id) < (v_after_at, v_after_id))
     order by c.issued_at desc, c.id desc
     limit v_limit + 1
  ), numbered as (select p.*, row_number() over (order by p.issued_at desc, p.id desc) as n from page p)
  select coalesce(jsonb_agg(app.credential_summary_json(n.cred, v_now) order by n.n) filter (where n.n <= v_limit), '[]'::jsonb),
         count(*),
         max(to_char(n.issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || n.id::text) filter (where n.n = v_limit)
    into v_items, v_count, v_next from numbered n;
  return jsonb_build_object('items', v_items, 'nextCursor', case when v_count > v_limit then v_next end);
end $$;

create function public.get_credential(p_org uuid, p_credential uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_role text; v_c public.credentials; v_now timestamptz := now();
begin
  v_role := app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  select * into v_c from public.credentials c where c.organization_id = p_org and c.id = p_credential;
  if not found then perform app.fail('NOT_FOUND'); end if;
  return app.credential_summary_json(v_c, v_now) || jsonb_build_object(
    'issuerDisplayName', v_c.issuer_display_name,
    'template', v_c.template_config,
    'recipientEmail', case when v_role in ('owner', 'issuer') then v_c.recipient_email end,
    'replacedByPublicId', (select s.public_id from public.credentials s where s.id = v_c.replaced_by),
    'replacesPublicId', (select p.public_id from public.credentials p where p.replaced_by = v_c.id),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'at', e.at, 'actorDisplayName', pr.display_name,
                                                           'reason', case when v_role in ('owner', 'issuer') then e.reason end) order by e.at, e.id)
                          from public.credential_events e join public.profiles pr on pr.id = e.actor_id
                         where e.credential_id = v_c.id), '[]'::jsonb));
end $$;

create function public.revoke_credential(p_org uuid, p_credential uuid, p_reason text, p_key uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_reason text := app.clean(coalesce(p_reason, '')); v_c public.credentials; v_digest text; v_now timestamptz := now();
begin
  perform app.require_role(p_org, array['owner', 'issuer']);
  select * into v_c from public.credentials c where c.organization_id = p_org and c.id = p_credential for update;
  if not found then perform app.fail('NOT_FOUND'); end if;
  v_digest := app.sha256_hex(p_credential::text || ':' || v_reason);
  if app.receipt_get(p_org, 'revoke_credential', p_key, v_digest) is not null then return; end if;
  if app.text_error(to_jsonb(v_reason), 1000, true) is not null then
    perform app.fail('VALIDATION', jsonb_build_array(jsonb_build_object('field', 'reason', 'code', app.text_error(to_jsonb(v_reason), 1000, true)))::text);
  end if;
  if v_c.revoked_at is not null or v_c.replaced_at is not null then perform app.fail('INVALID_TRANSITION'); end if;
  update public.credentials c set revoked_at = v_now where c.id = v_c.id;
  insert into public.credential_events (organization_id, credential_id, type, actor_id, at, reason) values (p_org, v_c.id, 'revoked', v_uid, v_now, v_reason);
  update public.delivery_capabilities d set revoked_at = v_now where d.credential_id = v_c.id and d.revoked_at is null;
  perform app.audit(p_org, 'credential.revoked', 'credential', v_c.id, v_c.recipient_display_name || ' — ' || v_c.title);
  perform app.receipt_put(p_org, 'revoke_credential', p_key, v_digest, '{"ok":true}'::jsonb);
end $$;

-- Issues a successor in the same lineage and marks the predecessor replaced, in one transaction. The predecessor's content never changes.
create function public.replace_credential(p_org uuid, p_credential uuid, p_reason text, p_replacement jsonb, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.uid(); v_reason text := app.clean(coalesce(p_reason, '')); v_org public.organizations; v_c public.credentials;
  v_digest text; v_response jsonb; v_errors jsonb; v_now timestamptz := now(); v_id uuid := gen_random_uuid(); v_public text;
  v_name text; v_title text; v_achievement text; v_email text; v_expires timestamptz;
begin
  select * into v_org from public.organizations o where o.id = p_org for share;
  perform app.require_role(p_org, array['owner', 'issuer']);
  select * into v_c from public.credentials c where c.organization_id = p_org and c.id = p_credential for update;
  if not found then perform app.fail('NOT_FOUND'); end if;
  v_digest := app.sha256_hex(p_credential::text || ':' || v_reason || ':' || coalesce(p_replacement::text, ''));
  v_response := app.receipt_get(p_org, 'replace_credential', p_key, v_digest);
  if v_response is not null then return v_response; end if;

  v_errors := app.row_errors(p_replacement, 1);
  if app.text_error(to_jsonb(v_reason), 1000, true) is not null then
    v_errors := v_errors || jsonb_build_object('field', 'reason', 'code', app.text_error(to_jsonb(v_reason), 1000, true));
  end if;
  if jsonb_array_length(v_errors) > 0 then perform app.fail('VALIDATION', v_errors::text); end if;
  if v_c.revoked_at is not null or v_c.replaced_at is not null then perform app.fail('INVALID_TRANSITION'); end if;
  if v_org.review_state <> 'reviewed' then perform app.fail('ISSUER_NOT_ELIGIBLE'); end if;

  v_name := app.clean(p_replacement ->> 'recipientDisplayName');
  v_title := app.clean(p_replacement ->> 'title');
  v_achievement := app.clean(p_replacement ->> 'achievement');
  v_email := nullif(lower(app.clean(coalesce(p_replacement ->> 'recipientEmail', ''))), '');
  v_expires := app.expiry_from_date(p_replacement -> 'expiresOn');
  v_public := app.random_token(16);
  insert into public.credentials (id, organization_id, public_id, lineage_id, version_number, issued_at, expires_at,
    issuer_display_name, recipient_display_name, title, achievement, recipient_email, template_config, snapshot_digest)
  values (v_id, p_org, v_public, v_c.lineage_id, v_c.version_number + 1, v_now, v_expires,
    v_org.display_name, v_name, v_title, v_achievement, v_email, v_c.template_config,
    app.sha256_hex(jsonb_build_array(v_org.display_name, v_name, v_title, v_achievement, coalesce(extract(epoch from v_expires)::bigint, 0), v_c.template_config)::text));
  update public.credentials c set replaced_at = v_now, replaced_by = v_id where c.id = v_c.id;
  insert into public.credential_events (organization_id, credential_id, type, actor_id, at, reason, successor_id)
  values (p_org, v_c.id, 'replaced', v_uid, v_now, v_reason, v_id);
  insert into public.credential_events (organization_id, credential_id, type, actor_id, at) values (p_org, v_id, 'issued', v_uid, v_now);
  update public.delivery_capabilities d set revoked_at = v_now where d.credential_id = v_c.id and d.revoked_at is null;
  perform app.audit(p_org, 'credential.replaced', 'credential', v_c.id, v_c.recipient_display_name || ' — ' || v_c.title);
  perform app.audit(p_org, 'credential.issued', 'credential', v_id, v_name || ' — ' || v_title);
  v_response := jsonb_build_object('id', v_id, 'publicId', v_public, 'sourceRow', 1);
  perform app.receipt_put(p_org, 'replace_credential', p_key, v_digest, v_response);
  return v_response;
end $$;

-- Creates a new private delivery link and revokes earlier ones. The secret is returned once and only its hash is stored.
create function public.create_delivery_link(p_org uuid, p_credential uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.uid(); v_c public.credentials; v_token text := app.random_token(32); v_expires timestamptz := now() + interval '30 days';
begin
  perform app.require_role(p_org, array['owner', 'issuer']);
  select * into v_c from public.credentials c where c.organization_id = p_org and c.id = p_credential for update;
  if not found then perform app.fail('NOT_FOUND'); end if;
  if v_c.revoked_at is not null or v_c.replaced_at is not null then perform app.fail('INVALID_TRANSITION'); end if;
  update public.delivery_capabilities d set revoked_at = now() where d.credential_id = v_c.id and d.revoked_at is null;
  insert into public.delivery_capabilities (organization_id, credential_id, token_hash, expires_at, created_by)
  values (p_org, v_c.id, app.token_hash(v_token), v_expires, v_uid);
  perform app.audit(p_org, 'delivery_link.created', 'credential', v_c.id, v_c.recipient_display_name || ' — ' || v_c.title);
  return jsonb_build_object('token', v_token, 'expiresAt', v_expires);
end $$;

-- ---------------------------------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------------------------------

create function public.list_audit(p_org uuid, p_cursor text default null, p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100); v_after bigint; v_items jsonb; v_count integer;
begin
  perform app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  if p_cursor is not null then
    if p_cursor !~ '^\d{1,18}$' then perform app.fail('VALIDATION', '[{"field":"cursor","code":"INVALID"}]'); end if;
    v_after := p_cursor::bigint;
  end if;
  with page as (
    select a.id, a.at, a.action, a.target_label, p.display_name
      from public.audit_log a join public.profiles p on p.id = a.actor_id
     where a.organization_id = p_org and (v_after is null or a.id < v_after)
     order by a.id desc limit v_limit + 1
  ), numbered as (select p.*, row_number() over (order by p.id desc) as n from page p)
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id::text, 'at', n.at, 'actorDisplayName', n.display_name, 'action', n.action, 'targetLabel', n.target_label)
                            order by n.n) filter (where n.n <= v_limit), '[]'::jsonb), count(*)
    into v_items, v_count from numbered n;
  return jsonb_build_object('items', v_items, 'nextCursor', case when v_count > v_limit then v_items -> (v_limit - 1) ->> 'id' end);
end $$;

create function public.get_metrics(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := now(); v_result jsonb;
begin
  perform app.require_role(p_org, array['owner', 'issuer', 'viewer']);
  select jsonb_build_object(
      'issued', count(*),
      'valid', count(*) filter (where s.status = 'valid'), 'expired', count(*) filter (where s.status = 'expired'),
      'revoked', count(*) filter (where s.status = 'revoked'), 'replaced', count(*) filter (where s.status = 'replaced'))
    into v_result
    from (select app.credential_status(c.revoked_at, c.replaced_at, c.expires_at, v_now) as status
            from public.credentials c where c.organization_id = p_org) s;
  return v_result || jsonb_build_object('verificationChecks',
    coalesce((select v.checks from public.verification_counters v where v.organization_id = p_org), 0));
end $$;

-- ---------------------------------------------------------------------------------------------
-- Public, account-free operations
-- ---------------------------------------------------------------------------------------------

-- Exact lookup by unpredictable identifier. Returns only the public allowlist, or NULL when there is no such record;
-- malformed and unknown identifiers are indistinguishable. A miss returns NULL instead of raising so that the
-- rate-budget increment is committed: failed guesses must count.
create function public.verify_credential(p_public_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_c public.credentials; v_org public.organizations; v_now timestamptz := now();
begin
  perform app.rate_check('verify', 600);
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{22}$' then return null; end if;
  select * into v_c from public.credentials c where c.public_id = p_public_id;
  if not found then return null; end if;
  select * into v_org from public.organizations o where o.id = v_c.organization_id;
  update public.verification_counters v set checks = v.checks + 1 where v.organization_id = v_c.organization_id;
  return jsonb_build_object(
    'publicId', v_c.public_id,
    'status', app.credential_status(v_c.revoked_at, v_c.replaced_at, v_c.expires_at, v_now),
    'issuer', jsonb_build_object('displayName', v_c.issuer_display_name, 'reviewState', v_org.review_state),
    'recipientDisplayName', v_c.recipient_display_name, 'title', v_c.title, 'achievement', v_c.achievement,
    'issuedAt', v_c.issued_at, 'expiresAt', v_c.expires_at, 'checkedAt', v_now, 'proofType', 'online_database',
    'replacementPublicId', (select s.public_id from public.credentials s where s.id = v_c.replaced_by));
end $$;

-- Exchanges a private delivery secret for the one credential it was created for. Every failure is the same NULL
-- (not an exception, so failed guesses count against the rate budget).
create function public.exchange_delivery(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_c public.credentials; v_now timestamptz := now();
begin
  perform app.rate_check('delivery', 120);
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  select c.* into v_c from public.delivery_capabilities d join public.credentials c on c.id = d.credential_id
   where d.token_hash = app.token_hash(p_token) and d.revoked_at is null and d.expires_at > v_now;
  if not found then return null; end if;
  return jsonb_build_object(
    'publicId', v_c.public_id, 'status', app.credential_status(v_c.revoked_at, v_c.replaced_at, v_c.expires_at, v_now),
    'issuerDisplayName', v_c.issuer_display_name, 'recipientDisplayName', v_c.recipient_display_name, 'title', v_c.title,
    'achievement', v_c.achievement, 'issuedAt', v_c.issued_at, 'expiresAt', v_c.expires_at, 'template', v_c.template_config);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Row level security and privileges
-- ---------------------------------------------------------------------------------------------

do $$
declare v_table text;
begin
  foreach v_table in array array['profiles', 'organizations', 'organization_members', 'organization_invites', 'platform_admins', 'issuer_reviews',
    'credential_templates', 'credential_batches', 'batch_rows', 'batch_approvals', 'credentials', 'credential_events', 'delivery_capabilities',
    'idempotency_receipts', 'audit_log', 'verification_counters', 'rate_windows'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
  end loop;
end $$;
revoke all on all sequences in schema public from public, anon, authenticated;

-- Read-only member access to safe columns. Private columns (contacts, reasons, hashes, receipts) are never granted.
grant select (id, display_name, review_state, revision, created_at) on public.organizations to authenticated;
grant select (organization_id, user_id, role, created_at) on public.organization_members to authenticated;
grant select (id, organization_id, name, revision, config, archived, updated_at) on public.credential_templates to authenticated;
grant select (id, organization_id, public_id, lineage_id, version_number, issued_at, expires_at, issuer_display_name, recipient_display_name,
              title, achievement, template_config, revoked_at, replaced_at, replaced_by) on public.credentials to authenticated;
grant select (id, organization_id, credential_id, type, at, successor_id) on public.credential_events to authenticated;
grant select (id, organization_id, action, target_type, target_id, target_label, at) on public.audit_log to authenticated;

create policy organizations_member_read on public.organizations for select to authenticated using (app.is_member(id));
create policy organization_members_member_read on public.organization_members for select to authenticated using (app.is_member(organization_id));
create policy credential_templates_member_read on public.credential_templates for select to authenticated using (app.is_member(organization_id));
create policy credentials_member_read on public.credentials for select to authenticated using (app.is_member(organization_id));
create policy credential_events_member_read on public.credential_events for select to authenticated using (app.is_member(organization_id));
create policy audit_log_member_read on public.audit_log for select to authenticated using (organization_id is not null and app.is_member(organization_id));

-- Functions: nothing is executable by default; grant each operation to exactly the roles that need it.
revoke all on all functions in schema app from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated;
-- The API roles need to reach the functions and the few readable tables in public. Stated here so the migration does
-- not depend on a project's defaults (USAGE lets a role look objects up; it grants no access to any of them).
grant usage on schema public to anon, authenticated;
grant execute on function app.is_member(uuid) to authenticated;

grant execute on function
  public.my_memberships(), public.create_organization(text), public.get_organization(uuid), public.rename_organization(uuid, text, integer),
  public.list_members(uuid), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid),
  public.list_invites(uuid), public.create_invite(uuid, text, text), public.revoke_invite(uuid, uuid), public.accept_invite(text),
  public.is_platform_admin(), public.list_review_queue(), public.record_issuer_review(uuid, text, text, integer),
  public.list_templates(uuid), public.save_template(uuid, uuid, text, jsonb, integer), public.archive_template(uuid, uuid),
  public.create_batch(uuid, uuid, text, jsonb), public.preview_batch(uuid, uuid), public.approve_batch(uuid, uuid, integer, text),
  public.issue_batch(uuid, uuid, uuid, uuid),
  public.list_credentials(uuid, text, text, text, integer), public.get_credential(uuid, uuid),
  public.revoke_credential(uuid, uuid, text, uuid), public.replace_credential(uuid, uuid, text, jsonb, uuid),
  public.create_delivery_link(uuid, uuid), public.list_audit(uuid, text, integer), public.get_metrics(uuid)
to authenticated;
grant execute on function public.verify_credential(text), public.exchange_delivery(text) to anon, authenticated;

-- Objects created by later migrations start with no client access; each must be granted explicitly, as above.
-- (Applies to objects created by the role running this migration, which is the role that runs all migrations.)
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema app revoke all on functions from public, anon, authenticated;
alter default privileges revoke execute on functions from public;
