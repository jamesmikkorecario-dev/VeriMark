import { cloneElement, type ReactElement, type ReactNode, type HTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type ActionStyle = { variant?: 'primary' | 'outline' | 'light' | 'ghost'; size?: 'sm' | 'md' };
const actionClass = (variant = 'primary', size = 'md', extra = '') => `button button-${variant} button-${size} ${extra}`.trim();
export function Button({ variant, size, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & ActionStyle) {
  return <button type={type} className={actionClass(variant, size, className)} {...props} />;
}
export function ButtonLink({ variant, size, className, ...props }: LinkProps & ActionStyle) {
  return <Link className={actionClass(variant, size, className)} {...props} />;
}
export function Brand({ to = '/', inverse = false }: { to?: string; inverse?: boolean }) {
  return <Link to={to} className={`brand${inverse ? ' brand-inverse' : ''}`} aria-label="VeriMark home"><span className="brand-symbol" aria-hidden="true"><span>V</span><i /></span><span className="brand-word">verimark<span className="brand-period">.</span></span></Link>;
}
const paths = {
  arrow: 'M4 12h16m-7-7 7 7-7 7', menu: 'M4 7h16M4 12h16M4 17h16', close: 'M5 5l14 14M19 5 5 19',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  records: 'M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h8', template: 'm12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  activity: 'M3 12h4l3-7 4 14 3-7h4', settings: 'M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  search: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 5 5', plus: 'M12 5v14M5 12h14', check: 'm4 12 5 5L20 6', chevron: 'm7 10 5 5 5-5',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 1 1 8 0v3', external: 'M7 17 17 7M8 7h9v9',
};
export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
export type CredentialStatus = 'valid' | 'revoked' | 'expired' | 'replaced';
const statusLabels: Record<CredentialStatus, string> = { valid: 'Valid record', revoked: 'Revoked', expired: 'Expired', replaced: 'Replaced' };
export function StatusPill({ status }: { status: CredentialStatus }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" aria-hidden="true" />{statusLabels[status]}</span>;
}
export function SectionLabel({ children }: { children: ReactNode }) { return <div className="section-label"><span className="label-square" aria-hidden="true" />{children}</div>; }
export function Panel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`panel ${className}`.trim()} {...props} />; }
export function PageContainer({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`container ${className}`.trim()} {...props} />; }
type FieldControl = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' };
export function FormField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactElement<FieldControl> }) {
  const description = [children.props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className="form-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-describedby': description, 'aria-invalid': error ? true : children.props['aria-invalid'] })}{hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}{error && <p id={`${id}-error`} className="field-error">{error}</p>}</div>;
}
export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`text-input ${className}`.trim()} {...props} />; }
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`select-input ${className}`.trim()} {...props} />; }
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="ui-state"><h2>{title}</h2>{children && <div className="state-description">{children}</div>}{action && <div className="state-action">{action}</div>}</div>;
}
export function ErrorState({ title = 'Something went wrong', children, onRetry }: { title?: string; children?: ReactNode; onRetry?: () => void }) {
  return <div className="ui-state ui-state-error"><div role="alert"><h2>{title}</h2>{children && <div className="state-description">{children}</div>}</div>{onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}</div>;
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) { return <div className="ui-state" role="status"><span className="loading-mark" aria-hidden="true" />{label}</div>; }
