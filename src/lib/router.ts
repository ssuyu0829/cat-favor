import { useSyncExternalStore } from 'react';

/** 極簡 hash router：靜態託管（GitHub Pages 之類）不用設 rewrite 就能用。 */

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw === '' ? '/' : raw;
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, currentPath, () => '/');
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = `#${to}`;
  if (opts.replace) window.location.replace(url);
  else window.location.hash = to;
}

export function back(): void {
  if (window.history.length > 1) window.history.back();
  else navigate('/');
}

/** 把 '/can/abc/edit' 對上 '/can/:id/edit'，回傳參數；不符合回 null。 */
export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = s[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}
