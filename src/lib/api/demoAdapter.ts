import {
  ApiError,
  type AuditEntry, type BatchPreview, type CredentialDetail, type CredentialStatus, type CredentialSummary, type DeliveredCredential,
  type DraftRowInput, type FieldError, type Invite, type IssueResult, type IssuedCredentialRef, type Member, type Membership,
  type Organization, type Page, type ReviewState, type Role, type SessionUser, type Template, type VerificationResult, type VeriMarkApi,
} from './types';
import { newInternalId, newPublicId, newSecretToken, PUBLIC_ID_PATTERN, SECRET_TOKEN_PATTERN, sha256Hex } from './demo/crypto';
import {
  createSeed, DEMO_STORAGE_KEY, isDemoState, passwordHash,
  type CredentialRec, type DemoState, type OrgRec, type TemplateRec, type UserRec,
} from './demo/state';
import {
  checkText, endOfUtcDay, fail, isEmail, LIMITS, normalizeEmail, normalizeRow, requireText, validateTemplateConfig, type NormalRow,
} from './demo/validation';

export { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_PUBLIC_IDS, DEMO_STORAGE_KEY } from './demo/state';

export interface DemoApiOptions {
  /** Defaults to window.sessionStorage when available; null keeps state in memory only. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** Injectable clock for tests. */
  now?: () => Date;
}

const DAY = 86_400_000;
const DELIVERY_DAYS = 30;
const INVITE_DAYS = 7;
const WRITE_ROLES: Role[] = ['owner', 'issuer'];

function defaultStorage(): DemoApiOptions['storage'] {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}

