-- Inviting an address that already belongs to a member of the organization is refused with a clear validation error,
-- instead of creating an invitation that could never change anything. The owner can already see the member list, so
-- this reveals nothing new. `create or replace` keeps the function's existing privileges (authenticated only).

create or replace function public.create_invite(p_org uuid, p_email text, p_role text) returns jsonb
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
  if exists (select 1 from public.organization_members m join auth.users u on u.id = m.user_id
              where m.organization_id = p_org and lower(u.email) = v_email) then
    perform app.fail('VALIDATION', '[{"field":"email","code":"ALREADY_MEMBER"}]');
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
