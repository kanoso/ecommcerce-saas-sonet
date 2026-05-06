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
  templateUrl: './sales-chart-widget.component.html',
  styleUrl: './sales-chart-widget.component.scss',
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
