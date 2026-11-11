import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../../core/api/admin-api';
import { UpdateAccountProposalRequestDto } from '../../../core/api/api.dto';
import { AdminPaymentAccount, BankOrWallet, PaymentAccountChange } from '../../../core/api/api.models';
import { SessionStore } from '../../../core/session/session.store';

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-accounts.page.html',
  styleUrl: './admin-accounts.page.scss',
})
export class AdminAccountsPage implements OnInit {
  private readonly adminApi = inject(AdminApi);
  private readonly sessionStore = inject(SessionStore);

  readonly accounts = signal<AdminPaymentAccount[]>([]);
  readonly pendingChanges = signal<PaymentAccountChange[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly currentUserId = computed(() => this.sessionStore.user()?.id ?? '');

  readonly banks: BankOrWallet[] = ['YAPE', 'PLIN', 'BCP', 'BBVA', 'INTERBANK'];

  // Modals state
  readonly showProposeModal = signal(false);
  readonly showEditModal = signal(false);
  readonly selectedAccount = signal<AdminPaymentAccount | null>(null);

  // Propose Form
  readonly proposeForm = new FormGroup({
    method: new FormControl<BankOrWallet | ''>('', [Validators.required]),
    holder: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    number: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cci: new FormControl(''),
    order: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
  });

  // Edit Form
  readonly editForm = new FormGroup({
    method: new FormControl<BankOrWallet | ''>(''),
    holder: new FormControl(''),
    number: new FormControl(''),
    cci: new FormControl(''),
    order: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi.paymentAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs);
        this.adminApi.pendingAccountChanges().subscribe({
          next: (chgs) => {
            this.pendingChanges.set(chgs);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('No se pudieron cargar los cambios pendientes.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('No se pudieron cargar las cuentas de pago.');
        this.loading.set(false);
      },
    });
  }

  canApproveOrReject(change: PaymentAccountChange): boolean {
    const current = this.currentUserId();
    return Boolean(current && change.proposedBy !== current);
  }

  canCancel(change: PaymentAccountChange): boolean {
    const current = this.currentUserId();
    return Boolean(current && change.proposedBy === current);
  }

  openProposeModal(): void {
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.proposeForm.reset({
      method: '',
      holder: '',
      number: '',
      cci: '',
      order: this.accounts().length,
    });
    this.showProposeModal.set(true);
  }

  openEditModal(account: AdminPaymentAccount): void {
    this.selectedAccount.set(account);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.editForm.reset({
      method: (account.method as BankOrWallet) || '',
      holder: account.holder,
      number: account.number,
      cci: account.cci ?? '',
      order: account.order,
    });
    this.showEditModal.set(true);
  }

  closeModal(): void {
    this.showProposeModal.set(false);
    this.showEditModal.set(false);
    this.selectedAccount.set(null);
  }

  submitPropose(): void {
    if (this.proposeForm.invalid) return;
    const values = this.proposeForm.getRawValue();
    if (!values.method) return;

    this.submitting.set(true);
    this.actionError.set(null);

    this.adminApi
      .proposePaymentAccount({
        metodo: values.method,
        titular: values.holder,
        numero: values.number,
        cci: values.cci?.trim() || null,
        orden: values.order,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();
          this.actionSuccess.set('Propuesta de cuenta enviada (202). Esperando aprobación de otro operador.');
          this.loadAll();
        },
        error: (err) => {
          this.submitting.set(false);
          this.actionError.set(err.message || 'Error al proponer la cuenta.');
        },
      });
  }

  submitEdit(): void {
    const acc = this.selectedAccount();
    if (!acc || this.editForm.invalid) return;

    const values = this.editForm.getRawValue();
    const payload: UpdateAccountProposalRequestDto = {};
    if (values.method && values.method !== acc.method) payload.metodo = values.method;
    if (values.holder && values.holder !== acc.holder) payload.titular = values.holder;
    if (values.number && values.number !== acc.number) payload.numero = values.number;
    if (values.cci !== undefined && (values.cci?.trim() || null) !== acc.cci) payload.cci = values.cci?.trim() || null;
    if (values.order !== null && values.order !== acc.order) payload.orden = values.order;

    if (Object.keys(payload).length === 0) {
      this.closeModal();
      return;
    }

    this.submitting.set(true);
    this.actionError.set(null);

    this.adminApi.updatePaymentAccount(acc.id, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.closeModal();
        if ('id' in res && 'kind' in res) {
          this.actionSuccess.set('Cambio propuesto (202). Requiere aprobación de otro operador (4 ojos).');
        } else {
          this.actionSuccess.set('Cuenta actualizada directamente.');
        }
        this.loadAll();
      },
      error: (err) => {
        this.submitting.set(false);
        this.actionError.set(err.message || 'Error al actualizar la cuenta.');
      },
    });
  }

  deactivateAccount(acc: AdminPaymentAccount): void {
    if (!confirm(`¿Desactivar la cuenta ${acc.label} (${acc.number})? Se aplicará inmediatamente.`)) return;

    this.actionError.set(null);
    this.adminApi.deactivatePaymentAccount(acc.id).subscribe({
      next: () => {
        this.actionSuccess.set(`Cuenta ${acc.label} desactivada.`);
        this.loadAll();
      },
      error: (err) => {
        this.actionError.set(err.message || 'Error al desactivar la cuenta.');
      },
    });
  }

  activateAccount(acc: AdminPaymentAccount): void {
    this.actionError.set(null);
    this.adminApi.activatePaymentAccount(acc.id).subscribe({
      next: (res) => {
        if ('id' in res && 'kind' in res) {
          this.actionSuccess.set(`Activación de cuenta propuesta (202). Requiere aprobación de otro operador.`);
        } else {
          this.actionSuccess.set(`Cuenta activada.`);
        }
        this.loadAll();
      },
      error: (err) => {
        this.actionError.set(err.message || 'Error al reactivar la cuenta.');
      },
    });
  }

  approveChange(change: PaymentAccountChange): void {
    this.actionError.set(null);
    this.adminApi.approveAccountChange(change.id).subscribe({
      next: () => {
        this.actionSuccess.set(`Cambio de cuenta aprobado y publicado.`);
        this.loadAll();
      },
      error: (err) => {
        this.actionError.set(err.message || 'Error al aprobar el cambio de cuenta.');
      },
    });
  }

  rejectChange(change: PaymentAccountChange): void {
    this.actionError.set(null);
    this.adminApi.rejectAccountChange(change.id).subscribe({
      next: () => {
        this.actionSuccess.set(`Cambio de cuenta rechazado.`);
        this.loadAll();
      },
      error: (err) => {
        this.actionError.set(err.message || 'Error al rechazar el cambio.');
      },
    });
  }

  cancelChange(change: PaymentAccountChange): void {
    this.actionError.set(null);
    this.adminApi.cancelAccountChange(change.id).subscribe({
      next: () => {
        this.actionSuccess.set(`Propuesta de cambio cancelada.`);
        this.loadAll();
      },
      error: (err) => {
        this.actionError.set(err.message || 'Error al cancelar la propuesta.');
      },
    });
  }
}
