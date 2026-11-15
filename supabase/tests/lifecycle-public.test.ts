import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issue, platformAdmin, row, tenant, TestDb, uuid, type Tenant } from './harness';

// US-005/006/007, CONTRACT-02: public allowlist, status precedence, revoke/replace rules, delivery secrets.
let db: TestDb; let admin: string; let t: Tenant;
beforeAll(async () => { db = await TestDb.create(); admin = await platformAdmin(db); t = await tenant(db, admin, 'alpha'); });
afterAll(() => db.close());

type Verified = { publicId: string; status: string; replacementPublicId: string | null; issuer: { displayName: string; reviewState: string }; checkedAt: string };
const verify = (publicId: unknown) => db.rpc<Verified>(null, 'verify_credential', { p_public_id: publicId });
const revoke = (id: string, key = uuid(), reason = 'Issued in error', actor = t.issuer) => db.rpc(actor, 'revoke_credential', { p_org: t.org, p_credential: id, p_reason: reason, p_key: key });
const replace = (id: string, replacement: unknown, key = uuid(), reason = 'Name corrected') => db.rpc<{ id: string; publicId: string }>(t.issuer, 'replace_credential', { p_org: t.org, p_credential: id, p_reason: reason, p_replacement: replacement, p_key: key });
const link = (id: string, actor = t.issuer) => db.rpc<{ token: string; expiresAt: string }>(actor, 'create_delivery_link', { p_org: t.org, p_credential: id });
const exchange = (token: unknown) => db.rpc<Record<string, unknown>>(null, 'exchange_delivery', { p_token: token });

describe('public verification', () => {
  it('returns exactly the public allowlist and nothing private', async () => {
    const [c] = await issue(db, t, [row('Alex Santos', { recipientEmail: 'private-contact@example.test', expiresOn: '2099-12-31' })]);
    const result = await verify(c.publicId);
    expect(Object.keys(result).sort()).toEqual(['achievement', 'checkedAt', 'expiresAt', 'issuedAt', 'issuer', 'proofType', 'publicId', 'recipientDisplayName', 'replacementPublicId', 'status', 'title']);
    expect(Object.keys(result.issuer).sort()).toEqual(['displayName', 'reviewState']);
    expect(result).toMatchObject({ publicId: c.publicId, status: 'valid', proofType: 'online_database', replacementPublicId: null, issuer: { displayName: 'alpha Collective', reviewState: 'reviewed' } });
    const text = JSON.stringify(result);
    for (const secret of ['private-contact@example.test', c.id, t.org, t.issuer]) expect(text).not.toContain(secret);
  });
  it('unknown, malformed and hostile identifiers are all NOT_FOUND', async () => {
    for (const id of ['A'.repeat(22), '', 'short', 'A'.repeat(23), "'; drop table credentials; --", '%'.repeat(22), 'A'.repeat(21) + '\n', null]) {
      expect((await db.fails(verify(id))).code).toBe('NOT_FOUND');
    }
  });
  it('an internal id is not a public id', async () => {
    const [c] = await issue(db, t, [row('Internal Id Person')]);
    expect((await db.fails(verify(c.id))).code).toBe('NOT_FOUND');
  });
  it('counts checks per organization for found records only', async () => {
    const [c] = await issue(db, t, [row('Counted Person')]);
    const before = (await db.rpc<{ verificationChecks: number }>(t.viewer, 'get_metrics', { p_org: t.org })).verificationChecks;
    await verify(c.publicId); await verify(c.publicId); await db.fails(verify('B'.repeat(22)));
    expect((await db.rpc<{ verificationChecks: number }>(t.viewer, 'get_metrics', { p_org: t.org })).verificationChecks).toBe(before + 2);
  });
  it('is expired exactly at the expiry instant and valid just before it', async () => {
    const [c] = await issue(db, t, [row('Expiry Person', { expiresOn: '2099-01-01' })]);
    const status = async (offset: string) => (await db.admin<{ s: string }>(`select app.credential_status(null, null, now() ${offset}, now()) as s`))[0].s;
    expect(await status("+ interval '1 microsecond'")).toBe('valid');
    expect(await status('')).toBe('expired');
    expect(await status("- interval '1 microsecond'")).toBe('expired');
    expect((await verify(c.publicId)).status).toBe('valid');
  });
  it('precedence is revoked > replaced > expired > valid', async () => {
    const s = async (revoked: boolean, replaced: boolean, expired: boolean) => (await db.admin<{ s: string }>(
      `select app.credential_status(${revoked ? 'now()' : 'null'}, ${replaced ? 'now()' : 'null'}, ${expired ? "now() - interval '1 day'" : 'null'}, now()) as s`))[0].s;
    expect(await s(true, true, true)).toBe('revoked');
    expect(await s(false, true, true)).toBe('replaced');
    expect(await s(false, false, true)).toBe('expired');
    expect(await s(false, false, false)).toBe('valid');
  });
  it('fails closed with RATE_LIMITED once the shared budget is used, and recovers in the next window', async () => {
    const [c] = await issue(db, t, [row('Throttle Person')]);
    await db.admin("insert into public.rate_windows (bucket, window_start, hits) values ('verify', date_trunc('minute', now()), 600) on conflict (bucket, window_start) do update set hits = 600");
    const error = await db.fails(verify(c.publicId));
    expect(error.code).toBe('RATE_LIMITED');
    expect(Number(error.detail)).toBeGreaterThanOrEqual(1);
    expect(Number(error.detail)).toBeLessThanOrEqual(60);
    await db.admin("delete from public.rate_windows where bucket = 'verify'");
    expect((await verify(c.publicId)).status).toBe('valid');
  });
});

