import { InvalidOperationNumberError } from '../errors/domain.errors';
import {
  collisionExternalId,
  normalizeOperationNumber,
  operationNumberOf,
} from './operation-number';

describe('normalizeOperationNumber', () => {
  it.each([
    ['op-123', 'OP123'],
    ['  OP 123  ', 'OP123'],
    ['op - 1 2 3', 'OP123'],
    ['Op\t123\n', 'OP123'],
    ['OP--123', 'OP123'],
    ['OP123', 'OP123'],
  ])('turns %j into %s', (typed, expected) => {
    expect(normalizeOperationNumber(typed)).toBe(expected);
  });

  it.each([
    ['a no-break space', 'OP 123'],
    ['a narrow no-break space', 'OP 123'],
    ['an ideographic space', 'OP　123'],
    ['a zero-width space', 'OP​123'],
    ['a zero-width joiner', 'OP‍123'],
    ['a word joiner', 'OP⁠123'],
    ['a byte order mark', '﻿OP123'],
    ['a soft hyphen', 'OP­123'],
    ['a right-to-left mark', 'OP‏123'],
    ['an en dash', 'OP–123'],
    ['an em dash', 'OP—123'],
    ['a horizontal bar', 'OP―123'],
    ['a minus sign', 'OP−123'],
    ['a non-breaking hyphen', 'OP‑123'],
    ['a full-width hyphen', 'OP－123'],
    ['full-width digits', 'OP１２３'],
    ['full-width letters', 'ＯＰ123'],
    ['full-width lower case', 'ｏｐ123'],
  ])('sees through %s', (_case, typed) => {
    expect(normalizeOperationNumber(typed)).toBe('OP123');
  });

  it.each([
    ['a Cyrillic lookalike', 'АB123'],
    ['a Greek lookalike', 'ΟP123'],
    ['Arabic digits', 'OP١٢٣'],
    ['a letter that upper-cases to two', 'OPß123'],
    ['a letter that upper-cases to ASCII', 'OPı123'],
    ['a hash', 'OP#123'],
    ['a dot', 'OP.123'],
    ['a slash', 'OP/123'],
    ['an underscore', 'OP_123'],
  ])('refuses %s', (_case, typed) => {
    expect(() => normalizeOperationNumber(typed)).toThrow(
      InvalidOperationNumberError,
    );
  });

  it.each(['', '   ', '---', ' - - ', '​', '—', '﻿− '])(
    'refuses %j, which leaves nothing',
    (typed) => {
      expect(() => normalizeOperationNumber(typed)).toThrow(
        InvalidOperationNumberError,
      );
    },
  );

  it('refuses a value that is not text', () => {
    expect(() =>
      normalizeOperationNumber(undefined as unknown as string),
    ).toThrow(InvalidOperationNumberError);
  });
});

describe('collisionExternalId', () => {
  it('joins the number and the bank', () => {
    expect(collisionExternalId('OP123', 'BCP')).toBe('OP123#BCP');
  });

  it('can never equal a plain number, which refuses the separator', () => {
    expect(() =>
      normalizeOperationNumber(collisionExternalId('OP123', 'BCP')),
    ).toThrow(InvalidOperationNumberError);
  });
});

describe('operationNumberOf', () => {
  it.each([
    ['OP123', 'OP123'],
    ['OP123#BCP', 'OP123'],
  ])('reads the number of %s', (externalId, expected) => {
    expect(operationNumberOf(externalId)).toBe(expected);
  });
});
