import { TestBed } from '@angular/core/testing';
import { Session } from '../api/api.models';
import { CLOCK, SESSION_STORAGE, SESSION_STORAGE_KEY, SessionStore } from './session.store';

const session: Session = {
  accessToken: 'token-1',
  expiresAt: '2026-11-10T00:00:00.000Z',
  user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
};

const beforeExpiry = Date.parse('2026-11-09T00:00:00.000Z');
const afterExpiry = Date.parse('2026-11-11T00:00:00.000Z');

function setup(storage: Storage | null, now: number | (() => number) = beforeExpiry) {
  const clock = typeof now === 'number' ? () => now : now;
  TestBed.configureTestingModule({
    providers: [
      { provide: SESSION_STORAGE, useValue: storage },
      { provide: CLOCK, useValue: clock },
    ],
  });
  return TestBed.inject(SessionStore);
}

describe('SessionStore', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('starts signed out when nothing is stored', () => {
    const store = setup(storage);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.user()).toBeNull();
  });

  it('signs in and persists the session with document', () => {
    const store = setup(storage);
    store.signIn({
      accessToken: 'token-doc',
      expiresAt: '2026-11-10T00:00:00.000Z',
      user: { id: 'u-doc', document: '72345678', role: 'BUYER' },
    });
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.document).toBe('72345678');
  });

  it('signs in and persists the session', () => {
    const store = setup(storage);
    store.signIn(session);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('token-1');
    expect(store.user()?.email).toBe('ana@example.com');
    expect(JSON.parse(storage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual(session);
  });

  it('restores a stored session that has not expired', () => {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    const store = setup(storage);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.id).toBe('u-1');
  });

  it('drops a stored session that has expired', () => {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    const store = setup(storage, afterExpiry);
    expect(store.isAuthenticated()).toBe(false);
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('ignores a corrupted stored value', () => {
    storage.setItem(SESSION_STORAGE_KEY, '{not json');
    const store = setup(storage);
    expect(store.isAuthenticated()).toBe(false);
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('signs out and forgets the stored session', () => {
    const store = setup(storage);
    store.signIn(session);
    store.signOut();
    expect(store.isAuthenticated()).toBe(false);
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('stops being authenticated once the clock passes the expiry', () => {
    let now = beforeExpiry;
    const store = setup(storage, () => now);
    store.signIn(session);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.activeToken()).toBe('token-1');

    now = afterExpiry;

    expect(store.isAuthenticated()).toBe(false);
    expect(store.activeToken()).toBeNull();
    expect(store.accessToken()).toBeNull();
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects a session that has already expired', () => {
    const store = setup(storage, afterExpiry);
    expect(store.signIn(session)).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects a session whose expiry is not a date', () => {
    const store = setup(storage);
    expect(store.signIn({ ...session, expiresAt: 'soon' })).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('keeps the session in memory when the storage throws (Safari private, quota)', () => {
    const store = setup(new ThrowingStorage());
    expect(store.signIn(session)).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('token-1');
    expect(() => store.signOut()).not.toThrow();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('starts signed out when the storage cannot be read', () => {
    const store = setup(new ThrowingStorage());
    expect(store.isAuthenticated()).toBe(false);
  });

  it.each([
    ['without user id', { ...session, user: { ...session.user, id: undefined } }],
    ['without email', { ...session, user: { ...session.user, email: undefined } }],
    ['without role', { ...session, user: { ...session.user, role: 42 } }],
    ['without user', { ...session, user: null }],
    ['with an empty token', { ...session, accessToken: '' }],
    ['with an unreadable expiry', { ...session, expiresAt: 'not-a-date' }],
  ])('drops a stored session %s', (_case, stored) => {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
    const store = setup(storage);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('works without storage (private mode, SSR)', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SESSION_STORAGE, useValue: null },
        { provide: CLOCK, useValue: () => beforeExpiry },
      ],
    });
    const store = TestBed.inject(SessionStore);
    store.signIn(session);
    expect(store.isAuthenticated()).toBe(true);
  });
});

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new DOMException('denied', 'SecurityError');
  }
  override removeItem(): void {
    throw new DOMException('denied', 'SecurityError');
  }
  override setItem(): void {
    throw new DOMException('quota', 'QuotaExceededError');
  }
}
