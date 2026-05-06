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
  templateUrl: './hourly-chart.component.html',
  styleUrl: './hourly-chart.component.scss',
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
