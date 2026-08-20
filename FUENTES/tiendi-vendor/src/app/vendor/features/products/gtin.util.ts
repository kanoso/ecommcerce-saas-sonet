/**
 * GTIN normalization and mod-10 check-digit validation.
 *
 * Mirrors the backend's canonical algorithm exactly (same weighting, same
 * 14-digit normalization, same accepted lengths) so a barcode that the
 * frontend accepts as valid is guaranteed to resolve identically on the
 * server. See DOCS/CATALOGO_MAESTRO.md §2.4 (check digit) and §2.5
 * (restricted-circulation prefixes).
 */

export type GtinType = 'GTIN_8' | 'GTIN_12' | 'GTIN_13' | 'GTIN_14';

export interface NormalizedGtin {
  gtin14: string;
  type: GtinType;
}

const LENGTH_TO_TYPE: Record<number, GtinType> = {
  8: 'GTIN_8',
  12: 'GTIN_12',
  13: 'GTIN_13',
  14: 'GTIN_14',
};

/**
 * Normalizes a GTIN to its canonical 14-digit form and validates
 * the mod-10 check digit. Accepts GTIN-8, GTIN-12, GTIN-13 and GTIN-14.
 *
 * @returns The normalized GTIN, or null when the input is invalid.
 */
export function normalizeGtin(raw: string): NormalizedGtin | null {
  const digits = raw.replace(/\D/g, '');
  const type = LENGTH_TO_TYPE[digits.length];
  if (!type) return null;

  const gtin14 = digits.padStart(14, '0');
  const payload = gtin14.slice(0, 13);
  const checkDigit = Number(gtin14[13]);

  // Weights 3 and 1 alternate, starting with 3 on the rightmost payload digit.
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const weight = (13 - i) % 2 === 1 ? 3 : 1;
    sum += Number(payload[i]) * weight;
  }

  const expected = (10 - (sum % 10)) % 10;
  return expected === checkDigit ? { gtin14, type } : null;
}

const RESTRICTED_PREFIXES = ['02', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'];

/**
 * Restricted-circulation codes are only unique inside a single retailer
 * (typical of supermarket scales for loose/weighed goods). They pass
 * check-digit validation but must never be promoted to a platform-wide
 * product identity.
 */
export function isRestrictedCirculation(gtin14: string): boolean {
  const ean13 = gtin14.slice(1); // drop the canonical padding digit
  return RESTRICTED_PREFIXES.some((prefix) => ean13.startsWith(prefix));
}
