import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';
import { DashboardOrder } from '../dashboard.store';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'En camino',
  DELIVERED: 'Entregado',
  REJECTED: 'Rechazado',
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: 'tag-pending',
  CONFIRMED: 'tag-confirmed',
  DISPATCHED: 'tag-dispatched',
  DELIVERED: 'tag-delivered',
  REJECTED: 'tag-rejected',
};

@Component({
  selector: 'app-recent-orders-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SkeletonComponent],
  template: `
    <div class="widget" role="region" aria-label="Pedidos recientes">
      <div class="widget__header">
        <h2 class="widget__title">Pedidos recientes</h2>
        <a routerLink="/vendor/orders" class="widget__link">Ver todos →</a>
      </div>

      <div class="widget__body">
        @if (isLoading()) {
          <table class="orders-table" aria-busy="true">
            <tbody>
              @for (row of skeletonRows; track $index) {
                <tr>
                  <td><td-skeleton variant="line" width="80px" /></td>
                  <td><td-skeleton variant="line" width="120px" /></td>
                  <td><td-skeleton variant="line" width="60px" /></td>
                  <td><td-skeleton variant="line" width="80px" /></td>
                  <td><td-skeleton variant="circle" width="28px" height="28px" /></td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (orders().length === 0) {
          <p class="widget__empty">Sin pedidos aún</p>
        } @else {
          <table class="orders-table">
            <thead>
              <tr>
                <th scope="col">N°</th>
                <th scope="col">Cliente</th>
                <th scope="col">Total</th>
                <th scope="col">Estado</th>
                <th scope="col"><span class="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              @for (order of orders(); track order.id) {
                <tr>
                  <td class="orders-table__number">{{ order.orderNumber }}</td>
                  <td>{{ order.customerName }}</td>
                  <td class="orders-table__total">S/ {{ order.total.toFixed(2) }}</td>
                  <td>
                    <span class="tag {{ statusClass(order.status) }}">
                      {{ statusLabel(order.status) }}
                    </span>
                  </td>
                  <td>
                    <button
                      class="orders-table__btn"
                      (click)="orderClick.emit(order.id)"
                      [attr.aria-label]="'Ver pedido ' + order.orderNumber"
                    >→</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [`
    .widget {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .widget__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .widget__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .widget__link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;

      &:hover { text-decoration: underline; }
    }

    .widget__body {
      padding: 0;
    }

    .widget__empty {
      padding: 32px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 14px;
      margin: 0;
    }

    .orders-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }

      th {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--text-secondary);
        background: var(--surface);
      }

      tr:last-child td {
        border-bottom: none;
      }

      tr:hover td {
        background: var(--surface);
      }
    }

    .orders-table__number {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 12px;
    }

    .orders-table__total {
      font-weight: 600;
      color: var(--text-primary);
    }

    .orders-table__btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      width: 28px;
      height: 28px;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--primary-light);
        color: var(--primary);
        border-color: var(--primary);
      }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `],
})
export class RecentOrdersWidgetComponent {
  orders = input.required<DashboardOrder[]>();
  isLoading = input<boolean>(false);

  orderClick = output<string>();

  readonly skeletonRows = Array(5);

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusClass(status: string): string {
    return STATUS_CLASSES[status] ?? '';
  }
}
