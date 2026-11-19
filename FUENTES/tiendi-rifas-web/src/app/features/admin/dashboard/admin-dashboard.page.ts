import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../../core/api/admin-api';
import { RaffleSummary } from '../../../core/api/api.models';
import { canGoToLiveDraw, visibleStatusOf } from '../../../core/raffle-status/visible-status';
import { AdminAlertsStore } from '../alerts/admin-alerts.store';

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [RouterLink],
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  protected readonly alertsStore = inject(AdminAlertsStore);
  private readonly adminApi = inject(AdminApi);
  private readonly raffles = signal<RaffleSummary[]>([]);

  /** DT-23: draws the operator has to run or is running live now. */
  protected readonly pendingDraws = computed(() => {
    const now = new Date();
    return this.raffles().filter((r) => canGoToLiveDraw(visibleStatusOf(r, now, { admin: true })))
      .length;
  });

  constructor() {
    this.adminApi.listRaffles?.().subscribe({
      next: (list) => this.raffles.set(list),
      error: () => this.raffles.set([]),
    });
  }
}
