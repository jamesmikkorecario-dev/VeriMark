import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  ApiError, type ApiErrorCode, type DeliveredCredential, type FieldError, type SessionUser, type VerificationResult, type VeriMarkApi,
} from './types';

// true = the caller may retry the same request later.
const CODES: Record<ApiErrorCode, boolean> = {
  VALIDATION: false, UNAUTHENTICATED: false, FORBIDDEN: false, NOT_FOUND: false, REVISION_CONFLICT: false, IDEMPOTENCY_CONFLICT: false,
  INVALID_TRANSITION: false, APPROVAL_REQUIRED: false, ISSUER_NOT_ELIGIBLE: false, PAYLOAD_TOO_LARGE: false, DELIVERY_UNAVAILABLE: false,
  RATE_LIMITED: true, UNABLE_TO_VERIFY: true, TEMPORARILY_UNAVAILABLE: true, INTERNAL_ERROR: true,
};

function parseFields(detail: string): FieldError[] {
  try {
    const parsed: unknown = JSON.parse(detail);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (typeof item !== 'object' || item === null) return [];
      const { field, code, row } = item as Record<string, unknown>;
      if (typeof field !== 'string' || typeof code !== 'string') return [];
      return [typeof row === 'number' ? { field, code, row } : { field, code }];
    });
  } catch { return []; }
}

/**
 * Turns a database or transport failure into an ApiError. The database raises `VM:<CODE>` for every expected refusal;
 * anything else (network failure, permission error, unexpected SQL error) becomes a retryable "unavailable" error and its
 * text is never passed on to the interface.
 */
export function toApiError(error: { message?: string; details?: string | null; code?: string } | null | undefined, fallback: ApiErrorCode = 'TEMPORARILY_UNAVAILABLE'): ApiError {
  const match = /^VM:([A-Z_]+)$/.exec(error?.message ?? '');
  if (match && Object.hasOwn(CODES, match[1])) {
    const code = match[1] as ApiErrorCode;
    const detail = error?.details ?? '';
    const retryAfter = code === 'RATE_LIMITED' && /^\d+$/.test(detail) ? Number(detail) : undefined;
    return new ApiError(code, code, { retryable: CODES[code], fields: code === 'VALIDATION' ? parseFields(detail) : [], retryAfterSeconds: retryAfter });
  }
  // PostgREST reports a missing or expired JWT with these codes.
  if (error?.code === 'PGRST301' || error?.code === 'PGRST302') return new ApiError('UNAUTHENTICATED', 'UNAUTHENTICATED');
  return new ApiError(fallback, fallback, { retryable: true });
}

function toSessionUser(user: User): SessionUser {
  const name = user.user_metadata?.display_name;
  const email = user.email ?? '';
  return { id: user.id, email, displayName: typeof name === 'string' && name.trim() ? name.trim() : email.split('@')[0] || 'Member' };
}

