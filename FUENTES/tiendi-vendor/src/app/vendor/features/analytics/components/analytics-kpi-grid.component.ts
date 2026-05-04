import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnalyticsSummary } from '../analytics.store';

const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

@Component({
  selector: 'app-analytics-kpi-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics-kpi-grid.component.html',
  styleUrl: './analytics-kpi-grid.component.scss',
})
export class AnalyticsKpiGridComponent {
  summary = input.required<AnalyticsSummary | null>();

  formatMoney(value: number): string {
    return PEN.format(value);
  }

  abs(value: number): number {
    return Math.abs(value);
  }
}
