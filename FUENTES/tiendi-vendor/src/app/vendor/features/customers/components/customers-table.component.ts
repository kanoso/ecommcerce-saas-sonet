import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Customer, CustomerType } from '../customers.store';

/**
 * Usage:
 * <app-customers-table
 *   [customers]="store.customers()"
 *   (viewDetail)="store.selectCustomer($event)"
 * />
 */
@Component({
  selector: 'app-customers-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './customers-table.component.html',
  styleUrl: './customers-table.component.scss',
})
export class CustomersTableComponent {
  customers = input.required<Customer[]>();
  viewDetail = output<string>();

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  getTagClass(type: CustomerType): string {
    const map: Record<CustomerType, string> = {
      vip: 'tag tag-vip',
      regular: 'tag tag-regular',
      new: 'tag tag-new',
      inactive: 'tag tag-inactive',
    };
    return map[type] ?? 'tag tag-inactive';
  }

  getTypeLabel(type: CustomerType): string {
    const map: Record<CustomerType, string> = {
      vip: '⭐ VIP',
      regular: 'Regular',
      new: '🆕 Nuevo',
      inactive: 'Inactivo',
    };
    return map[type] ?? type;
  }
}
