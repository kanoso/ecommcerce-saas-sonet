import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Order } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { LatePaymentClaimPage } from './late-payment-claim.page';

const RAFFLE_ID = 'r-1';
const ORDER_ID = 'o-123';

const anOrder = (overrides: Partial<Order> = {}): Order => ({
  id: ORDER_ID,
  raffleId: RAFFLE_ID,
  status: 'EXPIRED',
  numbers: [5, 12],
  totalAmount: 20,
  expiresAt: new Date('2026-11-03T15:15:00.000Z'),
  verificationDueAt: null,
  declaredAmount: null,
  bankOrWallet: null,
  rejectionReason: null,
  hasProof: false,
  paidToAccount: null,
  ...overrides,
});

const textOf = (el: Element | null) => (el?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

describe('LatePaymentClaimPage', () => {
  let mockOrdersApi: {
    order: ReturnType<typeof vi.fn>;
    claimLatePayment: ReturnType<typeof vi.fn>;
  };

  async function render(order = anOrder()) {
    mockOrdersApi = {
      order: vi.fn(() => of({ order, serverTime: new Date(), receivedAt: Date.now() })),
      claimLatePayment: vi.fn(() =>
        of({
          order: { ...order, status: 'LATE_PAYMENT_REVIEW' },
          serverTime: new Date(),
          receivedAt: Date.now(),
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [LatePaymentClaimPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: RAFFLE_ID, orderId: ORDER_ID }),
            },
          },
        },
        { provide: OrdersApi, useValue: mockOrdersApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LatePaymentClaimPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders order details and explanation that numbers were released', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(textOf(el)).toContain('Reclamar pago tardío');
    expect(textOf(el)).toContain('S/ 20.00');
    expect(textOf(el)).toContain('Tus números reservados fueron liberados');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('submits late payment claim and displays under review confirmation', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    // Fill form
    const bankSelect = el.querySelector('#claim-bank') as HTMLSelectElement;
    bankSelect.value = 'BCP';
    bankSelect.dispatchEvent(new Event('change'));

    const opInput = el.querySelector('#claim-op-number') as HTMLInputElement;
    opInput.value = 'OP-9988';
    opInput.dispatchEvent(new Event('input'));

    const amountInput = el.querySelector('#claim-amount') as HTMLInputElement;
    amountInput.value = '20.00';
    amountInput.dispatchEvent(new Event('input'));

    const termsCheckbox = el.querySelector('#claim-terms') as HTMLInputElement;
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    fixture.detectChanges();

    // Submit form
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockOrdersApi.claimLatePayment).toHaveBeenCalledWith(
      ORDER_ID,
      expect.objectContaining({
        bankOrWallet: 'BCP',
        operationNumber: 'OP-9988',
        declaredAmountCents: 2000,
      }),
    );

    expect(el.textContent).toContain('Reclamo registrado exitosamente');
    expect(el.textContent).toContain('cola de revisión');
  });

  it('displays notice if order is already in LATE_PAYMENT_REVIEW', async () => {
    const fixture = await render(anOrder({ status: 'LATE_PAYMENT_REVIEW' }));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Tu pago está en revisión');
    expect(el.querySelector('form')).toBeNull();
  });
});
