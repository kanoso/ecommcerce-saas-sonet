import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import Chart from 'chart.js/auto';
import { CategoryData } from '../analytics.store';

@Component({
  selector: 'app-category-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-card">
      <div class="chart-header">
        <h3 class="chart-title">Ventas por categoría</h3>
      </div>

      @if (data().length > 0) {
        <div class="chart-body">
          <div class="canvas-wrap">
            <canvas #canvas></canvas>
          </div>
          <ul class="legend-list">
            @for (item of data(); track item.label) {
              <li class="legend-item">
                <span class="legend-dot" [style.background]="item.color"></span>
                <span class="legend-label">{{ item.label }}</span>
                <span class="legend-pct">{{ item.value }}%</span>
              </li>
            }
          </ul>
        </div>
      } @else {
        <div class="empty-state">
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p>Sin datos para este período</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .chart-header {
      margin-bottom: 16px;
    }
    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    .chart-body {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .canvas-wrap {
      width: 180px;
      height: 180px;
      flex-shrink: 0;
    }
    .legend-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-width: 140px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-label {
      flex: 1;
      font-size: 13px;
      color: #374151;
    }
    .legend-pct {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 160px;
      color: var(--text-muted);
      font-size: 14px;
    }
  `],
})
export class CategoryChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<CategoryData[]>();

  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const d = this.data();
      if (d.length > 0) {
        setTimeout(() => this.buildChart(d), 0);
      } else {
        this.destroyChart();
      }
    });
  }

  ngAfterViewInit(): void {
    const d = this.data();
    if (d.length > 0) {
      this.buildChart(d);
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private buildChart(data: CategoryData[]): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;
    this.destroyChart();

    this.chart = new Chart(canvasEl, {
      type: 'doughnut',
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            data: data.map((d) => d.value),
            backgroundColor: data.map((d) => d.color),
            borderWidth: 2,
            borderColor: '#ffffff',
          },
        ],
      },
      options: {
        cutout: '65%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
      },
    });
  }
}
