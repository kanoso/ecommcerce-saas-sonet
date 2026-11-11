import { InjectionToken, inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Session, User } from '../api/api.models';

export const SESSION_STORAGE_KEY = 'tiendi-rifas.session';

/** Where the session survives reloads. Null when the browser offers none. */
export const SESSION_STORAGE = new InjectionToken<Storage | null>('SESSION_STORAGE', {
  providedIn: 'root',
  // Merely reading localStorage throws when the browser blocks site data.
  factory: () => safely(() => (typeof localStorage === 'undefined' ? null : localStorage), null),
});

/** Current time in epoch milliseconds; replaced in tests. */
export const CLOCK = new InjectionToken<() => number>('CLOCK', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});

interface SessionState {
  accessToken: string | null;
  expiresAt: string | null;
  user: User | null;
}

const signedOut: SessionState = { accessToken: null, expiresAt: null, user: null };

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** Every field the app reads, so a tampered or outdated value is never trusted. */
function isSession(value: unknown): value is Session {
  const candidate = value as Partial<Session> | null;
  const user = candidate?.user as Partial<User> | null | undefined;
  return (
    isText(candidate?.accessToken) &&
    isText(candidate?.expiresAt) &&
    !Number.isNaN(Date.parse(candidate.expiresAt)) &&
    isText(user?.id) &&
    (isText(user?.email) || isText(user?.document) || isText(user?.phone)) &&
    isText(user?.role)
  );
}

/** A session is live strictly before its expiry; an unreadable expiry is not. */
function isLive(expiresAt: string | null, now: number): boolean {
  if (expiresAt === null) {
    return false;
  }
  const expiry = Date.parse(expiresAt);
  return !Number.isNaN(expiry) && expiry > now;
}

/**
 * Storage can throw (Safari private mode, quota, disabled cookies). The
 * session then lives in memory only, which is enough for this tab.
 */
function safely<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

/** Reads the stored session, dropping it when unreadable or expired. */
function restore(storage: Storage | null, now: number): SessionState {
  const raw = safely(() => storage?.getItem(SESSION_STORAGE_KEY) ?? null, null);
  if (!raw) {
    return signedOut;
  }
  const stored = safely<unknown>(() => JSON.parse(raw), null);
  if (isSession(stored) && isLive(stored.expiresAt, now)) {
    return { accessToken: stored.accessToken, expiresAt: stored.expiresAt, user: { ...stored.user } };
  }
  safely(() => storage?.removeItem(SESSION_STORAGE_KEY), undefined);
  return signedOut;
}

/**
 * The buyer's bearer session (D4). The API checks the token on every request;
 * this store only remembers it and drops it once it expires or is rejected.
 */
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState<SessionState>(() => restore(inject(SESSION_STORAGE), inject(CLOCK)())),
  withMethods((store, storage = inject(SESSION_STORAGE), clock = inject(CLOCK)) => {
    const signOut = (): void => {
      patchState(store, signedOut);
      safely(() => storage?.removeItem(SESSION_STORAGE_KEY), undefined);
    };
    return {
      /** Reads the clock on every call: a session never outlives its expiry. */
      isAuthenticated(): boolean {
        return store.accessToken() !== null && isLive(store.expiresAt(), clock());
      },
      /** The token to send, or null. An expired session is forgotten here. */
      activeToken(): string | null {
        const token = store.accessToken();
        if (token === null) {
          return null;
        }
        if (!isLive(store.expiresAt(), clock())) {
          signOut();
          return null;
        }
        return token;
      },
      /** Returns false, and stays signed out, for an expired or malformed session. */
      signIn(session: Session): boolean {
        if (!isSession(session) || !isLive(session.expiresAt, clock())) {
          signOut();
          return false;
        }
        patchState(store, {
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
          user: session.user,
        });
        safely(() => storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)), undefined);
        return true;
      },
      signOut,
    };
  }),
);