export function createSupabaseApi(url: string, publishableKey: string, client: SupabaseClient = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})): VeriMarkApi {
  async function rpc<T>(name: string, args: Record<string, unknown> = {}, fallback: ApiErrorCode = 'TEMPORARILY_UNAVAILABLE'): Promise<T> {
    let result;
    try { result = await client.rpc(name, args); } catch { throw new ApiError(fallback, fallback, { retryable: true }); }
    if (result.error) throw toApiError(result.error, fallback);
    return result.data as T;
  }
  const authFailure = (status: number | undefined): ApiError =>
    status === 429 ? new ApiError('RATE_LIMITED', 'RATE_LIMITED', { retryable: true })
      : status !== undefined && status >= 400 && status < 500 ? new ApiError('UNAUTHENTICATED', 'UNAUTHENTICATED')
        : new ApiError('TEMPORARILY_UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE', { retryable: true });

  return {
    mode: 'supabase',

    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw authFailure(error.status);
      return data.session ? toSessionUser(data.session.user) : null;
    },
    onAuthChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(session ? toSessionUser(session.user) : null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw authFailure(error?.status ?? 400);
      return toSessionUser(data.user);
    },
    async signUp({ email, password, displayName }) {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/sign-in` } });
      if (error) {
        if (error.status === 422 || error.code === 'weak_password') throw new ApiError('VALIDATION', 'VALIDATION', { fields: [{ field: 'password', code: 'INVALID' }] });
        if (error.status === 429) throw authFailure(429);
        throw new ApiError('TEMPORARILY_UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE', { retryable: true });
      }
      return { needsEmailConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error && error.status !== 401 && error.status !== 403) throw authFailure(error.status);
    },
    async requestPasswordReset(email) {
      // Resolves the same way whether or not the account exists; only throttling and outages are reported.
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/update-password` });
      if (error && (error.status === 429 || error.status === undefined || error.status >= 500)) throw authFailure(error.status);
    },
    async updatePassword(newPassword) {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (!error) return;
      if (error.status === 422 || error.code === 'weak_password' || error.code === 'same_password') throw new ApiError('VALIDATION', 'VALIDATION', { fields: [{ field: 'password', code: 'INVALID' }] });
      throw authFailure(error.status);
    },

    listMemberships: () => rpc('my_memberships'),
    createOrganization: displayName => rpc('create_organization', { p_display_name: displayName }),
    getOrganization: organizationId => rpc('get_organization', { p_org: organizationId }),
    renameOrganization: (organizationId, input) => rpc('rename_organization', { p_org: organizationId, p_display_name: input.displayName, p_expected_revision: input.expectedRevision }),
    listMembers: organizationId => rpc('list_members', { p_org: organizationId }),
    setMemberRole: (organizationId, userId, role) => rpc('set_member_role', { p_org: organizationId, p_user: userId, p_role: role }),
    removeMember: (organizationId, userId) => rpc('remove_member', { p_org: organizationId, p_user: userId }),
    listInvites: organizationId => rpc('list_invites', { p_org: organizationId }),
    inviteMember: (organizationId, input) => rpc('create_invite', { p_org: organizationId, p_email: input.email, p_role: input.role }),
    revokeInvite: (organizationId, inviteId) => rpc('revoke_invite', { p_org: organizationId, p_invite: inviteId }),
    acceptInvite: token => rpc('accept_invite', { p_token: token }),

    isPlatformAdmin: () => rpc('is_platform_admin'),
    listReviewQueue: () => rpc('list_review_queue'),
    recordIssuerReview: input => rpc('record_issuer_review', { p_org: input.organizationId, p_outcome: input.outcome, p_reason: input.reason, p_expected_revision: input.expectedRevision }),

    listTemplates: organizationId => rpc('list_templates', { p_org: organizationId }),
    saveTemplate: (organizationId, input) => rpc('save_template', { p_org: organizationId, p_id: input.id ?? null, p_name: input.name, p_config: input.config, p_expected_revision: input.expectedRevision ?? null }),
    archiveTemplate: (organizationId, templateId) => rpc('archive_template', { p_org: organizationId, p_id: templateId }),

    createBatch: (organizationId, input) => rpc('create_batch', { p_org: organizationId, p_template: input.templateId, p_source: input.source, p_rows: input.rows }),
    previewBatch: (organizationId, batchId) => rpc('preview_batch', { p_org: organizationId, p_batch: batchId }),
    approveBatch: (organizationId, batchId, input) => rpc('approve_batch', { p_org: organizationId, p_batch: batchId, p_expected_revision: input.expectedRevision, p_preview_digest: input.previewDigest }),
    issueBatch: (organizationId, batchId, input) => rpc('issue_batch', { p_org: organizationId, p_batch: batchId, p_approval: input.approvalId, p_key: input.idempotencyKey }),

    listCredentials: (organizationId, query = {}) => rpc('list_credentials', { p_org: organizationId, p_search: query.search ?? null, p_status: query.status ?? 'all', p_cursor: query.cursor ?? null, p_limit: query.limit ?? 25 }),
    getCredential: (organizationId, credentialId) => rpc('get_credential', { p_org: organizationId, p_credential: credentialId }),
    revokeCredential: (organizationId, credentialId, input) => rpc('revoke_credential', { p_org: organizationId, p_credential: credentialId, p_reason: input.reason, p_key: input.idempotencyKey }),
    replaceCredential: (organizationId, credentialId, input) => rpc('replace_credential', { p_org: organizationId, p_credential: credentialId, p_reason: input.reason, p_replacement: input.replacement, p_key: input.idempotencyKey }),
    createDeliveryLink: (organizationId, credentialId) => rpc('create_delivery_link', { p_org: organizationId, p_credential: credentialId }),

    listAudit: (organizationId, query = {}) => rpc('list_audit', { p_org: organizationId, p_cursor: query.cursor ?? null, p_limit: query.limit ?? 25 }),
    getMetrics: organizationId => rpc('get_metrics', { p_org: organizationId }),

    // A failure that is not an explicit answer from the database must never look like "not found" or "valid".
    // The database answers NULL for "no such record"; only that explicit answer becomes NOT_FOUND / DELIVERY_UNAVAILABLE.
    async verifyCredential(publicId) {
      const result = await rpc<VerificationResult | null>('verify_credential', { p_public_id: publicId }, 'UNABLE_TO_VERIFY');
      if (result === null) throw new ApiError('NOT_FOUND', 'NOT_FOUND');
      return result;
    },
    async exchangeDelivery(token) {
      const result = await rpc<DeliveredCredential | null>('exchange_delivery', { p_token: token });
      if (result === null) throw new ApiError('DELIVERY_UNAVAILABLE', 'DELIVERY_UNAVAILABLE');
      return result;
    },
  };
}
