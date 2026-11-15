// Small Web Crypto helpers for the local demonstration adapter. No secret ever leaves memory unhashed.

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBase64url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** 22-character public identifier from 16 random bytes. */
export const newPublicId = () => randomBase64url(16);
/** 43-character bearer secret from 32 random bytes. */
export const newSecretToken = () => randomBase64url(32);
export const newInternalId = (prefix: string) => `${prefix}_${randomBase64url(12)}`;

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const SECRET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
