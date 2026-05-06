import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

const PAYMENT_ICONS: Record<string, string> = {
  CASH: 'account_balance_wallet',
  YAPE: 'smartphone',
  PLIN: 'smartphone',
  TRANSFER: 'account_balance',
  CARD: 'credit_card',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia bancaria',
  CARD: 'Tarjeta (Culqi)',
};

@Component({
  selector: 'td-order-payment-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-payment-info.component.html',
  styleUrl: './order-payment-info.component.scss',
})
export class OrderPaymentInfoComponent {
  order = input.required<Order>();

  getIcon(method: string): string {
    return PAYMENT_ICONS[method] ?? 'payments';
  }

  getLabel(method: string): string {
    return PAYMENT_LABELS[method] ?? method;
  }
}
