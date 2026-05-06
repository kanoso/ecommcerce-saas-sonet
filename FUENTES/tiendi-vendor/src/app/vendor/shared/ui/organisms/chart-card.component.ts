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
  templateUrl: './chart-card.component.html',
  styleUrl: './chart-card.component.scss',
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
