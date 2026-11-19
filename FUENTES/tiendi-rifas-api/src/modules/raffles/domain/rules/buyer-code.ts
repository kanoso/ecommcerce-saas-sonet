/**
 * The readable buyer code of in-person sales: derived from the alias the
 * operator typed, such as "Juan Perez" -> JUAN-PEREZ, and made unique with a
 * correlative (JUAN-PEREZ-2, JUAN-PEREZ-3, ...). It lets a returning buyer
 * without phone or document be found again.
 */

/** The longest base, before any correlative is appended. */
export const BUYER_CODE_MAX_BASE_LENGTH = 40;

/** The base used when the alias has no letter or digit left. */
export const BUYER_CODE_FALLBACK = 'COMPRADOR';

/**
 * Strips accents, uppercases, turns every run of other characters into one
 * dash and caps the length. The same function normalizes a code the operator
 * types, so "juan perez 2" finds JUAN-PEREZ-2.
 * @returns the code, or '' when nothing is left.
 */
export function normalizeBuyerCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BUYER_CODE_MAX_BASE_LENGTH)
    .replace(/-+$/, '');
}

/** The base code of a new buyer: the normalized alias, or the fallback. */
export function buyerCodeBaseOf(alias: string): string {
  return normalizeBuyerCode(alias) || BUYER_CODE_FALLBACK;
}

/**
 * The next free code for `base`: the base itself when free, otherwise the
 * highest correlative in use plus one (gaps are not reused).
 * @param existing the codes already stored that are `base` or `base-<n>`;
 *   other codes are ignored.
 */
export function nextBuyerCode(base: string, existing: readonly string[]): string {
  const upperBase = base.toUpperCase();
  const taken = existing.map((code) => code.toUpperCase());
  if (!taken.includes(upperBase)) {
    return upperBase;
  }
  const prefix = `${upperBase}-`;
  let highest = 1;
  for (const code of taken) {
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      highest = Math.max(highest, Number(suffix));
    }
  }
  return `${upperBase}-${highest + 1}`;
}
