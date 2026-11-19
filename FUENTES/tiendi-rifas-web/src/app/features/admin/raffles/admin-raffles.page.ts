import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../../core/api/admin-api';
import { RaffleSummary } from '../../../core/api/api.models';
import {
  VisibleStatus,
  canGoToLiveDraw,
  visibleStatusLabel,
  visibleStatusOf,
} from '../../../core/raffle-status/visible-status';

/** The filter options, in the order a raffle goes through them. */
const FILTERS: { value: VisibleStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ON_SALE', label: 'En venta' },
  { value: 'SALES_CLOSED', label: 'Ventas cerradas' },
  { value: 'DRAW_PENDING', label: 'Sorteo pendiente' },
  { value: 'LIVE', label: 'Sorteando en vivo' },
  { value: 'DRAW_REFUSED', label: 'Sorteo rechazado' },
  { value: 'DRAWN', label: 'Sorteada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

interface RaffleRow {
  raffle: RaffleSummary;
  status: VisibleStatus;
  label: string;
  canGoLive: boolean;
}

@Component({
  selector: 'app-admin-raffles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-raffles.page.html',
  styleUrl: './admin-raffles.page.scss',
})
export class AdminRafflesPage implements OnInit {
  private readonly adminApi = inject(AdminApi);

  readonly raffles = signal<RaffleSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** The moment the visible status is read at (DT-23). */
  readonly now = signal(new Date());
  readonly statusFilter = signal<VisibleStatus | ''>('');
  readonly filters = FILTERS;

  /** Every raffle with its visible status: what an operator acts on. */
  readonly rows = computed<RaffleRow[]>(() =>
    this.raffles().map((raffle) => {
      const status = visibleStatusOf(raffle, this.now(), { admin: true });
      return {
        raffle,
        status,
        label: visibleStatusLabel(status, raffle.drawAt),
        canGoLive: canGoToLiveDraw(status),
      };
    }),
  );

  readonly visibleRows = computed(() => {
    const filter = this.statusFilter();
    return filter ? this.rows().filter((row) => row.status === filter) : this.rows();
  });

  ngOnInit(): void {
    this.loadRaffles();
  }

  loadRaffles(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi.listRaffles().subscribe({
      next: (data) => {
        this.raffles.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las rifas. Revisa tu conexión e intenta nuevamente.');
        this.loading.set(false);
      },
    });
  }

  onFilterChange(value: string): void {
    this.statusFilter.set(FILTERS.some((f) => f.value === value) ? (value as VisibleStatus) : '');
  }
}
