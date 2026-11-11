import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { OperatorAlert } from '../../../core/api/api.models';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminAlertsStore } from './admin-alerts.store';

const anAlert = (overrides: Partial<OperatorAlert> = {}): OperatorAlert => ({
  id: 'a-1',
  type: 'LATE_PAYMENT_CLAIM',
  raffleId: 'r-1',
  raffleTitle: 'Smart TV',
  orderId: 'o-1',
  paymentAccountId: null,
  amount: 20,
  createdAt: new Date('2026-11-03T15:00:00.000Z'),
  ...overrides,
});

describe('AdminAlertsStore', () => {
  let mockAdminApi: {
    alerts: ReturnType<typeof vi.fn>;
    pendingProofs: ReturnType<typeof vi.fn>;
    markAlertRead: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAdminApi = {
      alerts: vi.fn(() => of([anAlert(), anAlert({ id: 'a-2', type: 'PROOF_VERIFICATION_TIMEOUT' })])),
      pendingProofs: vi.fn(() => of([])),
      markAlertRead: vi.fn(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAlertsStore,
        { provide: AdminApi, useValue: mockAdminApi },
      ],
    });
  });

  it('loads unread alerts and computes unread count', async () => {
    const store = TestBed.inject(AdminAlertsStore);
    expect(store.status()).toBe('idle');
    expect(store.unreadCount()).toBe(0);

    store.load();

    expect(store.status()).toBe('ready');
    expect(store.alerts()).toHaveLength(2);
    expect(store.unreadCount()).toBe(2);
    expect(store.pendingProofsCount()).toBe(0);
  });

  it('loads pending proofs count', async () => {
    mockAdminApi.pendingProofs.mockReturnValue(of([{ id: 'p-1' }, { id: 'p-2' }] as any));
    const store = TestBed.inject(AdminAlertsStore);
    store.load();

    expect(store.pendingProofsCount()).toBe(2);
  });

  it('marks an alert as read and removes it from list', async () => {
    const store = TestBed.inject(AdminAlertsStore);
    store.load();

    store.markAsRead('a-1');

    expect(mockAdminApi.markAlertRead).toHaveBeenCalledWith('a-1');
    expect(store.alerts()).toHaveLength(1);
    expect(store.alerts()[0].id).toBe('a-2');
    expect(store.unreadCount()).toBe(1);
  });

  it('handles load error', async () => {
    mockAdminApi.alerts.mockReturnValue(throwError(() => new ApiError(500, 'SERVER_ERROR', 'Falló el servidor')));
    mockAdminApi.pendingProofs.mockReturnValue(throwError(() => new ApiError(500, 'SERVER_ERROR', 'Falló el servidor')));
    const store = TestBed.inject(AdminAlertsStore);

    store.load();

    expect(store.status()).toBe('ready'); // catchError returns of([]) for resilient loading
  });

  it('toggles drawer state', () => {
    const store = TestBed.inject(AdminAlertsStore);
    expect(store.isDrawerOpen()).toBe(false);

    store.openDrawer();
    expect(store.isDrawerOpen()).toBe(true);

    store.closeDrawer();
    expect(store.isDrawerOpen()).toBe(false);
  });

  it('sets pending proofs count explicitly', () => {
    const store = TestBed.inject(AdminAlertsStore);
    store.setPendingProofsCount(5);
    expect(store.pendingProofsCount()).toBe(5);
    store.setPendingProofsCount(0);
    expect(store.pendingProofsCount()).toBe(0);
  });

  it('sorts alerts with most recent first', () => {
    const older = anAlert({ id: 'old', createdAt: new Date('2026-11-01T10:00:00Z') });
    const newer = anAlert({ id: 'new', createdAt: new Date('2026-11-05T10:00:00Z') });
    mockAdminApi.alerts.mockReturnValue(of([older, newer]));

    const store = TestBed.inject(AdminAlertsStore);
    store.load();

    expect(store.alerts()[0].id).toBe('new');
    expect(store.alerts()[1].id).toBe('old');
  });
});
