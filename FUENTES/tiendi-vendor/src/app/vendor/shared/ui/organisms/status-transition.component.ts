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
  templateUrl: './status-transition.component.html',
  styleUrl: './status-transition.component.scss',
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
