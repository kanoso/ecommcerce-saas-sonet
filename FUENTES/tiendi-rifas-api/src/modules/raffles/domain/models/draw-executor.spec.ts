import { drawExecutorOf, parseDrawExecutorKind } from './draw';

describe('draw executor (DT-24)', () => {
  it('records an operator as ADMIN', () => {
    expect(drawExecutorOf('op-1')).toEqual({ executedBy: 'op-1', executedByKind: 'ADMIN' });
  });

  it('records no operator as the SYSTEM (the draw job)', () => {
    expect(drawExecutorOf(null)).toEqual({ executedBy: null, executedByKind: 'SYSTEM' });
  });

  it('parses a stored kind', () => {
    expect(parseDrawExecutorKind('ADMIN')).toBe('ADMIN');
    expect(parseDrawExecutorKind('SYSTEM')).toBe('SYSTEM');
  });

  it('reads a missing kind as a legacy draw (null)', () => {
    expect(parseDrawExecutorKind(null)).toBeNull();
    expect(parseDrawExecutorKind(undefined)).toBeNull();
  });

  it('refuses an unknown kind instead of guessing one', () => {
    expect(() => parseDrawExecutorKind('system')).toThrow(/executor kind/);
    expect(() => parseDrawExecutorKind('ROBOT')).toThrow(/executor kind/);
  });
});
