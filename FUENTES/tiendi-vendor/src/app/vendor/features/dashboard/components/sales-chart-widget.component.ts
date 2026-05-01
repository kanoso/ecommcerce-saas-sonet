import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';
import { DashboardOrder } from '../dashboard.store';

@Component({
  selector: 'app-sales-chart-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BaseChartDirective, SkeletonComponent],
  template: `
    <div class="widget" role="region" aria-label="Gráfico de ventas">
      <div class="widget__header">
        <h2 class="widget__title">Ventas últimos 7 días</h2>
        <a routerLink="/vendor/analytics" class="widget__link">Ver analytics →</a>
      </div>

      <div class="widget__body">
        @if (isLoading()) {
          <td-skeleton variant="rect" height="220px" />
        } @else {
          <div class="chart-wrap" aria-hidden="true">
            <canvas
              baseChart
              [data]="chartData"
              [options]="chartOptions"
              type="line"
            ></canvas>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .widget {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .widget__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .widget__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .widget__link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;

      &:hover { text-decoration: underline; }
    }

    .widget__body {
      padding: 16px 20px;
    }

    .chart-wrap {
      position: relative;
      height: 220px;
    }
  `],
})
export class SalesChartWidgetComponent {
  orders = input.required<DashboardOrder[]>();
  isLoading = input<boolean>(false);

  readonly chartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        data: [820, 1100, 950, 1340, 890, 1580, 1240],
        label: 'Ventas (S/)',
        borderColor: '#10B981',
        backgroundColor: 'rgba(16,185,129,.08)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#10B981',
        pointRadius: 4,
      },
    ],
  };

  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#F3F4F6' },
        ticks: {
          callback: (value) => 'S/ ' + value,
        },
      },
      x: {
        grid: { display: false },
      },
    },
  };
}
