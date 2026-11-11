import { NumberStatus } from '../../core/api/api.models';
import { formatPrice } from '../catalog/raffle-format';

/** Pure rules of the number grid of `/rifas/:id`. */

export interface PageRange {
  page: number;
  first: number;
  last: number;
  label: string;
}

/** The API page (from 1) that holds a number; the API sorts numbers ascending. */
export const pageOfNumber = (number: number, numberMin: number, pageSize: number): number =>
  Math.floor((number - numberMin) / pageSize) + 1;

/** Zero-padded to the width of the largest number, as on a printed ticket. */
export const formatNumber = (number: number, numberMax: number): string =>
  String(number).padStart(String(numberMax).length, '0');

export function pageRanges(numberMin: number, numberMax: number, pageSize: number): PageRange[] {
  if (pageSize <= 0 || numberMax < numberMin) {
    return [];
  }
  const ranges: PageRange[] = [];
  for (let first = numberMin, page = 1; first <= numberMax; first += pageSize, page++) {
    const last = Math.min(numberMax, first + pageSize - 1);
    ranges.push({
      page,
      first,
      last,
      label: `${formatNumber(first, numberMax)}–${formatNumber(last, numberMax)}`,
    });
  }
  return ranges;
}

/** Adds or removes a number; the selection stays sorted and unique. */
export function toggleNumber(selected: readonly number[], number: number): number[] {
  return selected.includes(number)
    ? selected.filter((n) => n !== number)
    : [...selected, number].sort((a, b) => a - b);
}

/** Selected numbers whose last known status is no longer AVAILABLE. */
export const unavailableAmong = (
  selected: readonly number[],
  statuses: ReadonlyMap<number, NumberStatus>,
): number[] =>
  selected.filter((n) => {
    const status = statuses.get(n);
    return status !== undefined && status !== 'AVAILABLE';
  });

/**
 * Soles to whole cents, once. The shift is done on the decimal text
 * (`1.005e2`), not by multiplying, because 1.005 * 100 is 100.49999999999999
 * in binary floating point and would round down.
 */
export function toCents(soles: number): number {
  const shifted = Number(`${soles}e2`);
  return Math.round(Number.isFinite(shifted) ? shifted : soles * 100);
}

/** The total in whole cents: integer arithmetic, so 3 x 0.1 is exactly 30. */
export const selectionTotalCents = (count: number, ticketPrice: number): number => count * toCents(ticketPrice);

/** Whole cents shown as soles. */
export const formatCents = (cents: number): string => formatPrice(cents / 100);

export function selectionSummary(count: number): string {
  if (count === 0) {
    return 'Ningún número elegido';
  }
  return count === 1 ? '1 número elegido' : `${count} números elegidos`;
}

const STATUS_TEXT: Record<NumberStatus, string> = {
  AVAILABLE: 'disponible',
  RESERVED: 'reservado',
  SOLD: 'vendido',
  UNAVAILABLE: 'no disponible',
};

export function cellLabel(
  number: number,
  status: NumberStatus,
  selected: boolean,
  numberMax: number,
  isMine?: boolean,
): string {
  if (isMine) {
    return `Número ${formatNumber(number, numberMax)}, tu boleto (${status === 'SOLD' ? 'comprado' : 'reservado'})`;
  }
  const state = selected && status === 'AVAILABLE' ? 'elegido' : STATUS_TEXT[status];
  return `Número ${formatNumber(number, numberMax)}, ${state}`;
}

const listFormat = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

/** Tells the buyer which selected numbers were dropped, and why. */
export function lostNotice(lost: readonly number[], numberMax: number): string {
  const names = listFormat.format(lost.map((n) => formatNumber(n, numberMax)));
  return lost.length === 1
    ? `El número ${names} ya no está disponible y lo quitamos de tu selección.`
    : `Los números ${names} ya no están disponibles y los quitamos de tu selección.`;
}

/**
 * The numbers a 409 TICKETS_UNAVAILABLE lists in
 * `details.numeros_no_disponibles`, kept only when the buyer asked for them.
 * Null when the list is missing, malformed or names none of them: the caller
 * then reads the grid again to find out.
 */
export function lostNumbersOf(details: unknown, requested: readonly number[]): number[] | null {
  const listed =
    typeof details === 'object' && details !== null && !Array.isArray(details)
      ? (details as { numeros_no_disponibles?: unknown }).numeros_no_disponibles
      : undefined;
  if (!Array.isArray(listed) || !listed.every((n) => Number.isInteger(n))) {
    return null;
  }
  const asked = new Set(requested);
  const lost = [...new Set(listed as number[])].filter((n) => asked.has(n)).sort((a, b) => a - b);
  return lost.length > 0 ? lost : null;
}
