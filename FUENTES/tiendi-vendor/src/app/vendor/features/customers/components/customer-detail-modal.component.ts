import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerDetail } from '../customers.store';

/**
 * Usage:
 * <app-customer-detail-modal
 *   [customer]="store.selected()"
 *   (close)="store.clearSelected()"
 * />
 */
@Component({
  selector: 'app-customer-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    @if (customer()) {
      <!-- Overlay -->
      <div
        class="overlay"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Detalle del cliente ' + customer()!.name"
        (click)="onOverlayClick($event)"
        (keydown.escape)="closed.emit()"
        tabindex="-1"
      >
        <!-- Modal panel -->
        <div class="modal" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="presentation">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-customer-info">
              <div
                class="modal-avatar"
                [style.background-color]="customer()!.avatarColor"
                aria-hidden="true"
              >
                {{ getInitials(customer()!.name) }}
              </div>
              <div>
                <h2 class="modal-name">{{ customer()!.name }}</h2>
                <span class="modal-type-tag" [class]="getTagClass(customer()!.type)">
                  {{ getTypeLabel(customer()!.type) }}
                </span>
              </div>
            </div>
            <button
              class="btn-close"
              (click)="closed.emit()"
              aria-label="Cerrar detalle del cliente"
              type="button"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Contact info -->
          <div class="modal-contact">
            <span>
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.43 2 2 0 0 1 3.61 1.25h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.77-.77a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16a2 2 0 0 1 .27.92z"/>
              </svg>
              {{ customer()!.phone }}
            </span>
            <span>
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {{ customer()!.email }}
            </span>
          </div>

          <!-- Stats grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-value">{{ customer()!.totalOrders }}</span>
              <span class="stat-label">Pedidos totales</span>
            </div>
            <div class="stat-card stat-primary">
              <span class="stat-value">S/ {{ customer()!.totalSpent | number:'1.2-2' }}</span>
              <span class="stat-label">Total gastado</span>
            </div>
          </div>

          <!-- Recent orders -->
          <div class="recent-orders">
            <h3 class="section-title">Últimos pedidos</h3>
            @if (customer()!.recentOrders.length === 0) {
              <p class="no-orders">Sin pedidos registrados.</p>
            } @else {
              <ul class="orders-list" role="list">
                @for (order of customer()!.recentOrders; track order.id) {
                  <li class="order-item">
                    <div class="order-info">
                      <span class="order-code">{{ order.code }}</span>
                      <span class="order-date">{{ order.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <div class="order-right">
                      <span class="order-total">S/ {{ order.total | number:'1.2-2' }}</span>
                      <span class="order-status-tag" [class]="getOrderStatusClass(order.status)">
                        {{ getOrderStatusLabel(order.status) }}
                      </span>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Footer actions -->
          <div class="modal-footer">
            <a
              [routerLink]="['/vendor/orders']"
              [queryParams]="{ customerId: customer()!.id }"
              class="btn-secondary"
              (click)="closed.emit()"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Ver todos los pedidos
            </a>
            <a
              [href]="'tel:' + customer()!.phone"
              class="btn-primary"
              aria-label="Llamar a {{ customer()!.name }}"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.43 2 2 0 0 1 3.61 1.25h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.77-.77a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16a2 2 0 0 1 .27.92z"/>
              </svg>
              Llamar
            </a>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    /* Overlay */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Modal panel */
    .modal {
      background: var(--card, #fff);
      border-radius: var(--radius-lg, 12px);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
      animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Header */
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border, #E5E7EB);
    }

    .modal-customer-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .modal-name {
      font-size: 17px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 4px;
    }

    .modal-type-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }

    .btn-close {
      width: 36px;
      height: 36px;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6B7280;
      transition: border-color 0.15s, color 0.15s;
      flex-shrink: 0;
    }

    .btn-close:hover {
      border-color: var(--danger, #EF4444);
      color: var(--danger, #EF4444);
    }

    .btn-close:focus-visible {
      outline: 2px solid var(--primary, #047857);
      outline-offset: 2px;
    }

    /* Contact */
    .modal-contact {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border, #E5E7EB);
    }

    .modal-contact span {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #374151;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border, #E5E7EB);
    }

    .stat-card {
      background: var(--surface, #F3F4F6);
      border-radius: var(--radius, 8px);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-card.stat-primary {
      background: #D1FAE5;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }

    .stat-primary .stat-value {
      color: var(--primary, #047857);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-muted, #6B7280);
    }

    /* Recent orders */
    .recent-orders {
      padding: 16px 24px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 12px;
    }

    .no-orders {
      font-size: 13px;
      color: var(--text-muted, #6B7280);
      font-style: italic;
    }

    .orders-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .order-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--surface, #F3F4F6);
      border-radius: var(--radius, 8px);
      gap: 12px;
    }

    .order-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .order-code {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }

    .order-date {
      font-size: 12px;
      color: var(--text-muted, #6B7280);
    }

    .order-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .order-total {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary, #047857);
    }

    .order-status-tag {
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }

    .status-pending   { background: #FEF3C7; color: #92400E; }
    .status-delivered { background: #D1FAE5; color: var(--primary, #047857); }
    .status-confirmed { background: #DBEAFE; color: #1D4ED8; }
    .status-rejected  { background: #FEE2E2; color: #B91C1C; }
    .status-default   { background: var(--surface, #F3F4F6); color: var(--text-muted, #6B7280); }

    /* Footer */
    .modal-footer {
      display: flex;
      gap: 12px;
      padding: 16px 24px 20px;
      border-top: 1px solid var(--border, #E5E7EB);
    }

    .btn-secondary,
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s, border-color 0.15s;
      flex: 1;
      justify-content: center;
    }

    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border, #E5E7EB);
      color: #374151;
    }

    .btn-secondary:hover {
      border-color: #9CA3AF;
      background: var(--surface, #F3F4F6);
    }

    .btn-primary {
      background: var(--primary, #047857);
      border: 1px solid var(--primary, #047857);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--primary-dark, #065F46);
      border-color: var(--primary-dark, #065F46);
    }

    .btn-secondary:focus-visible,
    .btn-primary:focus-visible {
      outline: 2px solid var(--primary, #047857);
      outline-offset: 2px;
    }

    /* Tag variants (reused from table) */
    .tag-vip      { background: #EDE9FE; color: #7C3AED; }
    .tag-regular  { background: #D1FAE5; color: var(--primary, #047857); }
    .tag-new      { background: #DBEAFE; color: #1D4ED8; }
    .tag-inactive { background: var(--surface, #F3F4F6); color: var(--text-muted, #6B7280); }

    @media (max-width: 480px) {
      .modal-footer {
        flex-direction: column;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class CustomerDetailModalComponent {
  customer = input<CustomerDetail | null>(null);
  closed = output<void>();

  onOverlayClick(event: MouseEvent): void {
    // Only close when clicking the overlay itself (not the modal panel)
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.closed.emit();
    }
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  getTagClass(type: string): string {
    const map: Record<string, string> = {
      vip: 'modal-type-tag tag-vip',
      regular: 'modal-type-tag tag-regular',
      new: 'modal-type-tag tag-new',
      inactive: 'modal-type-tag tag-inactive',
    };
    return map[type] ?? 'modal-type-tag tag-inactive';
  }

  getTypeLabel(type: string): string {
    const map: Record<string, string> = {
      vip: '⭐ VIP',
      regular: 'Regular',
      new: '🆕 Nuevo',
      inactive: 'Inactivo',
    };
    return map[type] ?? type;
  }

  getOrderStatusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'order-status-tag status-pending',
      DELIVERED: 'order-status-tag status-delivered',
      CONFIRMED: 'order-status-tag status-confirmed',
      REJECTED: 'order-status-tag status-rejected',
    };
    return map[status] ?? 'order-status-tag status-default';
  }

  getOrderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      DELIVERED: 'Entregado',
      CONFIRMED: 'Confirmado',
      DISPATCHED: 'Despachado',
      REJECTED: 'Rechazado',
    };
    return map[status] ?? status;
  }
}
