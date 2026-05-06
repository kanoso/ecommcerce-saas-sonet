import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AnalyticsStore, Period } from '../analytics.store';
import { PeriodSelectorComponent } from '../components/period-selector.component';
import { AnalyticsKpiGridComponent } from '../components/analytics-kpi-grid.component';
import { SalesChartComponent } from '../components/sales-chart.component';
import { TopProductsListComponent } from '../components/top-products-list.component';
import { CategoryChartComponent } from '../components/category-chart.component';
import { HourlyChartComponent } from '../components/hourly-chart.component';

/*
 * Usage: routed via /vendor/analytics
 * Requires: AnalyticsStore (providedIn: 'root')
 */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PeriodSelectorComponent,
    AnalyticsKpiGridComponent,
    SalesChartComponent,
    TopProductsListComponent,
    CategoryChartComponent,
    HourlyChartComponent,
  ],
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage implements OnInit {
  readonly store = inject(AnalyticsStore);

  toastMsg = '';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.store.loadAnalytics();
  }

  onPeriodChange(period: Period): void {
    this.store.setPeriod(period);
  }

  onCustomRangeChange(range: { from: string; to: string }): void {
    this.store.setCustomRange(range.from, range.to);
  }

  exportCsv(): void {
    // Plan check: in production, inject SubscriptionStore and check planId >= 'plan-pro'
    const isPro = true;
    if (isPro) {
      window.open('/api/analytics/export?format=csv', '_blank');
    } else {
      this.showToast('Disponible en Plan Pro');
    }
  }

  exportPdf(): void {
    this.showToast('Disponible en Plan Enterprise');
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsg = '';
    }, 3000);
  }
}
