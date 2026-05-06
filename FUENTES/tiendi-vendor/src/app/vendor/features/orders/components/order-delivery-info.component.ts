import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-delivery-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-delivery-info.component.html',
  styleUrl: './order-delivery-info.component.scss',
})
export class OrderDeliveryInfoComponent {
  order = input.required<Order>();
}
