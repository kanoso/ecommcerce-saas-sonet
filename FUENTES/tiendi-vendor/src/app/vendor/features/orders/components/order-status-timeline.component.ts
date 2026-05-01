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
  template: `
    <div class="card" role="region" aria-label="Historial de estados">
      <h2 class="card__title">Historial de estados</h2>

      <div class="timeline">
        @for (step of steps; track step.status) {
          <div
            class="timeline__item"
            [class.timeline__item--done]="isDone(step.status)"
            [attr.aria-label]="step.label + (isDone(step.status) ? ' — completado' : ' — pendiente')"
          >
            <div class="timeline__dot">
              @if (isDone(step.status)) {
                <span class="material-symbols-rounded timeline__check" aria-hidden="true">check</span>
              }
            </div>
            <div class="timeline__content">
              <span class="timeline__label">{{ step.label }}</span>
              @if (getEntry(step.status); as entry) {
                <span class="timeline__date">{{ formatAt(entry.at) }}</span>
              } @else {
                <span class="timeline__date timeline__date--empty">Pendiente</span>
              }
            </div>
          </div>
        }

        @if (order().status === 'REJECTED') {
          <div class="timeline__item timeline__item--rejected" aria-label="Pedido rechazado">
            <div class="timeline__dot timeline__dot--rejected">
              <span class="material-symbols-rounded timeline__check" aria-hidden="true">close</span>
            </div>
            <div class="timeline__content">
              <span class="timeline__label timeline__label--rejected">Rechazado</span>
              @if (getEntry('REJECTED'); as entry) {
                <span class="timeline__date">{{ formatAt(entry.at) }}</span>
              }
              @if (order().rejectionReason) {
                <span class="timeline__reason">{{ order().rejectionReason }}</span>
              }
            </div>
          </div>
        }
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
      margin: 0 0 20px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .timeline {
      display: flex;
      flex-direction: column;
    }

    .timeline__item {
      display: flex;
      gap: 12px;
      padding-bottom: 20px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        left: 9px;
        top: 20px;
        bottom: 0;
        width: 2px;
        background: var(--border);
      }

      &:last-child {
        padding-bottom: 0;

        &::before { display: none; }
      }
    }

    .timeline__item--done {
      &::before { background: var(--primary); }
    }

    .timeline__item--rejected {
      &::before { background: var(--danger); }
    }

    .timeline__dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      flex-shrink: 0;
      border: 2px solid var(--border);
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }

    .timeline__item--done .timeline__dot {
      background: var(--primary);
      border-color: var(--primary);
    }

    .timeline__dot--rejected {
      background: var(--danger) !important;
      border-color: var(--danger) !important;
    }

    .timeline__check {
      font-size: 13px;
      color: #fff;
    }

    .timeline__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 1px;
    }

    .timeline__label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .timeline__label--rejected {
      color: var(--danger);
    }

    .timeline__date {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .timeline__date--empty {
      font-style: italic;
    }

    .timeline__reason {
      font-size: 12px;
      color: var(--danger);
      margin-top: 4px;
      padding: 6px 8px;
      background: rgba(239,68,68,.06);
      border-radius: var(--radius);
      border-left: 2px solid var(--danger);
    }
  `],
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
