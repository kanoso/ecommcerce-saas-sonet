import { api } from './api';
import { toActiveDelivery, type RiderDeliveryWire } from './delivery.mapper';
import { toHistoryPage, type DeliveryHistoryPage } from '@/utils/delivery-history';
import type {
  ActiveDelivery,
  DeliveryStatus,
  ReportIncidentPayload,
  CancelDeliveryPayload,
  PickupPayload,
  PodPayload,
} from '@/types/delivery.types';

/**
 * Every transition the API exposes as a bodiless `POST` answering 204.
 *
 * There is no `PATCH /deliveries/:id/status`. The API models each transition as its
 * own route so it can enforce the state machine server-side, and the two that carry
 * evidence — the pickup confirmation and the proof of delivery — are deliberately
 * absent from this table: they have dedicated methods below.
 */
const TRANSITION_ROUTES: Partial<Record<DeliveryStatus, string>> = {
  EnCaminoTienda: 'heading-to-store',
  EnTienda: 'at-store',
  EnCaminoCliente: 'heading-to-customer',
  EnDestino: 'at-destination',
};

/**
 * Reads a delivery back after a transition.
 *
 * The transition routes answer 204, so there is no body to parse — but the caller
 * writes the result straight into the store to repaint the screen. Deriving the new
 * state client-side would be a guess, and waiting for the `delivery:update` socket
 * frame would leave the rider looking at the old state whenever the socket hiccups.
 * One extra round trip on a user-initiated tap buys a screen that tells the truth.
 */
async function fetchDelivery(deliveryId: string): Promise<ActiveDelivery> {
  const { data } = await api.get<RiderDeliveryWire>(`/deliveries/${deliveryId}`);
  return toActiveDelivery(data);
}

export const deliveryService = {
  async acceptOffer(deliveryId: string): Promise<ActiveDelivery> {
    const { data } = await api.post<RiderDeliveryWire>(`/deliveries/${deliveryId}/accept`);
    return toActiveDelivery(data);
  },

  async rejectOffer(deliveryId: string): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/reject`);
  },

  async updateStatus(deliveryId: string, status: DeliveryStatus): Promise<ActiveDelivery> {
    const route = TRANSITION_ROUTES[status];
    if (!route) {
      // Reaching here means a caller tried to advance into a state that needs a
      // payload (`Recogido`, `Entregado`) or into one nothing transitions to. Failing
      // loudly beats posting to a URL the API does not serve and swallowing the 404.
      throw new Error(`No bodiless transition route for status "${status}"`);
    }

    await api.post(`/deliveries/${deliveryId}/${route}`);
    return fetchDelivery(deliveryId);
  },

  /**
   * The rider's in-flight delivery, as the one-element list the store holds.
   *
   * The API answers a single object or `null` — a rider can only carry one delivery
   * at a time. The store keeps a list because the screens iterate it, so the shape is
   * reconciled here rather than making every caller branch on null.
   */
  async getActiveDeliveries(): Promise<ActiveDelivery[]> {
    const { data } = await api.get<RiderDeliveryWire | null>('/deliveries/me/active');
    return data ? [toActiveDelivery(data)] : [];
  },

  /**
   * One page of the rider's finished deliveries, newest first.
   *
   * `limit` is left to the API's own default rather than sent from here — the server
   * caps it at 50 anyway, and a page size the client picks is a number that has to be
   * kept in sync across two repositories for no benefit.
   *
   * The mapping happens here, not in the screen, for the same reason
   * `getActiveDeliveries` maps: wire shapes should not escape this layer.
   */
  async getHistory(page: number): Promise<DeliveryHistoryPage> {
    const { data } = await api.get('/deliveries/me/history', { params: { page } });
    return toHistoryPage(data, new Date());
  },

  async reportIncident(deliveryId: string, payload: ReportIncidentPayload): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/incident`, payload);
  },

  async cancelDelivery(deliveryId: string, payload: CancelDeliveryPayload): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/cancel`, payload);
  },

  async pickup(deliveryId: string, payload: PickupPayload): Promise<ActiveDelivery> {
    await api.post(`/deliveries/${deliveryId}/pickup`, payload);
    return fetchDelivery(deliveryId);
  },

  async complete(deliveryId: string, payload: PodPayload): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/complete`, payload);
  },
};
