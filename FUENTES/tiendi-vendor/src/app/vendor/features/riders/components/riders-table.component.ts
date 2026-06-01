import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RiderSummary } from '../riders.store';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';

const STATUS_LABELS: Record<string, string> = {
  PENDING_DOCUMENTS: 'Pendiente docs',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  ACTIVE: 'Activo',
  REJECTED: 'Rechazado',
  INACTIVE: 'Inactivo',
  SUSPENDED: 'Suspendido',
};

const STATUS_CSS: Record<string, string> = {
  PENDING_DOCUMENTS: 'status-badge status-badge--pending-documents',
  UNDER_REVIEW: 'status-badge status-badge--under-review',
  APPROVED: 'status-badge status-badge--approved',
  ACTIVE: 'status-badge status-badge--active',
  REJECTED: 'status-badge status-badge--rejected',
  INACTIVE: 'status-badge status-badge--inactive',
  SUSPENDED: 'status-badge status-badge--suspended',
};

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate));
}

@Component({
  selector: 'td-riders-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './riders-table.component.html',
  styleUrl: './riders-table.component.scss',
})
export class RidersTableComponent {
  riders = input.required<RiderSummary[]>();
  isLoading = input<boolean>(false);

  review = output<string>();

  readonly skeletonRows = [1, 2, 3, 4, 5];

  formatDate = formatDate;

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusClass(status: string): string {
    return STATUS_CSS[status] ?? 'status-badge';
  }

  onReview(riderId: string): void {
    this.review.emit(riderId);
  }
}
