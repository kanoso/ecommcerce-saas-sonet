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
import { LayoutService } from '../../../shared/layout/layout.service';
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
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  protected readonly store = inject(DashboardStore);
  protected readonly isMobile = inject(LayoutService).isMobile;
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
