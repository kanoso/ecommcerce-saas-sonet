import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order, OrderStatus, StatusHistoryEntry } from '../orders.store';

interface TimelineStep {
  status: OrderStatus;
  label: string;
  icon: string;
}

const STEPS: TimelineStep[] = [
  { status: 'PENDING', label: 'Pedido recibido', icon: 'receipt_long' },
  { status: 'CONFIRMED', label: 'Confirmado', icon: 'check_circle' },
  { status: 'DISPATCHED', label: 'En camino', icon: 'local_shipping' },
  { status: 'DELIVERED', label: 'Entregado', icon: 'done_all' },
];

function formatAt(isoDate: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function findEntry(history: StatusHistoryEntry[], status: OrderStatus): StatusHistoryEntry | undefined {
  return history.find((h) => h.status === status);
}

@Component({
  selector: 'td-order-status-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-status-timeline.component.html',
  styleUrl: './order-status-timeline.component.scss',
})
export class OrderStatusTimelineComponent {
  order = input.required<Order>();

  readonly steps = STEPS;

  formatAt = formatAt;

  isDone(status: OrderStatus): boolean {
    return !!findEntry(this.order().statusHistory, status);
  }

  getEntry(status: OrderStatus): StatusHistoryEntry | undefined {
    return findEntry(this.order().statusHistory, status);
  }
}
