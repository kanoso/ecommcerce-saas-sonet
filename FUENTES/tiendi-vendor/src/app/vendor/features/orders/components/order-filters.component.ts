import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { OrderFilters } from '../orders.store';

@Component({
  selector: 'td-order-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-filters.component.html',
  styleUrl: './order-filters.component.scss',
})
export class OrderFiltersComponent {
  filters = input.required<OrderFilters>();

  filtersChange = output<Partial<OrderFilters>>();
  clearAll = output<void>();

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ status: value as OrderFilters['status'] });
  }

  onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ period: value });
  }

  onPaymentChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ paymentMethod: value });
  }

  onDeliveryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ deliveryType: value });
  }

  onExport(): void {
    // TODO: implementar exportación real — por ahora solo feedback visual
    alert('Exportación CSV próximamente disponible.');
  }
}
