import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { deliveryService } from '@/services/delivery.service';
import { getSocket } from '@/services/socket';
import { toDeliveryOffer, type OrderOfferWire } from '@/services/offer.mapper';
import { toActiveDelivery, type RiderDeliveryWire } from '@/services/delivery.mapper';

type Socket = Awaited<ReturnType<typeof getSocket>>;

/**
 * Applies one `delivery:update` frame to the store.
 *
 * Exported and free of the effect closure so it can be tested directly: this is the
 * fifth and last way a delivery reaches the store, and the only one that used to write
 * an unmapped payload into it.
 *
 * The status is read off the mapped delivery, never off the wire. Comparing the
 * server's `DELIVERED` against the app's `Entregado` is false, and the delivery it
 * failed to remove stayed on the rider's active list — offering actions for an order
 * already handed over.
 */
export function applyDeliveryUpdate(payload: RiderDeliveryWire): void {
  const delivery = toActiveDelivery(payload);
  useDeliveryStore.getState().upsertActiveDelivery(delivery);

  if (delivery.status === 'Entregado' || delivery.status === 'Cancelado') {
    useDeliveryStore.getState().removeActiveDelivery(delivery.id);
  }
}

export function useDeliverySocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let socketRef: Socket | null = null;

    // `socket.on()` types its handler argument as `any`, so annotating this as the
    // view model would have TypeScript vouch for a shape that never arrives. The
    // parameter names the WIRE contract and the mapper does the translation, which is
    // what keeps the next server-side contract change a compile error here rather than
    // a crash inside the card that renders it.
    const handleOffer = (payload: OrderOfferWire) => {
      const offer = toDeliveryOffer(payload);
      if (offer.expiresAt) {
        useDeliveryStore.getState().setOfferWithExpiry(offer, offer.expiresAt);
      } else {
        useDeliveryStore.getState().setOffer(offer);
      }
    };

    // Same reasoning as `handleOffer` above: the parameter names the WIRE contract and
    // the mapper does the translation.
    const handleUpdate = (payload: RiderDeliveryWire) => {
      applyDeliveryUpdate(payload);
    };

    const handleCancelled = (payload: { id: string }) => {
      useDeliveryStore.getState().removeActiveDelivery(payload.id);
    };

    const handleConnect = async () => {
      // Subscribe to `rider:{riderId}` — the room the API emits `order:offer`,
      // `delivery:update` and `location:request` into. Without this join the
      // socket is connected but receives nothing. The server derives the riderId
      // from the handshake JWT, so no payload is sent.
      //
      // This runs before the fetch below on purpose: a slow request must not
      // delay the subscription. It also lives inside `handleConnect` so every
      // reconnect re-joins, since rooms are per-socket and die with the socket.
      socketRef?.emit('join-rider-room');

      try {
        const active = await deliveryService.getActiveDeliveries();
        if (!cancelled) {
          useDeliveryStore.getState().setActiveDeliveries(active);
        }
      } catch (err) {
        // The UI falls back to whatever MMKV persisted until the next connect cycle,
        // which is the right behaviour for a dropped request. It is the wrong
        // behaviour for a wrong route — and this catch swallowed a 404 from
        // `GET /deliveries/active` for the entire life of that bug, leaving the rider
        // with an empty list and the logs with nothing to explain it.
        if (__DEV__) {
          console.warn('[socket] active deliveries fetch failed', err);
        }
      }

      // Recover an offer the API emitted while this socket was not connected.
      // `order:offer` is one-shot, so a rider who was offline at that moment
      // would otherwise never see it.
      try {
        const offer = await deliveryService.getPendingOffer();
        if (!cancelled && offer && !useDeliveryStore.getState().offer) {
          if (offer.expiresAt) {
            useDeliveryStore.getState().setOfferWithExpiry(offer, offer.expiresAt);
          } else {
            useDeliveryStore.getState().setOffer(offer);
          }
        }
      } catch {
        // best-effort recovery — a missed offer is not fatal
      }
    };

    (async () => {
      const socket = await getSocket();
      if (cancelled) return;
      socketRef = socket;
      socket.on('order:offer', handleOffer);
      socket.on('delivery:update', handleUpdate);
      socket.on('delivery:cancelled', handleCancelled);
      socket.on('connect', handleConnect);

      if (__DEV__) {
        // Diagnostics only: the room join is otherwise invisible from the client,
        // which makes a missing `order:offer` impossible to attribute.
        socket.on('rider-room-joined', (payload: { riderId: string }) => {
          console.log('[socket] joined rider room', payload.riderId);
        });
        socket.on('error', (payload: { message: string }) => {
          console.warn('[socket] server error', payload?.message);
        });
      }
      if (socket.connected) {
        handleConnect();
      } else {
        socket.connect();
      }
    })();

    return () => {
      cancelled = true;
      if (socketRef) {
        socketRef.off('order:offer', handleOffer);
        socketRef.off('delivery:update', handleUpdate);
        socketRef.off('delivery:cancelled', handleCancelled);
        socketRef.off('connect', handleConnect);
      }
    };
  }, [isAuthenticated]);
}
