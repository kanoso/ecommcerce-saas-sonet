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
  templateUrl: './sales-chart.component.html',
  styleUrl: './sales-chart.component.scss',
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
