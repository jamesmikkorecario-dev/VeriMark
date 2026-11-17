import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './harness';

describe('public rate boundary (actual migrations)', () => {
  let db: TestDb;
  let actor: string;
  beforeAll(async () => { db = await TestDb.create(); actor = await db.user('rate-fixture'); });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await db.admin('delete from public.rate_windows'); });
  const windows = () => db.admin<{ bucket: string; hits: number }>('select bucket, hits from public.rate_windows order by bucket');
  // Committed calls may span minute windows; their total must still count every guess.
  const totals = () => db.admin<{ bucket: string; hits: number }>('select bucket, sum(hits)::int as hits from public.rate_windows group by bucket order by bucket');

  it('commits malformed and unknown guesses into the same fixed buckets', async () => {
    for (const id of [null, 'bad', 'a'.repeat(22)]) expect(await db.rpc(null, 'verify_credential', { p_public_id: id })).toBeNull();
    for (const token of [null, 'bad', 'a'.repeat(43)]) expect(await db.rpc(null, 'exchange_delivery', { p_token: token })).toBeNull();
    expect(await totals()).toEqual([{ bucket: 'delivery', hits: 3 }, { bucket: 'verify', hits: 3 }]);
  });

  it.each([['verify', 600, 'verify_credential', 'p_public_id'], ['delivery', 120, 'exchange_delivery', 'p_token']] as const)(
    '%s admits the last slot then fails closed across anonymous and authenticated callers', async (bucket, limit, rpc, arg) => {
      // Pin transaction time so this boundary test cannot cross a wall-clock minute.
      await db.script('begin');
      try {
        await db.admin("insert into public.rate_windows values ($1, date_trunc('minute', now()), $2)", [bucket, limit - 1]);
        expect(await db.rpc(null, rpc, { [arg]: 'bad' })).toBeNull();
        await db.script('savepoint denied');
        await db.pg.exec('set role authenticated');
        expect((await db.fails(db.pg.query(`select public.${rpc}('bad')`))).code).toBe('RATE_LIMITED');
        await db.pg.exec('rollback to savepoint denied');
        expect(await windows()).toEqual([{ bucket, hits: limit }]);
      } finally { await db.pg.exec('rollback'); }
    },
  );

  it('caller rollback undoes admitted guesses: SQL is not an independent request counter', async () => {
    await db.script('begin');
    expect(await db.rpc(null, 'verify_credential', { p_public_id: 'bad' })).toBeNull();
    await db.script('rollback');
    expect(await windows()).toEqual([]);
  });

  it('ignores changing caller headers and input cardinality', async () => {
    for (let n = 0; n < 8; n++) {
      await db.admin("select set_config('request.headers', $1, false)", [JSON.stringify({ 'x-forwarded-for': `192.0.2.${n}`, 'x-real-ip': `192.0.2.${n}` })]);
      await db.rpc(null, 'verify_credential', { p_public_id: String(n).padStart(22, '0') });
      await db.rpc(null, 'exchange_delivery', { p_token: String(n).padStart(43, '0') });
    }
    expect(await totals()).toEqual([{ bucket: 'delivery', hits: 8 }, { bucket: 'verify', hits: 8 }]);
  });

  it('cleans old windows on first admitted request without deleting the other current budget', async () => {
    // Keep the seeded delivery budget current throughout the cleanup assertion.
    await db.script('begin');
    try {
      await db.admin("insert into public.rate_windows values ('verify', now() - interval '2 hours', 600), ('delivery', now() - interval '2 hours', 120), ('delivery', date_trunc('minute', now()), 120)");
      await db.rpc(null, 'verify_credential', { p_public_id: 'bad' });
      expect(await windows()).toEqual([{ bucket: 'delivery', hits: 120 }, { bucket: 'verify', hits: 1 }]);
    } finally { await db.pg.exec('rollback'); }
  });

  it.each([null, 'authenticated'] as const)('denies %s direct counter tampering and arbitrary helper buckets', async role => {
    const caller = role ? actor : null;
    for (const sql of ["select * from public.rate_windows", "insert into public.rate_windows values ('attacker', now(), 1)", 'delete from public.rate_windows', "select app.rate_check('attacker', 999999)"]) {
      await expect(db.as(caller, sql)).rejects.toThrow(/permission denied/);
    }
    expect(await windows()).toEqual([]);
  });
});
