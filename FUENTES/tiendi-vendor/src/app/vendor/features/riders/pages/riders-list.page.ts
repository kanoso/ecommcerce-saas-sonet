import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { RidersStore, RiderStatus } from '../riders.store';
import { RidersTableComponent } from '../components/riders-table.component';

export const RIDER_STATUS_OPTIONS: { label: string; value: RiderStatus | null }[] = [
  { label: 'Todos', value: null },
  { label: 'En revisión', value: 'UNDER_REVIEW' },
  { label: 'Aprobado', value: 'APPROVED' },
  { label: 'Activo', value: 'ACTIVE' },
  { label: 'Rechazado', value: 'REJECTED' },
  { label: 'Pendiente docs', value: 'PENDING_DOCUMENTS' },
  { label: 'Inactivo', value: 'INACTIVE' },
  { label: 'Suspendido', value: 'SUSPENDED' },
];

@Component({
  selector: 'td-riders-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RidersTableComponent],
  templateUrl: './riders-list.page.html',
  styleUrl: './riders-list.page.scss',
})
export class RidersListPage implements OnInit {
  protected readonly store = inject(RidersStore);
  private readonly router = inject(Router);

  readonly statusOptions = RIDER_STATUS_OPTIONS;

  ngOnInit(): void {
    this.store.loadRiders(1);
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const status = value === '' ? null : (value as RiderStatus);
    this.store.setStatusFilter(status);
    this.store.loadRiders(1);
  }

  onReview(riderId: string): void {
    void this.router.navigate(['/vendor/riders', riderId]);
  }

  goToPrevPage(): void {
    const page = this.store.page();
    if (page > 1) {
      this.store.loadRiders(page - 1);
    }
  }

  goToNextPage(): void {
    const page = this.store.page();
    const totalPages = this.store.totalPages();
    if (page < totalPages) {
      this.store.loadRiders(page + 1);
    }
  }
}
