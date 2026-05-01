import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/services/auth.store';
import { DashboardStore } from '../dashboard.store';
import { StoreConfigStore } from '../../store-config/store-config.store';
import { ChecklistItem, WelcomeChecklistComponent } from '../../../shared/ui/molecules/welcome-checklist.component';
import { DashboardGreetingComponent } from '../components/dashboard-greeting.component';
import { DashboardKpiGridComponent } from '../components/dashboard-kpi-grid.component';
import { RecentOrdersWidgetComponent } from '../components/recent-orders-widget.component';
import { SalesChartWidgetComponent } from '../components/sales-chart-widget.component';
import { LowStockWidgetComponent } from '../components/low-stock-widget.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    WelcomeChecklistComponent,
    DashboardGreetingComponent,
    DashboardKpiGridComponent,
    RecentOrdersWidgetComponent,
    SalesChartWidgetComponent,
    LowStockWidgetComponent,
  ],
  template: `
    <div class="dashboard">
      <app-dashboard-greeting
        [userName]="userName()"
        [storeName]="storeName()"
        [date]="today"
      />

      <app-welcome-checklist [items]="checklistItems()" />

      <app-dashboard-kpi-grid
        [todaySales]="store.todaySales()"
        [pendingCount]="store.pendingCount()"
        [lowStockCount]="store.lowStockProducts().length"
        [activeProductCount]="store.activeProductCount()"
        [isLoading]="store.isLoading()"
        (kpiClick)="onKpiClick($event)"
      />

      <div class="dashboard__grid">
        <app-recent-orders-widget
          [orders]="store.recentOrders()"
          [isLoading]="store.isLoading()"
          (orderClick)="onOrderClick($event)"
        />

        <app-sales-chart-widget
          [orders]="store.recentOrders()"
          [isLoading]="store.isLoading()"
        />
      </div>

      <app-low-stock-widget
        [products]="store.lowStockProducts()"
        [isLoading]="store.isLoading()"
        (stockUpdate)="onStockUpdate($event)"
      />

      @if (store.error()) {
        <div class="dashboard__error" role="alert">
          {{ store.error() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      max-width: 1280px;
      margin: 0 auto;
    }

    .dashboard__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .dashboard__error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: var(--radius);
      padding: 12px 16px;
      font-size: 13px;
      color: var(--danger);
    }

    @media (max-width: 1023px) {
      .dashboard__grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .dashboard {
        padding: 16px;
        gap: 16px;
      }
    }
  `],
})
export class DashboardPage implements OnInit {
  protected readonly store = inject(DashboardStore);
  private readonly authStore = inject(AuthStore);
  private readonly storeConfigStore = inject(StoreConfigStore);
  private readonly router = inject(Router);

  readonly today = new Date();

  userName = computed(() => {
    const name = this.authStore.currentUser()?.name;
    return name ? name.split(' ')[0] : 'Vendedor';
  });

  storeName = computed(() => this.storeConfigStore.info().name);

  checklistItems = computed<ChecklistItem[]>(() => [
    { label: 'Perfil y logo configurados', done: true },
    { label: 'Primer producto agregado', done: true },
    { label: 'Horarios configurados', done: true },
    { label: 'Subir banner', done: false },
    { label: 'Agregar 5+ productos', done: false },
    { label: 'Configurar facturación electrónica', done: false },
  ]);

  ngOnInit(): void {
    this.store.loadDashboard();
  }

  onOrderClick(orderId: string): void {
    void this.router.navigate(['/vendor/orders', orderId]);
  }

  onKpiClick(kpi: string): void {
    if (kpi === 'sales') {
      void this.router.navigate(['/vendor/orders'], { queryParams: { status: 'DELIVERED' } });
    } else if (kpi === 'orders') {
      void this.router.navigate(['/vendor/orders'], { queryParams: { status: 'PENDING' } });
    } else if (kpi === 'products' || kpi === 'stock') {
      void this.router.navigate(['/vendor/products']);
    }
  }

  onStockUpdate(event: { productId: string; newStock: number }): void {
    this.store.updateProductStock(event.productId, event.newStock);
  }
}
