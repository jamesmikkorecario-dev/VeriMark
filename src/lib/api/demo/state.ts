import type { CredentialEvent, IssueResult, ReviewState, Role, TemplateConfig } from '../types';
import { sha256Hex } from './crypto';
import type { NormalRow } from './validation';

export const DEMO_STORAGE_KEY = 'verimark.demo.state.v1';
export const DEMO_STATE_VERSION = 1;
export const DEMO_PASSWORD = 'demo-password-1';

/** Fixed, fictional public identifiers used by the seed so browser tests can reference them. */
export const DEMO_PUBLIC_IDS = {
  valid: 'demoValidRecord0000001',
  expired: 'demoExpiredRecord00001',
  revoked: 'demoRevokedRecord00001',
  replaced: 'demoReplacedRecord0001',
  replacement: 'demoReplacementRec0001',
} as const;

export const DEMO_ACCOUNTS = [
  { email: 'owner@demo.verimark.test', password: DEMO_PASSWORD, displayName: 'Mika Chen', description: 'Owner, Fieldwork Collective (reviewed)' },
  { email: 'issuer@demo.verimark.test', password: DEMO_PASSWORD, displayName: 'Sam Okafor', description: 'Issuer, Fieldwork Collective' },
  { email: 'viewer@demo.verimark.test', password: DEMO_PASSWORD, displayName: 'Lee Park', description: 'Viewer, Fieldwork Collective (read only)' },
  { email: 'admin@demo.verimark.test', password: DEMO_PASSWORD, displayName: 'Ari Platform', description: 'Platform reviewer (no organization)' },
  { email: 'north@demo.verimark.test', password: DEMO_PASSWORD, displayName: 'Jo Rivers', description: 'Owner, Northgate Guild (pending review)' },
] as const;

export interface UserRec { id: string; email: string; displayName: string; passwordHash: string; createdAt: string }
export interface OrgRec { id: string; displayName: string; reviewState: ReviewState; revision: number; createdAt: string; lastReviewAt: string | null; verificationChecks: number }
export interface MemberRec { organizationId: string; userId: string; role: Role; joinedAt: string }
export interface InviteRec { id: string; organizationId: string; email: string; role: Exclude<Role, 'owner'>; tokenHash: string; expiresAt: string; createdAt: string; acceptedAt: string | null; revokedAt: string | null }
export interface ReviewRec { organizationId: string; outcome: ReviewState; reason: string; at: string; reviewerId: string }
export interface TemplateRec { id: string; organizationId: string; name: string; revision: number; config: TemplateConfig; archived: boolean; updatedAt: string }
export interface BatchRec {
  id: string; organizationId: string; templateId: string; source: 'single' | 'csv'; rows: NormalRow[]; revision: number; createdBy: string; createdAt: string;
  approval: { id: string; digest: string; at: string } | null;
  issued: { idempotencyKey: string; result: IssueResult } | null;
}
export interface CredentialRec {
  id: string; organizationId: string; seq: number; publicId: string; batchId: string | null;
  recipientDisplayName: string; title: string; achievement: string; recipientEmail: string | null;
  issuedAt: string; expiresAt: string | null; template: TemplateConfig; versionNumber: number;
  revokedAt: string | null; replacedById: string | null; replacesId: string | null; events: CredentialEvent[];
}
export interface DeliveryRec { id: string; credentialId: string; tokenHash: string; createdAt: string; expiresAt: string; revokedAt: string | null }
export interface IdempotencyRec { scope: string; operation: 'issue' | 'revoke' | 'replace'; target: string; requestDigest: string; result: unknown }
export interface AuditRec { id: string; organizationId: string; seq: number; at: string; actorDisplayName: string; action: string; targetLabel: string }

export interface DemoState {
  version: typeof DEMO_STATE_VERSION; seq: number; sessionUserId: string | null;
  users: UserRec[]; platformAdminIds: string[]; organizations: OrgRec[]; members: MemberRec[]; invites: InviteRec[]; reviews: ReviewRec[];
  templates: TemplateRec[]; batches: BatchRec[]; credentials: CredentialRec[]; deliveries: DeliveryRec[]; idempotency: IdempotencyRec[]; audit: AuditRec[];
}

