import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrdersStore, OrderStatus } from '../orders.store';
import { OrderFiltersComponent } from '../components/order-filters.component';
import { OrderStatusTabsComponent } from '../components/order-status-tabs.component';
import { OrderListTableComponent } from '../components/order-list-table.component';

@Component({
  selector: 'td-order-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OrderFiltersComponent,
    OrderStatusTabsComponent,
    OrderListTableComponent,
  ],
  template: `
    <div class="page">
      <header class="page__header">
        <div class="page__header-text">
          <h1 class="page__title">Pedidos</h1>
          <p class="page__subtitle">Gestioná y hacé seguimiento de todos tus pedidos</p>
        </div>
      </header>

      <td-order-filters
        [filters]="store.filters()"
        (filtersChange)="store.setFilters($event)"
        (clearAll)="store.clearFilters()"
      />

      <td-order-status-tabs
        [activeTab]="store.activeTab()"
        [countByStatus]="store.countByStatus()"
        (tabChange)="store.setActiveTab($any($event))"
      />

      <td-order-list-table
        [orders]="store.filteredOrders()"
        [isLoading]="store.isLoading()"
        (orderClick)="navigateToDetail($event)"
        (quickAction)="handleQuickAction($event)"
      />
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page { padding: 24px; }

    .page__header {
      margin-bottom: 24px;
    }

    .page__title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .page__subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
    }
  `],
})
export class OrderListPage implements OnInit {
  protected readonly store = inject(OrdersStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const statusParam = this.route.snapshot.queryParamMap.get('status') as OrderStatus | null;
    if (statusParam) {
      this.store.setActiveTab(statusParam);
    }
    this.store.loadOrders();
  }

  navigateToDetail(orderId: string): void {
    this.router.navigate(['/vendor/orders', orderId]);
  }

  handleQuickAction(event: { orderId: string; action: string }): void {
    switch (event.action) {
      case 'confirm':
        this.store.confirmOrder(event.orderId);
        break;
      case 'dispatch':
        this.store.dispatchOrder(event.orderId);
        break;
      case 'deliver':
        this.store.deliverOrder(event.orderId);
        break;
    }
  }
}
