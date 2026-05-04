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
  templateUrl: './payment-history-table.component.html',
  styleUrl: './payment-history-table.component.scss',
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
