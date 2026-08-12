import type { ActiveDelivery, DeliveryStatus } from '@/types/delivery.types';

/**
 * A delivery the rider can still act on, reduced to what a list row renders.
 *
 * Deliberately a list and not a single "current delivery": today the API models one
 * delivery per order (`Delivery.orderId` is `@unique`), so this array holds one entry
 * in practice. It is shaped as a list anyway because the case that is coming — a
 * kitchen handing the rider four orders to drop at four addresses — changes the count
 * and nothing else. A card would have to be rewritten; a list of one already renders
 * the same thing.
 */
export interface ResumableDelivery {
  id: string;
  storeName: string;
  statusLabel: string;
}

/**
 * How far along a delivery is, in the rider's words.
 *
 * These describe a STATE, unlike the labels in the delivery screen, which name the
 * next ACTION ("Llegué a la tienda"). A list is read to decide which delivery to open;
 * action labels belong to the screen where the action can actually be taken.
 */
const STATUS_LABELS: Record<DeliveryStatus, string> = {
  Asignado: 'Asignado',
  EnCaminoTienda: 'En camino a la tienda',
  EnTienda: 'En la tienda',
  Recogido: 'Pedido recogido',
  EnCaminoCliente: 'En camino al cliente',
  EnDestino: 'En el destino',
  Entregado: 'Entrega completada',
  Incidente: 'Incidente reportado',
  Cancelado: 'Entrega cancelada',
};

/**
 * States with nothing left to do. A delivery in one of these is finished, whatever
 * the store still remembers about it.
 */
const TERMINAL_STATES: readonly DeliveryStatus[] = ['Entregado', 'Incidente', 'Cancelado'];

export function isTerminalStatus(status: DeliveryStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * The deliveries worth offering the rider a way back into.
 *
 * Terminal ones are filtered rather than trusted to be absent. `removeActiveDelivery`
 * normally drops them, but it runs after the API call returns — kill the app in that
 * window and MMKV keeps a completed delivery forever. Listing it would hand the rider
 * a row that opens a screen with every action disabled.
 *
 * Order is the store's order, untouched. Sorting by progress would mean the list
 * rearranges itself as the rider works, moving the row they were about to tap.
 */
export function selectResumableDeliveries(
  deliveries: readonly ActiveDelivery[],
): ResumableDelivery[] {
  return deliveries
    .filter((delivery) => !isTerminalStatus(delivery.status))
    .map((delivery) => ({
      id: delivery.id,
      storeName: delivery.store.name,
      statusLabel: STATUS_LABELS[delivery.status],
    }));
}

/**
 * `loading` — not in the store yet, but too early to conclude anything.
 * `ready`   — found; render it.
 * `missing` — still absent after the grace period; it genuinely is not there.
 */
export type ResumeState = 'loading' | 'ready' | 'missing';

/**
 * Whether the delivery screen can render, must wait, or should give up.
 *
 * The distinction between "absent" and "absent for good" is the whole point. The
 * screen used to treat the first render as proof of absence and redirect home, which
 * was invisible while nothing linked into the screen: the only way in was tapping a
 * delivery that was, by definition, already in the store.
 *
 * Opening it from a list, a notification or a cold start inverts that. Two async
 * sources fill `activeDeliveries` — MMKV rehydration and the socket's `connect`
 * refetch — and neither has finished when the screen first mounts. Redirecting there
 * bounces the rider back to the list they just tapped, which reads as the app losing
 * their delivery.
 */
export function resolveResumeState(
  delivery: ActiveDelivery | undefined,
  graceElapsed: boolean,
): ResumeState {
  if (delivery) return 'ready';
  return graceElapsed ? 'missing' : 'loading';
}