describe('revocation', () => {
  it('revokes once, is irreversible, and shows as revoked publicly without the reason', async () => {
    const [c] = await issue(db, t, [row('Revoked Person')]);
    await revoke(c.id, uuid(), 'Private reason: disciplinary');
    const result = await verify(c.publicId);
    expect(result.status).toBe('revoked');
    expect(JSON.stringify(result)).not.toContain('disciplinary');
    expect((await db.fails(revoke(c.id))).code).toBe('INVALID_TRANSITION');
    expect((await db.fails(replace(c.id, row('After Revocation')))).code).toBe('INVALID_TRANSITION');
    await expect(db.admin('update public.credentials set revoked_at = null where id = $1', [c.id])).rejects.toThrow('VM:INVALID_TRANSITION');
    expect(await db.admin("select count(*)::int as n from public.credential_events where credential_id = $1 and type = 'revoked'", [c.id])).toEqual([{ n: 1 }]);
  });
  it('an exact replay is accepted silently and a reused key with another reason conflicts', async () => {
    const [c] = await issue(db, t, [row('Replay Revoked')]); const key = uuid();
    await revoke(c.id, key, 'Same reason'); await revoke(c.id, key, 'Same reason');
    expect((await db.fails(revoke(c.id, key, 'Different reason'))).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await db.admin("select count(*)::int as n from public.audit_log where target_id = $1 and action = 'credential.revoked'", [c.id])).toEqual([{ n: 1 }]);
  });
  it('requires a reason within limits', async () => {
    const [c] = await issue(db, t, [row('Reason Person')]);
    expect((await db.fails(revoke(c.id, uuid(), '   '))).code).toBe('VALIDATION');
    expect((await db.fails(revoke(c.id, uuid(), 'x'.repeat(1001)))).code).toBe('VALIDATION');
    expect((await verify(c.publicId)).status).toBe('valid');
  });
  it('members see the reason; viewers do not', async () => {
    const [c] = await issue(db, t, [row('Reason Visibility')]); await revoke(c.id, uuid(), 'Internal note');
    const events = async (actor: string) => (await db.rpc<{ events: { type: string; reason: string | null }[] }>(actor, 'get_credential', { p_org: t.org, p_credential: c.id })).events;
    expect((await events(t.owner)).find(e => e.type === 'revoked')?.reason).toBe('Internal note');
    expect((await events(t.viewer)).find(e => e.type === 'revoked')?.reason).toBeNull();
  });
});

