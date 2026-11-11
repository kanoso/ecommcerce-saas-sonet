import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminAlertsStore } from '../alerts/admin-alerts.store';
import { AdminDashboardPage } from './admin-dashboard.page';

describe('AdminDashboardPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [
        provideRouter([]),
        {
          provide: AdminApi,
          useValue: {
            alerts: vi.fn(() => of([])),
            markAlertRead: vi.fn(() => of(undefined)),
          },
        },
        AdminAlertsStore,
      ],
    }).compileComponents();
  });

  it('renders quick action cards for operator workload', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Panel de control');
    expect(el.querySelector('a[href="/admin/comprobantes"]')).not.toBeNull();
    expect(el.querySelector('a[href="/admin/pagos-tardios"]')).not.toBeNull();
    expect(el.querySelector('a[href="/admin/reembolsos"]')).not.toBeNull();
    expect(el.querySelector('a[href="/admin/rifas"]')).not.toBeNull();
  });
});
