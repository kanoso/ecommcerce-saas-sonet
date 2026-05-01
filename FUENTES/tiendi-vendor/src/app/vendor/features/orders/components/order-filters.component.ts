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
  template: `
    <div class="filters" role="search" aria-label="Filtros de pedidos">
      <select
        class="filters__select"
        [value]="filters().status"
        (change)="onStatusChange($event)"
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        <option value="PENDING">Pendiente</option>
        <option value="CONFIRMED">Confirmado</option>
        <option value="DISPATCHED">En camino</option>
        <option value="DELIVERED">Entregado</option>
        <option value="REJECTED">Rechazado</option>
      </select>

      <select
        class="filters__select"
        [value]="filters().period"
        (change)="onPeriodChange($event)"
        aria-label="Filtrar por período"
      >
        <option value="">Todos los períodos</option>
        <option value="today">Hoy</option>
        <option value="yesterday">Ayer</option>
        <option value="last7">Últimos 7 días</option>
        <option value="thisMonth">Este mes</option>
      </select>

      <select
        class="filters__select"
        [value]="filters().paymentMethod"
        (change)="onPaymentChange($event)"
        aria-label="Filtrar por método de pago"
      >
        <option value="">Todos los pagos</option>
        <option value="CASH">Efectivo</option>
        <option value="YAPE">Yape</option>
        <option value="PLIN">Plin</option>
        <option value="TRANSFER">Transferencia</option>
        <option value="CARD">Tarjeta</option>
      </select>

      <select
        class="filters__select"
        [value]="filters().deliveryType"
        (change)="onDeliveryChange($event)"
        aria-label="Filtrar por tipo de entrega"
      >
        <option value="">Todos los tipos</option>
        <option value="DELIVERY">Delivery</option>
        <option value="PICKUP">Recojo en tienda</option>
      </select>

      <button class="filters__btn filters__btn--clear" type="button" (click)="clearAll.emit()">
        Limpiar
      </button>

      <button class="filters__btn filters__btn--export" type="button" (click)="onExport()">
        Exportar CSV
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }

    .filters__select {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 12px;
      font-size: 13px;
      background: var(--card);
      cursor: pointer;
      outline: none;
      color: var(--text-primary);
      transition: border-color 0.15s;

      &:focus {
        border-color: var(--primary);
      }
    }

    .filters__btn {
      padding: 8px 14px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border);
      transition: background 0.15s, color 0.15s;
    }

    .filters__btn--clear {
      background: var(--card);
      color: var(--text-secondary);

      &:hover { background: var(--surface); }
    }

    .filters__btn--export {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);

      &:hover { background: var(--primary-dark); }
    }
  `],
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
