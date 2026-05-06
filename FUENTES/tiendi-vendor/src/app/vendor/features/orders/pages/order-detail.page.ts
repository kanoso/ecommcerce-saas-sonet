import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrdersStore } from '../orders.store';
import { OrderDetailHeaderComponent } from '../components/order-detail-header.component';
import { OrderCustomerInfoComponent } from '../components/order-customer-info.component';
import { OrderItemsListComponent } from '../components/order-items-list.component';
import { OrderActionsComponent } from '../components/order-actions.component';
import { OrderStatusTimelineComponent } from '../components/order-status-timeline.component';
import { OrderPaymentInfoComponent } from '../components/order-payment-info.component';
import { OrderDeliveryInfoComponent } from '../components/order-delivery-info.component';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';

@Component({
  selector: 'td-order-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OrderDetailHeaderComponent,
    OrderCustomerInfoComponent,
    OrderItemsListComponent,
    OrderActionsComponent,
    OrderStatusTimelineComponent,
    OrderPaymentInfoComponent,
    OrderDeliveryInfoComponent,
    SkeletonComponent,
  ],
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.scss',
})
export class OrderDetailPage implements OnInit {
  protected readonly store = inject(OrdersStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadOrder(id);
    }
  }

  navigateBack(): void {
    this.router.navigate(['/vendor/orders']);
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadOrder(id);
    }
  }
}
