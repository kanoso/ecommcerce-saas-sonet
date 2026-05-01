import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-items-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" role="region" aria-label="Productos del pedido">
      <h2 class="card__title">Productos</h2>

      <table class="items-table" aria-label="Detalle de productos">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col" class="text-right">Cant.</th>
            <th scope="col" class="text-right">Precio unit.</th>
            <th scope="col" class="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          @for (item of order().items; track item.productId) {
            <tr>
              <td>
                <div class="product-cell">
                  <div class="product-cell__icon" aria-hidden="true">
                    <span class="material-symbols-rounded">inventory_2</span>
                  </div>
                  <div class="product-cell__info">
                    <span class="product-cell__name">{{ item.name }}</span>
                    <span class="product-cell__category">Producto</span>
                  </div>
                </div>
              </td>
              <td class="text-right">{{ item.qty }}</td>
              <td class="text-right">S/ {{ item.unitPrice.toFixed(2) }}</td>
              <td class="text-right">S/ {{ (item.qty * item.unitPrice).toFixed(2) }}</td>
            </tr>
          }
        </tbody>
      </table>

      <div class="summary">
        <div class="summary__row">
          <span>Subtotal</span>
          <span>S/ {{ order().subtotal.toFixed(2) }}</span>
        </div>
        <div class="summary__row">
          <span>Envío</span>
          <span>S/ {{ order().deliveryFee.toFixed(2) }}</span>
        </div>
        <hr class="summary__divider" />
        <div class="summary__row summary__row--total">
          <span>Total</span>
          <span class="summary__total-amount">S/ {{ order().total.toFixed(2) }}</span>
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

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 16px;

      th {
        text-align: left;
        padding: 8px 0;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border);
      }

      td {
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
        color: var(--text-primary);
      }

      tr:last-child td { border-bottom: none; }
    }

    .text-right { text-align: right; }

    .product-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .product-cell__icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius);
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      span {
        font-size: 18px;
        color: var(--text-secondary);
      }
    }

    .product-cell__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .product-cell__name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .product-cell__category {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 4px;
    }

    .summary__row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .summary__divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 4px 0;
    }

    .summary__row--total {
      font-weight: 700;
      color: var(--text-primary);
      font-size: 14px;
    }

    .summary__total-amount {
      color: var(--primary);
      font-size: 16px;
    }
  `],
})
export class OrderItemsListComponent {
  order = input.required<Order>();
}
