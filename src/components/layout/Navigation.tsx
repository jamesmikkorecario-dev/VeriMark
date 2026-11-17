import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui';
import './navigation.css';

// Keep this breakpoint synchronized with the shell's mobile CSS.
const desktopQuery = '(min-width: 801px)';

export function PublicNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const desktop = window.matchMedia(desktopQuery);
    const dismiss = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss();
        trigger.current?.focus();
      }
    };
    const resize = () => { if (desktop.matches) dismiss(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      desktop.removeEventListener('change', resize);
    };
  }, [open]);

  return (
    <div className="public-navigation" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={trigger} type="button" className="button button-ghost button-md navigation-trigger"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'close' : 'menu'} />
      </button>
      <div id="public-navigation" className="public-navigation-panel" hidden={!open}
        onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>
        {children}
      </div>
    </div>
  );
}

export function WorkspaceDrawer({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const desktop = window.matchMedia(desktopQuery);
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    // Shorthand writes can replace independent longhands and their priorities.
    // Restore the original declaration text, including unrelated inline styles.
    const originalStyle = body.getAttribute('style');
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.position = 'fixed';
    body.style.top = `${-scrollY}px`;
    body.style.left = `${-scrollX}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (gutter > 0) body.style.paddingRight = `${padding + gutter}px`;
    element.showModal();
    // Explicit initial focus avoids the brand link becoming the first action.
    element.querySelector<HTMLButtonElement>('button')?.focus();
    const resize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', resize);
    return () => {
      desktop.removeEventListener('change', resize);
      element.close();
      if (originalStyle === null) body.removeAttribute('style');
      // CSSOM, not setAttribute('style'): the production CSP (style-src 'self') refuses style attributes set as markup.
      else body.style.cssText = originalStyle;
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button ref={trigger} type="button" className="button button-ghost button-md navigation-trigger"
        aria-label="Open workspace navigation" aria-expanded={open}
        aria-controls="workspace-navigation" onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      <dialog ref={dialog} id="workspace-navigation" className="workspace-drawer"
        aria-label="Workspace navigation"
        onKeyDown={event => {
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'));
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={event => { event.preventDefault(); dismiss(); }}
        onClick={event => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
          }
          if ((event.target as HTMLElement).closest('a')) setOpen(false);
        }}>
        <div className="drawer-close-row">
          <button type="button" className="button button-ghost button-md navigation-trigger" aria-label="Close workspace navigation" onClick={dismiss}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}


