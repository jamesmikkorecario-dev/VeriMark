import { isEmailAddress, MIN_PASSWORD_LENGTH } from './session';

export interface SummaryItem { id: string; message: string }

/** Converts a { field: message } map into ordered summary items for the fields that have errors. */
export function summaryItems(errors: Record<string, string | undefined>, ids: Record<string, string>): SummaryItem[] {
  return Object.entries(ids).filter(([field]) => errors[field]).map(([field, id]) => ({ id, message: errors[field]! }));
}

export function emailProblem(value: string, empty = 'Enter your email address.'): string | undefined {
  const email = value.trim();
  if (!email) return empty;
  if (!isEmailAddress(email)) return 'Enter an email address in the format name@example.com.';
  return undefined;
}

export type SignInErrors = { email?: string; password?: string };
export function validateSignIn(email: string, password: string): SignInErrors {
  const errors: SignInErrors = {};
  const problem = emailProblem(email);
  if (problem) errors.email = problem;
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export type SignUpField = 'displayName' | 'email' | 'password' | 'confirm';
export type SignUpErrors = Partial<Record<SignUpField, string>>;

export function validatePasswordPair(password: string, confirm: string): { password?: string; confirm?: string } {
  const errors: { password?: string; confirm?: string } = {};
  if (!password) errors.password = 'Enter a password.';
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!confirm) errors.confirm = 'Confirm your password.';
  else if (password && confirm !== password) errors.confirm = 'Passwords do not match.';
  return errors;
}

export function validateSignUp(values: Record<SignUpField, string>): SignUpErrors {
  const errors: SignUpErrors = {};
  const name = values.displayName.trim();
  if (!name) errors.displayName = 'Enter your name.';
  else if (name.length > 120) errors.displayName = 'Name must be 120 characters or fewer.';
  const problem = emailProblem(values.email);
  if (problem) errors.email = problem;
  return { ...errors, ...validatePasswordPair(values.password, values.confirm) };
}
