import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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
}
