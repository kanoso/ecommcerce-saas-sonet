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
import { HourlyData } from '../analytics.store';

@Component({
  selector: 'app-hourly-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-card">
      <div class="chart-header">
        <h3 class="chart-title">Pedidos por hora del día</h3>
      </div>

      @if (data().length > 0) {
        <div class="canvas-wrap">
          <canvas #canvas></canvas>
        </div>
      } @else {
        <div class="empty-state">
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
    .canvas-wrap {
      position: relative;
      height: 240px;
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
export class HourlyChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<HourlyData[]>();

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

  private buildChart(data: HourlyData[]): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;
    this.destroyChart();

    this.chart = new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels: data.map((d) => d.hour),
        datasets: [
          {
            label: 'Pedidos',
            data: data.map((d) => d.orders),
            backgroundColor: 'rgba(4,120,87,.7)',
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} pedidos`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6B7280' },
          },
          y: {
            grid: { color: '#F3F4F6' },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#6B7280', stepSize: 5 },
          },
        },
      },
    });
  }
}
