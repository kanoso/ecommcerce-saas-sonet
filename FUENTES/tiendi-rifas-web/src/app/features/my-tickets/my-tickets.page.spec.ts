import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { MyTicket } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { MyTicketsPage } from './my-tickets.page';

const aTicket = (overrides: Partial<MyTicket> = {}): MyTicket => ({
  orderId: 'o-1',
  raffleId: 'r-1',
  raffleTitle: 'Smart TV',
  numbers: [7],
  status: 'PAID',
  totalAmount: 10,
  // 15:15 UTC is 10:15 in Lima.
  expiresAt: new Date('2026-11-03T15:15:00.000Z'),
  ...overrides,
});

/** Collapses whitespace; \s also matches the no-break space Intl puts before the amount. */
const textOf = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('MyTicketsPage', () => {
  let lists: Subject<MyTicket[]>[];
  /** Order ids read one by one: the list must not need any. */
  let orderReads: string[];

  function render() {
    lists = [];
    orderReads = [];
    TestBed.configureTestingModule({
      imports: [MyTicketsPage],
      providers: [
        provideRouter([]),
        {
          provide: OrdersApi,
          useValue: {
            myTickets: () => {
              const response = new Subject<MyTicket[]>();
              lists.push(response);
              return response;
            },
            order: (orderId: string) => {
              orderReads.push(orderId);
              return new Subject();
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MyTicketsPage);
    fixture.detectChanges();
    return fixture;
  }

  function answer(tickets: MyTicket[]) {
    const fixture = render();
    lists[0].next(tickets);
    lists[0].complete();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ReturnType<typeof render>): HTMLElement => fixture.nativeElement;
  const orderItems = (fixture: ReturnType<typeof render>) => [...el(fixture).querySelectorAll('li.order')];

  it('shows a loading state while the tickets are requested', () => {
    const fixture = render();
    expect(el(fixture).querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(textOf(el(fixture).querySelector('[role="status"]'))).toBe('Cargando tus boletos…');
  });

  it('lists the orders grouped by raffle, with numbers, status and total', () => {
    const fixture = answer([
      aTicket({ orderId: 'o-2', raffleId: 'r-2', raffleTitle: 'Moto', numbers: [23, 7], totalAmount: 20 }),
      aTicket({ orderId: 'o-1', status: 'REJECTED' }),
    ]);
    const titles = [...el(fixture).querySelectorAll('h2')].map(textOf);
    expect(titles).toEqual(['Moto', 'Smart TV']);

    const [moto, tv] = orderItems(fixture);
    expect([...moto.querySelectorAll('.order__number')].map(textOf)).toEqual(['7', '23']);
    expect(textOf(moto.querySelector('.order__status'))).toBe('Pago aprobado');
    expect(textOf(moto.querySelector('.order__total'))).toBe('Total S/ 20.00');
    expect(textOf(tv.querySelector('.order__status'))).toBe('Pago rechazado');
  });

  it('links every raffle to its page', () => {
    const fixture = answer([aTicket({ raffleId: 'r-9', raffleTitle: 'Moto' })]);
    const link = el(fixture).querySelector('a[href="/rifas/r-9"]');
    expect(link?.getAttribute('aria-label')).toBe('Ver rifa Moto');
  });

  it('links only an order awaiting its proof to the payment page', () => {
    const fixture = answer([
      aTicket({ orderId: 'o-1', status: 'PENDING', numbers: [3, 1] }),
      aTicket({ orderId: 'o-2', status: 'REJECTED' }),
      aTicket({ orderId: 'o-3', status: 'PENDING_VERIFICATION' }),
    ]);
    const payLinks = [...el(fixture).querySelectorAll('a[href*="/pago/"]')];
    expect(payLinks.map((a) => a.getAttribute('href'))).toEqual(['/rifas/r-1/pago/o-1']);
    expect(textOf(payLinks[0])).toBe('Completar pago');
    expect(payLinks[0].getAttribute('aria-label')).toBe('Completar pago de Smart TV, números 1, 3');
  });

  it('shows the deadline of an order awaiting its proof from the list alone', () => {
    const fixture = answer([aTicket({ orderId: 'o-1', status: 'PENDING' }), aTicket({ orderId: 'o-2' })]);
    const deadlines = [...el(fixture).querySelectorAll('.order__deadline')].map(textOf);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatch(/^Paga antes del 3 nov.?,? 10:15$/);
    expect(orderReads).toEqual([]);
  });

  it('still offers payment when the deadline is unreadable', () => {
    const fixture = answer([aTicket({ orderId: 'o-1', status: 'PENDING', expiresAt: null })]);
    expect(el(fixture).querySelector('.order__deadline')).toBeNull();
    expect(el(fixture).querySelector('a[href="/rifas/r-1/pago/o-1"]')).not.toBeNull();
    expect(orderReads).toEqual([]);
  });

  it('says so when the buyer has no tickets and links to the catalog', () => {
    const fixture = answer([]);
    expect(el(fixture).textContent).toContain('Aún no tienes boletos');
    expect(textOf(el(fixture).querySelector('a[href="/"]'))).toBe('Ver rifas activas');
    expect(orderItems(fixture)).toHaveLength(0);
  });

  it('shows the error and retries on demand', () => {
    const fixture = render();
    lists[0].error(new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectarnos.'));
    fixture.detectChanges();
    const alert = el(fixture).querySelector('[role="alert"]');
    expect(textOf(alert)).toContain('No pudimos conectarnos.');

    (alert?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(lists).toHaveLength(2);
    expect(textOf(el(fixture).querySelector('[role="status"]'))).toBe('Cargando tus boletos…');
  });
  it('links an EXPIRED order to the late payment claim page', () => {
    const fixture = answer([aTicket({ orderId: 'o-expired', status: 'EXPIRED' })]);
    const claimLink = el(fixture).querySelector('a[href="/rifas/r-1/pago/o-expired/reclamo"]');
    expect(claimLink).not.toBeNull();
    expect(textOf(claimLink)).toBe('Reclamar pago');
    expect(claimLink?.getAttribute('aria-label')).toBe('Reclamar pago de Smart TV, números 7');
  });
});
