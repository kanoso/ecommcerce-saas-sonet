import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { BankOrWallet, Order } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { formatPrice } from '../catalog/raffle-format';
import { toCents } from '../raffle/raffle-grid.model';

export type ClaimStatus = 'loading' | 'ready' | 'submitted' | 'error' | 'not-found';

export interface ClaimFieldErrors {
  bank?: string;
  amount?: string;
  file?: string;
  terms?: string;
}

@Component({
  selector: 'app-late-payment-claim-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './late-payment-claim.page.html',
  styleUrls: ['./late-payment-claim.page.scss'],
})
export class LatePaymentClaimPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersApi = inject(OrdersApi);

  readonly raffleId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly orderId = computed(() => this.route.snapshot.paramMap.get('orderId') ?? '');

  readonly order = signal<Order | null>(null);
  readonly status = signal<ClaimStatus>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly submitting = signal(false);

  // Form fields
  readonly bankOrWallet = signal<BankOrWallet | ''>('');
  readonly operationNumber = signal('');
  readonly declaredAmount = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly acceptedTerms = signal(false);

  readonly fieldErrors = signal<ClaimFieldErrors>({});

  protected readonly banks = [
    { value: 'BCP', label: 'BCP' },
    { value: 'INTERBANK', label: 'Interbank' },
    { value: 'BBVA', label: 'BBVA' },
    { value: 'YAPE', label: 'Yape' },
    { value: 'PLIN', label: 'Plin' },
  ] as const;

  readonly totalFormatted = computed(() => {
    const o = this.order();
    return o ? formatPrice(o.totalAmount) : '';
  });

  ngOnInit(): void {
    this.loadOrder();
  }

  loadOrder(): void {
    const id = this.orderId();
    if (!id) {
      this.status.set('not-found');
      return;
    }
    this.status.set('loading');
    this.errorMessage.set(null);

    this.ordersApi.order(id).subscribe({
      next: (read) => {
        this.order.set(read.order);
        this.status.set('ready');
        if (read.order.declaredAmount !== null) {
          this.declaredAmount.set(read.order.declaredAmount.toFixed(2));
        } else {
          this.declaredAmount.set(read.order.totalAmount.toFixed(2));
        }
      },
      error: (err) => {
        const apiErr = toApiError(err);
        if (apiErr.code === 'ORDER_NOT_FOUND') {
          this.status.set('not-found');
        } else {
          this.status.set('error');
          this.errorMessage.set(apiErr.userMessage);
        }
      },
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.fieldErrors.update((e) => ({ ...e, file: 'El comprobante no debe superar los 5 MB.' }));
        this.selectedFile.set(null);
        return;
      }
      this.fieldErrors.update((e) => {
        const next: ClaimFieldErrors = { ...e };
        delete next.file;
        return next;
      });
      this.selectedFile.set(file);
    } else {
      this.selectedFile.set(null);
    }
  }

  onSubmit(): void {
    const errors: ClaimFieldErrors = {};
    const bank = this.bankOrWallet();
    if (!bank) {
      errors.bank = 'Selecciona el banco o billetera desde la que pagaste.';
    }

    const amountNum = parseFloat(this.declaredAmount());
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.amount = 'Ingresa un monto válido mayor a cero.';
    }

    if (!this.acceptedTerms()) {
      errors.terms = 'Debes declarar que la información es verídica para enviar el reclamo.';
    }

    this.fieldErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const claim = {
      file: this.selectedFile(),
      bankOrWallet: bank as BankOrWallet,
      operationNumber: this.operationNumber().trim(),
      declaredAmountCents: toCents(amountNum),
    };

    this.ordersApi.claimLatePayment(this.orderId(), claim).subscribe({
      next: (read) => {
        this.submitting.set(false);
        this.order.set(read.order);
        this.status.set('submitted');
      },
      error: (err) => {
        this.submitting.set(false);
        const apiErr = toApiError(err);
        this.submitError.set(apiErr.userMessage);
      },
    });
  }
}
