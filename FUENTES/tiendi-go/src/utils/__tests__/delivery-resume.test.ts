/**
 * Pins the two decisions that made an assigned delivery unreachable after the
 * rider closed and reopened the app.
 *
 * The delivery was never lost: `partialize` persists `activeDeliveries` to MMKV and
 * `handleConnect` refetches them. What was missing was any surface to reach them
 * from, and a detail screen that survived being opened before either of those had
 * finished.
 *
 * Both functions live here rather than inside the screens because the jest config
 * runs on `testEnvironment: node` with no renderer available — logic that has to be
 * proven has to be logic that can be called.
 */
import {
  resolveResumeState,
  selectResumableDeliveries,
} from '../delivery-resume';
import type { ActiveDelivery, DeliveryStatus } from '@/types/delivery.types';

function makeDelivery(id: string, overrides: Partial<ActiveDelivery> = {}): ActiveDelivery {
  return {
    id,
    status: 'Asignado',
    store: { name: 'Store', address: 'Addr', lat: -12, lng: -77, phone: '123' },
    client: { name: 'Client', address: 'Dest', lat: -12.1, lng: -77.1, phone: '456' },
    items: [{ name: 'Item A', quantity: 1 }],
    paymentMethod: 'digital',
    cashAmount: null,
    commission: 4500,
    ...overrides,
  };
}

// ─── selectResumableDeliveries ────────────────────────────────────────────────

describe('selectResumableDeliveries', () => {
  it('returns one row per in-progress delivery', () => {
    const rows = selectResumableDeliveries([
      makeDelivery('d1', { store: { ...makeDelivery('d1').store, name: 'Doña Rosa' } }),
      makeDelivery('d2', { store: { ...makeDelivery('d2').store, name: 'El Fogón' } }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('d1');
    expect(rows[0].storeName).toBe('Doña Rosa');
    expect(rows[1].storeName).toBe('El Fogón');
  });

  it('preserves store order so the list does not reshuffle under the rider', () => {
    const rows = selectResumableDeliveries([
      makeDelivery('d1', { status: 'EnDestino' }),
      makeDelivery('d2', { status: 'Asignado' }),
      makeDelivery('d3', { status: 'EnTienda' }),
    ]);

    expect(rows.map((r) => r.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('returns an empty array when there is nothing to resume', () => {
    expect(selectResumableDeliveries([])).toEqual([]);
  });

  // A terminal delivery is normally dropped by `removeActiveDelivery`. It survives in
  // MMKV when the app is killed between the API call and the store write, and the row
  // it would render is a trap: tapping it opens a screen whose only action is disabled.
  it.each<DeliveryStatus>(['Entregado', 'Cancelado', 'Incidente'])(
    'excludes %s, which has no next action',
    (status) => {
      const rows = selectResumableDeliveries([
        makeDelivery('done', { status }),
        makeDelivery('live', { status: 'EnCaminoTienda' }),
      ]);

      expect(rows.map((r) => r.id)).toEqual(['live']);
    },
  );

  // The label describes WHERE THE DELIVERY IS, not what to press. The action lives on
  // the detail screen; a list that shouted "Llegué a la tienda" at six rows at once
  // would be six buttons claiming to be the next thing to do.
  it.each<[DeliveryStatus, string]>([
    ['Asignado', 'Asignado'],
    ['EnCaminoTienda', 'En camino a la tienda'],
    ['EnTienda', 'En la tienda'],
    ['Recogido', 'Pedido recogido'],
    ['EnCaminoCliente', 'En camino al cliente'],
    ['EnDestino', 'En el destino'],
  ])('labels %s as "%s"', (status, expected) => {
    const [row] = selectResumableDeliveries([makeDelivery('d1', { status })]);

    expect(row.statusLabel).toBe(expected);
  });
});

// ─── resolveResumeState ───────────────────────────────────────────────────────

describe('resolveResumeState', () => {
  it('is ready as soon as the delivery is in the store', () => {
    expect(resolveResumeState(makeDelivery('d1'), false)).toBe('ready');
    expect(resolveResumeState(makeDelivery('d1'), true)).toBe('ready');
  });

  // The bug. On a cold start the screen mounts before MMKV rehydration and before the
  // socket has connected, so the delivery is legitimately absent for a moment. The old
  // code read that moment as "does not exist" and bounced the rider to home — which is
  // exactly where they had just come from.
  it('is loading while the delivery is absent and the grace period has not elapsed', () => {
    expect(resolveResumeState(undefined, false)).toBe('loading');
  });

  it('is missing once the grace period elapsed with no delivery', () => {
    expect(resolveResumeState(undefined, true)).toBe('missing');
  });
});
