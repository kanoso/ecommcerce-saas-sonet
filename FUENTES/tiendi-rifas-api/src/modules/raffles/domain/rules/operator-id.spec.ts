import { InvalidOperatorIdError } from '../errors/domain.errors';
import { isOperatorId, parseOperatorId } from './operator-id';

describe('operator ids (DT-17)', () => {
  it.each([
    ['admin-1', 'admin-1'],
    ['  admin-1\t', 'admin-1'],
    ['Admin-1', 'admin-1'],
    ['auth0.user_42@tiendi.pe', 'auth0.user_42@tiendi.pe'],
    ['a', 'a'],
    ['x'.repeat(128), 'x'.repeat(128)],
  ])('keeps %j as %j', (raw, canonical) => {
    expect(parseOperatorId(raw)).toBe(canonical);
  });

  it.each([
    ['empty', ''],
    ['blank', ' \t\n'],
    ['a space inside', 'admin 1'],
    ['a tab inside', 'admin\t1'],
    ['a pipe', 'auth0|abc'],
    ['a non-breaking space', 'admin 1'],
    ['an accent', 'adminé'],
    ['too long', 'x'.repeat(129)],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s', (_, raw) => {
    expect(() => parseOperatorId(raw)).toThrow(InvalidOperatorIdError);
  });

  it('tells a canonical id from anything else, without trimming', () => {
    expect(isOperatorId('admin-1')).toBe(true);
    expect(isOperatorId(' admin-1')).toBe(false);
    expect(isOperatorId('Admin-1')).toBe(false);
    expect(isOperatorId(7)).toBe(false);
  });
});
