import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RiderDocument } from '../riders.store';

const DOC_TYPE_LABELS: Record<string, string> = {
  LICENSE: 'Licencia de conducir',
  SOAT: 'SOAT',
  BACKGROUND_CHECK: 'Antecedentes',
  VEHICLE_REGISTRATION: 'Tarjeta de propiedad',
  VEHICLE_PHOTO: 'Foto del vehículo',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
};

const DOC_STATUS_CSS: Record<string, string> = {
  PENDING: 'doc-status doc-status--pending',
  APPROVED: 'doc-status doc-status--approved',
  REJECTED: 'doc-status doc-status--rejected',
};

@Component({
  selector: 'td-rider-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rider-documents.component.html',
  styleUrl: './rider-documents.component.scss',
})
export class RiderDocumentsComponent {
  documents = input<RiderDocument[]>([]);

  getDocTypeLabel(type: string): string {
    return DOC_TYPE_LABELS[type] ?? type;
  }

  getDocStatusLabel(status: string): string {
    return DOC_STATUS_LABELS[status] ?? status;
  }

  getDocStatusClass(status: string): string {
    return DOC_STATUS_CSS[status] ?? 'doc-status';
  }
}
