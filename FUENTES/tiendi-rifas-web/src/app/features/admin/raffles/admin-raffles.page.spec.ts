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
    prizes: [],
    winnerExclusionMode: 'TICKET_ONLY',
    liveDrawInProgress: false,
    winners: [],
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
    prizes: [],
    winnerExclusionMode: 'TICKET_ONLY',
    liveDrawInProgress: false,
    winners: [],
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
    expect(cards[0].textContent).toContain('En venta');
    expect(cards[0].textContent).toContain('350 / 1000');

    expect(cards[1].textContent).toContain('Rifa Moto Honda');
    expect(cards[1].textContent).toContain('Borrador');

    const detailLinks = el.querySelectorAll('a[href^="/admin/rifas/"]');
    expect(Array.from(detailLinks).some((a) => a.getAttribute('href') === '/admin/rifas/r-1')).toBe(true);
    expect(Array.from(detailLinks).some((a) => a.getAttribute('href') === '/admin/rifas/r-2')).toBe(true);
  });

  describe('visible status (DT-23)', () => {
    const base = mockRaffles[0];
    const drawAt = new Date('2026-11-21T18:00:00Z');
    const closedRaffles: RaffleSummary[] = [
      { ...base, id: 'pending', title: 'Pendiente', status: 'CLOSED', drawAt },
      { ...base, id: 'live', title: 'En vivo', status: 'DRAWN', drawAt, liveDrawInProgress: true },
      {
        ...base,
        id: 'refused',
        title: 'Rechazada',
        status: 'CLOSED',
        drawAt,
        refusedDraw: { reason: 'DRAW_CONFIG_MISMATCH', at: drawAt },
      },
      { ...base, id: 'drawn', title: 'Sorteada', status: 'DRAWN', drawAt },
    ];

    function renderWith(raffles: RaffleSummary[]) {
      adminApiMock.listRaffles.mockReturnValue(of(raffles));
      const f = TestBed.createComponent(AdminRafflesPage);
      f.componentInstance.now.set(new Date('2026-11-22T00:00:00Z'));
      f.detectChanges();
      return f;
    }

    const rowOf = (root: HTMLElement, title: string) =>
      [...root.querySelectorAll('.raffle-item')].find((li) => li.textContent?.includes(title)) as HTMLElement;

    it('labels each raffle with its visible status', () => {
      const root = renderWith(closedRaffles).nativeElement as HTMLElement;

      expect(rowOf(root, 'Pendiente').querySelector('.status-badge')?.textContent).toContain('Sorteo pendiente');
      expect(rowOf(root, 'En vivo').querySelector('.status-badge')?.textContent).toContain('Sorteando en vivo');
      expect(rowOf(root, 'Rechazada').querySelector('.status-badge')?.textContent).toContain('Sorteo rechazado');
      expect(rowOf(root, 'Sorteada').querySelector('.status-badge')?.textContent).toContain('Sorteada');
    });

    it('offers the live draw for pending and live raffles only', () => {
      const root = renderWith(closedRaffles).nativeElement as HTMLElement;
      const liveLink = (title: string) => rowOf(root, title).querySelector('a.raffle-item__live-btn');

      expect(liveLink('Pendiente')?.getAttribute('href')).toBe('/rifas/pending/en-vivo');
      expect(liveLink('Pendiente')?.textContent).toContain('Ir al sorteo en vivo');
      expect(liveLink('En vivo')?.getAttribute('href')).toBe('/rifas/live/en-vivo');
      expect(liveLink('Rechazada')).toBeNull();
      expect(liveLink('Sorteada')).toBeNull();
    });

    it('filters by visible status', () => {
      const f = renderWith(closedRaffles);
      const root = f.nativeElement as HTMLElement;
      const select = root.querySelector('select[aria-label="Filtrar por estado"]') as HTMLSelectElement;

      select.value = 'DRAW_PENDING';
      select.dispatchEvent(new Event('change'));
      f.detectChanges();

      const titles = [...root.querySelectorAll('.raffle-item__title')].map((h) => h.textContent);
      expect(titles).toEqual(['Pendiente']);
    });
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
