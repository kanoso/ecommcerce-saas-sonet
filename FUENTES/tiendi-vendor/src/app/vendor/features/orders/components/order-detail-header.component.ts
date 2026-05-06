import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Order } from '../orders.store';

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

function formatFull(isoDate: string): string {
  const date = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoDate));
  const time = new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
  return `${date} — ${time}`;
}

@Component({
  selector: 'td-order-detail-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-header.component.html',
  styleUrl: './order-detail-header.component.scss',
})
export class OrderDetailHeaderComponent {
  order = input.required<Order>();

  back = output<void>();

  formatFull = formatFull;

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusClass(status: string): string {
    return STATUS_CSS[status] ?? 'tag';
  }
}
