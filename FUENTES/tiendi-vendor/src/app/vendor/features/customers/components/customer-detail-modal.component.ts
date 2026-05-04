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
  templateUrl: './customer-detail-modal.component.html',
  styleUrl: './customer-detail-modal.component.scss',
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
