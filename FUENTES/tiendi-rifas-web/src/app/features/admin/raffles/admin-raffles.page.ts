import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../../core/api/admin-api';
import { RaffleSummary } from '../../../core/api/api.models';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
  DRAWN: 'Sorteada',
  CANCELLED: 'Cancelada',
};

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

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }
}
