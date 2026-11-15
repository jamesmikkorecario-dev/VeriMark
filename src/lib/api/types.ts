// VeriMark application API contract v1 (ADR-0005). Every adapter (Supabase, local demo) implements VeriMarkApi.
// Authority is always decided by the trusted backend; nothing here grants access by itself.

export type Role = 'owner' | 'issuer' | 'viewer';
export type ReviewState = 'pending' | 'reviewed' | 'suspended';
export type CredentialStatus = 'valid' | 'expired' | 'revoked' | 'replaced';
export type CredentialEventType = 'issued' | 'revoked' | 'replaced';

export type ApiErrorCode =
  | 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'REVISION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_TRANSITION' | 'APPROVAL_REQUIRED' | 'ISSUER_NOT_ELIGIBLE'
  | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'UNABLE_TO_VERIFY' | 'DELIVERY_UNAVAILABLE'
  | 'TEMPORARILY_UNAVAILABLE' | 'INTERNAL_ERROR';

/** `row` is the 1-based source row for batch input; absent for single-form fields. `code` is a stable machine code such as REQUIRED, TOO_LONG, INVALID, DUPLICATE, PAST_DATE. */
export interface FieldError { field: string; code: string; row?: number }

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly fields: FieldError[];
  readonly retryAfterSeconds?: number;
  constructor(code: ApiErrorCode, message: string, options: { retryable?: boolean; fields?: FieldError[]; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.fields = options.fields ?? [];
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

// ---- Identity ----
export interface SessionUser { id: string; email: string; displayName: string }
export interface SignUpResult { needsEmailConfirmation: boolean }

// ---- Organizations ----
export interface Organization { id: string; displayName: string; reviewState: ReviewState; revision: number; createdAt: string }
export interface Membership { organizationId: string; organizationName: string; role: Role; reviewState: ReviewState }
export interface Member { userId: string; displayName: string; role: Role; joinedAt: string }
export interface Invite { id: string; email: string; role: Exclude<Role, 'owner'>; expiresAt: string; createdAt: string }
/** `token` is returned exactly once. The owner shares the invite link manually; VeriMark sends no email. */
export interface CreatedInvite extends Invite { token: string }
export interface ReviewQueueItem { organizationId: string; displayName: string; reviewState: ReviewState; revision: number; createdAt: string; lastReviewAt: string | null }

// ---- Templates ----
export interface TemplateConfig {
  heading: string;          // e.g. "Certificate of Completion"; <= 120 chars
  bodyPrefix: string;       // sentence shown before the recipient name; <= 200 chars
  signatoryName: string;    // <= 120 chars
  signatoryTitle: string;   // <= 120 chars
  accent: 'forest' | 'ink' | 'ochre';
  orientation: 'landscape' | 'portrait';
}
export interface Template { id: string; organizationId: string; name: string; revision: number; config: TemplateConfig; archived: boolean; updatedAt: string }
export interface SaveTemplateInput { id?: string; name: string; config: TemplateConfig; expectedRevision?: number }

// ---- Issuance ----
/** Limits (enforced server-side): recipientDisplayName/title <= 200, achievement <= 2000, 1..200 rows. `expiresOn` is a calendar date YYYY-MM-DD (end of that UTC day). */
export interface DraftRowInput { recipientDisplayName: string; title: string; achievement: string; recipientEmail?: string; expiresOn?: string }
export interface BatchDraft { batchId: string; revision: number; rowCount: number }
export interface PreviewRow { sourceRow: number; recipientDisplayName: string; title: string; achievement: string; expiresAt: string | null }
export interface BatchPreview { batchId: string; revision: number; templateId: string; templateRevision: number; templateName: string; rowCount: number; rows: PreviewRow[]; previewDigest: string }
export interface BatchApproval { approvalId: string; approvedAt: string }
export interface IssuedCredentialRef { id: string; publicId: string; sourceRow: number }
export interface IssueResult { batchId: string; credentials: IssuedCredentialRef[] }

// ---- Credentials ----
export interface CredentialSummary {
  id: string; publicId: string; recipientDisplayName: string; title: string; achievement: string;
  issuedAt: string; expiresAt: string | null; status: CredentialStatus; versionNumber: number;
}
export interface CredentialEvent { id: string; type: CredentialEventType; at: string; actorDisplayName: string; reason: string | null }
export interface CredentialDetail extends CredentialSummary {
  issuerDisplayName: string;
  template: TemplateConfig;
  events: CredentialEvent[];
  replacedByPublicId: string | null;
  replacesPublicId: string | null;
  /** Private contact; null for viewers and when not supplied. */
  recipientEmail: string | null;
}
export interface CredentialListQuery { search?: string; status?: CredentialStatus | 'all'; cursor?: string; limit?: number }
export interface Page<T> { items: T[]; nextCursor: string | null }
/** `token` is the plaintext delivery secret, returned once. Creating a new link revokes earlier links for the credential. */
export interface DeliveryLink { token: string; expiresAt: string }

// ---- History ----
export interface AuditEntry { id: string; at: string; actorDisplayName: string; action: string; targetLabel: string }
export interface OrganizationMetrics { issued: number; valid: number; expired: number; revoked: number; replaced: number; verificationChecks: number }

// ---- Public (account-free) ----
/** The complete public allowlist. Never add contact, internal id, reason or actor fields. */
export interface VerificationResult {
  publicId: string; status: CredentialStatus;
  issuer: { displayName: string; reviewState: ReviewState };
  recipientDisplayName: string; title: string; achievement: string;
  issuedAt: string; expiresAt: string | null; checkedAt: string;
  proofType: 'online_database';
  replacementPublicId: string | null;
}
/** Returned to the holder of a delivery secret; enough to render the certificate PDF in the browser. */
export interface DeliveredCredential {
  publicId: string; status: CredentialStatus;
  issuerDisplayName: string; recipientDisplayName: string; title: string; achievement: string;
  issuedAt: string; expiresAt: string | null; template: TemplateConfig;
}

export interface VeriMarkApi {
  /** 'demo' = local in-memory fixtures (no backend, nothing is real); 'supabase' = configured project. */
  readonly mode: 'demo' | 'supabase';

  // Identity
  getSession(): Promise<SessionUser | null>;
  onAuthChange(listener: (user: SessionUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<SessionUser>;
  signUp(input: { email: string; password: string; displayName: string }): Promise<SignUpResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;

  // Organizations and members
  listMemberships(): Promise<Membership[]>;
  createOrganization(displayName: string): Promise<Organization>;
  getOrganization(organizationId: string): Promise<Organization>;
  renameOrganization(organizationId: string, input: { displayName: string; expectedRevision: number }): Promise<Organization>;
  listMembers(organizationId: string): Promise<Member[]>;
  setMemberRole(organizationId: string, userId: string, role: Role): Promise<void>;
  removeMember(organizationId: string, userId: string): Promise<void>;
  listInvites(organizationId: string): Promise<Invite[]>;
  inviteMember(organizationId: string, input: { email: string; role: Exclude<Role, 'owner'> }): Promise<CreatedInvite>;
  revokeInvite(organizationId: string, inviteId: string): Promise<void>;
  acceptInvite(token: string): Promise<Membership>;

  // Platform review (platform administrators only)
  isPlatformAdmin(): Promise<boolean>;
  listReviewQueue(): Promise<ReviewQueueItem[]>;
  recordIssuerReview(input: { organizationId: string; outcome: ReviewState; reason: string; expectedRevision: number }): Promise<void>;

  // Templates
  listTemplates(organizationId: string): Promise<Template[]>;
  saveTemplate(organizationId: string, input: SaveTemplateInput): Promise<Template>;
  archiveTemplate(organizationId: string, templateId: string): Promise<void>;

  // Issuance: draft -> preview -> approve exact digest -> issue (atomic, idempotent)
  createBatch(organizationId: string, input: { templateId: string; source: 'single' | 'csv'; rows: DraftRowInput[] }): Promise<BatchDraft>;
  previewBatch(organizationId: string, batchId: string): Promise<BatchPreview>;
  approveBatch(organizationId: string, batchId: string, input: { expectedRevision: number; previewDigest: string }): Promise<BatchApproval>;
  issueBatch(organizationId: string, batchId: string, input: { approvalId: string; idempotencyKey: string }): Promise<IssueResult>;

  // Credentials and lifecycle
  listCredentials(organizationId: string, query?: CredentialListQuery): Promise<Page<CredentialSummary>>;
  getCredential(organizationId: string, credentialId: string): Promise<CredentialDetail>;
  revokeCredential(organizationId: string, credentialId: string, input: { reason: string; idempotencyKey: string }): Promise<void>;
  replaceCredential(organizationId: string, credentialId: string, input: { reason: string; replacement: DraftRowInput; idempotencyKey: string }): Promise<IssuedCredentialRef>;
  createDeliveryLink(organizationId: string, credentialId: string): Promise<DeliveryLink>;

  // History
  listAudit(organizationId: string, query?: { cursor?: string; limit?: number }): Promise<Page<AuditEntry>>;
  getMetrics(organizationId: string): Promise<OrganizationMetrics>;

  // Public, account-free
  verifyCredential(publicId: string): Promise<VerificationResult>;
  exchangeDelivery(token: string): Promise<DeliveredCredential>;
}
