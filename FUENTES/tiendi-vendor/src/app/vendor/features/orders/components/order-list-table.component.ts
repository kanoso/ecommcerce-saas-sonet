import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Order } from '../orders.store';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/molecules/empty-state.component';

function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate));
}

function formatTime(isoDate: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'En camino',
  DELIVERED: 'Entregado',
  REJECTED: 'Rechazado',
};

const STATUS_CSS: Record<string, string> = {
  PENDING: 'tag tag-pending',
  CONFIRMED: 'tag tag-confirmed',
  DISPATCHED: 'tag tag-dispatched',
  DELIVERED: 'tag tag-delivered',
  REJECTED: 'tag tag-rejected',
};

@Component({
  selector: 'td-order-list-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, EmptyStateComponent],
  template: `
    <div class="table-wrapper">
      @if (isLoading()) {
        <table class="table" aria-busy="true" aria-label="Cargando pedidos">
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Productos</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (s of skeletonRows; track s) {
              <tr>
                <td><td-skeleton width="100px" /></td>
                <td><td-skeleton width="140px" /></td>
                <td><td-skeleton width="80px" /></td>
                <td><td-skeleton width="80px" /></td>
                <td><td-skeleton width="60px" /></td>
                <td><td-skeleton width="90px" /></td>
                <td><td-skeleton width="120px" /></td>
              </tr>
            }
          </tbody>
        </table>
      } @else if (orders().length === 0) {
        <td-empty-state
          title="Sin pedidos"
          message="No hay pedidos que coincidan con los filtros seleccionados."
          icon="receipt_long"
        />
      } @else {
        <table class="table" aria-label="Lista de pedidos">
          <thead>
            <tr>
              <th scope="col">N° Pedido</th>
              <th scope="col">Cliente</th>
              <th scope="col">Fecha</th>
              <th scope="col">Productos</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (order of orders(); track order.id) {
              <tr class="table__row">
                <td class="table__order-number">
                  <span class="order-number">{{ order.orderNumber }}</span>
                  <span class="delivery-type">{{ order.deliveryType === 'DELIVERY' ? 'Delivery' : 'Recojo' }}</span>
                </td>
                <td>
                  <div class="customer-cell">
                    <div class="customer-cell__avatar" [attr.aria-label]="'Avatar de ' + order.customerName">
                      {{ getInitials(order.customerName) }}
                    </div>
                    <div class="customer-cell__info">
                      <span class="customer-cell__name">{{ order.customerName }}</span>
                      <span class="customer-cell__phone">{{ order.customerPhone }}</span>
                    </div>
                  </div>
                </td>
                <td class="table__date">
                  <span class="date-day">{{ formatDay(order.createdAt) }}</span>
                  <span class="date-time">{{ formatTime(order.createdAt) }}</span>
                </td>
                <td>
                  <span class="products-count">
                    {{ order.items.length }} producto{{ order.items.length !== 1 ? 's' : '' }}
                  </span>
                </td>
                <td>
                  <span class="total">S/ {{ order.total.toFixed(2) }}</span>
                </td>
                <td>
                  <span [className]="getStatusClass(order.status)">
                    {{ getStatusLabel(order.status) }}
                  </span>
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      (click)="orderClick.emit(order.id)"
                      [attr.aria-label]="'Ver detalle del pedido ' + order.orderNumber"
                    >
                      Ver detalle
                    </button>
                    @switch (order.status) {
                      @case ('PENDING') {
                        <button
                          class="btn btn-secondary btn-sm"
                          type="button"
                          (click)="quickAction.emit({ orderId: order.id, action: 'confirm' })"
                          [attr.aria-label]="'Confirmar pedido ' + order.orderNumber"
                        >
                          Confirmar
                        </button>
                      }
                      @case ('CONFIRMED') {
                        <button
                          class="btn btn-secondary btn-sm"
                          type="button"
                          (click)="quickAction.emit({ orderId: order.id, action: 'dispatch' })"
                          [attr.aria-label]="'Despachar pedido ' + order.orderNumber"
                        >
                          Despachar
                        </button>
                      }
                      @case ('DISPATCHED') {
                        <button
                          class="btn btn-secondary btn-sm"
                          type="button"
                          (click)="quickAction.emit({ orderId: order.id, action: 'deliver' })"
                          [attr.aria-label]="'Marcar como entregado ' + order.orderNumber"
                        >
                          Entregado
                        </button>
                      }
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="pagination" aria-label="Paginación">
          <span class="pagination__info">
            Mostrando {{ orders().length }} de {{ orders().length }} pedidos
          </span>
          <div class="pagination__buttons">
            <button class="pagination__btn" type="button" disabled aria-label="Página anterior">
              &#8249;
            </button>
            <button class="pagination__btn pagination__btn--active" type="button" aria-current="page">
              1
            </button>
            <button class="pagination__btn" type="button" aria-label="Página siguiente">
              &#8250;
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .table-wrapper {
      background: var(--card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
      overflow: hidden;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        text-align: left;
        padding: 10px 16px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
    }

    .table__row {
      transition: background 0.1s;

      &:hover { background: #FAFAFA; }
      &:last-child td { border-bottom: none; }
    }

    .order-number {
      display: block;
      font-weight: 600;
      color: var(--primary);
      font-size: 13px;
    }

    .delivery-type {
      display: block;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .customer-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .customer-cell__avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--primary-light);
      color: var(--primary);
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .customer-cell__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .customer-cell__name {
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
    }

    .customer-cell__phone {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .table__date {
      white-space: nowrap;
    }

    .date-day {
      display: block;
      color: var(--text-primary);
    }

    .date-time {
      display: block;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .products-count {
      color: var(--text-secondary);
    }

    .total {
      font-weight: 700;
      color: var(--text-primary);
    }

    .actions {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
    }

    .btn {
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }

    .btn-sm {
      padding: 5px 10px;
      font-size: 12px;
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);

      &:hover {
        background: var(--surface);
        color: var(--text-primary);
      }
    }

    .btn-secondary {
      background: #4338CA;
      color: #fff;

      &:hover { opacity: 0.9; }
    }

    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
    }

    .pagination__info {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .pagination__buttons {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .pagination__btn {
      width: 30px;
      height: 30px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      transition: background 0.15s;

      &:hover:not(:disabled) { background: var(--surface); }
      &:disabled { opacity: 0.4; cursor: default; }
    }

    .pagination__btn--active {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
  `],
})
export class OrderListTableComponent {
  orders = input.required<Order[]>();
  isLoading = input<boolean>(false);

  orderClick = output<string>();
  quickAction = output<{ orderId: string; action: string }>();

  readonly skeletonRows = [1, 2, 3, 4, 5];

  formatDay = formatDay;
  formatTime = formatTime;
  getInitials = getInitials;

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusClass(status: string): string {
    return STATUS_CSS[status] ?? 'tag';
  }
}
