import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../../core/api/admin-api';
import { ApiError } from '../../../core/api/api-error';
import { AdminRefund } from '../../../core/api/api.models';

@Component({
  selector: 'app-admin-refunds',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-refunds.page.html',
  styleUrl: './admin-refunds.page.scss',
})
export class AdminRefundsPage implements OnInit {
  private readonly adminApi = inject(AdminApi);

  readonly refunds = signal<AdminRefund[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly selectedRefund = signal<AdminRefund | null>(null);
  readonly showModal = signal(false);

  readonly completeForm = new FormGroup({
    destination: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    operationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.loadRefunds();
  }

  loadRefunds(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi.pendingRefunds().subscribe({
      next: (data) => {
        this.refunds.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los reembolsos pendientes. Intenta nuevamente.');
        this.loading.set(false);
      },
    });
  }

  openComplete(refund: AdminRefund): void {
    this.selectedRefund.set(refund);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.completeForm.reset({
      destination: '',
      operationNumber: '',
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedRefund.set(null);
  }

  submitComplete(): void {
    const refund = this.selectedRefund();
    if (!refund || this.completeForm.invalid) return;

    const { destination, operationNumber } = this.completeForm.getRawValue();
    this.submitting.set(true);
    this.actionError.set(null);

    this.adminApi
      .completeRefund(refund.refundId, {
        destino: destination,
        numero_operacion: operationNumber,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();
          this.actionSuccess.set(`Reembolso ${refund.refundId} completado exitosamente.`);
          this.loadRefunds();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          if (err.code === 'SAME_OPERATOR_REFUND' || err.status === 409) {
            this.actionError.set(
              'Control de 4 ojos (DT-17): No podés completar el reembolso porque fuiste quien registró el dinero. Debe completarlo otro administrador.'
            );
          } else {
            this.actionError.set(err.message || 'Error al completar el reembolso.');
          }
        },
      });
  }
}
