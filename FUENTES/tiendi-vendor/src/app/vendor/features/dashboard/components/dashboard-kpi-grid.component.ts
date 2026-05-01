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
  template: `
    <div class="kpi-grid" role="region" aria-label="Indicadores clave">
      <td-kpi-card
        title="Ventas hoy"
        [value]="salesValue()"
        [change]="12"
        changeLabel="vs ayer"
        icon="attach_money"
        [loading]="isLoading()"
        (clicked)="kpiClick.emit('sales')"
      />

      <td-kpi-card
        title="Pedidos pendientes"
        [value]="pendingCount()"
        icon="pending_actions"
        [loading]="isLoading()"
        (clicked)="kpiClick.emit('orders')"
      />

      <div [class.kpi-grid__danger]="lowStockCount() > 0">
        <td-kpi-card
          title="Stock bajo"
          [value]="lowStockCount()"
          icon="warning"
          [loading]="isLoading()"
          (clicked)="kpiClick.emit('stock')"
        />
      </div>

      <td-kpi-card
        title="Productos activos"
        [value]="activeProductCount()"
        changeLabel="de 200 del plan Pro"
        icon="inventory"
        [loading]="isLoading()"
        (clicked)="kpiClick.emit('products')"
      />
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .kpi-grid__danger td-kpi-card {
      --kpi-value-color: var(--danger);
    }

    @media (max-width: 1023px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 640px) {
      .kpi-grid { grid-template-columns: 1fr; }
    }
  `],
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
