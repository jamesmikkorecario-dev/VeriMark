import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
function titleFor(path: string) {
if (path === '/') return 'Achievement, on the record | VeriMark';
if (path === '/workspace') return 'Demonstration workspace | VeriMark';
if (/^\/(workspace|preview)\/[^/]+$/.test(path)) return 'Unavailable in M1 | VeriMark';
return 'Page not found | VeriMark';
}
export default function RouteEffects() {
const { pathname, search, hash } = useLocation();
useEffect(() => {
document.title = titleFor(pathname);
const main = document.querySelector<HTMLElement>('main');
if (main) { if (!main.hasAttribute('tabindex')) main.tabIndex = -1; main.focus({ preventScroll: true }); }
}, [pathname, search, hash]);
return null;
}
