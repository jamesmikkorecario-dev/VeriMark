/* global process, console, setTimeout */
// Local-only real PostgreSQL runner. pg is installed OUTSIDE this repository.
// node tools/test-concurrency.mjs <temporary-runtime-directory> [--expect-deadlock]
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const runtime = resolve(process.argv[2]);
const { Client } = createRequire(join(runtime, 'package.json'))('pg');
const config = { host: '127.0.0.1', port: 35479, user: 'postgres', database: 'postgres' };
const connections = [];
async function connect(database = config.database) {
  const c = new Client({ ...config, database }); await c.connect(); connections.push(c);
  await c.query("set statement_timeout='15s'; set lock_timeout='10s'; set deadlock_timeout='500ms'");
  return c;
}
const root = await connect();
const database = `vm_concurrency_${randomUUID().replaceAll('-', '')}`;
await root.query(`create database ${database}`);
try {
  const setup = await connect(database), a = await connect(database), b = await connect(database), observer = await connect(database);
  const shim = readFileSync('supabase/tests/harness.ts', 'utf8').match(/const SUPABASE_SHIM = `([\s\S]*?)`;/)[1]
    .replace(/create role (\w+) ([^;]+);/g, (_, role, flags) =>
      `do $$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role} ${flags}; end if; end $$;`);
  await setup.query(shim);
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    await setup.query(readFileSync(join('supabase/migrations', file), 'utf8'));
  }
  console.log('runtime', (await setup.query('select version()')).rows[0].version);
  const owner = randomUUID(), issuer = randomUUID(), admin = randomUUID();
  for (const id of [owner, issuer, admin]) await setup.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, `${id}@example.test`]);
  await setup.query('insert into public.platform_admins(user_id) values($1)', [admin]);
  async function actor(c, id) {
    await c.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await c.query('set role authenticated');
  }
  async function rpc(c, name, args) {
    const keys = Object.keys(args);
    return (await c.query(`select public.${name}(${keys.map((k,i) => `${k} => $${i+1}`).join(',')}) as result`, keys.map(k => typeof args[k] === 'object' && args[k] !== null ? JSON.stringify(args[k]) : args[k]))).rows[0].result;
  }
  await actor(a, owner);
  const org = (await rpc(a, 'create_organization', { p_display_name: 'Concurrency Synthetic' })).id;
  await setup.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'issuer')", [org, issuer]);
  await actor(a, admin);
  await rpc(a, 'record_issuer_review', { p_org: org, p_outcome: 'reviewed', p_reason: 'Synthetic', p_expected_revision: 1 });
  const templateConfig = { heading: 'Certificate', bodyPrefix: 'This certifies', signatoryName: 'Synthetic', signatoryTitle: 'Lead', accent: 'forest', orientation: 'landscape' };
  await actor(a, issuer);
  const template = (await rpc(a, 'save_template', { p_org: org, p_id: null, p_name: 'Standard', p_config: templateConfig, p_expected_revision: null })).id;
  const rows = [{ recipientDisplayName: 'Synthetic Person', title: 'Workshop', achievement: 'Completed' }];
  async function approved() {
    const batch = await rpc(a, 'create_batch', { p_org: org, p_template: template, p_source: 'single', p_rows: rows });
    const preview = await rpc(a, 'preview_batch', { p_org: org, p_batch: batch.batchId });
    const approval = await rpc(a, 'approve_batch', { p_org: org, p_batch: batch.batchId, p_expected_revision: batch.revision, p_preview_digest: preview.previewDigest });
    return { p_org: org, p_batch: batch.batchId, p_approval: approval.approvalId, p_key: randomUUID() };
  }
  const pidA = (await a.query('select pg_backend_pid() as pid')).rows[0].pid;
  const pidB = (await b.query('select pg_backend_pid() as pid')).rows[0].pid;
  async function blocked() {
    const until = Date.now() + 8000;
    while (Date.now() < until) {
      const { rows: activity } = await observer.query("select pid,wait_event_type,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1", [pidB]);
      if (activity[0]?.wait_event_type === 'Lock' && activity[0].blockers.includes(pidA)) {
        console.log('barrier', JSON.stringify(activity[0])); return;
      }
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error('B never reached verified lock wait on A');
  }
  const settle = promise => promise.then(value => ({ value }), error => ({ error: error.message, code: error.code }));
  const counts = async () => (await setup.query('select (select count(*)::int from public.credentials) credentials,(select count(*)::int from public.credential_events) events,(select count(*)::int from public.idempotency_receipts) receipts')).rows[0];

  // Exact replay: A has completed the RPC but retains its locks until COMMIT.
  const args = await approved();
  await a.query('begin isolation level read committed');
  const first = await rpc(a, 'issue_batch', args);
  await actor(b, issuer); await b.query('begin isolation level read committed');
  const duplicate = settle(rpc(b, 'issue_batch', args));
  await blocked(); await a.query('commit');
  const duplicateResult = await duplicate; assert.deepEqual(duplicateResult.value, first);
  await b.query('commit');
  assert.deepEqual(await counts(), { credentials: 1, events: 1, receipts: 1 });
  console.log('PASS duplicate issue exact replay; counts=1/1/1');

  // Removal wins: B has entered issue_batch and is waiting on A's org lock.
  const next = await approved();
  await actor(a, owner); await a.query('begin isolation level read committed');
  await rpc(a, 'remove_member', { p_org: org, p_user: issuer });
  await b.query('begin isolation level read committed');
  const denied = settle(rpc(b, 'issue_batch', next));
  await blocked(); await a.query('commit');
  const denial = await denied; assert.equal(denial.error, 'VM:NOT_FOUND');
  await b.query('rollback');
  assert.deepEqual(await counts(), { credentials: 1, events: 1, receipts: 1 });
  console.log('PASS authorization after wait; NOT_FOUND; counts unchanged');
  await setup.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'issuer')", [org, issuer]);

  // Pause at the real require_role boundary (not an artificial membership lock).
  await a.query('reset role'); await a.query('begin isolation level read committed');
  await a.query("select set_config('request.jwt.claim.sub',$1,true)", [issuer]);
  await a.query("select app.require_role($1,array['owner','issuer'])", [org]);
  await actor(b, owner); await b.query('begin isolation level read committed');
  const removal = settle(rpc(b, 'remove_member', { p_org: org, p_user: issuer }));
  await blocked();
  await a.query('set local role authenticated');
  const draft = await settle(rpc(a, 'create_batch', { p_org: org, p_template: template, p_source: 'single', p_rows: rows }));
  await a.query(draft.error ? 'rollback' : 'commit');
  const removalResult = await removal;
  await b.query(removalResult.error ? 'rollback' : 'commit');
  const deadlock = [draft, removalResult].some(r => r.code === '40P01');
  console.log('inversion', JSON.stringify({ draft: draft.error ? draft : 'ok', removal: removalResult.error ? removalResult : 'ok', deadlock }));
  assert.equal(deadlock, process.argv.includes('--expect-deadlock'));
  if (!deadlock) { assert.ok(!draft.error); assert.ok(!removalResult.error); }
  console.log('PASS inversion expectation; no partial issuance', JSON.stringify(await counts()));
} finally {
  for (const c of connections.slice(1)) { try { await c.query('rollback'); } catch { /* connection may already be closed */ } await c.end(); }
  await root.query(`drop database ${database}`);
  await root.end();
}
