import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-items-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-items-list.component.html',
  styleUrl: './order-items-list.component.scss',
})
export class OrderItemsListComponent {
  order = input.required<Order>();
}
