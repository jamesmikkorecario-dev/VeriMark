-- Member-first writers can later acquire organization KEY SHARE through FK
-- inserts (including audit rows). Membership administration takes organization
-- UPDATE before waiting for membership, creating a demonstrated deadlock cycle.
-- Make the existing organization -> membership order universal at authorization.
-- SHARE also keeps issuer review/organization state stable during the operation.
-- Existing organization UPDATE holders may acquire their own SHARE lock safely.
create or replace function app.require_role(p_org uuid, p_roles text[]) returns text
language plpgsql set search_path = '' as $$
declare v_uid uuid := app.uid(); v_role text;
begin
  perform 1 from public.organizations o where o.id = p_org for share;
  select m.role into v_role from public.organization_members m
   where m.organization_id = p_org and m.user_id = v_uid for share;
  if v_role is null then perform app.fail('NOT_FOUND'); end if;
  if not (v_role = any (p_roles)) then perform app.fail('FORBIDDEN'); end if;
  return v_role;
end $$;
