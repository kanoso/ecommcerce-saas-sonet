import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" role="region" aria-label="Gestión del pedido">
      <h2 class="card__title">Gestión del pedido</h2>

      @switch (order().status) {
        @case ('PENDING') {
          <div class="actions">
            <button
              class="btn btn-primary"
              type="button"
              [disabled]="isUpdating()"
              (click)="openConfirmModal()"
              aria-label="Confirmar pedido"
            >
              <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
              {{ isUpdating() ? 'Procesando...' : 'Confirmar pedido' }}
            </button>
            <button
              class="btn btn-danger-ghost"
              type="button"
              [disabled]="isUpdating()"
              (click)="rejectModalOpen.set(true)"
              aria-label="Rechazar pedido"
            >
              <span class="material-symbols-rounded" aria-hidden="true">cancel</span>
              Rechazar
            </button>
          </div>
        }
        @case ('CONFIRMED') {
          <div class="actions">
            <button
              class="btn btn-secondary"
              type="button"
              [disabled]="isUpdating()"
              (click)="dispatch.emit()"
              aria-label="Marcar como despachado"
            >
              <span class="material-symbols-rounded" aria-hidden="true">local_shipping</span>
              {{ isUpdating() ? 'Procesando...' : 'Marcar como despachado' }}
            </button>
            <button
              class="btn btn-danger-ghost"
              type="button"
              [disabled]="isUpdating()"
              (click)="rejectModalOpen.set(true)"
              aria-label="Rechazar pedido"
            >
              <span class="material-symbols-rounded" aria-hidden="true">cancel</span>
              Rechazar
            </button>
          </div>
        }
        @case ('DISPATCHED') {
          <div class="actions">
            <button
              class="btn btn-primary"
              type="button"
              [disabled]="isUpdating()"
              (click)="deliver.emit()"
              aria-label="Marcar como entregado"
            >
              <span class="material-symbols-rounded" aria-hidden="true">done_all</span>
              {{ isUpdating() ? 'Procesando...' : 'Marcar como entregado' }}
            </button>
            <button
              class="btn btn-danger-ghost"
              type="button"
              [disabled]="isUpdating()"
              (click)="rejectModalOpen.set(true)"
              aria-label="Rechazar pedido"
            >
              <span class="material-symbols-rounded" aria-hidden="true">cancel</span>
              Rechazar
            </button>
          </div>
        }
        @default {
          <p class="closed-message">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            Este pedido ya está cerrado.
          </p>
        }
      }
    </div>

    @if (confirmModalOpen()) {
      <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        (click)="onOverlayClick($event, 'confirm')"
        (keydown.escape)="confirmModalOpen.set(false)"
      >
        <div class="modal">
          <div class="modal__header">
            <h3 class="modal__title" id="confirm-modal-title">Confirmar pedido</h3>
            <button
              class="modal__close"
              type="button"
              (click)="confirmModalOpen.set(false)"
              aria-label="Cerrar modal"
            >
              <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
          </div>
          <p class="modal__body">
            ¿Confirmás este pedido? Se descontará el stock automáticamente.
          </p>
          <div class="modal__footer">
            <button
              class="btn btn-ghost"
              type="button"
              (click)="confirmModalOpen.set(false)"
            >
              Cancelar
            </button>
            <button
              class="btn btn-primary"
              type="button"
              (click)="onConfirmSubmit()"
            >
              Sí, confirmar
            </button>
          </div>
        </div>
      </div>
    }

    @if (rejectModalOpen()) {
      <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
        (click)="onOverlayClick($event, 'reject')"
        (keydown.escape)="rejectModalOpen.set(false)"
      >
        <div class="modal">
          <div class="modal__header">
            <h3 class="modal__title" id="reject-modal-title">Rechazar pedido</h3>
            <button
              class="modal__close"
              type="button"
              (click)="rejectModalOpen.set(false)"
              aria-label="Cerrar modal"
            >
              <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
          </div>
          <p class="modal__body">Indicá el motivo del rechazo para notificar al cliente.</p>
          <textarea
            class="modal__textarea"
            rows="4"
            placeholder="Ej: Producto sin stock, dirección no disponible..."
            [value]="rejectReason()"
            (input)="rejectReason.set($any($event.target).value)"
            aria-label="Motivo del rechazo"
          ></textarea>
          <span class="modal__char-count" [class.modal__char-count--valid]="rejectReason().length >= 10">
            {{ rejectReason().length }} / mín. 10 caracteres
          </span>
          <div class="modal__footer">
            <button
              class="btn btn-ghost"
              type="button"
              (click)="rejectModalOpen.set(false)"
            >
              Cancelar
            </button>
            <button
              class="btn btn-danger"
              type="button"
              [disabled]="rejectReason().length < 10"
              (click)="onRejectSubmit()"
            >
              Rechazar pedido
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .card {
      background: var(--card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
      padding: 20px;
    }

    .card__title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 16px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn {
      width: 100%;
      padding: 10px 16px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.15s, opacity 0.15s;

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }

      span { font-size: 16px; }
    }

    .btn-primary {
      background: var(--primary);
      color: #fff;

      &:hover:not(:disabled) { background: var(--primary-dark); }
    }

    .btn-secondary {
      background: var(--secondary);
      color: #fff;

      &:hover:not(:disabled) { opacity: 0.9; }
    }

    .btn-danger {
      background: var(--danger);
      color: #fff;

      &:hover:not(:disabled) { opacity: 0.9; }
    }

    .btn-danger-ghost {
      background: transparent;
      color: var(--danger);
      border: 1px solid var(--danger);

      &:hover:not(:disabled) { background: rgba(239,68,68,.06); }
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      width: auto;

      &:hover { background: var(--surface); }
    }

    .closed-message {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      padding: 12px;
      background: var(--surface);
      border-radius: var(--radius);
      margin: 0;

      span { font-size: 18px; }
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal {
      background: var(--card);
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: var(--shadow-md);
    }

    .modal__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .modal__title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .modal__close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-secondary);
      padding: 4px;
      display: flex;
      align-items: center;
      border-radius: var(--radius);
      transition: background 0.15s;

      &:hover { background: var(--surface); }

      span { font-size: 20px; }
    }

    .modal__body {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0 0 16px;
    }

    .modal__textarea {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
      color: var(--text-primary);
      transition: border-color 0.15s;

      &:focus { border-color: var(--primary); }
    }

    .modal__char-count {
      display: block;
      font-size: 11px;
      color: var(--danger);
      margin-top: 4px;
      margin-bottom: 0;
    }

    .modal__char-count--valid {
      color: var(--primary);
    }

    .modal__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `],
})
export class OrderActionsComponent {
  order = input.required<Order>();
  isUpdating = input<boolean>(false);

  confirm = output<void>();
  dispatch = output<void>();
  deliver = output<void>();
  reject = output<string>();

  readonly confirmModalOpen = signal(false);
  readonly rejectModalOpen = signal(false);
  readonly rejectReason = signal('');

  openConfirmModal(): void {
    this.confirmModalOpen.set(true);
  }

  onConfirmSubmit(): void {
    this.confirmModalOpen.set(false);
    this.confirm.emit();
  }

  onRejectSubmit(): void {
    const reason = this.rejectReason();
    if (reason.length < 10) return;
    this.rejectModalOpen.set(false);
    this.rejectReason.set('');
    this.reject.emit(reason);
  }

  onOverlayClick(event: MouseEvent, modal: 'confirm' | 'reject'): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (modal === 'confirm') this.confirmModalOpen.set(false);
      else this.rejectModalOpen.set(false);
    }
  }
}
