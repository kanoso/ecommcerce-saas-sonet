import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrdersStore, OrderStatus } from '../orders.store';
import { LayoutService } from '../../../shared/layout/layout.service';
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
  templateUrl: './order-list.page.html',
  styleUrl: './order-list.page.scss',
})
export class OrderListPage implements OnInit, OnDestroy {
  protected readonly store = inject(OrdersStore);
  protected readonly isMobile = inject(LayoutService).isMobile;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const statusParam = this.route.snapshot.queryParamMap.get('status') as OrderStatus | null;
    if (statusParam) {
      this.store.setActiveTab(statusParam);
    }
    this.store.loadOrders();
    this.refreshInterval = setInterval(() => this.store.loadOrders(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
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
