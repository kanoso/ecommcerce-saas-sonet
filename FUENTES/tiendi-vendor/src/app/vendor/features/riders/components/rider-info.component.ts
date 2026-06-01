import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RiderDetail } from '../riders.store';

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

@Component({
  selector: 'td-rider-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rider-info.component.html',
  styleUrl: './rider-info.component.scss',
})
export class RiderInfoComponent {
  rider = input<RiderDetail | null>(null);

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusClass(status: string): string {
    return STATUS_CSS[status] ?? 'status-badge';
  }
}
