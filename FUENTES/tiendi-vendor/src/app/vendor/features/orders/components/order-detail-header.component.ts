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
  template: `
    <div class="header">
      <div class="header__nav">
        <button class="header__back" type="button" (click)="back.emit()" aria-label="Volver a pedidos">
          &#8592; Pedidos
        </button>
      </div>
      <div class="header__main">
        <div class="header__title-row">
          <h1 class="header__title">Pedido #{{ order().orderNumber }}</h1>
          <span [className]="getStatusClass(order().status)">
            {{ getStatusLabel(order().status) }}
          </span>
        </div>
        <span class="header__date">{{ formatFull(order().createdAt) }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .header__back {
      background: none;
      border: none;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 0.15s;

      &:hover { color: var(--text-primary); }
    }

    .header__title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .header__title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .header__date {
      font-size: 13px;
      color: var(--text-secondary);
    }
  `],
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
