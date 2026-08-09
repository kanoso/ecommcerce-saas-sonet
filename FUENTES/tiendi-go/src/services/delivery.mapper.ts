import type { ActiveDelivery, DeliveryStatus, DeliveryWaypoint } from '@/types/delivery.types';

/**
 * The delivery payload exactly as `tiendi-api` serves it.
 *
 * Mirrors `RiderDeliveryDto` in `tiendi-api/src/modules/delivery/dto/rider-delivery.dto.ts`,
 * returned by `POST /deliveries/:id/accept`, `GET /deliveries/me/active` and
 * `GET /deliveries/:id`.
 *
 * Declared here rather than assumed at the axios call site: an `api.get<ActiveDelivery>()`
 * makes the compiler vouch for a shape nothing ever checked, and that is precisely how
 * a payload with `customer` and no `client` reached a screen that dereferenced
 * `delivery.client.lat` to draw a map.
 */
export interface RiderDeliveryWire {
  id: string;
  status: WireStatus;
  store: WireWaypoint;
  /** The API's name for the counterparty. Every screen in this app calls it `client`. */
  customer: WireWaypoint;
  items: Array<{ name: string; quantity: number }>;
  paymentMethod: 'CASH' | 'DIGITAL';
  cashAmount: number | null;
  commission: number | null;
}

interface WireWaypoint {
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

/** Prisma's `DeliveryStatus` enum, verbatim. */
type WireStatus =
  | 'ASSIGNED'
  | 'HEADING_TO_STORE'
  | 'AT_STORE'
  | 'PICKED_UP'
  | 'HEADING_TO_CUSTOMER'
  | 'AT_DESTINATION'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'INCIDENT';

/**
 * The server keeps Prisma's vocabulary because tiendi-vendor and tiendi-web read the
 * same column; the app keeps Spanish labels because they reach the screen. This table
 * is the one place the two meet.
 *
 * `RETURNED` has no app-side member — the union predates the "rider brought it back"
 * flow. It collapses onto `Cancelado`: both are terminal, both must drop the delivery
 * off the active list, and any non-terminal substitute would strand the rider on a
 * screen whose every action button is wrong. A dedicated `Devuelto` label is the real
 * fix and belongs with whatever UI is built for that flow.
 */
const STATUS_BY_WIRE: Record<WireStatus, DeliveryStatus> = {
  ASSIGNED: 'Asignado',
  HEADING_TO_STORE: 'EnCaminoTienda',
  AT_STORE: 'EnTienda',
  PICKED_UP: 'Recogido',
  HEADING_TO_CUSTOMER: 'EnCaminoCliente',
  AT_DESTINATION: 'EnDestino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  RETURNED: 'Cancelado',
  INCIDENT: 'Incidente',
};

/**
 * A missing number is missing, not zero.
 *
 * Zero is a real coordinate — it sits in the Gulf of Guinea — so a coalesced `?? 0`
 * would render a confident map pin two continents away and the rider would ride
 * towards it. Null forces the screen to admit it does not know.
 */
function finiteOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toWaypoint(source: WireWaypoint | undefined): DeliveryWaypoint {
  return {
    name: textOrNull(source?.name) ?? '',
    address: textOrNull(source?.address),
    phone: textOrNull(source?.phone),
    lat: finiteOrNull(source?.lat),
    lng: finiteOrNull(source?.lng),
  };
}

/**
 * Translates the server's delivery payload into the view model the screens consume.
 *
 * Every field is read defensively, for the same reason `offer.mapper.ts` is: this
 * function is the last thing standing between an untyped `socket.on` payload and a
 * screen that dereferences the result to draw a map. A blank field is a visible,
 * reportable bug — an exception mid-render is a dead screen for a rider standing on
 * the street with the order already in the box.
 */
export function toActiveDelivery(wire: RiderDeliveryWire): ActiveDelivery {
  const isCash = textOrNull(wire?.paymentMethod)?.toUpperCase() === 'CASH';

  return {
    id: wire?.id,
    // An unknown status would fail every `status ===` branch downstream and freeze the
    // screen with no action available. A server deploy can add an enum member long
    // before the app store approves a build that knows about it.
    status: STATUS_BY_WIRE[wire?.status] ?? 'Asignado',
    store: toWaypoint(wire?.store),
    client: toWaypoint(wire?.customer),
    items: (Array.isArray(wire?.items) ? wire.items : [])
      .map((item) => ({ name: textOrNull(item?.name), quantity: item?.quantity }))
      // A line with no name cannot be checked against the physical order, so it is
      // dropped rather than rendered as a blank row the rider has to interpret.
      .filter((item): item is { name: string; quantity: number } => item.name !== null),
    paymentMethod: isCash ? 'cash' : 'digital',
    cashAmount: isCash ? finiteOrNull(wire?.cashAmount) : null,
    commission: finiteOrNull(wire?.commission),
  };
}
