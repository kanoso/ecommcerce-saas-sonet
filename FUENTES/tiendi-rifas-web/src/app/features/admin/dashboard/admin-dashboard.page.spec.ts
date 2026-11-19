import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { aRaffle } from '../../catalog/testing/raffle.fixture';
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
            listRaffles: vi.fn(() =>
              of([
                aRaffle({ id: 'pending', status: 'CLOSED', drawAt: new Date('2020-01-01T00:00:00Z') }),
                aRaffle({ id: 'live', status: 'DRAWN', liveDrawInProgress: true }),
                aRaffle({ id: 'later', status: 'CLOSED', drawAt: new Date('2999-01-01T00:00:00Z') }),
                aRaffle({ id: 'active' }),
              ]),
            ),
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

  it('counts the draws waiting for the operator, live ones included (DT-23)', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.card--draws');

    expect(card?.textContent).toContain('Sorteos pendientes');
    expect(card?.querySelector('.card__count')?.textContent?.trim()).toBe('2');
  });
});
