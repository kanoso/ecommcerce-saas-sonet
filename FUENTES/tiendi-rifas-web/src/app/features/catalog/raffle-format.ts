/** Display rules of a raffle card. Prices are soles; dates show Lima time. */

const priceFormat = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const closeDateFormat = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Lima',
});

const countFormat = new Intl.NumberFormat('es-PE');

export const formatPrice = (amount: number): string => priceFormat.format(amount);

/** Null for an Invalid Date, which would make Intl throw a RangeError. */
export const formatCloseDate = (date: Date): string | null =>
  Number.isNaN(date.getTime()) ? null : closeDateFormat.format(date);

export const formatCount = (count: number): string => countFormat.format(count);

/**
 * Sold share as a whole percentage in [0, 100], rounded down so a raffle
 * never looks sold out early; any sale shows at least 1%.
 */
export function salesProgress(sold: number, total: number): number {
  if (total <= 0 || sold <= 0) {
    return 0;
  }
  const percent = Math.floor((sold / total) * 100);
  return Math.min(100, Math.max(1, percent));
}
