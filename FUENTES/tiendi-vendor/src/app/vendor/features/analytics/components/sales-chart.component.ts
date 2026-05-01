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
import { SalesChartData } from '../analytics.store';

@Component({
  selector: 'app-sales-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-card">
      <div class="chart-header">
        <h3 class="chart-title">Evolución de ventas</h3>
        <div class="chart-legend">
          <span class="legend-dot legend-dot--current"></span><span class="legend-label">Este período</span>
          <span class="legend-dot legend-dot--previous"></span><span class="legend-label">Período anterior</span>
        </div>
      </div>
      @if (data()) {
        <div class="canvas-wrap">
          <canvas #canvas></canvas>
        </div>
      } @else {
        <div class="empty-state">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    .chart-legend {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .legend-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 4px;
    }
    .legend-dot--current { background: #047857; }
    .legend-dot--previous { background: #9CA3AF; }
    .legend-label { margin-right: 4px; }
    .canvas-wrap {
      position: relative;
      height: 280px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 200px;
      color: var(--text-muted);
      font-size: 14px;
    }
  `],
})
export class SalesChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<SalesChartData | null>();

  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const d = this.data();
      if (d) {
        // Wait for DOM
        setTimeout(() => this.buildChart(d), 0);
      } else {
        this.destroyChart();
      }
    });
  }

  ngAfterViewInit(): void {
    const d = this.data();
    if (d) {
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

  private buildChart(data: SalesChartData): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;
    this.destroyChart();

    this.chart = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Este período',
            data: data.current,
            borderColor: '#047857',
            backgroundColor: 'rgba(4,120,87,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#047857',
            pointRadius: 4,
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Período anterior',
            data: data.previous,
            borderColor: '#9CA3AF',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: '#9CA3AF',
            pointRadius: 3,
            tension: 0.4,
            fill: false,
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
              label: (ctx) => {
                const val = ctx.parsed.y;
                return ` S/ ${(val ?? 0).toLocaleString('es-PE')}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 12 }, color: '#6B7280' },
          },
          y: {
            grid: { color: '#F3F4F6' },
            ticks: {
              font: { size: 12 },
              color: '#6B7280',
              callback: (v) => `S/ ${Number(v).toLocaleString('es-PE')}`,
            },
          },
        },
      },
    });
  }
}
