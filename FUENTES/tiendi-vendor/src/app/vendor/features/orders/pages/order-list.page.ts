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
  templateUrl: './order-list.page.html',
  styleUrl: './order-list.page.scss',
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
