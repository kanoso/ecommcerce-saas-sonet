import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { SpinnerComponent } from '../atoms/spinner.component';

@Component({
  selector: 'td-chart-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective, SpinnerComponent],
  template: `
    <div class="chart-card">
      <div class="chart-card__header">
        <h3 class="chart-card__title">{{ title() }}</h3>
      </div>

      <div class="chart-card__body">
        @if (loading()) {
          <div class="chart-card__loading">
            <td-spinner size="lg" />
          </div>
        } @else if (!hasData()) {
          <div class="chart-card__empty" role="status">
            <span class="material-icons-outlined" aria-hidden="true">bar_chart</span>
            <p>Sin datos disponibles</p>
          </div>
        } @else {
          <canvas
            baseChart
            [data]="data()"
            [type]="type()"
            [options]="mergedOptions()"
            role="img"
            [attr.aria-label]="title()"
          ></canvas>
        }
      </div>
    </div>
  `,
  styles: [`
    .chart-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      box-shadow: var(--shadow);
    }

    .chart-card__header {
      margin-bottom: 16px;
    }

    .chart-card__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .chart-card__body {
      position: relative;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    canvas {
      width: 100% !important;
    }

    .chart-card__loading,
    .chart-card__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);

      span.material-icons-outlined {
        font-size: 48px;
        opacity: 0.3;
      }

      p { margin: 0; font-size: 14px; }
    }
  `],
})
export class ChartCardComponent {
  title = input.required<string>();
  type = input.required<ChartType>();
  data = input.required<ChartData>();
  options = input<ChartOptions>({});
  loading = input<boolean>(false);

  hasData(): boolean {
    const d = this.data();
    if (!d?.datasets?.length) return false;
    return d.datasets.some((ds) => ds.data?.length > 0);
  }

  mergedOptions(): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: true,
      ...this.options(),
    };
  }
}
