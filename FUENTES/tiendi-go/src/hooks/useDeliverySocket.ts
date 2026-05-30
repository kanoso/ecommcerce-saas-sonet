import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { deliveryService } from '@/services/delivery.service';
import { getSocket } from '@/services/socket';
import type { DeliveryOffer, ActiveDelivery, DeliveryStatus } from '@/types/delivery.types';

type Socket = Awaited<ReturnType<typeof getSocket>>;

export function useDeliverySocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let socketRef: Socket | null = null;

    const handleOffer = (payload: DeliveryOffer) => {
      if (payload.expiresAt) {
        useDeliveryStore.getState().setOfferWithExpiry(payload, payload.expiresAt);
      } else {
        useDeliveryStore.getState().setOffer(payload);
      }
    };

    const handleUpdate = (payload: ActiveDelivery) => {
      useDeliveryStore.getState().upsertActiveDelivery(payload);
      const status = payload.status as DeliveryStatus;
      if (status === 'Entregado' || status === 'Cancelado') {
        useDeliveryStore.getState().removeActiveDelivery(payload.id);
      }
    };

    const handleCancelled = (payload: { id: string }) => {
      useDeliveryStore.getState().removeActiveDelivery(payload.id);
    };

    const handleConnect = async () => {
      try {
        const active = await deliveryService.getActiveDeliveries();
        if (!cancelled) {
          useDeliveryStore.getState().setActiveDeliveries(active);
        }
      } catch {
        // Network glitch; UI shows stale state from MMKV until next connect cycle
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
