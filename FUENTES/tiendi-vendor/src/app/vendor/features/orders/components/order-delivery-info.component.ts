import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Order, OrdersStore } from '../orders.store';
import { AssignRiderDialogComponent } from './assign-rider-dialog.component';
import { VendorRealtimeService } from '../vendor-realtime.service';

const DELIVERY_FLOW: string[] = [
  'ASSIGNED',
  'HEADING_TO_STORE',
  'AT_STORE',
  'PICKED_UP',
  'HEADING_TO_CUSTOMER',
  'AT_DESTINATION',
  'DELIVERED',
];

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Asignado',
  HEADING_TO_STORE: 'En camino a la tienda',
  AT_STORE: 'En la tienda',
  PICKED_UP: 'Pedido recogido',
  HEADING_TO_CUSTOMER: 'En camino al cliente',
  AT_DESTINATION: 'En el destino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devuelto',
  INCIDENT: 'Incidente',
};

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

  qrDataUrl = signal<string | null>(null);

  protected readonly deliveryFlow = DELIVERY_FLOW;
  protected readonly deliveryStatusLabels = DELIVERY_STATUS_LABELS;

  protected readonly deliveryStatusLabel = computed(() => {
    const s = this.order().deliveryStatus;
    return s ? (DELIVERY_STATUS_LABELS[s] ?? s) : null;
  });

  protected readonly deliveryFlowIndex = computed(() => {
    const s = this.order().deliveryStatus;
    if (!s) return -1;
    return DELIVERY_FLOW.indexOf(s);
  });

  protected readonly isDeliveryInProgress = computed(() => {
    const s = this.order().deliveryStatus;
    if (!s) return false;
    return !['DELIVERED', 'CANCELLED', 'RETURNED', 'INCIDENT'].includes(s);
  });

  private readonly qrEffect = effect(() => {
    const code = this.order().pickupCode;
    if (!code) {
      this.qrDataUrl.set(null);
      return;
    }
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(code, { width: 140, margin: 1 }),
      )
      .then((url) => this.qrDataUrl.set(url))
      .catch(() => this.qrDataUrl.set(null));
  });

  private readonly ordersStore = inject(OrdersStore);
  private readonly realtime = inject(VendorRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly connectEffect = effect(() => {
    const o = this.order();
    if (o.deliveryType === 'DELIVERY' && o.status === 'DISPATCHED' && o.storeId) {
      this.realtime.connect(o.storeId);
    }
  });

  ngOnInit(): void {
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

    this.realtime.deliveryStatus$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ deliveryId, status }) => {
        if (deliveryId === this.order().deliveryId) {
          this.ordersStore.applyDeliveryStatus(deliveryId, status);
        }
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
