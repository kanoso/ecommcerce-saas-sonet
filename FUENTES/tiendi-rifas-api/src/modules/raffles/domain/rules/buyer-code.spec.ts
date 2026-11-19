import {
  BUYER_CODE_FALLBACK,
  BUYER_CODE_MAX_BASE_LENGTH,
  buyerCodeBaseOf,
  nextBuyerCode,
  normalizeBuyerCode,
} from './buyer-code';

describe('normalizeBuyerCode', () => {
  it.each([
    ['Juan Perez', 'JUAN-PEREZ'],
    ['María Ríos', 'MARIA-RIOS'],
    ['juan  perez', 'JUAN-PEREZ'],
    ['  juan perez  ', 'JUAN-PEREZ'],
    ['Peña Núñez', 'PENA-NUNEZ'],
    ['Ana_María / O\'Brien!!', 'ANA-MARIA-O-BRIEN'],
    ['--José--', 'JOSE'],
    ['juan-perez-2', 'JUAN-PEREZ-2'],
    ['Lucía 3', 'LUCIA-3'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeBuyerCode(input)).toBe(expected);
  });

  it.each(['', '   ', '¡¿?!', '---', '🙂'])('returns an empty code for %p', (input) => {
    expect(normalizeBuyerCode(input)).toBe('');
  });

  it('caps the length without leaving a trailing dash', () => {
    const code = normalizeBuyerCode(`${'a'.repeat(39)} bcdef`);

    expect(code).toBe('A'.repeat(39));
    expect(code.length).toBeLessThanOrEqual(BUYER_CODE_MAX_BASE_LENGTH);
  });

  it('caps a long alias at the maximum length', () => {
    expect(normalizeBuyerCode('x'.repeat(100))).toBe('X'.repeat(BUYER_CODE_MAX_BASE_LENGTH));
  });
});

describe('buyerCodeBaseOf', () => {
  it('derives the base from the alias', () => {
    expect(buyerCodeBaseOf('María Ríos')).toBe('MARIA-RIOS');
  });

  it('falls back to a generic base when the alias has no letters or digits', () => {
    expect(buyerCodeBaseOf('¡¡¡')).toBe(BUYER_CODE_FALLBACK);
    expect(BUYER_CODE_FALLBACK).toBe('COMPRADOR');
  });
});

describe('nextBuyerCode', () => {
  it('uses the base when no code takes it', () => {
    expect(nextBuyerCode('JUAN-PEREZ', [])).toBe('JUAN-PEREZ');
  });

  it('uses the base when only correlatives exist', () => {
    expect(nextBuyerCode('JUAN-PEREZ', ['JUAN-PEREZ-2'])).toBe('JUAN-PEREZ');
  });

  it('appends -2 when the base is taken', () => {
    expect(nextBuyerCode('JUAN-PEREZ', ['JUAN-PEREZ'])).toBe('JUAN-PEREZ-2');
  });

  it('continues after the highest correlative, leaving gaps unfilled', () => {
    expect(nextBuyerCode('JUAN-PEREZ', ['JUAN-PEREZ', 'JUAN-PEREZ-2', 'JUAN-PEREZ-5'])).toBe(
      'JUAN-PEREZ-6',
    );
  });

  it('ignores codes that only share a prefix with the base', () => {
    expect(
      nextBuyerCode('JUAN', ['JUAN', 'JUAN-PEREZ', 'JUAN-PEREZ-7', 'JUANA-3', 'JUAN-2X']),
    ).toBe('JUAN-2');
  });

  it('compares codes case-insensitively', () => {
    expect(nextBuyerCode('JUAN', ['juan', 'juan-4'])).toBe('JUAN-5');
  });
});