const COLLECTIONS = ['users', 'platformAdminIds', 'organizations', 'members', 'invites', 'reviews', 'templates', 'batches', 'credentials', 'deliveries', 'idempotency', 'audit'] as const;

/** Structural check only: anything unexpected is treated as corrupt and reseeded. */
export function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return state.version === DEMO_STATE_VERSION && typeof state.seq === 'number' &&
    (state.sessionUserId === null || typeof state.sessionUserId === 'string') &&
    COLLECTIONS.every(key => Array.isArray(state[key]));
}

export const passwordHash = (email: string, password: string) => sha256Hex(`verimark-demo-password:${email}:${password}`);

const DAY = 86_400_000;

export async function createSeed(now: Date): Promise<DemoState> {
  const at = (days: number) => new Date(now.getTime() + days * DAY).toISOString();
  const users: UserRec[] = await Promise.all(DEMO_ACCOUNTS.map(async (account, index) => ({
    id: `user_demo_${['owner', 'issuer', 'viewer', 'admin', 'north'][index]}`,
    email: account.email, displayName: account.displayName,
    passwordHash: await passwordHash(account.email, account.password), createdAt: at(-200),
  })));
  const fieldwork: OrgRec = { id: 'org_demo_fieldwork', displayName: 'Fieldwork Collective', reviewState: 'reviewed', revision: 2, createdAt: at(-200), lastReviewAt: at(-190), verificationChecks: 14 };
  const northgate: OrgRec = { id: 'org_demo_northgate', displayName: 'Northgate Guild', reviewState: 'pending', revision: 1, createdAt: at(-5), lastReviewAt: null, verificationChecks: 0 };
  const config: TemplateConfig = { heading: 'Certificate of Completion', bodyPrefix: 'This certifies that', signatoryName: 'Mika Chen', signatoryTitle: 'Programme Lead (fictional)', accent: 'forest', orientation: 'landscape' };
  const templates: TemplateRec[] = [
    { id: 'tpl_demo_fieldwork', organizationId: fieldwork.id, name: 'Workshop completion', revision: 1, config, archived: false, updatedAt: at(-180) },
    { id: 'tpl_demo_northgate', organizationId: northgate.id, name: 'Guild membership', revision: 1, config: { ...config, heading: 'Certificate of Membership', signatoryName: 'Jo Rivers', signatoryTitle: 'Guild Secretary (fictional)', accent: 'ink' }, archived: false, updatedAt: at(-4) },
  ];
  let seq = 0;
  const audit: AuditRec[] = [];
  const log = (organizationId: string, when: string, actorDisplayName: string, action: string, targetLabel: string) =>
    audit.push({ id: `audit_seed_${audit.length + 1}`, organizationId, seq: ++seq, at: when, actorDisplayName, action, targetLabel });
  log(fieldwork.id, at(-200), 'Mika Chen', 'organization.created', 'Fieldwork Collective');
  log(fieldwork.id, at(-190), 'Platform review', 'organization.reviewed', 'Fieldwork Collective');
  log(northgate.id, at(-5), 'Jo Rivers', 'organization.created', 'Northgate Guild');

  type SeedCredential = { key: string; publicId: string; name: string; title: string; achievement: string; issued: number; expires?: number; email?: string };
  const seedRows: SeedCredential[] = [
    { key: 'replaced', publicId: DEMO_PUBLIC_IDS.replaced, name: 'Noor Haddad', title: 'Field Methods Intensive', achievement: 'Completed twelve sessions of supervised field practice.', issued: -150 },
    { key: 'revoked', publicId: DEMO_PUBLIC_IDS.revoked, name: 'Theo Lindqvist', title: 'Archive Handling Basics', achievement: 'Completed the archive handling module.', issued: -140, email: 'theo@example.test' },
    { key: 'expired', publicId: DEMO_PUBLIC_IDS.expired, name: 'Priya Raman', title: 'First Aid Refresher', achievement: 'Completed the annual refresher.', issued: -120, expires: -20 },
    { key: 'f5', publicId: 'demoFieldworkRecord005', name: 'Jonas Weber', title: 'Oral History Interviewing', achievement: 'Completed four recorded interviews with peer review.', issued: -90 },
    { key: 'replacement', publicId: DEMO_PUBLIC_IDS.replacement, name: 'Noor Haddad', title: 'Field Methods Intensive', achievement: 'Completed twelve sessions of supervised field practice with distinction.', issued: -60 },
    { key: 'f6', publicId: 'demoFieldworkRecord006', name: 'Ana Costa', title: 'Community Mapping Workshop', achievement: 'Produced a neighbourhood asset map.', issued: -30, expires: 335 },
    { key: 'f7', publicId: 'demoFieldworkRecord007', name: 'Kenji Mori', title: 'Research Ethics Primer', achievement: 'Completed the ethics primer and assessment.', issued: -14 },
    { key: 'valid', publicId: DEMO_PUBLIC_IDS.valid, name: 'Alex Santos', title: 'Community Research Workshop', achievement: 'Completed the six-week community research workshop.', issued: -7, expires: 358, email: 'alex@example.test' },
  ];
  const credentials: CredentialRec[] = seedRows.map(row => {
    const issuedAt = at(row.issued);
    const credential: CredentialRec = {
      id: `cred_demo_${row.key}`, organizationId: fieldwork.id, seq: ++seq, publicId: row.publicId, batchId: null,
      recipientDisplayName: row.name, title: row.title, achievement: row.achievement, recipientEmail: row.email ?? null,
      issuedAt, expiresAt: row.expires === undefined ? null : at(row.expires), template: config, versionNumber: 1,
      revokedAt: null, replacedById: null, replacesId: null,
      events: [{ id: `evt_demo_${row.key}_issued`, type: 'issued', at: issuedAt, actorDisplayName: 'Mika Chen', reason: null }],
    };
    audit.push({ id: `audit_seed_${row.key}`, organizationId: fieldwork.id, seq: credential.seq, at: issuedAt, actorDisplayName: 'Mika Chen', action: 'credential.issued', targetLabel: `${row.name} · ${row.title}` });
    return credential;
  });
  const byKey = (key: string) => credentials.find(credential => credential.id === `cred_demo_${key}`)!;
  const original = byKey('replaced');
  const replacement = byKey('replacement');
  original.replacedById = replacement.id;
  replacement.replacesId = original.id;
  replacement.versionNumber = 2;
  original.events.push({ id: 'evt_demo_replaced', type: 'replaced', at: replacement.issuedAt, actorDisplayName: 'Mika Chen', reason: 'Achievement wording corrected.' });
  const revoked = byKey('revoked');
  revoked.revokedAt = at(-100);
  revoked.events.push({ id: 'evt_demo_revoked', type: 'revoked', at: revoked.revokedAt, actorDisplayName: 'Mika Chen', reason: 'Issued in error.' });
  log(fieldwork.id, revoked.revokedAt, 'Mika Chen', 'credential.revoked', `${revoked.recipientDisplayName} · ${revoked.title}`);
  audit.sort((a, b) => a.at.localeCompare(b.at));
  audit.forEach((entry, index) => { entry.seq = index + 1; });
  credentials.forEach(credential => { credential.seq = audit.find(entry => entry.id === `audit_seed_${credential.id.slice('cred_demo_'.length)}`)!.seq; });

  const [owner, issuer, viewer, admin, north] = users;
  return {
    version: DEMO_STATE_VERSION, seq: audit.length + 1, sessionUserId: null,
    users, platformAdminIds: [admin.id], organizations: [fieldwork, northgate],
    members: [
      { organizationId: fieldwork.id, userId: owner.id, role: 'owner', joinedAt: at(-200) },
      { organizationId: fieldwork.id, userId: issuer.id, role: 'issuer', joinedAt: at(-180) },
      { organizationId: fieldwork.id, userId: viewer.id, role: 'viewer', joinedAt: at(-170) },
      { organizationId: northgate.id, userId: north.id, role: 'owner', joinedAt: at(-5) },
    ],
    invites: [],
    reviews: [{ organizationId: fieldwork.id, outcome: 'reviewed', reason: 'Fictional seed: identity documents checked.', at: at(-190), reviewerId: admin.id }],
    templates, batches: [], credentials, deliveries: [], idempotency: [], audit,
  };
}