const notFound = () => new ApiError('NOT_FOUND', 'Not found.');
const forbidden = () => new ApiError('FORBIDDEN', 'Your role does not allow this action.');
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function statusOf(credential: Pick<CredentialRec, 'revokedAt' | 'replacedById' | 'expiresAt'>, now: Date): CredentialStatus {
  if (credential.revokedAt) return 'revoked';
  if (credential.replacedById) return 'replaced';
  if (credential.expiresAt && new Date(credential.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

function previewDigest(templateId: string, templateRevision: number, rows: NormalRow[]): Promise<string> {
  return sha256Hex(JSON.stringify({ templateId, templateRevision, rows: rows.map(r => [r.recipientDisplayName, r.title, r.achievement, r.recipientEmail, r.expiresOn]) }));
}

function encodeCursor(seq: number) { return `c${seq}`; }
function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined || cursor === null || cursor === '') return null;
  if (!/^c\d{1,15}$/.test(cursor)) throw new ApiError('VALIDATION', 'Invalid cursor.', { fields: [{ field: 'cursor', code: 'INVALID' }] });
  return Number(cursor.slice(1));
}
function pageLimit(limit: number | undefined) {
  if (limit === undefined) return 25;
  if (!Number.isInteger(limit) || limit < 1) throw new ApiError('VALIDATION', 'Invalid limit.', { fields: [{ field: 'limit', code: 'INVALID' }] });
  return Math.min(limit, 100);
}
function paginate<T extends { seq: number }>(rows: T[], cursor: string | undefined, limit: number | undefined): { items: T[]; nextCursor: string | null } {
  const after = decodeCursor(cursor);
  const size = pageLimit(limit);
  const ordered = rows.filter(row => after === null || row.seq < after).sort((a, b) => b.seq - a.seq);
  const items = ordered.slice(0, size);
  return { items, nextCursor: ordered.length > size ? encodeCursor(items[items.length - 1].seq) : null };
}

/** Rule-faithful local demonstration of VeriMarkApi. All data is fictional and lives in this browser session only. */
export function createDemoApi(options: DemoApiOptions = {}): VeriMarkApi {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const listeners = new Set<(user: SessionUser | null) => void>();
  let state: DemoState | null = null;
  let loading: Promise<DemoState> | null = null;

  async function load(): Promise<DemoState> {
    if (state) return state;
    loading ??= (async () => {
      let stored: unknown;
      try {
        const raw = storage?.getItem(DEMO_STORAGE_KEY);
        stored = raw ? JSON.parse(raw) : null;
      } catch { stored = null; }
      if (isDemoState(stored)) state = stored;
      else { state = await createSeed(now()); persist(); }
      return state;
    })();
    return loading;
  }
  function persist() {
    try { storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage full or blocked: keep the in-memory state. */ }
  }
  /** Runs a synchronous change against a copy and commits it only if it completes: every mutation is atomic. */
  function commit<T>(change: (draft: DemoState) => T): T {
    const draft = clone(state!);
    const result = change(draft);
    state = draft;
    persist();
    return result;
  }
  const iso = () => now().toISOString();
  const nextSeq = (draft: DemoState) => ++draft.seq;

  function sessionUser(s: DemoState): UserRec {
    const user = s.users.find(u => u.id === s.sessionUserId);
    if (!user) throw new ApiError('UNAUTHENTICATED', 'Sign in to continue.');
    return user;
  }
  const toSessionUser = (user: UserRec): SessionUser => ({ id: user.id, email: user.email, displayName: user.displayName });
  function notify() {
    const user = state?.users.find(u => u.id === state?.sessionUserId);
    const value = user ? toSessionUser(user) : null;
    for (const listener of [...listeners]) { try { listener(value); } catch { /* A listener failure must not break auth. */ } }
  }

  /** Membership lookup that never discloses whether a foreign organization exists. */
  function access(s: DemoState, organizationId: string, roles?: Role[]) {
    const user = sessionUser(s);
    const membership = s.members.find(m => m.organizationId === organizationId && m.userId === user.id);
    const organization = s.organizations.find(o => o.id === organizationId);
    if (!membership || !organization) throw notFound();
    if (roles && !roles.includes(membership.role)) throw forbidden();
    return { user, membership, organization };
  }
  const isAdmin = (s: DemoState, userId: string) => s.platformAdminIds.includes(userId);
  const toOrganization = (o: OrgRec): Organization => ({ id: o.id, displayName: o.displayName, reviewState: o.reviewState, revision: o.revision, createdAt: o.createdAt });
  function audit(draft: DemoState, organizationId: string, actorDisplayName: string, action: string, targetLabel: string) {
    draft.audit.push({ id: newInternalId('audit'), organizationId, seq: nextSeq(draft), at: iso(), actorDisplayName, action, targetLabel });
  }
  function credentialIn(s: DemoState, organizationId: string, credentialId: string) {
    const credential = s.credentials.find(c => c.id === credentialId && c.organizationId === organizationId);
    if (!credential) throw notFound();
    return credential;
  }
  function summary(c: CredentialRec): CredentialSummary {
    return { id: c.id, publicId: c.publicId, recipientDisplayName: c.recipientDisplayName, title: c.title, achievement: c.achievement, issuedAt: c.issuedAt, expiresAt: c.expiresAt, status: statusOf(c, now()), versionNumber: c.versionNumber };
  }
  function requireEligible(organization: OrgRec) {
    if (organization.reviewState !== 'reviewed') throw new ApiError('ISSUER_NOT_ELIGIBLE', 'This organization has not been reviewed for issuing.');
  }
  function newCredential(draft: DemoState, organizationId: string, issuerDisplayName: string, row: NormalRow, template: CredentialRec['template'], actor: string, extra: Partial<CredentialRec> = {}): CredentialRec {
    const issuedAt = iso();
    let publicId = newPublicId();
    while (draft.credentials.some(c => c.publicId === publicId)) publicId = newPublicId();
    const credential: CredentialRec = {
      id: newInternalId('cred'), organizationId, seq: nextSeq(draft), publicId, batchId: null,
      issuerDisplayName, recipientDisplayName: row.recipientDisplayName, title: row.title, achievement: row.achievement, recipientEmail: row.recipientEmail,
      issuedAt, expiresAt: row.expiresOn ? endOfUtcDay(row.expiresOn) : null, template: clone(template), versionNumber: 1,
      revokedAt: null, replacedById: null, replacesId: null,
      events: [{ id: newInternalId('evt'), type: 'issued', at: issuedAt, actorDisplayName: actor, reason: null }],
      ...extra,
    };
    draft.credentials.push(credential);
    return credential;
  }
  /** Returns a stored result for a replayed key, throws on a reused key with a different request, or null for a new key. */
  function replay(s: DemoState, organizationId: string, key: string, operation: 'issue' | 'revoke' | 'replace', target: string, requestDigest: string): unknown {
    const k = requireText('idempotencyKey', key, 200);
    const record = s.idempotency.find(r => r.scope === `${organizationId}:${k}`);
    if (!record) return null;
    if (record.operation !== operation || record.target !== target || record.requestDigest !== requestDigest) throw new ApiError('IDEMPOTENCY_CONFLICT', 'This request key was already used for a different request.');
    return record.result;
  }

  const api: VeriMarkApi = {
    mode: 'demo',

    // ---------------- Identity ----------------
    async getSession() {
      const s = await load();
      const user = s.users.find(u => u.id === s.sessionUserId);
      return user ? toSessionUser(user) : null;
    },
    onAuthChange(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async signIn(email, password) {
      const s = await load();
      const normalized = normalizeEmail(String(email ?? ''));
      const user = s.users.find(u => u.email === normalized);
      const hash = await passwordHash(normalized, String(password ?? ''));
      if (!user || user.passwordHash !== hash) throw new ApiError('UNAUTHENTICATED', 'Invalid sign-in details.');
      commit(draft => { draft.sessionUserId = user.id; });
      notify();
      return toSessionUser(user);
    },
    async signUp(input) {
      const s = await load();
      const errors: FieldError[] = [];
      const email = normalizeEmail(String(input?.email ?? ''));
      if (!email) errors.push({ field: 'email', code: 'REQUIRED' });
      else if (!isEmail(email)) errors.push({ field: 'email', code: 'INVALID' });
      if (String(input?.password ?? '').length < LIMITS.minPassword) errors.push({ field: 'password', code: 'TOO_SHORT' });
      const displayName = checkText(errors, 'displayName', input?.displayName, LIMITS.displayName);
      if (!errors.length && s.users.some(u => u.email === email)) errors.push({ field: 'email', code: 'UNAVAILABLE' });
      fail(errors);
      const hash = await passwordHash(email, input.password);
      commit(draft => {
        const user: UserRec = { id: newInternalId('user'), email, displayName, passwordHash: hash, createdAt: iso() };
        draft.users.push(user);
        draft.sessionUserId = user.id;
      });
      notify();
      return { needsEmailConfirmation: false };
    },
    async signOut() {
      await load();
      commit(draft => { draft.sessionUserId = null; });
      notify();
    },
    async requestPasswordReset(email) {
      await load();
      // Deliberately identical for known and unknown addresses. The demo sends nothing.
      if (!isEmail(normalizeEmail(String(email ?? '')))) throw new ApiError('VALIDATION', 'Enter a valid email address.', { fields: [{ field: 'email', code: 'INVALID' }] });
    },
    async updatePassword(newPassword) {
      const s = await load();
      const user = sessionUser(s);
      if (String(newPassword ?? '').length < LIMITS.minPassword) throw new ApiError('VALIDATION', 'Password too short.', { fields: [{ field: 'password', code: 'TOO_SHORT' }] });
      const hash = await passwordHash(user.email, newPassword);
      commit(draft => { draft.users.find(u => u.id === user.id)!.passwordHash = hash; });
    },

    // ---------------- Organizations ----------------
    async listMemberships() {
      const s = await load();
      const user = sessionUser(s);
      return s.members.filter(m => m.userId === user.id).map((m): Membership => {
        const o = s.organizations.find(org => org.id === m.organizationId)!;
        return { organizationId: o.id, organizationName: o.displayName, role: m.role, reviewState: o.reviewState };
      }).sort((a, b) => a.organizationName.localeCompare(b.organizationName));
    },
    async createOrganization(displayName) {
      const s = await load();
      const user = sessionUser(s);
      const name = requireText('displayName', displayName, LIMITS.organizationName);
      return commit(draft => {
        const org: OrgRec = { id: newInternalId('org'), displayName: name, reviewState: 'pending', revision: 1, createdAt: iso(), lastReviewAt: null, verificationChecks: 0 };
        draft.organizations.push(org);
        draft.members.push({ organizationId: org.id, userId: user.id, role: 'owner', joinedAt: iso() });
        audit(draft, org.id, user.displayName, 'organization.created', name);
        return toOrganization(org);
      });
    },
    async getOrganization(organizationId) {
      const s = await load();
      return toOrganization(access(s, organizationId).organization);
    },
    async renameOrganization(organizationId, input) {
      const s = await load();
      const { user, organization } = access(s, organizationId, ['owner']);
      const name = requireText('displayName', input?.displayName, LIMITS.organizationName);
      if (input.expectedRevision !== organization.revision) throw new ApiError('REVISION_CONFLICT', 'The organization changed since it was loaded.');
      return commit(draft => {
        const org = draft.organizations.find(o => o.id === organizationId)!;
        org.displayName = name;
        org.revision += 1;
        audit(draft, org.id, user.displayName, 'organization.renamed', name);
        return toOrganization(org);
      });
    },
    async listMembers(organizationId) {
      const s = await load();
      access(s, organizationId);
      return s.members.filter(m => m.organizationId === organizationId).map((m): Member => ({
        userId: m.userId, displayName: s.users.find(u => u.id === m.userId)?.displayName ?? 'Former user', role: m.role, joinedAt: m.joinedAt,
      })).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    },
    async setMemberRole(organizationId, userId, role) {
      const s = await load();
      const { user } = access(s, organizationId, ['owner']);
      if (!['owner', 'issuer', 'viewer'].includes(role)) throw new ApiError('VALIDATION', 'Invalid role.', { fields: [{ field: 'role', code: 'INVALID' }] });
      const target = s.members.find(m => m.organizationId === organizationId && m.userId === userId);
      if (!target) throw notFound();
      if (target.role === role) return;
      if (target.role === 'owner' && s.members.filter(m => m.organizationId === organizationId && m.role === 'owner').length === 1) {
        throw new ApiError('INVALID_TRANSITION', 'An organization must keep at least one owner.');
      }
      commit(draft => {
        draft.members.find(m => m.organizationId === organizationId && m.userId === userId)!.role = role;
        audit(draft, organizationId, user.displayName, 'member.role_changed', `${s.users.find(u => u.id === userId)?.displayName ?? 'Member'} → ${role}`);
      });
    },
    async removeMember(organizationId, userId) {
      const s = await load();
      const { user } = access(s, organizationId, ['owner']);
      const target = s.members.find(m => m.organizationId === organizationId && m.userId === userId);
      if (!target) throw notFound();
      if (target.role === 'owner' && s.members.filter(m => m.organizationId === organizationId && m.role === 'owner').length === 1) {
        throw new ApiError('INVALID_TRANSITION', 'An organization must keep at least one owner.');
      }
      commit(draft => {
        draft.members = draft.members.filter(m => !(m.organizationId === organizationId && m.userId === userId));
        audit(draft, organizationId, user.displayName, 'member.removed', s.users.find(u => u.id === userId)?.displayName ?? 'Member');
      });
    },
    async listInvites(organizationId) {
      const s = await load();
      access(s, organizationId, ['owner']);
      const t = now().getTime();
      return s.invites
        .filter(i => i.organizationId === organizationId && !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt).getTime() > t)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((i): Invite => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt }));
    },
    async inviteMember(organizationId, input) {
      const s = await load();
      const { user } = access(s, organizationId, ['owner']);
      const errors: FieldError[] = [];
      const email = normalizeEmail(String(input?.email ?? ''));
      if (!email) errors.push({ field: 'email', code: 'REQUIRED' });
      else if (!isEmail(email)) errors.push({ field: 'email', code: 'INVALID' });
      if (input?.role !== 'issuer' && input?.role !== 'viewer') errors.push({ field: 'role', code: 'INVALID' });
      const existing = s.users.find(u => u.email === email);
      if (existing && s.members.some(m => m.organizationId === organizationId && m.userId === existing.id)) errors.push({ field: 'email', code: 'ALREADY_MEMBER' });
      fail(errors);
      const token = newSecretToken();
      const tokenHash = await sha256Hex(token);
      return commit(draft => {
        const at = iso();
        // One live invitation per address: a new one supersedes earlier pending ones.
        for (const invite of draft.invites) if (invite.organizationId === organizationId && invite.email === email && !invite.acceptedAt && !invite.revokedAt) invite.revokedAt = at;
        const invite = { id: newInternalId('inv'), organizationId, email, role: input.role, tokenHash, createdAt: at, expiresAt: new Date(now().getTime() + INVITE_DAYS * DAY).toISOString(), acceptedAt: null, revokedAt: null };
        draft.invites.push(invite);
        audit(draft, organizationId, user.displayName, 'invite.created', `${email} (${input.role})`);
        return { id: invite.id, email, role: invite.role, expiresAt: invite.expiresAt, createdAt: invite.createdAt, token };
      });
    },
    async revokeInvite(organizationId, inviteId) {
      const s = await load();
      const { user } = access(s, organizationId, ['owner']);
      const invite = s.invites.find(i => i.id === inviteId && i.organizationId === organizationId);
      if (!invite) throw notFound();
      if (invite.revokedAt || invite.acceptedAt) return;
      commit(draft => {
        draft.invites.find(i => i.id === inviteId)!.revokedAt = iso();
        audit(draft, organizationId, user.displayName, 'invite.revoked', invite.email);
      });
    },
    async acceptInvite(token) {
      const s = await load();
      const user = sessionUser(s);
      if (!SECRET_TOKEN_PATTERN.test(String(token ?? ''))) throw notFound();
      const tokenHash = await sha256Hex(token);
      const invite = s.invites.find(i => i.tokenHash === tokenHash);
      // Unknown, used, revoked, expired and wrong-recipient invitations are indistinguishable.
      if (!invite || invite.acceptedAt || invite.revokedAt || new Date(invite.expiresAt).getTime() <= now().getTime() || invite.email !== user.email) throw notFound();
      return commit(draft => {
        draft.invites.find(i => i.id === invite.id)!.acceptedAt = iso();
        let member = draft.members.find(m => m.organizationId === invite.organizationId && m.userId === user.id);
        if (!member) {
          member = { organizationId: invite.organizationId, userId: user.id, role: invite.role, joinedAt: iso() };
          draft.members.push(member);
        }
        audit(draft, invite.organizationId, user.displayName, 'invite.accepted', `${user.displayName} (${member.role})`);
        const org = draft.organizations.find(o => o.id === invite.organizationId)!;
        return { organizationId: org.id, organizationName: org.displayName, role: member.role, reviewState: org.reviewState };
      });
    },

    // ---------------- Platform review ----------------
    async isPlatformAdmin() {
      const s = await load();
      return isAdmin(s, sessionUser(s).id);
    },
    async listReviewQueue() {
      const s = await load();
      if (!isAdmin(s, sessionUser(s).id)) throw forbidden();
      const rank: Record<ReviewState, number> = { pending: 0, suspended: 1, reviewed: 2 };
      return s.organizations
        .map(o => ({ organizationId: o.id, displayName: o.displayName, reviewState: o.reviewState, revision: o.revision, createdAt: o.createdAt, lastReviewAt: o.lastReviewAt }))
        .sort((a, b) => rank[a.reviewState] - rank[b.reviewState] || a.createdAt.localeCompare(b.createdAt));
    },
    async recordIssuerReview(input) {
      const s = await load();
      const user = sessionUser(s);
      if (!isAdmin(s, user.id)) throw forbidden();
      const errors: FieldError[] = [];
      if (!['pending', 'reviewed', 'suspended'].includes(input?.outcome)) errors.push({ field: 'outcome', code: 'INVALID' });
      const reason = checkText(errors, 'reason', input?.reason, LIMITS.reason);
      fail(errors);
      const org = s.organizations.find(o => o.id === input.organizationId);
      if (!org) throw notFound();
      if (org.revision !== input.expectedRevision) throw new ApiError('REVISION_CONFLICT', 'The organization changed since it was loaded.');
      commit(draft => {
        const target = draft.organizations.find(o => o.id === org.id)!;
        target.reviewState = input.outcome;
        target.revision += 1;
        target.lastReviewAt = iso();
        draft.reviews.push({ organizationId: org.id, outcome: input.outcome, reason, at: iso(), reviewerId: user.id });
        // The private reason stays in the review record; the organization's history shows only the outcome.
        audit(draft, org.id, 'Platform review', `organization.review_${input.outcome}`, org.displayName);
      });
    },

    // ---------------- Templates ----------------
    async listTemplates(organizationId) {
      const s = await load();
      access(s, organizationId);
      return s.templates.filter(t => t.organizationId === organizationId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(t => clone(t) as Template);
    },
    async saveTemplate(organizationId, input) {
      const s = await load();
      const { user } = access(s, organizationId, WRITE_ROLES);
      const errors: FieldError[] = [];
      const name = checkText(errors, 'name', input?.name, LIMITS.templateName);
      const config = validateTemplateConfig(errors, input?.config);
      fail(errors);
      if (input.id) {
        const existing = s.templates.find(t => t.id === input.id && t.organizationId === organizationId);
        if (!existing) throw notFound();
        if (existing.archived) throw new ApiError('INVALID_TRANSITION', 'Archived templates cannot be edited.');
        if (input.expectedRevision !== existing.revision) throw new ApiError('REVISION_CONFLICT', 'The template changed since it was loaded.');
      }
      return commit(draft => {
        let template: TemplateRec;
        if (input.id) {
          template = draft.templates.find(t => t.id === input.id)!;
          Object.assign(template, { name, config, revision: template.revision + 1, updatedAt: iso() });
          audit(draft, organizationId, user.displayName, 'template.updated', name);
        } else {
          template = { id: newInternalId('tpl'), organizationId, name, config, revision: 1, archived: false, updatedAt: iso() };
          draft.templates.push(template);
          audit(draft, organizationId, user.displayName, 'template.created', name);
        }
        return clone(template) as Template;
      });
    },
    async archiveTemplate(organizationId, templateId) {
      const s = await load();
      const { user } = access(s, organizationId, WRITE_ROLES);
      const template = s.templates.find(t => t.id === templateId && t.organizationId === organizationId);
      if (!template) throw notFound();
      if (template.archived) return;
      commit(draft => {
        const t = draft.templates.find(x => x.id === templateId)!;
        t.archived = true;
        t.revision += 1;
        t.updatedAt = iso();
        audit(draft, organizationId, user.displayName, 'template.archived', t.name);
      });
    },

    // ---------------- Issuance ----------------
    async createBatch(organizationId, input) {
      const s = await load();
      const { user } = access(s, organizationId, WRITE_ROLES);
      const template = s.templates.find(t => t.id === input?.templateId && t.organizationId === organizationId);
      if (!template) throw notFound();
      const errors: FieldError[] = [];
      if (template.archived) errors.push({ field: 'templateId', code: 'ARCHIVED' });
      if (input.source !== 'single' && input.source !== 'csv') errors.push({ field: 'source', code: 'INVALID' });
      const rows = Array.isArray(input.rows) ? input.rows : [];
      if (rows.length === 0) errors.push({ field: 'rows', code: 'REQUIRED' });
      if (rows.length > LIMITS.maxBatchRows) errors.push({ field: 'rows', code: 'TOO_MANY' });
      if (input.source === 'single' && rows.length > 1) errors.push({ field: 'rows', code: 'TOO_MANY' });
      fail(errors);
      const t = now();
      const seen = new Map<string, number>();
      const normalized = rows.map((row: DraftRowInput, index) => {
        const value = normalizeRow(errors, row, t, index + 1);
        const identity = `${value.recipientDisplayName.toLowerCase()}\u0000${value.title.toLowerCase()}`;
        if (value.recipientDisplayName && value.title) {
          if (seen.has(identity)) errors.push({ field: 'recipientDisplayName', code: 'DUPLICATE', row: index + 1 });
          else seen.set(identity, index + 1);
        }
        return value;
      });
      fail(errors, 'Some rows need attention. Nothing was created.');
      return commit(draft => {
        const batch = { id: newInternalId('batch'), organizationId, templateId: template.id, source: input.source, rows: normalized, revision: 1, createdBy: user.id, createdAt: iso(), approval: null, issued: null };
        draft.batches.push(batch);
        audit(draft, organizationId, user.displayName, 'batch.created', `${normalized.length} row${normalized.length === 1 ? '' : 's'}`);
        return { batchId: batch.id, revision: batch.revision, rowCount: normalized.length };
      });
    },
    async previewBatch(organizationId, batchId) {
      const s = await load();
      access(s, organizationId, WRITE_ROLES);
      const batch = s.batches.find(b => b.id === batchId && b.organizationId === organizationId);
      if (!batch) throw notFound();
      const template = s.templates.find(t => t.id === batch.templateId)!;
      const preview: BatchPreview = {
        batchId: batch.id, revision: batch.revision, templateId: template.id, templateRevision: template.revision, templateName: template.name,
        rowCount: batch.rows.length,
        rows: batch.rows.map((r, i) => ({ sourceRow: i + 1, recipientDisplayName: r.recipientDisplayName, title: r.title, achievement: r.achievement, expiresAt: r.expiresOn ? endOfUtcDay(r.expiresOn) : null })),
        previewDigest: await previewDigest(template.id, template.revision, batch.rows),
      };
      return preview;
    },
    async approveBatch(organizationId, batchId, input) {
      const s = await load();
      const { user } = access(s, organizationId, WRITE_ROLES);
      const batch = s.batches.find(b => b.id === batchId && b.organizationId === organizationId);
      if (!batch) throw notFound();
      if (batch.issued) throw new ApiError('INVALID_TRANSITION', 'This batch has already been issued.');
      const template = s.templates.find(t => t.id === batch.templateId)!;
      const digest = await previewDigest(template.id, template.revision, batch.rows);
      if (input?.expectedRevision !== batch.revision || input?.previewDigest !== digest) throw new ApiError('REVISION_CONFLICT', 'The batch or its template changed since the preview. Review it again.');
      return commit(draft => {
        const approval = { id: newInternalId('appr'), digest, at: iso() };
        draft.batches.find(b => b.id === batchId)!.approval = approval;
        audit(draft, organizationId, user.displayName, 'batch.approved', `${batch.rows.length} row${batch.rows.length === 1 ? '' : 's'}`);
        return { approvalId: approval.id, approvedAt: approval.at };
      });
    },
    async issueBatch(organizationId, batchId, input) {
      const s = await load();
      const { user, organization } = access(s, organizationId, WRITE_ROLES);
      const batch = s.batches.find(b => b.id === batchId && b.organizationId === organizationId);
      if (!batch) throw notFound();
      const stored = replay(s, organizationId, input?.idempotencyKey, 'issue', batchId, batchId);
      if (stored) return clone(stored as IssueResult);
      if (batch.issued) throw new ApiError('INVALID_TRANSITION', 'This batch has already been issued.');
      requireEligible(organization);
      if (!batch.approval || batch.approval.id !== input?.approvalId) throw new ApiError('APPROVAL_REQUIRED', 'Approve the exact preview before issuing.');
      const template = s.templates.find(t => t.id === batch.templateId)!;
      if (template.archived || batch.approval.digest !== await previewDigest(template.id, template.revision, batch.rows)) {
        throw new ApiError('REVISION_CONFLICT', 'The template changed after approval. Review the batch again.');
      }
      return commit(draft => {
        const credentials: IssuedCredentialRef[] = batch.rows.map((row, index) => {
          const c = newCredential(draft, organizationId, organization.displayName, row, template.config, user.displayName, { batchId });
          audit(draft, organizationId, user.displayName, 'credential.issued', `${c.recipientDisplayName} · ${c.title}`);
          return { id: c.id, publicId: c.publicId, sourceRow: index + 1 };
        });
        const result: IssueResult = { batchId, credentials };
        draft.batches.find(b => b.id === batchId)!.issued = { idempotencyKey: input.idempotencyKey, result };
        draft.idempotency.push({ scope: `${organizationId}:${input.idempotencyKey.trim()}`, operation: 'issue', target: batchId, requestDigest: batchId, result });
        return clone(result);
      });
    },

    // ---------------- Credentials ----------------
    async listCredentials(organizationId, query = {}) {
      const s = await load();
      access(s, organizationId);
      const status = query.status ?? 'all';
      if (!['all', 'valid', 'expired', 'revoked', 'replaced'].includes(status)) throw new ApiError('VALIDATION', 'Invalid status filter.', { fields: [{ field: 'status', code: 'INVALID' }] });
      const search = (query.search ?? '').trim().toLowerCase();
      const t = now();
      const matches = s.credentials.filter(c => c.organizationId === organizationId &&
        (status === 'all' || statusOf(c, t) === status) &&
        (!search || c.recipientDisplayName.toLowerCase().includes(search) || c.title.toLowerCase().includes(search) || c.publicId.toLowerCase().includes(search)));
      const page = paginate(matches, query.cursor, query.limit);
      return { items: page.items.map(summary), nextCursor: page.nextCursor } satisfies Page<CredentialSummary>;
    },
    async getCredential(organizationId, credentialId) {
      const s = await load();
      const { membership } = access(s, organizationId);
      const c = credentialIn(s, organizationId, credentialId);
      const publicIdOf = (id: string | null) => (id ? s.credentials.find(x => x.id === id)?.publicId ?? null : null);
      const detail: CredentialDetail = {
        ...summary(c), issuerDisplayName: c.issuerDisplayName, template: clone(c.template), events: clone(c.events),
        replacedByPublicId: publicIdOf(c.replacedById), replacesPublicId: publicIdOf(c.replacesId),
        recipientEmail: membership.role === 'viewer' ? null : c.recipientEmail,
      };
      return detail;
    },
    async revokeCredential(organizationId, credentialId, input) {
      const s = await load();
      const { user } = access(s, organizationId, WRITE_ROLES);
      const credential = credentialIn(s, organizationId, credentialId);
      const reason = requireText('reason', input?.reason, LIMITS.reason);
      if (replay(s, organizationId, input?.idempotencyKey, 'revoke', credentialId, reason) !== null) return;
      if (credential.revokedAt) throw new ApiError('INVALID_TRANSITION', 'This credential is already revoked.');
      commit(draft => {
        const c = draft.credentials.find(x => x.id === credentialId)!;
        c.revokedAt = iso();
        c.events.push({ id: newInternalId('evt'), type: 'revoked', at: c.revokedAt, actorDisplayName: user.displayName, reason });
        for (const link of draft.deliveries) if (link.credentialId === credentialId && !link.revokedAt) link.revokedAt = c.revokedAt;
        draft.idempotency.push({ scope: `${organizationId}:${input.idempotencyKey.trim()}`, operation: 'revoke', target: credentialId, requestDigest: reason, result: true });
        audit(draft, organizationId, user.displayName, 'credential.revoked', `${c.recipientDisplayName} · ${c.title}`);
      });
    },
    async replaceCredential(organizationId, credentialId, input) {
      const s = await load();
      const { user, organization } = access(s, organizationId, WRITE_ROLES);
      const original = credentialIn(s, organizationId, credentialId);
      const errors: FieldError[] = [];
      const reason = checkText(errors, 'reason', input?.reason, LIMITS.reason);
      const row = normalizeRow(errors, input?.replacement, now());
      fail(errors);
      const requestDigest = await sha256Hex(JSON.stringify([reason, row]));
      const stored = replay(s, organizationId, input?.idempotencyKey, 'replace', credentialId, requestDigest);
      if (stored) return clone(stored as IssuedCredentialRef);
      requireEligible(organization);
      if (original.revokedAt || original.replacedById) throw new ApiError('INVALID_TRANSITION', 'Only a current credential can be replaced.');
      return commit(draft => {
        const previous = draft.credentials.find(x => x.id === credentialId)!;
        const successor = newCredential(draft, organizationId, organization.displayName, row, previous.template, user.displayName, { versionNumber: previous.versionNumber + 1, replacesId: previous.id });
        previous.replacedById = successor.id;
        previous.events.push({ id: newInternalId('evt'), type: 'replaced', at: successor.issuedAt, actorDisplayName: user.displayName, reason });
        // Like the database: replacing withdraws every recipient link to the original.
        for (const link of draft.deliveries) if (link.credentialId === credentialId && !link.revokedAt) link.revokedAt = successor.issuedAt;
        const result: IssuedCredentialRef = { id: successor.id, publicId: successor.publicId, sourceRow: 1 };
        draft.idempotency.push({ scope: `${organizationId}:${input.idempotencyKey.trim()}`, operation: 'replace', target: credentialId, requestDigest, result });
        audit(draft, organizationId, user.displayName, 'credential.replaced', `${previous.recipientDisplayName} · ${previous.title} → v${successor.versionNumber}`);
        return result;
      });
    },
    async createDeliveryLink(organizationId, credentialId) {
      const s = await load();
      const { user } = access(s, organizationId, WRITE_ROLES);
      const credential = credentialIn(s, organizationId, credentialId);
      if (credential.revokedAt || credential.replacedById) throw new ApiError('INVALID_TRANSITION', 'Only a current credential can be delivered.');
      const token = newSecretToken();
      const tokenHash = await sha256Hex(token);
      return commit(draft => {
        const at = iso();
        for (const link of draft.deliveries) if (link.credentialId === credentialId && !link.revokedAt) link.revokedAt = at;
        const expiresAt = new Date(now().getTime() + DELIVERY_DAYS * DAY).toISOString();
        draft.deliveries.push({ id: newInternalId('dlv'), credentialId, tokenHash, createdAt: at, expiresAt, revokedAt: null });
        audit(draft, organizationId, user.displayName, 'delivery.link_created', `${credential.recipientDisplayName} · ${credential.title}`);
        return { token, expiresAt };
      });
    },

    // ---------------- History ----------------
    async listAudit(organizationId, query = {}) {
      const s = await load();
      access(s, organizationId);
      const page = paginate(s.audit.filter(a => a.organizationId === organizationId), query.cursor, query.limit);
      return { items: page.items.map((a): AuditEntry => ({ id: a.id, at: a.at, actorDisplayName: a.actorDisplayName, action: a.action, targetLabel: a.targetLabel })), nextCursor: page.nextCursor };
    },
    async getMetrics(organizationId) {
      const s = await load();
      const { organization } = access(s, organizationId);
      const t = now();
      const metrics = { issued: 0, valid: 0, expired: 0, revoked: 0, replaced: 0, verificationChecks: organization.verificationChecks };
      for (const c of s.credentials) if (c.organizationId === organizationId) { metrics.issued += 1; metrics[statusOf(c, t)] += 1; }
      return metrics;
    },

    // ---------------- Public ----------------
    async verifyCredential(publicId) {
      const s = await load();
      if (!PUBLIC_ID_PATTERN.test(String(publicId ?? ''))) throw notFound();
      const c = s.credentials.find(x => x.publicId === publicId);
      if (!c) throw notFound();
      const result = commit(draft => {
        const org = draft.organizations.find(o => o.id === c.organizationId)!;
        org.verificationChecks += 1;
        const successor = c.replacedById ? draft.credentials.find(x => x.id === c.replacedById) : undefined;
        const value: VerificationResult = {
          publicId: c.publicId, status: statusOf(c, now()),
          issuer: { displayName: c.issuerDisplayName, reviewState: org.reviewState },
          recipientDisplayName: c.recipientDisplayName, title: c.title, achievement: c.achievement,
          issuedAt: c.issuedAt, expiresAt: c.expiresAt, checkedAt: iso(), proofType: 'online_database',
          replacementPublicId: successor?.publicId ?? null,
        };
        return value;
      });
      return result;
    },
    async exchangeDelivery(token) {
      const s = await load();
      const unavailable = new ApiError('DELIVERY_UNAVAILABLE', 'This access link is unavailable.');
      if (!SECRET_TOKEN_PATTERN.test(String(token ?? ''))) throw unavailable;
      const tokenHash = await sha256Hex(token);
      const link = s.deliveries.find(d => d.tokenHash === tokenHash);
      const c = link && s.credentials.find(x => x.id === link.credentialId);
      if (!link || !c || link.revokedAt || c.revokedAt || new Date(link.expiresAt).getTime() <= now().getTime()) throw unavailable;
      const delivered: DeliveredCredential = {
        publicId: c.publicId, status: statusOf(c, now()), issuerDisplayName: c.issuerDisplayName,
        recipientDisplayName: c.recipientDisplayName, title: c.title, achievement: c.achievement,
        issuedAt: c.issuedAt, expiresAt: c.expiresAt, template: clone(c.template),
      };
      return delivered;
    },
  };
  return api;
}
