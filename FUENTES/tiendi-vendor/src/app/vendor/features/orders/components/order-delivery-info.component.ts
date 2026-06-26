import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Order, OrdersStore } from '../orders.store';
import { AssignRiderDialogComponent } from './assign-rider-dialog.component';
import { VendorRealtimeService } from '../vendor-realtime.service';

@Component({
  selector: 'td-order-delivery-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssignRiderDialogComponent],
  templateUrl: './order-delivery-info.component.html',
  styleUrl: './order-delivery-info.component.scss',
})
export class OrderDeliveryInfoComponent implements OnInit {
  order = input.required<Order>();

  assignDialogVisible = signal(false);
  assignedPendingConfirmation = signal(false);

  private readonly ordersStore = inject(OrdersStore);
  private readonly realtime = inject(VendorRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const o = this.order();
    if (o.deliveryType === 'DELIVERY' && o.status === 'DISPATCHED' && o.storeId) {
      this.realtime.connect(o.storeId);
    }

    this.realtime.riderAccepted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.assignedPendingConfirmation.set(false);
        this.ordersStore.loadOrder(this.order().id);
      });

    this.realtime.riderRejected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.assignedPendingConfirmation.set(false);
      });
  }

  openAssignDialog(): void {
    this.assignDialogVisible.set(true);
  }

  onRiderAssigned(): void {
    this.assignDialogVisible.set(false);
    this.assignedPendingConfirmation.set(true);
  }
}
