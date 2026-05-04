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
  templateUrl: './order-list-table.component.html',
  styleUrl: './order-list-table.component.scss',
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
