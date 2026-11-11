import { TestBed } from '@angular/core/testing';
import { CLOCK } from './session.store';
import { memoryStorage } from './testing/memory-storage';
import { RETURN_PATH_STORAGE, RETURN_PATH_STORAGE_KEY, ReturnPathStore, safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it.each(['/', '/rifas/11111111-1111-4111-8111-111111111111', '/rifas/abc?pagina=2'])(
    'accepts the internal path %s',
    (path) => {
      expect(safeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    ['an empty value', ''],
    ['a relative path', 'rifas/abc'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a leading backslash', '\\\\evil.example'],
    ['an encoded backslash trick', '/%5Cevil.example'],
    ['an absolute URL', 'https://evil.example/rifas'],
    ['a script URL', 'javascript:alert(1)'],
    ['a tab the browser would drop', '/\t/evil.example'],
    ['a line break', '/rifas\n/x'],
    ['leading spaces', ' /rifas'],
    ['the sign-in page itself', '/ingresar?volver=/rifas'],
    ['the link callback', '/acceso#token=abc'],
    ['the sign-in page with an encoded letter', '/%69ngresar'],
    ['the sign-in page with an encoded trailing slash', '/ingresar%2F'],
    ['the link callback fully encoded', '/%61%63%63%65%73%6F?x=1'],
    ['the sign-in page with matrix parameters', '/ingresar;volver=x'],
    ['an overly long path', `/${'a'.repeat(600)}`],
  ])('rejects %s', (_, path) => {
    expect(safeReturnPath(path)).toBeNull();
  });

  it('rejects values that are not text', () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(['/rifas'])).toBeNull();
  });
});

describe('ReturnPathStore', () => {
  let storage: Storage;
  let now: number;
  let store: ReturnPathStore;

  beforeEach(() => {
    storage = memoryStorage();
    now = 1_000_000;
    TestBed.configureTestingModule({
      providers: [
        { provide: RETURN_PATH_STORAGE, useValue: storage },
        { provide: CLOCK, useValue: () => now },
      ],
    });
    store = TestBed.inject(ReturnPathStore);
  });

  it('gives back the remembered path once', () => {
    expect(store.remember('/rifas/abc')).toBe(true);
    expect(store.consume()).toBe('/rifas/abc');
    expect(store.consume()).toBeNull();
  });

  it('refuses to remember an unsafe path', () => {
    expect(store.remember('//evil.example')).toBe(false);
    expect(store.consume()).toBeNull();
  });

  it('never returns a tampered stored value', () => {
    storage.setItem(RETURN_PATH_STORAGE_KEY, JSON.stringify({ path: 'https://evil.example', savedAt: now }));
    expect(store.consume()).toBeNull();
    storage.setItem(RETURN_PATH_STORAGE_KEY, 'not json');
    expect(store.consume()).toBeNull();
  });

  it('forgets a path older than an hour', () => {
    store.remember('/rifas/abc');
    now += 60 * 60 * 1000 + 1;
    expect(store.consume()).toBeNull();
  });

  it('works without storage', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: RETURN_PATH_STORAGE, useValue: null }] });
    const memoryless = TestBed.inject(ReturnPathStore);
    expect(memoryless.remember('/rifas/abc')).toBe(false);
    expect(memoryless.consume()).toBeNull();
  });
});
