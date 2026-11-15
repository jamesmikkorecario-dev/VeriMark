import type { TemplateConfig } from '../api/types';

export interface CertificateInput {
  publicId: string; issuerDisplayName: string; recipientDisplayName: string; title: string; achievement: string;
  issuedAt: string; expiresAt: string | null; template: TemplateConfig;
  /** Official verification URL encoded in the QR code; build it with verificationUrl(). */
  verifyUrl: string;
}
/** The QR code only locates the official record. It is never proof by itself. */
export function verificationUrl(publicId: string, origin: string = window.location.origin): string {
  return `${origin}/verify/${encodeURIComponent(publicId)}`;
}
// Scaffold placeholder replaced by task FS-B. See docs/ai/FULL-STACK-CONTRACT.md.
export async function renderCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  return (await import('./render')).createPdf(input);
}

