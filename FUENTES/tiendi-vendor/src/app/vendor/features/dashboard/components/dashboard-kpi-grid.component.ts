import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { KpiCardComponent } from '../../../shared/ui/molecules/kpi-card.component';

@Component({
  selector: 'app-dashboard-kpi-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardComponent],
  templateUrl: './dashboard-kpi-grid.component.html',
  styleUrl: './dashboard-kpi-grid.component.scss',
})
export class DashboardKpiGridComponent {
  todaySales = input.required<number>();
  pendingCount = input.required<number>();
  lowStockCount = input.required<number>();
  activeProductCount = input.required<number>();
  isLoading = input<boolean>(false);

  kpiClick = output<string>();

  salesValue() {
    return 'S/ ' + this.todaySales().toLocaleString('es-PE', { minimumFractionDigits: 2 });
  }
}
