import { Injectable, InjectionToken, inject } from '@angular/core';
import { CLOCK } from './session.store';

export const RETURN_PATH_STORAGE_KEY = 'tiendi-rifas.return-path';

/** The query parameter of `/ingresar` that names the page to return to. */
export const RETURN_PATH_PARAM = 'volver';

/**
 * The emailed link opens `/acceso` in a fresh page, often another tab, so the
 * way back must outlive this one: localStorage, when the browser allows it.
 */
export const RETURN_PATH_STORAGE = new InjectionToken<Storage | null>('RETURN_PATH_STORAGE', {
  providedIn: 'root',
  factory: () => attempt(() => (typeof localStorage === 'undefined' ? null : localStorage), null),
});

/** About the life of a sign-in link; an older path is stale. */
const MAX_AGE_MS = 60 * 60 * 1000;
const MAX_LENGTH = 512;

/** Pages that must never be the destination: they would loop or replay a link. */
const AUTH_PAGES = ['/ingresar', '/acceso'];

/**
 * Only an internal absolute path is accepted, so a crafted `?volver=` can
 * never send the buyer to another site (open redirect):
 * - one leading `/`, never `//` or `/\` (both mean another host to browsers);
 * - no backslash, whitespace or control character anywhere (browsers drop
 *   tabs and line breaks, which would turn `/\t/x` into `//x`);
 * - it resolves to this origin;
 * - it is not a sign-in page, raw or percent-decoded.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) {
    return null;
  }
  // Checked raw and percent-decoded, so `%5C` or `%2F%2F` cannot sneak past.
  const decoded = attempt(() => decodeURIComponent(value), null);
  if (decoded === null || [value, decoded].some(isOutsidePath)) {
    return null;
  }
  const base = 'https://return-path.invalid';
  const url = attempt(() => new URL(value, base), null);
  if (url === null || url.origin !== base) {
    return null;
  }
  // The router decodes the path, so `/%69ngresar` and `/ingresar%2F` are the
  // sign-in page too; `;` starts Angular matrix parameters of the segment.
  const decodedPath = attempt(() => decodeURIComponent(url.pathname), null);
  if (decodedPath === null || [url.pathname, decodedPath].some(isAuthPage)) {
    return null;
  }
  return value;
}

const isAuthPage = (pathname: string): boolean => {
  const path = pathname.split(';')[0];
  return AUTH_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
};

const isOutsidePath = (path: string): boolean =>
  !path.startsWith('/') || path.startsWith('//') || /[\\\s\p{Cc}]/u.test(path);

interface StoredReturnPath {
  path: string;
  savedAt: number;
}

/** Remembers, across the emailed link, the page that asked for a sign-in. */
@Injectable({ providedIn: 'root' })
export class ReturnPathStore {
  private readonly storage = inject(RETURN_PATH_STORAGE);
  private readonly clock = inject(CLOCK);

  /** False when the path is unsafe or cannot be kept. Any earlier path is dropped. */
  remember(path: unknown): boolean {
    this.forget();
    const safe = safeReturnPath(path);
    if (safe === null || this.storage === null) {
      return false;
    }
    const stored: StoredReturnPath = { path: safe, savedAt: this.clock() };
    return attempt(() => {
      this.storage?.setItem(RETURN_PATH_STORAGE_KEY, JSON.stringify(stored));
      return true;
    }, false);
  }

  /** The remembered path, once; null when none, stale or tampered with. */
  consume(): string | null {
    const raw = attempt(() => this.storage?.getItem(RETURN_PATH_STORAGE_KEY) ?? null, null);
    this.forget();
    if (raw === null) {
      return null;
    }
    const stored = attempt<Partial<StoredReturnPath> | null>(() => JSON.parse(raw), null);
    const age = typeof stored?.savedAt === 'number' ? this.clock() - stored.savedAt : Infinity;
    return age >= 0 && age <= MAX_AGE_MS ? safeReturnPath(stored?.path) : null;
  }

  forget(): void {
    attempt(() => this.storage?.removeItem(RETURN_PATH_STORAGE_KEY), undefined);
  }
}

/** Storage throws when the browser blocks site data; the app carries on. */
function attempt<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}
