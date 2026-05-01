import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

export interface StatusHistoryItem {
  status: string;
  at: string;
  description?: string;
}

@Component({
  selector: 'td-status-transition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline" aria-label="Historial de estados">
      @for (item of history(); track item.at; let first = $first) {
        <li class="timeline__item" [class.timeline__item--current]="first">
          <div class="timeline__dot" [class.timeline__dot--current]="first" aria-hidden="true">
            @if (first) {
              <span class="material-icons-outlined" aria-hidden="true">radio_button_checked</span>
            } @else {
              <span class="material-icons-outlined" aria-hidden="true">check_circle</span>
            }
          </div>

          <div class="timeline__content">
            <span class="timeline__status">{{ item.status }}</span>
            <time class="timeline__time" [dateTime]="item.at">
              {{ formatDate(item.at) }}
            </time>
            @if (item.description) {
              <p class="timeline__desc">{{ item.description }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: [`
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .timeline__item {
      display: flex;
      gap: 16px;
      position: relative;

      /* Vertical line between items */
      &:not(:last-child)::after {
        content: '';
        position: absolute;
        left: 11px;
        top: 24px;
        bottom: -8px;
        width: 2px;
        background: var(--border);
      }
    }

    .timeline__item--current::after {
      background: var(--primary-accent) !important;
    }

    .timeline__dot {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      z-index: 1;
      background: var(--card);
      padding-bottom: 8px;

      span { font-size: 20px; }
    }

    .timeline__dot--current {
      color: var(--primary);
    }

    .timeline__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: 20px;
    }

    .timeline__status {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .timeline__time {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .timeline__desc {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 2px 0 0;
    }
  `],
})
export class StatusTransitionComponent {
  history = input.required<StatusHistoryItem[]>();

  formatDate(dateStr: string): string {
    try {
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }
}
