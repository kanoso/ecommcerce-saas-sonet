import { TestBed } from '@angular/core/testing';
import { SESSION_STORAGE } from '../session/session.store';
import { memoryStorage } from '../session/testing/memory-storage';
import { DrawPins } from './draw-pins';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function pinsWith(storage: Storage | null = memoryStorage()) {
  TestBed.configureTestingModule({ providers: [{ provide: SESSION_STORAGE, useValue: storage }] });
  return { pins: TestBed.inject(DrawPins), storage };
}

/** A browser that refuses site data: every call throws, as Safari private mode can. */
function throwingStorage(): Storage {
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return {
    get length(): number {
      return refuse();
    },
    clear: refuse,
    getItem: refuse,
    key: refuse,
    removeItem: refuse,
    setItem: refuse,
  };
}

describe('DrawPins', () => {
  it('reports a first visit, then anchored once a value seen before matches', () => {
    const { pins } = pinsWith();
    const seen = {
      commitmentHash: HASH_A,
      drandRound: '1000',
      drawAt: '2026-11-16T01:30:00.000Z',
      salesCloseAt: '2026-11-15T23:00:00.000Z',
    };

    expect(pins.observe('r-1', seen)).toEqual({ status: 'first-visit', conflicts: [] });
    expect(
      pins.observe('r-1', { ...seen, commitmentHash: HASH_A.toUpperCase(), drawAt: '2026-11-16T01:30:00Z' }),
    ).toEqual({ status: 'anchored', conflicts: [] });
  });

  it('reports every value that differs from the one first seen, and keeps the first one', () => {
    const { pins } = pinsWith();
    pins.observe('r-1', { commitmentHash: HASH_A, drandRound: '1000', salesCloseAt: '2026-11-15T23:00:00.000Z' });

    const report = pins.observe('r-1', {
      commitmentHash: HASH_B,
      drandRound: '1001',
      salesCloseAt: '2026-11-15T23:00:00.000Z',
    });

    expect(report.conflicts).toEqual([
      { field: 'commitmentHash', pinned: HASH_A, seen: HASH_B },
      { field: 'drandRound', pinned: '1000', seen: '1001' },
    ]);
    expect(pins.observe('r-1', { commitmentHash: HASH_B }).conflicts).toEqual([
      { field: 'commitmentHash', pinned: HASH_A, seen: HASH_B },
    ]);
  });

  it('checks without pinning: only pin() writes, and only values not pinned yet', () => {
    const { pins } = pinsWith();

    expect(pins.check('r-1', { commitmentHash: HASH_A })).toEqual({ status: 'first-visit', conflicts: [] });
    expect(pins.check('r-1', { commitmentHash: HASH_B })).toEqual({ status: 'first-visit', conflicts: [] });

    pins.pin('r-1', { commitmentHash: HASH_A });
    pins.pin('r-1', { commitmentHash: HASH_B, soldListHash: HASH_B });

    expect(pins.check('r-1', { commitmentHash: HASH_A, soldListHash: HASH_B })).toEqual({
      status: 'anchored',
      conflicts: [],
    });
  });

  it('keeps raffles apart', () => {
    const { pins } = pinsWith();
    pins.observe('r-1', { commitmentHash: HASH_A });

    expect(pins.observe('r-2', { commitmentHash: HASH_B })).toEqual({ status: 'first-visit', conflicts: [] });
  });

  it('treats an unreadable stored entry as a first visit', () => {
    const storage = memoryStorage();
    storage.setItem('tiendi-rifas.pins.r-1', '{not json');
    const { pins } = pinsWith(storage);

    expect(pins.observe('r-1', { commitmentHash: HASH_A })).toEqual({ status: 'first-visit', conflicts: [] });
    expect(pins.observe('r-1', { commitmentHash: HASH_B }).conflicts).toHaveLength(1);
  });

  it('reports no storage when the browser offers none', () => {
    const { pins } = pinsWith(null);

    expect(pins.observe('r-1', { commitmentHash: HASH_A })).toEqual({ status: 'no-storage', conflicts: [] });
  });

  it('reports no storage, and does not throw, when the storage throws', () => {
    const { pins } = pinsWith(throwingStorage());

    expect(pins.observe('r-1', { commitmentHash: HASH_A })).toEqual({ status: 'no-storage', conflicts: [] });
    expect(() => pins.pin('r-1', { commitmentHash: HASH_A })).not.toThrow();
  });
});
