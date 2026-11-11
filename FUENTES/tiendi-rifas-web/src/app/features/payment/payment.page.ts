import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatPrice } from '../catalog/raffle-format';
import { EXPIRED_RESERVATION_PARAM, EXPIRED_RESERVATION_VALUE } from '../raffle/raffle-detail.page';
import { formatCents } from '../raffle/raffle-grid.model';
import { BANKS_OR_WALLETS, PROOF_ACCEPT, ProofField, phaseLabel } from './payment.model';
import { PaymentStore } from './payment.store';

/**
 * Route `/rifas/:id/pago/:orderId` (RF-04, guide §7.2, DT-02, DT-19): the
 * reservation countdown, the operator accounts read from the API and the
 * proof declaration,
 * then the verification status until the operator decides. There is no
 * charge form: the buyer pays outside and declares it here.
 */
@Component({
  selector: 'app-payment-page',
  imports: [RouterLink],
  providers: [PaymentStore],
  templateUrl: './payment.page.html',
  styleUrl: './payment.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPage implements OnInit {
  protected readonly store = inject(PaymentStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly raffleId = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';

  protected readonly banks = BANKS_OR_WALLETS;
  protected readonly accept = PROOF_ACCEPT;

  protected readonly file = signal<File | null>(null);
  protected readonly operationNumber = signal('');
  protected readonly bankOrWallet = signal('');
  protected readonly declaredAmount = signal('');
  protected readonly acceptedTerms = signal(false);
  /** The operator account the buyer paid to; preselected when it is the only one. */
  protected readonly paymentAccountId = signal('');

  protected readonly total = computed(() => formatCents(this.store.totalCents()));

  /** The outcome title: the same status name "Mis boletos" shows. */
  protected readonly outcomeTitle = computed(() => {
    const phase = this.store.phase();
    return phase ? phaseLabel(phase) : '';
  });

  /** The account the buyer declared paying to, as the API keeps it. */
  protected readonly paidTo = computed(() => {
    const account = this.store.order()?.paidToAccount;
    return account ? `${account.label} · ${account.number}` : null;
  });

  /** What the buyer declared, as the verification card repeats it. */
  protected readonly declared = computed(() => {
    const order = this.store.order();
    if (!order || order.declaredAmount === null) {
      return null;
    }
    const bank = this.banks.find((b) => b.value === order.bankOrWallet)?.label ?? order.bankOrWallet;
    const amount = formatPrice(order.declaredAmount);
    return bank ? `${bank} · ${amount}` : amount;
  });

  constructor() {
    effect(() => {
      const accounts = this.store.accounts();
      if (accounts.length === 1 && this.paymentAccountId() === '') {
        this.paymentAccountId.set(accounts[0].id);
      }
    });

    // Out of time and unpaid: back to the grid, which explains why.
    effect(() => {
      if (this.store.expired()) {
        void this.router.navigate(['/rifas', this.store.order()?.raffleId ?? this.raffleId], {
          queryParams: { [EXPIRED_RESERVATION_PARAM]: EXPIRED_RESERVATION_VALUE },
          replaceUrl: true,
        });
      }
    });
  }

  ngOnInit(): void {
    this.store.load(this.orderId);
    this.store.start();
  }

  protected retry(): void {
    this.store.load(this.orderId);
  }

  protected retryAccounts(): void {
    this.store.retryAccounts();
  }

  protected error(field: ProofField): string | null {
    return this.store.fieldErrors()[field] ?? null;
  }

  /** Ids of the messages that describe a field, for `aria-describedby`. */
  protected describedBy(field: ProofField, ...more: string[]): string | null {
    const ids = more.filter((id) => id !== '');
    if (this.error(field)) {
      ids.unshift(`${idOf(field)}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected onFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected onText(
    target: EventTarget | null,
    field: 'operationNumber' | 'declaredAmount' | 'bankOrWallet' | 'paymentAccountId',
  ): void {
    this[field].set((target as HTMLInputElement | HTMLSelectElement).value);
  }

  protected onTerms(event: Event): void {
    this.acceptedTerms.set((event.target as HTMLInputElement).checked);
  }

  protected submit(): void {
    this.store.submit({
      file: this.file(),
      operationNumber: this.operationNumber(),
      bankOrWallet: this.bankOrWallet(),
      declaredAmount: this.declaredAmount(),
      acceptedTerms: this.acceptedTerms(),
      paymentAccountId: this.paymentAccountId(),
    });
  }
}

const FIELD_IDS: Record<ProofField, string> = {
  file: 'proof-file',
  operationNumber: 'operation-number',
  bankOrWallet: 'bank-or-wallet',
  declaredAmount: 'declared-amount',
  acceptedTerms: 'accept-terms',
  paymentAccount: 'paid-to-account',
};

const idOf = (field: ProofField): string => FIELD_IDS[field];
