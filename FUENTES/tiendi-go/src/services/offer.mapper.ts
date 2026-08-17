import type { DeliveryOffer } from '@/types/delivery.types';

/**
 * The `order:offer` payload as the API actually emits it.
 *
 * Source of truth: `tiendi-api` → `matching.service.ts` → `emitToRider(riderId,
 * 'order:offer', …)`. It is nested, carries SI units (meters) and uppercase enums
 * that mirror the Prisma schema — all correct choices for a transport contract.
 *
 * `DeliveryOffer` is the opposite by design: flat, kilometres, lowercase enums —
 * correct choices for a view model. Neither side is wrong; what was missing was
 * the translation between them. Keep this interface strict: a server-side contract
 * change should surface here as a compile error, not as a red box on a rider's phone.
 */
export interface OrderOfferWire {
  deliveryId: string;
  orderId: string;
  store: {
    name: string;
    address: string;
    distanceMeters: number;
  };
  destination: {
    zone: string;
    distanceMeters: number;
    estimatedMinutes: number;
  };
  commission: {
    estimatedTotal: number;
    currency: string;
  };
  payment: {
    method: 'CASH' | 'DIGITAL';
    /** Present only when `method` is `'CASH'` — the amount to collect. */
    amount?: number;
  };
  items: {
    count: number;
    summary: string;
  };
  /** Seconds the rider has to accept, relative to delivery. */
  timerSeconds?: number;
  /** Absolute deadline (ISO 8601). Preferred over `timerSeconds` when present. */
  expiresAt?: string;
}

const METERS_PER_KM = 1000;

/**
 * `socket.on()` hands its handler `any`, so a drifted payload reaches this module at
 * runtime with TypeScript none the wiser. Every read is therefore guarded: a wrong
 * number is a visible, reportable bug — an exception mid-render is a dead screen.
 */
function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function metersToKilometres(meters: unknown): number {
  return finiteNumber(meters) / METERS_PER_KM;
}

/**
 * Resolves the absolute offer deadline. The API sends `expiresAt` (absolute)
 * so a late-recovered offer shows the *remaining* time; `timerSeconds` is a
 * legacy fallback that restarts the window from the client's clock.
 */
function resolveExpiresAt(wire: OrderOfferWire): number | undefined {
  if (typeof wire?.expiresAt === 'string') {
    const ms = Date.parse(wire.expiresAt);
    if (Number.isFinite(ms)) return ms;
  }
  const timerSeconds = finiteNumber(wire?.timerSeconds);
  return timerSeconds > 0 ? Date.now() + timerSeconds * 1000 : undefined;
}

/**
 * Translates a wire `order:offer` payload into the `DeliveryOffer` view model.
 *
 * Beyond flattening it reconciles three real mismatches:
 * - meters → kilometres (the UI labels read "km"); precision is kept, the view formats
 * - `'CASH' | 'DIGITAL'` → `'cash' | 'digital'`
 * - relative `timerSeconds` → absolute `expiresAt` epoch-ms, which is what the store's
 *   expiry branch needs to arm the countdown
 */
export function toDeliveryOffer(wire: OrderOfferWire): DeliveryOffer {
  const method = nonEmptyString(wire?.payment?.method).toUpperCase();
  const expiresAt = resolveExpiresAt(wire);

  return {
    deliveryId: nonEmptyString(wire?.deliveryId),
    storeName: nonEmptyString(wire?.store?.name),
    storeAddress: nonEmptyString(wire?.store?.address),
    storeDistance: metersToKilometres(wire?.store?.distanceMeters),
    clientZone: nonEmptyString(wire?.destination?.zone),
    // The wire's `destination.distanceMeters` measures store → customer only. The
    // rider's leg starts at their own position, so the "total" the card advertises is
    // rider → store → customer. Mapping the destination hop alone would let
    // `totalDistance` fall below `storeDistance` — a total smaller than one of its parts.
    totalDistance:
      metersToKilometres(wire?.store?.distanceMeters) +
      metersToKilometres(wire?.destination?.distanceMeters),
    estimatedTime: finiteNumber(wire?.destination?.estimatedMinutes),
    estimatedCommission: finiteNumber(wire?.commission?.estimatedTotal),
    itemCount: finiteNumber(wire?.items?.count),
    paymentMethod: method === 'CASH' ? 'cash' : 'digital',
    // Not part of the offer payload today; the type keeps the field nullable so the
    // card can render without it until the API starts sending it.
    specialInstructions: null,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
}
