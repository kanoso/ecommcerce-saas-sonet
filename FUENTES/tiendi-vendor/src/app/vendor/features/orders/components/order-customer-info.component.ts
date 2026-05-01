import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

@Component({
  selector: 'td-order-customer-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" role="region" aria-label="Información del cliente">
      <h2 class="card__title">Información del cliente</h2>

      <div class="customer">
        <div class="customer__avatar" [attr.aria-label]="'Avatar de ' + order().customerName">
          {{ getInitials(order().customerName) }}
        </div>
        <span class="customer__name">{{ order().customerName }}</span>
      </div>

      <div class="customer__contacts">
        <div class="contact-row">
          <span class="material-symbols-rounded contact-row__icon" aria-hidden="true">phone</span>
          <span>{{ order().customerPhone }}</span>
        </div>
        <div class="contact-row">
          <span class="material-symbols-rounded contact-row__icon" aria-hidden="true">email</span>
          <a [href]="'mailto:' + order().customerEmail" class="contact-row__link">
            {{ order().customerEmail }}
          </a>
        </div>
        @if (order().deliveryAddress) {
          <div class="contact-row">
            <span class="material-symbols-rounded contact-row__icon" aria-hidden="true">place</span>
            <span>{{ order().deliveryAddress }}</span>
          </div>
        }
      </div>

      <hr class="divider" />

      <span class="order-count">8 pedidos realizados</span>
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

    .customer {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .customer__avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--primary-light);
      color: var(--primary);
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .customer__name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .customer__contacts {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .contact-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .contact-row__icon {
      font-size: 16px;
      color: var(--text-secondary);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .contact-row__link {
      color: var(--primary);
      text-decoration: none;

      &:hover { text-decoration: underline; }
    }

    .divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 16px 0;
    }

    .order-count {
      font-size: 12px;
      color: var(--text-secondary);
    }
  `],
})
export class OrderCustomerInfoComponent {
  order = input.required<Order>();

  getInitials = getInitials;
}
