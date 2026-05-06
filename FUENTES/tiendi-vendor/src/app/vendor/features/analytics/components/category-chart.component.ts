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
  templateUrl: './category-chart.component.html',
  styleUrl: './category-chart.component.scss',
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
