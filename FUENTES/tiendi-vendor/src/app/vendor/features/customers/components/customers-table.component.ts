import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Customer, CustomerType } from '../customers.store';

/**
 * Usage:
 * <app-customers-table
 *   [customers]="store.customers()"
 *   (viewDetail)="store.selectCustomer($event)"
 * />
 */
@Component({
  selector: 'app-customers-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <!-- Desktop table -->
    <div class="table-wrapper" role="region" aria-label="Lista de clientes">
      @if (customers().length === 0) {
        <div class="empty-state" role="status">
          <svg width="48" height="48" fill="none" stroke="#9CA3AF" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>No hay clientes que coincidan con el filtro.</p>
        </div>
      } @else {
        <table class="customers-table">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col" class="text-right">Pedidos</th>
              <th scope="col" class="text-right">Total comprado</th>
              <th scope="col">Último pedido</th>
              <th scope="col">Tipo</th>
              <th scope="col" class="sr-only">Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (customer of customers(); track customer.id) {
              <tr class="customer-row">
                <!-- Avatar + info -->
                <td class="customer-cell">
                  <div class="customer-info">
                    <div
                      class="avatar"
                      [style.background-color]="customer.avatarColor"
                      aria-hidden="true"
                    >
                      {{ getInitials(customer.name) }}
                    </div>
                    <div class="customer-text">
                      <span class="customer-name">{{ customer.name }}</span>
                      <span class="customer-contact">{{ customer.phone }}</span>
                      <span class="customer-contact">{{ customer.email }}</span>
                    </div>
                  </div>
                </td>

                <!-- Pedidos -->
                <td class="text-right">
                  <span class="orders-count">{{ customer.totalOrders }}</span>
                </td>

                <!-- Total -->
                <td class="text-right">
                  <span class="total-spent">S/ {{ customer.totalSpent | number:'1.2-2' }}</span>
                </td>

                <!-- Último pedido -->
                <td>
                  @if (customer.lastOrderDate) {
                    <span class="last-order">{{ customer.lastOrderDate | date:'dd/MM/yyyy' }}</span>
                  } @else {
                    <span class="text-muted">Sin pedidos</span>
                  }
                </td>

                <!-- Tag tipo -->
                <td>
                  <span class="tag" [class]="getTagClass(customer.type)">
                    {{ getTypeLabel(customer.type) }}
                  </span>
                </td>

                <!-- Acción -->
                <td>
                  <button
                    class="btn-detail"
                    (click)="viewDetail.emit(customer.id)"
                    [attr.aria-label]="'Ver detalle de ' + customer.name"
                    type="button"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .table-wrapper {
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      overflow: hidden;
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 64px 24px;
      color: var(--text-muted, #6B7280);
      font-size: 14px;
    }

    /* Table */
    .customers-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    thead tr {
      background: var(--surface, #F3F4F6);
    }

    th {
      padding: 12px 16px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted, #6B7280);
      text-align: left;
      white-space: nowrap;
    }

    .text-right {
      text-align: right;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }

    .customer-row {
      border-bottom: 1px solid var(--border, #E5E7EB);
      transition: background 0.15s;
    }

    .customer-row:last-child {
      border-bottom: none;
    }

    .customer-row:hover {
      background: #F9FAFB;
    }

    td {
      padding: 14px 16px;
      vertical-align: middle;
    }

    /* Avatar + info */
    .customer-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .customer-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .customer-name {
      font-weight: 600;
      color: #111827;
    }

    .customer-contact {
      font-size: 12px;
      color: var(--text-muted, #6B7280);
    }

    /* Values */
    .orders-count {
      font-weight: 600;
      color: #111827;
    }

    .total-spent {
      font-weight: 600;
      color: var(--primary, #047857);
    }

    .last-order {
      color: #374151;
    }

    .text-muted {
      color: var(--text-muted, #6B7280);
      font-style: italic;
    }

    /* Tags */
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .tag-vip {
      background: #EDE9FE;
      color: #7C3AED;
    }

    .tag-regular {
      background: #D1FAE5;
      color: var(--primary, #047857);
    }

    .tag-new {
      background: #DBEAFE;
      color: #1D4ED8;
    }

    .tag-inactive {
      background: var(--surface, #F3F4F6);
      color: var(--text-muted, #6B7280);
    }

    /* Action button */
    .btn-detail {
      padding: 6px 14px;
      background: transparent;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      white-space: nowrap;
    }

    .btn-detail:hover {
      border-color: var(--primary, #047857);
      color: var(--primary, #047857);
      background: #F0FDF4;
    }

    .btn-detail:focus-visible {
      outline: 2px solid var(--primary, #047857);
      outline-offset: 2px;
    }

    /* Responsive — mobile cards */
    @media (max-width: 768px) {
      .customers-table thead {
        display: none;
      }

      .customers-table,
      .customers-table tbody,
      .customers-table tr,
      .customers-table td {
        display: block;
      }

      .customer-row {
        padding: 16px;
        border-bottom: 1px solid var(--border, #E5E7EB);
      }

      .customer-row td {
        padding: 4px 0;
        border: none;
      }

      td.text-right {
        text-align: left;
      }
    }
  `],
})
export class CustomersTableComponent {
  customers = input.required<Customer[]>();
  viewDetail = output<string>();

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  getTagClass(type: CustomerType): string {
    const map: Record<CustomerType, string> = {
      vip: 'tag tag-vip',
      regular: 'tag tag-regular',
      new: 'tag tag-new',
      inactive: 'tag tag-inactive',
    };
    return map[type] ?? 'tag tag-inactive';
  }

  getTypeLabel(type: CustomerType): string {
    const map: Record<CustomerType, string> = {
      vip: '⭐ VIP',
      regular: 'Regular',
      new: '🆕 Nuevo',
      inactive: 'Inactivo',
    };
    return map[type] ?? type;
  }
}
