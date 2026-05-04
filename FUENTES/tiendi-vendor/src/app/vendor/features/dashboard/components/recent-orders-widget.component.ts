import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';
import { DashboardOrder } from '../dashboard.store';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'En camino',
  DELIVERED: 'Entregado',
  REJECTED: 'Rechazado',
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: 'tag-pending',
  CONFIRMED: 'tag-confirmed',
  DISPATCHED: 'tag-dispatched',
  DELIVERED: 'tag-delivered',
  REJECTED: 'tag-rejected',
};

@Component({
  selector: 'app-recent-orders-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SkeletonComponent],
  templateUrl: './recent-orders-widget.component.html',
  styleUrl: './recent-orders-widget.component.scss',
})
export class RecentOrdersWidgetComponent {
  orders = input.required<DashboardOrder[]>();
  isLoading = input<boolean>(false);

  orderClick = output<string>();

  readonly skeletonRows = Array(5);

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusClass(status: string): string {
    return STATUS_CLASSES[status] ?? '';
  }
}
