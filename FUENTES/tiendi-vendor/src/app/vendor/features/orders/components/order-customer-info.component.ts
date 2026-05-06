import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

@Component({
  selector: 'td-order-customer-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-customer-info.component.html',
  styleUrl: './order-customer-info.component.scss',
})
export class OrderCustomerInfoComponent {
  order = input.required<Order>();

  getInitials = getInitials;
}
