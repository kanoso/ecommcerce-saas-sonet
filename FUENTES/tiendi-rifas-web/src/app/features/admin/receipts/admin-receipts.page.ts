import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../../core/api/admin-api';
import { RejectPaymentRequestDto } from '../../../core/api/api.dto';
import { BankOrWallet, PendingProof } from '../../../core/api/api.models';
import { AdminAlertsStore } from '../alerts/admin-alerts.store';

@Component({
  selector: 'app-admin-receipts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-receipts.page.html',
  styleUrl: './admin-receipts.page.scss',
})
export class AdminReceiptsPage implements OnInit {
  private readonly adminApi = inject(AdminApi);
  private readonly alertsStore = inject(AdminAlertsStore, { optional: true });

  readonly proofs = signal<PendingProof[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly submitting = signal(false);

  // Active item for modal
  readonly selectedProof = signal<PendingProof | null>(null);
  readonly activeModal = signal<'approve' | 'reject' | 'extra' | null>(null);

  readonly banks: BankOrWallet[] = ['YAPE', 'PLIN', 'BCP', 'BBVA', 'INTERBANK'];

  // Approve Form
  readonly approveForm = new FormGroup({
    operationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    receivedAmount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    collisionActive: new FormControl(false, { nonNullable: true }),
    collisionReason: new FormControl(''),
    collisionBank: new FormControl<BankOrWallet | ''>(''),
  });

  // Reject Form (DT-08 / DT-14)
  readonly rejectForm = new FormGroup({
    moneyReceived: new FormControl(false, { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    receivedAmount: new FormControl<number | null>(null),
    bankOrWallet: new FormControl<BankOrWallet | ''>(''),
    operationNumber: new FormControl(''),
    overpaymentConfirmed: new FormControl(false, { nonNullable: true }),
    overpaymentReason: new FormControl(''),
  });

  // Extra Transfer Form (DT-16)
  readonly extraTransferForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    receivedAmount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    bankOrWallet: new FormControl<BankOrWallet | ''>('', [Validators.required]),
    operationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    overpaymentConfirmed: new FormControl(false, { nonNullable: true }),
    overpaymentReason: new FormControl(''),
  });

  ngOnInit(): void {
    this.loadProofs();
  }

  loadProofs(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi.pendingProofs().subscribe({
      next: (data) => {
        this.proofs.set(data);
        this.alertsStore?.setPendingProofsCount(data.length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los comprobantes pendientes. Intenta nuevamente.');
        this.loading.set(false);
      },
    });
  }

  proofUrl(orderId: string): string {
    return this.adminApi.proofFileUrl(orderId);
  }

  openApprove(proof: PendingProof): void {
    this.selectedProof.set(proof);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.approveForm.reset({
      operationNumber: proof.operationNumber || '',
      receivedAmount: proof.totalAmount,
      collisionActive: false,
      collisionReason: '',
      collisionBank: '',
    });
    this.activeModal.set('approve');
  }

  openReject(proof: PendingProof): void {
    this.selectedProof.set(proof);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.rejectForm.reset({
      moneyReceived: false,
      reason: '',
      receivedAmount: proof.declaredAmount ?? proof.totalAmount,
      bankOrWallet: (proof.bankOrWallet as BankOrWallet) || '',
      operationNumber: proof.operationNumber || '',
      overpaymentConfirmed: false,
      overpaymentReason: '',
    });
    this.activeModal.set('reject');
  }

  openExtraTransfer(proof: PendingProof): void {
    this.selectedProof.set(proof);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.extraTransferForm.reset({
      reason: '',
      receivedAmount: proof.totalAmount,
      bankOrWallet: (proof.bankOrWallet as BankOrWallet) || '',
      operationNumber: '',
      overpaymentConfirmed: false,
      overpaymentReason: '',
    });
    this.activeModal.set('extra');
  }

  closeModal(): void {
    this.activeModal.set(null);
    this.selectedProof.set(null);
  }

  submitApprove(): void {
    const proof = this.selectedProof();
    if (!proof || this.approveForm.invalid) return;

    const { operationNumber, receivedAmount, collisionActive, collisionReason, collisionBank } =
      this.approveForm.getRawValue();

    if (!operationNumber || receivedAmount === null) return;

    this.submitting.set(true);
    this.actionError.set(null);

    const collision =
      collisionActive && collisionReason && collisionBank
        ? { motivo: collisionReason, banco: collisionBank }
        : null;

    this.adminApi
      .approvePayment(proof.id, {
        numero_operacion: operationNumber,
        monto_recibido: receivedAmount,
        colision: collision,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();
          this.actionSuccess.set(`Pago de la orden ${proof.id} aprobado con éxito.`);
          this.loadProofs();
          this.alertsStore?.load();
        },
        error: (err) => {
          this.submitting.set(false);
          this.actionError.set(
            err.message || 'Error al aprobar el comprobante. Verifica colisiones o monto.'
          );
        },
      });
  }

  submitReject(): void {
    const proof = this.selectedProof();
    if (!proof || this.rejectForm.invalid) return;

    const values = this.rejectForm.getRawValue();
    this.submitting.set(true);
    this.actionError.set(null);

    const basePayload: RejectPaymentRequestDto = {
      dinero_recibido: values.moneyReceived,
      motivo: values.reason,
    };

    if (values.moneyReceived) {
      basePayload.monto_recibido = values.receivedAmount ?? undefined;
      basePayload.banco_o_billetera = values.bankOrWallet || undefined;
      basePayload.numero_operacion = values.operationNumber || undefined;
      basePayload.colision = null;
      basePayload.sobrepago =
        values.overpaymentConfirmed && values.overpaymentReason
          ? { confirmado: true as const, motivo: values.overpaymentReason }
          : null;
    }

    this.adminApi.rejectPayment(proof.id, basePayload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.actionSuccess.set(`Pago rechazado para la orden ${proof.id}.`);
        this.loadProofs();
        this.alertsStore?.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.actionError.set(err.message || 'Error al rechazar el comprobante.');
      },
    });
  }

  submitExtraTransfer(): void {
    const proof = this.selectedProof();
    if (!proof || this.extraTransferForm.invalid) return;

    const values = this.extraTransferForm.getRawValue();
    if (values.receivedAmount === null || !values.bankOrWallet) return;

    this.submitting.set(true);
    this.actionError.set(null);

    const payload = {
      motivo: values.reason,
      monto_recibido: values.receivedAmount,
      banco_o_billetera: values.bankOrWallet,
      numero_operacion: values.operationNumber,
      colision: null,
      sobrepago:
        values.overpaymentConfirmed && values.overpaymentReason
          ? { confirmado: true as const, motivo: values.overpaymentReason }
          : null,
    };

    this.adminApi.recordExtraTransfer(proof.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.actionSuccess.set(`Transferencia extra registrada para la orden ${proof.id}. Reembolso abierto.`);
        this.loadProofs();
        this.alertsStore?.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.actionError.set(err.message || 'Error al registrar la transferencia extra.');
      },
    });
  }
}
