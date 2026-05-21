import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-items-list',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-items-list.component.html',
  styleUrl: './order-items-list.component.scss',
})
export class OrderItemsListComponent {
  order = input.required<Order>();

  totalDiscount = computed(() =>
    this.order().items.reduce((acc, item) =>
      acc + (item.discountAmount ?? 0), 0)
  );
}
