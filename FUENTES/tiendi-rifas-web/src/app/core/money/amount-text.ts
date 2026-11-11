/**
 * Whole cents as the decimal soles text tiendi-rifas-api reads, such as
 * `monto_declarado`: `2050` is `"20.50"`. Integer math only, so no floating
 * point error can creep in.
 */
export function centsToAmountText(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
