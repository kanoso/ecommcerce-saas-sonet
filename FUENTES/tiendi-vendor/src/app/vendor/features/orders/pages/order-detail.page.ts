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
  template: `
    <div class="page">
      @if (store.isLoading()) {
        <div class="page__loading" aria-busy="true" aria-label="Cargando pedido">
          <td-skeleton height="60px" />
          <div class="page__grid">
            <div class="page__col-left">
              <td-skeleton height="160px" />
              <td-skeleton height="240px" />
            </div>
            <div class="page__col-right">
              <td-skeleton height="160px" />
              <td-skeleton height="200px" />
              <td-skeleton height="100px" />
            </div>
          </div>
        </div>
      } @else if (store.selectedOrder(); as order) {
        <td-order-detail-header
          [order]="order"
          (back)="navigateBack()"
        />

        <div class="page__grid">
          <div class="page__col-left">
            <td-order-customer-info [order]="order" />
            <td-order-items-list [order]="order" />
          </div>

          <div class="page__col-right">
            <td-order-actions
              [order]="order"
              [isUpdating]="store.isUpdating()"
              (confirm)="store.confirmOrder(order.id)"
              (dispatch)="store.dispatchOrder(order.id)"
              (deliver)="store.deliverOrder(order.id)"
              (reject)="store.rejectOrder(order.id, $event)"
            />
            <td-order-status-timeline [order]="order" />
            <td-order-payment-info [order]="order" />
            <td-order-delivery-info [order]="order" />
          </div>
        </div>
      } @else if (store.error()) {
        <div class="page__error" role="alert">
          <p>{{ store.error() }}</p>
          <button class="btn-retry" type="button" (click)="reload()">Reintentar</button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page__loading {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .page__grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .page__col-left,
    .page__col-right {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .page__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px;
      color: var(--danger);
      font-size: 14px;
    }

    .btn-retry {
      padding: 8px 20px;
      border-radius: var(--radius);
      border: 1px solid var(--danger);
      background: transparent;
      color: var(--danger);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover { background: rgba(239,68,68,.06); }
    }
  `],
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
