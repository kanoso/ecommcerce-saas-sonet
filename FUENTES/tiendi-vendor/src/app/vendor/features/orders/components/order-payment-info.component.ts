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
  template: `
    <div class="card" role="region" aria-label="Método de pago">
      <h2 class="card__title">Método de pago</h2>

      <div class="payment">
        <div class="payment__icon" aria-hidden="true">
          <span class="material-symbols-rounded">{{ getIcon(order().paymentMethod) }}</span>
        </div>
        <div class="payment__info">
          <span class="payment__label">{{ getLabel(order().paymentMethod) }}</span>
          <span
            class="tag"
            [class.tag-pending]="order().status !== 'DELIVERED'"
            [class.tag-delivered]="order().status === 'DELIVERED'"
          >
            {{ order().status === 'DELIVERED' ? 'Pagado' : 'Pendiente' }}
          </span>
        </div>
      </div>
    </div>
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

    .payment {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .payment__icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius);
      background: var(--primary-light);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      span {
        font-size: 20px;
        color: var(--primary);
      }
    }

    .payment__info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .payment__label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
  `],
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
