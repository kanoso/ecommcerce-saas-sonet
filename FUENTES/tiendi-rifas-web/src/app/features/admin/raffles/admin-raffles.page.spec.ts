import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { RaffleSummary } from '../../../core/api/api.models';
import { AdminRafflesPage } from './admin-raffles.page';

const mockRaffles: RaffleSummary[] = [
  {
    id: 'r-1',
    title: 'Rifa Toyota Yaris',
    prize: 'Toyota Yaris 0km',
    ticketPrice: 20,
    numberMin: 1,
    numberMax: 1000,
    totalNumbers: 1000,
    status: 'ACTIVE',
    salesCloseAt: new Date('2026-11-20T18:00:00Z'),
    drawAt: new Date('2026-11-21T18:00:00Z'),
    soldCount: 350,
    availableCount: 650,
    authorizationResolution: 'RD-001',
  },
  {
    id: 'r-2',
    title: 'Rifa Moto Honda',
    prize: 'Moto Honda CB190R',
    ticketPrice: 10,
    numberMin: 1,
    numberMax: 500,
    totalNumbers: 500,
    status: 'DRAFT',
    salesCloseAt: null,
    drawAt: null,
    soldCount: 0,
    availableCount: 500,
    authorizationResolution: null,
  },
];

describe('AdminRafflesPage', () => {
  let fixture: ComponentFixture<AdminRafflesPage>;
  let el: HTMLElement;
  let adminApiMock: { listRaffles: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    adminApiMock = {
      listRaffles: vi.fn().mockReturnValue(of(mockRaffles)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminRafflesPage],
      providers: [
        provideRouter([]),
        { provide: AdminApi, useValue: adminApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRafflesPage);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('renders title and a button to create a new raffle', () => {
    expect(el.querySelector('h1')?.textContent).toContain('Rifas');
    const newBtn = el.querySelector('a[href="/admin/rifas/nueva"]');
    expect(newBtn).not.toBeNull();
    expect(newBtn?.textContent).toContain('Nueva rifa');
  });

  it('lists all raffles with title, status badge and link to details', () => {
    const cards = el.querySelectorAll('.raffle-item');
    expect(cards).toHaveLength(2);

    expect(cards[0].textContent).toContain('Rifa Toyota Yaris');
    expect(cards[0].textContent).toContain('Activa');
    expect(cards[0].textContent).toContain('350 / 1000');

    expect(cards[1].textContent).toContain('Rifa Moto Honda');
    expect(cards[1].textContent).toContain('Borrador');

    const detailLinks = el.querySelectorAll('a[href^="/admin/rifas/"]');
    expect(Array.from(detailLinks).some((a) => a.getAttribute('href') === '/admin/rifas/r-1')).toBe(true);
    expect(Array.from(detailLinks).some((a) => a.getAttribute('href') === '/admin/rifas/r-2')).toBe(true);
  });

  it('displays empty state when there are no raffles', () => {
    adminApiMock.listRaffles.mockReturnValue(of([]));
    const emptyFixture = TestBed.createComponent(AdminRafflesPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('No hay rifas registradas');
  });

  it('shows error state and retries on failure', () => {
    adminApiMock.listRaffles.mockReturnValue(throwError(() => new Error('Error al cargar')));
    const errFixture = TestBed.createComponent(AdminRafflesPage);
    errFixture.detectChanges();
    const errEl = errFixture.nativeElement;

    expect(errEl.textContent).toContain('No se pudieron cargar las rifas');
    const retryBtn = errEl.querySelector('.btn-retry') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();

    adminApiMock.listRaffles.mockReturnValue(of(mockRaffles));
    retryBtn.click();
    errFixture.detectChanges();
    expect(errFixture.nativeElement.querySelectorAll('.raffle-item')).toHaveLength(2);
  });
});
