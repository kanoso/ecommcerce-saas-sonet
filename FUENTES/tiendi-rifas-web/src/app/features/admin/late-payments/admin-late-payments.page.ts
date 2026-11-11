import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../../core/api/admin-api';
import { BankOrWallet, Order } from '../../../core/api/api.models';

@Component({
  selector: 'app-admin-late-payments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-late-payments.page.html',
  styleUrl: './admin-late-payments.page.scss',
})
export class AdminLatePaymentsPage implements OnInit {
  private readonly adminApi = inject(AdminApi);

  readonly claims = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly selectedClaim = signal<Order | null>(null);
  readonly activeModal = signal<'confirm' | 'dismiss' | null>(null);

  readonly banks: BankOrWallet[] = ['YAPE', 'PLIN', 'BCP', 'BBVA', 'INTERBANK'];

  readonly confirmForm = new FormGroup({
    receivedAmount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    bankOrWallet: new FormControl<BankOrWallet | ''>('', [Validators.required]),
    operationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    overpaymentConfirmed: new FormControl(false, { nonNullable: true }),
    overpaymentReason: new FormControl(''),
  });

  readonly dismissForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.loadClaims();
  }

  loadClaims(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi.latePaymentClaims().subscribe({
      next: (data) => {
        this.claims.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los reclamos de pago tardío. Intenta nuevamente.');
        this.loading.set(false);
      },
    });
  }

  proofUrl(orderId: string): string {
    return this.adminApi.proofFileUrl(orderId);
  }

  openConfirm(claim: Order): void {
    this.selectedClaim.set(claim);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.confirmForm.reset({
      receivedAmount: claim.declaredAmount ?? claim.totalAmount,
      bankOrWallet: (claim.bankOrWallet as BankOrWallet) || '',
      operationNumber: '',
      overpaymentConfirmed: false,
      overpaymentReason: '',
    });
    this.activeModal.set('confirm');
  }

  openDismiss(claim: Order): void {
    this.selectedClaim.set(claim);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.dismissForm.reset({
      reason: '',
    });
    this.activeModal.set('dismiss');
  }

  closeModal(): void {
    this.activeModal.set(null);
    this.selectedClaim.set(null);
  }

  submitConfirm(): void {
    const claim = this.selectedClaim();
    if (!claim || this.confirmForm.invalid) return;

    const values = this.confirmForm.getRawValue();
    if (values.receivedAmount === null || !values.bankOrWallet || !values.operationNumber) return;

    this.submitting.set(true);
    this.actionError.set(null);

    const payload = {
      monto_recibido: values.receivedAmount,
      banco_o_billetera: values.bankOrWallet,
      numero_operacion: values.operationNumber,
      colision: null,
      sobrepago:
        values.overpaymentConfirmed && values.overpaymentReason
          ? { confirmado: true as const, motivo: values.overpaymentReason }
          : null,
    };

    this.adminApi.confirmLatePayment(claim.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.actionSuccess.set(`Pago tardío de la orden ${claim.id} confirmado. Reembolso abierto.`);
        this.loadClaims();
      },
      error: (err) => {
        this.submitting.set(false);
        this.actionError.set(err.message || 'Error al confirmar el pago tardío.');
      },
    });
  }

  submitDismiss(): void {
    const claim = this.selectedClaim();
    if (!claim || this.dismissForm.invalid) return;

    const { reason } = this.dismissForm.getRawValue();
    this.submitting.set(true);
    this.actionError.set(null);

    this.adminApi.dismissLatePayment(claim.id, { motivo: reason }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.actionSuccess.set(`Reclamo de la orden ${claim.id} descartado.`);
        this.loadClaims();
      },
      error: (err) => {
        this.submitting.set(false);
        this.actionError.set(err.message || 'Error al descartar el reclamo.');
      },
    });
  }
}
