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
  template: `
    <div class="analytics-page">
      <!-- Page header -->
      <div class="page-header">
        <div class="header-text">
          <h1 class="page-title">Analytics</h1>
          <p class="page-subtitle">Monitorea el rendimiento de tu tienda</p>
        </div>
        <div class="header-actions">
          <button class="btn-export" (click)="exportCsv()" title="Exportar CSV">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
          <button class="btn-export btn-export--secondary" (click)="exportPdf()" title="Exportar PDF">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      <!-- Toast -->
      @if (toastMsg) {
        <div class="toast" role="status" aria-live="polite">{{ toastMsg }}</div>
      }

      <!-- Error state -->
      @if (store.error()) {
        <div class="error-banner" role="alert">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ store.error() }}
        </div>
      }

      <!-- Period selector -->
      <app-period-selector
        [period]="store.period()"
        [customRange]="store.customRange()"
        (periodChange)="onPeriodChange($event)"
        (customRangeChange)="onCustomRangeChange($event)"
      />

      <!-- Skeleton loading -->
      @if (store.isLoading()) {
        <div class="skeleton-section">
          <div class="skeleton-grid">
            @for (i of [1,2,3,4]; track i) {
              <div class="skeleton-card">
                <div class="skeleton-icon"></div>
                <div class="skeleton-body">
                  <div class="skeleton-line skeleton-line--short"></div>
                  <div class="skeleton-line skeleton-line--tall"></div>
                  <div class="skeleton-line skeleton-line--short"></div>
                </div>
              </div>
            }
          </div>
          <div class="skeleton-chart-wide"></div>
          <div class="skeleton-chart-row">
            <div class="skeleton-chart-half"></div>
            <div class="skeleton-chart-half"></div>
          </div>
        </div>
      } @else {
        <!-- KPI grid -->
        <app-analytics-kpi-grid [summary]="store.summary()" />

        <!-- Sales chart (full width) -->
        <app-sales-chart [data]="store.salesChart()" />

        <!-- Bottom charts row -->
        <div class="charts-row">
          <div class="charts-col--wide">
            <app-top-products-list [products]="store.topProducts()" />
          </div>
          <div class="charts-col--narrow">
            <app-category-chart [data]="store.categoryChart()" />
          </div>
        </div>

        <!-- Hourly chart (full width) -->
        <app-hourly-chart [data]="store.hourlyChart()" />
      }
    </div>
  `,
  styles: [`
    .analytics-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      max-width: 1280px;
      margin: 0 auto;
    }
    @media (max-width: 640px) {
      .analytics-page { padding: 16px; gap: 16px; }
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 4px;
    }
    .page-subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin: 0;
    }
    .header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn-export {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius);
      border: 1px solid var(--primary);
      background: var(--primary);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-export:hover { background: var(--primary-dark); border-color: var(--primary-dark); }
    .btn-export--secondary {
      background: var(--card);
      color: var(--primary);
    }
    .btn-export--secondary:hover { background: #D1FAE5; }

    /* Toast */
    .toast {
      padding: 10px 16px;
      background: #111827;
      color: #fff;
      border-radius: var(--radius);
      font-size: 14px;
      align-self: flex-start;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Error */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: var(--radius);
      color: #B91C1C;
      font-size: 14px;
    }

    /* Charts layout */
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
    }
    @media (max-width: 1024px) {
      .charts-row { grid-template-columns: 1fr; }
    }
    .charts-col--wide { min-width: 0; }
    .charts-col--narrow { min-width: 0; }

    /* Skeleton */
    .skeleton-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .skeleton-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .skeleton-grid { grid-template-columns: 1fr; }
    }
    .skeleton-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      gap: 14px;
    }
    .skeleton-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius);
      background: var(--surface);
      flex-shrink: 0;
      animation: pulse 1.4s ease-in-out infinite;
    }
    .skeleton-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .skeleton-line {
      height: 12px;
      background: var(--surface);
      border-radius: 4px;
      animation: pulse 1.4s ease-in-out infinite;
    }
    .skeleton-line--short { width: 60%; }
    .skeleton-line--tall { height: 22px; width: 80%; }
    .skeleton-chart-wide {
      height: 300px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      animation: pulse 1.4s ease-in-out infinite;
    }
    .skeleton-chart-row {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
    }
    @media (max-width: 1024px) {
      .skeleton-chart-row { grid-template-columns: 1fr; }
    }
    .skeleton-chart-half {
      height: 260px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `],
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
