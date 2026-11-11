import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OperatorAlert } from '../../../core/api/api.models';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminAlertsStore } from '../alerts/admin-alerts.store';
import { AdminLayoutComponent } from './admin-layout.component';

@Component({ template: 'dashboard' })
class StubDashboardComponent {}

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

describe('AdminLayoutComponent', () => {
  let mockAdminApi: {
    alerts: ReturnType<typeof vi.fn>;
    pendingProofs: ReturnType<typeof vi.fn>;
    markAlertRead: ReturnType<typeof vi.fn>;
  };

  async function render(alerts: OperatorAlert[] = [anAlert()]) {
    mockAdminApi = {
      alerts: vi.fn(() => of(alerts)),
      pendingProofs: vi.fn(() => of([])),
      markAlertRead: vi.fn(() => of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([{ path: 'admin', component: StubDashboardComponent }]),
        { provide: AdminApi, useValue: mockAdminApi },
        AdminAlertsStore,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders admin navigation links and loads alerts', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Panel de administración');
    expect(el.querySelector('nav')).not.toBeNull();
    expect(el.textContent).toContain('Rifas');
    expect(el.textContent).toContain('Comprobantes');
    expect(el.textContent).toContain('Pagos tardíos');

    // Badge showing 1 unread alert
    const alertBtn = el.querySelector('.alerts-trigger') as HTMLButtonElement;
    expect(alertBtn).not.toBeNull();
    expect(alertBtn.textContent).toContain('1');
  });

  it('toggles alerts drawer and allows marking an alert as read', async () => {
    const fixture = await render([anAlert({ id: 'a-1', raffleTitle: 'Moto 150cc' })]);
    const el = fixture.nativeElement as HTMLElement;

    const alertBtn = el.querySelector('.alerts-trigger') as HTMLButtonElement;
    alertBtn.click();
    fixture.detectChanges();

    const drawer = el.querySelector('.alerts-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer?.textContent).toContain('Alertas pendientes');
    expect(drawer?.textContent).toContain('Moto 150cc');

    const markReadBtn = drawer?.querySelector('.btn-mark-read') as HTMLButtonElement;
    expect(markReadBtn).not.toBeNull();
    markReadBtn.click();
    fixture.detectChanges();

    expect(mockAdminApi.markAlertRead).toHaveBeenCalledWith('a-1');
  });

  it('renders payment account change alert with human readable label and link to accounts', async () => {
    const fixture = await render([
      anAlert({
        id: 'alert-acc-1',
        type: 'PAYMENT_ACCOUNT_CHANGE',
        raffleId: null,
        raffleTitle: null,
        orderId: null,
        paymentAccountId: 'acc-uuid-1234',
        amount: null,
      }),
    ]);
    const el = fixture.nativeElement as HTMLElement;

    const alertBtn = el.querySelector('.alerts-trigger') as HTMLButtonElement;
    alertBtn.click();
    fixture.detectChanges();

    const drawer = el.querySelector('.alerts-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer?.textContent).toContain('Cambio en cuenta de pago');
    expect(drawer?.textContent).toContain('acc-uuid-1234');
    expect(drawer?.textContent).toContain('Control de 4 ojos');

    const link = drawer?.querySelector('.btn-alert-link') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/admin/cuentas');
  });

  it('renders alert reason when present and omits element when absent', async () => {
    const fixture = await render([
      anAlert({
        id: 'alert-with-reason',
        type: 'NOTIFICATION_FAILED',
        reason: 'El comprador no tiene correo electrónico registrado',
      }),
      anAlert({
        id: 'alert-no-reason',
        type: 'LATE_PAYMENT_CLAIM',
        reason: null,
      }),
    ]);
    const el = fixture.nativeElement as HTMLElement;

    const alertBtn = el.querySelector('.alerts-trigger') as HTMLButtonElement;
    alertBtn.click();
    fixture.detectChanges();

    const drawer = el.querySelector('.alerts-drawer');
    expect(drawer).not.toBeNull();

    const reasonEls = drawer?.querySelectorAll('.alert-item__reason');
    expect(reasonEls?.length).toBe(1);
    expect(reasonEls?.[0].textContent?.trim()).toBe(
      'El comprador no tiene correo electrónico registrado',
    );
  });
});