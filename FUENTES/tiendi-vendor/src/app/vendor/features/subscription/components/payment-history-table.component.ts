import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { PaymentRecord } from '../subscription.store';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Usage: <app-payment-history-table [records]="store.paymentHistory()" />

@Component({
  selector: 'app-payment-history-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="payment-history" aria-labelledby="history-heading">
      <h2 class="payment-history__title" id="history-heading">Historial de pagos</h2>

      @if (records().length === 0) {
        <p class="payment-history__empty">No hay registros de pago aún.</p>
      } @else {
        <div class="table-wrapper" role="region" aria-label="Historial de pagos" tabindex="0">
          <table class="payment-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Descripción</th>
                <th scope="col">Monto</th>
                <th scope="col">Estado</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (record of records(); track record.id) {
                <tr>
                  <td class="payment-table__date">{{ formatDate(record.date) }}</td>
                  <td class="payment-table__desc">{{ record.description }}</td>
                  <td class="payment-table__amount">S/ {{ formatAmount(record.amount) }}</td>
                  <td>
                    <span class="status-tag"
                          [class]="'status-tag--' + record.status"
                          [attr.aria-label]="statusLabel(record.status)">
                      {{ statusLabel(record.status) }}
                    </span>
                  </td>
                  <td class="payment-table__actions">
                    <button
                      class="btn-invoice"
                      type="button"
                      (click)="onDownloadInvoice(record)"
                      [attr.aria-label]="'Descargar factura de ' + record.description">
                      Factura
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (invoiceToast()) {
        <div class="toast" role="status" aria-live="polite">
          {{ invoiceToast() }}
        </div>
      }
    </section>
  `,
  styles: [`
    .payment-history {
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 24px;
    }

    .payment-history__title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 16px;
    }

    .payment-history__empty {
      color: var(--text-muted, #6B7280);
      font-size: 14px;
      text-align: center;
      padding: 24px 0;
    }

    .table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .payment-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .payment-table thead th {
      text-align: left;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted, #6B7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border, #E5E7EB);
    }

    .payment-table tbody tr {
      border-bottom: 1px solid var(--surface, #F3F4F6);
      transition: background 0.1s;
    }

    .payment-table tbody tr:last-child {
      border-bottom: none;
    }

    .payment-table tbody tr:hover {
      background: var(--surface, #F3F4F6);
    }

    .payment-table td {
      padding: 12px 12px;
      color: #374151;
    }

    .payment-table__date {
      white-space: nowrap;
      color: var(--text-muted, #6B7280);
    }

    .payment-table__desc {
      max-width: 280px;
    }

    .payment-table__amount {
      font-weight: 600;
      white-space: nowrap;
    }

    .payment-table__actions {
      text-align: right;
    }

    .status-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-tag--paid {
      background: #D1FAE5;
      color: #065F46;
    }

    .status-tag--pending {
      background: #FEF3C7;
      color: #92400E;
    }

    .status-tag--failed {
      background: #FEE2E2;
      color: #991B1B;
    }

    .btn-invoice {
      padding: 5px 12px;
      background: transparent;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: background 0.1s;
    }

    .btn-invoice:hover {
      background: var(--surface, #F3F4F6);
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1F2937;
      color: #fff;
      padding: 12px 20px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  `],
})
export class PaymentHistoryTableComponent {
  readonly records = input.required<PaymentRecord[]>();
  readonly invoiceToast = signal<string | null>(null);

  readonly formatDate = formatDate;
  readonly formatAmount = formatAmount;

  statusLabel(status: PaymentRecord['status']): string {
    const map: Record<PaymentRecord['status'], string> = {
      paid: 'Pagado',
      pending: 'Pendiente',
      failed: 'Fallido',
    };
    return map[status];
  }

  onDownloadInvoice(record: PaymentRecord): void {
    this.invoiceToast.set(`Factura de ${record.description} descargada (mock)`);
    setTimeout(() => this.invoiceToast.set(null), 3000);
  }
}