describe('replacement', () => {
  it('issues a linked successor and never changes the predecessor content', async () => {
    const [c] = await issue(db, t, [row('Mara Castilo')]);
    const before = await db.admin('select recipient_display_name, title, achievement, snapshot_digest, issued_at from public.credentials where id = $1', [c.id]);
    const successor = await replace(c.id, row('Mara Castillo'));
    expect(await db.admin('select recipient_display_name, title, achievement, snapshot_digest, issued_at from public.credentials where id = $1', [c.id])).toEqual(before);
    const old = await verify(c.publicId);
    expect(old).toMatchObject({ status: 'replaced', replacementPublicId: successor.publicId, recipientDisplayName: 'Mara Castilo' });
    expect(await verify(successor.publicId)).toMatchObject({ status: 'valid', recipientDisplayName: 'Mara Castillo', replacementPublicId: null });
    const detail = await db.rpc<{ versionNumber: number; replacesPublicId: string }>(t.owner, 'get_credential', { p_org: t.org, p_credential: successor.id });
    expect(detail).toMatchObject({ versionNumber: 2, replacesPublicId: c.publicId });
  });
  it('cannot fork: a replaced record cannot be replaced or revoked again', async () => {
    const [c] = await issue(db, t, [row('Fork Person')]); await replace(c.id, row('Fork Person Fixed'));
    expect((await db.fails(replace(c.id, row('Fork Person Again')))).code).toBe('INVALID_TRANSITION');
    expect((await db.fails(revoke(c.id))).code).toBe('INVALID_TRANSITION');
    expect(await db.admin('select count(*)::int as n from public.credentials where lineage_id = (select lineage_id from public.credentials where id = $1)', [c.id])).toEqual([{ n: 2 }]);
  });
  it('is idempotent per key and validates the replacement', async () => {
    const [c] = await issue(db, t, [row('Idem Person')]); const key = uuid();
    expect(JSON.parse((await db.fails(replace(c.id, { recipientDisplayName: '', title: 'T', achievement: 'A' }, uuid(), ''))).detail)).toEqual([
      { field: 'recipientDisplayName', code: 'REQUIRED', row: 1 }, { field: 'reason', code: 'REQUIRED' }]);
    const first = await replace(c.id, row('Idem Person Fixed'), key);
    expect(await replace(c.id, row('Idem Person Fixed'), key)).toEqual(first);
    expect((await db.fails(replace(c.id, row('Something Else'), key))).code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('a successor can itself be replaced, extending the chain', async () => {
    const [c] = await issue(db, t, [row('Chain One')]);
    const two = await replace(c.id, row('Chain Two')); const three = await replace(two.id, row('Chain Three'));
    expect((await verify(two.publicId)).replacementPublicId).toBe(three.publicId);
    expect((await db.rpc<{ versionNumber: number }>(t.owner, 'get_credential', { p_org: t.org, p_credential: three.id })).versionNumber).toBe(3);
  });
});

describe('private delivery links', () => {
  it('stores only a hash and exchanges for exactly one credential', async () => {
    const [c, other] = await issue(db, t, [row('Delivery Person', { recipientEmail: 'dp@example.test' }), row('Other Person')]);
    const created = await link(c.id);
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.admin<{ dump: string }>('select row_to_json(d)::text as dump from public.delivery_capabilities d where credential_id = $1', [c.id]);
    expect(stored[0].dump).not.toContain(created.token);
    const delivered = await exchange(created.token);
    expect(Object.keys(delivered).sort()).toEqual(['achievement', 'expiresAt', 'issuedAt', 'issuerDisplayName', 'publicId', 'recipientDisplayName', 'status', 'template', 'title']);
    expect(delivered.publicId).toBe(c.publicId);
    expect(JSON.stringify(delivered)).not.toContain('dp@example.test');
    expect(JSON.stringify(delivered)).not.toContain(other.publicId);
  });
  it('the public id, a wrong secret and malformed input are all DELIVERY_UNAVAILABLE', async () => {
    const [c] = await issue(db, t, [row('Guess Person')]); await link(c.id);
    for (const token of [c.publicId, 'A'.repeat(43), '', 'A'.repeat(44), null, c.id]) expect((await db.fails(exchange(token))).code).toBe('DELIVERY_UNAVAILABLE');
  });
  it('a new link disables the previous one', async () => {
    const [c] = await issue(db, t, [row('Regenerated Person')]);
    const first = await link(c.id); const second = await link(c.id);
    expect((await db.fails(exchange(first.token))).code).toBe('DELIVERY_UNAVAILABLE');
    expect((await exchange(second.token)).publicId).toBe(c.publicId);
  });
  it('expired links, and links of revoked or replaced records, stop working', async () => {
    const [a, b, c] = await issue(db, t, [row('Expired Link'), row('Revoked Link'), row('Replaced Link')]);
    const la = await link(a.id); const lb = await link(b.id); const lc = await link(c.id);
    await db.admin("update public.delivery_capabilities set expires_at = now() - interval '1 second' where credential_id = $1", [a.id]);
    await revoke(b.id); await replace(c.id, row('Replaced Link Fixed'));
    for (const l of [la, lb, lc]) expect((await db.fails(exchange(l.token))).code).toBe('DELIVERY_UNAVAILABLE');
    expect((await db.fails(link(b.id))).code).toBe('INVALID_TRANSITION');
  });
  it('lasts thirty days', async () => {
    const [c] = await issue(db, t, [row('Lifetime Person')]);
    const days = (new Date((await link(c.id)).expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9); expect(days).toBeLessThan(30.1);
  });
});
