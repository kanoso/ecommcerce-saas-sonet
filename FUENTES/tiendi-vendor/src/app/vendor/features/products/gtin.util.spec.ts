/**
 * Unit tests for the GTIN mod-10 check-digit algorithm.
 * Mirrors the reference implementation in DOCS/CATALOGO_MAESTRO.md §2.4.
 */
import { normalizeGtin } from './gtin.util';

describe('normalizeGtin', () => {
  it('should accept a valid GTIN-13 and normalize it to 14 digits', () => {
    const result = normalizeGtin('7750182001236');
    expect(result).toEqual({ gtin14: '07750182001236', type: 'GTIN_13' });
  });

  it('should reject a GTIN-13 with an invalid check digit', () => {
    expect(normalizeGtin('7750182001237')).toBeNull();
  });

  it('should accept a valid GTIN-8', () => {
    // payload "4006381" + computed check digit 2
    expect(normalizeGtin('40063812')).toEqual({
      gtin14: '00000040063812',
      type: 'GTIN_8',
    });
  });

  it('should accept a valid GTIN-12 (UPC-A)', () => {
    // payload "03600029145" + computed check digit 2
    expect(normalizeGtin('036000291452')).toEqual({
      gtin14: '00036000291452',
      type: 'GTIN_12',
    });
  });

  it('should accept a valid GTIN-14', () => {
    // GTIN-13 "7750182001236" prefixed with a packaging-level indicator digit
    expect(normalizeGtin('17750182001233')).toEqual({
      gtin14: '17750182001233',
      type: 'GTIN_14',
    });
  });

  it('should strip non-digit characters before validating', () => {
    expect(normalizeGtin('775-0182-001236')).toEqual({
      gtin14: '07750182001236',
      type: 'GTIN_13',
    });
  });

  it('should return null for a length that is not a valid GTIN length', () => {
    expect(normalizeGtin('12345')).toBeNull();
    expect(normalizeGtin('123456789012345')).toBeNull();
  });

  it('should return null for an empty string', () => {
    expect(normalizeGtin('')).toBeNull();
  });
});
